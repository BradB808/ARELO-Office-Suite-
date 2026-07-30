// Floating find & replace card for the active sheet. Searches raw cell values
// AND computed displays (so a formula matches on its result text too), case-
// insensitively. Replace / replace-all rewrite the RAW value (formulas are
// treated as plain text) and go through the caller's undo-snapshot commit path.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Sheet } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { parseCellRef, refToString } from './engine/refs'
import { IcClose } from '../../shared/icons'
import { computeFilterHiddenRows } from './filter'
import type { CellPos } from './types'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface SheetMatch {
  row: number
  col: number
}

// Rows/cols hidden via the explicit hide feature OR collapsed by an active
// column filter are invisible in the grid — find/replace must skip over them
// (never jump the selection to, or silently rewrite, a cell the user can't
// see) rather than surface them as a match.
function findMatches(
  sheet: Sheet,
  computed: Map<string, ComputedCell>,
  query: string,
  hiddenRows: Set<number>,
  hiddenCols: Set<number>,
): SheetMatch[] {
  if (!query) return []
  const q = query.toLowerCase()
  const out: SheetMatch[] = []
  for (const key of Object.keys(sheet.cells)) {
    const cell = sheet.cells[key]
    if (!cell) continue
    const p = parseCellRef(key)
    if (!p) continue
    if (hiddenRows.has(p.row) || hiddenCols.has(p.col)) continue
    const raw = cell.v ?? ''
    const disp = computed.get(refToString(p.col, p.row))?.display ?? ''
    if (raw.toLowerCase().includes(q) || disp.toLowerCase().includes(q)) out.push({ row: p.row, col: p.col })
  }
  out.sort((a, b) => (a.row - b.row) || (a.col - b.col))
  return out
}

export default function FindReplace({
  sheet,
  computed,
  initialQuery,
  onJump,
  onReplaceCell,
  onReplaceAll,
  onClose,
}: {
  sheet: Sheet
  computed: Map<string, ComputedCell>
  initialQuery: string
  onJump: (pos: CellPos) => void
  onReplaceCell: (pos: CellPos, nextRaw: string) => void
  onReplaceAll: (patch: { pos: CellPos; nextRaw: string }[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const findInputRef = useRef<HTMLInputElement | null>(null)

  const hiddenRowSet = useMemo(() => {
    const set = new Set(sheet.hiddenRows ?? [])
    for (const r of computeFilterHiddenRows(sheet, computed)) set.add(r)
    return set
  }, [sheet, computed])
  const hiddenColSet = useMemo(() => new Set(sheet.hiddenCols ?? []), [sheet.hiddenCols])
  const matches = useMemo(
    () => findMatches(sheet, computed, query, hiddenRowSet, hiddenColSet),
    [sheet, computed, query, hiddenRowSet, hiddenColSet],
  )
  const clampedActive = matches.length ? Math.min(activeIndex, matches.length - 1) : 0

  useEffect(() => {
    findInputRef.current?.focus()
    findInputRef.current?.select()
  }, [])

  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(0)
  }, [matches.length, activeIndex])

  // Jump the grid selection to the active match whenever it changes.
  useEffect(() => {
    if (matches.length) onJump({ row: matches[clampedActive].row, col: matches[clampedActive].col })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, clampedActive])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const goNext = () => {
    if (!matches.length) return
    setActiveIndex((i) => (i + 1) % matches.length)
  }
  const goPrev = () => {
    if (!matches.length) return
    setActiveIndex((i) => (i - 1 + matches.length) % matches.length)
  }

  function replacedRaw(raw: string): string {
    if (!query) return raw
    return raw.replace(new RegExp(escapeRegExp(query), 'gi'), replacement)
  }

  const doReplace = () => {
    if (!matches.length) return
    const m = matches[clampedActive]
    const raw = sheet.cells[refToString(m.col, m.row)]?.v ?? ''
    onReplaceCell({ row: m.row, col: m.col }, replacedRaw(raw))
  }

  const doReplaceAll = () => {
    if (!matches.length) return
    const patch = matches.map((m) => ({
      pos: { row: m.row, col: m.col },
      nextRaw: replacedRaw(sheet.cells[refToString(m.col, m.row)]?.v ?? ''),
    }))
    onReplaceAll(patch)
  }

  return (
    <div className="sx-findbar" onMouseDown={(e) => e.stopPropagation()}>
      <div className="sx-findbar-row">
        <button
          className="sx-findbar-toggle"
          title={showReplace ? 'Hide replace' : 'Show replace'}
          onClick={() => setShowReplace((s) => !s)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: showReplace ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}>
            <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          ref={findInputRef}
          className="sx-findbar-input"
          placeholder="Find in sheet"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) goPrev()
              else goNext()
            }
          }}
        />
        <span className="sx-findbar-count">{matches.length ? `${clampedActive + 1}/${matches.length}` : query ? '0/0' : ''}</span>
        <button className="iconbtn" title="Previous match" disabled={!matches.length} onClick={goPrev}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="iconbtn" title="Next match" disabled={!matches.length} onClick={goNext}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="iconbtn" title="Close find & replace" onClick={onClose}>
          <IcClose />
        </button>
      </div>
      {showReplace && (
        <div className="sx-findbar-row">
          <span style={{ width: 16, flexShrink: 0 }} />
          <input
            className="sx-findbar-input"
            placeholder="Replace with"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                doReplace()
              }
            }}
          />
          <button className="btn small" disabled={!matches.length} onClick={doReplace}>
            Replace
          </button>
          <button className="btn small" disabled={!matches.length} onClick={doReplaceAll}>
            Replace all
          </button>
        </div>
      )}
    </div>
  )
}
