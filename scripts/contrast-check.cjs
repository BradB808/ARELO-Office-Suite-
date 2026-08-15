// Measures real rendered text contrast in every app, in both themes.
//
//   npm run build && npx electron scripts/contrast-check.cjs
//
// Reads computed styles from the running app rather than reasoning about the
// stylesheet, so it catches colour that only goes wrong once a variable has
// cascaded. Translucent backgrounds are composited over what is behind them —
// comparing text against a raw rgba() can score a colour against itself and
// report a meaningless 1.0.

const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const ROOT = path.join(__dirname, '..')
const MIN_RATIO = 4.5 // WCAG AA for body text
const MIN_LARGE = 3.0 // AA for >=18.66px bold or >=24px

const profile = path.join(os.tmpdir(), 'anleo-contrast-' + process.pid)
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
require(path.join(ROOT, 'electron', 'main.cjs'))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function ratio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function parseColor(s) {
  const str = String(s)
  const n = (str.match(/[\d.]+/g) || ['0', '0', '0']).map(Number)
  // color-mix() and other CSS Color 4 values resolve to `color(srgb r g b / a)`
  // with components in 0..1, not 0..255. Reading those as bytes turns a light
  // violet into near-black and invents contrast failures.
  if (/^color\(/i.test(str)) {
    const c = n.slice(str.toLowerCase().startsWith('color(srgb') ? 0 : 0)
    return { rgb: c.slice(0, 3).map((v) => Math.round(v * 255)), a: c.length > 3 ? c[3] : 1 }
  }
  return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 }
}

function composite(fg, under) {
  return fg.rgb.map((c, i) => Math.round(fg.a * c + (1 - fg.a) * under[i]))
}

// Collects every leaf text node with its colour and its background stack.
const PROBE = `(() => {
  const out = []
  const pageBg = getComputedStyle(document.body).backgroundColor
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    const text = (el.textContent || '').trim()
    if (!text) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    // A gradient or image background is not a single colour, so any node
    // painted over one cannot be judged by this method. Flag it rather than
    // guessing — falling through to the page background invents a result.
    const stack = []
    let gradient = false
    let p = el
    while (p) {
      const cp = getComputedStyle(p)
      if (cp.backgroundImage && cp.backgroundImage !== 'none') gradient = true
      const b = cp.backgroundColor
      if (b && b !== 'rgba(0, 0, 0, 0)') stack.push(b)
      p = p.parentElement
    }
    out.push({
      text: text.slice(0, 40),
      gradient,
      cls: el.className && el.className.toString ? el.className.toString().slice(0, 50) : '',
      color: cs.color,
      stack,
      pageBg,
      size: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
    })
  }
  return out
})()`

function evaluate(nodes) {
  const bad = []
  let skipped = 0
  for (const n of nodes) {
    if (n.gradient) {
      skipped++
      continue
    }
    // Paint the background stack back-to-front to get what is actually behind
    // the glyphs.
    let under = parseColor(n.pageBg).rgb
    for (const layer of [...n.stack].reverse()) under = composite(parseColor(layer), under)
    const fg = composite(parseColor(n.color), under)
    const r = ratio(fg, under)
    const large = n.size >= 24 || (n.size >= 18.66 && Number(n.weight) >= 700)
    const need = large ? MIN_LARGE : MIN_RATIO
    if (r < need) bad.push({ ...n, ratio: +r.toFixed(2), need, effective: under })
  }
  bad.skipped = skipped
  return bad
}

async function main() {
  await wait(2800)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) throw new Error('no window')
  const js = (c) => win.webContents.executeJavaScript(c, true)

  const APPS = ['docs', 'sheets', 'slides', 'forms']
  let total = 0
  const problems = []

  for (const theme of ['light', 'dark']) {
    await js(`document.documentElement.setAttribute('data-theme','${theme}')`)
    await wait(400)

    // Home first, then each app opened from a template so real content is on screen.
    for (const kind of APPS) {
      await js(`(() => {
        const back = document.querySelector('.doc-header .iconbtn')
        if (back) back.click()
      })()`)
      await wait(600)
      const opened = await js(`(() => {
        const c = document.querySelector('.tpl-card[data-app="${kind}"]')
        if (!c) return false
        c.click()
        return true
      })()`)
      if (!opened) {
        problems.push({ app: kind, theme, text: '(no template card found)', ratio: 0, need: 0 })
        continue
      }
      await wait(1500)
      const nodes = await js(PROBE)
      total += nodes.length
      const bad = evaluate(nodes)
      const skipNote = bad.skipped ? ` (${bad.skipped} over gradients, not measurable)` : ''
      const label = `${kind}/${theme}`
      if (bad.length) {
        console.log(`  ✗ ${label.padEnd(16)} ${bad.length} of ${nodes.length} below threshold${skipNote}`)
        for (const b of (process.env.FULL ? bad : bad.slice(0, 6))) {
          console.log(`      ${String(b.ratio).padStart(5)}:1 (need ${b.need})  "${b.text}"  .${b.cls}`)
        }
        problems.push(...bad.map((b) => ({ ...b, app: kind, theme })))
      } else {
        console.log(`  ✓ ${label.padEnd(16)} ${nodes.length} text nodes all legible${skipNote}`)
      }
    }
  }

  console.log(`\n${total} text nodes measured across 4 apps x 2 themes`)
  console.log(problems.length === 0 ? 'No contrast failures.' : `${problems.length} failures.`)
  fs.rmSync(profile, { recursive: true, force: true })
  app.exit(problems.length ? 1 : 0)
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err)
    app.exit(1)
  }),
)
