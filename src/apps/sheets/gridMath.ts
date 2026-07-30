// Pure layout math for the grid: cumulative row/col offsets (for virtualization
// and overlay positioning), used-range detection, and column label helpers.

import type { Sheet } from '../../shared/types'
import { colToLetters, parseCellRef } from './engine/refs'
import { DEFAULT_COL_W, DEFAULT_ROW_H } from './types'

export function colLabel(col: number): string {
  return colToLetters(col)
}

/** Cumulative pixel offsets for `count` tracks, given per-index size overrides. */
export function buildOffsets(count: number, sizes: Record<number, number>, dflt: number): number[] {
  const out = new Array(count + 1)
  out[0] = 0
  for (let i = 0; i < count; i++) {
    const size = sizes[i] ?? dflt
    out[i + 1] = out[i] + Math.max(4, size)
  }
  return out
}

/** Cumulative pixel offsets for `count` tracks, given a per-index size function
 *  (used so hidden/live-resize sizing stays the single source of truth for both
 *  cell rendering and offset-based virtualization/overlay math). */
export function buildOffsetsFromSizer(count: number, sizer: (i: number) => number): number[] {
  const out = new Array(count + 1)
  out[0] = 0
  for (let i = 0; i < count; i++) out[i + 1] = out[i] + Math.max(0, sizer(i))
  return out
}

/** Binary search: index of the track containing pixel position `pos`. */
export function indexAtOffset(offsets: number[], pos: number): number {
  let lo = 0
  let hi = offsets.length - 2
  if (pos <= offsets[0]) return 0
  if (pos >= offsets[offsets.length - 1]) return hi
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] <= pos && pos < offsets[mid + 1]) return mid
    if (offsets[mid] > pos) hi = mid - 1
    else lo = mid + 1
  }
  return Math.max(0, Math.min(hi, offsets.length - 2))
}

/** Highest populated row/col index (0-based) across all cells + charts, or -1 if empty. */
export function usedRange(sheet: Sheet): { maxRow: number; maxCol: number } {
  let maxRow = -1
  let maxCol = -1
  for (const key of Object.keys(sheet.cells)) {
    const cell = sheet.cells[key]
    if (!cell || cell.v === undefined || cell.v === '') continue
    const p = parseCellRef(key)
    if (!p) continue
    if (p.row > maxRow) maxRow = p.row
    if (p.col > maxCol) maxCol = p.col
  }
  return { maxRow, maxCol }
}

export function colWidthOf(sheet: Sheet, col: number): number {
  return sheet.colWidths[col] ?? DEFAULT_COL_W
}

export function rowHeightOf(sheet: Sheet, row: number): number {
  return sheet.rowHeights[row] ?? DEFAULT_ROW_H
}
