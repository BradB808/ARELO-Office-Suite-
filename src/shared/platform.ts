// Storage/platform abstraction. In Electron we use real native dialogs + files via
// the preload bridge; in a plain browser (dev/testing/free web version) we fall back
// to <input type=file>, blob downloads, and localStorage. No servers anywhere.

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface OpenFileResult {
  canceled: boolean
  path?: string
  name?: string
  /** utf8 text, or base64 when binary was requested */
  data?: string
}

export interface SaveFileResult {
  canceled: boolean
  path?: string
  name?: string
}

/** What the main process reports about its own network and storage controls. */
export interface SecurityStatus {
  /** Deny-by-default request filter is installed. */
  networkGate: boolean
  /** True only when an OpenRouter key is stored — the one allowed exception. */
  aiEnabled: boolean
  /** The key is sealed with the OS keychain rather than written in the clear. */
  keyEncrypted: boolean
  allowedHost: string | null
  blockedRecently: number
}

interface AnleoBridge {
  isElectron: boolean
  openDialog(opts: { filters?: FileFilter[]; binary?: boolean }): Promise<OpenFileResult>
  saveDialog(opts: {
    defaultName?: string
    filters?: FileFilter[]
    data: string
    binary?: boolean
  }): Promise<SaveFileResult>
  savePathDialog(opts: { defaultName?: string; filters?: FileFilter[] }): Promise<SaveFileResult>
  exportPdf(opts: {
    html: string
    path: string
    landscape?: boolean
    footerTitle?: string
  }): Promise<{ ok: boolean; error?: string }>
  readFile(opts: { path: string; binary?: boolean }): Promise<{ ok: boolean; name?: string; data?: string; error?: string }>
  writeFile(opts: { path: string; data: string; binary?: boolean }): Promise<{ ok: boolean; error?: string }>
  storeGet(key: string): Promise<unknown>
  storeSet(key: string, value: unknown): Promise<boolean>
  secretGet(): Promise<string>
  secretSet(value: string): Promise<{ ok: boolean; encrypted: boolean }>
  securityStatus(): Promise<SecurityStatus>
  fontsSave(name: string, data: string): Promise<{ ok: boolean }>
  fontsList(): Promise<{ name: string; data: string }[]>
  fontsDelete(name: string): Promise<{ ok: boolean }>
  appVersion(): Promise<string>
  onMenu(cb: (action: string) => void): void
  onOpenPath(cb: (path: string) => void): void
}

declare global {
  interface Window {
    anleo?: AnleoBridge
  }
}

export const isElectron = typeof window !== 'undefined' && !!window.anleo?.isElectron

// ---------- helpers ----------

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

// ---------- browser fallbacks ----------

function browserPickFile(accept: string, binary: boolean): Promise<OpenFileResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve({ canceled: true })
      if (binary) {
        const buf = new Uint8Array(await file.arrayBuffer())
        resolve({ canceled: false, name: file.name, data: bytesToB64(buf) })
      } else {
        resolve({ canceled: false, name: file.name, data: await file.text() })
      }
    }
    // If the user dismisses the picker we simply never resolve odd cases; use
    // window focus as a cancel heuristic.
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) resolve({ canceled: true })
        window.removeEventListener('focus', onFocus)
      }, 400)
    }
    window.addEventListener('focus', onFocus)
    input.click()
  })
}

function browserDownload(name: string, data: string, binary: boolean): SaveFileResult {
  const blob = binary
    ? new Blob([b64ToBytes(data) as unknown as BlobPart])
    : new Blob([data], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return { canceled: false, name }
}

function filtersToAccept(filters?: FileFilter[]): string {
  if (!filters?.length) return ''
  return filters
    .flatMap((f) => f.extensions)
    .map((e) => (e === '*' ? '' : '.' + e))
    .filter(Boolean)
    .join(',')
}

// ---------- unified API ----------

export const platform = {
  isElectron,

  async openFile(filters?: FileFilter[], binary = false): Promise<OpenFileResult> {
    if (isElectron) return window.anleo!.openDialog({ filters, binary })
    return browserPickFile(filtersToAccept(filters), binary)
  },

  async saveFile(
    defaultName: string,
    data: string,
    filters?: FileFilter[],
    binary = false,
  ): Promise<SaveFileResult> {
    if (isElectron) return window.anleo!.saveDialog({ defaultName, filters, data, binary })
    return browserDownload(defaultName, data, binary)
  },

  /** Native save dialog that only picks a path (multi-format save). Electron only. */
  async choosePath(defaultName: string, filters?: FileFilter[]): Promise<SaveFileResult> {
    if (isElectron) return window.anleo!.savePathDialog({ defaultName, filters })
    return { canceled: true }
  },

  /** Render HTML to a real PDF file. Electron only. */
  async exportPdfToPath(
    html: string,
    outPath: string,
    opts: { landscape?: boolean; footerTitle?: string } = {},
  ): Promise<{ ok: boolean; error?: string }> {
    if (isElectron)
      return window.anleo!.exportPdf({
        html,
        path: outPath,
        landscape: opts.landscape,
        footerTitle: opts.footerTitle,
      })
    return { ok: false, error: 'PDF export needs the desktop app' }
  },

  async readPath(path: string, binary = false) {
    if (isElectron) return window.anleo!.readFile({ path, binary })
    return { ok: false, error: 'not supported in browser' }
  },

  async writePath(path: string, data: string, binary = false) {
    if (isElectron) return window.anleo!.writeFile({ path, data, binary })
    return { ok: false, error: 'not supported in browser' }
  },

  async storeGet<T>(key: string): Promise<T | undefined> {
    if (isElectron) return (await window.anleo!.storeGet(key)) as T | undefined
    try {
      const raw = localStorage.getItem('anleo:' + key)
      return raw ? (JSON.parse(raw) as T) : undefined
    } catch {
      return undefined
    }
  },

  async storeSet(key: string, value: unknown): Promise<void> {
    if (isElectron) {
      await window.anleo!.storeSet(key, value)
    } else {
      try {
        localStorage.setItem('anleo:' + key, JSON.stringify(value))
      } catch (e) {
        console.warn('storeSet failed', e)
      }
    }
  },

  /**
   * The OpenRouter key. In the desktop app this is sealed by the macOS
   * Keychain via Electron's safeStorage and never written in the clear. The
   * browser fallback (dev only) has no keychain, so it uses sessionStorage —
   * the key lives in memory for the tab and is not persisted to disk.
   */
  async secretGet(): Promise<string> {
    if (isElectron) return window.anleo!.secretGet()
    try {
      return sessionStorage.getItem('anleo:secret') ?? ''
    } catch {
      return ''
    }
  },

  async secretSet(value: string): Promise<void> {
    if (isElectron) {
      await window.anleo!.secretSet(value)
      return
    }
    try {
      if (value) sessionStorage.setItem('anleo:secret', value)
      else sessionStorage.removeItem('anleo:secret')
    } catch (e) {
      console.warn('secretSet failed', e)
    }
  },

  async securityStatus(): Promise<SecurityStatus> {
    if (isElectron) return window.anleo!.securityStatus()
    return {
      networkGate: false,
      aiEnabled: false,
      keyEncrypted: false,
      allowedHost: null,
      blockedRecently: 0,
    }
  },

  async fontsSave(name: string, base64: string): Promise<void> {
    if (isElectron) {
      await window.anleo!.fontsSave(name, base64)
    } else {
      const list = (await this.storeGet<{ name: string; data: string }[]>('fonts')) ?? []
      const next = list.filter((f) => f.name !== name)
      next.push({ name, data: base64 })
      await this.storeSet('fonts', next)
    }
  },

  async fontsList(): Promise<{ name: string; data: string }[]> {
    if (isElectron) return window.anleo!.fontsList()
    return (await this.storeGet<{ name: string; data: string }[]>('fonts')) ?? []
  },

  async fontsDelete(name: string): Promise<void> {
    if (isElectron) {
      await window.anleo!.fontsDelete(name)
    } else {
      const list = (await this.storeGet<{ name: string; data: string }[]>('fonts')) ?? []
      await this.storeSet(
        'fonts',
        list.filter((f) => f.name !== name),
      )
    }
  },

  onMenu(cb: (action: string) => void): void {
    if (isElectron) window.anleo!.onMenu(cb)
  },

  onOpenPath(cb: (path: string) => void): void {
    if (isElectron) window.anleo!.onOpenPath(cb)
  },
}
