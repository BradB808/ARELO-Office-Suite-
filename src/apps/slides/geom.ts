// Pure geometry helpers for the canvas editor: bounding boxes, rotation math,
// resize-around-anchor, and edge/center snapping. No React, no side effects.

import type { SlideElement } from '../../shared/types'

export interface Box {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface Pt {
  x: number
  y: number
}

export const MIN_SIZE = 10
export const SNAP_THRESHOLD = 5
export const ROTATE_SNAP_DEG = 3

export function toBox(el: SlideElement): Box {
  return { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation ?? 0 }
}

export function boxCenter(b: Box): Pt {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

export function rotatePoint(x: number, y: number, deg: number): Pt {
  if (!deg) return { x, y }
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

export function boundingBox(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0, rotation: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, rotation: 0 }
}

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function moveBox(box: Box, dx: number, dy: number): Box {
  return { ...box, x: box.x + dx, y: box.y + dy }
}

/**
 * Resize `box` (the ORIGINAL box captured at gesture start) by dragging `handle`
 * to `pointer` (logical canvas coordinates). Works correctly for rotated boxes:
 * the opposite corner/edge stays visually pinned in canvas space.
 */
export function resizeBox(
  box: Box,
  handle: HandleId,
  pointer: Pt,
  opts: { lockAspect?: boolean; minSize?: number } = {},
): Box {
  const { x, y, w, h, rotation } = box
  const min = opts.minSize ?? MIN_SIZE
  const cx = x + w / 2
  const cy = y + h / 2
  const ax = handle.includes('w') ? w : handle.includes('e') ? 0 : w / 2
  const ay = handle.includes('n') ? h : handle.includes('s') ? 0 : h / 2
  const anchorLocal = { x: ax - w / 2, y: ay - h / 2 }
  const anchorRot = rotatePoint(anchorLocal.x, anchorLocal.y, rotation)
  const anchorGlobal = { x: cx + anchorRot.x, y: cy + anchorRot.y }
  const relGlobal = { x: pointer.x - anchorGlobal.x, y: pointer.y - anchorGlobal.y }
  const local = rotatePoint(relGlobal.x, relGlobal.y, -rotation)

  const canW = handle !== 'n' && handle !== 's'
  const canH = handle !== 'e' && handle !== 'w'
  let newW = canW ? Math.max(min, Math.abs(local.x)) : w
  let newH = canH ? Math.max(min, Math.abs(local.y)) : h

  if (opts.lockAspect && canW && canH && w > 0 && h > 0) {
    const ratio = w / h
    if (newW / ratio > newH) newH = newW / ratio
    else newW = newH * ratio
  }

  const newLocalTLx = canW ? Math.min(0, local.x) : -newW / 2
  const newLocalTLy = canH ? Math.min(0, local.y) : -newH / 2
  const centerFromAnchor = { x: newLocalTLx + newW / 2, y: newLocalTLy + newH / 2 }
  const centerRot = rotatePoint(centerFromAnchor.x, centerFromAnchor.y, rotation)
  const newCenter = { x: anchorGlobal.x + centerRot.x, y: anchorGlobal.y + centerRot.y }

  return { x: newCenter.x - newW / 2, y: newCenter.y - newH / 2, w: newW, h: newH, rotation }
}

/** Scale every box in a selection proportionally to a new group bounding box. */
export function scaleBoxesToGroup(boxes: Box[], fromGroup: Box, toGroup: Box): Box[] {
  const sx = fromGroup.w === 0 ? 1 : toGroup.w / fromGroup.w
  const sy = fromGroup.h === 0 ? 1 : toGroup.h / fromGroup.h
  return boxes.map((b) => ({
    x: toGroup.x + (b.x - fromGroup.x) * sx,
    y: toGroup.y + (b.y - fromGroup.y) * sy,
    w: b.w * sx,
    h: b.h * sy,
    rotation: b.rotation,
  }))
}

interface SnapMatch {
  delta: number
  line: number
}

function bestSnap(edges: number[], targets: number[], threshold: number): SnapMatch | null {
  let best: SnapMatch | null = null
  for (const e of edges) {
    for (const t of targets) {
      const d = t - e
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) {
        best = { delta: d, line: t }
      }
    }
  }
  return best
}

export interface SnapResult {
  dx: number
  dy: number
  linesX: number[]
  linesY: number[]
}

/** Snap a moving box's edges/center against the canvas guides and other elements. */
export function snapMove(
  box: Box,
  others: Box[],
  canvasW: number,
  canvasH: number,
  threshold = SNAP_THRESHOLD,
): SnapResult {
  const targetsX = [0, canvasW / 2, canvasW, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])]
  const targetsY = [0, canvasH / 2, canvasH, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]
  const edgesX = [box.x, box.x + box.w / 2, box.x + box.w]
  const edgesY = [box.y, box.y + box.h / 2, box.y + box.h]
  const sx = bestSnap(edgesX, targetsX, threshold)
  const sy = bestSnap(edgesY, targetsY, threshold)
  return {
    dx: sx ? sx.delta : 0,
    dy: sy ? sy.delta : 0,
    linesX: sx ? [sx.line] : [],
    linesY: sy ? [sy.line] : [],
  }
}

/** Snap the free (moving) edges of a just-resized, axis-aligned box. */
export function snapResize(
  box: Box,
  handle: HandleId,
  others: Box[],
  canvasW: number,
  canvasH: number,
  threshold = SNAP_THRESHOLD,
): SnapResult {
  if (box.rotation) return { dx: 0, dy: 0, linesX: [], linesY: [] }
  const targetsX = [0, canvasW / 2, canvasW, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])]
  const targetsY = [0, canvasH / 2, canvasH, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]
  const linesX: number[] = []
  const linesY: number[] = []
  let dx = 0
  let dy = 0
  if (handle.includes('e')) {
    const s = bestSnap([box.x + box.w], targetsX, threshold)
    if (s) {
      dx = s.delta
      linesX.push(s.line)
    }
  } else if (handle.includes('w')) {
    const s = bestSnap([box.x], targetsX, threshold)
    if (s) {
      dx = s.delta
      linesX.push(s.line)
    }
  }
  if (handle.includes('s')) {
    const s = bestSnap([box.y + box.h], targetsY, threshold)
    if (s) {
      dy = s.delta
      linesY.push(s.line)
    }
  } else if (handle.includes('n')) {
    const s = bestSnap([box.y], targetsY, threshold)
    if (s) {
      dy = s.delta
      linesY.push(s.line)
    }
  }
  return { dx, dy, linesX, linesY }
}

export function angleFromCenter(center: Pt, pointer: Pt): number {
  const raw = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90
  return ((raw % 360) + 360) % 360
}

export function snapRotation(deg: number, snapDeg = ROTATE_SNAP_DEG): number {
  const candidates = [0, 90, 180, 270, 360]
  for (const c of candidates) {
    if (Math.abs(deg - c) <= snapDeg) return c % 360
  }
  return Math.round(deg * 10) / 10
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
