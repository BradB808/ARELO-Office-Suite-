// Slim status bar under the page: live word/character counts, reading time,
// and quick page setup (margins + PDF page numbers) + zoom controls.

import React, { useRef, useState } from 'react'
import { Select, Popover, Segmented } from '../../shared/ui'
import { IcPageSetup } from './icons'

export const MARGIN_PRESETS: { value: string; label: string; px: number }[] = [
  { value: 'normal', label: 'Normal', px: 72 },
  { value: 'narrow', label: 'Narrow', px: 40 },
  { value: 'wide', label: 'Wide', px: 110 },
]

export const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200]

export function marginPresetValue(px: number): string {
  return MARGIN_PRESETS.find((m) => m.px === px)?.value ?? 'normal'
}

function PageSetupMenu({
  marginPx,
  onMarginChange,
  pageNumbers,
  onPageNumbersChange,
}: {
  marginPx: number
  onMarginChange: (px: number) => void
  pageNumbers: boolean
  onPageNumbersChange: (v: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const preset = MARGIN_PRESETS.find((m) => m.px === marginPx) ?? MARGIN_PRESETS[0]

  return (
    <>
      <button
        ref={btnRef}
        className="select-trigger"
        style={{ height: 26, gap: 6 }}
        title="Page setup"
        onClick={() => setOpen((o) => !o)}
      >
        <IcPageSetup />
        <span>{preset.label}</span>
      </button>
      {open && (
        <Popover anchor={btnRef.current} onClose={() => setOpen(false)} width={220}>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div className="popover-label" style={{ padding: '0 0 6px' }}>
                Margins
              </div>
              <Segmented
                value={marginPresetValue(marginPx)}
                onChange={(v) => {
                  const p = MARGIN_PRESETS.find((m) => m.value === v)
                  if (p) onMarginChange(p.px)
                }}
                options={MARGIN_PRESETS.map((m) => ({ value: m.value, label: m.label }))}
              />
            </div>
            <div className="popover-sep" style={{ margin: 0 }} />
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={pageNumbers}
                onChange={(e) => onPageNumbersChange(e.target.checked)}
              />
              Page numbers in PDF
            </label>
          </div>
        </Popover>
      )}
    </>
  )
}

export function StatusBar({
  words,
  characters,
  marginPx,
  onMarginChange,
  pageNumbers,
  onPageNumbersChange,
  zoom,
  onZoomChange,
}: {
  words: number
  characters: number
  marginPx: number
  onMarginChange: (px: number) => void
  pageNumbers: boolean
  onPageNumbersChange: (v: boolean) => void
  zoom: number
  onZoomChange: (z: number) => void
}) {
  const readingMinutes = Math.max(1, Math.round(words / 200))

  return (
    <div className="dx-statusbar">
      <span>{words.toLocaleString()} words</span>
      <span className="dx-statusbar-dot" />
      <span>{characters.toLocaleString()} characters</span>
      <span className="dx-statusbar-dot" />
      <span>{readingMinutes} min read</span>
      <div style={{ flex: 1 }} />
      <PageSetupMenu
        marginPx={marginPx}
        onMarginChange={onMarginChange}
        pageNumbers={pageNumbers}
        onPageNumbersChange={onPageNumbersChange}
      />
      <span className="dx-statusbar-label">Zoom</span>
      <Select
        compact
        value={String(zoom)}
        onChange={(v) => onZoomChange(Number(v))}
        width={76}
        options={ZOOM_LEVELS.map((z) => ({ value: String(z), label: `${z}%` }))}
      />
    </div>
  )
}
