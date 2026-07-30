import React from 'react'
import { IcFunction } from './icons'

export default function FormulaBar({
  refLabel,
  value,
  onFocus,
  onChange,
  onCommit,
  onCancel,
  inputRef,
}: {
  refLabel: string
  value: string
  onFocus: () => void
  onChange: (v: string) => void
  onCommit: (moveDir: 'down' | 'up' | 'right' | 'left' | 'none') => void
  onCancel: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="sx-formulabar">
      <div className="sx-refbox">{refLabel}</div>
      <div className="sx-fx">
        <IcFunction />
        <input
          ref={inputRef}
          className="sx-fx-input"
          value={value}
          spellCheck={false}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onCommit(e.shiftKey ? 'up' : 'down')
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            } else if (e.key === 'Tab') {
              e.preventDefault()
              onCommit(e.shiftKey ? 'left' : 'right')
            }
          }}
        />
      </div>
    </div>
  )
}
