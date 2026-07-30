// Conditional formatting evaluation. Pure functions: given a sheet's rule
// list and the computed (post-formula) values for the active sheet, produce
// a single ref -> style map for the whole grid in ONE pass per rule (never
// per-cell scans), so the render pipeline just does a Map.get() per cell.
// Rule fill/color OVERRIDES any explicit cell style (matches Excel), and
// rules later in sheet.condFormats win over earlier ones on the same cell.

import type { CondRule, Sheet } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { isErr } from './engine/formula'
import { rangeRefList } from './engine/refs'

export interface CondStyle {
  fill?: string
  color?: string
}

function cellNumeric(computed: Map<string, ComputedCell>, ref: string): number | undefined {
  const v = computed.get(ref)?.value
  return typeof v === 'number' ? v : undefined
}

function cellDisplayText(computed: Map<string, ComputedCell>, ref: string): string {
  const c = computed.get(ref)
  if (!c || isErr(c.value)) return ''
  return c.display
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function lerpColor(from: string, to: string, t: number): string {
  const pf = hexToRgb(from)
  const pt = hexToRgb(to)
  if (!pf || !pt) return from
  const r = Math.round(pf.r + (pt.r - pf.r) * t)
  const g = Math.round(pf.g + (pt.g - pf.g) * t)
  const b = Math.round(pf.b + (pt.b - pf.b) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function matchesRule(rule: CondRule, ref: string, computed: Map<string, ComputedCell>): boolean {
  const cell = computed.get(ref)
  if (!cell || isErr(cell.value)) return false
  switch (rule.type) {
    case 'gt': {
      const n = cellNumeric(computed, ref)
      const target = Number(rule.v1)
      return n !== undefined && !Number.isNaN(target) && n > target
    }
    case 'lt': {
      const n = cellNumeric(computed, ref)
      const target = Number(rule.v1)
      return n !== undefined && !Number.isNaN(target) && n < target
    }
    case 'between': {
      const n = cellNumeric(computed, ref)
      const lo = Number(rule.v1)
      const hi = Number(rule.v2)
      if (n === undefined || Number.isNaN(lo) || Number.isNaN(hi)) return false
      return n >= Math.min(lo, hi) && n <= Math.max(lo, hi)
    }
    case 'eq': {
      const n = cellNumeric(computed, ref)
      const targetStr = String(rule.v1 ?? '').trim()
      const targetNum = Number(targetStr)
      if (n !== undefined && targetStr !== '' && !Number.isNaN(targetNum)) return n === targetNum
      return cell.display.trim().toLowerCase() === targetStr.toLowerCase()
    }
    case 'contains': {
      const needle = String(rule.v1 ?? '').toLowerCase()
      if (!needle) return false
      return cell.display.toLowerCase().includes(needle)
    }
    default:
      return false
  }
}

function applyColorScale(rule: CondRule, refs: string[], computed: Map<string, ComputedCell>, out: Map<string, CondStyle>) {
  let min = Infinity
  let max = -Infinity
  for (const ref of refs) {
    const n = cellNumeric(computed, ref)
    if (n === undefined) continue
    if (n < min) min = n
    if (n > max) max = n
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return
  const from = rule.scaleFrom || '#f8696b'
  const to = rule.scaleTo || '#63be7b'
  for (const ref of refs) {
    const n = cellNumeric(computed, ref)
    if (n === undefined) continue
    const t = max === min ? 0.5 : (n - min) / (max - min)
    out.set(ref, { fill: lerpColor(from, to, t) })
  }
}

function applyDuplicate(rule: CondRule, refs: string[], computed: Map<string, ComputedCell>, out: Map<string, CondStyle>) {
  const counts = new Map<string, number>()
  for (const ref of refs) {
    const txt = cellDisplayText(computed, ref)
    if (txt === '') continue
    counts.set(txt, (counts.get(txt) ?? 0) + 1)
  }
  for (const ref of refs) {
    const txt = cellDisplayText(computed, ref)
    if (txt !== '' && (counts.get(txt) ?? 0) > 1) {
      out.set(ref, { fill: rule.fill, color: rule.color })
    }
  }
}

/** Precomputes ref -> style for every rule on the sheet in one pass each — the
 *  single source of truth the render pipeline Map.get()s per cell. */
export function computeCondFormatStyles(sheet: Sheet, computed: Map<string, ComputedCell>): Map<string, CondStyle> {
  const out = new Map<string, CondStyle>()
  const rules = sheet.condFormats
  if (!rules || !rules.length) return out
  for (const rule of rules) {
    const refs = rangeRefList(rule.range)
    if (!refs || !refs.length) continue
    if (rule.type === 'colorScale') {
      applyColorScale(rule, refs, computed, out)
    } else if (rule.type === 'duplicate') {
      applyDuplicate(rule, refs, computed, out)
    } else {
      for (const ref of refs) {
        if (matchesRule(rule, ref, computed)) out.set(ref, { fill: rule.fill, color: rule.color })
      }
    }
  }
  return out
}

export function ruleDescription(rule: CondRule): string {
  switch (rule.type) {
    case 'gt':
      return `Value > ${rule.v1}`
    case 'lt':
      return `Value < ${rule.v1}`
    case 'between':
      return `Between ${rule.v1} and ${rule.v2}`
    case 'eq':
      return `Value = ${rule.v1}`
    case 'contains':
      return `Text contains "${rule.v1}"`
    case 'duplicate':
      return 'Duplicate values'
    case 'colorScale':
      return 'Color scale'
    default:
      return ''
  }
}
