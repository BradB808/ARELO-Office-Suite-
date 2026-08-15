// Drives the whole offline round trip the way a real pair of people would:
// export a form, fill it in, submit it, send the code back, import it.
//
// Compiled to an SSR bundle and driven by scripts/forms-e2e.cjs inside a real
// Electron BrowserWindow, so the page under test is the exact HTML a recipient
// would open — same CSP, same inline script, no test harness inside it.

import { renderFillableForm, renderPrintableForm } from './render'
import { decodeResponse, parseResponsePayload, summarize, responsesToCsv, responsesToSheet } from './responses'
import { newQuestion, FORM_THEMES, answeredPath, branchProblems, gradeResponse, quizTotal } from './model'
import type { FormsContent, FormQuestion } from '../../shared/types'
import { formsTemplates } from '../../templates/forms'

/** Author-supplied text that would run if any of it reached the page unescaped.
 *  It goes wherever an author can type, the answer key and the feedback
 *  included — both land in attributes the page's marker reads back out. */
export const HOSTILE = `</script><img src=x onerror="window.__xss=1"> "quoted" 'single'`

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

// ---------- a quiz that marks itself ----------

/**
 * Five marks across three marked questions and one that is not marked at all.
 * The driver answers one right, one part-right and one wrong, so 3 of 5 is the
 * only score that can come back if the page's marker and gradeAnswer() agree.
 */
export function buildQuizForm(): FormsContent {
  return {
    description: 'Marked on your own machine. Nothing is uploaded.',
    theme: FORM_THEMES[1].theme,
    responses: [],
    settings: { confirmation: 'Marked.', showQuestionNumbers: true, showProgress: true, quizMode: true, showScore: true },
    questions: [
      { id: 'q_name', kind: 'short', title: 'Your name', required: true },
      {
        id: 'q_capital',
        kind: 'choice',
        title: 'Capital of France?',
        required: true,
        options: [
          { id: 'c_paris', label: 'Paris' },
          { id: 'c_lyon', label: 'Lyon' },
        ],
        correct: ['c_paris'],
        points: 2,
        feedback: `Paris has been the capital since 508. ${HOSTILE}`,
      },
      {
        id: 'q_nobles',
        kind: 'checkboxes',
        title: 'Which are noble gases?',
        options: [
          { id: 'g_he', label: 'Helium' },
          { id: 'g_n', label: 'Nitrogen' },
          { id: 'g_ar', label: 'Argon' },
        ],
        correct: ['g_he', 'g_ar'],
        points: 2,
      },
      // The second accepted answer is never right; it is here so the review
      // list has to print a hostile key back out on screen.
      { id: 'q_sides', kind: 'number', title: 'How many sides has a hexagon?', correct: ['6', HOSTILE], points: 1 },
    ],
  }
}

export function quizHtml(): string {
  return renderFillableForm('Quiz round trip', buildQuizForm())
}

/** The score the page shows must be the score the author decodes. */
export function checkQuizCode(code: string, shown: string): { ok: boolean; problems: string[]; score: unknown } {
  const problems: string[] = []
  const r = decodeResponse(code)
  if (!r) return { ok: false, problems: ['the app could not decode the quiz response'], score: null }

  const form = buildQuizForm()
  if (quizTotal(form.questions) !== 5) problems.push('the test quiz is no longer worth 5 marks')
  if (!r.score) problems.push('no score travelled back in the response code')
  else {
    if (r.score.total !== 5) problems.push(`marks available came back as ${r.score.total}, not 5`)
    // Right (2) + one of two noble gases (1) + a wrong number (0).
    if (r.score.earned !== 3) problems.push(`marks earned came back as ${r.score.earned}, not 3`)
    if (!shown.includes(`${r.score.earned} / ${r.score.total}`))
      problems.push(`the page showed "${shown}", which does not contain the decoded score`)
  }

  // The app's own grader, run over the answers, has to reach the same number.
  const again = gradeResponse(form.questions, r.answers)
  if (r.score && (again.earned !== r.score.earned || again.total !== r.score.total))
    problems.push(`the app grades the same answers as ${again.earned}/${again.total}`)

  return { ok: problems.length === 0, problems, score: r.score ?? null }
}

// ---------- a quiz whose route doubles back ----------

/**
 * Three marks over two pages, and the second page can send the respondent back
 * to the first. Walking that loop means the marker sees both pages twice, and a
 * question counted twice marks this paper out of six — which is neither what the
 * author set nor what the app makes of the same answers.
 */
export function buildLoopingQuiz(): FormsContent {
  return {
    description: 'A quiz you can walk round twice.',
    theme: FORM_THEMES[2].theme,
    responses: [],
    settings: { confirmation: 'Marked.', quizMode: true, showScore: true },
    questions: [
      { id: 'sec_one', kind: 'section', title: 'Round one' },
      { id: 'q_capital', kind: 'short', title: 'Capital of France?', correct: ['Paris'], points: 2, required: true },
      { id: 'sec_two', kind: 'section', title: 'Round two' },
      {
        id: 'q_again',
        kind: 'choice',
        title: 'Another go at round one?',
        required: true,
        options: [
          { id: 'a_back', label: 'Take me back' },
          { id: 'a_done', label: 'I am finished' },
        ],
        branches: [{ optionId: 'a_back', goTo: 'sec_one' }],
        correct: ['a_done'],
        points: 1,
      },
    ],
  }
}

export function loopingQuizHtml(): string {
  return renderFillableForm('Looping quiz', buildLoopingQuiz())
}

/** A page walked twice is still worth what it is worth once. */
export function checkLoopingQuizCode(code: string, shown: string): { ok: boolean; problems: string[]; score: unknown } {
  const problems: string[] = []
  const r = decodeResponse(code)
  if (!r) return { ok: false, problems: ['the app could not decode the looping response'], score: null }

  const form = buildLoopingQuiz()
  // The fixture is only worth having while the route really does double back.
  if (!branchProblems(form.questions).some((p) => p.kind === 'backwards'))
    problems.push('the looping fixture no longer loops')
  if (quizTotal(form.questions) !== 3) problems.push('the looping quiz is no longer worth 3 marks')

  if (!r.score) problems.push('no score travelled back from the looping quiz')
  else {
    if (r.score.total !== 3) problems.push(`marks available came back as ${r.score.total}, not 3`)
    if (r.score.earned !== 3) problems.push(`marks earned came back as ${r.score.earned}, not 3`)
    if (!shown.includes(`${r.score.earned} / ${r.score.total}`))
      problems.push(`the page showed "${shown}", which does not contain the decoded score`)
  }

  // Graded over the route those answers describe, which is what the page marked.
  const again = gradeResponse(answeredPath(form.questions, r.answers), r.answers)
  if (r.score && (again.earned !== r.score.earned || again.total !== r.score.total))
    problems.push(`the app grades the same answers as ${again.earned}/${again.total}`)

  return { ok: problems.length === 0, problems, score: r.score ?? null }
}

// ---------- a form that branches ----------

/**
 * Picking the first option jumps straight to the closing section; picking the
 * second walks through the fault section in between. The fault question is
 * required precisely so a skip that only hides the page would be caught — a
 * hidden-but-still-validated question cannot be submitted past.
 */
export function buildBranchingForm(): FormsContent {
  return {
    description: 'Your first answer decides which questions you get.',
    theme: FORM_THEMES[4].theme,
    responses: [],
    settings: { confirmation: 'Logged.', showProgress: true },
    questions: [
      {
        id: 'q_topic',
        kind: 'choice',
        title: 'What is this about?',
        required: true,
        options: [
          { id: 't_delivery', label: 'A delivery' },
          { id: 't_fault', label: 'A fault' },
        ],
        branches: [
          { optionId: 't_delivery', goTo: 'sec_finish' },
          { optionId: 't_fault', goTo: 'sec_fault' },
        ],
      },
      { id: 'sec_fault', kind: 'section', title: 'About the fault' },
      { id: 'q_fault', kind: 'short', title: 'What is broken?', required: true },
      { id: 'sec_finish', kind: 'section', title: 'Anything else' },
      { id: 'q_note', kind: 'short', title: 'Anything to add?' },
    ],
  }
}

export function branchingHtml(): string {
  return renderFillableForm('Branching round trip', buildBranchingForm())
}

/** Option A must skip the section option B leads to — entirely, not just visually. */
export function checkBranchCode(code: string): { ok: boolean; problems: string[]; answers: Record<string, unknown> } {
  const problems: string[] = []
  const r = decodeResponse(code)
  if (!r) return { ok: false, problems: ['the app could not decode the branching response'], answers: {} }

  const a = r.answers
  if (a.q_topic !== 'A delivery') problems.push(`the routing answer came back as ${JSON.stringify(a.q_topic)}`)
  if (a.q_note !== 'Nothing else') problems.push(`the closing answer came back as ${JSON.stringify(a.q_note)}`)
  // The skipped question is required, so its presence would also mean the page
  // validated a question it never showed.
  if ('q_fault' in a) problems.push('the skipped section was submitted anyway')

  const path = answeredPath(buildBranchingForm().questions, a).map((q) => q.id)
  if (path.includes('q_fault')) problems.push(`the model replays a different route: ${path.join(', ')}`)

  return { ok: problems.length === 0, problems, answers: a as Record<string, unknown> }
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
      // A shipped template must never be the thing that teaches an author what
      // a broken route looks like.
      for (const p of branchProblems(content.questions)) problems.push(`${t.id}: ${p.message}`)
      if (content.settings.quizMode && quizTotal(content.questions) <= 0)
        problems.push(`${t.id}: a quiz with nothing to mark`)
    } catch (err) {
      problems.push(`${t.id}: threw ${String(err)}`)
    }
  }
  return { ok: problems.length === 0, problems, count: formsTemplates.length }
}
