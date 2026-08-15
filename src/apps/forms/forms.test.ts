// Unit tests for the Forms model and the response round trip — the parts that
// have to keep working years after a form was emailed to someone.
// Run: npx vite build --ssr src/apps/forms/forms.test.ts --outDir .tmp-formstest \
//        && node .tmp-formstest/forms.test.js

import {
  QUESTION_KINDS,
  FORM_THEMES,
  BRANCH_END,
  newQuestion,
  isAnswerable,
  validateAnswer,
  answerToText,
  questionNumbers,
  scalePoints,
  acceptedAnswers,
  answeredPath,
  branchProblems,
  branchTarget,
  formPages,
  gradeAnswer,
  gradeResponse,
  hasAnswerKey,
  nextPageIndex,
  questionMarks,
  quizTotal,
  sectionsAfter,
} from './model'
import {
  encodeResponse,
  decodeResponse,
  parseResponsePayload,
  responsesToCsv,
  responsesToSheet,
  scoreStats,
  summarize,
} from './responses'
import { SYSTEM_FONTS } from '../../shared/fonts'
import type { FormOption, FormQuestion, FormResponse, QuestionKind } from '../../shared/types'

let passed = 0
let failed = 0

function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) passed++
  else {
    failed++
    console.error('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : '')
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
}

const ALL_KINDS: QuestionKind[] = [
  'short',
  'paragraph',
  'choice',
  'checkboxes',
  'dropdown',
  'scale',
  'date',
  'time',
  'email',
  'number',
  'section',
]

// ---------- question kinds ----------

eq('kinds: all eleven present', QUESTION_KINDS.length, 11)
eq(
  'kinds: covers the union exactly',
  [...QUESTION_KINDS.map((k) => k.kind)].sort(),
  [...ALL_KINDS].sort(),
)
ok('kinds: every entry labelled', QUESTION_KINDS.every((k) => k.label.length > 0))
ok('kinds: every entry hinted', QUESTION_KINDS.every((k) => k.hint.length > 0))
ok('kinds: no duplicates', new Set(QUESTION_KINDS.map((k) => k.kind)).size === 11)
eq('kinds: short reads as short answer', QUESTION_KINDS[0].label, 'Short answer')

// ---------- newQuestion ----------

const shortQ = newQuestion('short')
eq('new: default title', shortQ.title, 'Untitled question')
eq('new: not required by default', shortQ.required, false)
eq('new: short has no options', shortQ.options, undefined)
ok('new: has an id', shortQ.id.length > 0)
ok('new: ids are unique', newQuestion('short').id !== newQuestion('short').id)
eq('new: section title', newQuestion('section').title, 'Section heading')

const choiceQ = newQuestion('choice')
eq('new: choice option labels', choiceQ.options?.map((o) => o.label), ['Option 1', 'Option 2'])
ok('new: choice option ids differ', choiceQ.options?.[0].id !== choiceQ.options?.[1].id)
eq('new: checkboxes get two options', newQuestion('checkboxes').options?.length, 2)
eq('new: dropdown gets two options', newQuestion('dropdown').options?.length, 2)
const scaleQ = newQuestion('scale')
eq('new: scale min', scaleQ.scaleMin, 1)
eq('new: scale max', scaleQ.scaleMax, 5)
eq('new: paragraph rows', newQuestion('paragraph').rows, 4)
ok('new: every kind builds', ALL_KINDS.every((k) => newQuestion(k).kind === k))

eq('answerable: section is not', isAnswerable(newQuestion('section')), false)
eq('answerable: short is', isAnswerable(shortQ), true)
eq('answerable: scale is', isAnswerable(scaleQ), true)

// ---------- validateAnswer ----------

const req = (kind: QuestionKind, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  ...newQuestion(kind),
  required: true,
  ...extra,
})
const opt = (kind: QuestionKind, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  ...newQuestion(kind),
  ...extra,
})
const REQUIRED = 'This question is required'

eq('validate: required undefined', validateAnswer(req('short'), undefined), REQUIRED)
eq('validate: required empty string', validateAnswer(req('short'), ''), REQUIRED)
eq('validate: required whitespace only', validateAnswer(req('short'), '   '), REQUIRED)
eq('validate: required empty array', validateAnswer(req('checkboxes'), []), REQUIRED)
eq('validate: required array of blanks', validateAnswer(req('checkboxes'), ['', ' ']), REQUIRED)
eq('validate: required satisfied', validateAnswer(req('short'), 'hello'), null)
eq('validate: required checkbox satisfied', validateAnswer(req('checkboxes'), ['Option 1']), null)
eq('validate: optional blank passes', validateAnswer(opt('short'), ''), null)
eq('validate: optional undefined passes', validateAnswer(opt('paragraph'), undefined), null)
eq('validate: section never validates', validateAnswer(req('section'), undefined), null)

eq('validate: email ok', validateAnswer(opt('email'), 'a.b+c@example.co.uk'), null)
eq('validate: email missing tld', validateAnswer(opt('email'), 'someone@example'), 'Enter a valid email address')
eq('validate: email missing at', validateAnswer(opt('email'), 'not-an-email'), 'Enter a valid email address')
eq('validate: email with space', validateAnswer(opt('email'), 'a b@example.com'), 'Enter a valid email address')
eq('validate: email blank optional', validateAnswer(opt('email'), ''), null)
eq('validate: email blank required', validateAnswer(req('email'), ''), REQUIRED)

const bounded = opt('number', { min: 10, max: 50 })
eq('validate: number ok', validateAnswer(bounded, '42'), null)
eq('validate: number not numeric', validateAnswer(bounded, 'abc'), 'Enter a number')
eq('validate: number below min', validateAnswer(bounded, '4'), 'Must be at least 10')
eq('validate: number above max', validateAnswer(bounded, '99'), 'Must be at most 50')
eq('validate: number at min', validateAnswer(bounded, '10'), null)
eq('validate: number at max', validateAnswer(bounded, '50'), null)
eq('validate: number negative decimal', validateAnswer(opt('number'), '-3.5'), null)
eq('validate: number infinity rejected', validateAnswer(opt('number'), 'Infinity'), 'Enter a number')
eq('validate: number blank optional', validateAnswer(opt('number'), ''), null)

eq('validate: date ok', validateAnswer(opt('date'), '2026-02-28'), null)
eq('validate: date leap year ok', validateAnswer(opt('date'), '2024-02-29'), null)
eq('validate: date non-leap rejected', validateAnswer(opt('date'), '2023-02-29'), 'Enter a valid date')
eq('validate: date day overflow', validateAnswer(opt('date'), '2026-02-30'), 'Enter a valid date')
eq('validate: date month overflow', validateAnswer(opt('date'), '2026-13-01'), 'Enter a valid date')
eq('validate: date wrong format', validateAnswer(opt('date'), '15/08/2026'), 'Enter a valid date')

eq('validate: time ok', validateAnswer(opt('time'), '09:30'), null)
eq('validate: time end of day', validateAnswer(opt('time'), '23:59'), null)
eq('validate: time with seconds', validateAnswer(opt('time'), '08:15:30'), null)
eq('validate: time hour overflow', validateAnswer(opt('time'), '24:00'), 'Enter a valid time')
eq('validate: time minute overflow', validateAnswer(opt('time'), '12:60'), 'Enter a valid time')
eq('validate: time malformed', validateAnswer(opt('time'), '9:5'), 'Enter a valid time')

eq('validate: scale inside range', validateAnswer(opt('scale'), '3'), null)
eq('validate: scale outside range', validateAnswer(opt('scale'), '9'), 'Choose a value between 1 and 5')
eq(
  'validate: scale honours custom bounds',
  validateAnswer(opt('scale', { scaleMin: 0, scaleMax: 10 }), '9'),
  null,
)
eq('validate: scale accepts zero when the range starts at zero', validateAnswer(req('scale', { scaleMin: 0, scaleMax: 5 }), '0'), null)
eq('validate: number accepts a legitimate zero', validateAnswer(req('number'), '0'), null)
eq('validate: number accepts zero inside bounds', validateAnswer(opt('number', { min: -5, max: 5 }), '0'), null)

// A scale is a row of buttons the exported form draws from these bounds, so
// validation has to judge against the same rounded, capped list.
eq('scale points: default range', scalePoints(opt('scale')), [1, 2, 3, 4, 5])
eq('scale points: fractional bounds rounded', scalePoints(opt('scale', { scaleMin: 1.4, scaleMax: 4.6 })), [1, 2, 3, 4, 5])
eq('scale points: nonsense range capped', scalePoints(opt('scale', { scaleMin: 1, scaleMax: 100000 })).length, 20)
eq('scale points: infinite max falls back', scalePoints(opt('scale', { scaleMax: Number.POSITIVE_INFINITY })), [1, 2, 3, 4, 5])
eq('scale points: inverted range keeps one point', scalePoints(opt('scale', { scaleMin: 5, scaleMax: 1 })), [5])
eq(
  'validate: scale message matches the rendered buttons',
  validateAnswer(opt('scale', { scaleMin: 1.4, scaleMax: 4.6 }), '9'),
  'Choose a value between 1 and 5',
)

// ---------- answerToText ----------

eq('text: undefined', answerToText(shortQ, undefined), '')
eq('text: string passthrough', answerToText(shortQ, 'Yes please'), 'Yes please')
eq('text: array joined', answerToText(choiceQ, ['A', 'B', 'C']), 'A, B, C')
eq('text: array blanks dropped', answerToText(choiceQ, ['A', '', ' ', 'B']), 'A, B')
eq('text: empty array', answerToText(choiceQ, []), '')

// ---------- questionNumbers ----------

const numbered: FormQuestion[] = [
  { ...newQuestion('section'), id: 's1' },
  { ...newQuestion('short'), id: 'q1' },
  { ...newQuestion('choice'), id: 'q2' },
  { ...newQuestion('section'), id: 's2' },
  { ...newQuestion('scale'), id: 'q3' },
]
const nums = questionNumbers(numbered)
eq('numbers: first question is 1', nums['q1'], 1)
eq('numbers: second question is 2', nums['q2'], 2)
eq('numbers: numbering continues past a section', nums['q3'], 3)
eq('numbers: sections absent', nums['s1'], undefined)
eq('numbers: only answerable questions counted', Object.keys(nums).length, 3)
eq('numbers: empty form', questionNumbers([]), {})

// ---------- themes ----------

eq('themes: six', FORM_THEMES.length, 6)
eq('themes: ids unique', new Set(FORM_THEMES.map((t) => t.id)).size, 6)
ok('themes: every theme named', FORM_THEMES.every((t) => t.name.length > 0))
ok(
  'themes: colours are hex',
  FORM_THEMES.every((t) =>
    [t.theme.accent, t.theme.headerFrom, t.theme.headerTo, t.theme.headerColor].every((c) => /^#[0-9a-f]{6}$/.test(c)),
  ),
)
ok('themes: header text is white', FORM_THEMES.every((t) => t.theme.headerColor === '#ffffff'))
ok('themes: gradients have two stops', FORM_THEMES.every((t) => t.theme.headerFrom !== t.theme.headerTo))
ok('themes: fonts are real system fonts', FORM_THEMES.every((t) => SYSTEM_FONTS.includes(t.theme.fontFamily)))

// White header text needs a dark enough gradient — WCAG relative luminance,
// contrast >= 4.5:1 at both stops.
function luminance(hex: string): number {
  const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = parts.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}
const contrast = (hex: string) => 1.05 / (luminance(hex) + 0.05)
ok(
  'themes: white text readable on every gradient stop',
  FORM_THEMES.every((t) => contrast(t.theme.headerFrom) >= 4.5 && contrast(t.theme.headerTo) >= 4.5),
  FORM_THEMES.map((t) => [t.id, contrast(t.theme.headerFrom).toFixed(2), contrast(t.theme.headerTo).toFixed(2)]),
)
ok(
  'themes: white text readable on every accent',
  FORM_THEMES.every((t) => contrast(t.theme.accent) >= 4.5),
  FORM_THEMES.map((t) => [t.id, contrast(t.theme.accent).toFixed(2)]),
)

// ---------- response encoding ----------

const sample: FormResponse = {
  id: 'resp-1',
  submittedAt: 1_760_000_000_000,
  answers: { q1: 'Alpha', q2: ['One', 'Two'], q3: '4' },
}
const code = encodeResponse(sample)
ok('encode: prefixed', code.startsWith('ANLEO-RESPONSE:'))
ok('encode: no whitespace', !/\s/.test(code))
ok('encode: url-safe alphabet only', /^ANLEO-RESPONSE:[A-Za-z0-9_-]+$/.test(code))
ok('encode: answers not left in the clear', !code.includes('Alpha'))
eq('decode: round trip', decodeResponse(code), sample)
eq('decode: keeps array answers', decodeResponse(code)?.answers.q2, ['One', 'Two'])
eq('decode: keeps timestamp', decodeResponse(code)?.submittedAt, 1_760_000_000_000)

const unicode: FormResponse = {
  id: 'résumé-✓',
  submittedAt: 42,
  answers: {
    q1: 'Café naïve — Ærø 🎉🇬🇧',
    q2: ['Ω', '日本語', '👩‍👩‍👧‍👦'],
    q3: 'line one\nline two\ttabbed',
  },
}
const uniCode = encodeResponse(unicode)
eq('decode: unicode round trip', decodeResponse(uniCode), unicode)
eq('decode: emoji preserved', decodeResponse(uniCode)?.answers.q1, 'Café naïve — Ærø 🎉🇬🇧')
eq('decode: cjk preserved', (decodeResponse(uniCode)?.answers.q2 as string[])[1], '日本語')
eq('decode: zwj family preserved', (decodeResponse(uniCode)?.answers.q2 as string[])[2], '👩‍👩‍👧‍👦')
eq('decode: newlines and tabs preserved', decodeResponse(uniCode)?.answers.q3, 'line one\nline two\ttabbed')
eq(
  'decode: mixed-script answer survives byte for byte',
  decodeResponse(encodeResponse({ id: 'm', submittedAt: 9, answers: { q1: 'café 🎉 日本語' } }))?.answers.q1,
  'café 🎉 日本語',
)

eq('decode: tolerates wrapped code', decodeResponse(code.replace(/(.{20})/g, '$1\n')), sample)
eq('decode: tolerates spaces and tabs', decodeResponse(` ${code.slice(0, 30)} \t ${code.slice(30)}\r\n`), sample)
eq('decode: accepts a bare payload', decodeResponse(code.slice('ANLEO-RESPONSE:'.length)), sample)

eq('decode: empty string', decodeResponse(''), null)
eq('decode: whitespace only', decodeResponse('   \n\t '), null)
eq('decode: prefix with nothing after it', decodeResponse('ANLEO-RESPONSE:'), null)
eq('decode: prose', decodeResponse('here is my response, thanks!'), null)
eq('decode: illegal characters', decodeResponse('ANLEO-RESPONSE:$$$$'), null)
eq('decode: truncated payload', decodeResponse(code.slice(0, code.length - 6)), null)
eq('decode: head of payload only', decodeResponse(code.slice(0, 24)), null)
eq('decode: valid base64 that is not json', decodeResponse('ANLEO-RESPONSE:zzzz'), null)
eq(
  'decode: json without answers rejected',
  decodeResponse(encodeResponse({ id: 'x', submittedAt: 1 } as unknown as FormResponse)),
  null,
)
eq(
  'decode: json array rejected',
  decodeResponse(encodeResponse([1, 2, 3] as unknown as FormResponse)),
  null,
)

const dirty = encodeResponse({
  id: '',
  submittedAt: Number.NaN,
  answers: { a: null, b: 'ok', c: 7, d: ['x', 9, null] },
} as unknown as FormResponse)
const cleaned = decodeResponse(dirty)
ok('decode: missing id replaced', !!cleaned && cleaned.id.length > 0)
ok('decode: bad timestamp replaced', !!cleaned && Number.isFinite(cleaned.submittedAt))
eq('decode: null answer dropped', cleaned?.answers.a, undefined)
eq('decode: string answer kept', cleaned?.answers.b, 'ok')
eq('decode: numeric answer stringified', cleaned?.answers.c, '7')
eq('decode: array filtered to strings', cleaned?.answers.d, ['x'])

// A hostile .aresp can name an answer '__proto__'; assigning that key would
// re-parent the answers object rather than store anything.
const polluted = decodeResponse(
  encodeResponse(JSON.parse('{"id":"p","submittedAt":1,"answers":{"__proto__":["x"],"real":"kept"}}')),
)
eq('decode: proto key dropped', polluted?.answers.real, 'kept')
ok('decode: answers keep a plain prototype', !!polluted && Object.getPrototypeOf(polluted.answers) === Object.prototype)
ok('decode: answers gain no array methods', !!polluted && (polluted.answers as { map?: unknown }).map === undefined)

// An exported form may have been built by an older release whose in-page
// encoder used plain base64 — padding, '+' and '/' and all. Those files must
// still import years later, so the decoder accepts that alphabet too.
function standardBase64(text: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes = new TextEncoder().encode(text)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const rest = bytes.length - i
    const b0 = bytes[i]
    const b1 = rest > 1 ? bytes[i + 1] : 0
    const b2 = rest > 2 ? bytes[i + 2] : 0
    out += alphabet[b0 >> 2] + alphabet[((b0 & 3) << 4) | (b1 >> 4)]
    out += rest > 1 ? alphabet[((b1 & 15) << 2) | (b2 >> 6)] : '='
    out += rest > 2 ? alphabet[b2 & 63] : '='
  }
  return out
}
const legacy: FormResponse = { id: 'rÿ?~', submittedAt: 7, answers: { q1: 'Ωÿ?~' } }
const legacyCode = 'ANLEO-RESPONSE:' + standardBase64(JSON.stringify(legacy))
ok('decode: legacy sample really uses the standard alphabet', /[+/]/.test(legacyCode) && legacyCode.endsWith('='))
eq('decode: plain base64 with padding', decodeResponse(legacyCode), legacy)

// ---------- .aresp payloads ----------

const arespFile = [
  'Anleo Forms response',
  'Form: Team lunch',
  '',
  code,
  '',
  'Send this file back to whoever sent you the form.',
].join('\n')
eq('payload: full .aresp file', parseResponsePayload(arespFile), sample)
eq('payload: bare code', parseResponsePayload(code), sample)
eq('payload: bare code with surrounding blank lines', parseResponsePayload(`\n\n${code}\n\n`), sample)
const wrapped = code.slice(0, 15) + code.slice(15).replace(/(.{40})/g, '$1\n')
eq('payload: code wrapped across lines in a file', parseResponsePayload(`Hi!\n\n${wrapped}\n\nThanks`), sample)
eq(
  'payload: code on the line after the marker',
  parseResponsePayload(`Anleo Forms response\n\nANLEO-RESPONSE:\n\n${code.slice('ANLEO-RESPONSE:'.length)}\n\nThanks`),
  sample,
)
eq('payload: prose only', parseResponsePayload('I filled it in, see attached.'), null)
eq('payload: marker with no code', parseResponsePayload('ANLEO-RESPONSE:\n\nnothing here'), null)
eq('payload: empty', parseResponsePayload(''), null)

// ---------- CSV ----------

const questions: FormQuestion[] = [
  { id: 'q1', kind: 'short', title: 'Name' },
  { id: 'sec', kind: 'section', title: 'About the event' },
  { id: 'q2', kind: 'paragraph', title: 'Comments, please' },
  { id: 'q3', kind: 'checkboxes', title: 'Dietary needs', options: [{ id: 'o1', label: 'Vegan' }, { id: 'o2', label: 'Gluten free' }] },
]
const csvResponses: FormResponse[] = [
  {
    id: 'r1',
    submittedAt: new Date(2026, 0, 2, 3, 4, 5).getTime(),
    answers: { q1: 'Ada, Countess', q2: 'She said "yes"', q3: ['Vegan'] },
  },
  {
    id: 'r2',
    submittedAt: new Date(2026, 11, 31, 23, 59).getTime(),
    answers: { q1: 'Bob', q2: 'line one\nline two' },
  },
]
const csv = responsesToCsv(questions, csvResponses)
const csvLines = csv.split('\r\n')
eq('csv: crlf separated', csv.includes('\r\n'), true)
eq('csv: header row', csvLines[0], 'Submitted,Name,"Comments, please",Dietary needs')
ok('csv: sections excluded', !csv.includes('About the event'))
ok('csv: comma value quoted', csvLines[1].includes('"Ada, Countess"'))
ok('csv: embedded quotes doubled', csvLines[1].includes('"She said ""yes"""'))
ok('csv: plain values unquoted', csvLines[1].startsWith('2026-01-02 03:04,'))
eq('csv: timestamp formatting', csvLines[1].split(',')[0], '2026-01-02 03:04')
ok('csv: newline value quoted', csv.includes('"line one\nline two"'))
eq('csv: embedded newline does not start a row', csvLines.length, 3)
eq('csv: missing answer is an empty field', csvLines[2], '2026-12-31 23:59,Bob,"line one\nline two",')
eq('csv: header only when no responses', responsesToCsv(questions, []), 'Submitted,Name,"Comments, please",Dietary needs')
ok('csv: checkbox answers joined', responsesToCsv(questions, [
  { id: 'r3', submittedAt: 0, answers: { q3: ['Vegan', 'Gluten free'] } },
]).includes('"Vegan, Gluten free"'))

// The respondent is a stranger and the author opens this in Excel, so nothing
// they typed may arrive as a live formula.
const evilQuestions: FormQuestion[] = [
  { id: 'e1', kind: 'short', title: 'Answer' },
  { id: 'e2', kind: 'number', title: 'Amount' },
]
const evilRow = (a: string, b: string): string =>
  responsesToCsv(evilQuestions, [{ id: 'x', submittedAt: 0, answers: { e1: a, e2: b } }]).split('\r\n')[1]
ok('csv: equals formula neutralised', evilRow('=1+1', '').includes(",'=1+1,"))
ok('csv: plus formula neutralised', evilRow('+1+1', '').includes(",'+1+1,"))
ok('csv: minus formula neutralised', evilRow('-1+1', '').includes(",'-1+1,"))
ok('csv: at formula neutralised', evilRow('@SUM(A1)', '').includes(",'@SUM(A1),"))
ok('csv: leading tab neutralised', evilRow('\t=1+1', '').includes(",'\t=1+1,"))
ok(
  'csv: quoted formula still escaped',
  evilRow('=HYPERLINK("http://x","go")', '').includes('"\'=HYPERLINK(""http://x"",""go"")"'),
)
ok('csv: negative number left as a number', evilRow('x', '-5').endsWith(',-5'))
ok('csv: negative decimal left as a number', evilRow('x', '-3.5').endsWith(',-3.5'))
ok('csv: exponent left as a number', evilRow('x', '-1e5').endsWith(',-1e5'))
ok('csv: plain text untouched', evilRow('Ada', '').includes(',Ada,'))
ok(
  'csv: formula in a question title neutralised',
  responsesToCsv([{ id: 't', kind: 'short', title: '=cmd|calc' }], []).endsWith(",'=cmd|calc"),
)

// ---------- sheet ----------

const content = responsesToSheet(questions, csvResponses)
eq('sheet: one sheet', content.sheets.length, 1)
eq('sheet: active index', content.active, 0)
eq('sheet: named', content.sheets[0].name, 'Responses')
const grid = content.sheets[0]
eq('sheet: A1 header', grid.cells['A1']?.v, 'Submitted')
eq('sheet: B1 first question', grid.cells['B1']?.v, 'Name')
eq('sheet: C1 skips the section', grid.cells['C1']?.v, 'Comments, please')
eq('sheet: D1 last question', grid.cells['D1']?.v, 'Dietary needs')
eq('sheet: no fifth column', grid.cells['E1'], undefined)
eq('sheet: header bold', grid.cells['A1']?.style?.bold, true)
ok('sheet: header filled', typeof grid.cells['B1']?.style?.fill === 'string')
eq('sheet: first response timestamp', grid.cells['A2']?.v, '2026-01-02 03:04')
eq('sheet: first response answer', grid.cells['B2']?.v, 'Ada, Countess')
eq('sheet: checkbox answer flattened', grid.cells['D2']?.v, 'Vegan')
eq('sheet: second response row', grid.cells['B3']?.v, 'Bob')
eq('sheet: unanswered cell omitted', grid.cells['D3'], undefined)
ok('sheet: submitted column widened', (grid.colWidths[0] ?? 0) >= 120)
ok('sheet: every question column has a width', questions.filter((q) => q.kind !== 'section').every((_q, i) => (grid.colWidths[i + 1] ?? 0) > 0))
ok('sheet: paragraph column is roomier', (grid.colWidths[2] ?? 0) > (grid.colWidths[1] ?? 0))
eq('sheet: header row frozen', grid.freeze, { rows: 1, cols: 0 })
eq('sheet: no rows when no responses', Object.keys(responsesToSheet(questions, []).sheets[0].cells).length, 4)

// Cell.v documents a leading '=' as a formula and the .xlsx export writes it as
// one, so an imported answer must not land in the author's grid as live code.
const evilSheet = responsesToSheet([{ id: 'e1', kind: 'short', title: '=cmd|calc' }], [
  { id: 'x', submittedAt: 0, answers: { e1: '=1+1' } },
])
eq('sheet: answer formula neutralised', evilSheet.sheets[0].cells['B2']?.v, "'=1+1")
eq('sheet: title formula neutralised', evilSheet.sheets[0].cells['B1']?.v, "'=cmd|calc")
eq(
  'sheet: ordinary answers untouched',
  responsesToSheet(questions, csvResponses).sheets[0].cells['B2']?.v,
  'Ada, Countess',
)

// ---------- summaries ----------

const pick: FormQuestion = {
  id: 'p1',
  kind: 'choice',
  title: 'Which venue?',
  otherOption: true,
  options: [
    { id: 'a', label: 'The Bell' },
    { id: 'b', label: 'The Crown' },
    { id: 'c', label: 'The Anchor' },
  ],
}
const pickResponses: FormResponse[] = [
  { id: '1', submittedAt: 1, answers: { p1: 'The Bell' } },
  { id: '2', submittedAt: 2, answers: { p1: 'The Bell' } },
  { id: '3', submittedAt: 3, answers: { p1: 'Somewhere with a garden' } },
  { id: '4', submittedAt: 4, answers: {} },
  { id: '5', submittedAt: 5, answers: { p1: '  ' } },
]
const pickSummary = summarize(pick, pickResponses)
eq('summary: answered count', pickSummary.answered, 3)
eq('summary: skipped count', pickSummary.skipped, 2)
eq('summary: bucket order follows the options', pickSummary.buckets.slice(0, 3).map((b) => b.label), [
  'The Bell',
  'The Crown',
  'The Anchor',
])
eq('summary: counted picks', pickSummary.buckets[0].count, 2)
eq('summary: unpicked option still appears', pickSummary.buckets[1], { label: 'The Crown', count: 0 })
eq('summary: other answer gets its own bucket', pickSummary.buckets[3], {
  label: 'Somewhere with a garden',
  count: 1,
})
eq('summary: no stray buckets', pickSummary.buckets.length, 4)
eq('summary: choice has no average', pickSummary.average, null)
eq('summary: choice collects no texts', pickSummary.texts, [])

const boxes: FormQuestion = {
  id: 'b1',
  kind: 'checkboxes',
  title: 'Which days?',
  options: [
    { id: 'm', label: 'Mon' },
    { id: 't', label: 'Tue' },
  ],
}
const boxSummary = summarize(boxes, [
  { id: '1', submittedAt: 1, answers: { b1: ['Mon', 'Tue'] } },
  { id: '2', submittedAt: 2, answers: { b1: ['Tue'] } },
  { id: '3', submittedAt: 3, answers: { b1: [] } },
])
eq('summary: checkbox answered', boxSummary.answered, 2)
eq('summary: checkbox skipped on empty array', boxSummary.skipped, 1)
eq('summary: each tick counted', boxSummary.buckets, [
  { label: 'Mon', count: 1 },
  { label: 'Tue', count: 2 },
])

const rating: FormQuestion = { id: 's1', kind: 'scale', title: 'How was it?', scaleMin: 1, scaleMax: 5 }
const ratingSummary = summarize(rating, [
  { id: '1', submittedAt: 1, answers: { s1: '5' } },
  { id: '2', submittedAt: 2, answers: { s1: '4' } },
  { id: '3', submittedAt: 3, answers: { s1: '5' } },
  { id: '4', submittedAt: 4, answers: {} },
])
eq('summary: scale buckets span the range', ratingSummary.buckets.map((b) => b.label), ['1', '2', '3', '4', '5'])
eq('summary: scale counts', ratingSummary.buckets.map((b) => b.count), [0, 0, 0, 1, 2])
eq('summary: scale average', ratingSummary.average, 14 / 3)
eq('summary: scale answered', ratingSummary.answered, 3)
eq('summary: scale skipped', ratingSummary.skipped, 1)
eq('summary: empty scale has no average', summarize(rating, []).average, null)
eq('summary: empty scale keeps its buckets', summarize(rating, []).buckets.length, 5)
eq(
  'summary: nonsense scale range does not explode the buckets',
  summarize({ id: 'w1', kind: 'scale', title: 'Wide', scaleMin: 1, scaleMax: 500000 }, []).buckets.length,
  20,
)
eq(
  'summary: fractional bounds bucket the answers the form could produce',
  summarize({ id: 'f1', kind: 'scale', title: 'Frac', scaleMin: 1.4, scaleMax: 4.6 }, [
    { id: '1', submittedAt: 1, answers: { f1: '3' } },
  ]).buckets,
  [
    { label: '1', count: 0 },
    { label: '2', count: 0 },
    { label: '3', count: 1 },
    { label: '4', count: 0 },
    { label: '5', count: 0 },
  ],
)

// Options get deleted after responses are in; the answers must survive as their
// own buckets rather than vanish from the tally.
const trimmed: FormQuestion = { id: 'p1', kind: 'choice', title: 'Which venue?', options: [{ id: 'a', label: 'The Bell' }] }
const trimmedSummary = summarize(trimmed, pickResponses)
eq('summary: deleted option answers still bucketed', trimmedSummary.buckets, [
  { label: 'The Bell', count: 2 },
  { label: 'Somewhere with a garden', count: 1 },
])
eq(
  'summary: answered plus skipped covers every response',
  trimmedSummary.answered + trimmedSummary.skipped,
  pickResponses.length,
)

const note: FormQuestion = { id: 'n1', kind: 'paragraph', title: 'Anything else?' }
const noteSummary = summarize(note, [
  { id: '1', submittedAt: 1, answers: { n1: 'More cake' } },
  { id: '2', submittedAt: 2, answers: { n1: '' } },
  { id: '3', submittedAt: 3, answers: { n1: 'Less rain' } },
])
eq('summary: texts collected in order', noteSummary.texts, ['More cake', 'Less rain'])
eq('summary: text answered', noteSummary.answered, 2)
eq('summary: text skipped', noteSummary.skipped, 1)
eq('summary: text has no buckets', noteSummary.buckets, [])

const spend: FormQuestion = { id: 'm1', kind: 'number', title: 'Budget' }
eq(
  'summary: number average',
  summarize(spend, [
    { id: '1', submittedAt: 1, answers: { m1: '10' } },
    { id: '2', submittedAt: 2, answers: { m1: '20' } },
  ]).average,
  15,
)

const heading: FormQuestion = { id: 'h1', kind: 'section', title: 'Part two' }
const headingSummary = summarize(heading, pickResponses)
eq('summary: section answered is zero', headingSummary.answered, 0)
eq('summary: section skipped is zero', headingSummary.skipped, 0)
eq('summary: section has no buckets', headingSummary.buckets, [])
eq('summary: section has no average', headingSummary.average, null)

// ---------- quiz: the answer key ----------

const noKey: FormQuestion = { id: 'k0', kind: 'short', title: 'Free text' }
eq('key: absent by default', hasAnswerKey(noKey), false)
eq('key: blank entries do not count', hasAnswerKey({ ...noKey, correct: ['', '  '] }), false)
eq('key: a typed answer counts', hasAnswerKey({ ...noKey, correct: ['Paris'] }), true)
eq('key: a section can never be marked', hasAnswerKey({ id: 's', kind: 'section', title: 'x', correct: ['a'] }), false)

const keyed = (kind: QuestionKind, extra: Partial<FormQuestion>): FormQuestion => ({
  ...newQuestion(kind),
  id: `q-${kind}`,
  ...extra,
})

const capitals: FormQuestion = keyed('choice', {
  options: [
    { id: 'a', label: 'Paris' },
    { id: 'b', label: 'Lyon' },
    { id: 'c', label: 'Nice' },
  ],
  correct: ['a'],
})
eq('key: option ids resolve to their labels', acceptedAnswers(capitals), ['Paris'])
eq(
  'key: an id matching no option is taken literally',
  acceptedAnswers({ ...capitals, correct: ['a', 'Marseille'] }),
  ['Paris', 'Marseille'],
)

eq('marks: none without a key', questionMarks(noKey), 0)
eq('marks: a key with no marks set is worth one', questionMarks(capitals), 1)
eq('marks: an explicit value is used', questionMarks({ ...capitals, points: 3 }), 3)
eq('marks: an explicit zero is respected', questionMarks({ ...capitals, points: 0 }), 0)
eq('marks: a nonsense value falls back to one', questionMarks({ ...capitals, points: Number.NaN }), 1)
eq('marks: a negative value falls back to one', questionMarks({ ...capitals, points: -4 }), 1)
eq('marks: half marks survive', questionMarks({ ...capitals, points: 0.5 }), 0.5)

// ---------- quiz: grading, kind by kind ----------

const UNMARKED = { earned: 0, total: 0, correct: null }

eq('grade: no key means not marked at all', gradeAnswer(noKey, 'anything'), UNMARKED)
eq('grade: a key of blanks is no key', gradeAnswer({ ...noKey, correct: ['  '] }, 'x'), UNMARKED)
eq('grade: sections are never marked', gradeAnswer({ id: 's', kind: 'section', title: 'x', correct: ['a'] }, 'a'), UNMARKED)

eq('grade: choice right', gradeAnswer(capitals, 'Paris'), { earned: 1, total: 1, correct: true })
eq('grade: choice wrong', gradeAnswer(capitals, 'Lyon'), { earned: 0, total: 1, correct: false })
eq('grade: choice unanswered', gradeAnswer(capitals, undefined), { earned: 0, total: 1, correct: false })
eq('grade: choice blank string', gradeAnswer(capitals, '   '), { earned: 0, total: 1, correct: false })
eq('grade: choice carries its marks', gradeAnswer({ ...capitals, points: 4 }, 'Paris'), {
  earned: 4,
  total: 4,
  correct: true,
})
eq('grade: choice is case-insensitive', gradeAnswer(capitals, 'paris'), { earned: 1, total: 1, correct: true })
eq('grade: choice ignores surrounding space', gradeAnswer(capitals, '  Paris '), { earned: 1, total: 1, correct: true })

const dropdown: FormQuestion = keyed('dropdown', {
  options: [
    { id: 'y1', label: '1989' },
    { id: 'y2', label: '1990' },
  ],
  correct: ['y1'],
  points: 2,
})
eq('grade: dropdown right', gradeAnswer(dropdown, '1989'), { earned: 2, total: 2, correct: true })
eq('grade: dropdown wrong', gradeAnswer(dropdown, '1990'), { earned: 0, total: 2, correct: false })

const nobles: FormQuestion = keyed('checkboxes', {
  options: [
    { id: 'he', label: 'Helium' },
    { id: 'n', label: 'Nitrogen' },
    { id: 'ar', label: 'Argon' },
    { id: 'ne', label: 'Neon' },
  ],
  correct: ['he', 'ar', 'ne'],
  points: 3,
})
eq('grade: checkboxes all three right', gradeAnswer(nobles, ['Helium', 'Argon', 'Neon']), {
  earned: 3,
  total: 3,
  correct: true,
})
eq('grade: checkboxes order does not matter', gradeAnswer(nobles, ['Neon', 'Helium', 'Argon']), {
  earned: 3,
  total: 3,
  correct: true,
})
eq('grade: checkboxes partial credit', gradeAnswer(nobles, ['Helium', 'Argon']), {
  earned: 2,
  total: 3,
  correct: false,
})
eq('grade: checkboxes one right', gradeAnswer(nobles, ['Neon']), { earned: 1, total: 3, correct: false })
eq('grade: checkboxes a wrong tick costs a right one', gradeAnswer(nobles, ['Helium', 'Argon', 'Nitrogen']), {
  earned: 1,
  total: 3,
  correct: false,
})
eq('grade: checkboxes ticking everything scores nothing', gradeAnswer(nobles, ['Helium', 'Nitrogen', 'Argon', 'Neon']), {
  earned: 2,
  total: 3,
  correct: false,
})
eq(
  'grade: checkboxes cannot go below zero',
  gradeAnswer({ ...nobles, correct: ['he'] }, ['Nitrogen', 'Argon', 'Neon']),
  { earned: 0, total: 3, correct: false },
)
eq('grade: checkboxes nothing ticked', gradeAnswer(nobles, []), { earned: 0, total: 3, correct: false })
eq('grade: checkboxes duplicate ticks counted once', gradeAnswer(nobles, ['Helium', 'helium']), {
  earned: 1,
  total: 3,
  correct: false,
})
// Two options wearing the same label are one answer to whoever ticks them, and
// one answer on the wire, which carries labels rather than ids. Counting the key
// twice made a question nobody could get full marks on.
const twins = keyed('checkboxes', {
  options: [
    { id: 't1', label: 'Red' },
    { id: 't2', label: 'red' },
    { id: 't3', label: 'Blue' },
  ],
  correct: ['t1', 't2'],
  points: 2,
})
eq('grade: a key naming two options with one label is one answer', gradeAnswer(twins, ['Red']), {
  earned: 2,
  total: 2,
  correct: true,
})
eq('grade: ticking both of them scores the same', gradeAnswer(twins, ['Red', 'red']), {
  earned: 2,
  total: 2,
  correct: true,
})
eq('grade: the wrong one still costs', gradeAnswer(twins, ['Red', 'Blue']), {
  earned: 0,
  total: 2,
  correct: false,
})
// A third of two marks is 0.6666…, which nobody wants to read on a marked paper.
eq('grade: part marks are rounded to two places', gradeAnswer({ ...nobles, points: 2 }, ['Helium']).earned, 0.67)

const capital = keyed('short', { correct: ['Canberra', 'Canberra, ACT'] })
eq('grade: short exact', gradeAnswer(capital, 'Canberra'), { earned: 1, total: 1, correct: true })
eq('grade: short ignores case', gradeAnswer(capital, 'canberra'), { earned: 1, total: 1, correct: true })
eq('grade: short ignores surrounding whitespace', gradeAnswer(capital, '  CANBERRA \n'), {
  earned: 1,
  total: 1,
  correct: true,
})
eq('grade: short accepts a second wording', gradeAnswer(capital, 'canberra, act'), {
  earned: 1,
  total: 1,
  correct: true,
})
eq('grade: short wrong', gradeAnswer(capital, 'Sydney'), { earned: 0, total: 1, correct: false })
eq('grade: short blank', gradeAnswer(capital, ''), { earned: 0, total: 1, correct: false })
eq('grade: short does not match a substring', gradeAnswer(capital, 'Canberra is the capital'), {
  earned: 0,
  total: 1,
  correct: false,
})

const sides = keyed('number', { correct: ['6', 'six'] })
eq('grade: number exact', gradeAnswer(sides, '6'), { earned: 1, total: 1, correct: true })
eq('grade: number written out', gradeAnswer(sides, 'Six'), { earned: 1, total: 1, correct: true })
// 7.0 and 07 are the same number to everyone except a string comparison.
eq('grade: number trailing zero', gradeAnswer(sides, '6.0'), { earned: 1, total: 1, correct: true })
eq('grade: number leading zero', gradeAnswer(sides, '06'), { earned: 1, total: 1, correct: true })
eq('grade: number wrong', gradeAnswer(sides, '7'), { earned: 0, total: 1, correct: false })
eq(
  'grade: numeric leniency does not leak into short answers',
  gradeAnswer({ ...capital, correct: ['6'] }, '6.0'),
  { earned: 0, total: 1, correct: false },
)

const when = keyed('date', { correct: ['2026-12-21'] })
eq('grade: date right', gradeAnswer(when, '2026-12-21'), { earned: 1, total: 1, correct: true })
eq('grade: date wrong', gradeAnswer(when, '2026-12-22'), { earned: 0, total: 1, correct: false })

const at = keyed('time', { correct: ['09:30'] })
eq('grade: time right', gradeAnswer(at, '09:30'), { earned: 1, total: 1, correct: true })
eq('grade: time wrong', gradeAnswer(at, '09:31'), { earned: 0, total: 1, correct: false })

eq('grade: email right', gradeAnswer(keyed('email', { correct: ['a@b.com'] }), 'A@B.com'), {
  earned: 1,
  total: 1,
  correct: true,
})
eq('grade: scale right', gradeAnswer(keyed('scale', { correct: ['4'] }), '4'), { earned: 1, total: 1, correct: true })
eq('grade: paragraph right', gradeAnswer(keyed('paragraph', { correct: ['yes'] }), 'Yes'), {
  earned: 1,
  total: 1,
  correct: true,
})
eq('grade: a question worth zero still marks', gradeAnswer({ ...capitals, points: 0 }, 'Paris'), {
  earned: 0,
  total: 0,
  correct: true,
})

// ---------- quiz: a whole paper ----------

const paper: FormQuestion[] = [
  { id: 'name', kind: 'short', title: 'Your name' },
  { id: 'sec', kind: 'section', title: 'Round one' },
  { ...capitals, id: 'c1' },
  { ...nobles, id: 'c2' },
  { ...capital, id: 'c3', points: 2 },
]
eq('quiz: marks available', quizTotal(paper), 6)
eq('quiz: an unmarked form is worth nothing', quizTotal([{ id: 'x', kind: 'short', title: 'Name' }]), 0)
eq(
  'quiz: full marks',
  gradeResponse(paper, { name: 'Ada', c1: 'Paris', c2: ['Helium', 'Argon', 'Neon'], c3: 'canberra' }),
  { earned: 6, total: 6 },
)
eq(
  'quiz: one right, one part, one wrong',
  gradeResponse(paper, { c1: 'Paris', c2: ['Helium'], c3: 'Sydney' }),
  { earned: 2, total: 6 },
)
eq('quiz: an empty paper still totals', gradeResponse(paper, {}), { earned: 0, total: 6 })
eq('quiz: unmarked questions add nothing', gradeResponse([{ id: 'n', kind: 'short', title: 'Name' }], { n: 'Ada' }), {
  earned: 0,
  total: 0,
})
eq(
  'quiz: only the questions handed in are marked',
  gradeResponse([paper[2]], { c1: 'Paris', c2: ['Helium'], c3: 'Canberra' }),
  { earned: 1, total: 1 },
)

// ---------- sections as pages ----------

const s = (id: string, title = id): FormQuestion => ({ id, kind: 'section', title })
const shortQof = (id: string): FormQuestion => ({ id, kind: 'short', title: id })

eq('pages: a form with no sections is one page', formPages([shortQof('a'), shortQof('b')]).length, 1)
eq('pages: the leading page has no section', formPages([shortQof('a')])[0].section, null)
eq('pages: the leading page is called start', formPages([shortQof('a')])[0].id, 'start')
eq('pages: each section starts a page', formPages([shortQof('a'), s('s1'), shortQof('b'), s('s2'), shortQof('c')]).length, 3)
eq(
  'pages: a form opening with a section does not open on a blank page',
  formPages([s('s1'), shortQof('a')]).map((p) => p.id),
  ['s1'],
)
eq('pages: an empty form has no pages', formPages([]), [])
eq('pages: a section with no questions is still a page', formPages([s('s1'), s('s2')]).map((p) => p.id), ['s1', 's2'])
eq(
  'pages: questions land on the page they follow',
  formPages([shortQof('a'), s('s1'), shortQof('b'), shortQof('c')]).map((p) => p.questions.map((x) => x.id)),
  [['a'], ['b', 'c']],
)

// ---------- branching ----------

const route: FormOption[] = [
  { id: 'o-yes', label: 'Yes' },
  { id: 'o-no', label: 'No' },
]
const branched: FormQuestion = {
  id: 'gate',
  kind: 'choice',
  title: 'Coming?',
  options: route,
  branches: [
    { optionId: 'o-yes', goTo: 'details' },
    { optionId: 'o-no', goTo: BRANCH_END },
  ],
}
const branchingForm: FormQuestion[] = [
  branched,
  s('details', 'Your details'),
  shortQof('meal'),
  s('closing', 'Anything else'),
  shortQof('note'),
]
const branchPages = formPages(branchingForm)

eq('branch: an answer with a route returns it', branchTarget(branched, 'Yes'), 'details')
eq('branch: the other answer ends the form', branchTarget(branched, 'No'), BRANCH_END)
eq('branch: an unanswered question routes nowhere', branchTarget(branched, undefined), null)
eq('branch: a blank answer routes nowhere', branchTarget(branched, '  '), null)
eq('branch: matching is case-insensitive', branchTarget(branched, 'yes'), 'details')
eq('branch: an answer with no route returns null', branchTarget({ ...branched, branches: [] }, 'Yes'), null)
eq(
  'branch: only choice and dropdown route',
  branchTarget({ ...branched, kind: 'checkboxes' }, 'Yes'),
  null,
)

eq('branch: yes goes to the details section', nextPageIndex(branchPages, 0, { gate: 'Yes' }), 1)
eq('branch: no ends the form', nextPageIndex(branchPages, 0, { gate: 'No' }), -1)
eq('branch: no answer carries on to the next page', nextPageIndex(branchPages, 0, {}), 1)
eq('branch: the last page ends the form', nextPageIndex(branchPages, 2, {}), -1)
eq('branch: an unknown page index ends rather than throws', nextPageIndex(branchPages, 99, {}), -1)

// A section is deleted after the routing was set. The route cannot be obeyed,
// and stranding the respondent would be the worst of the options.
const orphaned = formPages([branched, s('closing', 'Anything else'), shortQof('note')])
eq('branch: a route to a deleted section falls through to the next page', nextPageIndex(orphaned, 0, { gate: 'Yes' }), 1)
eq('branch: the surviving route still works', nextPageIndex(orphaned, 0, { gate: 'No' }), -1)

// Two routing questions on one page: the one they answered most recently is
// the one still in front of them.
const twoGates = formPages([
  branched,
  { ...branched, id: 'gate2', branches: [{ optionId: 'o-yes', goTo: 'closing' }] },
  s('details', 'Your details'),
  shortQof('meal'),
  s('closing', 'Anything else'),
  shortQof('note'),
])
eq('branch: the last routing question on a page wins', nextPageIndex(twoGates, 0, { gate: 'Yes', gate2: 'Yes' }), 2)
eq('branch: an unanswered later question defers to an earlier one', nextPageIndex(twoGates, 0, { gate: 'Yes' }), 1)

eq(
  'path: a route past a section leaves its questions out',
  answeredPath(branchingForm, { gate: 'No' }).map((x) => x.id),
  ['gate'],
)
eq(
  'path: the other route walks through everything',
  answeredPath(branchingForm, { gate: 'Yes' }).map((x) => x.id),
  ['gate', 'meal', 'note'],
)
eq(
  'path: no answer follows the form in order',
  answeredPath(branchingForm, {}).map((x) => x.id),
  ['gate', 'meal', 'note'],
)
// A route into the page the question is already on can never be walked off, so
// it is ignored and the form carries on. Obeying it leaves a respondent pressing
// Next on the same page forever, unable to reach Submit at all.
const selfRouted: FormQuestion[] = [
  s('one', 'One'),
  { ...branched, branches: [{ optionId: 'o-yes', goTo: 'one' }] },
  s('two', 'Two'),
  shortQof('later'),
]
eq('branch: a route to its own page is ignored', nextPageIndex(formPages(selfRouted), 0, { gate: 'Yes' }), 1)
eq(
  'path: a route to its own page carries on',
  answeredPath(selfRouted, { gate: 'Yes' }).map((x) => x.id),
  ['gate', 'later'],
)

// A route to an *earlier* page is a loop a respondent can walk round on purpose
// and leave by changing their answer; replaying one here has to stop rather
// than hang the app.
const looping: FormQuestion[] = [
  s('one', 'One'),
  shortQof('first'),
  s('two', 'Two'),
  { ...branched, branches: [{ optionId: 'o-yes', goTo: 'one' }] },
]
eq('branch: a route to an earlier page is obeyed', nextPageIndex(formPages(looping), 1, { gate: 'Yes' }), 0)
eq('path: a loop is walked once', answeredPath(looping, { gate: 'Yes' }).map((x) => x.id), ['first', 'gate'])

eq(
  'targets: only sections after the question are offered',
  sectionsAfter(branchingForm, 'gate').map((x) => x.id),
  ['details', 'closing'],
)
eq(
  'targets: a question on the last page has nowhere to send anyone',
  sectionsAfter(branchingForm, 'note').map((x) => x.id),
  [],
)
eq('targets: a question that is not in the form has no targets', sectionsAfter(branchingForm, 'nope'), [])

eq('problems: a well-formed branch has none', branchProblems(branchingForm), [])
const missing = branchProblems([branched, s('closing', 'Anything else'), shortQof('note')])
eq('problems: a deleted section is reported once', missing.length, 1)
eq('problems: reported against its question', missing[0].questionId, 'gate')
eq('problems: named as missing', missing[0].kind, 'missing')
ok('problems: the message names the option', missing[0].message.includes('Yes'))
const backwards = branchProblems(looping)
eq('problems: a backwards jump is reported', backwards.length, 1)
eq('problems: named as backwards', backwards[0].kind, 'backwards')
ok('problems: the message names the section it jumps back to', backwards[0].message.includes('One'))
ok('problems: the message says they could go round forever', backwards[0].message.includes('forever'))
eq(
  'problems: a branch to the end of the form is fine',
  branchProblems([{ ...branched, branches: [{ optionId: 'o-yes', goTo: BRANCH_END }] }, s('later', 'Later')]),
  [],
)
const ownPage = branchProblems([s('one', 'One'), { ...branched, branches: [{ optionId: 'o-yes', goTo: 'one' }] }])
eq('problems: a branch to its own page is reported', ownPage[0].kind, 'backwards')
ok('problems: it is described as doing nothing, not as looping', ownPage[0].message.includes('carry on'))

// ---------- scores on the wire ----------

const marked: FormResponse = {
  id: 'm1',
  submittedAt: 1_760_000_000_000,
  answers: { q1: 'Paris' },
  score: { earned: 7, total: 10 },
}
const markedCode = encodeResponse(marked)
eq('score: round trips through the code', decodeResponse(markedCode), marked)
eq('score: earned survives', decodeResponse(markedCode)?.score?.earned, 7)
eq('score: out of survives', decodeResponse(markedCode)?.score?.total, 10)
eq('score: part marks survive', decodeResponse(encodeResponse({ ...marked, score: { earned: 6.67, total: 10 } }))?.score, {
  earned: 6.67,
  total: 10,
})
eq('score: full marks survive', decodeResponse(encodeResponse({ ...marked, score: { earned: 10, total: 10 } }))?.score?.earned, 10)
eq('score: zero survives', decodeResponse(encodeResponse({ ...marked, score: { earned: 0, total: 10 } }))?.score?.earned, 0)
eq('score: an unmarked response has none', decodeResponse(code)?.score, undefined)

// A wrong score in the author's table is worse than no score, so anything that
// cannot be true is dropped rather than repaired.
const badScore = (score: unknown): unknown =>
  decodeResponse(encodeResponse({ ...marked, score } as unknown as FormResponse))?.score
eq('score: more than the paper is worth is dropped', badScore({ earned: 11, total: 10 }), undefined)
eq('score: a negative score is dropped', badScore({ earned: -1, total: 10 }), undefined)
eq('score: an unmarkable paper is dropped', badScore({ earned: 0, total: 0 }), undefined)
eq('score: text instead of numbers is dropped', badScore({ earned: 'lots', total: '10' }), undefined)
eq('score: a missing total is dropped', badScore({ earned: 3 }), undefined)
eq('score: an array is dropped', badScore([7, 10]), undefined)
eq('score: null is dropped', badScore(null), undefined)
ok('score: the rest of the response survives a bad score', decodeResponse(encodeResponse({ ...marked, score: { earned: 99, total: 1 } } as FormResponse))?.answers.q1 === 'Paris')

// ---------- marks in the tabular output ----------

const quizQuestions: FormQuestion[] = [
  { id: 'q1', kind: 'short', title: 'Name' },
  { id: 'q2', kind: 'choice', title: 'Capital of France', options: [{ id: 'a', label: 'Paris' }], correct: ['a'] },
]
const quizResponses: FormResponse[] = [
  { id: 'r1', submittedAt: new Date(2026, 0, 2, 3, 4).getTime(), answers: { q1: 'Ada', q2: 'Paris' }, score: { earned: 1, total: 1 } },
  { id: 'r2', submittedAt: new Date(2026, 0, 3, 3, 4).getTime(), answers: { q1: 'Bob', q2: 'Lyon' }, score: { earned: 0, total: 1 } },
]
const quizCsv = responsesToCsv(quizQuestions, quizResponses).split('\r\n')
eq('csv: marks get their own columns', quizCsv[0], 'Submitted,Score,Out of,Name,Capital of France')
eq('csv: the score is a number, not "1 / 1"', quizCsv[1], '2026-01-02 03:04,1,1,Ada,Paris')
eq('csv: a zero score is written, not left blank', quizCsv[2], '2026-01-03 03:04,0,1,Bob,Lyon')
ok('csv: a survey gains no score columns', !responsesToCsv(questions, csvResponses).includes('Out of'))
ok(
  'csv: a response with no score leaves the cells empty',
  responsesToCsv(quizQuestions, [quizResponses[0], { id: 'r3', submittedAt: 0, answers: { q1: 'Cy' } }])
    .split('\r\n')[2]
    .endsWith(',,,Cy,'),
)

const quizSheet = responsesToSheet(quizQuestions, quizResponses).sheets[0]
eq('sheet: score header', quizSheet.cells['B1']?.v, 'Score')
eq('sheet: out-of header', quizSheet.cells['C1']?.v, 'Out of')
eq('sheet: questions shift right of the marks', quizSheet.cells['D1']?.v, 'Name')
eq('sheet: the score lands as a number', quizSheet.cells['B2']?.v, '1')
eq('sheet: a zero score is written', quizSheet.cells['B3']?.v, '0')
eq('sheet: answers still follow', quizSheet.cells['D2']?.v, 'Ada')
ok('sheet: the marks columns are sized', (quizSheet.colWidths[1] ?? 0) > 0 && (quizSheet.colWidths[2] ?? 0) > 0)
ok('sheet: a survey gains no marks column', responsesToSheet(questions, csvResponses).sheets[0].cells['B1']?.v === 'Name')

// ---------- how the class did ----------

eq('stats: nothing to report without marks', scoreStats(csvResponses), null)
eq('stats: nothing to report with no responses', scoreStats([]), null)
const classOf = (...marks: number[]): FormResponse[] =>
  marks.map((earned, i) => ({ id: `s${i}`, submittedAt: i, answers: {}, score: { earned, total: 10 } }))
const stats = scoreStats(classOf(10, 8, 7, 5, 5, 1))!
eq('stats: counted', stats.count, 6)
eq('stats: average', stats.average, 6)
eq('stats: highest', stats.highest, 10)
eq('stats: lowest', stats.lowest, 1)
eq('stats: out of', stats.outOf, 10)
// A paper edited half way through a class: "highest 12, out of 10" is a worse
// answer than quoting the longest paper anyone actually sat.
eq(
  'stats: out of is the largest paper seen',
  scoreStats([
    { id: 'a', submittedAt: 1, answers: {}, score: { earned: 5, total: 10 } },
    { id: 'b', submittedAt: 2, answers: {}, score: { earned: 6, total: 8 } },
  ])!.outOf,
  10,
)
eq('stats: five bands', stats.distribution.length, 5)
eq('stats: banded', stats.distribution.map((b) => b.count), [1, 0, 2, 1, 2])
eq('stats: band labels', stats.distribution.map((b) => b.label), ['0–19%', '20–39%', '40–59%', '60–79%', '80–100%'])
// 20% is the first mark of the second band and 100% the last of the fifth.
eq('stats: a band edge lands in the higher band', scoreStats(classOf(2))!.distribution.map((b) => b.count), [0, 1, 0, 0, 0])
eq('stats: full marks land in the top band', scoreStats(classOf(10))!.distribution[4].count, 1)
eq('stats: zero lands in the bottom band', scoreStats(classOf(0))!.distribution[0].count, 1)
eq('stats: an average is rounded to two places', scoreStats(classOf(1, 2))!.average, 1.5)
eq(
  'stats: unmarked responses are left out',
  scoreStats([...classOf(10), { id: 'x', submittedAt: 9, answers: {} }])!.count,
  1,
)

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} assertions)`)
if (failed) process.exitCode = 1
else console.log('ALL FORMS TESTS PASSED')
