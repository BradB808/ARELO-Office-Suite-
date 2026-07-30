// Fill-handle logic: drag-extend a selection down/right/up/left.
// - Formula cells copy with relative refs shifted by the exact (row,col) delta.
// - A source line with 2+ numeric cells extrapolates a linear series.
// - Anything else copies the source pattern cyclically.

import type { Sheet, Cell } from '../../shared/types'
import { isFormula, shiftFormula } from './engine/formula'
import { parseCellRef, refToString } from './engine/refs'
import type { SelRect } from './types'

interface LineCell {
  ref: string
  cell: Cell | undefined
}

function numericOf(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null
  if (isFormula(raw)) return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function fillLine(
  source: LineCell[],
  destRefAt: (k: number) => string,
  count: number,
  forward: boolean,
  patch: Record<string, Cell | null>,
) {
  const n = source.length
  if (n === 0 || count <= 0) return

  const numeric = source.map((s) => numericOf(s.cell?.v))
  const numericIdx: number[] = []
  numeric.forEach((v, i) => {
    if (v !== null) numericIdx.push(i)
  })
  const isSeries = numericIdx.length >= 2
  let step = 0
  let firstIdx = 0
  let firstVal = 0
  if (isSeries) {
    firstIdx = numericIdx[0]
    const lastIdx = numericIdx[numericIdx.length - 1]
    firstVal = numeric[firstIdx]!
    const lastVal = numeric[lastIdx]!
    step = lastIdx === firstIdx ? 0 : (lastVal - firstVal) / (lastIdx - firstIdx)
  }

  for (let step_i = 0; step_i < count; step_i++) {
    // Conceptual index in the infinite sequence: source occupies [0, n-1].
    const seqIndex = forward ? n + step_i : -1 - step_i
    const k = step_i
    const destRef = destRefAt(k)
    const templateIdx = ((seqIndex % n) + n) % n
    const template = source[templateIdx]

    if (template.cell?.v !== undefined && isFormula(template.cell.v)) {
      const tp = parseCellRef(template.ref)!
      const dp = parseCellRef(destRef)!
      const dCol = dp.col - tp.col
      const dRow = dp.row - tp.row
      patch[destRef] = { v: shiftFormula(template.cell.v, dCol, dRow), style: template.cell.style }
      continue
    }

    if (isSeries) {
      const value = firstVal + step * (seqIndex - firstIdx)
      const style = template.cell?.style
      patch[destRef] = style ? { v: trimNum(value), style } : { v: trimNum(value) }
      continue
    }

    if (!template.cell || (template.cell.v === undefined && !template.cell.style)) {
      patch[destRef] = null
    } else {
      patch[destRef] = { v: template.cell.v, style: template.cell.style }
    }
  }
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e10) / 1e10)
}

/** dest must extend src in exactly one direction. Returns a patch: ref -> Cell (set) or null (clear). */
export function computeFillPatch(sheet: Sheet, src: SelRect, dest: SelRect): Record<string, Cell | null> {
  const patch: Record<string, Cell | null> = {}
  const growDown = dest.r1 > src.r1
  const growRight = dest.c1 > src.c1
  const growUp = dest.r0 < src.r0
  const growLeft = dest.c0 < src.c0

  if (growDown) {
    for (let c = src.c0; c <= src.c1; c++) {
      const source: LineCell[] = []
      for (let r = src.r0; r <= src.r1; r++) {
        const ref = refToString(c, r)
        source.push({ ref, cell: sheet.cells[ref] })
      }
      fillLine(source, (k) => refToString(c, src.r1 + 1 + k), dest.r1 - src.r1, true, patch)
    }
  } else if (growUp) {
    for (let c = src.c0; c <= src.c1; c++) {
      const source: LineCell[] = []
      for (let r = src.r0; r <= src.r1; r++) {
        const ref = refToString(c, r)
        source.push({ ref, cell: sheet.cells[ref] })
      }
      const count = src.r0 - dest.r0
      fillLine(source, (k) => refToString(c, src.r0 - 1 - k), count, false, patch)
    }
  } else if (growRight) {
    for (let r = src.r0; r <= src.r1; r++) {
      const source: LineCell[] = []
      for (let c = src.c0; c <= src.c1; c++) {
        const ref = refToString(c, r)
        source.push({ ref, cell: sheet.cells[ref] })
      }
      fillLine(source, (k) => refToString(src.c1 + 1 + k, r), dest.c1 - src.c1, true, patch)
    }
  } else if (growLeft) {
    for (let r = src.r0; r <= src.r1; r++) {
      const source: LineCell[] = []
      for (let c = src.c0; c <= src.c1; c++) {
        const ref = refToString(c, r)
        source.push({ ref, cell: sheet.cells[ref] })
      }
      const count = src.c0 - dest.c0
      fillLine(source, (k) => refToString(src.c0 - 1 - k, r), count, false, patch)
    }
  }

  return patch
}
