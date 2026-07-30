// Shape "Quick styles" — six theme-derived fill/stroke/gradient presets for the
// selected shape(s). Each preset only ever sets fill/gradient/stroke/strokeWidth/
// color/opacity — the real knobs ShapeElement exposes — so position, size and any
// label text are left untouched by design, and switching between presets is
// idempotent (every field is always explicitly set, never left to a stale value
// from a previously-applied preset).

import type { ShapeElement, SlidesTheme } from '../../shared/types'

export interface ShapeQuickStylePatch {
  fill: string
  gradient: ShapeElement['gradient']
  stroke: string | undefined
  strokeWidth: number
  color: string
  opacity: number
}

export interface ShapeQuickStyle {
  id: string
  name: string
  build: (theme: SlidesTheme) => ShapeQuickStylePatch
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function toRgb(hexColor: string): [number, number, number] {
  const c = hexColor.replace('#', '')
  const full = c.length === 3
    ? c
        .split('')
        .map((ch) => ch + ch)
        .join('')
    : c
  const num = parseInt(full, 16) || 0
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
}

/** Lighten (positive percent) or darken (negative percent) a hex color. */
function shade(hexColor: string, percent: number): string {
  const [r, g, b] = toRgb(hexColor)
  const amt = Math.round(2.55 * percent)
  return (
    '#' +
    [clamp255(r + amt), clamp255(g + amt), clamp255(b + amt)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
function luminance(hexColor: string): number {
  const [r, g, b] = toRgb(hexColor).map((v) => v / 255)
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Black or white — whichever gives the better WORST-CASE contrast across every
 * background color passed in. A single color behaves like a plain black-or-white
 * contrast pick; two-plus colors (e.g. both stops of a gradient) guard against
 * picking a text color that only reads well against one end of the gradient.
 */
function bestOfBlackWhite(...bgHexes: string[]): string {
  const lums = bgHexes.map(luminance)
  const whiteWorstCase = Math.min(...lums.map((l) => contrastRatio(1, l)))
  const blackWorstCase = Math.min(...lums.map((l) => contrastRatio(0, l)))
  return whiteWorstCase >= blackWorstCase ? '#ffffff' : '#111827'
}

/** Nudge `color` away from `bgHex` (darker or lighter) until contrast is safe. */
function readableAgainst(color: string, bgHex: string): string {
  let c = color
  const bgLum = luminance(bgHex)
  const darken = bgLum > 0.5
  for (let i = 0; i < 8 && Math.abs(luminance(c) - bgLum) < 0.35; i++) {
    c = shade(c, darken ? -15 : 15)
  }
  return c
}

// Note: the model has no real alpha-transparent fill ("#00000000" isn't
// supported) and no way to render a true see-through shape outline, so the
// "translucent" and "outline only" presets below approximate the PowerPoint
// look within what ShapeElement can actually express — see comments per preset.
export const SHAPE_QUICK_STYLES: ShapeQuickStyle[] = [
  {
    id: 'solid',
    name: 'Solid accent fill',
    build: (theme) => ({
      fill: theme.accent,
      gradient: undefined,
      stroke: undefined,
      strokeWidth: 0,
      opacity: 1,
      color: bestOfBlackWhite(theme.accent),
    }),
  },
  {
    id: 'white-stroke',
    name: 'White fill, accent stroke',
    build: (theme) => ({
      fill: '#ffffff',
      gradient: undefined,
      stroke: theme.accent,
      strokeWidth: 2,
      opacity: 1,
      color: readableAgainst(theme.accent, '#ffffff'),
    }),
  },
  {
    id: 'gradient',
    name: 'Accent gradient',
    build: (theme) => {
      const darkStop = shade(theme.accent, -35)
      return {
        fill: theme.accent,
        gradient: { from: theme.accent, to: darkStop, angle: 135 },
        stroke: undefined,
        strokeWidth: 0,
        opacity: 1,
        // Checked against BOTH gradient stops — a color that only reads well
        // against the lighter stop can go unreadable over the darker half.
        color: bestOfBlackWhite(theme.accent, darkStop),
      }
    },
  },
  {
    id: 'dark',
    name: 'Dark fill, light text',
    build: (theme) => ({
      fill: shade(theme.accent, -60),
      gradient: undefined,
      stroke: undefined,
      strokeWidth: 0,
      opacity: 1,
      color: '#ffffff',
    }),
  },
  {
    // No alpha fill in the model, so "translucent" is approximated as a soft
    // wash from a light accent tint into white — reads as translucent without
    // fading the label text (which real fill-opacity would do).
    id: 'translucent',
    name: 'Translucent accent wash',
    build: (theme) => {
      const tint = shade(theme.accent, 55)
      return {
        fill: theme.accent,
        gradient: { from: tint, to: '#ffffff', angle: 135 },
        stroke: undefined,
        strokeWidth: 0,
        opacity: 1,
        color: bestOfBlackWhite(tint, '#ffffff'),
      }
    },
  },
  {
    // No transparent fill exists, so "outline only" falls back to a white
    // fill with a bold accent stroke — visually distinct from the thin
    // "white fill, accent stroke" preset via a heavier stroke weight.
    id: 'outline',
    name: 'Outline only',
    build: (theme) => ({
      fill: '#ffffff',
      gradient: undefined,
      stroke: theme.accent,
      strokeWidth: 5,
      opacity: 1,
      color: readableAgainst(theme.accent, '#ffffff'),
    }),
  },
]
