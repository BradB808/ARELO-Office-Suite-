// EPUB 3 (.epub) export for Anleo Docs.
//
// Pure data -> base64 zip. Mirrors the TipTap JSON traversal patterns used by
// ../export.ts (buildDocxBase64 / renderBlocks), emitting well-formed XHTML
// instead of `docx` API calls. See the note at the top of walk.ts for why
// this file has zero runtime imports of its own sibling files (only a
// type-only import, which erases under Node and never needs runtime module
// resolution).

import type { JSONContent } from '@tiptap/core'
import type { NormalizedMarks } from './walk'
import JSZip from 'jszip'

// ---------- escaping ----------

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function escapeXmlAttr(s: string): string {
  return escapeXmlText(s).replace(/"/g, '&quot;')
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!m) return null
  try {
    const bin = atob(m[2])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { bytes, mime: m[1] }
  } catch {
    return null
  }
}

function epubImageExt(mime: string): 'png' | 'jpg' | null {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  return null
}

// ---------- deterministic pseudo-uuid (no Date.now / randomness) ----------

function hash32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function pseudoUuid(seed: string): string {
  const a = hash32(seed).toString(16).padStart(8, '0')
  const b = hash32(`${seed}:b`).toString(16).padStart(8, '0')
  const c = hash32(`${seed}:c`).toString(16).padStart(8, '0')
  const d = hash32(`${seed}:d`).toString(16).padStart(8, '0')
  const hex = (a + b + c + d).padEnd(32, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

// ---------- mark reading (mirrors export.ts's readMarks) ----------

function readMarks(node: JSONContent): NormalizedMarks {
  const out: NormalizedMarks = {}
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out.bold = true
    else if (mark.type === 'italic') out.italic = true
    else if (mark.type === 'underline') out.underline = true
    else if (mark.type === 'strike') out.strike = true
    else if (mark.type === 'subscript') out.subscript = true
    else if (mark.type === 'superscript') out.superscript = true
    else if (mark.type === 'highlight') out.highlight = mark.attrs?.color as string | undefined
    else if (mark.type === 'link') out.linkHref = mark.attrs?.href as string | undefined
    else if (mark.type === 'textStyle') {
      if (mark.attrs?.color) out.color = mark.attrs.color as string
      if (mark.attrs?.fontFamily) out.fontFamily = String(mark.attrs.fontFamily).replace(/^['"]|['"]$/g, '')
      if (mark.attrs?.fontSize) {
        const n = parseFloat(String(mark.attrs.fontSize))
        if (!Number.isNaN(n)) out.fontSizePx = n
      }
    }
  }
  return out
}

function alignCss(attrs?: Record<string, unknown>): string | undefined {
  const a = attrs?.textAlign as string | undefined
  if (a === 'center' || a === 'right' || a === 'justify' || a === 'left') return a
  return undefined
}

// ---------- image bookkeeping shared across the whole walk ----------

interface EpubCtx {
  zip: JSZip
  imgCount: number
  manifestItems: string[]
}

function imageXhtml(node: JSONContent, ctx: EpubCtx): string {
  const src = (node.attrs?.src as string) ?? ''
  const decoded = dataUrlToBytes(src)
  const ext = decoded ? epubImageExt(decoded.mime) : null
  if (!decoded || !ext) {
    return '<p><em>[image]</em></p>\n'
  }
  const name = `img${ctx.imgCount++}`
  const path = `images/${name}.${ext}`
  ctx.zip.file(`OEBPS/${path}`, decoded.bytes)
  const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg'
  ctx.manifestItems.push(`<item id="${name}" href="${path}" media-type="${mediaType}"/>`)

  const w = node.attrs?.width as number | undefined
  const h = node.attrs?.height as number | undefined
  const dims = w && h ? ` width="${Math.round(w)}" height="${Math.round(h)}"` : ''
  return `<p class="img"><img src="${path}" alt=""${dims}/></p>\n`
}

// ---------- inline runs ----------

function inlineStyle(m: NormalizedMarks): string {
  const decls: string[] = []
  if (m.color) decls.push(`color:${m.color.trim()}`)
  if (m.highlight) decls.push(`background-color:${m.highlight.trim()}`)
  if (m.fontFamily) decls.push(`font-family:${m.fontFamily.trim()}`)
  if (m.fontSizePx) decls.push(`font-size:${m.fontSizePx}px`)
  return decls.join(';')
}

function runXhtml(node: JSONContent): string {
  if (node.type === 'hardBreak') return '<br/>'
  if (node.type !== 'text') return ''
  const m = readMarks(node)
  let inner = escapeXmlText(node.text ?? '')
  if (m.subscript) inner = `<sub>${inner}</sub>`
  if (m.superscript) inner = `<sup>${inner}</sup>`
  if (m.strike) inner = `<s>${inner}</s>`
  if (m.underline) inner = `<u>${inner}</u>`
  if (m.italic) inner = `<em>${inner}</em>`
  if (m.bold) inner = `<strong>${inner}</strong>`
  const style = inlineStyle(m)
  if (style) inner = `<span style="${escapeXmlAttr(style)}">${inner}</span>`
  if (m.linkHref) inner = `<a href="${escapeXmlAttr(m.linkHref)}">${inner}</a>`
  return inner
}

function runsXhtml(nodes: JSONContent[]): string {
  return nodes.map(runXhtml).join('')
}

// ---------- block-level rendering ----------

function paragraphXhtml(node: JSONContent): string {
  const align = alignCss(node.attrs)
  const styleAttr = align ? ` style="text-align:${align}"` : ''
  const inner = node.content?.length ? runsXhtml(node.content) : ''
  return `<p${styleAttr}>${inner}</p>\n`
}

function headingXhtml(node: JSONContent): string {
  const level = Math.min(4, Math.max(1, (node.attrs?.level as number) ?? 1))
  const align = alignCss(node.attrs)
  const styleAttr = align ? ` style="text-align:${align}"` : ''
  const inner = node.content?.length ? runsXhtml(node.content) : ''
  return `<h${level}${styleAttr}>${inner}</h${level}>\n`
}

function blockquoteXhtml(node: JSONContent): string {
  let inner = ''
  for (const child of node.content ?? []) {
    if (child.type === 'paragraph') inner += paragraphXhtml(child)
  }
  return `<blockquote>${inner || '<p></p>\n'}</blockquote>\n`
}

function codeBlockXhtml(node: JSONContent): string {
  const text = (node.content ?? []).map((n) => n.text ?? '').join('')
  return `<pre><code>${escapeXmlText(text)}</code></pre>\n`
}

function listXhtml(node: JSONContent, ctx: EpubCtx): string {
  if (node.type === 'taskList') {
    const items = (node.content ?? []).map((item) => taskItemXhtml(item, ctx)).join('')
    return `<ul class="task-list">${items}</ul>\n`
  }
  const tag = node.type === 'orderedList' ? 'ol' : 'ul'
  const start = node.attrs?.start as number | undefined
  const startAttr = tag === 'ol' && start && start !== 1 ? ` start="${start}"` : ''
  const items = (node.content ?? []).map((item) => listItemXhtml(item, ctx)).join('')
  return `<${tag}${startAttr}>${items}</${tag}>\n`
}

function listItemXhtml(item: JSONContent, ctx: EpubCtx): string {
  let out = '<li>'
  for (const child of item.content ?? []) {
    if (child.type === 'paragraph') {
      out += child.content?.length ? runsXhtml(child.content) : ''
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      out += listXhtml(child, ctx)
    } else {
      out += renderBlocksXhtml([child], ctx)
    }
  }
  out += '</li>\n'
  return out
}

function taskItemXhtml(item: JSONContent, ctx: EpubCtx): string {
  const checked = !!item.attrs?.checked
  const glyph = checked ? '☑' : '☐'
  let out = '<li>'
  let first = true
  for (const child of item.content ?? []) {
    if (child.type === 'paragraph') {
      const inner = child.content?.length ? runsXhtml(child.content) : ''
      out += first ? `${escapeXmlText(glyph)} ${inner}` : inner
      first = false
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      out += listXhtml(child, ctx)
    } else {
      out += renderBlocksXhtml([child], ctx)
    }
  }
  out += '</li>\n'
  return out
}

function tableXhtml(node: JSONContent): string {
  const rows = node.content ?? []
  let out = '<table>\n'
  for (const row of rows) {
    out += '<tr>'
    for (const cell of row.content ?? []) {
      const tag = cell.type === 'tableHeader' ? 'th' : 'td'
      const blocks = cell.content?.length ? cell.content : [{ type: 'paragraph', content: [] }]
      const inner = blocks
        .map((b) => (b.type === 'paragraph' ? (b.content?.length ? runsXhtml(b.content) : '') : ''))
        .join('<br/>')
      out += `<${tag}>${inner}</${tag}>`
    }
    out += '</tr>\n'
  }
  out += '</table>\n'
  return out
}

export function renderBlocksXhtml(nodes: JSONContent[], ctx: EpubCtx): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        out += paragraphXhtml(node)
        break
      case 'heading':
        out += headingXhtml(node)
        break
      case 'blockquote':
        out += blockquoteXhtml(node)
        break
      case 'codeBlock':
        out += codeBlockXhtml(node)
        break
      case 'horizontalRule':
        out += '<hr/>\n'
        break
      case 'pageBreak':
        out += '<div style="break-after:page"></div>\n'
        break
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        out += listXhtml(node, ctx)
        break
      case 'table':
        out += tableXhtml(node)
        break
      case 'image':
        out += imageXhtml(node, ctx)
        break
      default:
        if (node.content?.length) out += renderBlocksXhtml(node.content, ctx)
        break
    }
  }
  return out
}

// ---------- fixed package parts ----------

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>`
}

function contentOpf(opts: { title: string; uuid: string; manifestItems: string[] }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="en">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>${escapeXmlText(opts.title)}</dc:title>
<dc:language>en</dc:language>
<dc:identifier id="pub-id">urn:uuid:${opts.uuid}</dc:identifier>
<meta property="dcterms:modified">2020-01-01T00:00:00Z</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
<item id="css" href="styles.css" media-type="text/css"/>
${opts.manifestItems.join('\n')}
</manifest>
<spine>
<itemref idref="chapter"/>
</spine>
</package>`
}

function navXhtml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>Table of Contents</title></head>
<body>
<nav epub:type="toc" id="toc">
<h1>Contents</h1>
<ol>
<li><a href="chapter.xhtml">${escapeXmlText(title)}</a></li>
</ol>
</nav>
</body>
</html>`
}

function chapterXhtml(title: string, bodyXhtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"/><title>${escapeXmlText(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
<h1 class="doc-title">${escapeXmlText(title)}</h1>
${bodyXhtml}
</body>
</html>`
}

function stylesCss(): string {
  return `body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.5; margin: 1em; color: #1a1a1a; }
h1, h2, h3, h4 { font-family: Helvetica, Arial, sans-serif; font-weight: 700; line-height: 1.25; margin: 1.1em 0 0.45em; }
h1 { font-size: 1.8em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.2em; }
h4 { font-size: 1.05em; }
p { margin: 0 0 0.9em; }
a { color: #2563eb; }
blockquote { margin: 0.9em 0; padding: 0.2em 0 0.2em 1em; border-left: 3px solid #d1d5db; color: #4b5160; font-style: italic; }
pre { background: #f1f2f4; padding: 0.75em; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
code { font-family: Menlo, Consolas, monospace; font-size: 0.9em; }
table { border-collapse: collapse; width: 100%; margin: 0.9em 0; }
td, th { border: 1px solid #d7dae1; padding: 0.4em 0.6em; text-align: left; }
th { background: #f1f2f4; }
img { max-width: 100%; height: auto; }
hr { border: none; border-top: 1px solid #d7dae1; margin: 1.4em 0; }
ul.task-list { list-style: none; padding-left: 0; }
.doc-title { margin-bottom: 0.6em; }
`
}

export async function buildEpubBase64(doc: JSONContent, opts: { title: string }): Promise<string> {
  const zip = new JSZip()
  // mimetype MUST be the first entry in the zip and MUST be stored uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  const ctx: EpubCtx = { zip, imgCount: 0, manifestItems: [] }
  const bodyXhtml = renderBlocksXhtml(doc.content ?? [], ctx)
  const title = opts.title || 'Untitled'
  const seed = `${title}:${JSON.stringify(doc.content ?? []).length}`
  const uuid = pseudoUuid(seed)

  zip.file('META-INF/container.xml', containerXml())
  zip.file('OEBPS/content.opf', contentOpf({ title, uuid, manifestItems: ctx.manifestItems }))
  zip.file('OEBPS/nav.xhtml', navXhtml(title))
  zip.file('OEBPS/chapter.xhtml', chapterXhtml(title, bodyXhtml || '<p></p>\n'))
  zip.file('OEBPS/styles.css', stylesCss())

  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' })
}
