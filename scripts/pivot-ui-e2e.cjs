// Drives the pivot builder inside the real app: type a source table that hides
// a formula in a label, build a pivot over it, and check what actually lands in
// the grid. Runs against a throwaway profile so it never touches real documents.
//
//   npm run build && npx electron scripts/pivot-ui-e2e.cjs

const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const ROOT = path.join(__dirname, '..')

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

const profile = path.join(os.tmpdir(), 'anleo-pivot-ui-' + process.pid)
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
require(path.join(ROOT, 'electron', 'main.cjs'))

// Plain timeouts throughout: rAF never fires while the window is occluded, and
// awaiting it hangs the run.
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Sets a controlled React input without going through real key events. */
const SET_INPUT = `(el, v) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}`

async function main() {
  await wait(2800)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) throw new Error('no window')
  const js = (code) => win.webContents.executeJavaScript(code, true)

  await js(`document.documentElement.setAttribute('data-theme','light')`)
  await wait(300)

  // ---- a blank spreadsheet ----
  console.log('\nOpening Sheets')
  await js(`(() => {
    const btn = document.querySelector('.rail-btn.app[title="Anleo Sheets"]')
    if (btn) btn.click()
  })()`)
  await wait(1800)
  ok('the grid is on screen', await js(`!!document.querySelector('.sx-scroll')`))

  // ---- type the source table ----
  // Row 1 headers, then three rows whose Region label is a *string that looks
  // like a formula* — the shape that used to come back to life in the output.
  console.log('\nTyping a source table with a formula-shaped label')
  const ROWS = [
    ['Region', 'Amount'],
    ['="=1+1"', '10'],
    ['West', '5'],
    ['West', '7'],
  ]
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < ROWS[r].length; c++) {
      // Selecting and typing have to be separate turns: React batches the state
      // update from the mousedown, so an Enter dispatched in the same
      // synchronous block still commits to the previously active cell.
      const sel = await js(`(() => {
        const row = [...document.querySelectorAll('.sx-row')][${r}]
        if (!row) return 'no-row'
        const cell = [...row.querySelectorAll('.sx-cell')][${c}]
        if (!cell) return 'no-cell'
        cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        return 'ok'
      })()`)
      if (sel !== 'ok') throw new Error(`select ${r},${c}: ${sel}`)
      await wait(150)
      const res = await js(`(() => {
        const setInput = ${SET_INPUT}
        const fx = document.querySelector('.sx-fx-input')
        if (!fx) return 'no-fx'
        fx.focus()
        setInput(fx, ${JSON.stringify(ROWS[r][c])})
        fx.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        return document.querySelector('.sx-refbox')?.textContent
      })()`)
      if (typeof res !== 'string' || res === 'no-fx') throw new Error(`type ${r},${c}: ${res}`)
      await wait(150)
    }
  }
  await wait(400)
  const shown = await js(`(() => {
    const rows = [...document.querySelectorAll('.sx-row')].slice(0, 4)
    return rows.map(r => [...r.querySelectorAll('.sx-cell')].slice(0, 2).map(c => c.textContent.trim()))
  })()`)
  ok('the source cell really does display as a formula', shown[1] && shown[1][0] === '=1+1', shown)

  // ---- open the pivot builder ----
  console.log('\nThe pivot builder')
  await js(`document.querySelector('[aria-label="Data"]')?.click()`)
  await wait(400)
  const opened = await js(`(() => {
    const item = [...document.querySelectorAll('.popover-item')]
      .find(el => /pivot table/i.test(el.textContent) && !/refresh/i.test(el.textContent))
    if (!item) return 'no-item'
    item.click()
    return 'ok'
  })()`)
  await wait(700)
  ok('Data → Pivot table opens the builder', opened === 'ok' && (await js(`/Pivot table/.test(document.body.innerText)`)), opened)

  const guessed = await js(`(() => {
    const src = document.querySelector('.pv-field .textfield')
    const anchor = [...document.querySelectorAll('.pv-place .textfield')][0]
    return { source: src?.value, anchor: anchor?.value, preview: document.querySelectorAll('.pv-preview td').length }
  })()`)
  ok('it guesses the source range', /^A1:B4$/.test(guessed.source || ''), guessed)
  ok('it previews the block before anything is written', guessed.preview > 0, guessed)

  // ---- an anchor that is not a cell must not offer to create anything ----
  const anchorStates = await js(`(async () => {
    const setInput = ${SET_INPUT}
    const anchor = [...document.querySelectorAll('.pv-place .textfield')][0]
    const create = () => [...document.querySelectorAll('button')].find(b => /create pivot table/i.test(b.textContent))
    const out = {}
    for (const v of ['zz', 'A0', 'D1:F4', 'D1']) {
      setInput(anchor, v)
      await new Promise(r => setTimeout(r, 260))
      out[v] = { disabled: !!create()?.disabled, warned: /not a cell to start from/i.test(document.body.innerText) }
    }
    return out
  })()`)
  ok('a nonsense anchor cannot be created', anchorStates.zz.disabled && anchorStates.zz.warned, anchorStates.zz)
  ok('row zero cannot be created', anchorStates.A0.disabled, anchorStates.A0)
  ok('a range is not an anchor', anchorStates['D1:F4'].disabled, anchorStates['D1:F4'])
  ok('a real cell is accepted again', !anchorStates.D1.disabled && !anchorStates.D1.warned, anchorStates.D1)

  // ---- build it ----
  const created = await js(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /create pivot table/i.test(b.textContent))
    if (!btn || btn.disabled) return 'blocked'
    btn.click()
    return 'ok'
  })()`)
  await wait(900)
  ok('the pivot is created', created === 'ok', created)

  // ---- what actually landed in the grid ----
  console.log('\nWhat landed in the sheet')
  const block = await js(`(() => {
    const rows = [...document.querySelectorAll('.sx-row')].slice(0, 5)
    return rows.map(r => [...r.querySelectorAll('.sx-cell')].slice(3, 5).map(c => c.textContent.trim()))
  })()`)
  ok('the pivot header is in D1', block[0] && block[0][0] === 'Region', block)
  ok('the West group summed', block.some(r => r[0] === 'West' && r[1] === '12'), block)
  // The point of the exercise: the label is text, not a live formula. Before the
  // fix this cell read "2".
  ok('the formula-shaped label did not evaluate', block.some(r => r[0] === "'=1+1"), block)
  ok('nothing in the block reads as a computed formula', !block.some(r => r[0] === '2'), block)

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log('  - ' + f.name + (f.detail !== undefined ? ' ' + JSON.stringify(f.detail).slice(0, 600) : ''))
  }
  fs.rmSync(profile, { recursive: true, force: true })
  app.exit(failures.length ? 1 : 0)
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err)
    fs.rmSync(profile, { recursive: true, force: true })
    app.exit(1)
  }),
)
