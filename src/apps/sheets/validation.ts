// Dropdown-list data validation helpers. Pure functions — Grid renders the
// chevron affordance, the in-place options popover, and the soft-warning
// corner marker off of these.

import type { Sheet, Validation } from '../../shared/types'
import { rangeRefList } from './engine/refs'

/** Precomputes ref -> validation for every validated range in one pass
 *  (last rule wins on overlap) — the render pipeline Map.get()s per cell. */
export function computeValidationMap(sheet: Sheet): Map<string, Validation> {
  const out = new Map<string, Validation>()
  for (const v of sheet.validations ?? []) {
    const refs = rangeRefList(v.range)
    if (!refs) continue
    for (const ref of refs) out.set(ref, v)
  }
  return out
}

/** Blank cells are never flagged — only a value that doesn't match any option (soft warning, not blocking). */
export function isValueInOptions(validation: Validation, raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === '') return true
  const needle = raw.trim().toLowerCase()
  return validation.options.some((o) => o.trim().toLowerCase() === needle)
}
