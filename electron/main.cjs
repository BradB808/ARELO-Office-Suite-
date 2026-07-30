const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const security = require('./security.cjs')

let mainWindow = null
let pendingOpenPath = null

const userDataDir = () => app.getPath('userData')
const fontsDir = () => path.join(userDataDir(), 'fonts')
const storePath = () => path.join(userDataDir(), 'anleo-store.json')

const SECRET_KEY = 'secret:openrouter'

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'))
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    fs.mkdirSync(userDataDir(), { recursive: true, mode: 0o700 })
    // 0600: the store holds your documents. Other accounts on this Mac cannot
    // read it, though anything running as you still can — see PRIVACY.md.
    // `mode` on writeFileSync only applies when the file is created, so tighten
    // explicitly — otherwise a store written by an older build stays 0644.
    fs.writeFileSync(storePath(), JSON.stringify(store), { mode: 0o600 })
    fs.chmodSync(storePath(), 0o600)
  } catch (err) {
    console.error('store write failed', err)
  }
}

/**
 * Earlier builds kept the OpenRouter key in the clear inside the store file.
 * Move any such key into Keychain-backed storage and remove the plaintext, so
 * upgrading actually improves things rather than just changing new writes.
 */
function migratePlaintextSecret() {
  const store = readStore()
  const legacy = store.ai && typeof store.ai.apiKey === 'string' ? store.ai.apiKey : ''
  if (!legacy) return
  store[SECRET_KEY] = security.encryptSecret(legacy)
  delete store.ai.apiKey
  writeStore(store)
}

function readSecret() {
  return security.decryptSecret(readStore()[SECRET_KEY])
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 980,
    minHeight: 620,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    backgroundColor: '#0d0f13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // The renderer runs in the OS sandbox; the preload exposes a fixed list
      // of IPC calls and nothing else. Node is unreachable from page content.
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      // macOS spell checking is done by the OS locally (NSSpellChecker); no
      // dictionary is fetched and no text leaves the machine.
      spellcheck: true,
    },
  })

  security.hardenWebContents(mainWindow.webContents, { parentWindow: mainWindow })

  const startUrl = process.env.ELECTRON_START_URL
  if (startUrl) {
    mainWindow.loadURL(startUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPath) {
      mainWindow.webContents.send('anleo:open-path', pendingOpenPath)
      pendingOpenPath = null
    }
  })

  // Spellcheck suggestions on right-click in editable text (Docs, notes, inputs).
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.misspelledWord) return
    const items = params.dictionarySuggestions.slice(0, 5).map((suggestion) => ({
      label: suggestion,
      click: () => mainWindow.webContents.replaceMisspelling(suggestion),
    }))
    if (items.length === 0) items.push({ label: 'No suggestions', enabled: false })
    items.push({ type: 'separator' })
    items.push({
      label: `Add “${params.misspelledWord}” to dictionary`,
      click: () =>
        mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    })
    Menu.buildFromTemplate(items).popup()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('anleo:open-path', filePath)
  } else {
    pendingOpenPath = filePath
  }
})

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('anleo:menu', 'new'),
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('anleo:menu', 'open'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('anleo:menu', 'save'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('anleo:menu', 'save-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('anleo:menu', 'undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow?.webContents.send('anleo:menu', 'redo'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------- IPC ----------

ipcMain.handle('dialog:open', async (_e, opts) => {
  const { filters, binary } = opts || {}
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters && filters.length ? filters : undefined,
  })
  if (result.canceled || !result.filePaths.length) return { canceled: true }
  const filePath = result.filePaths[0]
  try {
    const buf = fs.readFileSync(filePath)
    return {
      canceled: false,
      path: filePath,
      name: path.basename(filePath),
      data: binary ? buf.toString('base64') : buf.toString('utf8'),
    }
  } catch (err) {
    return { canceled: true, error: String(err) }
  }
})

ipcMain.handle('dialog:save', async (_e, opts) => {
  const { defaultName, filters, data, binary } = opts || {}
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters && filters.length ? filters : undefined,
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  try {
    fs.writeFileSync(result.filePath, binary ? Buffer.from(data, 'base64') : data)
    return { canceled: false, path: result.filePath, name: path.basename(result.filePath) }
  } catch (err) {
    return { canceled: true, error: String(err) }
  }
})

ipcMain.handle('dialog:save-path', async (_e, opts) => {
  const { defaultName, filters } = opts || {}
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters && filters.length ? filters : undefined,
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  return { canceled: false, path: result.filePath, name: path.basename(result.filePath) }
})

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Renders HTML in a hidden window and writes a real PDF (no print dialog).
//
// The scratch file lives in a private 0700 directory under a random name, is
// written 0600, and is overwritten with random bytes before being unlinked.
// The render window gets its own session whose gate refuses everything remote
// — including OpenRouter — so a document carrying a tracking image cannot
// phone home at the moment you export it.
ipcMain.handle('export:pdf', async (_e, { html, path: outPath, landscape, footerTitle }) => {
  let win = null
  const scratch = security.secureTempFile('pdf', 'html')
  try {
    fs.writeFileSync(scratch.file, html, { mode: 0o600 })
    const pdfSession = session.fromPartition('anleo-pdf-render')
    security.installNetworkGate(pdfSession, { allowAi: false })
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: false,
        webviewTag: false,
        session: pdfSession,
      },
    })
    security.hardenWebContents(win.webContents)
    await win.loadFile(scratch.file)
    // Let embedded images/fonts settle before printing.
    await new Promise((resolve) => setTimeout(resolve, 300))
    const withFooter = typeof footerTitle === 'string' && footerTitle.length > 0
    const buf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      landscape: !!landscape,
      margins: withFooter
        ? { top: 0.4, bottom: 0.6, left: 0.4, right: 0.4 }
        : { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
      displayHeaderFooter: withFooter,
      headerTemplate: '<span></span>',
      footerTemplate: withFooter
        ? '<div style="font-size:9px; width:100%; text-align:center; color:#777; font-family:Helvetica,Arial,sans-serif;">' +
          escapeHtml(footerTitle) +
          ' — <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
        : '<span></span>',
    })
    fs.writeFileSync(outPath, buf)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  } finally {
    if (win) win.destroy()
    security.cleanupTemp(scratch)
  }
})

ipcMain.handle('file:read', async (_e, { path: filePath, binary }) => {
  try {
    const buf = fs.readFileSync(filePath)
    return {
      ok: true,
      name: path.basename(filePath),
      data: binary ? buf.toString('base64') : buf.toString('utf8'),
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('file:write', async (_e, { path: filePath, data, binary }) => {
  try {
    fs.writeFileSync(filePath, binary ? Buffer.from(data, 'base64') : data)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('store:get', async (_e, key) => {
  const store = readStore()
  return store[key]
})

ipcMain.handle('store:set', async (_e, { key, value }) => {
  const store = readStore()
  // Belt and braces: the API key has its own encrypted channel and must never
  // fall back into the plaintext store, whatever the renderer sends.
  if (key === 'ai' && value && typeof value === 'object' && 'apiKey' in value) {
    const { apiKey, ...rest } = value
    void apiKey
    store[key] = rest
  } else {
    store[key] = value
  }
  writeStore(store)
  return true
})

// ---------- encrypted credential ----------

ipcMain.handle('secret:get', async () => readSecret())

ipcMain.handle('secret:set', async (_e, value) => {
  const store = readStore()
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed) {
    store[SECRET_KEY] = security.encryptSecret(trimmed)
  } else {
    delete store[SECRET_KEY]
  }
  writeStore(store)
  // Opening or closing the one hole in the network gate.
  security.setAiEnabled(!!trimmed)
  return { ok: true, encrypted: security.encryptionAvailable() }
})

ipcMain.handle('security:status', async () => ({
  networkGate: true,
  aiEnabled: security.isAiEnabled(),
  keyEncrypted: security.encryptionAvailable(),
  allowedHost: security.isAiEnabled() ? 'openrouter.ai' : null,
  blockedRecently: security.recentBlocked().length,
  storePath: null,
}))

ipcMain.handle('fonts:save', async (_e, { name, data }) => {
  try {
    fs.mkdirSync(fontsDir(), { recursive: true })
    const safe = name.replace(/[/\\:]/g, '_')
    fs.writeFileSync(path.join(fontsDir(), safe), Buffer.from(data, 'base64'))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('fonts:list', async () => {
  try {
    fs.mkdirSync(fontsDir(), { recursive: true })
    const files = fs.readdirSync(fontsDir()).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
    return files.map((f) => ({
      name: f,
      data: fs.readFileSync(path.join(fontsDir(), f)).toString('base64'),
    }))
  } catch {
    return []
  }
})

ipcMain.handle('fonts:delete', async (_e, name) => {
  try {
    const safe = name.replace(/[/\\:]/g, '_')
    fs.unlinkSync(path.join(fontsDir(), safe))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('app:version', async () => app.getVersion())

app.whenReady().then(() => {
  // Order matters: the gate and the navigation guards must be in place before
  // any window exists, so there is no window in which content loads unguarded.
  security.setDevOrigin(process.env.ELECTRON_START_URL)
  security.installNetworkGate(session.defaultSession)
  migratePlaintextSecret()
  security.setAiEnabled(!!readSecret())

  // Catches every webContents the app ever creates, including ones added later.
  app.on('web-contents-created', (_e, contents) => security.hardenWebContents(contents))

  buildMenu()
  createWindow()
  const fileArg = process.argv.find((a) => /\.(adoc|asheet|aslides)$/i.test(a))
  if (fileArg) pendingOpenPath = fileArg
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
