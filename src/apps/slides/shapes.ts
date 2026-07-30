// Shape kind metadata + pure SVG path generation. Shared by SlideView (render),
// the shape-picker popover (small previews) and pptx export (kind mapping only,
// not path generation — pptx draws real autoshapes).

import type { ShapeKind } from '../../shared/types'

export const SHAPE_KINDS: { kind: ShapeKind; label: string }[] = [
  { kind: 'rect', label: 'Rectangle' },
  { kind: 'roundRect', label: 'Rounded rectangle' },
  { kind: 'ellipse', label: 'Ellipse' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'line', label: 'Line' },
  { kind: 'star', label: 'Star' },
  { kind: 'chevron', label: 'Chevron' },
  { kind: 'plus', label: 'Plus' },
  { kind: 'cross', label: 'Cross' },
  { kind: 'pentagon', label: 'Pentagon' },
  { kind: 'hexagon', label: 'Hexagon' },
  { kind: 'speech', label: 'Speech bubble' },
  { kind: 'cloud', label: 'Cloud' },
]

function rectPath(w: number, h: number, r = 0): string {
  if (r <= 0) return `M0,0 H${w} V${h} H0 Z`
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M${rr},0`,
    `H${w - rr}`,
    `A${rr},${rr} 0 0 1 ${w},${rr}`,
    `V${h - rr}`,
    `A${rr},${rr} 0 0 1 ${w - rr},${h}`,
    `H${rr}`,
    `A${rr},${rr} 0 0 1 0,${h - rr}`,
    `V${rr}`,
    `A${rr},${rr} 0 0 1 ${rr},0`,
    'Z',
  ].join(' ')
}

function ellipsePath(w: number, h: number): string {
  const rx = w / 2
  const ry = h / 2
  return `M0,${ry} A${rx},${ry} 0 1,0 ${w},${ry} A${rx},${ry} 0 1,0 0,${ry} Z`
}

function trianglePath(w: number, h: number): string {
  return `M${w / 2},0 L${w},${h} L0,${h} Z`
}

function diamondPath(w: number, h: number): string {
  return `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`
}

function arrowPath(w: number, h: number): string {
  const headW = Math.min(w * 0.4, w)
  const shaftH = h * 0.42
  const bodyW = Math.max(0, w - headW)
  const top = (h - shaftH) / 2
  const bot = top + shaftH
  return `M0,${top} H${bodyW} V0 L${w},${h / 2} L${bodyW},${h} V${bot} H0 Z`
}

function chevronPath(w: number, h: number): string {
  const notch = Math.min(w * 0.38, w)
  return `M0,0 H${w - notch} L${w},${h / 2} L${w - notch},${h} H0 L${notch},${h / 2} Z`
}

function plusPath(w: number, h: number): string {
  const t = Math.min(w, h) * 0.32 // arm thickness
  const cx = w / 2
  const cy = h / 2
  const hx = t / 2
  const hy = t / 2
  return [
    `M${cx - hx},0`,
    `H${cx + hx}`,
    `V${cy - hy}`,
    `H${w}`,
    `V${cy + hy}`,
    `H${cx + hx}`,
    `V${h}`,
    `H${cx - hx}`,
    `V${cy + hy}`,
    `H0`,
    `V${cy - hy}`,
    `H${cx - hx}`,
    'Z',
  ].join(' ')
}

function crossPath(w: number, h: number): string {
  // 12-point "X" outline: corners inset along each edge, notched at the center of each edge.
  const k1 = 0.3 // distance from each corner to where an arm begins, along the edge
  const k2 = 0.18 // distance from center to the inner notch point
  const pts: [number, number][] = [
    [k1, 0],
    [0.5, k2],
    [1 - k1, 0],
    [1, k1],
    [1 - k2, 0.5],
    [1, 1 - k1],
    [1 - k1, 1],
    [0.5, 1 - k2],
    [k1, 1],
    [0, 1 - k1],
    [k2, 0.5],
    [0, k1],
  ]
  return (
    pts
      .map(([fx, fy], i) => `${i === 0 ? 'M' : 'L'}${(fx * w).toFixed(2)},${(fy * h).toFixed(2)}`)
      .join(' ') + ' Z'
  )
}

function pentagonPath(w: number, h: number): string {
  const cx = w / 2
  const cy = h / 2
  let d = ''
  for (let i = 0; i < 5; i++) {
    const angle = (2 * Math.PI * i) / 5 - Math.PI / 2
    const x = cx + Math.cos(angle) * (w / 2)
    const y = cy + Math.sin(angle) * (h / 2)
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' '
  }
  return d + 'Z'
}

function hexagonPath(w: number, h: number): string {
  const cut = Math.min(w * 0.25, h / 2)
  return `M${cut},0 H${w - cut} L${w},${h / 2} L${w - cut},${h} H${cut} L0,${h / 2} Z`
}

function speechPath(w: number, h: number): string {
  const bodyH = h * 0.78
  const r = Math.min(w, bodyH) * 0.16
  const tailX = w * 0.18
  const tailTip = tailX
  const tailBase2 = w * 0.4 // tailX + tailW
  return [
    `M${r},0`,
    `H${w - r}`,
    `A${r},${r} 0 0 1 ${w},${r}`,
    `V${bodyH - r}`,
    `A${r},${r} 0 0 1 ${w - r},${bodyH}`,
    `H${tailBase2}`,
    `L${tailTip},${h}`,
    `L${tailX},${bodyH}`,
    `H${r}`,
    `A${r},${r} 0 0 1 0,${bodyH - r}`,
    `V${r}`,
    `A${r},${r} 0 0 1 ${r},0`,
    'Z',
  ].join(' ')
}

/** Cloud silhouette (adapted from a well-known 24x24 cloud glyph, non-uniformly scaled to w x h). */
function cloudPath(w: number, h: number): string {
  const sx = w / 24
  const sy = h / 24
  const X = (v: number) => (v * sx).toFixed(2)
  const Y = (v: number) => (v * sy).toFixed(2)
  return [
    `M${X(19.35)},${Y(10.04)}`,
    `A${X(7.49)},${Y(7.49)} 0 0 0 ${X(12)},${Y(4)}`,
    `C${X(9.11)},${Y(4)} ${X(6.6)},${Y(5.64)} ${X(5.35)},${Y(8.04)}`,
    `A${X(5.994)},${Y(5.994)} 0 0 0 ${X(0)},${Y(14)}`,
    `C${X(0)},${Y(17.31)} ${X(2.69)},${Y(20)} ${X(6)},${Y(20)}`,
    `H${X(19)}`,
    `C${X(21.76)},${Y(20)} ${X(24)},${Y(17.76)} ${X(24)},${Y(15)}`,
    `C${X(24)},${Y(12.36)} ${X(21.95)},${Y(10.22)} ${X(19.35)},${Y(10.04)}`,
    'Z',
  ].join(' ')
}

function starPath(w: number, h: number): string {
  const cx = w / 2
  const cy = h / 2
  const rx = w / 2
  const ry = h / 2
  const points = 10
  let d = ''
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const r = i % 2 === 0 ? 1 : 0.42
    const x = cx + Math.cos(angle) * rx * r
    const y = cy + Math.sin(angle) * ry * r
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' '
  }
  return d + 'Z'
}

/** Returns an SVG path 'd' string sized to (w,h) logical px. `line` is not path-based. */
export function shapePath(kind: ShapeKind, w: number, h: number): string {
  switch (kind) {
    case 'rect':
      return rectPath(w, h, 0)
    case 'roundRect':
      return rectPath(w, h, Math.min(w, h) * 0.16)
    case 'ellipse':
      return ellipsePath(w, h)
    case 'triangle':
      return trianglePath(w, h)
    case 'diamond':
      return diamondPath(w, h)
    case 'arrow':
      return arrowPath(w, h)
    case 'chevron':
      return chevronPath(w, h)
    case 'star':
      return starPath(w, h)
    case 'plus':
      return plusPath(w, h)
    case 'cross':
      return crossPath(w, h)
    case 'pentagon':
      return pentagonPath(w, h)
    case 'hexagon':
      return hexagonPath(w, h)
    case 'speech':
      return speechPath(w, h)
    case 'cloud':
      return cloudPath(w, h)
    case 'line':
      return ''
    default:
      return rectPath(w, h, 0)
  }
}
