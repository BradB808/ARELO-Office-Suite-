// Cursor-anchored context menu (right-click). Reuses the shared .popover /
// .popover-item styling from theme.css but positions at a raw (x,y) point
// instead of an element ref, which the shared Popover doesn't support.

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: (ContextMenuItem | 'sep')[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

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

  const width = 200
  const estHeight = items.length * 32 + 12
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - estHeight - 8))

  return createPortal(
    <div className="popover" ref={ref} style={{ position: 'fixed', top, left, width }}>
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="popover-sep" />
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
