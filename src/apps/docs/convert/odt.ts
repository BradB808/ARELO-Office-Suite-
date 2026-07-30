// OpenDocument Text (.odt) export for Anleo Docs.
//
// Pure data -> base64 zip. Mirrors the TipTap JSON traversal patterns used by
// ../export.ts (buildDocxBase64 / renderBlocks), emitting ODF XML instead of
// `docx` API calls. See the note at the top of walk.ts for why this file has
// zero runtime imports of its own sibling files (only a type-only import,
// which erases under Node and never needs runtime module resolution).

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

function odtImageExt(mime: string): 'png' | 'jpg' | null {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  return null
}

function normalizeHexOdt(input: string): string {
  const s = input.trim()
  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(s)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => parseInt(p.trim(), 10))
    const [r, g, b] = parts
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return (
        '#' +
        [r, g, b]
          .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
          .join('')
      )
    }
  }
  let h = s.replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#000000'
  return '#' + h.toLowerCase()
}

function fontSizePt(px: number): number {
  return Math.round(px * 0.75 * 100) / 100
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
      if (mark.attrs?.lineHeight) {
        const v = parseFloat(String(mark.attrs.lineHeight))
        if (!Number.isNaN(v)) out.lineHeight = v
      }
    }
  }
  return out
}

function findLineHeightPct(nodes: JSONContent[]): number | undefined {
  for (const n of nodes) {
    for (const mark of n.marks ?? []) {
      if (mark.type === 'textStyle' && mark.attrs?.lineHeight) {
        const v = parseFloat(String(mark.attrs.lineHeight))
        if (!Number.isNaN(v)) return Math.round(v * 100)
      }
    }
  }
  return undefined
}

function alignOdt(attrs?: Record<string, unknown>): 'start' | 'center' | 'end' | 'justify' | undefined {
  const a = attrs?.textAlign as string | undefined
  if (a === 'center') return 'center'
  if (a === 'right') return 'end'
  if (a === 'justify') return 'justify'
  if (a === 'left') return 'start'
  return undefined
}

// ---------- style registry: one automatic style per unique formatting combo ----------

interface TextProps {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  sub?: boolean
  sup?: boolean
  color?: string
  bg?: string
  fontName?: string
  fontSizePt?: number
}

interface ParaProps {
  parent: string
  align?: 'start' | 'center' | 'end' | 'justify'
  lineHeightPct?: number
  marginLeftCm?: number
  italic?: boolean
  color?: string
  fontName?: string
  fontSizePt?: number
  borderBottom?: boolean
  breakBefore?: boolean
}

class StyleRegistry {
  private textMap = new Map<string, string>()
  private textEntries: { name: string; props: TextProps }[] = []
  private paraMap = new Map<string, string>()
  private paraEntries: { name: string; props: ParaProps }[] = []

  text(props: TextProps): string {
    const cleaned = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== false))
    const key = JSON.stringify(cleaned)
    const existing = this.textMap.get(key)
    if (existing) return existing
    const name = `T${this.textEntries.length}`
    this.textMap.set(key, name)
    this.textEntries.push({ name, props: cleaned as TextProps })
    return name
  }

  para(props: ParaProps): string {
    const cleaned = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== false))
    const key = JSON.stringify(cleaned)
    const existing = this.paraMap.get(key)
    if (existing) return existing
    const name = `P${this.paraEntries.length}`
    this.paraMap.set(key, name)
    this.paraEntries.push({ name, props: cleaned as ParaProps })
    return name
  }

  serialize(): string {
    let out = ''
    for (const e of this.textEntries) out += textStyleXml(e.name, e.props)
    for (const e of this.paraEntries) out += paraStyleXml(e.name, e.props)
    return out
  }

  hasTextProps(props: TextProps): boolean {
    return Object.values(props).some((v) => v !== undefined && v !== false)
  }
}

function textStyleXml(name: string, p: TextProps): string {
  const attrs: string[] = []
  if (p.bold) attrs.push('fo:font-weight="bold"')
  if (p.italic) attrs.push('fo:font-style="italic"')
  if (p.underline) attrs.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"')
  if (p.strike) attrs.push('style:text-line-through-style="solid"')
  if (p.sub) attrs.push('style:text-position="sub 58%"')
  if (p.sup) attrs.push('style:text-position="super 58%"')
  if (p.color) attrs.push(`fo:color="${p.color}"`)
  if (p.bg) attrs.push(`fo:background-color="${p.bg}"`)
  if (p.fontName) attrs.push(`style:font-name="${escapeXmlAttr(p.fontName)}"`)
  if (p.fontSizePt) attrs.push(`fo:font-size="${p.fontSizePt}pt"`)
  return `<style:style style:name="${name}" style:family="text"><style:text-properties ${attrs.join(' ')}/></style:style>`
}

function paraStyleXml(name: string, p: ParaProps): string {
  const pp: string[] = []
  if (p.align) pp.push(`fo:text-align="${p.align}"`)
  if (p.lineHeightPct) pp.push(`fo:line-height="${p.lineHeightPct}%"`)
  if (p.marginLeftCm) pp.push(`fo:margin-left="${p.marginLeftCm}cm"`)
  if (p.borderBottom) pp.push('fo:border-bottom="0.5pt solid #D7DAE1" fo:padding-bottom="0.1cm"')
  if (p.breakBefore) pp.push('fo:break-before="page"')
  const tp: string[] = []
  if (p.italic) tp.push('fo:font-style="italic"')
  if (p.color) tp.push(`fo:color="${p.color}"`)
  if (p.fontName) tp.push(`style:font-name="${escapeXmlAttr(p.fontName)}"`)
  if (p.fontSizePt) tp.push(`fo:font-size="${p.fontSizePt}pt"`)
  const ppXml = pp.length ? `<style:paragraph-properties ${pp.join(' ')}/>` : ''
  const tpXml = tp.length ? `<style:text-properties ${tp.join(' ')}/>` : ''
  return `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${p.parent}">${ppXml}${tpXml}</style:style>`
}

// ---------- list styles (fixed; bullet / number / task) ----------

function buildBulletListStyleXml(name: string, glyph: string): string {
  let levels = ''
  for (let lvl = 1; lvl <= 10; lvl++) {
    const indent = (lvl * 0.5).toFixed(2)
    levels += `<text:list-level-style-bullet text:level="${lvl}" text:bullet-char="${glyph}"><style:list-level-properties text:space-before="${indent}cm" text:min-label-width="0.5cm"/></text:list-level-style-bullet>`
  }
  return `<text:list-style style:name="${name}">${levels}</text:list-style>`
}

function buildNumberListStyleXml(name: string): string {
  let levels = ''
  for (let lvl = 1; lvl <= 10; lvl++) {
    const indent = (lvl * 0.5).toFixed(2)
    levels += `<text:list-level-style-number text:level="${lvl}" style:num-format="1" style:num-suffix="."><style:list-level-properties text:space-before="${indent}cm" text:min-label-width="0.5cm"/></text:list-level-style-number>`
  }
  return `<text:list-style style:name="${name}">${levels}</text:list-style>`
}

const LIST_STYLES_XML = buildBulletListStyleXml('LB', '•') + buildNumberListStyleXml('LN') + buildBulletListStyleXml('LK', ' ')

// ---------- image / table bookkeeping shared across the whole walk ----------

interface OdtCtx {
  zip: JSZip
  manifest: string[]
  imgCount: number
  tableCount: number
}

function imageOdt(node: JSONContent, ctx: OdtCtx, reg: StyleRegistry): string {
  const src = (node.attrs?.src as string) ?? ''
  const decoded = dataUrlToBytes(src)
  const ext = decoded ? odtImageExt(decoded.mime) : null
  if (!decoded || !ext) {
    const styleName = reg.text({ italic: true, color: '#9CA3AF' })
    return `<text:p><text:span text:style-name="${styleName}">[image]</text:span></text:p>\n`
  }
  const name = `img${ctx.imgCount++}`
  const path = `Pictures/${name}.${ext}`
  ctx.zip.file(path, decoded.bytes)
  const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg'
  ctx.manifest.push(`<manifest:file-entry manifest:full-path="${path}" manifest:media-type="${mediaType}"/>`)

  const wPx = (node.attrs?.width as number) || 480
  const hPx = (node.attrs?.height as number) || 320
  let wCm = (wPx / 96) * 2.54
  let hCm = (hPx / 96) * 2.54
  if (wCm > 17) {
    hCm = hCm * (17 / wCm)
    wCm = 17
  }
  return (
    `<text:p><draw:frame draw:name="${name}" text:anchor-type="as-char" svg:width="${wCm.toFixed(2)}cm" svg:height="${hCm.toFixed(2)}cm">` +
    `<draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
    '</draw:frame></text:p>\n'
  )
}

// ---------- inline runs ----------

function textPropsFromMarks(m: NormalizedMarks): TextProps {
  const p: TextProps = {}
  if (m.bold) p.bold = true
  if (m.italic) p.italic = true
  if (m.underline) p.underline = true
  if (m.strike) p.strike = true
  if (m.subscript) p.sub = true
  if (m.superscript) p.sup = true
  if (m.color) p.color = normalizeHexOdt(m.color)
  if (m.highlight) p.bg = normalizeHexOdt(m.highlight)
  if (m.fontFamily) p.fontName = m.fontFamily
  if (m.fontSizePx) p.fontSizePt = fontSizePt(m.fontSizePx)
  return p
}

function textRunsToOdt(nodes: JSONContent[], reg: StyleRegistry): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out += '<text:line-break/>'
      continue
    }
    if (node.type !== 'text') continue
    const m = readMarks(node)
    const props = textPropsFromMarks(m)
    const isLink = !!m.linkHref
    if (isLink) {
      if (!props.color) props.color = '#2563EB'
      props.underline = true
    }
    const escaped = escapeXmlText(node.text ?? '')
    const span = reg.hasTextProps(props) ? `<text:span text:style-name="${reg.text(props)}">${escaped}</text:span>` : escaped
    out += isLink ? `<text:a xlink:href="${escapeXmlAttr(m.linkHref!)}" xlink:type="simple">${span}</text:a>` : span
  }
  return out
}

// ---------- block-level rendering ----------

function paragraphOdt(node: JSONContent, reg: StyleRegistry, parent: string): string {
  const align = alignOdt(node.attrs)
  const lineHeightPct = findLineHeightPct(node.content ?? [])
  const styleName = reg.para({ parent, align, lineHeightPct })
  const inner = node.content?.length ? textRunsToOdt(node.content, reg) : ''
  return `<text:p text:style-name="${styleName}">${inner}</text:p>\n`
}

function headingOdt(node: JSONContent, reg: StyleRegistry): string {
  const level = Math.min(4, Math.max(1, (node.attrs?.level as number) ?? 1))
  const parent = `Heading_20_${level}`
  const align = alignOdt(node.attrs)
  const lineHeightPct = findLineHeightPct(node.content ?? [])
  const styleName = reg.para({ parent, align, lineHeightPct })
  const inner = node.content?.length ? textRunsToOdt(node.content, reg) : ''
  return `<text:h text:style-name="${styleName}" text:outline-level="${level}">${inner}</text:h>\n`
}

function blockquoteOdt(node: JSONContent, reg: StyleRegistry): string {
  let out = ''
  for (const child of node.content ?? []) {
    if (child.type !== 'paragraph') continue
    const align = alignOdt(child.attrs)
    const styleName = reg.para({ parent: 'Standard', align, marginLeftCm: 1, italic: true, color: '#4B5160' })
    const inner = child.content?.length ? textRunsToOdt(child.content, reg) : ''
    out += `<text:p text:style-name="${styleName}">${inner}</text:p>\n`
  }
  return out || '<text:p/>\n'
}

function codeBlockOdt(node: JSONContent, reg: StyleRegistry): string {
  const text = (node.content ?? []).map((n) => n.text ?? '').join('')
  const lines = text.length ? text.split('\n') : ['']
  const inner = lines.map((l) => escapeXmlText(l)).join('<text:line-break/>')
  const styleName = reg.para({ parent: 'Standard', fontName: 'Courier New', fontSizePt: 10, color: '#374151' })
  return `<text:p text:style-name="${styleName}">${inner}</text:p>\n`
}

function hrOdt(reg: StyleRegistry): string {
  const styleName = reg.para({ parent: 'Standard', borderBottom: true })
  return `<text:p text:style-name="${styleName}"/>\n`
}

function pageBreakOdt(reg: StyleRegistry): string {
  const styleName = reg.para({ parent: 'Standard', breakBefore: true })
  return `<text:p text:style-name="${styleName}"/>\n`
}

function listBlockOdt(node: JSONContent, depth: number, reg: StyleRegistry, ctx: OdtCtx): string {
  if (node.type === 'taskList') {
    const items = (node.content ?? []).map((item) => taskItemOdt(item, depth, reg, ctx)).join('')
    return `<text:list text:style-name="LK">${items}</text:list>\n`
  }
  const isOrdered = node.type === 'orderedList'
  const styleName = isOrdered ? 'LN' : 'LB'
  const items = (node.content ?? []).map((item) => listItemOdt(item, depth, reg, ctx)).join('')
  return `<text:list text:style-name="${styleName}">${items}</text:list>\n`
}

function listItemOdt(item: JSONContent, depth: number, reg: StyleRegistry, ctx: OdtCtx): string {
  let out = '<text:list-item>'
  for (const child of item.content ?? []) {
    if (child.type === 'paragraph') {
      out += paragraphOdt(child, reg, 'Standard')
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      out += listBlockOdt(child, depth + 1, reg, ctx)
    } else {
      out += renderBlocksOdt([child], depth, reg, ctx)
    }
  }
  out += '</text:list-item>\n'
  return out
}

function taskItemOdt(item: JSONContent, depth: number, reg: StyleRegistry, ctx: OdtCtx): string {
  const checked = !!item.attrs?.checked
  const glyph = checked ? '☑' : '☐'
  let out = '<text:list-item>'
  let first = true
  for (const child of item.content ?? []) {
    if (child.type === 'paragraph') {
      const align = alignOdt(child.attrs)
      const lineHeightPct = findLineHeightPct(child.content ?? [])
      const styleName = reg.para({ parent: 'Standard', align, lineHeightPct })
      const inner = child.content?.length ? textRunsToOdt(child.content, reg) : ''
      const prefix = first ? `${escapeXmlText(glyph)} ` : ''
      out += `<text:p text:style-name="${styleName}">${prefix}${inner}</text:p>\n`
      first = false
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      out += listBlockOdt(child, depth + 1, reg, ctx)
    } else {
      out += renderBlocksOdt([child], depth, reg, ctx)
    }
  }
  out += '</text:list-item>\n'
  return out
}

function tableCellOdt(cell: JSONContent, isHeader: boolean, reg: StyleRegistry, ctx: OdtCtx): string {
  const blocks = cell.content?.length ? cell.content : [{ type: 'paragraph', content: [] }]
  let out = ''
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      const align = alignOdt(block.attrs)
      const lineHeightPct = findLineHeightPct(block.content ?? [])
      const styleName = reg.para({ parent: 'Standard', align, lineHeightPct })
      let inner = block.content?.length ? textRunsToOdt(block.content, reg) : ''
      if (isHeader) {
        const boldStyle = reg.text({ bold: true })
        inner = `<text:span text:style-name="${boldStyle}">${inner}</text:span>`
      }
      out += `<text:p text:style-name="${styleName}">${inner}</text:p>\n`
    } else {
      out += renderBlocksOdt([block], 0, reg, ctx)
    }
  }
  return out || '<text:p/>\n'
}

function tableOdt(node: JSONContent, reg: StyleRegistry, ctx: OdtCtx): string {
  const rows = node.content ?? []
  const colCount = Math.max(1, ...rows.map((r) => (r.content ?? []).length))
  const name = `Table${ctx.tableCount++}`
  let out = `<table:table table:name="${name}"><table:table-column table:number-columns-repeated="${colCount}"/>\n`
  for (const row of rows) {
    out += '<table:table-row>'
    for (const cell of row.content ?? []) {
      const isHeader = cell.type === 'tableHeader'
      out += `<table:table-cell office:value-type="string">${tableCellOdt(cell, isHeader, reg, ctx)}</table:table-cell>`
    }
    out += '</table:table-row>\n'
  }
  out += '</table:table>\n'
  return out
}

export function renderBlocksOdt(nodes: JSONContent[], depth: number, reg: StyleRegistry, ctx: OdtCtx): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        out += paragraphOdt(node, reg, 'Standard')
        break
      case 'heading':
        out += headingOdt(node, reg)
        break
      case 'blockquote':
        out += blockquoteOdt(node, reg)
        break
      case 'codeBlock':
        out += codeBlockOdt(node, reg)
        break
      case 'horizontalRule':
        out += hrOdt(reg)
        break
      case 'pageBreak':
        out += pageBreakOdt(reg)
        break
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        out += listBlockOdt(node, depth, reg, ctx)
        break
      case 'table':
        out += tableOdt(node, reg, ctx)
        break
      case 'image':
        out += imageOdt(node, ctx, reg)
        break
      default:
        if (node.content?.length) out += renderBlocksOdt(node.content, depth, reg, ctx)
        break
    }
  }
  return out
}

// ---------- fixed package parts ----------

const CONTENT_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3">
<office:automatic-styles>`

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3">
<office:font-face-decls>
<style:font-face style:name="Helvetica" svg:font-family="Helvetica"/>
<style:font-face style:name="Courier New" svg:font-family="'Courier New'" style:font-pitch="fixed"/>
</office:font-face-decls>
<office:styles>
<style:default-style style:family="paragraph"><style:text-properties style:font-name="Helvetica" fo:font-size="11pt"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>
<style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard"><style:text-properties fo:font-size="24pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard"><style:text-properties fo:font-size="19.5pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard"><style:text-properties fo:font-size="15.5pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Heading_20_4" style:display-name="Heading 4" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard"><style:text-properties fo:font-size="13pt" fo:font-weight="bold"/></style:style>
</office:styles>
<office:automatic-styles>
<style:page-layout style:name="PL1"><style:page-layout-properties fo:margin="2cm" fo:page-width="21.59cm" fo:page-height="27.94cm"/></style:page-layout>
</office:automatic-styles>
<office:master-styles>
<style:master-page style:name="Standard" style:page-layout-name="PL1"/>
</office:master-styles>
</office:document-styles>`
}

function metaXml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3">
<office:meta>
<dc:title>${escapeXmlText(title || 'Untitled')}</dc:title>
<meta:generator>Anleo Office</meta:generator>
</office:meta>
</office:document-meta>`
}

function manifestXml(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
${entries.join('\n')}
</manifest:manifest>`
}

export async function buildOdtBase64(doc: JSONContent, opts: { title: string }): Promise<string> {
  const zip = new JSZip()
  // mimetype MUST be the first entry in the zip and MUST be stored uncompressed.
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' })

  const reg = new StyleRegistry()
  const ctx: OdtCtx = { zip, manifest: [], imgCount: 0, tableCount: 0 }
  const bodyXml = renderBlocksOdt(doc.content ?? [], 0, reg, ctx)

  const contentXml =
    CONTENT_HEADER +
    reg.serialize() +
    LIST_STYLES_XML +
    '</office:automatic-styles><office:body><office:text>' +
    (bodyXml || '<text:p/>\n') +
    '</office:text></office:body></office:document-content>'

  zip.file('content.xml', contentXml)
  zip.file('styles.xml', stylesXml())
  zip.file('meta.xml', metaXml(opts.title))
  zip.file('META-INF/manifest.xml', manifestXml(ctx.manifest))

  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' })
}
