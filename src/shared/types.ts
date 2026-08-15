// ---------- Core document model shared by all three apps ----------

export type AppKind = 'docs' | 'sheets' | 'slides' | 'forms'

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

export type ChartType =
  | 'bar'
  | 'column'
  | 'stackedBar'
  | 'stackedColumn'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'combo'

export interface ChartSpec {
  id: string
  type: ChartType
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
  legend?: 'none' | 'right' | 'bottom'
  xTitle?: string
  yTitle?: string
  /** Print each point's value beside it. */
  dataLabels?: boolean
  gridlines?: boolean
  /** combo only: indexes of dataRanges drawn as lines; the rest are columns. */
  lineSeries?: number[]
}

/**
 * A pivot table: group the source range by row and column fields, aggregate
 * the value fields, and write the result into the sheet starting at `anchor`.
 * Recomputed on demand rather than kept live, so the output is ordinary cells
 * a user can format, sort and export like any other.
 */
export interface PivotSpec {
  id: string
  /** e.g. "A1:F200"; the first row is treated as headers. */
  source: string
  /** Column offsets within `source`. */
  rows: number[]
  cols: number[]
  values: { col: number; agg: PivotAgg; label?: string }[]
  /** Top-left cell of the generated block, e.g. "H1". */
  anchor: string
  showTotals?: boolean
}

export type PivotAgg = 'sum' | 'count' | 'average' | 'min' | 'max' | 'countUnique'

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
  pivots?: PivotSpec[]
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

// ---------- Forms (surveys and questionnaires) ----------
//
// Google Forms is a server product: you publish a link, and responses land in
// someone else's database. Anleo has no server, so the round trip works
// differently — a form is exported as one self-contained HTML file, the person
// filling it in gets a response file (or a paste-able code) back, and the
// author imports those. Nobody in the middle ever sees the answers.

export type QuestionKind =
  | 'short'
  | 'paragraph'
  | 'choice'
  | 'checkboxes'
  | 'dropdown'
  | 'scale'
  | 'date'
  | 'time'
  | 'email'
  | 'number'
  /** Not a question — a heading and blurb that breaks the form into parts. */
  | 'section'

export interface FormOption {
  id: string
  label: string
}

export interface FormQuestion {
  id: string
  kind: QuestionKind
  title: string
  /** Smaller explanatory line under the title. */
  help?: string
  required?: boolean
  /** choice | checkboxes | dropdown */
  options?: FormOption[]
  /** Adds a free-text "Other" entry to choice and checkboxes. */
  otherOption?: boolean
  /** scale */
  scaleMin?: number
  scaleMax?: number
  scaleMinLabel?: string
  scaleMaxLabel?: string
  /** number */
  min?: number
  max?: number
  /** short | paragraph | email | number */
  placeholder?: string
  /** paragraph */
  rows?: number

  // ---- quiz mode ----
  /** Marks worth when settings.quizMode is on. */
  points?: number
  /**
   * The accepted answer(s). Option ids for choice/checkboxes/dropdown; literal
   * text (compared case-insensitively, trimmed) for short/number/date/time.
   */
  correct?: string[]
  /** Shown after grading, whether they got it right or wrong. */
  feedback?: string

  // ---- branching ----
  /**
   * Routes the respondent onward based on which option they picked. `goTo` is
   * the id of a 'section' question, or 'end' to finish the form early. Only
   * meaningful on choice and dropdown questions.
   */
  branches?: { optionId: string; goTo: string }[]
}

export interface FormTheme {
  accent: string
  headerFrom: string
  headerTo: string
  headerColor: string
  fontFamily: string
}

/** One person's answers. Checkboxes yield an array; everything else a string. */
export interface FormResponse {
  id: string
  submittedAt: number
  answers: Record<string, string | string[]>
  /** Present only for quiz forms: marks scored and marks available. */
  score?: { earned: number; total: number }
}

export interface FormsContent {
  description: string
  questions: FormQuestion[]
  theme: FormTheme
  /** Responses live in the document, so the form and its data are one file. */
  responses: FormResponse[]
  settings: {
    /** Shown after the respondent submits. */
    confirmation: string
    /** Number the questions in the exported form. */
    showQuestionNumbers?: boolean
    /** Show a progress bar as they fill it in. */
    showProgress?: boolean
    /**
     * Turns the form into a quiz: questions carry marks and an answer key, and
     * the exported page grades itself. Grading happens in the respondent's own
     * browser — the key travels inside the file, so this suits classroom and
     * practice use, not invigilated exams.
     */
    quizMode?: boolean
    /** Show the respondent their score straight after submitting. */
    showScore?: boolean
  }
}

// ---------- Unified ----------

export type AnyContent = DocsContent | SheetsContent | SlidesContent | FormsContent

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
export type FormsTemplate = Template<FormsContent>

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
