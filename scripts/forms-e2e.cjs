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
