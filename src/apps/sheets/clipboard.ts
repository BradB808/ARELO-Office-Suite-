// Copy/cut/paste helpers: internal JSON payload (raw values + styles, with
// relative-ref-aware paste) and TSV/CSV text fallback for external data.

import type { Sheet, Cell, CellStyle } from '../../shared/types'
import { computeSheet, isFormula, shiftFormula } from './engine/formula'
import { refToString } from './engine/refs'
import { parseCsv } from './export'
import type { ClipboardPayload, SelRect } from './types'

export const INTERNAL_MIME = 'application/x-anleo-sheets+json'

export function buildClipboardPayload(sheet: Sheet, sel: SelRect, kind: 'copy' | 'cut'): ClipboardPayload {
  const cells: ClipboardPayload['cells'] = []
  for (let r = sel.r0; r <= sel.r1; r++) {
    const row: { v?: string; style?: CellStyle }[] = []
    for (let c = sel.c0; c <= sel.c1; c++) {
      const cell = sheet.cells[refToString(c, r)]
      row.push(cell ? { v: cell.v, style: cell.style } : {})
    }
    cells.push(row)
  }
  return { kind, cells, rows: sel.r1 - sel.r0 + 1, cols: sel.c1 - sel.c0 + 1, origin: { row: sel.r0, col: sel.c0 } }
}

export function tsvFromSelection(sheet: Sheet, sel: SelRect): string {
  const computed = computeSheet(sheet)
  const lines: string[] = []
  for (let r = sel.r0; r <= sel.r1; r++) {
    const fields: string[] = []
    for (let c = sel.c0; c <= sel.c1; c++) {
      fields.push((computed.get(refToString(c, r))?.display ?? '').replace(/\t/g, ' ').replace(/\n/g, ' '))
    }
    lines.push(fields.join('\t'))
  }
  return lines.join('\n')
}

/** Shifts every formula's relative refs by (dRow, dCol) — used when pasting at a new origin. */
export function shiftPayload(payload: ClipboardPayload, dRow: number, dCol: number): ClipboardPayload {
  if (dRow === 0 && dCol === 0) return payload
  return {
    ...payload,
    cells: payload.cells.map((row) =>
      row.map((cell) => {
        if (cell.v !== undefined && isFormula(cell.v)) {
          return { ...cell, v: shiftFormula(cell.v, dCol, dRow) }
        }
        return cell
      }),
    ),
  }
}

function looksTabular(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const trimmed = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
  if (trimmed === '') return [['']]
  if (trimmed.includes('\t')) {
    return trimmed.split('\n').map((line) => line.split('\t'))
  }
  if (trimmed.includes(',') || trimmed.includes('"')) {
    return parseCsv(normalized)
  }
  return trimmed.split('\n').map((line) => [line])
}

/** Parses clipboard text (TSV from Excel/Sheets, CSV, or plain lines) into a grid of raw strings. */
export function parseExternalText(text: string): string[][] {
  return looksTabular(text)
}

export function applyPayloadToCells(
  cells: Sheet['cells'],
  payload: ClipboardPayload,
  destRow: number,
  destCol: number,
): void {
  const shifted = shiftPayload(payload, destRow - payload.origin.row, destCol - payload.origin.col)
  shifted.cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      const ref = refToString(destCol + c, destRow + r)
      if (cell.v === undefined && !cell.style) {
        delete cells[ref]
      } else {
        cells[ref] = { v: cell.v, style: cell.style }
      }
    })
  })
}
