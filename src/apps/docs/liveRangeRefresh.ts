// Refreshes every "liveRange" node in the document against its Anleo Sheets
// source. Runs on document open and whenever a node's "Refresh" button is
// clicked (see LiveRangeView.tsx) — both call this same whole-document sweep,
// dispatched as a single transaction so it's one undo step, and dispatches
// nothing at all when every range already matches its cached snapshot (so a
// silent open-time refresh never dirties autosave).

import type { Editor } from '@tiptap/react'
import { resolveLiveLink, type LiveLink } from '../../shared/livelink'

export const LIVE_RANGE_NODE = 'liveRange'

export interface RefreshSummary {
  total: number
  changed: number
  failed: number
}

export async function refreshLiveRanges(editor: Editor): Promise<RefreshSummary> {
  const targets: { pos: number; link: LiveLink; warning: string | null }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === LIVE_RANGE_NODE && node.attrs.link) {
      targets.push({
        pos,
        link: node.attrs.link as LiveLink,
        warning: (node.attrs.warning as string | null) ?? null,
      })
    }
    return true
  })
  if (!targets.length) return { total: 0, changed: 0, failed: 0 }

  const results = await Promise.all(targets.map((t) => resolveLiveLink(t.link)))

  let changed = 0
  let failed = 0
  const tr = editor.state.tr
  targets.forEach((t, i) => {
    const result = results[i]
    if (result.ok) {
      const same = JSON.stringify(result.rows) === JSON.stringify(t.link.snapshot)
      if (same && !t.warning) return
      changed++
      tr.setNodeAttribute(t.pos, 'link', { ...t.link, snapshot: result.rows, refreshedAt: Date.now() })
      if (t.warning) tr.setNodeAttribute(t.pos, 'warning', null)
    } else {
      failed++
      const message = result.error ?? 'Could not refresh this range.'
      if (t.warning === message) return
      changed++
      tr.setNodeAttribute(t.pos, 'warning', message)
    }
  })

  if (changed) editor.view.dispatch(tr)
  return { total: targets.length, changed, failed }
}
