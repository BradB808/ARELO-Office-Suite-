// Column value filter helpers. sheet.filter.range's first row is the header;
// excluded[colOffset] lists the computed display VALUES hidden for that
// column. Pure functions — the render pipeline (Grid) owns the popover UI.

import type { Sheet, SheetFilter } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { refToString } from './engine/refs'
import { parseMergeRange } from './merge'
import { shiftRangeForColDelete, shiftRangeForColInsert } from './rangeShift'
import type { SelRect } from './types'

/** The filter range's rectangular bounds, or null when unset/unparseable. */
export function filterBoundsOf(sheet: Sheet): SelRect | null {
  return sheet.filter ? parseMergeRange(sheet.filter.range) : null
}

/** Distinct computed display values in the filter's data rows (header excluded) for one column offset. */
export function columnDistinctValues(sheet: Sheet, computed: Map<string, ComputedCell>, colOffset: number): string[] {
  const bounds = filterBoundsOf(sheet)
  if (!bounds) return []
  const col = bounds.c0 + colOffset
  if (col > bounds.c1) return []
  const seen = new Set<string>()
  for (let r = bounds.r0 + 1; r <= bounds.r1; r++) {
    seen.add(computed.get(refToString(col, r))?.display ?? '')
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

/** Data rows (never the header row) hidden because some column's value is excluded. One pass over the range, precomputed once per render. */
export function computeFilterHiddenRows(sheet: Sheet, computed: Map<string, ComputedCell>): Set<number> {
  const hidden = new Set<number>()
  const filter = sheet.filter
  const bounds = filterBoundsOf(sheet)
  if (!filter || !bounds) return hidden
  const active = Object.entries(filter.excluded).filter(([, vals]) => vals && vals.length)
  if (!active.length) return hidden
  for (let r = bounds.r0 + 1; r <= bounds.r1; r++) {
    for (const [offsetStr, excludedVals] of active) {
      const col = bounds.c0 + Number(offsetStr)
      if (col > bounds.c1) continue
      const disp = computed.get(refToString(col, r))?.display ?? ''
      if (excludedVals.includes(disp)) {
        hidden.add(r)
        break
      }
    }
  }
  return hidden
}

// ---------------------------------------------------------------------------
// Column insert/delete: excluded is keyed by COLUMN OFFSET from the range's
// c0, so a column insert/delete inside the range doesn't just re-stamp the
// range string (like row edits do) — it also has to re-key every offset so
// each exclusion keeps pointing at the same physical column.
// ---------------------------------------------------------------------------

export function shiftFilterForColInsert(filter: SheetFilter, pivot: number): SheetFilter {
  const bounds = parseMergeRange(filter.range)
  const nextRange = shiftRangeForColInsert(filter.range, pivot)
  if (!bounds || pivot <= bounds.c0 || pivot > bounds.c1) return { ...filter, range: nextRange }
  const cut = pivot - bounds.c0
  const excluded: Record<number, string[]> = {}
  for (const [k, vals] of Object.entries(filter.excluded)) {
    const offset = Number(k)
    excluded[offset >= cut ? offset + 1 : offset] = vals
  }
  return { range: nextRange, excluded }
}

/** null means the whole filter range was deleted — caller drops the filter. */
export function shiftFilterForColDelete(filter: SheetFilter, cols: number[]): SheetFilter | null {
  const bounds = parseMergeRange(filter.range)
  const nextRange = shiftRangeForColDelete(filter.range, cols)
  if (!nextRange) return null
  const newBounds = bounds ? parseMergeRange(nextRange) : null
  if (!bounds || !newBounds) return { ...filter, range: nextRange }
  const dropped = new Set(cols)
  const sorted = cols.slice().sort((a, b) => a - b)
  const shift = (col: number) => col - sorted.filter((d) => d < col).length
  const excluded: Record<number, string[]> = {}
  for (const [k, vals] of Object.entries(filter.excluded)) {
    const absCol = bounds.c0 + Number(k)
    if (dropped.has(absCol)) continue
    excluded[shift(absCol) - newBounds.c0] = vals
  }
  return { range: nextRange, excluded }
}
