// Font family dropdown: an "Install font…" action, then the user's custom
// fonts, then the curated system font list — each option rendered in its
// own font so you can preview it before applying.

import React, { useEffect, useRef, useState } from 'react'
import { Popover } from '../../shared/ui'
import { SYSTEM_FONTS, cssFamily, getCustomFonts, subscribeFonts, installFontsViaPicker } from '../../shared/fonts'
import { IcImport } from './icons'

export function FontFamilyMenu({
  value,
  onChange,
}: {
  /** Display name of the currently applied font (or a system default). */
  value: string
  onChange: (displayName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [customFonts, setCustomFonts] = useState<string[]>(getCustomFonts())
  const [installing, setInstalling] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => subscribeFonts(() => setCustomFonts(getCustomFonts())), [])

  const handleInstall = async () => {
    setInstalling(true)
    try {
      const installed = await installFontsViaPicker()
      if (installed[0]) {
        onChange(installed[0])
        setOpen(false)
      }
    } finally {
      setInstalling(false)
    }
  }

  return (
    <>
      <button ref={btnRef} className="select-trigger" style={{ width: 152 }} onClick={() => setOpen((o) => !o)} title="Font family">
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'left',
            fontFamily: cssFamily(value),
          }}
        >
          {value}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <Popover anchor={btnRef.current} onClose={() => setOpen(false)} width={230}>
          <button className="popover-item" onClick={handleInstall} disabled={installing}>
            <IcImport />
            {installing ? 'Installing…' : 'Install font…'}
          </button>
          {customFonts.length > 0 && (
            <>
              <div className="popover-sep" />
              <div className="popover-label">Custom fonts</div>
              {customFonts.map((f) => (
                <button
                  key={f}
                  className={'popover-item' + (f === value ? ' selected' : '')}
                  style={{ fontFamily: cssFamily(f) }}
                  onClick={() => {
                    onChange(f)
                    setOpen(false)
                  }}
                >
                  {f}
                </button>
              ))}
            </>
          )}
          <div className="popover-sep" />
          <div className="popover-label">System fonts</div>
          {SYSTEM_FONTS.map((f) => (
            <button
              key={f}
              className={'popover-item' + (f === value ? ' selected' : '')}
              style={{ fontFamily: cssFamily(f) }}
              onClick={() => {
                onChange(f)
                setOpen(false)
              }}
            >
              {f}
            </button>
          ))}
        </Popover>
      )}
    </>
  )
}
