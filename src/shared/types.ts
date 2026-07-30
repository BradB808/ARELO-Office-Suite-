// ---------- Core document model shared by all three apps ----------

export type AppKind = 'docs' | 'sheets' | 'slides'

export interface DocMeta {
  id: string
  kind: AppKind
  title: string
  createdAt: number
  updatedAt: number
  /** Absolute path when saved as a real file via Electron. */
  filePath?: string
}

// ---------- Docs (word processor) ----------

export interface DocsContent {
  /** TipTap-compatible HTML. */
  html: string
  /** Page setup */
  pageWidth?: number // px at 100% zoom, default 816 (8.5in @96dpi)
  margin?: number // px, default 72
  /** Add "Title — page N of M" footer to PDF/print output. */
  pageNumbers?: boolean
}

// ---------- Sheets (spreadsheet) ----------

export interface CellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  fill?: string
  fontSize?: number
  /** Display name from SYSTEM_FONTS or an installed custom font. */
  fontFamily?: string
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  borders?: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean }
  format?: 'auto' | 'number' | 'percent' | 'currency' | 'date' | 'text'
  decimals?: number
  wrap?: boolean
}

export interface Cell {
  /** Raw user input. Formulas start with '='. */
  v?: string
  style?: CellStyle
}

export interface ChartSpec {
  id: string
  type: 'bar' | 'line' | 'pie' | 'area'
  title: string
  /** e.g. "A2:A10" — category labels */
  labelRange?: string
  /** e.g. ["B2:B10", "C2:C10"] — one entry per series */
  dataRanges: string[]
  seriesNames?: string[]
  x: number
  y: number
  w: number
  h: number
}

/** Conditional formatting rule applied to a range. */
export interface CondRule {
  id: string
  /** e.g. "B2:B30" */
  range: string
  type: 'gt' | 'lt' | 'between' | 'eq' | 'contains' | 'duplicate' | 'colorScale'
  v1?: number | string
  v2?: number
  /** Applied to matching cells (non-colorScale rules). */
  fill?: string
  color?: string
  /** colorScale endpoints (low → high). */
  scaleFrom?: string
  scaleTo?: string
}

/** Dropdown-list data validation over a range. */
export interface Validation {
  id: string
  range: string
  options: string[]
}

/** Column value filter: rows inside range whose cell value is excluded get hidden. */
export interface SheetFilter {
  /** e.g. "A1:E40" — first row treated as headers. */
  range: string
  /** Keyed by column offset within the range; values EXCLUDED from display. */
  excluded: Record<number, string[]>
}

export interface Sheet {
  name: string
  /** Sparse map keyed by A1-style refs. */
  cells: Record<string, Cell>
  colWidths: Record<number, number>
  rowHeights: Record<number, number>
  charts?: ChartSpec[]
  /** Merged ranges like "A1:C1". Value/style come from the top-left cell. */
  merges?: string[]
  /** Frozen leading rows/cols (stick while scrolling). */
  freeze?: { rows: number; cols: number }
  hiddenRows?: number[]
  hiddenCols?: number[]
  condFormats?: CondRule[]
  validations?: Validation[]
  filter?: SheetFilter
}

export interface SheetsContent {
  sheets: Sheet[]
  active: number
}

// ---------- Slides (presentations) ----------
// Canvas is always 1280 x 720.

export const SLIDE_W = 1280
export const SLIDE_H = 720

export interface SlideElementBase {
  id: string
  x: number
  y: number
  w: number
  h: number
  rotation?: number // degrees
  opacity?: number // 0..1
}

export interface TextElement extends SlideElementBase {
  kind: 'text'
  /** Plain text; newlines allowed. */
  text: string
  fontFamily?: string
  fontSize?: number // px on the 1280x720 canvas
  color?: string
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  bold?: boolean
  italic?: boolean
  underline?: boolean
  lineHeight?: number
  /** Optional bullet list rendering: each newline becomes a bullet. */
  bullets?: boolean
  /** Numbered list rendering (wins over bullets when both set). */
  numbered?: boolean
}

export type ShapeKind =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'star'
  | 'chevron'
  | 'plus'
  | 'cross'
  | 'pentagon'
  | 'hexagon'
  | 'speech'
  | 'cloud'

export interface ShapeElement extends SlideElementBase {
  kind: 'shape'
  shape: ShapeKind
  fill: string
  /** When set, overrides fill with a linear gradient. */
  gradient?: { from: string; to: string; angle: number }
  stroke?: string
  strokeWidth?: number
  /** Arrowheads for the 'line' shape. */
  arrowStart?: boolean
  arrowEnd?: boolean
  /** Optional centered label. */
  text?: string
  color?: string
  fontSize?: number
  bold?: boolean
  fontFamily?: string
}

export interface ImageElement extends SlideElementBase {
  kind: 'image'
  /** data: URL */
  src: string
  borderRadius?: number
}

/** A live range from an Anleo Sheets document, rendered as a table. */
export interface LinkedTableElement extends SlideElementBase {
  kind: 'linked'
  /** LiveLink payload (see shared/livelink.ts). */
  link: {
    sourceId: string
    sourceTitle: string
    sheetName: string
    range: string
    headerRow?: boolean
    snapshot: string[][]
    refreshedAt: number
  }
  fontSize?: number
  color?: string
  headerFill?: string
  headerColor?: string
  fontFamily?: string
}

export type SlideElement = TextElement | ShapeElement | ImageElement | LinkedTableElement

export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image'
  color?: string
  from?: string
  to?: string
  angle?: number // gradient angle degrees
  src?: string // data: URL for image backgrounds
}

export interface Slide {
  id: string
  background?: SlideBackground // falls back to theme bg
  elements: SlideElement[]
  notes?: string
  transition?: 'none' | 'fade' | 'slide'
}

export interface SlidesTheme {
  id: string
  name: string
  bg: SlideBackground
  titleColor: string
  bodyColor: string
  accent: string
  titleFont: string
  bodyFont: string
}

export interface SlidesContent {
  slides: Slide[]
  themeId: string
  /** Show "N" in the bottom-right corner of every slide (except the first). */
  showSlideNumbers?: boolean
}

// ---------- Unified ----------

export type AnyContent = DocsContent | SheetsContent | SlidesContent

export interface AnleoDocument {
  meta: DocMeta
  content: AnyContent
}

export interface RecentEntry {
  id: string
  kind: AppKind
  title: string
  filePath?: string
  updatedAt: number
}

// ---------- Templates ----------

export interface Template<T extends AnyContent = AnyContent> {
  id: string
  name: string
  description: string
  category: string
  /** Hex accent used for the gallery card art. */
  accent: string
  /** Emoji or short glyph shown on the gallery card. */
  glyph: string
  make: () => T
}

export type DocsTemplate = Template<DocsContent>
export type SheetsTemplate = Template<SheetsContent>
export type SlidesTemplate = Template<SlidesContent>

// ---------- Editor app component contract ----------

export interface EditorAppProps<T extends AnyContent = AnyContent> {
  doc: AnleoDocument
  /** Push updated content into the shell (autosaved + persisted by the shell, debounced). */
  onDocChange: (content: T) => void
  onTitleChange: (title: string) => void
  requestSave: (saveAs?: boolean) => Promise<void>
  requestOpen: () => Promise<void>
  requestNew: () => void
  goHome: () => void
  isDark: boolean
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
