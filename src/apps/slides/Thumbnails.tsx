// Left rail: live thumbnails, click to select, pointer-drag to reorder (with a
// drop indicator), right-click context menu, and the "+ New slide" layout picker.

import React, { useRef, useState } from 'react'
import type { Slide, SlidesTheme } from '../../shared/types'
import { SLIDE_W } from '../../shared/types'
import { Popover } from '../../shared/ui'
import { IcPlus, IcTrash } from '../../shared/icons'
import { SlideView } from './SlideView'
import { ContextMenu } from './ContextMenu'
import { LAYOUTS } from './layouts'
import { IcDuplicate } from './icons'

// Wrap is 148px wide with 4px padding + 2px selection border per side, so the
// slide itself must render at the inner content width or it pokes outside the
// selection outline.
const THUMB_INNER_W = 136
const THUMB_SCALE = THUMB_INNER_W / SLIDE_W
const LAYOUT_PREVIEW_SCALE = 122 / SLIDE_W

export function Thumbnails({
  slides,
  theme,
  activeId,
  showSlideNumbers,
  onSelect,
  onReorder,
  onAddSlide,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  slides: Slide[]
  theme: SlidesTheme
  activeId: string
  showSlideNumbers?: boolean
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, dropIndex: number) => void
  onAddSlide: (layoutId: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const addBtnRef = useRef<HTMLButtonElement | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null)

  function computeDropIndex(clientY: number): number {
    const rail = railRef.current
    if (!rail) return slides.length
    const items = Array.from(rail.querySelectorAll<HTMLElement>('[data-thumb-index]'))
    for (const item of items) {
      const rect = item.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return Number(item.dataset.thumbIndex)
    }
    return slides.length
  }

  function handlePointerDown(e: React.PointerEvent, id: string, index: number) {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        dragging = true
        setDragId(id)
      }
      if (dragging) setOverIndex(computeDropIndex(ev.clientY))
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (dragging) {
        const drop = computeDropIndex(ev.clientY)
        if (drop !== index && drop !== index + 1) onReorder(index, drop)
      } else {
        onSelect(id)
      }
      setDragId(null)
      setOverIndex(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="px-rail">
      <button
        ref={addBtnRef}
        className="btn primary px-add-slide"
        onClick={() => setLayoutOpen((o) => !o)}
      >
        <IcPlus /> New slide
      </button>
      {layoutOpen && (
        <Popover anchor={addBtnRef.current} onClose={() => setLayoutOpen(false)} width={286}>
          <div className="popover-label">Choose a layout</div>
          <div className="px-layout-grid">
            {LAYOUTS.map((l) => {
              const preview = l.build(theme)
              return (
                <button
                  key={l.id}
                  className="px-layout-card"
                  onClick={() => {
                    onAddSlide(l.id)
                    setLayoutOpen(false)
                  }}
                >
                  <SlideView
                    slide={{ id: 'preview-' + l.id, elements: preview.elements, background: preview.background }}
                    theme={theme}
                    scale={LAYOUT_PREVIEW_SCALE}
                  />
                  <span>{l.name}</span>
                </button>
              )
            })}
          </div>
        </Popover>
      )}

      <div className="px-rail-scroll" ref={railRef}>
        {slides.map((s, i) => (
          <React.Fragment key={s.id}>
            {dragId && overIndex === i && <div className="px-drop-line" />}
            <div
              className={'px-thumb-wrap' + (s.id === activeId ? ' active' : '') + (dragId === s.id ? ' dragging' : '')}
              data-thumb-index={i}
              onPointerDown={(e) => handlePointerDown(e, s.id, i)}
              onContextMenu={(e) => {
                e.preventDefault()
                onSelect(s.id)
                setCtxMenu({ x: e.clientX, y: e.clientY, id: s.id })
              }}
            >
              <span className="px-thumb-num">{i + 1}</span>
              <SlideView
                slide={s}
                theme={theme}
                scale={THUMB_SCALE}
                className="px-thumb"
                pageNumber={showSlideNumbers && i > 0 ? i + 1 : undefined}
              />
            </div>
          </React.Fragment>
        ))}
        {dragId && overIndex === slides.length && <div className="px-drop-line" />}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: 'Duplicate slide', icon: <IcDuplicate />, onClick: () => onDuplicate(ctxMenu.id) },
            { label: 'Move up', onClick: () => onMoveUp(ctxMenu.id), disabled: slides[0]?.id === ctxMenu.id },
            {
              label: 'Move down',
              onClick: () => onMoveDown(ctxMenu.id),
              disabled: slides[slides.length - 1]?.id === ctxMenu.id,
            },
            'sep',
            {
              label: 'Delete slide',
              icon: <IcTrash />,
              danger: true,
              onClick: () => onDelete(ctxMenu.id),
              disabled: slides.length <= 1,
            },
          ]}
        />
      )}
    </div>
  )
}
