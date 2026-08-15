// The form model: what a question of each kind starts life as, what counts as a
// valid answer, how a quiz answer is marked, where a branch sends the
// respondent, and the themes. Pure data and pure functions — the builder, the
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

// ---------- quiz grading ----------
//
// Grading happens in three places that can never talk to each other: the editor
// (showing the author what a question is worth), the exported page (in the
// respondent's browser, possibly years later) and the app importing a response.
// The rules below are the description of it; render.ts reimplements them inside
// the page's own script because that page cannot import anything.

/** How one answer scored. `correct` is null when the question carries no key. */
export interface Mark {
  earned: number
  total: number
  correct: boolean | null
}

export interface Score {
  earned: number
  total: number
}

/** Marks are shown to people, so a third of two marks must not arrive as
 *  0.6666666666666666. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function hasAnswerKey(q: FormQuestion): boolean {
  return isAnswerable(q) && (q.correct ?? []).some((c) => c.trim() !== '')
}

/**
 * The key expressed as the text an answer actually arrives as. Option keys are
 * stored as option ids, but a response carries option *labels* — the wire
 * format uses labels so a .aresp file reads sensibly on its own — so they have
 * to be resolved before anything can be compared.
 */
export function acceptedAnswers(q: FormQuestion): string[] {
  return (q.correct ?? []).map((entry) => {
    // An entry matching no option is either a typed answer (short, number,
    // date, time) or an option deleted after the key was set. Comparing both
    // literally is the only reading that can still be right.
    const opt = (q.options ?? []).find((o) => o.id === entry)
    return opt ? opt.label : entry
  })
}

/** What a question is worth. An author who ticks the right answer and leaves
 *  the marks box empty means one mark, not none. */
export function questionMarks(q: FormQuestion): number {
  if (!hasAnswerKey(q)) return 0
  const n = Number(q.points)
  return q.points === undefined || !Number.isFinite(n) || n < 0 ? 1 : n
}

function matchesNumerically(accepted: string[], text: string): boolean {
  const n = Number(text)
  if (text === '' || !Number.isFinite(n)) return false
  // "7.0", "07" and " 7 " are the same answer to a number question. Only the
  // author's own key is read this way, so nothing else loosens.
  return accepted.some((a) => a.trim() !== '' && Number.isFinite(Number(a)) && Number(a) === n)
}

export function gradeAnswer(q: FormQuestion, answer: string | string[] | undefined): Mark {
  // Deduplicated because a checkbox question's part marks are shares of the
  // number of *distinct* answers. Two options carrying the same label are one
  // answer on the wire, which travels as labels, and counting them twice makes
  // the question unwinnable — the page, which dedupes, would mark it full.
  const accepted = [...new Set(acceptedAnswers(q).map(norm).filter((s) => s !== ''))]
  if (!isAnswerable(q) || accepted.length === 0) return { earned: 0, total: 0, correct: null }
  const total = questionMarks(q)

  if (q.kind === 'checkboxes') {
    const given = (Array.isArray(answer) ? answer : answer === undefined ? [] : [answer]).map(norm)
    const ticked = [...new Set(given.filter((s) => s !== ''))]
    const hits = ticked.filter((a) => accepted.includes(a)).length
    const wrong = ticked.length - hits
    // Partial credit, less one right answer's worth for each wrong tick —
    // otherwise ticking every box scores full marks on every question.
    const share = Math.min(1, Math.max(0, hits - wrong) / accepted.length)
    return { earned: round2(total * share), total, correct: hits === accepted.length && wrong === 0 }
  }

  const text = norm(Array.isArray(answer) ? answer.join(', ') : String(answer ?? ''))
  if (text === '') return { earned: 0, total, correct: false }
  const hit = accepted.includes(text) || (q.kind === 'number' && matchesNumerically(accepted, text))
  return { earned: hit ? total : 0, total, correct: hit }
}

/**
 * Grades exactly the questions handed in. Branching means the caller decides
 * which ones the respondent actually saw — marking someone down for a section
 * their own answers routed them past would be indefensible.
 */
export function gradeResponse(
  questions: FormQuestion[],
  answers: Record<string, string | string[]>,
): Score {
  let earned = 0
  let total = 0
  for (const q of questions) {
    const mark = gradeAnswer(q, answers[q.id])
    earned += mark.earned
    total += mark.total
  }
  return { earned: round2(earned), total: round2(total) }
}

/** Marks available across a whole form — what the editor quotes to the author. */
export function quizTotal(questions: FormQuestion[]): number {
  return round2(questions.reduce((sum, q) => sum + questionMarks(q), 0))
}

// ---------- sections as pages, and branching ----------

/** A branch target meaning "finish here" rather than a section id. */
export const BRANCH_END = 'end'

export interface FormPage {
  /** The section's question id, or 'start' for the run before the first one. */
  id: string
  section: FormQuestion | null
  questions: FormQuestion[]
}

/**
 * Sections are page breaks in the exported form: branching only means anything
 * if the respondent cannot already see the section their answer would skip.
 * A leading run of questions is a page of its own, but an empty one is not — a
 * form that opens with a section heading must not open on a blank page.
 */
export function formPages(questions: FormQuestion[]): FormPage[] {
  const pages: FormPage[] = []
  let page: FormPage = { id: 'start', section: null, questions: [] }
  for (const q of questions) {
    if (!isAnswerable(q)) {
      if (page.section || page.questions.length) pages.push(page)
      page = { id: q.id, section: q, questions: [] }
    } else page.questions.push(q)
  }
  if (page.section || page.questions.length) pages.push(page)
  return pages
}

/** The branch an answer selects, or null when this answer routes nowhere. */
export function branchTarget(q: FormQuestion, answer: string | string[] | undefined): string | null {
  if (q.kind !== 'choice' && q.kind !== 'dropdown') return null
  const text = norm(Array.isArray(answer) ? (answer[0] ?? '') : String(answer ?? ''))
  if (text === '') return null
  for (const b of q.branches ?? []) {
    const opt = (q.options ?? []).find((o) => o.id === b.optionId)
    if (opt && norm(opt.label) === text) return b.goTo
  }
  return null
}

/**
 * Where the respondent goes after a page. -1 is the end of the form. Two
 * targets are ignored rather than obeyed, because obeying either strands
 * somebody mid-form: one that no longer exists, and one that is the page they
 * are already on — Next would show it again, and Submit would never arrive. A
 * jump to an *earlier* page is obeyed; that loop is walkable and they can leave
 * it by changing their answer.
 */
export function nextPageIndex(
  pages: FormPage[],
  pageIndex: number,
  answers: Record<string, string | string[]>,
): number {
  const page = pages[pageIndex]
  if (!page) return -1
  // Last branching question first: with two on one page, the answer the
  // respondent gave most recently is the one they can still see.
  for (let i = page.questions.length - 1; i >= 0; i--) {
    const q = page.questions[i]
    const target = branchTarget(q, answers[q.id])
    if (target === null) continue
    if (target === BRANCH_END) return -1
    const to = pages.findIndex((p) => p.id === target)
    if (to >= 0 && to !== pageIndex) return to
  }
  return pageIndex + 1 < pages.length ? pageIndex + 1 : -1
}

/** The questions a set of answers actually routed through, in the order shown. */
export function answeredPath(
  questions: FormQuestion[],
  answers: Record<string, string | string[]>,
): FormQuestion[] {
  const pages = formPages(questions)
  const out: FormQuestion[] = []
  const seen = new Set<number>()
  let at = pages.length ? 0 : -1
  // A backwards branch is a loop the exported form lets someone walk round
  // deliberately; replaying it here would never terminate.
  while (at >= 0 && !seen.has(at)) {
    seen.add(at)
    out.push(...pages[at].questions)
    at = nextPageIndex(pages, at, answers)
  }
  return out
}

/** Sections a question may branch to: the ones after its own page. */
export function sectionsAfter(questions: FormQuestion[], questionId: string): FormQuestion[] {
  const pages = formPages(questions)
  const from = pages.findIndex((p) => p.questions.some((q) => q.id === questionId))
  if (from < 0) return []
  return pages
    .slice(from + 1)
    .map((p) => p.section)
    .filter((s): s is FormQuestion => s !== null)
}

export interface BranchProblem {
  questionId: string
  optionId: string
  kind: 'missing' | 'backwards'
  message: string
}

/**
 * Branches that would misbehave: one pointing at a deleted section, one
 * pointing at the page it is already on, and one pointing at an earlier page,
 * which can walk a respondent round the same questions until they change their
 * answer. The first two are ignored when the form is filled in, so the route
 * quietly does nothing. All three are reachable by ordinary editing — delete a
 * section, or move a question below the section it routes to — so the editor
 * says so rather than letting the exported form surprise someone.
 */
export function branchProblems(questions: FormQuestion[]): BranchProblem[] {
  const pages = formPages(questions)
  const out: BranchProblem[] = []
  pages.forEach((page, at) => {
    for (const q of page.questions) {
      for (const b of q.branches ?? []) {
        if (b.goTo === BRANCH_END) continue
        const label = (q.options ?? []).find((o) => o.id === b.optionId)?.label || 'An option'
        const to = pages.findIndex((p) => p.id === b.goTo)
        if (to < 0) {
          out.push({
            questionId: q.id,
            optionId: b.optionId,
            kind: 'missing',
            message: `“${label}” points at a section that has been deleted — it will simply carry on.`,
          })
        } else if (to === at) {
          out.push({
            questionId: q.id,
            optionId: b.optionId,
            kind: 'backwards',
            message: `“${label}” points at the section this question is already in — it will simply carry on.`,
          })
        } else if (to < at) {
          const name = pages[to].section?.title || 'an earlier section'
          out.push({
            questionId: q.id,
            optionId: b.optionId,
            kind: 'backwards',
            message: `“${label}” jumps back to “${name}” — a respondent could go round forever.`,
          })
        }
      }
    }
  })
  return out
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
