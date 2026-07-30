// Interactive node view for the "liveRange" atom node: a real table of the
// cached snapshot plus a caption bar (source label, last-refreshed time,
// Refresh, Unlink). Refresh re-resolves every live range in the document as
// one undo step (see liveRangeRefresh.ts) — clicking it on any one node
// refreshes them all, which is what keeps "refresh" simple to reason about.
// Unlink swaps this node for a plain static table of its current values.

import React, { useState } from 'react'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { linkLabel, type LiveLink } from '../../shared/livelink'
import { timeAgo } from '../../shared/util'
import { refreshLiveRanges } from './liveRangeRefresh'

function staticTableContent(link: LiveLink): JSONContent {
  const rows = link.snapshot?.length ? link.snapshot : [['']]
  return {
    type: 'table',
    content: rows.map((row, ri) => ({
      type: 'tableRow',
      content: (row.length ? row : ['']).map((cell) => ({
        type: link.headerRow && ri === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph', ...(cell ? { content: [{ type: 'text', text: cell }] } : {}) }],
      })),
    })),
  }
}

export function LiveRangeView(props: ReactNodeViewProps<HTMLElement>) {
  const { node, editor, getPos } = props
  const link = (node.attrs.link as LiveLink | null) ?? null
  const warning = (node.attrs.warning as string | null) ?? null
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refreshLiveRanges(editor)
    } finally {
      setRefreshing(false)
    }
  }

  const doUnlink = () => {
    if (!link) return
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos == null) return
    const current = editor.state.doc.nodeAt(pos)
    if (!current) return
    editor
      .chain()
      .focus()
      .insertContentAt({ from: pos, to: pos + current.nodeSize }, staticTableContent(link))
      .run()
  }

  if (!link) {
    return (
      <NodeViewWrapper className="dx-liverange" contentEditable={false}>
        <div className="dx-liverange-broken">This live range lost its source data.</div>
      </NodeViewWrapper>
    )
  }

  const rows = link.snapshot ?? []
  const header = link.headerRow ? rows[0] : null
  const body = link.headerRow ? rows.slice(1) : rows

  return (
    <NodeViewWrapper className="dx-liverange" contentEditable={false}>
      <div className="dx-liverange-scroll">
        <table className="dx-liverange-table">
          {header && (
            <thead>
              <tr>
                {header.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.length ? (
              body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci}>{c}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="dx-liverange-empty">No data in this range</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {warning && <div className="dx-liverange-warning">{warning}</div>}
      <div className="dx-liverange-caption">
        <span className="dx-liverange-source" title={linkLabel(link)}>
          {linkLabel(link)}
        </span>
        <span className="dx-liverange-dot">·</span>
        <span>Updated {timeAgo(link.refreshedAt)}</span>
        <span className="dx-liverange-spacer" />
        <button
          type="button"
          className="dx-liverange-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={doRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <button type="button" className="dx-liverange-btn" onMouseDown={(e) => e.stopPropagation()} onClick={doUnlink}>
          Unlink
        </button>
      </div>
    </NodeViewWrapper>
  )
}
