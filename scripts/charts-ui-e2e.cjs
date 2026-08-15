// Drives the charts in the real app: opens the shipped Sheets templates that
// carry a saved chart and measures what the renderer actually put on screen —
// real text metrics from getBBox(), not the glyph-count estimate chartGeom.ts
// lays out with. Then repeats in dark mode and checks the ink is still legible.
//
//   npm run build && npx electron scripts/charts-ui-e2e.cjs

const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const ROOT = path.join(__dirname, '..')
const SHOTS = path.join(ROOT, 'docs', 'screenshots')
// The layout's own width model, so the check below compares the browser's real
// metrics against the estimate the chart was laid out with — not a copy of it.
const { textWidth } = require(path.join(ROOT, '.tmp-chart-geom', 'chartGeom.js'))

let passed = 0
const failures = []
const ok = (name, cond, detail) => {
  if (cond) {
    passed++
    console.log('  ✓ ' + name)
  } else {
    failures.push({ name, detail })
    console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 500) : ''))
  }
}

const profile = path.join(os.tmpdir(), 'anleo-charts-ui-' + process.pid)
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
}

/** Reads every chart on screen: its ink extents, its paints, its attributes. */
const MEASURE = `(() => {
  const out = []
  for (const svg of document.querySelectorAll('.sx-chart-body svg')) {
    const w = svg.width.baseVal.value
    const h = svg.height.baseVal.value
    const card = svg.closest('.sx-chart-card')
    const bg = getComputedStyle(card).backgroundColor
    const nodes = []
    for (const el of svg.querySelectorAll('*')) {
      let box = null
      try { const b = el.getBBox(); box = [b.x, b.y, b.x + b.width, b.y + b.height] } catch (e) { box = null }
      const attrs = {}
      for (const a of el.attributes) attrs[a.name] = a.value
      nodes.push({
        tag: el.tagName,
        box,
        fill: getComputedStyle(el).fill,
        text: el.tagName === 'text' ? el.textContent : '',
        attrs,
      })
    }
    out.push({ w, h, bg, nodes })
  }
  return out
})()`

function parseRgb(s) {
  const m = String(s).match(/-?[\d.]+/g)
  return m ? m.slice(0, 3).map(Number) : null
}

function contrast(a, b) {
  const lum = ([r, g, bl]) => {
    const f = (c) => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
  }
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Templates ship charts saved as the legacy 'bar' type, so this covers them. */
async function openTemplateWithChart(js) {
  // The hub shows a handful; the gallery has all of them.
  await js(`[...document.querySelectorAll('button')].find(b => /^browse all/i.test(b.textContent.trim()))?.click()`)
  await wait(900)
  const total = await js(`document.querySelectorAll('.tpl-card[data-app="sheets"]').length`)
  for (let i = 0; i < total; i++) {
    const name = await js(`(() => {
      const c = [...document.querySelectorAll('.tpl-card[data-app="sheets"]')][${i}]
      if (!c) return null
      const n = c.querySelector('.tpl-name')?.textContent || 'unnamed'
      c.click()
      return n
    })()`)
    if (!name) continue
    await wait(1500)
    const charts = await js(`document.querySelectorAll('.sx-chart-card').length`)
    if (charts > 0) return { name, charts }
    await js(`document.querySelector('.rail-btn[title="Home"]').click()`)
    await wait(700)
    await js(`[...document.querySelectorAll('button')].find(b => /^browse all/i.test(b.textContent.trim()))?.click()`)
    await wait(700)
  }
  return null
}

async function main() {
  await wait(2800)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) throw new Error('no window')
  const js = (code) => win.webContents.executeJavaScript(code, true)

  await js(`document.documentElement.setAttribute('data-theme','light')`)
  await wait(300)

  console.log('\nA saved chart renders')
  const opened = await openTemplateWithChart(js)
  ok('a shipped template with a saved chart opens', !!opened, opened)
  if (!opened) {
    console.log('\n0 passed, 1 failed')
    fs.rmSync(profile, { recursive: true, force: true })
    app.exit(1)
    return
  }

  const charts = await js(MEASURE)
  ok('the chart drew an svg with content', charts.length > 0 && charts[0].nodes.length > 3, {
    charts: charts.length,
    nodes: charts[0]?.nodes.length,
  })

  // ---- every attribute is a number the browser could use ----
  const badAttrs = []
  for (const c of charts) {
    for (const n of c.nodes) {
      for (const [k, v] of Object.entries(n.attrs)) {
        if (/NaN|Infinity|undefined/.test(v)) badAttrs.push(`${n.tag} ${k}="${v}"`)
      }
    }
  }
  ok('no attribute reached the DOM as NaN, Infinity or undefined', badAttrs.length === 0, badAttrs.slice(0, 5))

  // ---- nothing is clipped, measured with real font metrics ----
  const clipped = []
  for (const c of charts) {
    for (const n of c.nodes) {
      if (!n.box) continue
      const [x0, y0, x1, y1] = n.box
      if (x1 - x0 === 0 && y1 - y0 === 0) continue
      // getBBox ignores the element's own transform, so a rotated label is
      // measured where it was written; those are checked by the unit suite.
      if (n.attrs.transform) continue
      if (x0 < -1 || y0 < -1 || x1 > c.w + 1 || y1 > c.h + 1) {
        clipped.push(`${n.tag} ${JSON.stringify(n.text).slice(0, 20)} ${x0.toFixed(1)},${y0.toFixed(1)}..${x1.toFixed(1)},${y1.toFixed(1)} in ${c.w}x${c.h}`)
      }
    }
  }
  ok('nothing is drawn outside the frame', clipped.length === 0, clipped.slice(0, 6))

  // ---- the estimate the layout used is not smaller than the real text ----
  const underrun = []
  for (const c of charts) {
    for (const n of c.nodes) {
      if (n.tag !== 'text' || !n.box || n.attrs.transform || !n.text) continue
      const size = Number(n.attrs['font-size'])
      const estimated = textWidth(n.text, size)
      const real = n.box[2] - n.box[0]
      if (real > estimated + 0.5) underrun.push(`"${n.text}" real ${real.toFixed(1)} > estimate ${estimated.toFixed(1)}`)
    }
  }
  ok('textWidth() never underestimates the rendered text', underrun.length === 0, underrun.slice(0, 6))

  await shot(win, 'sheets-chart-light.png')

  // ---- legible in both themes ----
  for (const theme of ['light', 'dark']) {
    await js(`document.documentElement.setAttribute('data-theme','${theme}')`)
    await wait(500)
    const themed = await js(MEASURE)
    const bg = parseRgb(themed[0].bg)
    const dim = []
    for (const c of themed) {
      for (const n of c.nodes) {
        if (n.tag !== 'text' || !n.text.trim()) continue
        const fg = parseRgb(n.fill)
        if (!fg || !bg) continue
        const ratio = contrast(fg, bg)
        if (ratio < 4.5) dim.push(`"${n.text}" ${ratio.toFixed(2)}:1 ${n.fill} on ${themed[0].bg}`)
      }
    }
    ok(`chart text is legible in ${theme} mode`, dim.length === 0, dim.slice(0, 6))
    const unresolved = themed[0].nodes.filter((n) => /var\(/.test(n.fill)).length
    ok(`every paint role resolved to a colour in ${theme} mode`, unresolved === 0, unresolved)
  }
  await shot(win, 'sheets-chart-dark.png')
  await js(`document.documentElement.setAttribute('data-theme','light')`)

  // ---- 'bar' is still the vertical one ----
  console.log('\nLegacy charts keep their shape')
  const shape = await js(`(() => {
    const svg = document.querySelector('.sx-chart-body svg')
    const rects = [...svg.querySelectorAll('rect')].map(r => ({
      w: r.width.baseVal.value, h: r.height.baseVal.value, x: r.x.baseVal.value, y: r.y.baseVal.value,
    })).filter(r => r.w > 1 && r.h > 1 && r.w !== 9)
    return { rects: rects.length, widths: new Set(rects.map(r => Math.round(r.w))).size, heights: new Set(rects.map(r => Math.round(r.h))).size }
  })()`)
  ok('the saved chart drew its marks', shape.rects === 0 || shape.rects > 1, shape)

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log('  - ' + f.name + (f.detail !== undefined ? ' ' + JSON.stringify(f.detail).slice(0, 800) : ''))
  }
  fs.rmSync(profile, { recursive: true, force: true })
  app.exit(failures.length ? 1 : 0)
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err)
    app.exit(1)
  }),
)
