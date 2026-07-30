// Cmd+K command palette: every action in the suite, one keystroke away.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCommands, searchCommands, subscribeCommands, type Command } from '../shared/commands'
import { IcSearch } from '../shared/icons'

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [version, setVersion] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => subscribeCommands(() => setVersion((v) => v + 1)), [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const results = useMemo(() => {
    void version
    return searchCommands(getCommands(), query).slice(0, 60)
  }, [query, version, open])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)))
  }, [results.length])

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const run = (cmd: Command | undefined) => {
    if (!cmd) return
    onClose()
    // Let the palette unmount before the command steals focus.
    setTimeout(() => void cmd.run(), 0)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % Math.max(results.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + results.length) % Math.max(results.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(results[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Group headers, preserving result order.
  const rows: { type: 'group'; label: string }[] | ({ type: 'cmd'; cmd: Command; idx: number } | { type: 'group'; label: string })[] = []
  let lastGroup = ''
  results.forEach((cmd, idx) => {
    if (cmd.group !== lastGroup) {
      lastGroup = cmd.group
      ;(rows as { type: 'group'; label: string }[]).push({ type: 'group', label: cmd.group })
    }
    ;(rows as { type: 'cmd'; cmd: Command; idx: number }[]).push({ type: 'cmd', cmd, idx })
  })

  return createPortal(
    <div className="cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-label="Command palette">
        <div className="cmdk-search">
          <IcSearch />
          <input
            autoFocus
            className="cmdk-input"
            placeholder="Search commands and documents…"
            value={query}
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="cmdk-empty">No matching commands</div>
          ) : (
            (rows as ({ type: 'cmd'; cmd: Command; idx: number } | { type: 'group'; label: string })[]).map((row, i) =>
              row.type === 'group' ? (
                <div key={'g' + i} className="cmdk-group">
                  {row.label}
                </div>
              ) : (
                <button
                  key={row.cmd.id}
                  data-idx={row.idx}
                  className={'cmdk-row' + (row.idx === active ? ' on' : '')}
                  onMouseMove={() => setActive(row.idx)}
                  onClick={() => run(row.cmd)}
                >
                  <span className="cmdk-title">{row.cmd.title}</span>
                  {row.cmd.hint && <span className="cmdk-hint">{row.cmd.hint}</span>}
                </button>
              ),
            )
          )}
        </div>
        <div className="cmdk-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> run
          </span>
          <span>
            <span className="kbd">⌘K</span> anywhere
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
