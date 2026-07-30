// Security regression test. Runs the real security layer inside a real
// Electron process against the real built renderer.
//
//   npm run build && npm run verify:security
//
// Exits non-zero on any failure, so it can gate a release. Nothing here is
// mocked: the fetches below are genuine attempts to leave the machine, and
// they are expected to be stopped by the gate rather than by being offline.

const { app, BrowserWindow, session, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const security = require('../electron/security.cjs')

let passed = 0
const failures = []

function ok(name, cond, detail) {
  if (cond) {
    passed++
    console.log('  ✓ ' + name)
  } else {
    failures.push({ name, detail })
    console.log('  ✗ ' + name + (detail ? '  → ' + JSON.stringify(detail) : ''))
  }
}

async function run() {
  console.log('\nURL policy (AI off)')
  security.setAiEnabled(false)
  ok('blocks a plain https host', !security.isAllowedUrl('https://example.com/x'))
  ok('blocks http', !security.isAllowedUrl('http://example.com/x'))
  ok('blocks arbitrary websockets', !security.isAllowedUrl('wss://evil.example/socket'))
  ok('blocks openrouter while AI is off', !security.isAllowedUrl('https://openrouter.ai/api/v1/x'))
  ok('blocks a lookalike host', !security.isAllowedUrl('https://openrouter.ai.evil.example/x'))
  ok('blocks an unparseable url', !security.isAllowedUrl('not a url'))
  ok('allows file://', security.isAllowedUrl('file:///Users/x/app/index.html'))
  ok('allows data:', security.isAllowedUrl('data:image/png;base64,AA=='))
  ok('allows blob:', security.isAllowedUrl('blob:file:///abc'))

  console.log('\nURL policy (AI on)')
  security.setAiEnabled(true)
  ok('allows openrouter once a key exists', security.isAllowedUrl('https://openrouter.ai/api/v1/x'))
  ok('still blocks every other host', !security.isAllowedUrl('https://api.openai.com/v1/x'))
  ok('still blocks a subdomain of the allowed host', !security.isAllowedUrl('https://cdn.openrouter.ai/x'))
  security.setAiEnabled(false)

  console.log('\nCredential at rest')
  const available = security.encryptionAvailable()
  ok('OS encryption is available', available, { available })
  if (available) {
    const secret = 'sk-or-v1-' + 'a'.repeat(40)
    const rec = security.encryptSecret(secret)
    ok('encrypts to an opaque blob', rec.encrypted === true && !JSON.stringify(rec).includes(secret))
    ok('round-trips correctly', security.decryptSecret(rec) === secret)
    ok('a corrupted blob fails closed', security.decryptSecret({ encrypted: true, blob: 'AAAA' }) === '')
    ok('an absent record yields empty', security.decryptSecret(null) === '')
  }

  console.log('\nScratch files')
  const scratch = security.secureTempFile('test', 'html')
  fs.writeFileSync(scratch.file, 'sensitive contents', { mode: 0o600 })
  const dirMode = fs.statSync(scratch.dir).mode & 0o777
  const fileMode = fs.statSync(scratch.file).mode & 0o777
  ok('temp dir is owner-only (0700)', dirMode === 0o700, { dirMode: dirMode.toString(8) })
  ok('temp file is owner-only (0600)', fileMode === 0o600, { fileMode: fileMode.toString(8) })
  ok('temp name is unguessable', /[0-9a-f]{16}/.test(path.basename(scratch.file)))
  security.cleanupTemp(scratch)
  ok('temp file is removed', !fs.existsSync(scratch.file))
  ok('temp dir is removed', !fs.existsSync(scratch.dir))

  console.log('\nStore file on disk')
  const storeFile = path.join(app.getPath('userData'), 'anleo-store.json')
  if (fs.existsSync(storeFile)) {
    const raw = fs.readFileSync(storeFile, 'utf8')
    ok('no plaintext OpenRouter key in the store', !/sk-or-v1-[A-Za-z0-9]/.test(raw))
    const mode = fs.statSync(storeFile).mode & 0o777
    ok('store is not world-readable', (mode & 0o077) === 0, { mode: mode.toString(8) })
  } else {
    console.log('  – no store file yet (fresh profile), skipping')
  }

  console.log('\nLive network gate in a renderer')
  security.installNetworkGate(session.defaultSession)
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  if (!fs.existsSync(distIndex)) {
    failures.push({ name: 'dist/index.html missing — run npm run build first' })
  } else {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    security.hardenWebContents(win.webContents)
    await win.loadFile(distIndex)

    const probe = async (url) =>
      win.webContents.executeJavaScript(
        `fetch(${JSON.stringify(url)}, {mode:'no-cors'}).then(()=> 'reached').catch(e => 'blocked:' + e.name)`,
        true,
      )

    ok('renderer cannot reach example.com', (await probe('https://example.com/')).startsWith('blocked'))
    ok(
      'renderer cannot reach a beacon host',
      (await probe('https://tracker.example/pixel.gif?id=1')).startsWith('blocked'),
    )
    ok(
      'renderer cannot reach openrouter while AI is off',
      (await probe('https://openrouter.ai/api/v1/models')).startsWith('blocked'),
    )

    // The probes above could be satisfied by the page CSP alone. The whole
    // point of the gate is that it holds when the CSP does not, so prove it
    // separately from a page that has no CSP at all.
    const bare = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    security.hardenWebContents(bare.webContents)
    await bare.loadURL('data:text/html,<title>bare</title>')
    const bareProbe = async (url) =>
      bare.webContents.executeJavaScript(
        `fetch(${JSON.stringify(url)}, {mode:'no-cors'}).then(()=> 'reached').catch(e => 'blocked:' + e.name)`,
        true,
      )
    const hasCsp = await bare.webContents.executeJavaScript(
      `!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')`,
      true,
    )
    ok('control page genuinely has no CSP', hasCsp === false)
    ok(
      'gate blocks a host with no CSP in play',
      (await bareProbe('https://example.com/')).startsWith('blocked'),
    )
    ok(
      'gate counted the block in the main process',
      security.recentBlocked().some((b) => b.url.includes('example.com')),
      security.recentBlocked().slice(-3),
    )
    bare.destroy()

    // Top-level navigation away from the app must be refused.
    const before = win.webContents.getURL()
    await win.webContents
      .executeJavaScript(`window.location.href = 'https://example.com/'`, true)
      .catch(() => {})
    await new Promise((r) => setTimeout(r, 700))
    ok('renderer cannot navigate off-app', win.webContents.getURL() === before, {
      before,
      after: win.webContents.getURL(),
    })

    // The shipped CSP must not carry the dev-server allowances.
    const csp = await win.webContents.executeJavaScript(
      `document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || ''`,
      true,
    )
    ok('shipped CSP has no bare ws:', !/\bws:/.test(csp), { csp })
    ok('shipped CSP has no localhost', !csp.includes('localhost'), { csp })
    ok('shipped CSP forbids form submission', csp.includes("form-action 'none'"), { csp })
    ok('shipped CSP forbids framing', csp.includes("frame-src 'none'"), { csp })
    ok('shipped CSP blocks remote images', /img-src 'self' data: blob:/.test(csp), { csp })

    win.destroy()
  }

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log(' - ' + f.name + (f.detail ? ' ' + JSON.stringify(f.detail) : ''))
  }
  app.exit(failures.length ? 1 : 0)
}

// Keep the check off the real profile so it never touches a user's documents.
app.setPath('userData', path.join(os.tmpdir(), 'anleo-security-check'))
void safeStorage
app.whenReady().then(() =>
  run().catch((err) => {
    console.error(err)
    app.exit(1)
  }),
)
