// Export mapping for Anleo Docs. The DOCX and Markdown mapping functions here
// are pure(ish) — they take TipTap JSON / HTML strings in and hand back
// serialized output, with no dependency on a live editor instance, so they
// stay import-safe and can be exercised from a plain Node script.

import type { JSONContent } from '@tiptap/core'
import TurndownService from 'turndown'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingSide,
  TextWrappingType,
  UnderlineType,
  VerticalPositionRelativeFrom,
  WidthType,
  type IRunOptions,
} from 'docx'
import { platform, b64ToBytes } from '../../shared/platform'
import { PAGE_BREAK_ATTR } from './pageBreakExtension'
import { linkLabel, type LiveLink } from '../../shared/livelink'
import { timeAgo } from '../../shared/util'

// ---------- shared helpers ----------

/** px -> twips (1in = 96px = 1440 twips) */
function pxToTwip(px: number): number {
  return Math.round(px * 15)
}

/** px font size -> docx half-points (pt = px * 0.75; half-points = pt * 2) */
function pxToHalfPt(px: number): number {
  return Math.round(px * 0.75 * 2)
}

function hex(color?: string | null): string | undefined {
  if (!color) return undefined
  return color.replace('#', '').toUpperCase()
}

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
}

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CBD1DC' }
const CELL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!m) return null
  try {
    return { bytes: b64ToBytes(m[2]), mime: m[1] }
  } catch {
    return null
  }
}

function docxImageType(mime: string): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/bmp') return 'bmp'
  return null
}

interface MarkAttrs {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  subscript?: boolean
  superscript?: boolean
  color?: string
  highlight?: string
  fontFamily?: string
  fontSizePx?: number
  linkHref?: string
}

function readMarks(node: JSONContent): MarkAttrs {
  const out: MarkAttrs = {}
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

/** Find the first line-height set anywhere in a block's inline content (line
 *  height is applied as a textStyle mark spanning the block, see DocsApp). */
function findLineHeight(nodes: JSONContent[]): number | undefined {
  for (const n of nodes) {
    for (const mark of n.marks ?? []) {
      if (mark.type === 'textStyle' && mark.attrs?.lineHeight) {
        const v = parseFloat(String(mark.attrs.lineHeight))
        if (!Number.isNaN(v)) return v
      }
    }
  }
  return undefined
}

function paragraphSpacing(lineHeight?: number) {
  if (!lineHeight) return undefined
  return { line: Math.round(lineHeight * 240), lineRule: 'auto' as const }
}

function runsFromInline(nodes: JSONContent[], forceItalic = false): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = []
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      runs.push(new TextRun({ text: '', break: 1 }))
      continue
    }
    if (node.type !== 'text') continue
    const m = readMarks(node)
    const opts: IRunOptions = {
      text: node.text ?? '',
      bold: m.bold || undefined,
      italics: m.italic || forceItalic || undefined,
      strike: m.strike || undefined,
      subScript: m.subscript || undefined,
      superScript: m.superscript || undefined,
      underline: m.underline ? { type: UnderlineType.SINGLE } : undefined,
      color: hex(m.color),
      font: m.fontFamily,
      size: m.fontSizePx ? pxToHalfPt(m.fontSizePx) : undefined,
      shading: m.highlight ? { type: ShadingType.CLEAR, fill: hex(m.highlight) } : undefined,
    }
    if (m.linkHref) {
      runs.push(
        new ExternalHyperlink({
          link: m.linkHref,
          children: [new TextRun({ ...opts, color: opts.color ?? '2563EB', underline: opts.underline ?? { type: UnderlineType.SINGLE } })],
        }),
      )
    } else {
      runs.push(new TextRun(opts))
    }
  }
  return runs
}

function alignmentOf(attrs?: Record<string, unknown>) {
  const a = attrs?.textAlign as string | undefined
  if (a === 'center') return AlignmentType.CENTER
  if (a === 'right') return AlignmentType.RIGHT
  if (a === 'justify') return AlignmentType.JUSTIFIED
  return undefined
}

export interface DocxOptions {
  marginPx: number
  /** Content width in px, used to cap embedded image width. */
  contentWidthPx: number
}

function imageParagraph(node: JSONContent, opts: DocxOptions): Paragraph {
  const src = (node.attrs?.src as string) ?? ''
  const decoded = dataUrlToBytes(src)
  const type = decoded ? docxImageType(decoded.mime) : null
  if (!decoded || !type) {
    return new Paragraph({ children: [new TextRun({ text: '[image]', italics: true, color: '9CA3AF' })] })
  }
  let w = (node.attrs?.width as number) || 480
  let h = (node.attrs?.height as number) || 320
  const maxW = opts.contentWidthPx
  if (w > maxW) {
    h = Math.round((h * maxW) / w)
    w = maxW
  }

  // Floated images become real Word floating pictures with square text wrap,
  // anchored to this paragraph and hugging the left/right margin.
  const wrap = node.attrs?.wrap as string | undefined
  if (wrap === 'left' || wrap === 'right') {
    const EMU_PER_PX = 9525
    const gap = 16 * EMU_PER_PX
    return new Paragraph({
      children: [
        new ImageRun({
          type,
          data: decoded.bytes,
          transformation: { width: w, height: h },
          floating: {
            horizontalPosition: {
              relative: HorizontalPositionRelativeFrom.COLUMN,
              align: wrap === 'left' ? HorizontalPositionAlign.LEFT : HorizontalPositionAlign.RIGHT,
            },
            verticalPosition: {
              relative: VerticalPositionRelativeFrom.PARAGRAPH,
              offset: 0,
            },
            wrap: {
              type: TextWrappingType.SQUARE,
              side: wrap === 'left' ? TextWrappingSide.RIGHT : TextWrappingSide.LEFT,
            },
            margins: { top: gap / 2, bottom: gap, left: gap, right: gap },
          },
        }),
      ],
    })
  }

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type, data: decoded.bytes, transformation: { width: w, height: h } })],
  })
}

function codeBlockParagraphs(node: JSONContent): Paragraph[] {
  const text = (node.content ?? []).map((n) => n.text ?? '').join('')
  const lines = text.length ? text.split('\n') : ['']
  return lines.map(
    (line, i) =>
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F1F2F4' },
        spacing: { before: 0, after: 0 },
        contextualSpacing: true,
        border:
          i === 0
            ? { top: { style: BorderStyle.SINGLE, size: 4, color: 'D7DAE1' } }
            : i === lines.length - 1
              ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D7DAE1' } }
              : undefined,
        children: [new TextRun({ text: line || ' ', font: 'Menlo', size: 20, color: '374151' })],
      }),
  )
}

function blockquoteParagraphs(node: JSONContent): Paragraph[] {
  const inner = node.content ?? []
  const out: Paragraph[] = []
  for (const child of inner) {
    if (child.type === 'paragraph') {
      out.push(
        new Paragraph({
          indent: { left: pxToTwip(28) },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'C7CCD6' } },
          spacing: paragraphSpacing(findLineHeight(child.content ?? [])),
          children: runsFromInline(child.content ?? [], true),
        }),
      )
    }
  }
  return out.length ? out : [new Paragraph({})]
}

function listItemParagraphs(
  item: JSONContent,
  depth: number,
  kind: 'bullet' | 'ordered' | 'task',
  opts: DocxOptions,
  ordinal?: number,
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  const content = item.content ?? []
  let firstParaDone = false
  for (const child of content) {
    if (child.type === 'paragraph') {
      const runs = runsFromInline(child.content ?? [])
      if (!firstParaDone) {
        const prefix =
          kind === 'ordered'
            ? `${ordinal ?? 1}.`
            : kind === 'task'
              ? (item.attrs?.checked ? '☑' : '☐')
              : undefined
        const children = prefix ? [new TextRun({ text: prefix + '  ' }), ...runs] : runs
        out.push(
          new Paragraph({
            indent: { left: pxToTwip(20 + depth * 22) },
            bullet: kind === 'bullet' ? { level: depth } : undefined,
            alignment: alignmentOf(child.attrs),
            spacing: paragraphSpacing(findLineHeight(child.content ?? [])),
            children,
          }),
        )
        firstParaDone = true
      } else {
        out.push(
          new Paragraph({
            indent: { left: pxToTwip(20 + depth * 22) },
            children: runs,
          }),
        )
      }
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      out.push(...listBlock(child, depth + 1, opts))
    } else {
      out.push(...renderBlocks([child], depth, opts))
    }
  }
  return out
}

function listBlock(node: JSONContent, depth: number, opts: DocxOptions): (Paragraph | Table)[] {
  const items = node.content ?? []
  if (node.type === 'bulletList') {
    return items.flatMap((item) => listItemParagraphs(item, depth, 'bullet', opts))
  }
  if (node.type === 'taskList') {
    return items.flatMap((item) => listItemParagraphs(item, depth, 'task', opts))
  }
  // orderedList
  let n = (node.attrs?.start as number) || 1
  const out: (Paragraph | Table)[] = []
  for (const item of items) {
    out.push(...listItemParagraphs(item, depth, 'ordered', opts, n))
    n++
  }
  return out
}

function tableBlock(node: JSONContent, opts: DocxOptions): Table {
  const rowNodes = node.content ?? []
  const colCount = Math.max(1, ...rowNodes.map((r) => (r.content ?? []).length))
  const rows = rowNodes.map(
    (rowNode) =>
      new TableRow({
        children: (rowNode.content ?? []).map((cellNode) => {
          const isHeader = cellNode.type === 'tableHeader'
          const cellChildren = renderBlocks(cellNode.content ?? [{ type: 'paragraph', content: [] }], 0, opts)
          return new TableCell({
            children: cellChildren.length ? cellChildren : [new Paragraph({})],
            width: { size: Math.round(100 / colCount), type: WidthType.PERCENTAGE },
            shading: isHeader ? { type: ShadingType.CLEAR, fill: 'F1F2F4' } : undefined,
            borders: CELL_BORDERS,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
          })
        }),
      }),
  )
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

function liveRangeBlocks(node: JSONContent): (Paragraph | Table)[] {
  const link = node.attrs?.link as LiveLink | undefined
  const rows = link?.snapshot?.length ? link.snapshot : [['']]
  const colCount = Math.max(1, ...rows.map((r) => r.length))
  const tableRows = rows.map((row, ri) => {
    const isHeader = !!link?.headerRow && ri === 0
    const cells = row.length ? row : ['']
    return new TableRow({
      children: cells.map(
        (cell) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell, bold: isHeader || undefined })] })],
            width: { size: Math.round(100 / colCount), type: WidthType.PERCENTAGE },
            shading: isHeader ? { type: ShadingType.CLEAR, fill: 'F1F2F4' } : undefined,
            borders: CELL_BORDERS,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
          }),
      ),
    })
  })
  const out: (Paragraph | Table)[] = [new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } })]
  if (link) {
    out.push(
      new Paragraph({
        spacing: { before: 60 },
        children: [new TextRun({ text: `${linkLabel(link)} · Updated ${timeAgo(link.refreshedAt)}`, italics: true, color: '6B7280', size: 18 })],
      }),
    )
  }
  return out
}

export function renderBlocks(nodes: JSONContent[], depth: number, opts: DocxOptions): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        out.push(
          new Paragraph({
            alignment: alignmentOf(node.attrs),
            spacing: paragraphSpacing(findLineHeight(node.content ?? [])),
            children: node.content?.length ? runsFromInline(node.content) : [new TextRun({ text: '' })],
          }),
        )
        break
      case 'heading': {
        const level = (node.attrs?.level as number) ?? 1
        out.push(
          new Paragraph({
            heading: HEADING_MAP[level] ?? HeadingLevel.HEADING_1,
            alignment: alignmentOf(node.attrs),
            children: node.content?.length ? runsFromInline(node.content) : [new TextRun({ text: '' })],
          }),
        )
        break
      }
      case 'blockquote':
        out.push(...blockquoteParagraphs(node))
        break
      case 'codeBlock':
        out.push(...codeBlockParagraphs(node))
        break
      case 'horizontalRule':
        out.push(new Paragraph({ thematicBreak: true }))
        break
      case 'pageBreak':
        out.push(new Paragraph({ children: [new PageBreak()] }))
        break
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        out.push(...listBlock(node, depth, opts))
        break
      case 'table':
        out.push(tableBlock(node, opts))
        break
      case 'image':
        out.push(imageParagraph(node, opts))
        break
      case 'liveRange':
        out.push(...liveRangeBlocks(node))
        break
      default:
        if (node.content?.length) out.push(...renderBlocks(node.content, depth, opts))
        break
    }
  }
  return out
}

export async function buildDocxBase64(doc: JSONContent, opts: DocxOptions): Promise<string> {
  const margin = pxToTwip(opts.marginPx)
  const document = new Document({
    sections: [
      {
        properties: { page: { margin: { top: margin, bottom: margin, left: margin, right: margin } } },
        children: renderBlocks(doc.content ?? [], 0, opts),
      },
    ],
  })
  return Packer.toBase64String(document)
}

export async function exportDocx(doc: JSONContent, title: string, marginPx: number): Promise<void> {
  const contentWidthPx = Math.max(200, 816 - marginPx * 2)
  const base64 = await buildDocxBase64(doc, { marginPx, contentWidthPx })
  await platform.saveFile(`${title || 'Untitled'}.docx`, base64, [{ name: 'Word Document', extensions: ['docx'] }], true)
}

// ---------- Markdown ----------

function domTableToMarkdown(tableEl: HTMLTableElement): string {
  const trs = Array.from(tableEl.querySelectorAll('tr'))
  const rows = trs.map((tr) =>
    Array.from(tr.children).map((c) =>
      (c.textContent ?? '')
        .trim()
        .replace(/\|/g, '\\|')
        .replace(/\r?\n+/g, ' '),
    ),
  )
  if (!rows.length) return ''
  const colCount = Math.max(...rows.map((r) => r.length))
  rows.forEach((r) => {
    while (r.length < colCount) r.push('')
  })
  const header = rows[0]
  const body = rows.slice(1)
  let out = '\n\n| ' + header.join(' | ') + ' |\n'
  out += '| ' + header.map(() => '---').join(' | ') + ' |\n'
  body.forEach((r) => {
    out += '| ' + r.join(' | ') + ' |\n'
  })
  return out + '\n'
}

export function htmlToMarkdown(html: string): string {
  const svc = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  svc.addRule('strikethrough', {
    filter: ['s', 'del', 'strike'],
    replacement: (content) => `~~${content}~~`,
  })
  svc.addRule('subscript', { filter: ['sub'], replacement: (c) => `<sub>${c}</sub>` })
  svc.addRule('superscript', { filter: ['sup'], replacement: (c) => `<sup>${c}</sup>` })
  svc.addRule('underline', { filter: ['u'], replacement: (c) => `<u>${c}</u>` })
  svc.addRule('taskListItem', {
    filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
    replacement: (content, node) => {
      const checked = node.getAttribute('data-checked') === 'true'
      return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`
    },
  })
  svc.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => domTableToMarkdown(node as HTMLTableElement),
  })
  svc.addRule('pageBreak', {
    filter: (node) => node.nodeName === 'DIV' && node.getAttribute(PAGE_BREAK_ATTR) !== null,
    replacement: () => '\n\n---\n\n',
  })
  svc.addRule('liveRange', {
    // The nested <table> already went through the 'table' rule above by the
    // time this fires (turndown converts children first), so `content` here
    // is already a pipe table plus the caption line — just give it clean
    // block spacing.
    filter: (node) => node.nodeName === 'DIV' && node.getAttribute('data-type') === 'live-range',
    replacement: (content) => '\n\n' + content.trim() + '\n\n',
  })
  return svc.turndown(html).replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export async function exportMarkdown(html: string, title: string): Promise<void> {
  const md = htmlToMarkdown(html)
  await platform.saveFile(`${title || 'Untitled'}.md`, md, [{ name: 'Markdown', extensions: ['md'] }], false)
}

// ---------- HTML / plain text ----------

/** Swap our in-editor page-break pill (dashed divider + "Page break" label)
 *  for a bare `break-after:page` marker — the shape print/PDF renderers
 *  expect, with none of the editing-only chrome. */
export function replacePageBreaksForExport(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  const parsed = new DOMParser().parseFromString(`<div id="dx-export-root">${html}</div>`, 'text/html')
  const root = parsed.getElementById('dx-export-root')
  if (!root) return html
  root.querySelectorAll(`[${PAGE_BREAK_ATTR}]`).forEach((el) => {
    const marker = parsed.createElement('div')
    marker.setAttribute('style', 'break-after:page')
    el.replaceWith(marker)
  })
  return root.innerHTML
}

/** Print-quality typography shared by the plain HTML/PDF export and the
 *  "living document" export (living.ts) — kept in one place so the two never
 *  drift out of sync. */
export const DOC_TYPOGRAPHY_CSS = `
  .page h1, .page h2, .page h3, .page h4 { font-weight: 700; line-height: 1.25; margin: 1.1em 0 0.45em; }
  .page h1 { font-size: 30px; } .page h2 { font-size: 24px; } .page h3 { font-size: 19px; } .page h4 { font-size: 16px; }
  .page p { margin: 0 0 0.9em; line-height: 1.6; }
  .page a { color: #2563eb; }
  .page blockquote { margin: 0.9em 0; padding: 0.2em 0 0.2em 16px; border-left: 3px solid #d1d5db; color: #4b5160; font-style: italic; }
  .page pre { background: #f1f2f4; padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
  .page code { font-family: Menlo, Consolas, monospace; font-size: 0.9em; }
  .page table { border-collapse: collapse; width: 100%; margin: 0.9em 0; }
  .page td, .page th { border: 1px solid #d7dae1; padding: 6px 10px; text-align: left; }
  .page th { background: #f1f2f4; }
  .page img { max-width: 100%; }
  .page { display: flow-root; }
  .page img[data-wrap='left'] { float: left; margin: 4px 22px 12px 0; }
  .page img[data-wrap='right'] { float: right; margin: 4px 0 12px 22px; }
  .page hr { border: none; border-top: 1px solid #d7dae1; margin: 1.4em 0; }
  .page ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  .page li[data-type="taskItem"] { display: flex; gap: 8px; align-items: flex-start; }
  .page .dx-liverange-caption { font-size: 11.5px; color: #6b7280; font-style: italic; margin: -0.6em 0 0.9em; }
`

export function standaloneHtmlDocument(html: string, title: string, marginPx: number): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title || 'Untitled document')}</title>
<style>
  body { margin: 0; padding: 40px; background: #e8e9ec; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .page { max-width: 816px; margin: 0 auto; background: #ffffff; color: #0a0a0a; padding: ${marginPx}px; border-radius: 4px; box-shadow: 0 4px 16px rgba(15,18,25,0.12); }
${DOC_TYPOGRAPHY_CSS}
</style>
</head>
<body>
<div class="page">
${replacePageBreaksForExport(html)}
</div>
</body>
</html>
`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export async function exportHtml(html: string, title: string, marginPx: number): Promise<void> {
  const doc = standaloneHtmlDocument(html, title, marginPx)
  await platform.saveFile(`${title || 'Untitled'}.html`, doc, [{ name: 'Web Page', extensions: ['html'] }], false)
}

export async function exportPlainText(text: string, title: string): Promise<void> {
  await platform.saveFile(`${title || 'Untitled'}.txt`, text, [{ name: 'Plain Text', extensions: ['txt'] }], false)
}

export async function exportAdoc(saveFn: () => Promise<void>): Promise<void> {
  await saveFn()
}
