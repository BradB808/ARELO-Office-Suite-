// Anleo Office — main-process security layer.
//
// Threat model: the user may be someone whose network and machine are of
// interest to a well-resourced adversary (a journalist, a researcher, a
// source). The design goal is that Anleo itself never becomes the thing that
// leaks — it makes no network request the user did not ask for, and a hostile
// document cannot make one on its behalf.
//
// The controls here sit in the *browser process*, below the renderer. Even if
// a bug in the UI let hostile content run, it still cannot reach the network,
// navigate the window away, or open a link without the user seeing the URL.

const { session, shell, dialog, safeStorage } = require('electron')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/** Schemes that never touch the network — always fine. */
const LOCAL_SCHEMES = new Set(['file:', 'data:', 'blob:', 'devtools:', 'about:'])

/** The single remote host the app may ever contact, and only when AI is on. */
const AI_ORIGIN = 'https://openrouter.ai'

// AI is off until the renderer proves a key is configured. Default-closed: a
// fresh install, or one where the key was removed, reaches nothing at all.
let aiEnabled = false

/** Dev server origin — only trusted when we were told to load from it. */
let devOrigin = null

const blockedLog = []

function setAiEnabled(on) {
  aiEnabled = !!on
}

function isAiEnabled() {
  return aiEnabled
}

function setDevOrigin(startUrl) {
  if (!startUrl) return
  try {
    devOrigin = new URL(startUrl).origin
  } catch {
    devOrigin = null
  }
}

function isAllowedUrl(rawUrl) {
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    // Unparseable — deny. Nothing legitimate lands here.
    return false
  }

  if (LOCAL_SCHEMES.has(u.protocol)) return true

  // The Vite dev server (and its HMR socket) when running `npm run dev`.
  if (devOrigin) {
    if (u.origin === devOrigin) return true
    if ((u.protocol === 'ws:' || u.protocol === 'wss:') && u.host === new URL(devOrigin).host) {
      return true
    }
  }

  // The one opt-in remote destination.
  if (aiEnabled && u.origin === AI_ORIGIN) return true

  return false
}

function note(url) {
  blockedLog.push({ url: String(url).slice(0, 300), at: Date.now() })
  if (blockedLog.length > 200) blockedLog.shift()
}

function recentBlocked() {
  return blockedLog.slice(-50)
}

/**
 * Deny-by-default network gate. Applied to a session, this cancels every
 * request that is not local, not the dev server, and not the opted-in AI
 * endpoint — regardless of which page or script initiated it.
 */
function installNetworkGate(sess, { allowAi = true } = {}) {
  sess.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url
    if (isAllowedUrl(url) && (allowAi || !url.startsWith(AI_ORIGIN))) {
      callback({ cancel: false })
      return
    }
    note(url)
    callback({ cancel: true })
  })

  // Nothing in an offline office suite needs camera, mic, location, clipboard
  // read, notifications or background sync. Refuse the lot.
  sess.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  sess.setPermissionCheckHandler(() => false)

  // No extensions, no remote code paths.
  sess.setDevicePermissionHandler(() => false)
}

/**
 * Locks a webContents down: it may not navigate anywhere, may not spawn
 * windows on its own, and any external link needs the user to see the real URL
 * and agree. A tracking link inside a hostile document therefore cannot fire
 * silently.
 */
function hardenWebContents(contents, { parentWindow = null } = {}) {
  const isDevServerUrl = (url) => {
    if (!devOrigin) return false
    try {
      return new URL(url).origin === devOrigin
    } catch {
      return false
    }
  }

  const blockNavigation = (event, url) => {
    // The app's own pages load via file:// (packaged) or the dev server.
    if (url.startsWith('file://') || isDevServerUrl(url)) return
    event.preventDefault()
    note(url)
  }

  contents.on('will-navigate', blockNavigation)
  contents.on('will-redirect', blockNavigation)
  contents.on('will-frame-navigate', (event) => {
    const url = event.url || ''
    if (url.startsWith('file://') || isDevServerUrl(url)) return
    event.preventDefault()
    note(url)
  })

  // No <webview>, ever.
  contents.on('will-attach-webview', (event) => event.preventDefault())

  contents.setWindowOpenHandler(({ url }) => {
    void openExternalWithConsent(url, parentWindow)
    return { action: 'deny' }
  })

  return contents
}

/**
 * Opens a link in the user's browser only after showing them the destination.
 * Anything that is not plain http(s) is refused outright — `file:`, `smb:` and
 * custom schemes are classic ways to make a click do something else.
 */
async function openExternalWithConsent(rawUrl, parentWindow) {
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    note(rawUrl)
    return false
  }

  const shown = u.href.length > 300 ? u.href.slice(0, 300) + '…' : u.href
  const opts = {
    type: 'question',
    buttons: ['Cancel', 'Open in browser'],
    defaultId: 0,
    cancelId: 0,
    title: 'Leave Anleo Office?',
    message: `Open this link in your browser?\n\n${u.host}`,
    detail:
      `${shown}\n\n` +
      'Anleo will not load it. Your browser will, which tells that site your ' +
      'IP address and that you opened this document.',
    noLink: true,
  }

  const { response } = parentWindow
    ? await dialog.showMessageBox(parentWindow, opts)
    : await dialog.showMessageBox(opts)

  if (response !== 1) return false
  await shell.openExternal(u.href)
  return true
}

// ---------- secrets at rest ----------

/**
 * The OpenRouter key is a credential, so it does not sit in a JSON file in the
 * clear. `safeStorage` encrypts it with a key held in the macOS Keychain, so
 * reading it back needs this app on this login account — a stolen copy of the
 * app-support folder, a Time Machine snapshot or a cloud backup is useless.
 */
function encryptSecret(plain) {
  if (!plain) return null
  if (!safeStorage.isEncryptionAvailable()) return { plain, encrypted: false }
  return { blob: safeStorage.encryptString(plain).toString('base64'), encrypted: true }
}

function decryptSecret(record) {
  if (!record) return ''
  if (record.encrypted === false) return record.plain || ''
  if (!record.blob) return ''
  try {
    return safeStorage.decryptString(Buffer.from(record.blob, 'base64'))
  } catch {
    // Wrong login account, Keychain entry revoked, or a corrupted store.
    return ''
  }
}

function encryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

// ---------- scratch files ----------

/**
 * PDF export has to hand HTML to a renderer, which means a real file on disk
 * for a moment. Put it in a 0700 directory with an unguessable name, write it
 * 0600, then overwrite it before unlinking so the bytes are not left sitting
 * in free space for a casual `strings` over the disk image.
 */
function secureTempFile(prefix, ext) {
  const dir = path.join(os.tmpdir(), 'anleo-' + crypto.randomBytes(6).toString('hex'))
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  return {
    dir,
    file: path.join(dir, `${prefix}-${crypto.randomBytes(8).toString('hex')}.${ext}`),
  }
}

function shredFile(filePath) {
  try {
    const size = fs.statSync(filePath).size
    if (size > 0) fs.writeFileSync(filePath, crypto.randomBytes(size))
  } catch {
    // Already gone, or unreadable — the unlink below is what matters.
  }
  try {
    fs.unlinkSync(filePath)
  } catch {}
}

function cleanupTemp(scratch) {
  if (!scratch) return
  shredFile(scratch.file)
  try {
    fs.rmSync(scratch.dir, { recursive: true, force: true })
  } catch {}
}

module.exports = {
  AI_ORIGIN,
  installNetworkGate,
  hardenWebContents,
  openExternalWithConsent,
  setAiEnabled,
  isAiEnabled,
  setDevOrigin,
  isAllowedUrl,
  recentBlocked,
  encryptSecret,
  decryptSecret,
  encryptionAvailable,
  secureTempFile,
  cleanupTemp,
  shredFile,
}
