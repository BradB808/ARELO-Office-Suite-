// Generic "A1:C3"-style range shifting for row/col insert & delete — shared by
// CondRule.range, Validation.range, and SheetFilter.range so conditional
// formats, dropdown validations, and column filters stay aligned with their
// data the same way sheet.merges already does (see merge.ts, whose
// shiftMergesForRow/ColInsert/Delete this mirrors).

import { parseMergeRange, mergeRangeStr } from './merge'

export function shiftRangeForRowInsert(range: string, pivot: number): string {
  const r = parseMergeRange(range)
  if (!r) return range
  let { r0, r1 } = r
  if (pivot <= r0) {
    r0++
    r1++
  } else if (pivot <= r1) {
    r1++ // insertion lands inside the range — grow it to include the new row
  }
  return mergeRangeStr({ r0, c0: r.c0, r1, c1: r.c1 })
}

export function shiftRangeForColInsert(range: string, pivot: number): string {
  const r = parseMergeRange(range)
  if (!r) return range
  let { c0, c1 } = r
  if (pivot <= c0) {
    c0++
    c1++
  } else if (pivot <= c1) {
    c1++
  }
  return mergeRangeStr({ r0: r.r0, c0, r1: r.r1, c1 })
}

/** null means every row in the range was deleted — caller drops the rule/validation/filter. */
export function shiftRangeForRowDelete(range: string, rows: number[]): string | null {
  const r = parseMergeRange(range)
  if (!r) return range
  const dropped = new Set(rows)
  const sorted = rows.slice().sort((a, b) => a - b)
  const shift = (row: number) => row - sorted.filter((d) => d < row).length
  const survive: number[] = []
  for (let ri = r.r0; ri <= r.r1; ri++) if (!dropped.has(ri)) survive.push(ri)
  if (!survive.length) return null
  return mergeRangeStr({ r0: shift(survive[0]), c0: r.c0, r1: shift(survive[survive.length - 1]), c1: r.c1 })
}

/** null means every column in the range was deleted — caller drops the rule/validation/filter. */
export function shiftRangeForColDelete(range: string, cols: number[]): string | null {
  const r = parseMergeRange(range)
  if (!r) return range
  const dropped = new Set(cols)
  const sorted = cols.slice().sort((a, b) => a - b)
  const shift = (col: number) => col - sorted.filter((d) => d < col).length
  const survive: number[] = []
  for (let ci = r.c0; ci <= r.c1; ci++) if (!dropped.has(ci)) survive.push(ci)
  if (!survive.length) return null
  return mergeRangeStr({ r0: r.r0, c0: shift(survive[0]), r1: r.r1, c1: shift(survive[survive.length - 1]) })
}
