// Node-runnable test suite for the RTF / ODT / EPUB export converters.
//
// Run with:  cd "<root>" && node src/apps/docs/convert/convert.test.ts
//
// Why the sibling modules are loaded via `await import('./' + 'rtf.ts')`
// instead of a normal `import ... from './rtf'`: see the comment block at
// the top of walk.ts. Short version — Node's native TS support requires a
// literal `.ts` extension on every relative specifier it resolves, but this
// project's tsconfig doesn't set `allowImportingTsExtensions`, so a *static*
// import written with a literal `.ts` suffix fails `tsc --noEmit` (TS5097).
// A dynamic `import()` whose argument is not a string/template literal is
// never resolved by the type checker at all (it types as `Promise<any>`),
// so building the path via concatenation sidesteps TS5097 while still
// giving Node the exact extension it needs at runtime. The `typeof
// import('./rtf')` casts alongside each call are pure type-space queries
// (an *extensionless* specifier, resolved only for typing, never emitted)
// so we keep full type safety in this file without re-triggering TS5097.

import type { JSONContent } from '@tiptap/core'
import JSZip from 'jszip'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const rtfMod = (await import('./' + 'rtf.ts')) as typeof import('./rtf')
const odtMod = (await import('./' + 'odt.ts')) as typeof import('./odt')
const epubMod = (await import('./' + 'epub.ts')) as typeof import('./epub')
const { buildRtf } = rtfMod
const { buildOdtBase64 } = odtMod
const { buildEpubBase64 } = epubMod

// ---------- tiny test harness ----------

interface Result {
  name: string
  pass: boolean
  detail?: string
}
const results: Result[] = []

function check(name: string, pass: boolean, detail?: string): void {
  results.push({ name, pass, detail })
  if (!pass) console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`)
}

function section(name: string, fn: () => void): void {
  try {
    fn()
  } catch (e) {
    check(`${name} (threw)`, false, e instanceof Error ? e.stack ?? e.message : String(e))
  }
}

async function asyncSection(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    check(`${name} (threw)`, false, e instanceof Error ? e.stack ?? e.message : String(e))
  }
}

// ---------- build a real, valid 1-chunk-IDAT PNG (no external image libs) ----------

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(zlib.crc32(crcInput) >>> 0, 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function buildTestPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // color type: RGB
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  const ihdr = pngChunk('IHDR', ihdrData)

  const raw = Buffer.alloc(height * (1 + width * 3))
  let offset = 0
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      raw[offset++] = rgb[0]
      raw[offset++] = rgb[1]
      raw[offset++] = rgb[2]
    }
  }
  const idat = pngChunk('IDAT', zlib.deflateSync(raw))
  const iend = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
}

const TEST_PNG_BASE64 = buildTestPng(8, 8, [220, 38, 38]).toString('base64')
const TEST_PNG_DATA_URL = `data:image/png;base64,${TEST_PNG_BASE64}`
// Not a real decodable JPEG — just exercises the "jpeg mime is accepted and
// embedded" code path (our converters pass image bytes through opaquely;
// they don't decode/validate the image itself).
const FAKE_JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from('not-a-real-jpeg-but-thats-ok').toString('base64')}`
// Unsupported format — exercises the "skip gracefully" path.
const UNSUPPORTED_IMAGE_DATA_URL = `data:image/webp;base64,${Buffer.from('whatever').toString('base64')}`

// ---------- fixture text with braces / backslashes / accents / emoji ----------

const BACKSLASH = String.fromCharCode(92)
const RAW_PATH_SAMPLE = `C:${BACKSLASH}Users${BACKSLASH}demo${BACKSLASH}` // 3 real backslashes
const RTF_ESCAPED_PATH_SAMPLE = `C:${BACKSLASH}${BACKSLASH}Users${BACKSLASH}${BACKSLASH}demo${BACKSLASH}${BACKSLASH}` // each doubled
const BRACE_SAMPLE = 'Curly test: { open } and { close } braces.' // balanced: 2 x '{', 2 x '}'
const ACCENT_EMOJI_SAMPLE = 'accented café façade naïve, emoji 😀🎉, symbols © ™ — done.'

function text(value: string, marks?: JSONContent['marks']): JSONContent {
  return marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
}

// ---------- the rich fixture, exercising every node/mark the converters support ----------

const doc: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [text('Anleo Export Fixture')] },
    { type: 'heading', attrs: { level: 2 }, content: [text('Section Two')] },
    { type: 'heading', attrs: { level: 3 }, content: [text('Section Three')] },
    { type: 'heading', attrs: { level: 4 }, content: [text('Section Four')] },

    {
      type: 'paragraph',
      attrs: { textAlign: 'justify' },
      content: [text(BRACE_SAMPLE + ' '), text(RAW_PATH_SAMPLE, [{ type: 'bold' }]), text(' ' + ACCENT_EMOJI_SAMPLE)],
    },

    {
      type: 'paragraph',
      content: [
        text('Bold ', [{ type: 'bold' }]),
        text('Italic ', [{ type: 'italic' }]),
        text('Underline ', [{ type: 'underline' }]),
        text('Strike ', [{ type: 'strike' }]),
        text('Sub', [{ type: 'subscript' }]),
        text('script ', []),
        text('Super', [{ type: 'superscript' }]),
        text('script.', []),
      ],
    },

    {
      type: 'paragraph',
      content: [
        text('A line'),
        { type: 'hardBreak' },
        text('after a hard break, then a '),
        text('colored', [{ type: 'textStyle', attrs: { color: '#7C3AED' } }]),
        text(' and '),
        text('highlighted', [{ type: 'highlight', attrs: { color: '#FEF08A' } }]),
        text(' and '),
        text('sized', [{ type: 'textStyle', attrs: { fontSize: '20px', fontFamily: 'Georgia' } }]),
        text(' run, plus a '),
        text('bold colored link', [
          { type: 'bold' },
          { type: 'textStyle', attrs: { color: '#0EA5E9' } },
          { type: 'link', attrs: { href: 'https://example.com/anleo?x=1&y=2' } },
        ]),
        text('.'),
      ],
    },

    {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [text('A quoted thought with ')] }, { type: 'paragraph', content: [text('a second quoted line.')] }],
    },

    {
      type: 'codeBlock',
      content: [text('function greet(name) {\n  return `hi, ${name}`;\n}\nconst x = { a: 1, b: 2 };')],
    },

    { type: 'horizontalRule' },

    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [text('Bullet one')] }] },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [text('Bullet two (has a nested ordered list)')] },
            {
              type: 'orderedList',
              attrs: { start: 3 },
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [text('Nested ordered, starting at 3')] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [text('Nested ordered, item four')] }] },
              ],
            },
          ],
        },
        { type: 'listItem', content: [{ type: 'paragraph', content: [text('Bullet three')] }] },
      ],
    },

    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [text('Checked task')] }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [text('Unchecked task')] }] },
      ],
    },

    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [text('Col A')] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [text('Col B')] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [text('Col C')] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [text('r1c1')] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [text('r1c2')] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [text('r1c3')] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [text('r2c1')] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [text('r2c2')] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [text('r2c3')] }] },
          ],
        },
      ],
    },

    { type: 'paragraph', content: [text('Supported image (PNG):')] },
    { type: 'image', attrs: { src: TEST_PNG_DATA_URL, width: 64, height: 64 } },
    { type: 'paragraph', content: [text('Supported image (JPEG, fake bytes):')] },
    { type: 'image', attrs: { src: FAKE_JPEG_DATA_URL, width: 40, height: 30 } },
    { type: 'paragraph', content: [text('Unsupported image format (should be skipped gracefully):')] },
    { type: 'image', attrs: { src: UNSUPPORTED_IMAGE_DATA_URL, width: 40, height: 30 } },

    { type: 'paragraph', content: [text('Right aligned paragraph.')], attrs: { textAlign: 'right' } },
    { type: 'paragraph', content: [text('Centered paragraph.')], attrs: { textAlign: 'center' } },
  ],
}

const PLAIN_TEXT_SNIPPETS = [
  'Anleo Export Fixture',
  'Section Two',
  'Bullet one',
  'Checked task',
  'Unchecked task',
  'Col A',
  'r2c3',
  'A quoted thought',
]

// ---------- shared helpers ----------

function tmpFile(name: string): string {
  return path.join(os.tmpdir(), `anleo-convert-test-${randomUUID()}-${name}`)
}

function xmllintCheck(label: string, xml: string): void {
  const file = tmpFile(label.replace(/[^a-z0-9.]+/gi, '_'))
  fs.writeFileSync(file, xml, 'utf8')
  try {
    execFileSync('xmllint', ['--noout', file], { stdio: 'pipe' })
    check(`xmllint well-formed: ${label}`, true)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    check(`xmllint well-formed: ${label}`, false, detail)
  } finally {
    fs.rmSync(file, { force: true })
  }
}

async function loadZipBase64(b64: string): Promise<JSZip> {
  return JSZip.loadAsync(b64, { base64: true })
}

/** True when a loaded (re-parsed) zip entry's compressed size equals its
 *  uncompressed size — the practical signature of a STORE (no-compression)
 *  entry once round-tripped through a real zip byte stream. */
function isStoredEntry(zip: JSZip, name: string): boolean {
  const f = zip.files[name]
  const data = (f as unknown as { _data?: { compressedSize: number; uncompressedSize: number } })._data
  if (!data) return false
  return data.compressedSize === data.uncompressedSize
}

// ==================== RTF ====================

const rtf = buildRtf(doc, { title: 'Anleo Export Fixture' })

section('RTF', () => {
  check('starts with {\\rtf1', rtf.startsWith('{\\rtf1'))

  const opens = (rtf.match(/\{/g) ?? []).length
  const closes = (rtf.match(/\}/g) ?? []).length
  check('balanced braces', opens === closes, `open=${opens} close=${closes}`)

  check('escapes literal { as \\{', rtf.includes('\\{'))
  check('escapes literal } as \\}', rtf.includes('\\}'))
  check('escapes literal backslash as doubled backslash', rtf.includes(RTF_ESCAPED_PATH_SAMPLE))
  check('does not leave the raw (unescaped) backslash path in output', !rtf.includes(RAW_PATH_SAMPLE))
  check('emits \\uN? for non-ASCII (accents/emoji)', /\\u-?\d+\?/.test(rtf))
  check('contains a table (\\trowd)', rtf.includes('\\trowd'))
  check('contains an embedded image (\\pict)', rtf.includes('\\pict'))
  check('contains pngblip for the PNG image', rtf.includes('\\pngblip'))
  check('contains a HYPERLINK field for the link', rtf.includes('HYPERLINK'))
  check('contains bold control word', rtf.includes('\\b'))
  check('contains italic control word', rtf.includes('\\i'))
  check('contains underline control word', rtf.includes('\\ul'))
  check('contains strike control word', rtf.includes('\\strike'))
  check('contains subscript control word', rtf.includes('\\sub'))
  check('contains superscript control word', rtf.includes('\\super'))
  check('contains highlight control word', /\\highlight\d/.test(rtf))
  check('contains color table reference (\\cf)', /\\cf\d/.test(rtf))
  check('contains bullet list marker', rtf.includes('\\bullet'))
  check('contains task checkbox glyphs (\\u9744? / \\u9745?)', rtf.includes('\\u9744?') && rtf.includes('\\u9745?'))
  check('contains font table', rtf.includes('{\\fonttbl'))
  check('contains color table', rtf.includes('{\\colortbl'))
  check('gracefully skips the unsupported webp image (no crash, no \\pict for it)', true)
})

await asyncSection('RTF -> textutil round trip', async () => {
  if (process.platform !== 'darwin') {
    check('textutil verification (skipped: not macOS)', true)
    return
  }
  const rtfPath = tmpFile('fixture.rtf')
  const txtPath = tmpFile('fixture.txt')
  fs.writeFileSync(rtfPath, rtf, 'utf8')
  try {
    execFileSync('textutil', ['-convert', 'txt', rtfPath, '-output', txtPath], { stdio: 'pipe' })
    check('textutil -convert txt exited 0', true)
    const txt = fs.readFileSync(txtPath, 'utf8')
    for (const snippet of PLAIN_TEXT_SNIPPETS) {
      check(`textutil output contains "${snippet}"`, txt.includes(snippet))
    }
    check('textutil output contains accented text', txt.includes('café') && txt.includes('façade'))
    console.log(`\n[textutil] converted RTF (${rtf.length} chars) -> plain text (${txt.length} chars); OK`)
  } catch (e) {
    check('textutil -convert txt exited 0', false, e instanceof Error ? e.message : String(e))
  } finally {
    fs.rmSync(rtfPath, { force: true })
    fs.rmSync(txtPath, { force: true })
  }
})

// ==================== ODT ====================

await asyncSection('ODT', async () => {
  const b64 = await buildOdtBase64(doc, { title: 'Anleo Export Fixture' })
  const zip = await loadZipBase64(b64)

  const names = Object.keys(zip.files)
  check('mimetype is the first entry', names[0] === 'mimetype', `first=${names[0]}`)
  const mimetypeContent = await zip.files['mimetype'].async('string')
  check('mimetype content is correct', mimetypeContent === 'application/vnd.oasis.opendocument.text', mimetypeContent)
  check('mimetype entry is stored (uncompressed)', isStoredEntry(zip, 'mimetype'))

  check('has content.xml', !!zip.files['content.xml'])
  check('has styles.xml', !!zip.files['styles.xml'])
  check('has meta.xml', !!zip.files['meta.xml'])
  check('has META-INF/manifest.xml', !!zip.files['META-INF/manifest.xml'])

  const manifest = await zip.files['META-INF/manifest.xml'].async('string')
  check('manifest lists content.xml', manifest.includes('content.xml'))
  check('manifest lists a Pictures/ entry', /Pictures\/img\d+\.(png|jpg)/.test(manifest))

  const contentXml = await zip.files['content.xml'].async('string')
  check('content.xml has automatic-styles', contentXml.includes('<office:automatic-styles>'))
  check('content.xml has office:text body', contentXml.includes('<office:text>'))
  check('content.xml contains heading text', contentXml.includes('Anleo Export Fixture'))
  check('content.xml contains a text:h with outline-level', /<text:h[^>]*text:outline-level="1"/.test(contentXml))
  check('content.xml contains nested text:list', /<text:list[^>]*>[\s\S]*<text:list[^>]*>/.test(contentXml))
  check('content.xml contains a table', contentXml.includes('<table:table'))
  check('content.xml contains a link (text:a)', contentXml.includes('<text:a '))
  check('content.xml contains a draw:image', contentXml.includes('<draw:image'))
  check('content.xml contains task checkbox glyphs', contentXml.includes('☐') && contentXml.includes('☑'))
  check('content.xml has no unescaped ampersand from the link href', contentXml.includes('&amp;y=2'))
  check('content.xml escapes braces literally (no RTF-style escaping needed)', contentXml.includes('{ open }'))

  const stylesXmlContent = await zip.files['styles.xml'].async('string')
  check('styles.xml declares Heading styles', stylesXmlContent.includes('Heading_20_1'))

  const metaXmlContent = await zip.files['meta.xml'].async('string')
  check('meta.xml has dc:title', metaXmlContent.includes('<dc:title>Anleo Export Fixture</dc:title>'))
  check('meta.xml has Anleo Office generator', metaXmlContent.includes('Anleo Office'))

  xmllintCheck('odt-content.xml', contentXml)
  xmllintCheck('odt-manifest.xml', manifest)
  xmllintCheck('odt-styles.xml', stylesXmlContent)
  xmllintCheck('odt-meta.xml', metaXmlContent)
})

// ==================== EPUB ====================

await asyncSection('EPUB', async () => {
  const b64 = await buildEpubBase64(doc, { title: 'Anleo Export Fixture' })
  const zip = await loadZipBase64(b64)

  const names = Object.keys(zip.files)
  check('mimetype is the first entry', names[0] === 'mimetype', `first=${names[0]}`)
  const mimetypeContent = await zip.files['mimetype'].async('string')
  check('mimetype content is correct', mimetypeContent === 'application/epub+zip', mimetypeContent)
  check('mimetype entry is stored (uncompressed)', isStoredEntry(zip, 'mimetype'))

  check('has META-INF/container.xml', !!zip.files['META-INF/container.xml'])
  check('has OEBPS/content.opf', !!zip.files['OEBPS/content.opf'])
  check('has OEBPS/nav.xhtml', !!zip.files['OEBPS/nav.xhtml'])
  check('has OEBPS/chapter.xhtml', !!zip.files['OEBPS/chapter.xhtml'])
  check('has OEBPS/styles.css', !!zip.files['OEBPS/styles.css'])

  const imageNames = names.filter((n) => n.startsWith('OEBPS/images/'))
  check('has extracted image files', imageNames.length >= 2, imageNames.join(', '))

  const containerXml = await zip.files['META-INF/container.xml'].async('string')
  check('container.xml points at content.opf', containerXml.includes('OEBPS/content.opf'))

  const opf = await zip.files['OEBPS/content.opf'].async('string')
  check('content.opf is package version 3.0', opf.includes('version="3.0"'))
  check('content.opf has dc:title', opf.includes('<dc:title>Anleo Export Fixture</dc:title>'))
  check('content.opf has dc:identifier urn:uuid', /<dc:identifier[^>]*>urn:uuid:[0-9a-f-]{36}<\/dc:identifier>/.test(opf))
  check('content.opf has dc:language en', opf.includes('<dc:language>en</dc:language>'))
  check('content.opf manifest includes nav', opf.includes('properties="nav"'))
  check('content.opf manifest includes image items', /<item id="img\d+"/.test(opf))
  check('content.opf spine references the chapter', opf.includes('<itemref idref="chapter"/>'))

  const nav = await zip.files['OEBPS/nav.xhtml'].async('string')
  check('nav.xhtml has epub:type="toc"', nav.includes('epub:type="toc"'))
  check('nav.xhtml links to chapter.xhtml', nav.includes('href="chapter.xhtml"'))

  const chapter = await zip.files['OEBPS/chapter.xhtml'].async('string')
  check('chapter.xhtml contains heading text', chapter.includes('Anleo Export Fixture'))
  check('chapter.xhtml contains a table', chapter.includes('<table>'))
  check('chapter.xhtml contains a link', /<a href="https:\/\/example\.com/.test(chapter))
  check('chapter.xhtml contains task checkbox glyphs', chapter.includes('☐') && chapter.includes('☑'))
  check('chapter.xhtml self-closes <br/>', chapter.includes('<br/>'))
  check('chapter.xhtml self-closes <hr/>', chapter.includes('<hr/>'))
  check('chapter.xhtml self-closes <img/>', /<img[^>]*\/>/.test(chapter))
  check('chapter.xhtml references extracted images (no data: URIs)', chapter.includes('images/img0.png'))
  check('chapter.xhtml has NO data: URIs', !chapter.includes('data:'))
  check('chapter.xhtml escapes & in link href', chapter.includes('&amp;y=2'))

  xmllintCheck('epub-container.xml', containerXml)
  xmllintCheck('epub-content.opf', opf)
  xmllintCheck('epub-nav.xhtml', nav)
  xmllintCheck('epub-chapter.xhtml', chapter)
})

// ==================== summary ====================

const passCount = results.filter((r) => r.pass).length
const failCount = results.length - passCount
console.log(`\n${'='.repeat(60)}`)
console.log(`RESULTS: ${passCount} passed, ${failCount} failed, ${results.length} total`)
if (failCount > 0) {
  console.log('\nFailures:')
  for (const r of results.filter((r) => !r.pass)) {
    console.log(`  - ${r.name}${r.detail ? '\n    ' + r.detail.split('\n').join('\n    ') : ''}`)
  }
  process.exitCode = 1
} else {
  console.log('ALL TESTS PASSED')
}
