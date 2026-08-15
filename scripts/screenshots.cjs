// Captures the README screenshots straight from the running app.
//
//   npm run build && npm run screenshots
//
// Uses webContents.capturePage() rather than a screen grab, so the images are
// pixel-exact, free of desktop clutter, and reproducible by anyone who clones
// the repo. Runs against a throwaway profile so it never opens real documents.

const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'screenshots')

const profile = path.join(os.tmpdir(), 'anleo-shots-' + process.pid)
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)

require(path.join(ROOT, 'electron', 'main.cjs'))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Shots to take: which template to open in which app. */
const SHOTS = [
  { file: 'hub.png', app: null, template: null, label: 'Home' },
  { file: 'docs.png', app: 'docs', template: 'Modern resume', label: 'Anleo Docs' },
  { file: 'sheets.png', app: 'sheets', template: 'Monthly budget', label: 'Anleo Sheets' },
  { file: 'slides.png', app: 'slides', template: 'Startup pitch', label: 'Anleo Slides' },
  { file: 'forms.png', app: 'forms', template: 'Event RSVP', label: 'Anleo Forms' },
]

/**
 * capturePage() hands back the most recently *committed* compositor frame, so
 * calling it straight after a React update returns the previous screen.
 * Discard one capture to force a fresh commit, then take the real one.
 *
 * Deliberately no requestAnimationFrame handshake here: when the window is
 * occluded or in the background macOS stops firing rAF, and awaiting it hangs
 * the script forever.
 */
async function captureSettled(win) {
  await wait(600)
  await win.webContents.capturePage()
  await wait(250)
  return win.webContents.capturePage()
}

async function main() {
  await wait(2600)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) throw new Error('no window')
  const js = (code) => win.webContents.executeJavaScript(code, true)

  fs.mkdirSync(OUT, { recursive: true })

  // Light theme, so the screenshots match the app's default.
  await js(`document.documentElement.setAttribute('data-theme','light')`)
  await wait(300)

  for (const shot of SHOTS) {
    if (shot.app) {
      // Back to the hub, then pick the named template in the right app.
      await js(`(() => {
        const back = document.querySelector('.doc-header .iconbtn, .back-btn, [title="Back to home"]')
        if (back) back.click()
      })()`)
      await wait(700)

      const picked = await js(`(() => {
        const cards = [...document.querySelectorAll('.tpl-card[data-app="${shot.app}"]')]
        const named = cards.find(c => (c.querySelector('.tpl-name')?.textContent || '').trim() === ${JSON.stringify(shot.template)})
        const target = named || cards[0]
        if (!target) return 'no-card'
        target.click()
        return named ? 'named' : 'fallback'
      })()`)
      if (picked === 'no-card') throw new Error('no template card for ' + shot.app)
      await wait(1600)
    } else {
      await wait(400)
    }

    const image = await captureSettled(win)
    fs.writeFileSync(path.join(OUT, shot.file), image.toPNG())
    const { width, height } = image.getSize()
    const title = await js(`document.querySelector('.doc-title-input, .doc-title')?.value
      || document.querySelector('.doc-title-input, .doc-title')?.textContent
      || (document.querySelector('.hub') ? 'Home' : '?')`)
    console.log(`  ${shot.file.padEnd(12)} ${width}×${height}  ${shot.label} → showing “${title}”`)
  }

  console.log(`\nWrote ${SHOTS.length} screenshots to docs/screenshots/`)
  fs.rmSync(profile, { recursive: true, force: true })
  app.exit(0)
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err)
    app.exit(1)
  }),
)
