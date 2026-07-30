// Pure merged-cell model helpers: parsing/stringifying "A1:C2" ranges,
// containment lookups, and the merge/unmerge/snap operations shared by
// SheetsApp (commits) and Grid (rendering + navigation).

import type { Sheet } from '../../shared/types'
import { parseCellRef, refToString } from './engine/refs'
import type { SelRect } from './types'

export function parseMergeRange(s: string): SelRect | null {
  const parts = s.split(':')
  if (parts.length !== 2) return null
  const pa = parseCellRef(parts[0])
  const pb = parseCellRef(parts[1])
  if (!pa || !pb) return null
  return {
    r0: Math.min(pa.row, pb.row),
    c0: Math.min(pa.col, pb.col),
    r1: Math.max(pa.row, pb.row),
    c1: Math.max(pa.col, pb.col),
  }
}

export function mergeRangeStr(r: SelRect): string {
  return `${refToString(r.c0, r.r0)}:${refToString(r.c1, r.r1)}`
}

function rectsOverlap(a: SelRect, b: SelRect): boolean {
  return a.r0 <= b.r1 && a.r1 >= b.r0 && a.c0 <= b.c1 && a.c1 >= b.c0
}

function unionRect(a: SelRect, b: SelRect): SelRect {
  return { r0: Math.min(a.r0, b.r0), c0: Math.min(a.c0, b.c0), r1: Math.max(a.r1, b.r1), c1: Math.max(a.c1, b.c1) }
}

/** The merge rect covering (row,col), or the trivial 1x1 rect at (row,col) when it isn't merged. */
export function mergeSpanAt(merges: string[] | undefined, row: number, col: number): SelRect {
  if (merges) {
    for (const m of merges) {
      const r = parseMergeRange(m)
      if (r && row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1) return r
    }
  }
  return { r0: row, c0: col, r1: row, c1: col }
}

/** True when (row,col) is part of a merge but is not that merge's top-left cell. */
export function isMergeCovered(merges: string[] | undefined, row: number, col: number): boolean {
  const span = mergeSpanAt(merges, row, col)
  return span.r0 !== row || span.c0 !== col
}

/** Expands `sel` to fully contain every merge it touches (fixpoint, handles chained merges). */
export function snapSelToMerges(merges: string[] | undefined, sel: SelRect): SelRect {
  if (!merges || !merges.length) return sel
  let rect = sel
  let changed = true
  while (changed) {
    changed = false
    for (const m of merges) {
      const r = parseMergeRange(m)
      if (!r || !rectsOverlap(rect, r)) continue
      const next = unionRect(rect, r)
      if (next.r0 !== rect.r0 || next.c0 !== rect.c0 || next.r1 !== rect.r1 || next.c1 !== rect.c1) {
        rect = next
        changed = true
      }
    }
  }
  return rect
}

export function mergesIntersectRect(merges: string[] | undefined, rect: SelRect): boolean {
  if (!merges) return false
  return merges.some((m) => {
    const r = parseMergeRange(m)
    return r ? rectsOverlap(rect, r) : false
  })
}

export function mergesIntersectRows(merges: string[] | undefined, rows: number[]): boolean {
  if (!merges || !rows.length) return false
  const set = new Set(rows)
  return merges.some((m) => {
    const r = parseMergeRange(m)
    if (!r) return false
    for (let ri = r.r0; ri <= r.r1; ri++) if (set.has(ri)) return true
    return false
  })
}

export function mergesIntersectCols(merges: string[] | undefined, cols: number[]): boolean {
  if (!merges || !cols.length) return false
  const set = new Set(cols)
  return merges.some((m) => {
    const r = parseMergeRange(m)
    if (!r) return false
    for (let ci = r.c0; ci <= r.c1; ci++) if (set.has(ci)) return true
    return false
  })
}

/**
 * Merges `sel`, absorbing any existing merges it overlaps into one range.
 * Keeps the resulting top-left cell's value/style; clears every other covered cell.
 */
export function applyMerge(sheet: Sheet, sel: SelRect): Sheet {
  const existing = sheet.merges ?? []
  let rect = sel
  let remaining = existing.slice()
  let changed = true
  while (changed) {
    changed = false
    const next: string[] = []
    for (const m of remaining) {
      const r = parseMergeRange(m)
      if (r && rectsOverlap(rect, r)) {
        rect = unionRect(rect, r)
        changed = true
      } else {
        next.push(m)
      }
    }
    remaining = next
  }

  const cells = { ...sheet.cells }
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      if (r === rect.r0 && c === rect.c0) continue
      delete cells[refToString(c, r)]
    }
  }
  return { ...sheet, cells, merges: [...remaining, mergeRangeStr(rect)] }
}

/** Removes every merge that overlaps `sel`. */
export function applyUnmerge(sheet: Sheet, sel: SelRect): Sheet {
  const existing = sheet.merges ?? []
  const next = existing.filter((m) => {
    const r = parseMergeRange(m)
    return !(r && rectsOverlap(sel, r))
  })
  if (next.length === existing.length) return sheet
  return { ...sheet, merges: next }
}

// ---------------------------------------------------------------------------
// Row/column insert & delete keep merges consistent (existing ops predate the
// merge model, so every insertRowAt/insertColAt/deleteRowsAt/deleteColsAt call
// site re-maps merges through these alongside the cell-ref shifting it already did).
// ---------------------------------------------------------------------------

export function shiftMergesForRowInsert(merges: string[] | undefined, pivot: number): string[] | undefined {
  if (!merges || !merges.length) return merges
  return merges.map((m) => {
    const r = parseMergeRange(m)
    if (!r) return m
    let { r0, r1 } = r
    if (pivot <= r0) {
      r0++
      r1++
    } else if (pivot <= r1) {
      r1++ // insertion lands inside the merge — grow it to include the new row
    }
    return mergeRangeStr({ r0, c0: r.c0, r1, c1: r.c1 })
  })
}

export function shiftMergesForColInsert(merges: string[] | undefined, pivot: number): string[] | undefined {
  if (!merges || !merges.length) return merges
  return merges.map((m) => {
    const r = parseMergeRange(m)
    if (!r) return m
    let { c0, c1 } = r
    if (pivot <= c0) {
      c0++
      c1++
    } else if (pivot <= c1) {
      c1++
    }
    return mergeRangeStr({ r0: r.r0, c0, r1: r.r1, c1 })
  })
}

export function shiftMergesForRowDelete(merges: string[] | undefined, rows: number[]): string[] | undefined {
  if (!merges || !merges.length) return merges
  const dropped = new Set(rows)
  const sorted = rows.slice().sort((a, b) => a - b)
  const shift = (row: number) => row - sorted.filter((d) => d < row).length
  const out: string[] = []
  for (const m of merges) {
    const r = parseMergeRange(m)
    if (!r) continue
    const survive: number[] = []
    for (let ri = r.r0; ri <= r.r1; ri++) if (!dropped.has(ri)) survive.push(ri)
    if (!survive.length) continue // the whole merge was deleted
    const r0 = shift(survive[0])
    const r1 = shift(survive[survive.length - 1])
    if (r0 === r1 && r.c0 === r.c1) continue // collapsed to a single cell — not a merge anymore
    out.push(mergeRangeStr({ r0, c0: r.c0, r1, c1: r.c1 }))
  }
  return out
}

export function shiftMergesForColDelete(merges: string[] | undefined, cols: number[]): string[] | undefined {
  if (!merges || !merges.length) return merges
  const dropped = new Set(cols)
  const sorted = cols.slice().sort((a, b) => a - b)
  const shift = (col: number) => col - sorted.filter((d) => d < col).length
  const out: string[] = []
  for (const m of merges) {
    const r = parseMergeRange(m)
    if (!r) continue
    const survive: number[] = []
    for (let ci = r.c0; ci <= r.c1; ci++) if (!dropped.has(ci)) survive.push(ci)
    if (!survive.length) continue
    const c0 = shift(survive[0])
    const c1 = shift(survive[survive.length - 1])
    if (c0 === c1 && r.r0 === r.r1) continue
    out.push(mergeRangeStr({ r0: r.r0, c0, r1: r.r1, c1 }))
  }
  return out
}

export type StepDir = 'up' | 'down' | 'left' | 'right'

/** Steps from (row,col) past the far edge of its current merge span (a no-op span for unmerged cells). */
export function stepPastSpan(merges: string[] | undefined, row: number, col: number, dir: StepDir): { row: number; col: number } {
  const span = mergeSpanAt(merges, row, col)
  switch (dir) {
    case 'down':
      return { row: span.r1 + 1, col }
    case 'up':
      return { row: span.r0 - 1, col }
    case 'right':
      return { row, col: span.c1 + 1 }
    case 'left':
      return { row, col: span.c0 - 1 }
  }
}

/**
 * Like stepPastSpan, but also keeps stepping past hidden rows/cols so keyboard
 * navigation (arrows/Tab/Enter) never parks the cursor on an invisible cell —
 * it lands on the next VISIBLE cell in that direction (or runs off the grid
 * edge, clamped by the caller same as stepPastSpan's result always was).
 */
export function stepPastSpanSkippingHidden(
  merges: string[] | undefined,
  hiddenRows: Set<number> | undefined,
  hiddenCols: Set<number> | undefined,
  row: number,
  col: number,
  dir: StepDir,
  rowCount: number,
  colCount: number,
): { row: number; col: number } {
  let pos = stepPastSpan(merges, row, col, dir)
  let guard = 0
  const maxGuard = rowCount + colCount + 4
  while (
    pos.row >= 0 &&
    pos.row < rowCount &&
    pos.col >= 0 &&
    pos.col < colCount &&
    ((hiddenRows?.has(pos.row) ?? false) || (hiddenCols?.has(pos.col) ?? false)) &&
    guard < maxGuard
  ) {
    pos = stepPastSpan(merges, pos.row, pos.col, dir)
    guard++
  }
  return pos
}
