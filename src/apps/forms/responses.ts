// The response round trip. There is no server: the exported form hands the
// respondent a code (and a .aresp file wrapping it), they send it back however
// they like, and this module turns it into rows the author can read.
//
// The wire format is deliberately dull — JSON, UTF-8, base64url, one prefix —
// because the encoder on the other side lives inside an exported HTML file that
// can never be updated once it has been emailed to someone.

import type { Cell, FormQuestion, FormResponse, Sheet, SheetsContent } from '../../shared/types'
import { uid } from '../../shared/types'
import { answerToText, isAnswerable, scalePoints } from './model'

const PREFIX = 'ANLEO-RESPONSE:'

// base64url: survives email quoting, URL bars and double-clicking to select.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const DECODE: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]] = i
  map['+'] = 62 // tolerate standard base64 from a hand-rolled re-encode
  map['/'] = 63
  return map
})()

function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const rest = bytes.length - i
    const b0 = bytes[i]
    const b1 = rest > 1 ? bytes[i + 1] : 0
    const b2 = rest > 2 ? bytes[i + 2] : 0
    out += ALPHABET[b0 >> 2]
    out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
    if (rest > 1) out += ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]
    if (rest > 2) out += ALPHABET[b2 & 0x3f]
  }
  return out
}

function base64ToBytes(s: string): Uint8Array | null {
  const body = s.replace(/=+$/, '')
  const bytes: number[] = []
  let acc = 0
  let bits = 0
  for (const ch of body) {
    const v = DECODE[ch]
    if (v === undefined) return null
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 0xff)
    }
  }
  // A trailing lone character carries no whole byte — the code was truncated.
  if (bits >= 6) return null
  return new Uint8Array(bytes)
}

export function encodeResponse(r: FormResponse): string {
  return PREFIX + bytesToBase64(new TextEncoder().encode(JSON.stringify(r)))
}

/** Null rather than a throw for anything malformed: this input is pasted by hand. */
export function decodeResponse(code: string): FormResponse | null {
  if (typeof code !== 'string') return null
  let compact = code.replace(/\s+/g, '')
  const at = compact.indexOf(PREFIX)
  if (at >= 0) compact = compact.slice(at + PREFIX.length)
  if (!compact) return null
  const bytes = base64ToBytes(compact)
  if (!bytes) return null
  try {
    return coerceResponse(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}

/** Trust nothing about the shape — this arrived from another machine. */
function coerceResponse(value: unknown): FormResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as { id?: unknown; submittedAt?: unknown; answers?: unknown }
  if (!raw.answers || typeof raw.answers !== 'object' || Array.isArray(raw.answers)) return null
  const answers: Record<string, string | string[]> = {}
  for (const [key, v] of Object.entries(raw.answers as Record<string, unknown>)) {
    // Assigning '__proto__' on an object literal re-parents the object instead
    // of storing an answer; uid() never produces it, so a file that carries one
    // is either corrupt or hostile.
    if (key === '__proto__') continue
    if (typeof v === 'string') answers[key] = v
    else if (typeof v === 'number' && Number.isFinite(v)) answers[key] = String(v)
    else if (Array.isArray(v)) answers[key] = v.filter((x): x is string => typeof x === 'string')
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    submittedAt: typeof raw.submittedAt === 'number' && Number.isFinite(raw.submittedAt) ? raw.submittedAt : Date.now(),
    answers,
  }
}

// A .aresp file is a note to a human with the code on its own line, so pull out
// the run of code-shaped lines after the marker and ignore the surrounding prose.
const CODE_LINE = /^[A-Za-z0-9+/\-_=]+$/

export function parseResponsePayload(text: string): FormResponse | null {
  if (typeof text !== 'string' || !text) return null
  const at = text.indexOf(PREFIX)
  if (at < 0) return decodeResponse(text)
  const lines: string[] = []
  for (const line of text.slice(at + PREFIX.length).split(/\r?\n/)) {
    const trimmed = line.trim()
    // A mail client may hard-wrap immediately after the marker, so blank lines
    // before the code are skipped; the first blank line after it ends the run.
    if (!trimmed) {
      if (lines.length) break
      continue
    }
    if (!CODE_LINE.test(trimmed)) break
    lines.push(trimmed)
  }
  return decodeResponse(lines.join(''))
}

// ---------- tabular output ----------

/** Local time, sortable and locale-independent so exported files compare cleanly. */
function submittedAtLabel(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// Excel, Numbers and LibreOffice all execute a cell whose text opens with =, +,
// - or @ (a leading tab or CR just shifts the trigger along), and this text was
// typed by a stranger on another machine. A leading apostrophe is the spreadsheet
// convention for "this is literally text". Plain numbers are left alone: "-5" is
// a number to every spreadsheet, and marking it as text would cost the author a
// whole column of arithmetic.
const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/

function csvField(s: string): string {
  const safe = FORMULA_START.test(s) && !PLAIN_NUMBER.test(s) ? `'${s}` : s
  if (/[",\n\r]/.test(safe)) return '"' + safe.replace(/"/g, '""') + '"'
  return safe
}

/**
 * Cell.v treats a leading '=' as a formula and the .xlsx export writes it out as
 * one, so an imported answer must never land in the grid as live code.
 */
function sheetField(s: string): string {
  return s.startsWith('=') ? `'${s}` : s
}

function responseRow(cols: FormQuestion[], r: FormResponse): string[] {
  return [submittedAtLabel(r.submittedAt), ...cols.map((q) => answerToText(q, r.answers[q.id]))]
}

export function responsesToCsv(questions: FormQuestion[], responses: FormResponse[]): string {
  const cols = questions.filter(isAnswerable)
  const rows = [['Submitted', ...cols.map((q) => q.title)], ...responses.map((r) => responseRow(cols, r))]
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n')
}

function colRef(index: number, row: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s + row
}

const HEADER_STYLE: Cell['style'] = { bold: true, fill: '#eef2ff', valign: 'middle', wrap: true }

/** Wide enough for the title, wider still for kinds that produce sentences. */
function columnWidth(q: FormQuestion): number {
  const roomy = q.kind === 'paragraph' || q.kind === 'checkboxes'
  return Math.min(roomy ? 320 : 220, Math.max(roomy ? 240 : 110, q.title.length * 8 + 24))
}

export function responsesToSheet(questions: FormQuestion[], responses: FormResponse[]): SheetsContent {
  const cols = questions.filter(isAnswerable)
  const cells: Record<string, Cell> = {}
  cells[colRef(0, 1)] = { v: 'Submitted', style: HEADER_STYLE }
  cols.forEach((q, c) => {
    cells[colRef(c + 1, 1)] = { v: sheetField(q.title), style: HEADER_STYLE }
  })
  responses.forEach((r, i) => {
    responseRow(cols, r).forEach((value, c) => {
      if (value !== '') cells[colRef(c, i + 2)] = { v: sheetField(value) }
    })
  })
  const colWidths: Record<number, number> = { 0: 150 }
  cols.forEach((q, c) => {
    colWidths[c + 1] = columnWidth(q)
  })
  const sheet: Sheet = {
    name: 'Responses',
    cells,
    colWidths,
    rowHeights: {},
    freeze: { rows: 1, cols: 0 },
  }
  return { sheets: [sheet], active: 0 }
}

// ---------- per-question summaries ----------

export interface Summary {
  question: FormQuestion
  answered: number
  skipped: number
  buckets: { label: string; count: number }[]
  texts: string[]
  average: number | null
}

const BUCKETED = ['choice', 'checkboxes', 'dropdown', 'scale']

export function summarize(q: FormQuestion, responses: FormResponse[]): Summary {
  const summary: Summary = { question: q, answered: 0, skipped: 0, buckets: [], texts: [], average: null }
  if (!isAnswerable(q)) return summary

  // Every defined option gets a bar even at zero; free-text "Other" answers add
  // their own bucket on the end, in the order they first turn up.
  const counts = new Map<string, number>()
  if (q.kind === 'scale') {
    for (const n of scalePoints(q)) counts.set(String(n), 0)
  } else if (BUCKETED.includes(q.kind)) {
    for (const o of q.options ?? []) counts.set(o.label, 0)
  }

  let total = 0
  let numeric = 0
  for (const r of responses) {
    const answer = r.answers[q.id]
    const text = answerToText(q, answer)
    if (text.trim() === '') {
      summary.skipped++
      continue
    }
    summary.answered++
    if (BUCKETED.includes(q.kind)) {
      const picks = Array.isArray(answer) ? answer : [text]
      for (const pick of picks) {
        const label = pick.trim()
        if (label === '') continue
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    } else {
      summary.texts.push(text)
    }
    // Scale answers are the point of the average; number answers get one too
    // because "average spend" is exactly what an author asks a number question for.
    if (q.kind === 'scale' || q.kind === 'number') {
      const n = Number(text)
      if (Number.isFinite(n)) {
        total += n
        numeric++
      }
    }
  }

  summary.buckets = [...counts].map(([label, count]) => ({ label, count }))
  if (numeric > 0) summary.average = total / numeric
  return summary
}
