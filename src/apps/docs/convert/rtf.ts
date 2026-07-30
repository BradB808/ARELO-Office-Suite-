// Rich Text Format (.rtf) export for Anleo Docs.
//
// Pure data -> string. Mirrors the TipTap JSON traversal patterns used by
// ../export.ts (buildDocxBase64 / renderBlocks) but emits RTF control words
// instead of `docx` API calls, so it can run under plain Node (see the note
// at the top of walk.ts for why this file has zero runtime imports of its
// own sibling files).

import type { JSONContent } from '@tiptap/core'
import type { NormalizedMarks } from './walk'

// ---------- escaping ----------

/** Escape RTF text: `\`, `{`, `}` get backslash-escaped; everything outside
 *  printable ASCII is emitted as `\uN?` (N = signed 16-bit code unit value,
 *  per the RTF spec's \u escape — this also correctly round-trips emoji,
 *  which JS represents as two escaped surrogate code units in a row). */
function escapeRtfText(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c === 0x5c) out += '\\\\'
    else if (c === 0x7b) out += '\\{'
    else if (c === 0x7d) out += '\\}'
    else if (c === 0x0a) out += '\\line '
    else if (c === 0x09) out += '\\tab '
    else if (c === 0x0d) continue
    else if (c < 0x20) continue
    else if (c > 0x7e) {
      const signed = c >= 0x8000 ? c - 0x10000 : c
      out += `\\u${signed}?`
    } else out += input[i]
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  const hexChars = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    out += hexChars[(b >> 4) & 0xf] + hexChars[b & 0xf]
  }
  return out
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

function rtfImageKind(mime: string): 'png' | 'jpeg' | null {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg'
  return null
}

function normalizeHex(input: string): string {
  const s = input.trim()
  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(s)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => parseInt(p.trim(), 10))
    const [r, g, b] = parts
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return [r, g, b]
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    }
  }
  let h = s.replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '000000'
  return h.toUpperCase()
}

/** px -> twips (1in = 96px = 1440 twips) */
function pxToTwip(px: number): number {
  return Math.round(px * 15)
}

/** px font size -> RTF half-points (pt = px * 0.75; half-points = pt * 2) */
function pxToHalfPt(px: number): number {
  return Math.round(px * 0.75 * 2)
}

const HEADING_PX: Record<number, number> = { 1: 30, 2: 24, 3: 19, 4: 16 }

// ---------- font / color resource tables ----------

interface RtfCtx {
  colors: string[] // hex strings; RTF index = array index + 1 (index 0 is the leading "auto" colortbl entry)
  colorMap: Map<string, number>
  fonts: string[]
  fontMap: Map<string, number>
  monoFontIdx: number
  linkColorIdx: number
  quoteColorIdx: number
  codeColorIdx: number
  borderColorIdx: number
  imagePlaceholderColorIdx: number
}

function colorIdx(ctx: RtfCtx, rawColor: string): number {
  const key = normalizeHex(rawColor)
  const existing = ctx.colorMap.get(key)
  if (existing !== undefined) return existing
  ctx.colors.push(key)
  const idx = ctx.colors.length
  ctx.colorMap.set(key, idx)
  return idx
}

function fontIdx(ctx: RtfCtx, rawName: string): number {
  const key = rawName.trim().toLowerCase()
  const existing = ctx.fontMap.get(key)
  if (existing !== undefined) return existing
  const idx = ctx.fonts.length
  ctx.fonts.push(rawName.trim() || 'Helvetica')
  ctx.fontMap.set(key, idx)
  return idx
}

function createRtfCtx(): RtfCtx {
  const ctx: RtfCtx = {
    colors: [],
    colorMap: new Map(),
    fonts: [],
    fontMap: new Map(),
    monoFontIdx: 0,
    linkColorIdx: 0,
    quoteColorIdx: 0,
    codeColorIdx: 0,
    borderColorIdx: 0,
    imagePlaceholderColorIdx: 0,
  }
  fontIdx(ctx, 'Helvetica') // f0 — default body font
  ctx.monoFontIdx = fontIdx(ctx, 'Courier New') // f1 — code / monospace
  ctx.linkColorIdx = colorIdx(ctx, '2563EB')
  ctx.quoteColorIdx = colorIdx(ctx, '4B5160')
  ctx.codeColorIdx = colorIdx(ctx, '374151')
  ctx.borderColorIdx = colorIdx(ctx, 'D7DAE1')
  ctx.imagePlaceholderColorIdx = colorIdx(ctx, '9CA3AF')
  return ctx
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

function alignRtf(attrs?: Record<string, unknown>): string {
  const a = attrs?.textAlign as string | undefined
  if (a === 'center') return '\\qc'
  if (a === 'right') return '\\qr'
  if (a === 'justify') return '\\qj'
  return '\\ql'
}

// ---------- inline runs ----------

function runsRtf(nodes: JSONContent[], ctx: RtfCtx): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out += '\\line '
      continue
    }
    if (node.type !== 'text') continue
    const m = readMarks(node)
    const text = escapeRtfText(node.text ?? '')
    let controls = ''
    if (m.bold) controls += '\\b'
    if (m.italic) controls += '\\i'
    if (m.strike) controls += '\\strike'
    if (m.subscript) controls += '\\sub'
    if (m.superscript) controls += '\\super'
    if (m.underline || m.linkHref) controls += '\\ul'
    if (m.fontFamily) controls += `\\f${fontIdx(ctx, m.fontFamily)}`
    if (m.fontSizePx) controls += `\\fs${pxToHalfPt(m.fontSizePx)}`
    const color = m.color ?? (m.linkHref ? '2563EB' : undefined)
    if (color) controls += `\\cf${colorIdx(ctx, color)}`
    if (m.highlight) controls += `\\highlight${colorIdx(ctx, m.highlight)}`
    const run = `{${controls ? controls + ' ' : ''}${text}}`
    if (m.linkHref) {
      const url = escapeRtfText(m.linkHref)
      out += `{\\field{\\*\\fldinst HYPERLINK "${url}"}{\\fldrslt ${run}}}`
    } else {
      out += run
    }
  }
  return out
}

// ---------- block-level rendering ----------

function blockquoteRtf(node: JSONContent, ctx: RtfCtx): string {
  let out = ''
  for (const child of node.content ?? []) {
    if (child.type !== 'paragraph') continue
    const runs = runsRtf(child.content ?? [], ctx)
    out += `\\pard\\li720\\i\\cf${ctx.quoteColorIdx} ${runs}\\cf0\\i0\\par\n`
  }
  return out || '\\pard\\par\n'
}

function codeBlockRtf(node: JSONContent, ctx: RtfCtx): string {
  const text = (node.content ?? []).map((n) => n.text ?? '').join('')
  const lines = text.length ? text.split('\n') : ['']
  const body = lines.map((l) => escapeRtfText(l) || ' ').join('\\line ')
  return `\\pard\\li240\\ri240\\f${ctx.monoFontIdx}\\fs20\\cf${ctx.codeColorIdx} ${body}\\cf0\\f0\\fs22\\par\n`
}

function imageRtf(node: JSONContent, ctx: RtfCtx): string {
  const src = (node.attrs?.src as string) ?? ''
  const decoded = dataUrlToBytes(src)
  const kind = decoded ? rtfImageKind(decoded.mime) : null
  if (!decoded || !kind) {
    return `\\pard\\qc {\\i\\cf${ctx.imagePlaceholderColorIdx} [image]}\\cf0\\i0\\par\n`
  }
  const w = Math.max(1, Math.round((node.attrs?.width as number) || 480))
  const h = Math.max(1, Math.round((node.attrs?.height as number) || 320))
  const hex = bytesToHex(decoded.bytes)
  return `\\pard\\qc {\\pict\\${kind}blip\\picw${w}\\pich${h}\\picwgoal${pxToTwip(w)}\\pichgoal${pxToTwip(h)} ${hex}}\\par\n`
}

function listBlockRtf(node: JSONContent, depth: number, ctx: RtfCtx): string {
  const items = node.content ?? []
  if (node.type === 'taskList') {
    return items.map((item) => taskItemRtf(item, depth, ctx)).join('')
  }
  if (node.type === 'orderedList') {
    let n = (node.attrs?.start as number) || 1
    let out = ''
    for (const item of items) {
      out += listItemRtf(item, depth, 'ordered', ctx, n)
      n++
    }
    return out
  }
  return items.map((item) => listItemRtf(item, depth, 'bullet', ctx)).join('')
}

function listItemRtf(item: JSONContent, depth: number, kind: 'bullet' | 'ordered', ctx: RtfCtx, ordinal?: number): string {
  const indent = 360 + depth * 360
  let out = ''
  let first = true
  for (const child of item.content ?? []) {
    if (child.type === 'paragraph') {
      const runs = runsRtf(child.content ?? [], ctx)
      const prefix = first ? (kind === 'ordered' ? `${ordinal ?? 1}.\\tab ` : '\\bullet\\tab ') : ''
      out += `\\pard${alignRtf(child.attrs)}\\li${indent}\\fi-360 ${prefix}${runs}\\par\n`
      first = false
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      out += listBlockRtf(child, depth + 1, ctx)
    } else {
      out += renderBlocksRtf([child], depth, ctx)
    }
  }
  return out
}

function taskItemRtf(item: JSONContent, depth: number, ctx: RtfCtx): string {
  const indent = 360 + depth * 360
  const checked = !!item.attrs?.checked
  const glyph = checked ? '\\u9745?' : '\\u9744?'
  let out = ''
  let first = true
  for (const child of item.content ?? []) {
    if (child.type === 'paragraph') {
      const runs = runsRtf(child.content ?? [], ctx)
      const prefix = first ? `${glyph}\\tab ` : ''
      out += `\\pard\\li${indent}\\fi-360 ${prefix}${runs}\\par\n`
      first = false
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      out += listBlockRtf(child, depth + 1, ctx)
    } else {
      out += renderBlocksRtf([child], depth, ctx)
    }
  }
  return out
}

function cellContentRtf(cell: JSONContent, isHeader: boolean, ctx: RtfCtx): string {
  const blocks = cell.content?.length ? cell.content : [{ type: 'paragraph', content: [] }]
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      parts.push(runsRtf(block.content ?? [], ctx))
    } else {
      parts.push(runsRtf(block.content ?? [], ctx))
    }
  }
  const joined = parts.join('\\par ') || ' '
  return isHeader ? `\\b ${joined}\\b0` : joined
}

function tableRtf(node: JSONContent, ctx: RtfCtx): string {
  const CONTENT_WIDTH_TWIPS = 9360
  const rows = node.content ?? []
  const colCount = Math.max(1, ...rows.map((r) => (r.content ?? []).length))
  const colWidth = Math.floor(CONTENT_WIDTH_TWIPS / colCount)
  let out = ''
  for (const row of rows) {
    const cells = row.content ?? []
    let rowdef = '\\trowd\\trgaph108\\trleft0'
    let acc = 0
    for (let i = 0; i < cells.length; i++) {
      acc += colWidth
      const right = i === cells.length - 1 ? CONTENT_WIDTH_TWIPS : acc
      rowdef +=
        `\\clbrdrt\\brdrs\\brdrw10\\brdrcf${ctx.borderColorIdx}` +
        `\\clbrdrl\\brdrs\\brdrw10\\brdrcf${ctx.borderColorIdx}` +
        `\\clbrdrb\\brdrs\\brdrw10\\brdrcf${ctx.borderColorIdx}` +
        `\\clbrdrr\\brdrs\\brdrw10\\brdrcf${ctx.borderColorIdx}` +
        `\\cellx${right}`
    }
    out += rowdef + '\n'
    for (const cell of cells) {
      const isHeader = cell.type === 'tableHeader'
      out += `\\pard\\intbl ${cellContentRtf(cell, isHeader, ctx)}\\cell\n`
    }
    out += '\\row\n'
  }
  return out
}

export function renderBlocksRtf(nodes: JSONContent[], depth: number, ctx: RtfCtx): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph': {
        const runs = node.content?.length ? runsRtf(node.content, ctx) : ''
        out += `\\pard${alignRtf(node.attrs)} ${runs}\\par\n`
        break
      }
      case 'heading': {
        const level = (node.attrs?.level as number) ?? 1
        const px = HEADING_PX[level] ?? HEADING_PX[1]
        const runs = node.content?.length ? runsRtf(node.content, ctx) : ''
        out += `\\pard${alignRtf(node.attrs)}\\sb240\\sa120\\b\\fs${pxToHalfPt(px)} ${runs}\\b0\\fs22\\par\n`
        break
      }
      case 'blockquote':
        out += blockquoteRtf(node, ctx)
        break
      case 'codeBlock':
        out += codeBlockRtf(node, ctx)
        break
      case 'horizontalRule':
        out += `\\pard\\brdrb\\brdrs\\brdrw20\\brdrcf${ctx.borderColorIdx}\\brsp20 \\par\n`
        break
      case 'pageBreak':
        out += '\\pard\\page\\par\n'
        break
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        out += listBlockRtf(node, depth, ctx)
        break
      case 'table':
        out += tableRtf(node, ctx)
        break
      case 'image':
        out += imageRtf(node, ctx)
        break
      default:
        if (node.content?.length) out += renderBlocksRtf(node.content, depth, ctx)
        break
    }
  }
  return out
}

export function buildRtf(doc: JSONContent, opts: { title: string }): string {
  const ctx = createRtfCtx()
  const body = renderBlocksRtf(doc.content ?? [], 0, ctx)

  const fontTable = ctx.fonts.map((name, i) => `{\\f${i}\\fnil\\fcharset0 ${escapeRtfText(name)};}`).join('')
  const colorTable =
    ';' +
    ctx.colors
      .map((hexColor) => {
        const r = parseInt(hexColor.slice(0, 2), 16)
        const g = parseInt(hexColor.slice(2, 4), 16)
        const b = parseInt(hexColor.slice(4, 6), 16)
        return `\\red${r}\\green${g}\\blue${b};`
      })
      .join('')
  const title = escapeRtfText(opts.title || 'Untitled')

  return (
    '{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\n' +
    `{\\fonttbl${fontTable}}\n` +
    `{\\colortbl${colorTable}}\n` +
    `{\\info{\\title ${title}}}\n` +
    '\\viewkind4\\uc1\\pard\\widowctrl\\f0\\fs22\n' +
    body +
    '}'
  )
}
