// Row/column hide-unhide helpers. Hidden indices collapse to zero size in the
// grid but stay fully live for formulas — this module only touches the
// hiddenRows/hiddenCols index lists, never cell data.

import type { Sheet } from '../../shared/types'

export function isRowHidden(sheet: Sheet, row: number): boolean {
  return !!sheet.hiddenRows?.includes(row)
}

export function isColHidden(sheet: Sheet, col: number): boolean {
  return !!sheet.hiddenCols?.includes(col)
}

export function hideRows(sheet: Sheet, rows: number[]): Sheet {
  const set = new Set([...(sheet.hiddenRows ?? []), ...rows])
  return { ...sheet, hiddenRows: Array.from(set).sort((a, b) => a - b) }
}

export function hideCols(sheet: Sheet, cols: number[]): Sheet {
  const set = new Set([...(sheet.hiddenCols ?? []), ...cols])
  return { ...sheet, hiddenCols: Array.from(set).sort((a, b) => a - b) }
}

export function unhideRows(sheet: Sheet, rows: number[]): Sheet {
  const drop = new Set(rows)
  return { ...sheet, hiddenRows: (sheet.hiddenRows ?? []).filter((r) => !drop.has(r)) }
}

export function unhideCols(sheet: Sheet, cols: number[]): Sheet {
  const drop = new Set(cols)
  return { ...sheet, hiddenCols: (sheet.hiddenCols ?? []).filter((c) => !drop.has(c)) }
}

// ---------------------------------------------------------------------------
// Keep hiddenRows/hiddenCols consistent across row/col insert & delete.
// ---------------------------------------------------------------------------

export function shiftHiddenForInsert(indices: number[] | undefined, pivot: number): number[] | undefined {
  if (!indices || !indices.length) return indices
  return indices.map((i) => (i >= pivot ? i + 1 : i))
}

export function shiftHiddenForDelete(indices: number[] | undefined, deleted: number[]): number[] | undefined {
  if (!indices || !indices.length) return indices
  const drop = new Set(deleted)
  const sorted = deleted.slice().sort((a, b) => a - b)
  const shift = (i: number) => i - sorted.filter((d) => d < i).length
  return indices.filter((i) => !drop.has(i)).map(shift)
}
