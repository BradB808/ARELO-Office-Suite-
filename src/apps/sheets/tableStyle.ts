// "Format as table" quick styles: pure style-patch computation for the 6 preset
// swatches. There is no table object model here (per spec) — this just stamps
// CellStyle.fill/color/bold/borders across the selection to mimic a banded
// table (bold white header row + alternating band tint + outer border), and
// "Remove table style" strips exactly those same properties back off.

import type { Sheet, Cell, CellStyle } from '../../shared/types'
import { refToString } from './engine/refs'
import type { SelRect } from './types'

export interface TablePreset {
  id: string
  label: string
  color: string
}

export const TABLE_PRESETS: TablePreset[] = [
  { id: 'blue', label: 'Blue', color: '#2563eb' },
  { id: 'green', label: 'Green', color: '#059669' },
  { id: 'orange', label: 'Orange', color: '#ea580c' },
  { id: 'slate', label: 'Slate', color: '#475569' },
  { id: 'violet', label: 'Violet', color: '#7c3aed' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
]

/** The exact CellStyle keys Format-as-table touches — "Remove table style" strips precisely these. */
const TABLE_STYLE_KEYS: (keyof CellStyle)[] = ['fill', 'color', 'bold', 'borders']

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
/** Mixes `hex` toward white by `t` (0 = hex, 1 = white) — used for the subtle band tint. */
function tint(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)
}

function cleanStyle(existing: Cell | undefined, style: CellStyle): Cell | null {
  const hasStyle = Object.keys(style).length > 0
  if (existing?.v !== undefined) return { v: existing.v, ...(hasStyle ? { style } : {}) }
  return hasStyle ? { style } : null
}

/** Builds the cell patch for applying `presetId` across `sel`: bold white header
 *  row on the preset color, alternating band tint on data rows, outer border.
 *
 *  Banding parity is computed from the absolute sheet row (`r - sel.r0`), not
 *  from the row's position among currently-visible rows. That's a deliberate
 *  choice: absolute-row parity is stable — the stripe pattern never has to be
 *  (and never is) recomputed as rows are hidden/shown or a filter changes
 *  which rows are visible, since the style patch is stamped once at apply time
 *  and only touches the CellStyle.fill of each row, not a per-render lookup. */
export function tablePatchFor(sheet: Sheet, sel: SelRect, presetId: string): Record<string, Cell | null> {
  const preset = TABLE_PRESETS.find((p) => p.id === presetId)
  const patch: Record<string, Cell | null> = {}
  if (!preset) return patch
  const bandTint = tint(preset.color, 0.88)
  for (let r = sel.r0; r <= sel.r1; r++) {
    const isHeader = r === sel.r0
    const banded = (r - sel.r0) % 2 === 1
    for (let c = sel.c0; c <= sel.c1; c++) {
      const ref = refToString(c, r)
      const existing = sheet.cells[ref]
      const style: CellStyle = { ...existing?.style }
      if (isHeader) {
        style.fill = preset.color
        style.color = '#ffffff'
        style.bold = true
      } else {
        if (banded) style.fill = bandTint
        else delete style.fill
        delete style.bold
        if (style.color === '#ffffff') delete style.color
      }
      const onTop = r === sel.r0
      const onBottom = r === sel.r1
      const onLeft = c === sel.c0
      const onRight = c === sel.c1
      if (onTop || onBottom || onLeft || onRight) {
        const borders = { ...style.borders }
        if (onTop) borders.top = true
        if (onBottom) borders.bottom = true
        if (onLeft) borders.left = true
        if (onRight) borders.right = true
        style.borders = borders
      }
      patch[ref] = cleanStyle(existing, style)
    }
  }
  return patch
}

/** Strips fill/color/bold/borders (exactly what tablePatchFor sets) from every
 *  cell in `sel`, leaving values and any other formatting untouched. */
export function removeTableStylePatch(sheet: Sheet, sel: SelRect): Record<string, Cell | null> {
  const patch: Record<string, Cell | null> = {}
  for (let r = sel.r0; r <= sel.r1; r++) {
    for (let c = sel.c0; c <= sel.c1; c++) {
      const ref = refToString(c, r)
      const existing = sheet.cells[ref]
      if (!existing?.style) continue
      const style: CellStyle = { ...existing.style }
      for (const k of TABLE_STYLE_KEYS) delete style[k]
      patch[ref] = cleanStyle(existing, style)
    }
  }
  return patch
}
