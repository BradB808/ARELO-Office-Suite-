// Every number either chart renderer draws is computed here.
//
// ChartRender.tsx (live, React SVG) and chartSvg.ts (export, SVG string) used to
// carry two hand-kept copies of the same layout maths, which is a standing
// invitation to drift — a chart could look one way on screen and another in an
// exported page. They now both call buildChartScene() and do nothing but
// serialise the primitives it returns, so the two paths cannot disagree.
//
// Colours are the one thing this module cannot decide: the app draws against
// --text/--border/--surface and the exported page against --ink/--muted/--line.
// So a node's fill is either a literal hex (series colours, shared) or one of
// the Role names below, which each renderer resolves through its own palette.

import type { ChartSpec, ChartType } from '../../shared/types'
import type { ChartData, ChartSeries } from './chartData'

export const CHART_COLORS = [
  '#2563eb',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#7c3aed',
  '#0ea5e9',
  '#eab308',
  '#db2777',
  '#14b8a6',
  '#4f46e5',
]

export function seriesColor(i: number): string {
  const k = ((i % CHART_COLORS.length) + CHART_COLORS.length) % CHART_COLORS.length
  return CHART_COLORS[k]
}

export type Role = 'text' | 'text2' | 'text3' | 'line' | 'surface'
export type Palette = Record<Role, string>

/** Resolve a node's paint: a literal hex passes through, anything else is a Role. */
export function paint(p: string, palette: Palette): string {
  return p.charCodeAt(0) === 35 ? p : palette[p as Role]
}

// ---------- scene primitives ----------

export interface RectNode {
  t: 'rect'
  x: number
  y: number
  w: number
  h: number
  rx?: number
  fill: string
  opacity?: number
}
export interface PathNode {
  t: 'path'
  d: string
  fill?: string
  stroke?: string
  sw?: number
  opacity?: number
  evenodd?: boolean
}
export interface LineNode {
  t: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  sw?: number
  opacity?: number
}
export interface CircleNode {
  t: 'circle'
  cx: number
  cy: number
  r: number
  fill: string
}
export interface TextNode {
  t: 'text'
  x: number
  y: number
  s: string
  fill: string
  size: number
  anchor?: 'start' | 'middle' | 'end'
  weight?: number
  /** Degrees, rotated about (x, y). */
  rotate?: number
}
export type ChartNode = RectNode | PathNode | LineNode | CircleNode | TextNode

export interface ChartScene {
  width: number
  height: number
  nodes: ChartNode[]
}

// ---------- spec plumbing ----------

export type ChartSpecLike = Pick<ChartSpec, 'type' | 'title'> &
  Partial<Pick<ChartSpec, 'legend' | 'xTitle' | 'yTitle' | 'dataLabels' | 'gridlines' | 'lineSeries'>>

export interface ChartOptions {
  type: ChartType
  title: string
  legend: 'none' | 'right' | 'bottom'
  xTitle: string
  yTitle: string
  dataLabels: boolean
  gridlines: boolean
  lineSeries: number[]
}

export type ChartFamily = 'cartesian' | 'pie' | 'scatter'

export function chartFamily(type: ChartType): ChartFamily {
  if (type === 'pie' || type === 'donut') return 'pie'
  if (type === 'scatter') return 'scatter'
  return 'cartesian'
}

export function isStacked(type: ChartType): boolean {
  return type === 'stackedBar' || type === 'stackedColumn'
}

/**
 * Excel's convention is bar = horizontal, column = vertical, and the new types
 * follow it — except plain 'bar', which this app has always drawn as vertical
 * columns and which is baked into shipped templates and every saved document.
 * Its meaning is pinned; 'column' is the name to use for new charts.
 */
export function isHorizontal(type: ChartType): boolean {
  return type === 'stackedBar'
}

export function resolveOptions(spec: ChartSpecLike, data: ChartData): ChartOptions {
  const type = spec.type
  const count = data.series.length
  const pie = chartFamily(type) === 'pie'
  const fallbackLegend: ChartOptions['legend'] = pie || count <= 1 ? 'none' : 'bottom'
  const lineSeries =
    spec.lineSeries?.filter((i) => Number.isInteger(i) && i >= 0 && i < count) ??
    (type === 'combo' && count > 1 ? [count - 1] : [])
  return {
    type,
    title: spec.title ?? '',
    legend: spec.legend ?? fallbackLegend,
    xTitle: spec.xTitle ?? '',
    yTitle: spec.yTitle ?? '',
    dataLabels: spec.dataLabels ?? false,
    gridlines: spec.gridlines ?? true,
    lineSeries,
  }
}

// ---------- numbers ----------

const r2 = (n: number): number => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function valueAt(s: ChartSeries, i: number): number | null {
  return finite(s.values[i])
}

/** The 1 / 2 / 5 × 10ⁿ ladder — the reason axis labels are round numbers. */
export function niceStep(range: number, targetTicks = 5): number {
  if (!Number.isFinite(range) || range <= 0) return 1
  const rough = range / Math.max(1, targetTicks)
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  let step: number
  if (norm < 1.5) step = 1
  else if (norm < 3) step = 2
  else if (norm < 7) step = 5
  else step = 10
  return step * mag
}

/** Drop the floating-point dust a repeated += leaves behind. */
function snap(v: number, step: number): number {
  const d = Math.max(0, Math.min(20, -Math.floor(Math.log10(step)) + 1))
  return Number(v.toFixed(d))
}

export interface Scale {
  min: number
  max: number
  step: number
  ticks: number[]
}

export function niceScale(minIn: number, maxIn: number, targetTicks = 5): Scale {
  let min = Number.isFinite(minIn) ? minIn : 0
  let max = Number.isFinite(maxIn) ? maxIn : 0
  if (min > max) {
    const swap = min
    min = max
    max = swap
  }
  if (min === max) {
    // A flat series still needs a domain to sit in.
    if (min === 0) {
      max = 1
    } else if (min > 0) {
      max = min * 1.2
      min = 0
    } else {
      min = min * 1.2
      max = 0
    }
  }
  const step = niceStep(max - min, targetTicks)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  // Bounded: a pathological range must not spin here.
  for (let i = 0; i <= 200; i++) {
    const v = snap(lo + i * step, step)
    ticks.push(v)
    if (v >= hi - step * 1e-9) break
  }
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks }
}

export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step >= 1) return 0
  return Math.min(6, Math.ceil(-Math.log10(step)))
}

export function fmtNumber(v: number, decimals: number): string {
  if (!Number.isFinite(v)) return ''
  const fixed = Math.abs(v).toFixed(Math.max(0, Math.min(20, decimals)))
  const neg = v < 0 && Number(fixed) !== 0
  const dot = fixed.indexOf('.')
  const int = dot < 0 ? fixed : fixed.slice(0, dot)
  const frac = dot < 0 ? '' : fixed.slice(dot)
  return (neg ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + frac
}

/** Short form for places where digits compete with the plot for width. */
export function fmtCompact(v: number): string {
  if (!Number.isFinite(v)) return ''
  const a = Math.abs(v)
  // The ladder has to reach as far as a spreadsheet's numbers do: stopping at M
  // turned 2.5e12 into "2500000M", which is longer than the digits it replaced.
  if (a >= 1e12) return String(Math.round((v / 1e12) * 100) / 100) + 'T'
  if (a >= 1e9) return String(Math.round((v / 1e9) * 100) / 100) + 'B'
  if (a >= 1e6) return String(Math.round((v / 1e6) * 100) / 100) + 'M'
  if (a >= 1e4) return String(Math.round((v / 1e3) * 100) / 100) + 'k'
  return fmtNumber(v, Number.isInteger(v) ? 0 : 1)
}

/** Axis text: round, grouped, abbreviated only once the step is coarse enough. */
export function fmtAxis(v: number, step: number): string {
  if (!Number.isFinite(v)) return ''
  const a = Math.abs(v)
  if (a >= 1e6 && step >= 1e4) return fmtCompact(v)
  if (a >= 1e4 && step >= 100) return fmtCompact(v)
  return fmtNumber(v, decimalsForStep(step))
}

// Advances measured in the system UI font, rounded up into classes. One flat
// per-glyph average cannot do the job: it has to sit above a digit's 0.65 em to
// keep a tick label on the frame, and anything that high shaves real characters
// off a lowercase label, whose glyphs average 0.53.
const NARROW_CHARS = new Set(" .,:;'`!|ijlI".split(''))
const THIN_CHARS = new Set('1flrt-()[]/'.split(''))
const WIDE_CHARS = new Set('mwMW%@'.split(''))
/** Rough per-character width, for a budget struck before the text is known. */
const AVG_CHAR_W = 0.6

/**
 * Both renderers must reach the same width for a string and neither has a DOM
 * to measure with, so estimate from the characters. Deliberately generous:
 * every reserve in this file is computed from it, and one that comes out short
 * is a label drawn past the edge of an svg that clips.
 */
export function textWidth(s: string, size: number): number {
  let em = 0
  for (const ch of s) {
    if (NARROW_CHARS.has(ch)) em += 0.32
    else if (THIN_CHARS.has(ch)) em += 0.5
    else if (WIDE_CHARS.has(ch)) em += 1
    else if (ch > 'ÿ') em += 1 // an ellipsis, or CJK: about an em each
    else if (ch >= 'A' && ch <= 'Z') em += 0.8
    else em += 0.67
  }
  return em * size
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s
}

/** Trim until it fits: a character budget only guesses, this one measures. */
export function fitText(s: string, size: number, maxW: number): string {
  if (textWidth(s, size) <= maxW) return s
  let n = s.length
  while (n > 1 && textWidth(truncate(s, n), size) > maxW) n--
  return truncate(s, n)
}

// ---------- data shaping ----------

export interface StackTotals {
  pos: number[]
  neg: number[]
}

/** Positives stack up from zero, negatives down — the axis has to cover both. */
export function stackTotals(series: ChartSeries[], n: number): StackTotals {
  const pos = new Array<number>(Math.max(0, n)).fill(0)
  const neg = new Array<number>(Math.max(0, n)).fill(0)
  for (const s of series) {
    for (let i = 0; i < n; i++) {
      const v = valueAt(s, i)
      if (v === null) continue
      if (v >= 0) pos[i] += v
      else neg[i] += v
    }
  }
  return { pos, neg }
}

export function categoryCount(data: ChartData): number {
  let n = 0
  for (const s of data.series) n = Math.max(n, s.values.length)
  return n
}

export function labelAt(data: ChartData, i: number): string {
  const l = data.labels[i]
  return typeof l === 'string' && l !== '' ? l : String(i + 1)
}

// ---------- layout ----------

const TITLE_FS = 12.5
const TICK_FS = 9.5
const CAT_FS = 9.5
const LEGEND_FS = 10.5
const AXIS_TITLE_FS = 10.5
const DL_FS = 9
const LEGEND_ROW_H = 15
const SWATCH = 9
/**
 * Floor for a right-hand legend column: narrow enough to leave the plot room,
 * wide enough for the "+N more" note that replaces the items that do not fit.
 */
const LEGEND_MIN_W = 64
/** sin 45° — how much vertical room a −45° label needs per unit of its width. */
const ROT = 0.71
/** Ceiling on that room, so a long name cannot squeeze the plot to nothing. */
const ROT_BAND_MAX = 48
/** Longest category label kept, and the point below which trimming stops helping. */
const CAT_MAX = 16
const CAT_MIN = 9
const CALLOUT_FS = 9.5
/** Radial gap between the rim and a slice's callout. */
const CALLOUT_GAP = 13
/** Slices thinner than this get no callout — there is nowhere to put it. */
const LABELLED_SLICE = 0.03

interface LegendItem {
  label: string
  color: string
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

function legendItems(opts: ChartOptions, data: ChartData): LegendItem[] {
  if (opts.legend === 'none') return []
  if (chartFamily(opts.type) === 'pie') {
    const first = data.series[0]
    const n = first ? first.values.length : 0
    return Array.from({ length: n }, (_, i) => ({ label: truncate(labelAt(data, i), 16), color: seriesColor(i) }))
  }
  // Scatter's first series supplies x, so it names no mark of its own.
  if (opts.type === 'scatter' && data.series.length > 1) {
    return data.series.slice(1).map((s, i) => ({ label: truncate(s.name, 16), color: seriesColor(i) }))
  }
  return data.series.map((s, i) => ({ label: truncate(s.name, 16), color: seriesColor(i) }))
}

function legendItemW(it: LegendItem): number {
  return SWATCH + 5 + textWidth(it.label, LEGEND_FS) + 12
}

function legendRows(items: LegendItem[], avail: number): LegendItem[][] {
  const rows: LegendItem[][] = [[]]
  let used = 0
  for (const it of items) {
    const iw = Math.min(legendItemW(it), avail)
    if (used > 0 && used + iw > avail) {
      rows.push([it])
      used = iw
    } else {
      rows[rows.length - 1].push(it)
      used += iw
    }
  }
  return rows
}

/** Reserved space only; the nodes come later, once the plot box is settled. */
function legendSize(opts: ChartOptions, items: LegendItem[], w: number, h: number): { rw: number; bh: number } {
  if (!items.length) return { rw: 0, bh: 0 }
  if (opts.legend === 'right') {
    let widest = 0
    for (const it of items) widest = Math.max(widest, legendItemW(it))
    return { rw: Math.min(Math.max(LEGEND_MIN_W, widest), Math.max(LEGEND_MIN_W, w * 0.34)), bh: 0 }
  }
  const rows = legendRows(items, Math.max(40, w - 8))
  const maxRows = Math.max(1, Math.floor((h * 0.3) / LEGEND_ROW_H))
  return { rw: 0, bh: Math.min(rows.length, maxRows) * LEGEND_ROW_H + 3 }
}

function emitLegend(nodes: ChartNode[], opts: ChartOptions, items: LegendItem[], area: Box, w: number) {
  if (!items.length) return
  if (opts.legend === 'right') {
    const x = area.x + 4
    const fit = Math.max(1, Math.floor(area.h / LEGEND_ROW_H))
    const shown = items.length > fit ? items.slice(0, Math.max(1, fit - 1)) : items
    const lines = shown.length + (shown.length < items.length ? 1 : 0)
    const top = area.y + Math.max(0, (area.h - lines * LEGEND_ROW_H) / 2)
    // The column is capped at a third of the chart, so a name that fits the
    // 16-character budget can still run off the right edge — trim to the space
    // the column actually got, not to the space the name wanted.
    const room = area.w - 4 - SWATCH - 5
    shown.forEach((it, i) => {
      const y = top + i * LEGEND_ROW_H
      nodes.push({ t: 'rect', x: r2(x), y: r2(y), w: SWATCH, h: SWATCH, rx: 2, fill: it.color })
      nodes.push({ t: 'text', x: r2(x + SWATCH + 5), y: r2(y + SWATCH - 0.5), s: fitText(it.label, LEGEND_FS, room), fill: 'text2', size: LEGEND_FS })
    })
    if (shown.length < items.length) {
      nodes.push({
        t: 'text',
        x: r2(x),
        y: r2(top + shown.length * LEGEND_ROW_H + SWATCH - 0.5),
        s: `+${items.length - shown.length} more`,
        fill: 'text3',
        size: LEGEND_FS,
      })
    }
    return
  }
  const avail = Math.max(40, w - 8)
  const rows = legendRows(items, avail)
  const maxRows = Math.max(1, Math.floor(area.h / LEGEND_ROW_H))
  rows.slice(0, maxRows).forEach((row, ri) => {
    const rowW = row.reduce((a, it) => a + Math.min(legendItemW(it), avail), 0)
    let x = Math.max(4, (w - rowW) / 2)
    const y = area.y + ri * LEGEND_ROW_H
    for (const it of row) {
      nodes.push({ t: 'rect', x: r2(x), y: r2(y + 1), w: SWATCH, h: SWATCH, rx: 2, fill: it.color })
      nodes.push({ t: 'text', x: r2(x + SWATCH + 5), y: r2(y + SWATCH + 0.5), s: it.label, fill: 'text2', size: LEGEND_FS })
      x += Math.min(legendItemW(it), avail)
    }
  })
}

function legendBox(opts: ChartOptions, plot: Box, rw: number, bh: number, w: number, h: number): Box {
  return opts.legend === 'right' ? { x: w - rw, y: plot.y, w: rw, h: plot.h } : { x: 0, y: h - bh, w, h: bh }
}

function emitTitle(nodes: ChartNode[], opts: ChartOptions, w: number) {
  if (!opts.title) return
  nodes.push({ t: 'text', x: r2(w / 2), y: 16, s: opts.title, fill: 'text', size: TITLE_FS, anchor: 'middle', weight: 600 })
}

function noData(width: number, height: number): ChartScene {
  return {
    width,
    height,
    nodes: [{ t: 'text', x: r2(width / 2), y: r2(height / 2), s: 'No data', fill: 'text3', size: 12, anchor: 'middle' }],
  }
}

/** Show every k-th category label, k chosen so the labels cannot collide. */
function labelStride(band: number, need: number): number {
  return band <= 0 ? 1 : Math.max(1, Math.ceil(need / band))
}

// ---------- entry point ----------

export function buildChartScene(spec: ChartSpecLike, data: ChartData, width: number, height: number): ChartScene {
  const w = Math.max(60, Math.round(Number.isFinite(width) ? width : 0))
  const h = Math.max(60, Math.round(Number.isFinite(height) ? height : 0))
  const opts = resolveOptions(spec, data)
  const n = categoryCount(data)
  if (data.series.length === 0 || n === 0) return noData(w, h)

  const family = chartFamily(opts.type)
  if (family === 'pie') return buildPie(opts, data, w, h)
  if (family === 'scatter') return buildScatter(opts, data, w, h, n)
  return buildCartesian(opts, data, w, h, n)
}

// ---------- cartesian: bar / column / stacked / line / area / combo ----------

function buildCartesian(opts: ChartOptions, data: ChartData, w: number, h: number, n: number): ChartScene {
  const nodes: ChartNode[] = []
  const series = data.series
  const stacked = isStacked(opts.type)
  const horiz = isHorizontal(opts.type)
  const allLines = opts.type === 'line' || opts.type === 'area'
  const lineIdx = new Set(allLines ? series.map((_, i) => i) : stacked ? [] : opts.lineSeries)
  const colIdx = stacked ? [] : series.map((_, i) => i).filter((i) => !lineIdx.has(i))

  // Value domain. Bars need the zero baseline and lines have always included it
  // here too, so keep that — existing charts keep their framing.
  const stacks = stacked ? stackTotals(series, n) : null
  let vMin = 0
  let vMax = 0
  if (stacks) {
    for (const v of stacks.pos) vMax = Math.max(vMax, v)
    for (const v of stacks.neg) vMin = Math.min(vMin, v)
  } else {
    for (const s of series) {
      for (let i = 0; i < n; i++) {
        const v = valueAt(s, i)
        if (v === null) continue
        if (v < vMin) vMin = v
        if (v > vMax) vMax = v
      }
    }
  }
  const scale = niceScale(vMin, vMax)
  const tickTexts = scale.ticks.map((t) => fmtAxis(t, scale.step))
  // Horizontal charts give the labels a column of their own, bounded so a long
  // name cannot eat the plot; vertical charts trim to the band further down.
  let catTexts = Array.from({ length: n }, (_, i) => truncate(labelAt(data, i), CAT_MAX))
  if (horiz) catTexts = catTexts.map((s) => fitText(s, CAT_FS, w * 0.3))

  const items = legendItems(opts, data)
  const { rw: legendRW, bh: legendBH } = legendSize(opts, items, w, h)

  const titleH = opts.title ? 22 : 4
  const rightEdge = w - 8 - legendRW
  const bottomEdge = h - 4 - legendBH

  let tickW = 0
  for (const t of tickTexts) tickW = Math.max(tickW, textWidth(t, TICK_FS))
  let catW = 0
  for (const c of catTexts) catW = Math.max(catW, textWidth(c, CAT_FS))

  const dl = opts.dataLabels && n <= 24
  const decimals = decimalsForStep(scale.step)

  // Both ends of the value axis are overhung: a tick label is centred on its
  // gridline, and a data label is printed just past the mark it belongs to. The
  // plot has to give that space up or the outermost of them lands off the frame.
  // On a horizontal chart the value axis is x, so the overhang is a width and
  // depends on the labels themselves; the vertical case is one line of text.
  let overLo = 0
  let overHi = 0
  if (horiz) {
    overLo = tickW / 2
    overHi = tickW / 2
    // Horizontal means stacked (see isHorizontal), so the label is the total.
    if (dl && stacks) {
      for (let i = 0; i < n; i++) {
        const need = 4 + textWidth(fmtNumber(stacks.pos[i] + stacks.neg[i], decimals), DL_FS)
        if (stacks.pos[i] !== 0) overHi = Math.max(overHi, need)
        else if (stacks.neg[i] !== 0) overLo = Math.max(overLo, need)
      }
    }
  }
  const dlBand = !horiz && dl ? DL_FS + 3 : 0

  const plotX = Math.max(6 + (opts.yTitle ? 13 : 0) + (horiz ? catW + 8 : tickW + 8), overLo + 2)
  const plotW = Math.max(20, rightEdge - Math.max(0, overHi - 8) - plotX)

  // Upright labels get trimmed to their band. Once that leaves too few
  // characters to be worth reading, rotate instead — which buys width at the
  // cost of a taller bottom band, so it has to be settled before the plot
  // height, and therefore before the bands themselves exist.
  const bandW = plotW / n
  const rotate = !horiz && n > 1 && bandW < CAT_FS * AVG_CHAR_W * CAT_MIN
  if (!horiz) {
    // A rotated label is bounded by how tall the band may grow, not by the
    // band's width. Trim it to that: capping the band alone only sent the tails
    // off the bottom of the frame.
    catTexts = catTexts.map((s) => fitText(s, CAT_FS, rotate ? ROT_BAND_MAX / ROT : bandW))
    catW = 0
    for (const c of catTexts) catW = Math.max(catW, textWidth(c, CAT_FS))
  }
  const catBandH = horiz ? 13 : rotate ? catW * ROT + 15 : 14
  // A −45° label runs down-left from its tick, so the leftmost one reaches past
  // the value axis. Give it whatever the tick gutter has not already covered,
  // capped — past that the labels would be taking the chart over.
  const rotPad = rotate ? Math.min(w * 0.18, Math.max(0, ROT * (catW + CAT_FS) - bandW / 2 - plotX)) : 0
  const plotY = titleH + 4 + dlBand
  const plotH = Math.max(20, bottomEdge - (opts.xTitle ? 13 : 0) - catBandH - dlBand - plotY)
  const plot: Box = { x: plotX + rotPad, y: plotY, w: Math.max(20, plotW - rotPad), h: plotH }
  // Top of the category band: the data-label strip sits between it and the plot.
  const catTop = plot.y + plot.h + dlBand

  // Vertical charts run categories along x and values up y; horizontal swaps them.
  const span = scale.max - scale.min || 1
  const vAt = (v: number): number =>
    horiz ? plot.x + ((v - scale.min) / span) * plot.w : plot.y + plot.h - ((v - scale.min) / span) * plot.h
  const band = (horiz ? plot.h : plot.w) / Math.max(1, n)
  const cAt = (i: number): number => (horiz ? plot.y : plot.x) + band * i
  const zeroV = scale.min <= 0 && scale.max >= 0 ? 0 : scale.min

  // Gridlines and value-axis ticks.
  scale.ticks.forEach((t, i) => {
    const p = vAt(t)
    if (opts.gridlines) {
      nodes.push(
        horiz
          ? { t: 'line', x1: r2(p), x2: r2(p), y1: r2(plot.y), y2: r2(plot.y + plot.h), stroke: 'line', sw: 1 }
          : { t: 'line', x1: r2(plot.x), x2: r2(plot.x + plot.w), y1: r2(p), y2: r2(p), stroke: 'line', sw: 1 },
      )
    }
    nodes.push(
      horiz
        ? { t: 'text', x: r2(p), y: r2(catTop + 12), s: tickTexts[i], fill: 'text3', size: TICK_FS, anchor: 'middle' }
        : { t: 'text', x: r2(plot.x - 6), y: r2(p + 3), s: tickTexts[i], fill: 'text3', size: TICK_FS, anchor: 'end' },
    )
  })

  // The baseline reads stronger than the grid so negative bars make sense.
  const zeroP = vAt(zeroV)
  nodes.push(
    horiz
      ? { t: 'line', x1: r2(zeroP), x2: r2(zeroP), y1: r2(plot.y), y2: r2(plot.y + plot.h), stroke: 'text3', sw: 1, opacity: 0.5 }
      : { t: 'line', x1: r2(plot.x), x2: r2(plot.x + plot.w), y1: r2(zeroP), y2: r2(zeroP), stroke: 'text3', sw: 1, opacity: 0.5 },
  )

  // Category labels.
  const stride = horiz ? labelStride(band, 12) : rotate ? labelStride(band, 13) : 1
  for (let i = 0; i < n; i += stride) {
    const c = cAt(i) + band / 2
    if (horiz) {
      nodes.push({ t: 'text', x: r2(plot.x - 6), y: r2(c + 3), s: catTexts[i], fill: 'text3', size: CAT_FS, anchor: 'end' })
    } else if (rotate) {
      // −45° with an end anchor sends the text down-left from the tick.
      nodes.push({
        t: 'text',
        x: r2(c),
        y: r2(catTop + 11),
        s: catTexts[i],
        fill: 'text3',
        size: CAT_FS,
        anchor: 'end',
        rotate: -45,
      })
    } else {
      nodes.push({ t: 'text', x: r2(c), y: r2(catTop + 12), s: catTexts[i], fill: 'text3', size: CAT_FS, anchor: 'middle' })
    }
  }

  if (opts.xTitle) {
    nodes.push({
      t: 'text',
      x: r2(plot.x + plot.w / 2),
      y: r2(bottomEdge - 2),
      s: opts.xTitle,
      fill: 'text2',
      size: AXIS_TITLE_FS,
      anchor: 'middle',
    })
  }
  if (opts.yTitle) {
    nodes.push({
      t: 'text',
      x: 11,
      y: r2(plot.y + plot.h / 2),
      s: opts.yTitle,
      fill: 'text2',
      size: AXIS_TITLE_FS,
      anchor: 'middle',
      rotate: -90,
    })
  }

  const barRect = (cPos: number, cSize: number, a: number, b: number, fill: string, rx?: number): RectNode => {
    const p0 = vAt(a)
    const p1 = vAt(b)
    return horiz
      ? { t: 'rect', x: r2(Math.min(p0, p1)), y: r2(cPos), w: r2(Math.abs(p1 - p0)), h: r2(cSize), rx, fill }
      : { t: 'rect', x: r2(cPos), y: r2(Math.min(p0, p1)), w: r2(cSize), h: r2(Math.abs(p1 - p0)), rx, fill }
  }

  if (stacked) {
    const runPos = new Array<number>(n).fill(0)
    const runNeg = new Array<number>(n).fill(0)
    const thick = Math.max(1, band * 0.68)
    series.forEach((s, si) => {
      for (let i = 0; i < n; i++) {
        const v = valueAt(s, i)
        if (v === null || v === 0) continue
        const base = v > 0 ? runPos[i] : runNeg[i]
        const top = base + v
        if (v > 0) runPos[i] = top
        else runNeg[i] = top
        nodes.push(barRect(cAt(i) + (band - thick) / 2, thick, base, top, seriesColor(si)))
      }
    })
    if (dl) {
      // The total sits outside the bar: text inside a segment would need a
      // colour that stays legible on ten fills across two themes.
      for (let i = 0; i < n; i++) {
        const total = runPos[i] + runNeg[i]
        if (runPos[i] === 0 && runNeg[i] === 0) continue
        const up = runPos[i] !== 0
        const end = vAt(up ? runPos[i] : runNeg[i])
        const c = cAt(i) + band / 2
        nodes.push(
          horiz
            ? // A negative stack runs left from zero, so its total goes on the
              // far side too — drawn to the right it would sit on the bar.
              {
                t: 'text',
                x: r2(up ? end + 4 : end - 4),
                y: r2(c + 3),
                s: fmtNumber(total, decimals),
                fill: 'text2',
                size: DL_FS,
                anchor: up ? 'start' : 'end',
              }
            : {
                t: 'text',
                x: r2(c),
                y: r2(up ? end - 4 : end + 9),
                s: fmtNumber(total, decimals),
                fill: 'text2',
                size: DL_FS,
                anchor: 'middle',
              },
        )
      }
    }
  } else if (colIdx.length) {
    const groupW = band * 0.7
    const barW = groupW / colIdx.length
    colIdx.forEach((si, slot) => {
      const s = series[si]
      for (let i = 0; i < n; i++) {
        const v = valueAt(s, i)
        if (v === null) continue
        const cPos = cAt(i) + (band - groupW) / 2 + slot * barW
        const size = barW > 4 ? barW - 2 : Math.max(1, barW)
        nodes.push(barRect(cPos, size, zeroV, v, seriesColor(si), 1.5))
        if (dl && barW >= 14) {
          const p0 = vAt(zeroV)
          const p1 = vAt(v)
          nodes.push(
            horiz
              ? { t: 'text', x: r2(Math.max(p0, p1) + 4), y: r2(cPos + size / 2 + 3), s: fmtNumber(v, decimals), fill: 'text2', size: DL_FS }
              : {
                  t: 'text',
                  x: r2(cPos + size / 2),
                  y: r2(v >= 0 ? Math.min(p0, p1) - 4 : Math.max(p0, p1) + 9),
                  s: fmtNumber(v, decimals),
                  fill: 'text2',
                  size: DL_FS,
                  anchor: 'middle',
                },
          )
        }
      }
    })
  }

  // Lines and areas ride the same value axis as the columns beside them.
  series.forEach((s, si) => {
    if (!lineIdx.has(si)) return
    const color = seriesColor(si)
    const runs: Array<Array<[number, number, number]>> = []
    let run: Array<[number, number, number]> = []
    for (let i = 0; i < n; i++) {
      const v = valueAt(s, i)
      if (v === null) {
        // A gap breaks the line rather than inventing a zero.
        if (run.length) runs.push(run)
        run = []
        continue
      }
      const c = cAt(i) + band / 2
      run.push(horiz ? [vAt(v), c, v] : [c, vAt(v), v])
    }
    if (run.length) runs.push(run)

    for (const pts of runs) {
      const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r2(x)},${r2(y)}`).join(' ')
      if (opts.type === 'area' && pts.length > 1) {
        const base = vAt(zeroV)
        const first = pts[0]
        const last = pts[pts.length - 1]
        const close = horiz
          ? `L${r2(base)},${r2(last[1])} L${r2(base)},${r2(first[1])} Z`
          : `L${r2(last[0])},${r2(base)} L${r2(first[0])},${r2(base)} Z`
        nodes.push({ t: 'path', d: `${d} ${close}`, fill: color, opacity: 0.16 })
      }
      nodes.push({ t: 'path', d, stroke: color, sw: 2 })
      if (pts.length <= 60) for (const [x, y] of pts) nodes.push({ t: 'circle', cx: r2(x), cy: r2(y), r: 2.6, fill: color })
      if (dl) {
        for (const [x, y, v] of pts) {
          nodes.push({ t: 'text', x: r2(x), y: r2(y - 6), s: fmtNumber(v, decimals), fill: 'text2', size: DL_FS, anchor: 'middle' })
        }
      }
    }
  })

  emitLegend(nodes, opts, items, legendBox(opts, plot, legendRW, legendBH, w, h), w)
  emitTitle(nodes, opts, w)
  return { width: w, height: h, nodes }
}

// ---------- scatter ----------

function buildScatter(opts: ChartOptions, data: ChartData, w: number, h: number, n: number): ChartScene {
  const nodes: ChartNode[] = []
  // Two or more series: the first supplies x and the rest are plotted against
  // it. A lone series has nothing to pair with, so it falls back to row number.
  const single = data.series.length < 2
  const xs: Array<number | null> = single
    ? Array.from({ length: n }, (_, i) => i + 1)
    : Array.from({ length: n }, (_, i) => valueAt(data.series[0], i))
  const ySeries = single ? data.series : data.series.slice(1)

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < n; i++) {
    const x = xs[i]
    if (x === null) continue
    for (const s of ySeries) {
      const y = valueAt(s, i)
      if (y === null) continue
      xMin = Math.min(xMin, x)
      xMax = Math.max(xMax, x)
      yMin = Math.min(yMin, y)
      yMax = Math.max(yMax, y)
    }
  }
  if (!Number.isFinite(xMin)) return noData(w, h)

  // A scatter frames its cloud, so both axes come from the data, not from zero.
  const sx = niceScale(xMin, xMax, 4)
  const sy = niceScale(yMin, yMax, 5)
  const xTexts = sx.ticks.map((t) => fmtAxis(t, sx.step))
  const yTexts = sy.ticks.map((t) => fmtAxis(t, sy.step))

  const items = legendItems(opts, data)
  const { rw: legendRW, bh: legendBH } = legendSize(opts, items, w, h)
  const titleH = opts.title ? 22 : 4

  let tickW = 0
  for (const t of yTexts) tickW = Math.max(tickW, textWidth(t, TICK_FS))
  let xTickW = 0
  for (const t of xTexts) xTickW = Math.max(xTickW, textWidth(t, TICK_FS))

  const decimals = decimalsForStep(sy.step)
  const dl = opts.dataLabels && n <= 24
  // A point sits on the frame whenever its value is the outermost tick, and its
  // label is drawn beyond it — above, and centred, so it overhangs three sides.
  const dlBand = dl ? DL_FS + 3 : 0
  let xOver = xTickW / 2
  if (dl) {
    for (const s of ySeries) {
      for (let i = 0; i < n; i++) {
        const v = valueAt(s, i)
        if (v !== null) xOver = Math.max(xOver, textWidth(fmtNumber(v, decimals), DL_FS) / 2)
      }
    }
  }

  const plotX = Math.max(6 + (opts.yTitle ? 13 : 0) + tickW + 8, xOver)
  const plotY = titleH + 4 + dlBand
  const plot: Box = {
    x: plotX,
    y: plotY,
    w: Math.max(20, w - 12 - legendRW - Math.max(0, xOver - 12) - plotX),
    h: Math.max(20, h - 4 - legendBH - (opts.xTitle ? 13 : 0) - 14 - plotY),
  }
  const xSpan = sx.max - sx.min || 1
  const ySpan = sy.max - sy.min || 1
  const px = (v: number) => plot.x + ((v - sx.min) / xSpan) * plot.w
  const py = (v: number) => plot.y + plot.h - ((v - sy.min) / ySpan) * plot.h

  if (opts.gridlines) {
    for (const t of sy.ticks) {
      const y = py(t)
      nodes.push({ t: 'line', x1: r2(plot.x), x2: r2(plot.x + plot.w), y1: r2(y), y2: r2(y), stroke: 'line', sw: 1 })
    }
    for (const t of sx.ticks) {
      const x = px(t)
      nodes.push({ t: 'line', x1: r2(x), x2: r2(x), y1: r2(plot.y), y2: r2(plot.y + plot.h), stroke: 'line', sw: 1 })
    }
  }
  sy.ticks.forEach((t, i) => {
    nodes.push({ t: 'text', x: r2(plot.x - 6), y: r2(py(t) + 3), s: yTexts[i], fill: 'text3', size: TICK_FS, anchor: 'end' })
  })
  const xStride = labelStride(plot.w / Math.max(1, sx.ticks.length - 1), xTickW + 8)
  sx.ticks.forEach((t, i) => {
    if (i % xStride !== 0) return
    nodes.push({ t: 'text', x: r2(px(t)), y: r2(plot.y + plot.h + 12), s: xTexts[i], fill: 'text3', size: TICK_FS, anchor: 'middle' })
  })

  ySeries.forEach((s, si) => {
    const color = seriesColor(si)
    for (let i = 0; i < n; i++) {
      const x = xs[i]
      const y = valueAt(s, i)
      if (x === null || y === null) continue
      nodes.push({ t: 'circle', cx: r2(px(x)), cy: r2(py(y)), r: 3.2, fill: color })
      if (dl) {
        nodes.push({ t: 'text', x: r2(px(x)), y: r2(py(y) - 6), s: fmtNumber(y, decimals), fill: 'text2', size: DL_FS, anchor: 'middle' })
      }
    }
  })

  if (opts.xTitle) {
    nodes.push({
      t: 'text',
      x: r2(plot.x + plot.w / 2),
      y: r2(h - 6 - legendBH),
      s: opts.xTitle,
      fill: 'text2',
      size: AXIS_TITLE_FS,
      anchor: 'middle',
    })
  }
  if (opts.yTitle) {
    nodes.push({
      t: 'text',
      x: 11,
      y: r2(plot.y + plot.h / 2),
      s: opts.yTitle,
      fill: 'text2',
      size: AXIS_TITLE_FS,
      anchor: 'middle',
      rotate: -90,
    })
  }

  emitLegend(nodes, opts, items, legendBox(opts, plot, legendRW, legendBH, w, h), w)
  emitTitle(nodes, opts, w)
  return { width: w, height: h, nodes }
}

// ---------- pie / donut ----------

function arcPoint(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/**
 * A wedge, or a ring segment when innerR > 0. A full turn has no arc endpoints
 * to join, so it is drawn as a pair of half arcs instead of a zero-length path.
 */
export function slicePath(cx: number, cy: number, r: number, innerR: number, start: number, end: number): string {
  if (end - start >= Math.PI * 2 - 1e-9) {
    const outer = `M${r2(cx - r)},${r2(cy)} A${r2(r)},${r2(r)} 0 1 1 ${r2(cx + r)},${r2(cy)} A${r2(r)},${r2(r)} 0 1 1 ${r2(cx - r)},${r2(cy)} Z`
    if (innerR <= 0) return outer
    return `${outer} M${r2(cx - innerR)},${r2(cy)} A${r2(innerR)},${r2(innerR)} 0 1 0 ${r2(cx + innerR)},${r2(cy)} A${r2(innerR)},${r2(innerR)} 0 1 0 ${r2(cx - innerR)},${r2(cy)} Z`
  }
  const large = end - start > Math.PI ? 1 : 0
  const [x1, y1] = arcPoint(cx, cy, r, start)
  const [x2, y2] = arcPoint(cx, cy, r, end)
  if (innerR <= 0) {
    return `M${r2(cx)},${r2(cy)} L${r2(x1)},${r2(y1)} A${r2(r)},${r2(r)} 0 ${large} 1 ${r2(x2)},${r2(y2)} Z`
  }
  const [x3, y3] = arcPoint(cx, cy, innerR, end)
  const [x4, y4] = arcPoint(cx, cy, innerR, start)
  return `M${r2(x1)},${r2(y1)} A${r2(r)},${r2(r)} 0 ${large} 1 ${r2(x2)},${r2(y2)} L${r2(x3)},${r2(y3)} A${r2(innerR)},${r2(innerR)} 0 ${large} 0 ${r2(x4)},${r2(y4)} Z`
}

function buildPie(opts: ChartOptions, data: ChartData, w: number, h: number): ChartScene {
  const nodes: ChartNode[] = []
  const series = data.series[0]
  const values = series ? series.values : []
  let total = 0
  for (const raw of values) {
    const v = finite(raw)
    if (v !== null && v > 0) total += v
  }

  const items = legendItems(opts, data)
  const { rw: legendRW, bh: legendBH } = legendSize(opts, items, w, h)
  const titleH = opts.title ? 24 : 6
  const area: Box = { x: 0, y: titleH, w: w - legendRW, h: Math.max(20, h - titleH - legendBH) }
  const cx = area.x + area.w / 2
  const cy = area.y + area.h / 2

  if (total <= 0) {
    nodes.push({ t: 'text', x: r2(cx), y: r2(cy), s: 'No data', fill: 'text3', size: 11, anchor: 'middle' })
    emitTitle(nodes, opts, w)
    return { width: w, height: h, nodes }
  }

  const callout = (v: number, frac: number): string => (opts.dataLabels ? fmtCompact(v) : `${Math.round(frac * 100)}%`)
  // Callouts sit outside the circle and are drawn whether or not there is a
  // legend, so the radius always pays for them. Measure the widest one rather
  // than assume: with data labels on it is a formatted value, not "99%".
  let callW = 0
  for (const raw of values) {
    const v = finite(raw)
    if (v === null || v <= 0 || v / total <= LABELLED_SLICE) continue
    callW = Math.max(callW, textWidth(callout(v, v / total), CALLOUT_FS))
  }
  const r = Math.max(8, Math.min(area.w / 2 - CALLOUT_GAP - callW, area.h / 2 - CALLOUT_GAP - CALLOUT_FS))
  const innerR = opts.type === 'donut' ? r * 0.58 : 0

  let angle = -Math.PI / 2
  values.forEach((raw, i) => {
    const v = finite(raw)
    if (v === null || v <= 0) return
    const frac = v / total
    const start = angle
    const end = angle + frac * Math.PI * 2
    angle = end
    nodes.push({
      t: 'path',
      d: slicePath(cx, cy, r, innerR, start, end),
      fill: seriesColor(i),
      stroke: 'surface',
      sw: 1.5,
      evenodd: innerR > 0,
    })
    if (frac > LABELLED_SLICE) {
      const mid = (start + end) / 2
      const [lx, ly] = arcPoint(cx, cy, r + CALLOUT_GAP, mid)
      nodes.push({
        t: 'text',
        x: r2(lx),
        y: r2(ly + 3),
        s: callout(v, frac),
        fill: 'text2',
        size: CALLOUT_FS,
        anchor: Math.cos(mid) > 0.15 ? 'start' : Math.cos(mid) < -0.15 ? 'end' : 'middle',
      })
    }
  })

  if (innerR > 0) {
    const text = fmtCompact(total)
    // Shrink to fit the hole rather than spill across the ring.
    const size = Math.max(8, Math.min(17, (innerR * 1.7) / Math.max(1, textWidth(text, 1))))
    nodes.push({ t: 'text', x: r2(cx), y: r2(cy + size * 0.36), s: text, fill: 'text', size: r2(size), anchor: 'middle', weight: 600 })
    if (innerR > 26) {
      nodes.push({ t: 'text', x: r2(cx), y: r2(cy - size * 0.72), s: 'Total', fill: 'text3', size: 9, anchor: 'middle' })
    }
  }

  emitLegend(nodes, opts, items, legendBox(opts, { x: 0, y: area.y, w: area.w, h: area.h }, legendRW, legendBH, w, h), w)
  emitTitle(nodes, opts, w)
  return { width: w, height: h, nodes }
}
