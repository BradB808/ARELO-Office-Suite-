// Cell display formatting: turns a computed FValue + CellStyle into the string
// the grid renders. Pure — no DOM.

// The .ts extensions below are required so this file's dependency graph can
// also be run directly by `node` (see formula.test.ts); @ts-ignore silences
// TS5097, which fires because the project tsconfig doesn't set
// allowImportingTsExtensions.
// @ts-ignore
import type { CellStyle } from '../../../shared/types.ts'
// @ts-ignore
import { FErr, toDisplayString } from './values.ts'
// @ts-ignore
import type { FValue } from './values.ts'
// @ts-ignore
import { serialToDate } from './dates.ts'

function plainNumber(n: number, decimals?: number): string {
  if (decimals !== undefined) {
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }
  if (Number.isInteger(n)) return n.toLocaleString('en-US')
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 })
}

function currencyStr(n: number, decimals: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function percentStr(n: number, decimals: number): string {
  return (n * 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%'
}

function dateStr(serial: number): string {
  const d = serialToDate(serial)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
}

export function formatValue(v: FValue, style?: CellStyle): string {
  if (v instanceof FErr) return v.code
  const fmt = style?.format ?? 'auto'
  const decimals = style?.decimals

  if (fmt === 'text') return toDisplayString(v)

  if (typeof v === 'number') {
    switch (fmt) {
      case 'percent':
        return percentStr(v, decimals ?? 0)
      case 'currency':
        return currencyStr(v, decimals ?? 2)
      case 'number':
        return plainNumber(v, decimals ?? 2)
      case 'date':
        return dateStr(v)
      default:
        return plainNumber(v, decimals)
    }
  }
  return toDisplayString(v)
}

/** True when the value should right-align by default (numbers under 'auto' format). */
export function isNumericLike(v: FValue): boolean {
  return typeof v === 'number'
}
