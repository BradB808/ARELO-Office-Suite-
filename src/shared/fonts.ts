// Font manager: curated macOS-safe system fonts + user-installed custom fonts.
// Custom fonts (.ttf/.otf/.woff/.woff2) are persisted to the app's local font
// library and registered with the FontFace API at startup.

import { platform, bytesToB64, b64ToBytes } from './platform'

export const SYSTEM_FONTS: string[] = [
  'System (San Francisco)',
  'Helvetica Neue',
  'Arial',
  'Avenir Next',
  'Georgia',
  'Times New Roman',
  'Palatino',
  'Baskerville',
  'Didot',
  'Hoefler Text',
  'Futura',
  'Gill Sans',
  'Optima',
  'Seravek',
  'Trebuchet MS',
  'Verdana',
  'Tahoma',
  'American Typewriter',
  'Rockwell',
  'Copperplate',
  'Chalkboard SE',
  'Comic Sans MS',
  'Bradley Hand',
  'Brush Script MT',
  'Impact',
  'Courier New',
  'Menlo',
  'Monaco',
]

/** Maps display names to CSS font-family values. */
export function cssFamily(name: string): string {
  if (name === 'System (San Francisco)') return '-apple-system, system-ui, sans-serif'
  return `'${name}'`
}

let customFonts: string[] = []
const listeners = new Set<() => void>()

export function getCustomFonts(): string[] {
  return customFonts
}

export function subscribeFonts(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notify() {
  listeners.forEach((cb) => cb())
}

function familyFromFilename(filename: string): string {
  return filename
    .replace(/\.(ttf|otf|woff2?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function registerFontFace(family: string, bytes: Uint8Array): Promise<boolean> {
  try {
    const face = new FontFace(family, bytes.buffer as ArrayBuffer)
    await face.load()
    document.fonts.add(face)
    return true
  } catch (e) {
    console.warn('font register failed', family, e)
    return false
  }
}

/** Load every persisted custom font. Call once at startup. */
export async function loadInstalledFonts(): Promise<void> {
  const files = await platform.fontsList()
  const names: string[] = []
  for (const f of files) {
    const family = familyFromFilename(f.name)
    if (await registerFontFace(family, b64ToBytes(f.data))) names.push(family)
  }
  customFonts = names.sort((a, b) => a.localeCompare(b))
  notify()
}

/** Install font files the user picked or dropped. Returns installed family names. */
export async function installFontFiles(files: File[]): Promise<string[]> {
  const installed: string[] = []
  for (const file of files) {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) continue
    const bytes = new Uint8Array(await file.arrayBuffer())
    const family = familyFromFilename(file.name)
    if (await registerFontFace(family, bytes)) {
      await platform.fontsSave(file.name, bytesToB64(bytes))
      if (!customFonts.includes(family)) customFonts.push(family)
      installed.push(family)
    }
  }
  customFonts.sort((a, b) => a.localeCompare(b))
  notify()
  return installed
}

/** Open a file picker to install fonts. */
export async function installFontsViaPicker(): Promise<string[]> {
  const res = await platform.openFile([{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }], true)
  if (res.canceled || !res.data || !res.name) return []
  const bytes = b64ToBytes(res.data)
  const family = familyFromFilename(res.name)
  if (await registerFontFace(family, bytes)) {
    await platform.fontsSave(res.name, res.data)
    if (!customFonts.includes(family)) {
      customFonts.push(family)
      customFonts.sort((a, b) => a.localeCompare(b))
    }
    notify()
    return [family]
  }
  return []
}
