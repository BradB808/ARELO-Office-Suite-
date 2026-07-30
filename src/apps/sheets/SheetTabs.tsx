import React, { useState } from 'react'
import type { Sheet } from '../../shared/types'
import { IcPlus, IcClose } from '../../shared/icons'

export default function SheetTabs({
  sheets,
  active,
  onSwitch,
  onAdd,
  onRename,
  onDelete,
}: {
  sheets: Sheet[]
  active: number
  onSwitch: (i: number) => void
  onAdd: () => void
  onRename: (i: number, name: string) => void
  onDelete: (i: number) => void
}) {
  const [renaming, setRenaming] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <div className="sx-tabs">
      {sheets.map((s, i) => (
        <div
          key={i}
          className={'sx-tab' + (i === active ? ' active' : '')}
          onClick={() => onSwitch(i)}
          onDoubleClick={() => {
            setRenaming(i)
            setDraft(s.name)
          }}
          title={s.name}
        >
          {renaming === i ? (
            <input
              className="sx-tab-input"
              autoFocus
              value={draft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (draft.trim()) onRename(i, draft.trim())
                setRenaming(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (draft.trim()) onRename(i, draft.trim())
                  setRenaming(null)
                } else if (e.key === 'Escape') {
                  setRenaming(null)
                }
              }}
            />
          ) : (
            <span className="sx-tab-name">{s.name}</span>
          )}
          {sheets.length > 1 && renaming !== i && (
            <button
              className="sx-tab-x iconbtn"
              style={{ width: 16, height: 16, minWidth: 16 }}
              title="Delete sheet"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(i)
              }}
            >
              <IcClose />
            </button>
          )}
        </div>
      ))}
      <button className="iconbtn" title="Add sheet" style={{ width: 26, height: 26, minWidth: 26, flexShrink: 0 }} onClick={onAdd}>
        <IcPlus />
      </button>
    </div>
  )
}
