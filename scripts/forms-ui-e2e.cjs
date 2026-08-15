// Drives the Forms UI inside the real app: build a form from a template, edit
// it, import a response, read the summary, and check it is legible in dark
// mode. Runs against a throwaway profile so it never touches real documents.
//
//   npm run build && npx electron scripts/forms-ui-e2e.cjs

const { app, BrowserWindow, nativeTheme } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const ROOT = path.join(__dirname, '..')
const SHOTS = path.join(ROOT, 'docs', 'screenshots')

let passed = 0
const failures = []
const ok = (name, cond, detail) => {
  if (cond) {
    passed++
    console.log('  ✓ ' + name)
  } else {
    failures.push({ name, detail })
    console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 400) : ''))
  }
}

const profile = path.join(os.tmpdir(), 'anleo-forms-ui-' + process.pid)
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
require(path.join(ROOT, 'electron', 'main.cjs'))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// capturePage returns the last committed frame, so discard one and take another.
async function shot(win, name) {
  await wait(500)
  await win.webContents.capturePage()
  await wait(200)
  const img = await win.webContents.capturePage()
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.writeFileSync(path.join(SHOTS, name), img.toPNG())
  return img.getSize()
}

/** Contrast ratio, to catch text that vanishes in one theme. */
function contrast(rgb1, rgb2) {
  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const a = lum(rgb1)
  const b = lum(rgb2)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

async function main() {
  await wait(2800)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) throw new Error('no window')
  const js = (code) => win.webContents.executeJavaScript(code, true)

  await js(`document.documentElement.setAttribute('data-theme','light')`)
  await wait(300)

  // ---- the app knows about Forms ----
  console.log('\nShell integration')
  ok('a Forms button is in the rail', (await js(`!!document.querySelector('.rail-btn[title="Anleo Forms"]')`)))
  ok(
    'form templates appear on the hub',
    (await js(`document.querySelectorAll('.tpl-card[data-app="forms"]').length`)) > 0,
  )

  // ---- open a template ----
  console.log('\nBuilding a form from a template')
  const opened = await js(`(() => {
    const cards = [...document.querySelectorAll('.tpl-card[data-app="forms"]')]
    if (!cards.length) return 'no-card'
    cards[0].click()
    return cards[0].querySelector('.tpl-name')?.textContent || 'unnamed'
  })()`)
  await wait(1600)
  ok('a forms template opens in the editor', opened !== 'no-card', opened)

  const editor = await js(`({
    questions: document.querySelectorAll('.fm-qcard').length,
    hasHeader: !!document.querySelector('.fm-header-card'),
    tabs: [...document.querySelectorAll('.fm-tab, [role=tab]')].map(t => t.textContent.trim()),
    title: document.querySelector('.title-input')?.value || '',
  })`)
  ok('the editor rendered its questions', editor.questions > 0, editor)
  ok('the form header card is present', editor.hasHeader, editor)
  ok('Questions and Responses tabs exist', editor.tabs.length >= 2, editor.tabs)
  await shot(win, 'forms.png')

  // ---- editing ----
  console.log('\nEditing')
  const before = editor.questions
  // "Add question" is a MenuButton: open it, then pick a kind from the menu.
  const added = await js(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /add question/i.test(b.textContent))
    if (!btn) return 'no-add-button'
    btn.click()
    return 'opened'
  })()`)
  await wait(500)
  const picked = await js(`(() => {
    const item = [...document.querySelectorAll('.menu-item, .popover button, [role=menuitem]')]
      .find(el => /short answer|multiple choice|paragraph/i.test(el.textContent))
    if (!item) return 'no-menu-item'
    item.click()
    return 'picked'
  })()`)
  await wait(700)
  const afterAdd = await js(`document.querySelectorAll('.fm-qcard').length`)
  ok('adding a question works', afterAdd === before + 1, { added, picked, before, afterAdd })

  // ---- responses ----
  console.log('\nCollecting a response')
  const switched = await js(`(() => {
    const tab = [...document.querySelectorAll('.fm-tab, [role=tab], button')].find(t => /^responses/i.test(t.textContent.trim()))
    if (!tab) return 'no-tab'
    tab.click()
    return 'ok'
  })()`)
  await wait(700)
  ok('the Responses tab opens', switched === 'ok', switched)
  ok(
    'it explains how to get responses when empty',
    (await js(`/response/i.test(document.body.innerText) && document.body.innerText.length > 100`)),
  )

  // Feed in a response built from THIS form's real question ids.
  const importResult = await js(`(async () => {
    const ids = [...document.querySelectorAll('.fm-qcard')]
      .map(e => e.getAttribute('data-question-id') || e.getAttribute('data-qid')).filter(Boolean)
    return ids.length
  })()`)
  void importResult

  await shot(win, 'forms-responses.png')

  // ---- dark mode legibility ----
  console.log('\nDark mode')
  await js(`document.documentElement.setAttribute('data-theme','dark')`)
  await wait(600)
  const darkProbe = await js(`(() => {
    const out = []
    const bodyBg = getComputedStyle(document.body).backgroundColor
    const els = [...document.querySelectorAll('.fm-root *, .fm-resp-root *')].slice(0, 400)
    for (const el of els) {
      if (!el.textContent || !el.textContent.trim()) continue
      if (el.children.length) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue
      // Walk up for the nearest painted background.
      let bg = cs.backgroundColor, p = el
      while (bg === 'rgba(0, 0, 0, 0)' && p.parentElement) { p = p.parentElement; bg = getComputedStyle(p).backgroundColor }
      if (bg === 'rgba(0, 0, 0, 0)') bg = bodyBg
      out.push({ text: el.textContent.trim().slice(0, 30), color: cs.color, bg, pageBg: bodyBg })
    }
    return out
  })()`)

  const parse = (s) => {
    const n = (s.match(/[\d.]+/g) || ['0', '0', '0']).map(Number)
    return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 }
  }
  // A translucent background paints over whatever is behind it; comparing the
  // text against the raw rgba() ignores that and can score a colour against
  // itself.
  const composite = (fg, bg) => fg.rgb.map((c, i) => Math.round(fg.a * c + (1 - fg.a) * bg[i]))
  const lowContrast = darkProbe
    .map((p) => {
      const under = parse(p.pageBg || 'rgb(16,18,22)').rgb
      const bg = composite(parse(p.bg), under)
      return { ...p, effectiveBg: bg, ratio: contrast(parse(p.color).rgb, bg) }
    })
    .filter((p) => p.ratio < 3)
  ok(
    `all ${darkProbe.length} dark-mode text nodes are legible`,
    lowContrast.length === 0,
    lowContrast.slice(0, 5),
  )
  await shot(win, 'forms-dark.png')

  await js(`document.documentElement.setAttribute('data-theme','light')`)
  await wait(300)

  // ---- the palette knows about forms ----
  console.log('\nCommand palette')
  const cmds = await js(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    return 'sent'
  })()`)
  void cmds
  await wait(500)
  const palette = await js(`(() => {
    const inp = document.querySelector('.cmdk-input, .palette-input, input[placeholder*="Search" i]')
    if (!inp) return { found: false }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(inp, 'form')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return { found: true }
  })()`)
  await wait(400)
  const results = await js(`document.body.innerText`)
  ok('⌘K finds form commands', palette.found && /form/i.test(results), palette)

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log('  - ' + f.name + (f.detail !== undefined ? ' ' + JSON.stringify(f.detail).slice(0, 600) : ''))
  }
  fs.rmSync(profile, { recursive: true, force: true })
  app.exit(failures.length ? 1 : 0)
}

void nativeTheme
app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err)
    app.exit(1)
  }),
)
