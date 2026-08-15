// Pivot tables: group a source range by row/column fields, aggregate the value
// fields, and lay the answer out as a block of ordinary styled cells. Pure — no
// React, no DOM.
//
// The result is written into the sheet rather than kept live behind a widget, so
// a pivot can be formatted, sorted, charted and exported like anything else the
// user typed. "Refresh pivot" rebuilds the block in place.

import type { Cell, CellStyle, PivotAgg, PivotSpec, Sheet } from '../../shared/types'
import type { ComputedCell, FValue } from './engine/formula'
import { isErr } from './engine/formula'
import { colToLetters, parseCellRef, parseRangeStr, rangeBounds, refToString } from './engine/refs'
import { formatValue } from './engine/format'
import { DEFAULT_COL_W } from './types'

export const PIVOT_AGGS: PivotAgg[] = ['sum', 'count', 'average', 'min', 'max', 'countUnique']

export const AGG_LABELS: Record<PivotAgg, string> = {
  sum: 'Sum',
  count: 'Count',
  average: 'Average',
  min: 'Min',
  max: 'Max',
  countUnique: 'Distinct count',
}

/** Shown for a group whose field value is empty; also sorts last. */
export const BLANK_LABEL = '(blank)'
export const TOTAL_LABEL = 'Grand Total'

// A pivot wider than this is a mis-selected source range, not an intention.
const MAX_COL_GROUPS = 200
const MAX_ROW_GROUPS = 5000
// The per-dimension caps still multiply out to millions of cells, and every one
// of them would be built on each preview keystroke and then saved into the
// document. Cap the area too.
const MAX_PIVOT_CELLS = 250000
// Bound on the previous-extent scan in pivotPatch.
const MAX_SCAN = 4000

const HEADER_FILL = '#eef2f7'
const TOTAL_FILL = '#f7f8fa'

// ---------------------------------------------------------------------------
// Source range
// ---------------------------------------------------------------------------

export interface SourceRef {
  /** null when the data lives on the same sheet as the pivot. */
  sheetName: string | null
  r0: number
  c0: number
  r1: number
  c1: number
}

function unquoteSheetName(raw: string): string {
  const t = raw.trim()
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'")
  return t
}

/** "A1:F20", or "Budget!A1:F20" when the pivot sits on a sheet of its own. */
export function parseSourceRef(src: string): SourceRef | null {
  const trimmed = src.trim()
  const bang = trimmed.lastIndexOf('!')
  const name = bang >= 0 ? unquoteSheetName(trimmed.slice(0, bang)) : ''
  const r = parseRangeStr(bang >= 0 ? trimmed.slice(bang + 1) : trimmed)
  if (!r) return null
  const b = rangeBounds(r.c1, r.c2)
  return { sheetName: name === '' ? null : name, r0: b.row1, c0: b.col1, r1: b.row2, c1: b.col2 }
}

/** Qualifies a range with a sheet name, quoting it when it isn't a bare word. */
export function qualifySource(sheetName: string, range: string): string {
  const safe = /^[A-Za-z_][A-Za-z0-9_ ]*$/.test(sheetName) ? sheetName : `'${sheetName.replace(/'/g, "''")}'`
  return `${safe}!${range}`
}

export interface SourceCell {
  value: FValue
  /** The cell as the grid shows it — the group label and the identity used for
   *  distinct counts, so a date-formatted serial groups as "8/21/2026". */
  text: string
}

export interface SourceTable {
  /** Header row, one entry per column of the source range. */
  fields: string[]
  /** Number formatting carried over from each source column, so a sum of a
   *  currency column comes out as currency rather than a bare number. */
  formats: (CellStyle | undefined)[]
  rows: SourceCell[][]
}

const BLANK_CELL: SourceCell = { value: '', text: '' }

export function readSource(sheet: Sheet, computed: Map<string, ComputedCell>, ref: SourceRef): SourceTable {
  const width = ref.c1 - ref.c0 + 1
  const fields: string[] = []
  const formats: (CellStyle | undefined)[] = new Array(width).fill(undefined)
  for (let i = 0; i < width; i++) {
    fields.push(computed.get(refToString(ref.c0 + i, ref.r0))?.display.trim() ?? '')
  }

  const rows: SourceCell[][] = []
  for (let r = ref.r0 + 1; r <= ref.r1; r++) {
    const cells: SourceCell[] = []
    let populated = false
    for (let i = 0; i < width; i++) {
      const key = refToString(ref.c0 + i, r)
      const c = computed.get(key)
      const cell: SourceCell = c ? { value: c.value, text: c.display } : BLANK_CELL
      if (cell.text !== '') populated = true
      cells.push(cell)
      if (formats[i] === undefined) {
        const st = sheet.cells[key]?.style
        if (st?.format && st.format !== 'auto' && st.format !== 'text') {
          formats[i] = { format: st.format, ...(st.decimals !== undefined ? { decimals: st.decimals } : {}) }
        }
      }
    }
    // A wholly blank row inside a loosely-dragged source range isn't a data
    // point — counting it would add a "(blank)" group to every field.
    if (populated) rows.push(cells)
  }
  return { fields, formats, rows }
}

export function fieldLabel(table: SourceTable, col: number): string {
  const raw = table.fields[col]?.trim()
  return raw && raw !== '' ? raw : `Column ${colToLetters(col)}`
}

export function valueLabel(table: SourceTable, value: PivotSpec['values'][number]): string {
  const custom = value.label?.trim()
  if (custom) return custom
  return `${AGG_LABELS[value.agg]} of ${fieldLabel(table, value.col)}`
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface Acc {
  sum: number
  /** How many numeric values landed here — average/min/max need it. */
  numeric: number
  nonEmpty: number
  min: number
  max: number
  distinct: Set<string>
}

function newAcc(): Acc {
  return { sum: 0, numeric: 0, nonEmpty: 0, min: Infinity, max: -Infinity, distinct: new Set() }
}

/** Blanks, text and error cells are skipped rather than coerced, so one stray
 *  "n/a" in a numeric column cannot turn a sum into #VALUE! or zero it out. */
function accPush(acc: Acc, cell: SourceCell): void {
  const v = cell.value
  if (isErr(v)) return
  if (cell.text === '') return
  acc.nonEmpty++
  acc.distinct.add(cell.text)
  if (typeof v === 'number' && Number.isFinite(v)) {
    acc.sum += v
    acc.numeric++
    if (v < acc.min) acc.min = v
    if (v > acc.max) acc.max = v
  }
}

/** null means "nothing to show" — an empty cell, not a zero. */
function accResult(acc: Acc, agg: PivotAgg): number | null {
  switch (agg) {
    case 'sum':
      return acc.sum
    case 'count':
      return acc.nonEmpty
    case 'countUnique':
      return acc.distinct.size
    case 'average':
      return acc.numeric > 0 ? acc.sum / acc.numeric : null
    case 'min':
      return acc.numeric > 0 ? acc.min : null
    case 'max':
      return acc.numeric > 0 ? acc.max : null
  }
}

/** Aggregation over a flat list of values — the engine's arithmetic, exposed
 *  on its own so it can be checked without building a whole grid. */
export function aggregate(values: FValue[], agg: PivotAgg): number | null {
  const acc = newAcc()
  for (const v of values) accPush(acc, { value: v, text: valueText(v) })
  return accResult(acc, agg)
}

function valueText(v: FValue): string {
  if (isErr(v)) return v.code
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return typeof v === 'number' ? numberText(v) : v
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** Days since 1899-12-30 for the two date shapes cells actually hold as text
 *  (real date cells are numeric serials already and sort as numbers). */
function dateOrder(text: string): number | null {
  const iso = ISO_DATE.exec(text)
  const us = iso ? null : US_DATE.exec(text)
  if (!iso && !us) return null
  const y = iso ? +iso[1] : +us![3]
  const m = iso ? +iso[2] : +us![1]
  const d = iso ? +iso[3] : +us![2]
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return Date.UTC(y, m - 1, d) / 86400000
}

/** Case-insensitive compare that reads digit runs as numbers, so "Week 2"
 *  precedes "Week 10". */
export function naturalCompare(a: string, b: string): number {
  const ax = a.toLowerCase()
  const bx = b.toLowerCase()
  const re = /(\d+)|(\D+)/g
  const at = ax.match(re) ?? []
  const bt = bx.match(re) ?? []
  for (let i = 0; i < Math.min(at.length, bt.length); i++) {
    const x = at[i]
    const y = bt[i]
    const xn = /^\d/.test(x)
    const yn = /^\d/.test(y)
    if (xn && yn) {
      const d = Number(x) - Number(y)
      if (d !== 0) return d < 0 ? -1 : 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  if (at.length !== bt.length) return at.length < bt.length ? -1 : 1
  return a === b ? 0 : a < b ? -1 : 1
}

function numberOf(cell: SourceCell): number | null {
  return typeof cell.value === 'number' && Number.isFinite(cell.value) ? cell.value : null
}

function compareCells(a: SourceCell, b: SourceCell): number {
  if (a.text === '' || b.text === '') return a.text === b.text ? 0 : a.text === '' ? 1 : -1
  const an = numberOf(a)
  const bn = numberOf(b)
  if (an !== null && bn !== null) return an === bn ? 0 : an < bn ? -1 : 1
  if (an !== null) return -1
  if (bn !== null) return 1
  const ad = dateOrder(a.text)
  const bd = dateOrder(b.text)
  if (ad !== null && bd !== null) return ad === bd ? 0 : ad < bd ? -1 : 1
  return naturalCompare(a.text, b.text)
}

function compareTuples(a: SourceCell[], b: SourceCell[]): number {
  for (let i = 0; i < a.length; i++) {
    const c = compareCells(a[i], b[i])
    if (c !== 0) return c
  }
  return 0
}

// ---------------------------------------------------------------------------
// Grid construction
// ---------------------------------------------------------------------------

export interface PivotBuild {
  /** Row-major; cells[0][0] belongs at the anchor. */
  cells: Cell[][]
  height: number
  width: number
  /** Distinct row groups, before the grand-total row. */
  rowGroups: number
  colGroups: number
  /** Longest rendered text per column, for widening the columns it lands in. */
  colTextLen: number[]
  /** Set when nothing could be built; the caller shows it and writes nothing. */
  error?: string
}

/** What the grid will actually show for a built cell — the raw value put
 *  through its own number format. */
export function pivotCellText(cell: Cell): string {
  const raw = cell.v ?? ''
  if (raw === '' || !cell.style?.format) return raw
  const n = Number(raw)
  return Number.isFinite(n) ? formatValue(n, cell.style) : raw
}

interface Group {
  key: string
  cells: SourceCell[]
}

// Group keys join field values with characters no cell can hold, so the
// tuple ["A", "B"] can never collide with the single value "A B".
const KEY_SEP = '\u0000'

function groupsFor(rows: SourceCell[][], fields: number[]): Group[] {
  if (fields.length === 0) return [{ key: '', cells: [] }]
  const map = new Map<string, Group>()
  for (const row of rows) {
    const cells = fields.map((f) => row[f] ?? BLANK_CELL)
    const key = cells.map((c) => c.text).join(KEY_SEP)
    if (!map.has(key)) map.set(key, { key, cells })
  }
  const out = [...map.values()]
  out.sort((a, b) => compareTuples(a.cells, b.cells))
  return out
}

function keyOf(row: SourceCell[], fields: number[]): string {
  if (fields.length === 0) return ''
  return fields.map((f) => (row[f] ?? BLANK_CELL).text).join(KEY_SEP)
}

function dedupe(list: number[]): number[] {
  return [...new Set(list)]
}

/** Round off the float noise a division or a long sum leaves behind — the value
 *  is stored as the cell's raw text, so 0.30000000000000004 would stick. */
function numberText(n: number): string {
  if (!Number.isFinite(n)) return ''
  const r = Math.round(n * 1e10) / 1e10
  return String(r)
}

/** Labels are text, but a cell whose raw value opens with '=' is a formula. A
 *  source column holding "=SUM(A1)" — as a text result, or arriving through an
 *  import — would otherwise come back to life as a live formula inside the
 *  pivot, reading cells it was never meant to see. Escaped with a leading
 *  apostrophe, the same guard `forms/responses.ts` puts on exported CSV. */
function literalText(text: string): string {
  return text.startsWith('=') ? `'${text}` : text
}

const headerStyle = (): CellStyle => ({ bold: true, fill: HEADER_FILL, borders: { bottom: true } })

function failed(error: string): PivotBuild {
  return { cells: [], height: 0, width: 0, rowGroups: 0, colGroups: 0, colTextLen: [], error }
}

export function buildPivot(table: SourceTable, spec: PivotSpec): PivotBuild {
  const fieldCount = table.fields.length
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < fieldCount
  if (fieldCount === 0 || (table.rows.length === 0 && table.fields.every((f) => f.trim() === ''))) {
    return failed('That range is empty — there is nothing to summarise.')
  }

  const rowFields = dedupe(spec.rows.filter(inRange))
  const colFields = dedupe(spec.cols.filter(inRange)).filter((c) => !rowFields.includes(c))
  const values = spec.values.filter((v) => inRange(v.col))
  if (values.length === 0) return failed('Choose at least one field to summarise as a value.')

  const rowGroups = groupsFor(table.rows, rowFields)
  const colGroups = groupsFor(table.rows, colFields)
  if (colGroups.length > MAX_COL_GROUPS) {
    return failed(`"${fieldLabel(table, colFields[0])}" has ${colGroups.length} distinct values — too many to use as columns.`)
  }
  if (rowGroups.length > MAX_ROW_GROUPS) {
    return failed(`This pivot would be ${rowGroups.length} rows long. Narrow the source range or drop a row field.`)
  }

  const V = values.length
  const R = rowFields.length
  const C = colFields.length
  const showTotals = spec.showTotals === true

  // One accumulator per (row group, column group, value field), plus the
  // margins the grand totals read from.
  const cellAccs = new Map<string, Acc[]>()
  const rowMargin = new Map<string, Acc[]>()
  const colMargin = new Map<string, Acc[]>()
  const grand = values.map(() => newAcc())
  const bucket = (m: Map<string, Acc[]>, key: string): Acc[] => {
    let a = m.get(key)
    if (!a) {
      a = values.map(() => newAcc())
      m.set(key, a)
    }
    return a
  }
  for (const row of table.rows) {
    const rk = keyOf(row, rowFields)
    const ck = keyOf(row, colFields)
    const cellA = bucket(cellAccs, rk + '\u0001' + ck)
    const rowA = bucket(rowMargin, rk)
    const colA = bucket(colMargin, ck)
    for (let vi = 0; vi < V; vi++) {
      const cell = row[values[vi].col] ?? BLANK_CELL
      accPush(cellA[vi], cell)
      accPush(rowA[vi], cell)
      accPush(colA[vi], cell)
      accPush(grand[vi], cell)
    }
  }

  const valueStyles: CellStyle[] = values.map((v) => {
    const counted = v.agg === 'count' || v.agg === 'countUnique'
    const fmt = counted ? undefined : table.formats[v.col]
    return { align: 'right', ...(fmt ?? {}) }
  })
  // A missing bucket means no source row landed in that intersection at all, so
  // the cell stays blank — unlike a group whose rows held no numbers, where a
  // sum of 0 is the honest answer.
  const valueCell = (accs: Acc[] | undefined, vi: number, extra?: CellStyle): Cell => {
    const n = accs ? accResult(accs[vi], values[vi].agg) : null
    return { v: n === null ? '' : numberText(n), style: { ...valueStyles[vi], ...extra } }
  }

  const totalCols = showTotals && C > 0 ? V : 0
  const width = R + colGroups.length * V + totalCols
  const headerRows = C > 0 ? C + (V > 1 || R > 0 ? 1 : 0) : 1
  const totalRows = showTotals && R > 0 ? 1 : 0
  const height = headerRows + rowGroups.length + totalRows

  // Grouping only by columns, with no data rows to make columns out of, leaves
  // nothing but a corner: a block zero cells wide that would be "created"
  // without a single cell reaching the sheet.
  if (width === 0) return failed('That range has no data rows to summarise.')
  if (width * height > MAX_PIVOT_CELLS) {
    return failed(`This pivot would be ${height} rows by ${width} columns — too big to build. Narrow the source range or drop a field.`)
  }

  const cells: Cell[][] = []
  for (let r = 0; r < height; r++) {
    const line: Cell[] = new Array(width)
    for (let c = 0; c < width; c++) line[c] = { v: '' }
    cells.push(line)
  }
  const put = (r: number, c: number, raw: string, style?: CellStyle) => {
    const v = literalText(raw)
    cells[r][c] = style ? { v, style } : { v }
  }

  // ---- headers ----
  for (let r = 0; r < headerRows; r++) {
    for (let c = 0; c < width; c++) put(r, c, '', headerStyle())
  }
  if (C === 0) {
    rowFields.forEach((f, i) => put(0, i, fieldLabel(table, f), headerStyle()))
    values.forEach((v, vi) => put(0, R + vi, valueLabel(table, v), { ...headerStyle(), align: 'right' }))
  } else {
    for (let level = 0; level < C; level++) {
      // Each column field is named in the corner beside its own row of labels.
      // With no row fields there is no corner, and the name has to go.
      if (R > 0) put(level, 0, fieldLabel(table, colFields[level]), headerStyle())
      let prev: string | null = null
      colGroups.forEach((g, gi) => {
        const prefix = g.cells.slice(0, level + 1).map((c) => c.text).join(KEY_SEP)
        if (prefix !== prev) {
          const label = g.cells[level].text
          put(level, R + gi * V, label === '' ? BLANK_LABEL : label, headerStyle())
          prev = prefix
        }
      })
      if (totalCols > 0 && level === C - 1) {
        put(level, R + colGroups.length * V, TOTAL_LABEL, { ...headerStyle(), fill: TOTAL_FILL })
      }
    }
    const last = headerRows - 1
    if (last >= C) {
      rowFields.forEach((f, i) => put(last, i, fieldLabel(table, f), headerStyle()))
      if (V > 1) {
        for (let gi = 0; gi < colGroups.length; gi++) {
          values.forEach((v, vi) => put(last, R + gi * V + vi, valueLabel(table, v), { ...headerStyle(), align: 'right' }))
        }
        if (totalCols > 0) {
          values.forEach((v, vi) =>
            put(last, R + colGroups.length * V + vi, valueLabel(table, v), { ...headerStyle(), align: 'right', fill: TOTAL_FILL }),
          )
        }
      }
    }
  }

  // ---- body ----
  // Row labels repeat on every line instead of being blanked out under their
  // group: the block is ordinary cells, and a user who sorts or exports it
  // needs each row to stand on its own.
  rowGroups.forEach((rg, gi) => {
    const r = headerRows + gi
    rg.cells.forEach((c, i) => put(r, i, c.text === '' ? BLANK_LABEL : c.text))
    colGroups.forEach((cg, ci) => {
      const accs = cellAccs.get(rg.key + '\u0001' + cg.key)
      for (let vi = 0; vi < V; vi++) cells[r][R + ci * V + vi] = valueCell(accs, vi)
    })
    if (totalCols > 0) {
      const accs = rowMargin.get(rg.key)
      for (let vi = 0; vi < V; vi++) {
        cells[r][R + colGroups.length * V + vi] = valueCell(accs, vi, { bold: true, fill: TOTAL_FILL })
      }
    }
  })

  // ---- grand total row ----
  if (totalRows > 0) {
    const r = height - 1
    const labelStyle: CellStyle = { bold: true, fill: TOTAL_FILL, borders: { top: true } }
    for (let i = 0; i < R; i++) put(r, i, i === 0 ? TOTAL_LABEL : '', labelStyle)
    colGroups.forEach((cg, ci) => {
      const accs = colMargin.get(cg.key)
      for (let vi = 0; vi < V; vi++) {
        cells[r][R + ci * V + vi] = valueCell(accs, vi, { bold: true, fill: TOTAL_FILL, borders: { top: true } })
      }
    })
    // No source rows at all reads as blank, matching every other margin cell —
    // only a group that held rows without numbers totals to zero.
    const grandAccs = table.rows.length > 0 ? grand : undefined
    if (totalCols > 0) {
      for (let vi = 0; vi < V; vi++) {
        cells[r][R + colGroups.length * V + vi] = valueCell(grandAccs, vi, {
          bold: true,
          fill: TOTAL_FILL,
          borders: { top: true },
        })
      }
    }
  }

  const colTextLen = new Array(width).fill(0)
  for (const line of cells) {
    for (let c = 0; c < width; c++) colTextLen[c] = Math.max(colTextLen[c], pivotCellText(line[c]).length)
  }

  return { cells, height, width, rowGroups: rowGroups.length, colGroups: colGroups.length, colTextLen }
}

// ---------------------------------------------------------------------------
// Placing the block in a sheet
// ---------------------------------------------------------------------------

export interface PivotRect {
  r0: number
  c0: number
  r1: number
  c1: number
}

/** Whether `anchor` names a real cell. Without this the block has nowhere to
 *  go: every write is silently skipped and the pivot reports success. */
export function anchorValid(anchor: string): boolean {
  return parseCellRef(anchor) !== null
}

export function anchorPos(spec: PivotSpec): { row: number; col: number } | null {
  const p = parseCellRef(spec.anchor)
  return p ? { row: p.row, col: p.col } : null
}

export function pivotRect(spec: PivotSpec, build: PivotBuild): PivotRect | null {
  const at = anchorPos(spec)
  if (!at || build.height === 0) return null
  return { r0: at.row, c0: at.col, r1: at.row + build.height - 1, c1: at.col + build.width - 1 }
}

function hasContent(sheet: Sheet, row: number, col: number): boolean {
  const v = sheet.cells[refToString(col, row)]?.v
  return v !== undefined && v !== ''
}

/** Refs inside the target block that already hold something. A pivot never
 *  writes over a user's data — the caller refuses and offers a new sheet. */
export function pivotConflicts(sheet: Sheet, spec: PivotSpec, build: PivotBuild): string[] {
  const rect = pivotRect(spec, build)
  if (!rect) return []
  const out: string[] = []
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      if (hasContent(sheet, r, c)) out.push(refToString(c, r))
    }
  }
  return out
}

/** The contiguous non-empty block starting at the anchor — how much a previous
 *  refresh wrote. PivotSpec has nowhere to record the last size, and the scan
 *  stops at the first fully-blank row/column, so a pivot with a blank gutter
 *  around it can never eat its neighbours. */
function occupiedBlock(sheet: Sheet, row: number, col: number): { height: number; width: number } {
  let height = 0
  while (height < MAX_SCAN && hasContent(sheet, row + height, col)) height++
  if (height === 0) return { height: 0, width: 0 }
  let width = 1
  while (width < MAX_SCAN) {
    let any = false
    for (let r = row; r < row + height && !any; r++) any = hasContent(sheet, r, col + width)
    if (!any) break
    width++
  }
  return { height, width }
}

/** Cells a refresh would newly write over: anything inside the rebuilt block
 *  that wasn't part of the block already there. A pivot that has grown since
 *  last time must not take its neighbours' cells with it. */
export function refreshConflicts(sheet: Sheet, spec: PivotSpec, build: PivotBuild): string[] {
  const at = anchorPos(spec)
  if (!at || build.height === 0) return []
  const old = occupiedBlock(sheet, at.row, at.col)
  const out: string[] = []
  for (let r = 0; r < build.height; r++) {
    for (let c = 0; c < build.width; c++) {
      if (r < old.height && c < old.width) continue
      if (hasContent(sheet, at.row + r, at.col + c)) out.push(refToString(at.col + c, at.row + r))
    }
  }
  return out
}

/** A pivot styles everything it writes: filled headers and totals, right-aligned
 *  values. Row labels are the exception, but they never sit alone — every line
 *  of the block carries at least one value cell beside them. */
function pivotStyled(sheet: Sheet, col: number, row: number): boolean {
  const st = sheet.cells[refToString(col, row)]?.style
  return !!st && (st.align === 'right' || st.fill === HEADER_FILL || st.fill === TOTAL_FILL)
}

function staleRow(sheet: Sheet, row: number, col: number, width: number): boolean {
  for (let c = 0; c < width; c++) if (pivotStyled(sheet, col + c, row)) return true
  return false
}

function staleCol(sheet: Sheet, col: number, row: number, height: number): boolean {
  for (let r = 0; r < height; r++) if (pivotStyled(sheet, col, row + r)) return true
  return false
}

/** Cell patch that lays the block down and clears whatever the last refresh
 *  left behind, so a pivot that shrinks doesn't leave a tail of stale rows.
 *
 *  The occupied-block scan cannot tell the pivot's own leftovers from a column
 *  of notes someone parked flush underneath — both read as one contiguous
 *  block. So the tail is walked out only as far as it still looks like the
 *  pivot wrote it: a missing gutter costs a stale row rather than everything
 *  the scan ran into. */
export function pivotPatch(sheet: Sheet, spec: PivotSpec, build: PivotBuild): Record<string, Cell | null> {
  const at = anchorPos(spec)
  const patch: Record<string, Cell | null> = {}
  if (!at || build.height === 0) return patch
  const old = occupiedBlock(sheet, at.row, at.col)
  const scanW = Math.max(build.width, old.width)
  let h = build.height
  while (h < old.height && staleRow(sheet, at.row + h, at.col, scanW)) h++
  let w = build.width
  while (w < old.width && staleCol(sheet, at.col + w, at.row, h)) w++
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ref = refToString(at.col + c, at.row + r)
      const cell = r < build.height && c < build.width ? build.cells[r][c] : null
      patch[ref] = cell && (cell.v !== '' || cell.style) ? cell : null
    }
  }
  return patch
}

// Rough autofit: the grid has no text measurement here, and a clipped
// "Sum of Budgeted" is worse than a column a few pixels too wide.
const CHAR_W = 7.4
const CELL_PAD = 22
const MAX_PIVOT_COL_W = 240

/** Column widths for the target sheet with the pivot's columns widened enough
 *  to show their headers. Only ever grows a column — a user who narrowed one
 *  keeps their width unless the content no longer fits at all. */
export function pivotColWidths(sheet: Sheet, spec: PivotSpec, build: PivotBuild): Record<number, number> {
  const at = anchorPos(spec)
  const out = { ...sheet.colWidths }
  if (!at || build.height === 0) return out
  build.colTextLen.forEach((len, i) => {
    const want = Math.min(MAX_PIVOT_COL_W, Math.ceil(len * CHAR_W) + CELL_PAD)
    const col = at.col + i
    if (want > (sheet.colWidths[col] ?? DEFAULT_COL_W)) out[col] = want
  })
  return out
}

/** Default anchor for a new pivot: two columns clear of the source range. */
export function suggestAnchor(ref: SourceRef): string {
  return refToString(ref.c1 + 2, ref.r0)
}

/** What the builder opens with: group by the first mostly-textual column,
 *  summarise the first mostly-numeric one. Wrong often enough to need the
 *  pickers, right often enough to save a step. */
export function suggestFields(table: SourceTable): { rows: number[]; values: PivotSpec['values'] } {
  const numeric = table.fields.map((_, i) => table.rows.filter((r) => typeof r[i]?.value === 'number').length)
  const half = table.rows.length / 2
  const label = table.fields.findIndex((_, i) => numeric[i] <= half)
  const measure = table.fields.findIndex((_, i) => i !== label && numeric[i] > half)
  return {
    rows: label >= 0 ? [label] : [],
    values: measure >= 0 ? [{ col: measure, agg: 'sum' }] : [],
  }
}
