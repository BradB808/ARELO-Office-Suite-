import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MenuItem } from '../../shared/ui'

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: (MenuItem | 'sep' | { header: string })[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ top: y, left: x })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setPos({
      top: Math.min(y, window.innerHeight - h - 8),
      left: Math.min(x, window.innerWidth - w - 8),
    })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="sx-ctxmenu popover" ref={ref} style={{ top: pos.top, left: pos.left }}>
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="popover-sep" />
        ) : 'header' in it ? (
          <div key={i} className="popover-label">
            {it.header}
          </div>
        ) : (
          <button
            key={i}
            className={'popover-item' + (it.danger ? ' danger' : '')}
            disabled={it.disabled}
            onClick={() => {
              onClose()
              it.onClick()
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
