// Local UI types & layout constants for the Sheets grid (not part of the
// persisted document model — see shared/types.ts for that).

export const DEFAULT_COLS = 26
export const DEFAULT_ROWS = 200
export const DEFAULT_COL_W = 100
export const DEFAULT_ROW_H = 24
export const ROW_HEADER_W = 46
export const COL_HEADER_H = 26
export const GROW_ROWS = 100
export const GROW_COLS = 26
export const EDGE_PAD = 12
export const MIN_COL_W = 40
export const MIN_ROW_H = 18

export interface CellPos {
  row: number
  col: number
}

export interface SelRect {
  r0: number
  c0: number
  r1: number
  c1: number
}

export function normalizeSel(a: CellPos, b: CellPos): SelRect {
  return {
    r0: Math.min(a.row, b.row),
    c0: Math.min(a.col, b.col),
    r1: Math.max(a.row, b.row),
    c1: Math.max(a.col, b.col),
  }
}

export function selContains(sel: SelRect, row: number, col: number): boolean {
  return row >= sel.r0 && row <= sel.r1 && col >= sel.c0 && col <= sel.c1
}

export function selEquals(a: SelRect, b: SelRect): boolean {
  return a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1
}

export type ClipboardKind = 'copy' | 'cut'

export interface ClipboardPayload {
  kind: ClipboardKind
  cells: { v?: string; style?: import('../../shared/types').CellStyle }[][]
  rows: number
  cols: number
  origin: CellPos
}
