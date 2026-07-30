// Live links: a range in an Anleo Sheets document embedded in a Docs page or a
// Slides deck. The embed stores only a reference plus a cached snapshot, so it
// still renders when the source is unavailable and refreshes when it is.

import type { Sheet, SheetsContent } from './types'
import { platform } from './platform'
import { computeSheet } from '../apps/sheets/engine/formula'

export interface LiveLink {
  /** Source Anleo Sheets document id. */
  sourceId: string
  /** Captured for display when the source can't be loaded. */
  sourceTitle: string
  /** Sheet name inside the source workbook. */
  sheetName: string
  /** A1-style range, e.g. "A4:E12". */
  range: string
  /** Treat the first row as a header row when rendering. */
  headerRow?: boolean
  /** Cached computed values (display strings) from the last successful refresh. */
  snapshot: string[][]
  /** Epoch ms of the last successful refresh. */
  refreshedAt: number
}

export interface ResolveResult {
  rows: string[][]
  ok: boolean
  /** Present when the link could not be refreshed. */
  error?: string
}

const CLIPBOARD_KEY = 'livelink-clipboard'

export interface LinkClipboardPayload {
  sourceId: string
  sourceTitle: string
  sheetName: string
  range: string
  rows: string[][]
}

export async function putLinkClipboard(payload: LinkClipboardPayload): Promise<void> {
  await platform.storeSet(CLIPBOARD_KEY, payload)
}

export async function getLinkClipboard(): Promise<LinkClipboardPayload | undefined> {
  return platform.storeGet<LinkClipboardPayload>(CLIPBOARD_KEY)
}

// ---------- A1 range parsing ----------

export function colToIndex(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function indexToCol(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export interface ParsedRange {
  r0: number
  c0: number
  r1: number
  c1: number
}

/** "B2:D10" (or "B2") → zero-based inclusive rect. Null when malformed. */
export function parseRange(range: string): ParsedRange | null {
  const parts = range.replace(/\$/g, '').trim().toUpperCase().split(':')
  const cell = /^([A-Z]+)(\d+)$/
  const a = parts[0]?.match(cell)
  if (!a) return null
  const b = parts[1] ? parts[1].match(cell) : a
  if (!b) return null
  const r0 = Math.min(Number(a[2]), Number(b[2])) - 1
  const r1 = Math.max(Number(a[2]), Number(b[2])) - 1
  const c0 = Math.min(colToIndex(a[1]), colToIndex(b[1]))
  const c1 = Math.max(colToIndex(a[1]), colToIndex(b[1]))
  if (r0 < 0 || c0 < 0) return null
  return { r0, c0, r1, c1 }
}

export function rangeToA1(r0: number, c0: number, r1: number, c1: number): string {
  return `${indexToCol(c0)}${r0 + 1}:${indexToCol(c1)}${r1 + 1}`
}

/** Extracts a rectangle of computed display strings from a sheet. */
export function readRange(sheet: Sheet, range: string): string[][] | null {
  const rect = parseRange(range)
  if (!rect) return null
  const computed = computeSheet(sheet)
  const rows: string[][] = []
  for (let r = rect.r0; r <= rect.r1; r++) {
    const row: string[] = []
    for (let c = rect.c0; c <= rect.c1; c++) {
      const ref = `${indexToCol(c)}${r + 1}`
      const out = computed.get(ref) as { display?: unknown } | undefined
      row.push(out?.display != null ? String(out.display) : (sheet.cells[ref]?.v ?? ''))
    }
    rows.push(row)
  }
  return rows
}

/** Loads the source document and recomputes the linked range. */
export async function resolveLiveLink(link: LiveLink): Promise<ResolveResult> {
  const stored = await platform.storeGet<{ content: SheetsContent }>('doc:' + link.sourceId)
  if (!stored?.content?.sheets) {
    return { rows: link.snapshot, ok: false, error: `“${link.sourceTitle}” is no longer available` }
  }
  const sheet =
    stored.content.sheets.find((s) => s.name === link.sheetName) ?? stored.content.sheets[0]
  if (!sheet) {
    return { rows: link.snapshot, ok: false, error: `Sheet “${link.sheetName}” was removed` }
  }
  const rows = readRange(sheet, link.range)
  if (!rows) return { rows: link.snapshot, ok: false, error: `Range ${link.range} is invalid` }
  return { rows, ok: true }
}

export function linkLabel(link: LiveLink): string {
  return `${link.sourceTitle} · ${link.sheetName}!${link.range}`
}
