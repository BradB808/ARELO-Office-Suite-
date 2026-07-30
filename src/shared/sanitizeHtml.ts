// Allowlist sanitizer for HTML that came from outside the app.
//
// The realistic attack on someone who edits documents for a living is a
// document sent to them. A .docx, .md or .html file can carry a remote image
// whose only job is to report "this person opened the file, from this IP, at
// this time", or an iframe, or a javascript: link.
//
// A blocklist ("strip <script>, strip onclick=") always loses eventually —
// unquoted attributes, novel tags, nested encodings. So this works the other
// way round: parse the markup properly, then keep only the elements,
// attributes and URL schemes on the list below, and drop everything else.
//
// Parsing uses the platform parser rather than regexes, so what we inspect is
// exactly what a browser would build.

/** Elements an office document legitimately needs. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'mark',
  'sub', 'sup', 'small', 'code', 'pre', 'blockquote', 'q', 'cite',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'a', 'img', 'figure', 'figcaption',
])

/** Attributes allowed on any element. */
const GLOBAL_ATTRS = new Set(['style', 'class', 'title', 'dir', 'lang'])

/** Attributes allowed only on specific elements. */
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'data-align', 'data-wrap']),
  td: new Set(['colspan', 'rowspan', 'headers', 'align', 'valign']),
  th: new Set(['colspan', 'rowspan', 'scope', 'align', 'valign']),
  col: new Set(['span', 'width']),
  colgroup: new Set(['span']),
  ol: new Set(['start', 'type']),
  li: new Set(['value']),
}

/**
 * Elements removed *with their contents*. For everything else we unwrap —
 * keeping the text — but a script's or a style's text content is the payload,
 * so those go entirely.
 */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'applet', 'link', 'meta', 'base', 'form', 'input', 'button', 'select',
  'textarea', 'option', 'template', 'noscript', 'svg', 'math', 'audio',
  'video', 'source', 'track', 'canvas', 'portal',
])

/** CSS properties that can themselves fetch a URL or overlay the page. */
const CSS_BANNED = /(^|[^a-z-])(url|image-set|image|behavior|expression|-moz-binding|position\s*:\s*fixed)\s*[:(]/i

/**
 * URL schemes that cannot reach the network. `data:` is allowed for images
 * only (see isSafeImageSrc) because that is how imported pictures travel.
 */
function isSafeLinkHref(value: string): boolean {
  const v = value.trim()
  if (v === '') return false
  // Relative URLs and in-document anchors are fine.
  if (/^[#/?]/.test(v)) return true
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return true

  const scheme = v.slice(0, v.indexOf(':')).toLowerCase()
  // http(s) and mailto are kept so links in documents still work — following
  // one is gated by a confirmation dialog in the main process, and the app
  // itself never loads them.
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto'
}

/**
 * Images must be self-contained. A remote <img> is the classic read receipt,
 * so only inline data: images survive; anything remote is dropped.
 */
function isSafeImageSrc(value: string): boolean {
  const v = value.trim()
  if (/^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,/i.test(v)) return true
  // Relative paths inside our own exported bundles.
  if (/^[a-z0-9._-]+$/i.test(v)) return true
  return false
}

function sanitizeStyle(value: string): string {
  if (CSS_BANNED.test(value)) {
    // Strip only the offending declarations rather than the whole attribute,
    // so legitimate colour/size formatting survives.
    return value
      .split(';')
      .filter((decl) => decl.trim() !== '' && !CSS_BANNED.test(decl))
      .join(';')
  }
  return value
}

export interface SanitizeReport {
  /** Remote images that were removed — worth telling the user about. */
  remoteImages: number
  /** Scripts, iframes, objects, event handlers and javascript: URLs removed. */
  activeContent: number
}

function scrubElement(el: Element, report: SanitizeReport): void {
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase()
    const tag = el.tagName.toLowerCase()

    // Every on* handler, however it was quoted, in one rule.
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name)
      report.activeContent++
      continue
    }

    const allowed = GLOBAL_ATTRS.has(name) || TAG_ATTRS[tag]?.has(name)
    if (!allowed) {
      el.removeAttribute(attr.name)
      continue
    }

    if (name === 'style') {
      const cleaned = sanitizeStyle(attr.value)
      if (cleaned !== attr.value) report.activeContent++
      if (cleaned.trim()) el.setAttribute('style', cleaned)
      else el.removeAttribute('style')
      continue
    }

    if (tag === 'a' && name === 'href' && !isSafeLinkHref(attr.value)) {
      el.removeAttribute('href')
      report.activeContent++
      continue
    }

    if (tag === 'img' && name === 'src' && !isSafeImageSrc(attr.value)) {
      // Drop the whole picture: an <img> with no src is a broken-image icon.
      el.remove()
      report.remoteImages++
      return
    }
  }

  // Links leaving the document open in a new context and must not hand the
  // destination a window reference back into the app.
  if (el.tagName.toLowerCase() === 'a' && el.getAttribute('href')) {
    el.setAttribute('rel', 'noopener noreferrer nofollow')
  }
}

/**
 * Returns markup containing only allowlisted elements, attributes and URL
 * schemes. Text content is preserved throughout — disallowed *formatting*
 * elements are unwrapped rather than deleted, so no words are lost.
 */
export function sanitizeHtml(html: string): { html: string; report: SanitizeReport } {
  const report: SanitizeReport = { remoteImages: 0, activeContent: 0 }

  // `text/html` parsing is inert: no script runs, no image is fetched, no
  // stylesheet is loaded. Nothing here touches the live document.
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase()

      if (DROP_WITH_CONTENT.has(tag)) {
        child.remove()
        report.activeContent++
        continue
      }

      // Recurse first, so an unwrapped element's children are already clean.
      walk(child)

      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(...child.childNodes)
        continue
      }

      scrubElement(child, report)
    }
  }

  // Only the body is ever returned, so anything the parser hoisted into <head>
  // — a leading <script>, a <link rel=stylesheet>, a <meta refresh> — is
  // already gone. Count it anyway, so the report tells the user the truth
  // about what the file contained.
  for (const el of [...doc.head.children]) {
    if (DROP_WITH_CONTENT.has(el.tagName.toLowerCase())) report.activeContent++
  }

  walk(doc.body)
  return { html: doc.body.innerHTML.trim(), report }
}

/** Convenience wrapper for callers that do not need the report. */
export function sanitizeImportedHtml(html: string): string {
  return sanitizeHtml(html).html
}

/** Human-readable note about what was stripped, or null if nothing was. */
export function describeSanitizeReport(report: SanitizeReport): string | null {
  const parts: string[] = []
  if (report.remoteImages > 0) {
    parts.push(
      `${report.remoteImages} image${report.remoteImages === 1 ? '' : 's'} that would have been ` +
        'loaded from a website',
    )
  }
  if (report.activeContent > 0) {
    parts.push(`${report.activeContent} script or tracking element${report.activeContent === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) return null
  return `Removed ${parts.join(' and ')} from this file. Nothing was contacted.`
}
