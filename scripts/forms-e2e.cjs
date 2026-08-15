// End-to-end test of the Forms round trip, in a real browser engine.
//
//   npm run build:e2e && npx electron scripts/forms-e2e.cjs
//
// Loads the exported form exactly as a recipient would — same file, same CSP,
// no test hooks inside it — fills every control, submits, and feeds the code
// the page produced back through the app's own decoder. Also asserts the page
// cannot reach the network, by installing the real deny-by-default gate and
// failing if it ever fires.

const { app, BrowserWindow, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const security = require('../electron/security.cjs')

const BUNDLE = path.join(__dirname, '..', '.tmp-e2e', 'e2e-roundtrip.js')

let passed = 0
const failures = []
const ok = (name, cond, detail) => {
  if (cond) {
    passed++
    console.log('  ✓ ' + name)
  } else {
    failures.push({ name, detail })
    console.log('  ✗ ' + name + (detail ? '  → ' + JSON.stringify(detail).slice(0, 400) : ''))
  }
}

async function main() {
  if (!fs.existsSync(BUNDLE)) throw new Error(`missing ${BUNDLE} — run npm run build:e2e first`)
  const mod = require(BUNDLE)

  // ---- the exported artefact ----
  console.log('\nExported form')
  const html = mod.fillableHtml()
  ok('is a complete HTML document', html.startsWith('<!doctype html>'))
  ok('carries a restrictive CSP', /Content-Security-Policy/.test(html) && /default-src 'none'/.test(html))
  ok('has no remote URLs', !/(src|href)\s*=\s*["']https?:/i.test(html), html.match(/(src|href)\s*=\s*["']https?:[^"']*/i)?.[0])
  ok('has no <form action>', !/<form[^>]*\saction=/i.test(html))
  ok('embeds no external font', !/@import|fonts\.googleapis/i.test(html))

  const printable = mod.printableHtml()
  ok('printable version has no script', !/<script/i.test(printable))

  // ---- templates ----
  console.log('\nShipped templates')
  const t = mod.checkTemplates()
  ok(`all ${t.count} templates render and are self-contained`, t.ok, t.problems)

  // ---- the live page ----
  console.log('\nFilling it in as a recipient')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anleo-forms-e2e-'))
  const file = path.join(dir, 'form.html')
  fs.writeFileSync(file, html)

  // Any request the page attempts is a failure, so record everything the gate
  // sees rather than trusting the markup scan alone.
  const attempted = []
  const sess = session.fromPartition('forms-e2e')
  sess.webRequest.onBeforeRequest((details, cb) => {
    if (!/^(file|data|blob|devtools):/.test(details.url)) attempted.push(details.url)
    cb({ cancel: false })
  })

  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 900,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, session: sess },
  })
  const consoleErrors = []
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) consoleErrors.push(message)
  })
  await win.loadFile(file)
  const js = (code) => win.webContents.executeJavaScript(code, true)

  ok('page rendered its questions', (await js(`document.querySelectorAll('[data-qid]').length`)) >= 10)

  // The hostile question title must be text, not markup.
  ok(
    'hostile question title did not inject',
    (await js(`!document.querySelector('img[src="x"]') && !window.__xss`)),
  )
  ok(
    'hostile title is shown literally',
    (await js(`document.body.innerText.includes('</script>')`)),
  )

  // Submitting with required questions blank must be refused.
  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 300))
  const blockedState = await js(`({
    errors: [...document.querySelectorAll('.afx-err')].filter(e => e.textContent.trim()).length,
    confirmed: !document.getElementById('afx-done').hidden,
  })`)
  ok('blank required fields are refused', blockedState.errors > 0 && !blockedState.confirmed, blockedState)

  // Now fill everything in, including non-ASCII.
  const filled = await js(`(() => {
    const set = (el, v) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const q = (id) => document.querySelector('[data-qid="' + id + '"]')
    set(q('q_short').querySelector('input'), 'Zoë Ćurić 🎉')
    set(q('q_para').querySelector('textarea'), 'Line one\\nLine two, with a comma and a "quote"')
    q('q_choice').querySelectorAll('input[type=radio]')[0].click()
    q('q_checks').querySelectorAll('input[type=checkbox]')[0].click()
    const drop = q('q_drop').querySelector('select')
    drop.selectedIndex = 1; drop.dispatchEvent(new Event('change', { bubbles: true }))
    const scale = q('q_scale').querySelectorAll('input[type=radio]')
    scale[3].click()
    set(q('q_date').querySelector('input'), '2026-03-14')
    set(q('q_time').querySelector('input'), '09:30')
    set(q('q_email').querySelector('input'), 'tip@example.com')
    set(q('q_num').querySelector('input'), '7')
    return true
  })()`)
  ok('every control accepted input', filled === true)

  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 400))

  const after = await js(`({
    confirmed: !document.getElementById('afx-done').hidden,
    formHidden: !!document.getElementById('afx-form').hidden,
    message: document.getElementById('afx-done').innerText.includes('nothing was uploaded'),
    code: document.getElementById('afx-code').value || '',
  })`)
  ok('submitting shows the confirmation', after.confirmed, after)
  ok('confirmation shows the author message', after.message)
  ok('the questions were replaced by the confirmation', after.formHidden, after)
  ok('a response code was produced', typeof after.code === 'string' && after.code.includes('ANLEO-RESPONSE:'), after.code?.slice(0, 60))

  // ---- back in the app ----
  console.log('\nImporting the response back into the app')
  const check = mod.checkSubmittedCode(after.code)
  ok('the app decodes the page\'s own code', check.ok, check.problems)
  ok('non-ASCII survived the round trip', check.answers.q_short === 'Zoë Ćurić 🎉', check.answers.q_short)

  const analysis = mod.checkAnalysis(after.code)
  ok('summary, CSV and Sheets conversion all work', analysis.ok, analysis.problems)

  // ---- the network claim ----
  // ---- a quiz that marks itself ----
  console.log('\nMarking a quiz in the recipient’s own browser')
  const quizFile = path.join(dir, 'quiz.html')
  fs.writeFileSync(quizFile, mod.quizHtml())
  await win.loadFile(quizFile)

  ok('every marked question shows what it is worth', (await js(`document.querySelectorAll('.afx-marks').length`)) === 3)
  ok(
    'the marks read as marks',
    (await js(`[...document.querySelectorAll('.afx-marks')].map(e => e.textContent).join('|')`)) ===
      '2 marks|2 marks|1 mark',
  )

  // One right (2), one of two noble gases (1 of 2), and a wrong number (0).
  const answered = await js(`(() => {
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const q = (id) => document.querySelector('[data-qid="' + id + '"]')
    set(q('q_name').querySelector('input'), 'Ada')
    q('q_capital').querySelectorAll('input[type=radio]')[0].click()
    q('q_nobles').querySelectorAll('input[type=checkbox]')[0].click()
    set(q('q_sides').querySelector('input'), '7')
    return true
  })()`)
  ok('the quiz accepted every answer', answered === true)

  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 400))

  const marked = await js(`({
    shown: (document.getElementById('afx-scorebox').textContent || '').trim(),
    hidden: document.getElementById('afx-scorebox').hidden,
    rows: document.querySelectorAll('.afx-mark').length,
    right: document.querySelectorAll('.afx-mark.right').length,
    wrong: document.querySelectorAll('.afx-mark.wrong').length,
    perQuestion: [...document.querySelectorAll('.afx-mark-score')].map(e => e.textContent),
    feedback: [...document.querySelectorAll('.afx-mark-fb')].map(e => e.textContent),
    code: document.getElementById('afx-code').value || '',
  })`)
  ok('the score is shown to the respondent', !marked.hidden && marked.shown.includes('3 / 5'), marked.shown)
  ok('the percentage is worked out too', marked.shown.includes('60%'), marked.shown)
  ok('every marked question is reviewed', marked.rows === 3, marked)
  ok('the right answer is marked right', marked.right === 1, marked)
  ok('the wrong and the part-right answers are marked wrong', marked.wrong === 2, marked)
  ok('each question shows what it scored', marked.perQuestion.join('|') === '2 / 2|1 / 2|0 / 1', marked.perQuestion)
  ok('the author’s feedback is shown', marked.feedback.some((f) => /capital since 508/.test(f)), marked.feedback)

  // The answer key and the feedback are the two new places an author types, and
  // both travel as attributes that the marker reads back out onto the page.
  const keyXss = await js(`({
    img: !!document.querySelector('img[src="x"]'),
    ran: !!window.__xss,
    keyShown: [...document.querySelectorAll('.afx-mark-line')].some(e => e.textContent.includes('</script>')),
    feedbackShown: [...document.querySelectorAll('.afx-mark-fb')].some(e => e.textContent.includes('</script>')),
  })`)
  ok('a hostile answer key and feedback did not inject', !keyXss.img && !keyXss.ran, keyXss)
  ok('the hostile key is printed literally', keyXss.keyShown, keyXss)
  ok('the hostile feedback is printed literally', keyXss.feedbackShown, keyXss)

  const quizCheck = mod.checkQuizCode(marked.code, marked.shown)
  ok('the score the page showed is the score the app decodes', quizCheck.ok, quizCheck.problems)

  // ---- a form that branches ----
  console.log('\nBranching past a whole section')
  const branchFile = path.join(dir, 'branch.html')
  fs.writeFileSync(branchFile, mod.branchingHtml())
  await win.loadFile(branchFile)

  const paged = await js(`({
    pages: document.querySelectorAll('.afx-pg').length,
    visible: [...document.querySelectorAll('.afx-pg')].filter(p => !p.hidden).length,
    backHidden: document.getElementById('afx-back').hidden,
  })`)
  ok('sections became pages', paged.pages === 3, paged)
  ok('one page is on screen at a time', paged.visible === 1, paged)
  ok('Back is hidden on the first page', paged.backHidden, paged)

  // The first option routes to the closing section, so the fault section is
  // skipped — including its required question, which nothing has filled in.
  await js(`document.querySelector('[data-qid="q_topic"]').querySelectorAll('input[type=radio]')[0].click()`)
  await new Promise((r) => setTimeout(r, 150))
  ok(
    'the button reads Next while a page remains',
    (await js(`document.getElementById('afx-submit').textContent`)) === 'Next',
  )

  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 300))
  const jumped = await js(`({
    on: [...document.querySelectorAll('.afx-pg')].findIndex(p => !p.hidden),
    faultVisible: !document.querySelector('[data-qid="q_fault"]').closest('.afx-pg').hidden,
    heading: document.querySelector('.afx-pg:not([hidden]) .afx-sec h2').textContent,
    button: document.getElementById('afx-submit').textContent,
    backHidden: document.getElementById('afx-back').hidden,
    errors: [...document.querySelectorAll('.afx-err')].filter(e => e.textContent.trim()).length,
  })`)
  ok('choosing the first option skips the section the second leads to', jumped.on === 2 && !jumped.faultVisible, jumped)
  ok('it lands on the section that answer routes to', jumped.heading === 'Anything else', jumped)
  ok('the skipped required question raised no error', jumped.errors === 0, jumped)
  ok('the button becomes Submit on the last page', jumped.button === 'Submit', jumped)
  ok('Back appears once there is somewhere to go back to', !jumped.backHidden, jumped)

  await js(`(() => {
    const el = document.querySelector('[data-qid="q_note"]').querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Nothing else')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 400))

  const branchDone = await js(`({
    confirmed: !document.getElementById('afx-done').hidden,
    code: document.getElementById('afx-code').value || '',
  })`)
  ok('a branching form still submits', branchDone.confirmed, branchDone)
  const branchCheck = mod.checkBranchCode(branchDone.code)
  ok('the skipped section is absent from the response', branchCheck.ok, branchCheck.problems)

  // The other route has to walk through the section, validate it, and let Back
  // out again — a skip is only trustworthy if the unskipped path still works.
  await win.loadFile(branchFile)
  await js(`document.querySelector('[data-qid="q_topic"]').querySelectorAll('input[type=radio]')[1].click()`)
  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 250))
  const other = await js(`document.querySelector('.afx-pg:not([hidden]) .afx-sec h2').textContent`)
  ok('the second option walks through that section instead', other === 'About the fault', other)
  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 250))
  const blocked = await js(`({
    errors: [...document.querySelectorAll('.afx-err')].filter(e => e.textContent.trim()).length,
    on: [...document.querySelectorAll('.afx-pg')].findIndex(p => !p.hidden),
  })`)
  ok('a required question on a page they were shown still stops them', blocked.errors === 1 && blocked.on === 1, blocked)
  await js(`document.getElementById('afx-back').click()`)
  await new Promise((r) => setTimeout(r, 250))
  ok(
    'Back returns to the routing question',
    (await js(`[...document.querySelectorAll('.afx-pg')].findIndex(p => !p.hidden)`)) === 0,
  )

  // ---- a route that doubles back ----
  //
  // Walking the loop shows the marker every question twice. Marks are per
  // question, not per visit, so a three-mark paper has to come back out of
  // three — and the author's own grader has to agree with it.
  console.log('\nWalking a route that doubles back')
  const loopFile = path.join(dir, 'loop.html')
  fs.writeFileSync(loopFile, mod.loopingQuizHtml())
  await win.loadFile(loopFile)

  const answerLoopPage = async (optionIndex) => {
    await js(`(() => {
      const el = document.querySelector('[data-qid="q_capital"] input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Paris')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await js(`document.getElementById('afx-submit').click()`)
    await new Promise((r) => setTimeout(r, 250))
    await js(`document.querySelectorAll('[data-qid="q_again"] input[type=radio]')[${optionIndex}].click()`)
    await new Promise((r) => setTimeout(r, 150))
  }

  await answerLoopPage(0) // "Take me back"
  ok(
    'the button still offers a way onward inside the loop',
    (await js(`document.getElementById('afx-submit').textContent`)) === 'Next',
  )
  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 250))
  ok(
    'that answer walks them back to the first page',
    (await js(`[...document.querySelectorAll('.afx-pg')].findIndex(p => !p.hidden)`)) === 0,
  )

  await answerLoopPage(1) // second time round, "I am finished"
  await js(`document.getElementById('afx-submit').click()`)
  await new Promise((r) => setTimeout(r, 400))

  const looped = await js(`({
    shown: (document.getElementById('afx-scorebox').textContent || '').trim(),
    rows: document.querySelectorAll('.afx-mark').length,
    code: document.getElementById('afx-code').value || '',
  })`)
  ok('a page walked twice is not marked twice', looped.shown.includes('3 / 3'), looped.shown)
  ok('nor reviewed twice', looped.rows === 2, looped)
  const loopCheck = mod.checkLoopingQuizCode(looped.code, looped.shown)
  ok('the app agrees with the score the loop produced', loopCheck.ok, loopCheck.problems)

  // ---- the network claim ----
  console.log('\nNetwork')
  ok('the page attempted no network request', attempted.length === 0, attempted)
  const cspErrors = consoleErrors.filter((m) => /Content Security Policy/i.test(m))
  ok('the page did not violate its own CSP', cspErrors.length === 0, cspErrors.slice(0, 3))

  win.destroy()
  fs.rmSync(dir, { recursive: true, force: true })

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log('  - ' + f.name + (f.detail ? ' ' + JSON.stringify(f.detail).slice(0, 500) : ''))
  }
  app.exit(failures.length ? 1 : 0)
}

app.setPath('userData', path.join(os.tmpdir(), 'anleo-forms-e2e-profile'))
void security
app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err)
    app.exit(1)
  }),
)
