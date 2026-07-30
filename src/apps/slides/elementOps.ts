// Pure helpers for element mutation: patching, z-order, duplication and
// clipboard paste offsets. Kept free of React/state so SlidesApp and Toolbar
// can share the exact same logic.

import type { ImageElement, LinkedTableElement, ShapeElement, SlideElement, TextElement } from '../../shared/types'
import { SLIDE_H, SLIDE_W, uid } from '../../shared/types'
import { boundingBox, toBox } from './geom'
import type { LinkClipboardPayload } from '../../shared/livelink'

/** A loose patch bag covering every element-kind field; applied then cast back. */
export type ElementPatch = Partial<TextElement> & Partial<ShapeElement> & Partial<ImageElement> & Partial<LinkedTableElement>

export function applyPatch(el: SlideElement, patch: ElementPatch): SlideElement {
  return { ...el, ...patch } as SlideElement
}

export function patchElements(elements: SlideElement[], ids: string[], patch: ElementPatch): SlideElement[] {
  const set = new Set(ids)
  return elements.map((el) => (set.has(el.id) ? applyPatch(el, patch) : el))
}

export type ZOrderAction = 'front' | 'forward' | 'backward' | 'back'

export function reorderZ(elements: SlideElement[], ids: string[], action: ZOrderAction): SlideElement[] {
  const set = new Set(ids)
  const arr = [...elements]
  if (action === 'front' || action === 'back') {
    const moving = arr.filter((el) => set.has(el.id))
    const rest = arr.filter((el) => !set.has(el.id))
    return action === 'front' ? [...rest, ...moving] : [...moving, ...rest]
  }
  // forward/backward: move each selected element one step, preserving relative order
  const indices = arr.map((el, i) => (set.has(el.id) ? i : -1)).filter((i) => i >= 0)
  if (action === 'forward') {
    for (let k = indices.length - 1; k >= 0; k--) {
      const i = indices[k]
      if (i < arr.length - 1 && !set.has(arr[i + 1].id)) {
        ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
      }
    }
  } else {
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k]
      if (i > 0 && !set.has(arr[i - 1].id)) {
        ;[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
      }
    }
  }
  return arr
}

export function cloneWithNewId(el: SlideElement, dx = 0, dy = 0): SlideElement {
  return { ...el, id: uid(), x: el.x + dx, y: el.y + dy }
}

export function duplicateElements(elements: SlideElement[], ids: string[]): { elements: SlideElement[]; newIds: string[] } {
  const set = new Set(ids)
  const clones: SlideElement[] = []
  for (const el of elements) {
    if (set.has(el.id)) {
      const clone = cloneWithNewId(el, 16, 16)
      clones.push(clone)
    }
  }
  return { elements: [...elements, ...clones], newIds: clones.map((c) => c.id) }
}

// ---------- align & distribute ----------

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/**
 * Align selected elements. With a single element selected, aligns to the canvas
 * (SLIDE_W x SLIDE_H); with multiple, aligns to the selection's own bounding box.
 */
export function alignElements(elements: SlideElement[], ids: string[], mode: AlignMode): SlideElement[] {
  if (ids.length < 1) return elements
  const set = new Set(ids)
  const boxes = elements.filter((el) => set.has(el.id)).map(toBox)
  if (!boxes.length) return elements
  const ref = ids.length === 1 ? { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, rotation: 0 } : boundingBox(boxes)
  return elements.map((el) => {
    if (!set.has(el.id)) return el
    switch (mode) {
      case 'left':
        return { ...el, x: ref.x }
      case 'center':
        return { ...el, x: ref.x + ref.w / 2 - el.w / 2 }
      case 'right':
        return { ...el, x: ref.x + ref.w - el.w }
      case 'top':
        return { ...el, y: ref.y }
      case 'middle':
        return { ...el, y: ref.y + ref.h / 2 - el.h / 2 }
      case 'bottom':
        return { ...el, y: ref.y + ref.h - el.h }
      default:
        return el
    }
  })
}

/** Distribute >= 3 selected elements with equal gaps between them; outermost two stay put. */
export function distributeElements(elements: SlideElement[], ids: string[], axis: 'horizontal' | 'vertical'): SlideElement[] {
  if (ids.length < 3) return elements
  const set = new Set(ids)
  const key = axis === 'horizontal' ? 'x' : 'y'
  const size = axis === 'horizontal' ? 'w' : 'h'
  const selected = elements.filter((el) => set.has(el.id))
  const sorted = [...selected].sort((a, b) => a[key] - b[key])
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const span = last[key] + last[size] - first[key]
  const totalSize = sorted.reduce((sum, el) => sum + el[size], 0)
  const gap = (span - totalSize) / (sorted.length - 1)
  const nextPos = new Map<string, number>()
  let cursor = first[key]
  for (const el of sorted) {
    nextPos.set(el.id, cursor)
    cursor += el[size] + gap
  }
  return elements.map((el) => (nextPos.has(el.id) ? { ...el, [key]: nextPos.get(el.id)! } : el))
}

export function clampToCanvas(el: SlideElement): SlideElement {
  const w = Math.min(el.w, SLIDE_W)
  const h = Math.min(el.h, SLIDE_H)
  const x = Math.max(0, Math.min(el.x, SLIDE_W - w))
  const y = Math.max(0, Math.min(el.y, SLIDE_H - h))
  return { ...el, x, y, w, h }
}

// ---------- text list mode (none / bullets / numbered) ----------

export type ListMode = 'none' | 'bullets' | 'numbered'

export function currentListMode(el: Pick<TextElement, 'bullets' | 'numbered'>): ListMode {
  if (el.numbered) return 'numbered'
  if (el.bullets) return 'bullets'
  return 'none'
}

/** Cycles none -> bullets -> numbered -> none. Always sets both fields so the two never disagree. */
export function nextListPatch(mode: ListMode): Pick<TextElement, 'bullets' | 'numbered'> {
  if (mode === 'none') return { bullets: true, numbered: false }
  if (mode === 'bullets') return { bullets: false, numbered: true }
  return { bullets: false, numbered: false }
}

// ---------- clear formatting ----------

/**
 * Resets text styling to theme defaults by clearing every override — SlideView's
 * own fallbacks (theme.bodyFont/bodyColor, 24px, not bold/italic/underlined,
 * 1.25 line height) then take over. Position, size and text are untouched.
 */
export function clearTextFormatting(): Pick<
  TextElement,
  'fontFamily' | 'fontSize' | 'color' | 'bold' | 'italic' | 'underline' | 'lineHeight'
> {
  return {
    fontFamily: undefined,
    fontSize: undefined,
    color: undefined,
    bold: undefined,
    italic: undefined,
    underline: undefined,
    lineHeight: undefined,
  }
}

export function defaultTextElement(x: number, y: number): TextElement {
  return {
    id: uid(),
    kind: 'text',
    x,
    y,
    w: 420,
    h: 90,
    text: 'Text',
    fontSize: 28,
    align: 'left',
    valign: 'top',
  }
}

export function defaultShapeElement(kind: ShapeElement['shape'], x: number, y: number): ShapeElement {
  return {
    id: uid(),
    kind: 'shape',
    shape: kind,
    x,
    y,
    w: kind === 'line' ? 260 : 220,
    h: kind === 'line' ? 4 : 170,
    fill: '#2563eb',
    stroke: kind === 'line' ? '#2563eb' : undefined,
    strokeWidth: kind === 'line' ? 3 : 0,
  }
}

export function defaultImageElement(src: string, x: number, y: number, w: number, h: number): ImageElement {
  return { id: uid(), kind: 'image', src, x, y, w, h }
}

// ---------- linked table (live range from Anleo Sheets) ----------

const LINK_ROW_H = 34
const LINK_MIN_COL_W = 90
const LINK_MAX_COL_W = 220

/** Builds a LinkedTableElement sized to the clipboard payload's data, centered on the canvas. */
export function defaultLinkedTableElement(payload: LinkClipboardPayload, headerRow = true): LinkedTableElement {
  const cols = Math.max(1, payload.rows[0]?.length ?? 1)
  const rowCount = Math.max(1, payload.rows.length)
  const colW = Math.min(LINK_MAX_COL_W, Math.max(LINK_MIN_COL_W, (SLIDE_W - 160) / cols))
  const w = Math.min(SLIDE_W - 80, Math.round(colW * cols))
  const h = Math.min(SLIDE_H - 80, Math.round(LINK_ROW_H * rowCount))
  return {
    id: uid(),
    kind: 'linked',
    x: Math.round(SLIDE_W / 2 - w / 2),
    y: Math.round(SLIDE_H / 2 - h / 2),
    w,
    h,
    fontSize: 16,
    link: {
      sourceId: payload.sourceId,
      sourceTitle: payload.sourceTitle,
      sheetName: payload.sheetName,
      range: payload.range,
      headerRow,
      snapshot: payload.rows,
      refreshedAt: Date.now(),
    },
  }
}
