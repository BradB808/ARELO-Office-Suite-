// Floating find & replace card. Walks the ProseMirror doc directly to
// compute match positions, highlights every match with a decoration plugin
// (so the editor never has to steal keyboard focus from the input), and
// scrolls the active match into view. Replace / Replace all mutate the doc
// precisely via a single transaction.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { IcClose } from '../../shared/icons'

export interface DocMatch {
  from: number
  to: number
}

export function findMatchesInDoc(editor: Editor, query: string): DocMatch[] {
  if (!query) return []
  const { doc } = editor.state
  let text = ''
  const posMap: number[] = []
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) posMap.push(pos + i)
      text += node.text
    } else if (node.isBlock) {
      if (text.length && text[text.length - 1] !== '\n') {
        text += '\n'
        posMap.push(pos)
      }
    }
    return true
  })
  const hay = text.toLowerCase()
  const needle = query.toLowerCase()
  const out: DocMatch[] = []
  let from = 0
  while (true) {
    const idx = hay.indexOf(needle, from)
    if (idx === -1) break
    out.push({ from: posMap[idx], to: posMap[idx + needle.length - 1] + 1 })
    from = idx + needle.length
  }
  return out
}

const highlightKey = new PluginKey('dx-find-highlight')

function highlightPlugin(): Plugin {
  return new Plugin({
    key: highlightKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const meta = tr.getMeta(highlightKey) as { matches: DocMatch[]; active: number } | undefined
        if (meta) {
          const decos = meta.matches.map((m, i) =>
            Decoration.inline(m.from, m.to, {
              class: i === meta.active ? 'dx-find-hit dx-find-hit-active' : 'dx-find-hit',
            }),
          )
          return DecorationSet.create(tr.doc, decos)
        }
        return old.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations(state) {
        return highlightKey.getState(state)
      },
    },
  })
}

function replaceAllMatches(editor: Editor, matches: DocMatch[], replacement: string) {
  let tr = editor.state.tr
  for (let i = matches.length - 1; i >= 0; i--) {
    tr = tr.insertText(replacement, matches[i].from, matches[i].to)
  }
  editor.view.dispatch(tr)
}

export function FindReplace({
  editor,
  initialQuery,
  onClose,
}: {
  editor: Editor
  initialQuery: string
  onClose: () => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [tick, setTick] = useState(0)
  const findInputRef = useRef<HTMLInputElement | null>(null)

  const matches = useMemo(() => findMatchesInDoc(editor, query), [editor, query, tick])
  const clampedActive = matches.length ? Math.min(activeIndex, matches.length - 1) : 0

  // Register the highlight plugin once, tear it down on close.
  useEffect(() => {
    editor.registerPlugin(highlightPlugin())
    return () => {
      editor.unregisterPlugin(highlightKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  useEffect(() => {
    findInputRef.current?.focus()
    findInputRef.current?.select()
  }, [])

  useEffect(() => {
    const onUpdate = () => setTick((t) => t + 1)
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor])

  // Push the current match set into the decoration plugin + scroll the active
  // one into view, without touching DOM focus or the real text selection.
  useEffect(() => {
    const tr = editor.state.tr.setMeta(highlightKey, { matches, active: clampedActive })
    tr.setMeta('addToHistory', false)
    editor.view.dispatch(tr)
    if (matches.length) {
      const m = matches[clampedActive]
      try {
        const dom = editor.view.domAtPos(m.from)
        const el = (dom.node.nodeType === 3 ? dom.node.parentElement : (dom.node as Element)) as Element | null
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {
        // position no longer valid (doc changed mid-scroll) — ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, clampedActive, editor])

  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(0)
  }, [matches.length, activeIndex])

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

  const doReplace = () => {
    if (!matches.length) return
    const m = matches[clampedActive]
    const tr = editor.state.tr.insertText(replacement, m.from, m.to)
    editor.view.dispatch(tr)
    setTick((t) => t + 1)
  }

  const doReplaceAll = () => {
    if (!matches.length) return
    replaceAllMatches(editor, matches, replacement)
    setTick((t) => t + 1)
  }

  return (
    <div className="dx-findbar" onMouseDown={(e) => e.stopPropagation()}>
      <div className="dx-findbar-row">
        <button
          className="dx-findbar-toggle"
          title={showReplace ? 'Hide replace' : 'Show replace'}
          onClick={() => setShowReplace((s) => !s)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: showReplace ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}>
            <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          ref={findInputRef}
          className="dx-findbar-input"
          placeholder="Find in document"
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
        <span className="dx-findbar-count">{matches.length ? `${clampedActive + 1}/${matches.length}` : query ? '0/0' : ''}</span>
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
        <div className="dx-findbar-row">
          <span style={{ width: 16, flexShrink: 0 }} />
          <input
            className="dx-findbar-input"
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
