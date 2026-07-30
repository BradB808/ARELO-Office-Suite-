// The interactive editing canvas. Renders the pure SlideView as the base layer
// and an interactive overlay on top (selection chrome, handles, guides,
// marquee, inline text editing) in the same logical 1280x720 coordinate space.

import React, { useRef, useState } from 'react'
import type { Slide, SlideElement, SlidesTheme } from '../../shared/types'
import { SLIDE_H, SLIDE_W } from '../../shared/types'
import { cssFamily } from '../../shared/fonts'
import { SlideView } from './SlideView'
import {
  angleFromCenter,
  boundingBox,
  boxCenter,
  moveBox,
  resizeBox,
  scaleBoxesToGroup,
  snapMove,
  snapResize,
  snapRotation,
  toBox,
  type Box,
  type HandleId,
  type Pt,
} from './geom'

const HANDLE_POS: Record<HandleId, { left: string; top: string; cursor: string }> = {
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  n: { left: '50%', top: '0%', cursor: 'ns-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  w: { left: '0%', top: '50%', cursor: 'ew-resize' },
}
const HANDLE_ORDER: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function Canvas({
  slide,
  theme,
  scale,
  pageNumber,
  selectedIds,
  onSelectedIds,
  onCommit,
  onElementContextMenu,
  linkWarnings,
}: {
  slide: Slide
  theme: SlidesTheme
  scale: number
  /** 1-based slide number chip to render, or undefined to hide it. */
  pageNumber?: number
  selectedIds: string[]
  onSelectedIds: (ids: string[]) => void
  onCommit: (elements: SlideElement[]) => void
  onElementContextMenu: (x: number, y: number, id: string) => void
  /** Linked-table element id -> resolve error from the last refresh (editor-only chip). */
  linkWarnings?: Record<string, string>
}) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [liveElements, setLiveElements] = useState<SlideElement[] | null>(null)
  const liveRef = useRef<SlideElement[] | null>(null)
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const editCommittedRef = useRef(false)

  const elements = liveElements ?? slide.elements
  const inv = 1 / scale

  function toLogical(clientX: number, clientY: number): Pt {
    const rect = stageRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
  }

  function setLive(next: SlideElement[]) {
    liveRef.current = next
    setLiveElements(next)
  }

  function endGesture(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void) {
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  // ---------- move ----------

  function beginMove(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const shift = e.shiftKey
    const wasMultiWithId = selectedIds.length > 1 && selectedIds.includes(id)
    const ids = shift
      ? selectedIds.includes(id)
        ? selectedIds
        : [...selectedIds, id]
      : selectedIds.includes(id)
        ? selectedIds
        : [id]
    onSelectedIds(ids)

    const start = toLogical(e.clientX, e.clientY)
    const baseBoxes = new Map(ids.map((i) => [i, toBox(slide.elements.find((el) => el.id === i)!)]))
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const p = toLogical(ev.clientX, ev.clientY)
      let dx = p.x - start.x
      let dy = p.y - start.y
      if (Math.hypot(dx, dy) > 2) moved = true
      const groupBase = boundingBox([...baseBoxes.values()])
      const proposed = moveBox(groupBase, dx, dy)
      const others = slide.elements.filter((el) => !ids.includes(el.id)).map(toBox)
      const snap = snapMove(proposed, others, SLIDE_W, SLIDE_H)
      dx += snap.dx
      dy += snap.dy
      setGuides({ x: snap.linesX, y: snap.linesY })
      const next = slide.elements.map((el) => {
        const b = baseBoxes.get(el.id)
        if (!b) return el
        return { ...el, x: b.x + dx, y: b.y + dy }
      })
      setLive(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      setGuides({ x: [], y: [] })
      if (moved && liveRef.current) onCommit(liveRef.current)
      else if (!moved && !shift && wasMultiWithId) onSelectedIds([id])
      liveRef.current = null
      setLiveElements(null)
    }
    endGesture(onMove, onUp)
  }

  // ---------- resize (single element) ----------

  function beginResize(e: React.PointerEvent, id: string, handle: HandleId) {
    if (e.button !== 0) return
    e.stopPropagation()
    const el0 = slide.elements.find((x) => x.id === id)!
    const box0 = toBox(el0)
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const p = toLogical(ev.clientX, ev.clientY)
      const lockAspect = el0.kind === 'image' || ev.shiftKey
      let box = resizeBox(box0, handle, p, { lockAspect })
      if (box.rotation === 0) {
        const others = slide.elements.filter((x) => x.id !== id).map(toBox)
        const snap = snapResize(box, handle, others, SLIDE_W, SLIDE_H)
        if (snap.dx) {
          box = handle.includes('e') ? { ...box, w: box.w + snap.dx } : { ...box, x: box.x + snap.dx, w: box.w - snap.dx }
        }
        if (snap.dy) {
          box = handle.includes('s') ? { ...box, h: box.h + snap.dy } : { ...box, y: box.y + snap.dy, h: box.h - snap.dy }
        }
        setGuides({ x: snap.linesX, y: snap.linesY })
      } else {
        setGuides({ x: [], y: [] })
      }
      moved = true
      const next = slide.elements.map((el) => (el.id === id ? { ...el, x: box.x, y: box.y, w: box.w, h: box.h } : el))
      setLive(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      setGuides({ x: [], y: [] })
      if (moved && liveRef.current) onCommit(liveRef.current)
      liveRef.current = null
      setLiveElements(null)
    }
    endGesture(onMove, onUp)
  }

  // ---------- resize (group, proportional) ----------

  function beginGroupResize(e: React.PointerEvent, handle: HandleId) {
    if (e.button !== 0) return
    e.stopPropagation()
    const ids = selectedIds
    const baseBoxes = ids.map((id) => toBox(slide.elements.find((el) => el.id === id)!))
    const fromGroup = boundingBox(baseBoxes)
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const p = toLogical(ev.clientX, ev.clientY)
      const toGroup = resizeBox({ ...fromGroup, rotation: 0 }, handle, p, { lockAspect: ev.shiftKey })
      const scaled = scaleBoxesToGroup(baseBoxes, fromGroup, toGroup)
      moved = true
      const next = slide.elements.map((el) => {
        const idx = ids.indexOf(el.id)
        if (idx === -1) return el
        const b = scaled[idx]
        return { ...el, x: b.x, y: b.y, w: b.w, h: b.h }
      })
      setLive(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      if (moved && liveRef.current) onCommit(liveRef.current)
      liveRef.current = null
      setLiveElements(null)
    }
    endGesture(onMove, onUp)
  }

  // ---------- rotate ----------

  function beginRotate(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const el0 = slide.elements.find((x) => x.id === id)!
    const box0 = toBox(el0)
    const center = boxCenter(box0)
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const p = toLogical(ev.clientX, ev.clientY)
      const deg = snapRotation(angleFromCenter(center, p))
      moved = true
      const next = slide.elements.map((el) => (el.id === id ? { ...el, rotation: deg } : el))
      setLive(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      if (moved && liveRef.current) onCommit(liveRef.current)
      liveRef.current = null
      setLiveElements(null)
    }
    endGesture(onMove, onUp)
  }

  // ---------- marquee ----------

  function beginMarquee(e: React.PointerEvent) {
    if (e.button !== 0) return
    const start = toLogical(e.clientX, e.clientY)
    let box = { x0: start.x, y0: start.y, x1: start.x, y1: start.y }
    setMarquee(box)

    const onMove = (ev: PointerEvent) => {
      const p = toLogical(ev.clientX, ev.clientY)
      box = { x0: start.x, y0: start.y, x1: p.x, y1: p.y }
      setMarquee(box)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      const minX = Math.min(box.x0, box.x1)
      const maxX = Math.max(box.x0, box.x1)
      const minY = Math.min(box.y0, box.y1)
      const maxY = Math.max(box.y0, box.y1)
      if (maxX - minX > 3 && maxY - minY > 3) {
        const ids = slide.elements
          .filter((el) => el.x < maxX && el.x + el.w > minX && el.y < maxY && el.y + el.h > minY)
          .map((el) => el.id)
        onSelectedIds(ids)
      } else {
        onSelectedIds([])
      }
      setMarquee(null)
    }
    endGesture(onMove, onUp)
  }

  // ---------- inline text edit ----------

  function beginEdit(el: SlideElement) {
    if (el.kind === 'image' || el.kind === 'linked') return
    onSelectedIds([el.id])
    setEditingId(el.id)
    setEditingText(el.text ?? '')
    editCommittedRef.current = false
  }

  // Blur and the stage's own pointerdown can both try to commit the same
  // edit session (a click outside the textarea blurs it AND reaches the
  // stage handler) — guard with a ref since `editingId` state won't have
  // updated yet within the same synchronous tick.
  function commitEdit() {
    if (!editingId || editCommittedRef.current) return
    editCommittedRef.current = true
    const original = slide.elements.find((el) => el.id === editingId)
    setEditingId(null)
    if (!original || original.kind === 'image' || original.kind === 'linked') return
    if (original.text === editingText) return
    const next = slide.elements.map((el) => (el.id === editingId ? { ...el, text: editingText } : el))
    onCommit(next)
  }

  // ---------- render ----------

  const single = selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) : null
  const groupBoxes = selectedIds.length > 1 ? selectedIds.map((id) => toBox(elements.find((el) => el.id === id)!)) : []
  const groupBox = groupBoxes.length ? boundingBox(groupBoxes) : null
  const editingEl = editingId ? elements.find((el) => el.id === editingId) : null

  return (
    <div
      className="px-stage"
      ref={stageRef}
      style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}
      onPointerDown={(e) => {
        if (editingId) commitEdit()
        beginMarquee(e)
      }}
    >
      <SlideView slide={{ ...slide, elements }} theme={theme} scale={scale} pageNumber={pageNumber} />

      <div
        className="px-overlay"
        style={{ position: 'absolute', left: 0, top: 0, width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {elements.map((el) => (
          <div
            key={el.id}
            className="px-el-hit"
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.w,
              height: el.h,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              cursor: editingId === el.id ? 'text' : 'move',
              visibility: editingId === el.id ? 'hidden' : 'visible',
            }}
            onPointerDown={(e) => beginMove(e, el.id)}
            onDoubleClick={() => beginEdit(el)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!selectedIds.includes(el.id)) onSelectedIds([el.id])
              onElementContextMenu(e.clientX, e.clientY, el.id)
            }}
          />
        ))}

        {linkWarnings &&
          elements.map((el) =>
            el.kind === 'linked' && linkWarnings[el.id] ? (
              <div
                key={'warn-' + el.id}
                className="px-link-warning"
                style={{
                  left: el.x + el.w - 11 * inv,
                  top: el.y - 9 * inv,
                  width: 20 * inv,
                  height: 20 * inv,
                  fontSize: 12 * inv,
                  borderWidth: 1.5 * inv,
                }}
                title={linkWarnings[el.id]}
              >
                !
              </div>
            ) : null,
          )}

        {single && !editingId && (
          <div
            style={{
              position: 'absolute',
              left: single.x,
              top: single.y,
              width: single.w,
              height: single.h,
              transform: single.rotation ? `rotate(${single.rotation}deg)` : undefined,
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, border: `${1.5 * inv}px solid var(--accent)`, pointerEvents: 'none' }} />
            {HANDLE_ORDER.map((h) => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  left: HANDLE_POS[h].left,
                  top: HANDLE_POS[h].top,
                  width: 9 * inv,
                  height: 9 * inv,
                  marginLeft: -4.5 * inv,
                  marginTop: -4.5 * inv,
                  background: 'var(--surface)',
                  border: `${1.5 * inv}px solid var(--accent)`,
                  borderRadius: 2 * inv,
                  cursor: HANDLE_POS[h].cursor,
                  pointerEvents: 'auto',
                }}
                onPointerDown={(e) => beginResize(e, single.id, h)}
              />
            ))}
            {
              // Linked tables can't rotate in the PowerPoint export (pptxgenjs
              // tables have no `rotate` option), so a rotation set here would
              // render correctly on canvas/present/print but silently reset to
              // 0 on export — an attribute that doesn't round-trip. Don't offer
              // the handle in the first place.
              single.kind !== 'linked' && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -26 * inv,
                      width: 1 * inv,
                      height: 26 * inv,
                      background: 'var(--accent)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -26 * inv,
                      width: 12 * inv,
                      height: 12 * inv,
                      marginLeft: -6 * inv,
                      marginTop: -6 * inv,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      border: `${1.5 * inv}px solid var(--surface)`,
                      cursor: 'grab',
                      pointerEvents: 'auto',
                    }}
                    onPointerDown={(e) => beginRotate(e, single.id)}
                    title="Drag to rotate"
                  />
                </>
              )
            }
          </div>
        )}

        {groupBox && (
          <div style={{ position: 'absolute', left: groupBox.x, top: groupBox.y, width: groupBox.w, height: groupBox.h }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: `${1.5 * inv}px dashed var(--accent)`,
                pointerEvents: 'none',
              }}
            />
            {groupBoxes.map((b, i) => (
              <div
                key={selectedIds[i]}
                style={{
                  position: 'absolute',
                  left: b.x - groupBox.x,
                  top: b.y - groupBox.y,
                  width: b.w,
                  height: b.h,
                  transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                  border: `${1 * inv}px solid var(--accent)`,
                  opacity: 0.6,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {HANDLE_ORDER.map((h) => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  left: HANDLE_POS[h].left,
                  top: HANDLE_POS[h].top,
                  width: 9 * inv,
                  height: 9 * inv,
                  marginLeft: -4.5 * inv,
                  marginTop: -4.5 * inv,
                  background: 'var(--surface)',
                  border: `${1.5 * inv}px solid var(--accent)`,
                  borderRadius: 2 * inv,
                  cursor: HANDLE_POS[h].cursor,
                  pointerEvents: 'auto',
                }}
                onPointerDown={(e) => beginGroupResize(e, h)}
              />
            ))}
          </div>
        )}

        {guides.x.map((gx, i) => (
          <div key={'gx' + i} className="px-guide-v" style={{ left: gx, width: 1 * inv }} />
        ))}
        {guides.y.map((gy, i) => (
          <div key={'gy' + i} className="px-guide-h" style={{ top: gy, height: 1 * inv }} />
        ))}

        {marquee && (
          <div
            className="px-marquee"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}

        {editingEl && editingEl.kind !== 'image' && editingEl.kind !== 'linked' && (
          <EditOverlay el={editingEl} theme={theme} text={editingText} onText={setEditingText} onCommit={commitEdit} />
        )}
      </div>
    </div>
  )
}

function EditOverlay({
  el,
  theme,
  text,
  onText,
  onCommit,
}: {
  el: Extract<SlideElement, { kind: 'text' | 'shape' }>
  theme: SlidesTheme
  text: string
  onText: (t: string) => void
  onCommit: () => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const isShape = el.kind === 'shape'
  const align = isShape ? 'center' : el.align || 'left'
  const valign = isShape ? 'middle' : el.valign || 'top'
  const justify = valign === 'top' ? 'flex-start' : valign === 'bottom' ? 'flex-end' : 'center'

  return (
    <div
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        padding: isShape ? '4% 8%' : 0,
        boxSizing: 'border-box',
      }}
    >
      <textarea
        ref={ref}
        autoFocus
        value={text}
        onChange={(e) => onText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            ref.current?.blur()
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          resize: 'none',
          background: 'transparent',
          border: 'none',
          outline: `1.5px dashed ${el.kind === 'text' ? el.color || theme.bodyColor : '#ffffff'}`,
          outlineOffset: 2,
          fontFamily: cssFamily(el.fontFamily || (isShape ? 'Helvetica Neue' : theme.bodyFont)),
          fontSize: el.fontSize ?? (isShape ? 18 : 24),
          color: el.color || (isShape ? '#ffffff' : theme.bodyColor),
          fontWeight: el.bold ? 700 : isShape ? 500 : 400,
          fontStyle: !isShape && el.italic ? 'italic' : 'normal',
          textAlign: align,
          lineHeight: !isShape ? (el.lineHeight ?? 1.25) : 1.25,
          overflow: 'hidden',
          minHeight: '1.4em',
          height: isShape ? '100%' : undefined,
        }}
        onInput={(e) => {
          const t = e.currentTarget
          if (!isShape) {
            t.style.height = 'auto'
            t.style.height = t.scrollHeight + 'px'
          }
        }}
      />
    </div>
  )
}
