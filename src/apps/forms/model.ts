// The form model: what a question of each kind starts life as, what counts as a
// valid answer, and the themes. Pure data and pure functions — the builder, the
// exported HTML and the response importer all share this, so it must not touch
// React or the DOM.

import type { FormQuestion, FormTheme, QuestionKind } from '../../shared/types'
import { uid } from '../../shared/types'

export const QUESTION_KINDS: { kind: QuestionKind; label: string; hint: string }[] = [
  { kind: 'short', label: 'Short answer', hint: 'A single line of text' },
  { kind: 'paragraph', label: 'Paragraph', hint: 'A longer, multi-line answer' },
  { kind: 'choice', label: 'Multiple choice', hint: 'Pick exactly one option' },
  { kind: 'checkboxes', label: 'Checkboxes', hint: 'Pick any number of options' },
  { kind: 'dropdown', label: 'Dropdown', hint: 'Pick one from a compact list' },
  { kind: 'scale', label: 'Linear scale', hint: 'Rate between two numbers' },
  { kind: 'date', label: 'Date', hint: 'A calendar date' },
  { kind: 'time', label: 'Time', hint: 'A time of day' },
  { kind: 'email', label: 'Email', hint: 'An email address, checked for shape' },
  { kind: 'number', label: 'Number', hint: 'A number, optionally within a range' },
  { kind: 'section', label: 'Section', hint: 'A heading that breaks the form into parts' },
]

const CHOICE_KINDS: QuestionKind[] = ['choice', 'checkboxes', 'dropdown']

export function newQuestion(kind: QuestionKind): FormQuestion {
  const q: FormQuestion = {
    id: uid(),
    kind,
    title: kind === 'section' ? 'Section heading' : 'Untitled question',
    required: false,
  }
  if (CHOICE_KINDS.includes(kind)) {
    q.options = [
      { id: uid(), label: 'Option 1' },
      { id: uid(), label: 'Option 2' },
    ]
  }
  if (kind === 'scale') {
    q.scaleMin = 1
    q.scaleMax = 5
  }
  if (kind === 'paragraph') q.rows = 4
  return q
}

/** Sections are furniture: they are never numbered, answered or exported. */
export function isAnswerable(q: FormQuestion): boolean {
  return q.kind !== 'section'
}

const MAX_SCALE_POINTS = 20

function scaleBound(v: number | undefined, fallback: number): number {
  return v !== undefined && Number.isFinite(v) ? Math.round(v) : fallback
}

/**
 * The values a linear scale actually offers. Rounded and capped because a
 * hand-edited or corrupt .aform must not turn into thousands of buttons — and
 * because the exported form, the validator and the summary all have to agree on
 * the same list or every answer looks out of range.
 */
export function scalePoints(q: FormQuestion): number[] {
  const min = scaleBound(q.scaleMin, 1)
  const max = Math.min(scaleBound(q.scaleMax, 5), min + MAX_SCALE_POINTS - 1)
  const out: number[] = []
  for (let n = min; n <= max; n++) out.push(n)
  return out.length ? out : [min]
}

function isBlank(answer: string | string[] | undefined): boolean {
  if (answer === undefined) return true
  if (Array.isArray(answer)) return answer.filter((a) => a.trim() !== '').length === 0
  return answer.trim() === ''
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/

/** Returns null when the answer is acceptable, otherwise a message to show under the question. */
export function validateAnswer(q: FormQuestion, answer: string | string[] | undefined): string | null {
  if (!isAnswerable(q)) return null
  if (isBlank(answer)) return q.required ? 'This question is required' : null

  // Everything below is a shape check on a value the respondent actually gave,
  // so an optional question that was left blank never reaches it.
  const text = Array.isArray(answer) ? answer.join(', ') : String(answer).trim()

  if (q.kind === 'email' && !EMAIL_RE.test(text)) return 'Enter a valid email address'

  if (q.kind === 'number') {
    const n = Number(text)
    if (text === '' || !Number.isFinite(n)) return 'Enter a number'
    if (q.min !== undefined && n < q.min) return `Must be at least ${q.min}`
    if (q.max !== undefined && n > q.max) return `Must be at most ${q.max}`
  }

  if (q.kind === 'date' && !isValidDate(text)) return 'Enter a valid date'
  if (q.kind === 'time' && !isValidTime(text)) return 'Enter a valid time'

  if (q.kind === 'scale') {
    const n = Number(text)
    const points = scalePoints(q)
    const min = points[0]
    const max = points[points.length - 1]
    if (!Number.isFinite(n) || n < min || n > max) return `Choose a value between ${min} and ${max}`
  }

  return null
}

/** ISO calendar date as the browser's date input produces it, rejecting 2025-02-30. */
function isValidDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

function isValidTime(text: string): boolean {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (!m) return false
  const h = Number(m[1])
  const min = Number(m[2])
  const s = m[3] === undefined ? 0 : Number(m[3])
  return h <= 23 && min <= 59 && s <= 59
}

/** One readable line for CSV cells, sheet cells and the response list. */
export function answerToText(q: FormQuestion, answer: string | string[] | undefined): string {
  if (answer === undefined) return ''
  if (Array.isArray(answer)) return answer.filter((a) => a.trim() !== '').join(', ')
  return answer
}

/** Display numbers keyed by question id; sections are skipped and absent from the map. */
export function questionNumbers(questions: FormQuestion[]): Record<string, number> {
  const map: Record<string, number> = {}
  let n = 0
  for (const q of questions) {
    if (!isAnswerable(q)) continue
    n++
    map[q.id] = n
  }
  return map
}

// Header gradients are dark enough for white title text at every stop — the
// exported form has no theme switcher, so this is the only chance to get it right.
export const FORM_THEMES: { id: string; name: string; theme: FormTheme }[] = [
  {
    id: 'violet',
    name: 'Violet',
    theme: {
      accent: '#7c3aed',
      headerFrom: '#7c3aed',
      headerTo: '#4f46e5',
      headerColor: '#ffffff',
      fontFamily: 'System (San Francisco)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    theme: {
      accent: '#0e7490',
      headerFrom: '#0e7490',
      headerTo: '#1d4ed8',
      headerColor: '#ffffff',
      fontFamily: 'Helvetica Neue',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    theme: {
      accent: '#047857',
      headerFrom: '#047857',
      headerTo: '#15803d',
      headerColor: '#ffffff',
      fontFamily: 'Avenir Next',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    theme: {
      accent: '#c2410c',
      headerFrom: '#b45309',
      headerTo: '#be123c',
      headerColor: '#ffffff',
      fontFamily: 'Futura',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    theme: {
      accent: '#475569',
      headerFrom: '#0f172a',
      headerTo: '#475569',
      headerColor: '#ffffff',
      fontFamily: 'Gill Sans',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    theme: {
      accent: '#be123c',
      headerFrom: '#be123c',
      headerTo: '#9f1239',
      headerColor: '#ffffff',
      fontFamily: 'Georgia',
    },
  },
]
