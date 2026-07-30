// Pure import/export mapping for .xlsx and .csv. No platform/DOM calls here —
// SheetsApp.tsx wires these functions to platform.openFile/saveFile.

import * as XLSX from 'xlsx'
import type { Sheet, SheetsContent, Cell, CellStyle } from '../../shared/types'
import { uid } from '../../shared/types'
import { computeSheet, isFormula } from './engine/formula'
import { colToLetters, parseCellRef, refToString } from './engine/refs'
import { usedRange } from './gridMath'
import { DEFAULT_COL_W } from './types'
import { mergeRangeStr, parseMergeRange } from './merge'

// ---------------------------------------------------------------------------
// Number format strings
//
// NOTE on CellStyle.fontFamily / valign / fill / bold / color / borders: the
// `xlsx` package pinned in package.json is SheetJS's free Community Edition,
// which can only WRITE the number-format string (`z`) on a cell — writing a
// cell style object (`ws[ref].s = {...}`, which is where font/fill/border/
// alignment would live) is a SheetJS Pro feature and is silently a no-op in
// this build. So quick number formats (currency/percent/comma) round-trip
// through `z` below same as before, but font family, vertical align, and the
// "Format as table" fills/borders/bold are intentionally NOT mapped to xlsx —
// faking them (e.g. baking a font name into the number format string) would
// produce a workbook that lies about its own formatting, so this file leaves
// them out. They still render correctly in the native .asheet format and in
// the in-app preview; only the .xlsx export is affected.
// ---------------------------------------------------------------------------

function numFmtFor(style?: CellStyle): string | undefined {
  const fmt = style?.format ?? 'auto'
  const d = style?.decimals
  switch (fmt) {
    case 'number':
      return d ? `#,##0.${'0'.repeat(d)}` : '#,##0.00'
    case 'percent':
      return d ? `0.${'0'.repeat(d)}%` : '0%'
    case 'currency':
      return d === 0 ? '$#,##0' : `$#,##0.${'0'.repeat(d ?? 2)}`
    case 'date':
      return 'm/d/yyyy'
    case 'text':
      return '@'
    default:
      return undefined
  }
}

function fmtFromNumFmt(z: string | undefined): CellStyle['format'] | undefined {
  if (!z || z === 'General') return undefined
  if (z === '@') return 'text'
  if (z.includes('%')) return 'percent'
  if (z.includes('$')) return 'currency'
  if (/[myd]/i.test(z) && !/0/.test(z.replace(/[myd/\-. ]/gi, ''))) return 'date'
  if (z.includes('#') || z.includes('0')) return 'number'
  return undefined
}

function decimalsFromNumFmt(z: string | undefined): number | undefined {
  if (!z) return undefined
  const m = /\.([0#]+)/.exec(z)
  return m ? m[1].length : 0
}

// ---------------------------------------------------------------------------
// Raw-value coercion (mirrors the engine's literal parsing, kept local so this
// module stays a pure, dependency-light mapping layer)
// ---------------------------------------------------------------------------

function coerceRaw(raw: string): { t: 'n' | 'b' | 's'; v: number | boolean | string } {
  const s = raw.trim()
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return { t: 'n', v: Number(s) }
  if (/^TRUE$/i.test(s)) return { t: 'b', v: true }
  if (/^FALSE$/i.test(s)) return { t: 'b', v: false }
  return { t: 's', v: raw }
}

// ---------------------------------------------------------------------------
// Sheet -> XLSX worksheet
// ---------------------------------------------------------------------------

function sheetToWorksheet(sheet: Sheet): XLSX.WorkSheet {
  const computed = computeSheet(sheet)
  const { maxRow, maxCol } = usedRange(sheet)
  const ws: XLSX.WorkSheet = {}

  let hi = 0 // highest col actually touched, for !cols
  for (const key of Object.keys(sheet.cells)) {
    const cell = sheet.cells[key]
    if (!cell) continue
    const parts = parseCellRef(key)
    if (!parts) continue
    const ref = refToString(parts.col, parts.row)
    if (parts.col > hi) hi = parts.col
    const raw = cell.v
    const z = numFmtFor(cell.style)
    if (raw !== undefined && raw !== '') {
      if (isFormula(raw)) {
        const computedVal = computed.get(ref)?.value
        const t: XLSX.ExcelDataType = typeof computedVal === 'number' ? 'n' : typeof computedVal === 'boolean' ? 'b' : 's'
        const v = typeof computedVal === 'number' || typeof computedVal === 'boolean' ? computedVal : computed.get(ref)?.display ?? ''
        ws[ref] = { t, v, f: raw.slice(1), ...(z ? { z } : {}) }
      } else {
        const { t, v } = coerceRaw(raw)
        ws[ref] = { t, v, ...(z ? { z } : {}) }
      }
    } else if (z || cell.style) {
      // Styled-but-blank cell: keep a stub so the number format / width survive.
      ws[ref] = { t: 'z' }
    }
  }

  const lastCol = Math.max(maxCol, hi, 0)
  const lastRow = Math.max(maxRow, 0)
  ws['!ref'] = `A1:${colToLetters(lastCol)}${lastRow + 1}`

  const cols: XLSX.ColInfo[] = []
  for (let c = 0; c <= lastCol; c++) cols.push({ wpx: sheet.colWidths[c] ?? DEFAULT_COL_W })
  ws['!cols'] = cols

  if (sheet.merges?.length) {
    const merges: XLSX.Range[] = []
    for (const m of sheet.merges) {
      const r = parseMergeRange(m)
      if (r) merges.push({ s: { r: r.r0, c: r.c0 }, e: { r: r.r1, c: r.c1 } })
    }
    if (merges.length) ws['!merges'] = merges
  }

  return ws
}

export function sheetsToWorkbook(content: SheetsContent): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const sheet of content.sheets) {
    const ws = sheetToWorksheet(sheet)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || 'Sheet')
  }
  return wb
}

/** Returns a base64-encoded .xlsx file — hand to platform.saveFile with binary=true. */
export function exportXlsxBase64(content: SheetsContent): string {
  const wb = sheetsToWorkbook(content)
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** Computed display values of the active sheet, as CSV text. */
export function exportCsv(sheet: Sheet): string {
  const computed = computeSheet(sheet)
  const { maxRow, maxCol } = usedRange(sheet)
  if (maxRow < 0 || maxCol < 0) return ''
  const lines: string[] = []
  for (let r = 0; r <= maxRow; r++) {
    const fields: string[] = []
    for (let c = 0; c <= maxCol; c++) {
      const ref = refToString(c, r)
      fields.push(csvEscape(computed.get(ref)?.display ?? ''))
    }
    lines.push(fields.join(','))
  }
  return lines.join('\r\n')
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop a single trailing wholly-empty row produced by a final newline.
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop()
  return rows
}

export function csvToSheet(text: string, name = 'Sheet 1'): Sheet {
  const rows = parseCsv(text)
  const cells: Record<string, Cell> = {}
  rows.forEach((fields, r) => {
    fields.forEach((field, c) => {
      if (field !== '') cells[refToString(c, r)] = { v: field }
    })
  })
  return { name, cells, colWidths: {}, rowHeights: {} }
}

// ---------------------------------------------------------------------------
// XLSX -> SheetsContent
// ---------------------------------------------------------------------------

function xlsxCellToRaw(cell: XLSX.CellObject | undefined): string | undefined {
  if (!cell) return undefined
  if (cell.f) return '=' + cell.f
  if (cell.v === undefined || cell.v === null) return undefined
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE'
  if (cell.t === 'n') return String(cell.v)
  if (cell.t === 's') return String(cell.v)
  if (cell.t === 'd') return String(cell.v)
  return String(cell.v)
}

export function workbookToSheets(wb: XLSX.WorkBook): SheetsContent {
  const sheets: Sheet[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const cells: Record<string, Cell> = {}
    const colWidths: Record<number, number> = {}
    const ref = ws['!ref']
    if (ref) {
      const [fromA, toA] = ref.split(':')
      const from = parseCellRef(fromA)
      const to = parseCellRef(toA ?? fromA)
      if (from && to) {
        for (let r = from.row; r <= to.row; r++) {
          for (let c = from.col; c <= to.col; c++) {
            const a1 = refToString(c, r)
            const raw = xlsxCellToRaw(ws[a1] as XLSX.CellObject | undefined)
            if (raw !== undefined && raw !== '') {
              const style: CellStyle | undefined = (() => {
                const cellObj = ws[a1] as XLSX.CellObject | undefined
                const fmt = fmtFromNumFmt(cellObj?.z as string | undefined)
                if (!fmt) return undefined
                const decimals = decimalsFromNumFmt(cellObj?.z as string | undefined)
                return { format: fmt, decimals }
              })()
              cells[a1] = style ? { v: raw, style } : { v: raw }
            }
          }
        }
      }
    }
    const colsInfo = ws['!cols'] as XLSX.ColInfo[] | undefined
    if (colsInfo) {
      colsInfo.forEach((ci, idx) => {
        if (!ci) return
        if (typeof ci.wpx === 'number') colWidths[idx] = Math.round(ci.wpx)
        else if (typeof ci.width === 'number') colWidths[idx] = Math.round(ci.width * 7)
      })
    }
    const mergesInfo = ws['!merges'] as XLSX.Range[] | undefined
    const merges = mergesInfo?.length
      ? mergesInfo.map((rg) => mergeRangeStr({ r0: rg.s.r, c0: rg.s.c, r1: rg.e.r, c1: rg.e.c }))
      : undefined
    return { name: name.slice(0, 31) || 'Sheet', cells, colWidths, rowHeights: {}, ...(merges ? { merges } : {}) }
  })
  return { sheets: sheets.length ? sheets : [{ name: 'Sheet 1', cells: {}, colWidths: {}, rowHeights: {} }], active: 0 }
}

export function base64ToWorkbook(b64: string): XLSX.WorkBook {
  return XLSX.read(b64, { type: 'base64', cellNF: true, cellStyles: true, cellFormula: true })
}

export function newSheetName(existing: string[], base = 'Sheet'): string {
  let n = existing.length + 1
  let name = `${base} ${n}`
  while (existing.includes(name)) {
    n++
    name = `${base} ${n}`
  }
  return name
}

export function blankSheet(name: string): Sheet {
  return { name, cells: {}, colWidths: {}, rowHeights: {} }
}

export { uid }
