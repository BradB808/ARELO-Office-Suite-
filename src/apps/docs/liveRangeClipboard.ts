// Bridges the cross-app "copy a range from Sheets" clipboard (see
// shared/livelink.ts) into an inserted liveRange node. Shared by the
// Toolbar's Insert menu and the command palette so both build the LiveLink
// object the same way.

import type { Editor } from '@tiptap/react'
import { getLinkClipboard, type LiveLink } from '../../shared/livelink'

export async function pasteLiveRangeFromClipboard(editor: Editor): Promise<'inserted' | 'empty'> {
  const payload = await getLinkClipboard()
  if (!payload) return 'empty'
  const link: LiveLink = {
    sourceId: payload.sourceId,
    sourceTitle: payload.sourceTitle,
    sheetName: payload.sheetName,
    range: payload.range,
    headerRow: true,
    snapshot: payload.rows,
    refreshedAt: Date.now(),
  }
  editor.commands.insertLiveRange(link)
  return 'inserted'
}
