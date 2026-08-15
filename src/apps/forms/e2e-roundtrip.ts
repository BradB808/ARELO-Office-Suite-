// Drives the whole offline round trip the way a real pair of people would:
// export a form, fill it in, submit it, send the code back, import it.
//
// Compiled to an SSR bundle and driven by scripts/forms-e2e.cjs inside a real
// Electron BrowserWindow, so the page under test is the exact HTML a recipient
// would open — same CSP, same inline script, no test harness inside it.

import { renderFillableForm, renderPrintableForm } from './render'
import { decodeResponse, parseResponsePayload, summarize, responsesToCsv, responsesToSheet } from './responses'
import { newQuestion, FORM_THEMES } from './model'
import type { FormsContent, FormQuestion } from '../../shared/types'
import { formsTemplates } from '../../templates/forms'

/** A form exercising every question kind, required fields, and hostile text. */
export function buildTestForm(): FormsContent {
  const q = (over: Partial<FormQuestion> & { kind: FormQuestion['kind'] }): FormQuestion => ({
    ...newQuestion(over.kind),
    ...over,
  })

  return {
    description: 'Every control, plus some text designed to break a naive renderer.',
    theme: FORM_THEMES[0].theme,
    responses: [],
    settings: {
      confirmation: 'Thanks — nothing was uploaded.',
      showQuestionNumbers: true,
      showProgress: true,
    },
    questions: [
      q({ kind: 'section', title: 'Part one', help: 'A section heading' }),
      q({ kind: 'short', id: 'q_short', title: 'Your name', required: true }),
      q({ kind: 'paragraph', id: 'q_para', title: 'Tell us more' }),
      q({
        kind: 'choice',
        id: 'q_choice',
        title: 'Pick one </script><img src=x onerror=alert(1)>',
        required: true,
        options: [
          { id: 'o1', label: 'First "quoted"' },
          { id: 'o2', label: "Second <b>bold</b>" },
        ],
      }),
      q({
        kind: 'checkboxes',
        id: 'q_checks',
        title: 'Pick any',
        options: [
          { id: 'c1', label: 'Alpha' },
          { id: 'c2', label: 'Beta' },
        ],
        otherOption: true,
      }),
      q({
        kind: 'dropdown',
        id: 'q_drop',
        title: 'Choose',
        options: [
          { id: 'd1', label: 'One' },
          { id: 'd2', label: 'Two' },
        ],
      }),
      q({ kind: 'scale', id: 'q_scale', title: 'Rate it', scaleMin: 1, scaleMax: 5 }),
      q({ kind: 'date', id: 'q_date', title: 'Which day' }),
      q({ kind: 'time', id: 'q_time', title: 'What time' }),
      q({ kind: 'email', id: 'q_email', title: 'Your email', required: true }),
      q({ kind: 'number', id: 'q_num', title: 'How many', min: 0, max: 10 }),
    ],
  }
}

export function fillableHtml(): string {
  return renderFillableForm('Round trip test — café 🎉', buildTestForm())
}

export function printableHtml(): string {
  return renderPrintableForm('Round trip test', buildTestForm())
}

/** Checks a code produced by the exported page against the app's own decoder. */
export function checkSubmittedCode(code: string): {
  ok: boolean
  problems: string[]
  answers: Record<string, unknown>
} {
  const problems: string[] = []
  const viaDecode = decodeResponse(code)
  const viaParse = parseResponsePayload(code)

  if (!viaDecode) problems.push('decodeResponse returned null for a code the page produced')
  if (!viaParse) problems.push('parseResponsePayload returned null for the same code')

  const r = viaDecode
  if (r) {
    if (typeof r.id !== 'string' || !r.id) problems.push('response has no id')
    if (typeof r.submittedAt !== 'number') problems.push('response has no submittedAt')
    const a = r.answers ?? {}
    if (a.q_short !== 'Zoë Ćurić 🎉') problems.push(`short answer mangled: ${JSON.stringify(a.q_short)}`)
    if (a.q_email !== 'tip@example.com') problems.push(`email mangled: ${JSON.stringify(a.q_email)}`)
    if (!Array.isArray(a.q_checks)) problems.push('checkboxes did not come back as an array')
    if (a.q_scale !== '4') problems.push(`scale mangled: ${JSON.stringify(a.q_scale)}`)
  }

  return { ok: problems.length === 0, problems, answers: (r?.answers ?? {}) as Record<string, unknown> }
}

/** Exercises the analysis path on an imported response. */
export function checkAnalysis(code: string): { ok: boolean; problems: string[]; csvHead: string } {
  const problems: string[] = []
  const r = parseResponsePayload(code)
  if (!r) return { ok: false, problems: ['could not parse the response'], csvHead: '' }

  const form = buildTestForm()
  const choice = form.questions.find((x) => x.id === 'q_choice')!
  const s = summarize(choice, [r])
  if (s.answered !== 1) problems.push(`summarize: expected 1 answered, got ${s.answered}`)
  if (s.buckets.length < 2) problems.push('summarize: options missing from buckets')

  const csv = responsesToCsv(form.questions, [r])
  const lines = csv.split('\n')
  if (lines.length < 2) problems.push('csv has no data row')
  // The hostile question title must not arrive as a live formula.
  if (/^[=+\-@]/.test(lines[0].split(',')[1] ?? '')) problems.push('csv header not neutralised')

  const sheet = responsesToSheet(form.questions, [r])
  if (!sheet.sheets?.[0]) problems.push('responsesToSheet produced no sheet')

  return { ok: problems.length === 0, problems, csvHead: lines[0].slice(0, 120) }
}

/** Every shipped template must render without throwing. */
export function checkTemplates(): { ok: boolean; problems: string[]; count: number } {
  const problems: string[] = []
  for (const t of formsTemplates) {
    try {
      const content = t.make()
      const html = renderFillableForm(t.name, content)
      if (!html.includes('<!doctype html>')) problems.push(`${t.id}: not a full document`)
      if (/src="https?:|href="https?:/i.test(html)) problems.push(`${t.id}: contains a remote URL`)
      if (content.questions.length < 4) problems.push(`${t.id}: only ${content.questions.length} questions`)
    } catch (err) {
      problems.push(`${t.id}: threw ${String(err)}`)
    }
  }
  return { ok: problems.length === 0, problems, count: formsTemplates.length }
}
