// Custom TipTap node: a snapshot of a range from an Anleo Sheets document,
// embedded as a table. The whole LiveLink round-trips as one JSON attribute
// (`link`, serialized via data-link on a <div data-type="live-range">), so it
// survives save/reopen without any extra document-model plumbing — see
// shared/livelink.ts for the LiveLink shape and shared/types.ts's note that
// new model fields must stay optional (older documents simply have no nodes
// of this type at all).
//
// renderHTML below builds the *exportable* shape: a real <table> with a small
// caption underneath. That's what editor.getHTML() / getJSON() / getText()
// all serialize from — export.ts (docx), the markdown turndown rule (table),
// and the plain HTML/PDF/living-document exporters all pick it up for free.
// The interactive editing surface (caption bar with Refresh/Unlink) lives
// entirely in the node view (LiveRangeView.tsx) and never leaks into exports.

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { linkLabel, type LiveLink } from '../../shared/livelink'
import { timeAgo } from '../../shared/util'
import { LIVE_RANGE_NODE } from './liveRangeRefresh'
import { LiveRangeView } from './LiveRangeView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    liveRange: {
      /** Insert a live range snapshot at the current selection. */
      insertLiveRange: (link: LiveLink) => ReturnType
    }
  }
}

function parseLink(el: Element): LiveLink | null {
  const raw = el.getAttribute('data-link')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && Array.isArray(parsed.snapshot) ? (parsed as LiveLink) : null
  } catch {
    return null
  }
}

function buildTableElement(link: LiveLink): HTMLTableElement {
  const table = document.createElement('table')
  table.className = 'dx-liverange-table'
  const tbody = document.createElement('tbody')
  const rows = link.snapshot ?? []
  rows.forEach((row, ri) => {
    const tr = document.createElement('tr')
    const isHeader = !!link.headerRow && ri === 0
    ;(row.length ? row : ['']).forEach((cellText) => {
      const cell = document.createElement(isHeader ? 'th' : 'td')
      cell.textContent = cellText
      tr.appendChild(cell)
    })
    tbody.appendChild(tr)
  })
  if (!rows.length) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    tr.appendChild(td)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  return table
}

export const LiveRange = Node.create({
  name: LIVE_RANGE_NODE,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      link: {
        default: null,
        parseHTML: (el) => parseLink(el as Element),
        renderHTML: (attrs) => ({ 'data-link': JSON.stringify(attrs.link ?? null) }),
      },
      warning: {
        default: null,
        parseHTML: (el) => (el as Element).getAttribute('data-warning') || null,
        renderHTML: (attrs) => (attrs.warning ? { 'data-warning': attrs.warning as string } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="live-range"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const link = node.attrs.link as LiveLink | null
    const wrap = document.createElement('div')
    const attrs = mergeAttributes(HTMLAttributes, { 'data-type': 'live-range', class: 'dx-liverange-export' })
    Object.entries(attrs).forEach(([k, v]) => {
      if (v != null) wrap.setAttribute(k, String(v))
    })
    if (!link) {
      wrap.textContent = 'Live range unavailable'
      return wrap
    }
    wrap.appendChild(buildTableElement(link))
    const caption = document.createElement('div')
    caption.className = 'dx-liverange-caption'
    caption.setAttribute('data-live-caption', '')
    caption.textContent = `${linkLabel(link)} · Updated ${timeAgo(link.refreshedAt)}`
    wrap.appendChild(caption)
    return wrap
  },

  renderText({ node }) {
    const link = node.attrs.link as LiveLink | null
    if (!link) return ''
    return (link.snapshot ?? []).map((r) => r.join('\t')).join('\n')
  },

  addNodeView() {
    return ReactNodeViewRenderer(LiveRangeView)
  },

  addCommands() {
    return {
      insertLiveRange:
        (link: LiveLink) =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name, attrs: { link, warning: null } })
            .run()
        },
    }
  },
})
