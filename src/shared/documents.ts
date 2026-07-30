// Document persistence: autosave into the local store, save/open real files,
// recents list. All local — no network, no accounts.

import type { AnleoDocument, AppKind, AnyContent, RecentEntry } from './types'
import { uid } from './types'
import { platform } from './platform'
import { getExporters } from './exporters'

const FILE_EXT: Record<AppKind, string> = {
  docs: 'adoc',
  sheets: 'asheet',
  slides: 'aslides',
}

const FILE_DESC: Record<AppKind, string> = {
  docs: 'Anleo Docs Document',
  sheets: 'Anleo Sheets Spreadsheet',
  slides: 'Anleo Slides Presentation',
}

export function extFor(kind: AppKind): string {
  return FILE_EXT[kind]
}

export function newDocument(kind: AppKind, title: string, content: AnyContent): AnleoDocument {
  const now = Date.now()
  return {
    meta: { id: uid(), kind, title, createdAt: now, updatedAt: now },
    content,
  }
}

function serialize(doc: AnleoDocument): string {
  return JSON.stringify({ anleo: 1, meta: doc.meta, content: doc.content })
}

export function parseDocument(json: string): AnleoDocument | null {
  try {
    const obj = JSON.parse(json)
    if (!obj || typeof obj !== 'object' || !obj.meta || !obj.content) return null
    const kind = obj.meta.kind
    if (kind !== 'docs' && kind !== 'sheets' && kind !== 'slides') return null
    return { meta: obj.meta, content: obj.content }
  } catch {
    return null
  }
}

// ---------- recents ----------

export async function listRecents(): Promise<RecentEntry[]> {
  return (await platform.storeGet<RecentEntry[]>('recents')) ?? []
}

export async function touchRecent(doc: AnleoDocument): Promise<void> {
  const recents = await listRecents()
  const entry: RecentEntry = {
    id: doc.meta.id,
    kind: doc.meta.kind,
    title: doc.meta.title,
    filePath: doc.meta.filePath,
    updatedAt: Date.now(),
  }
  const next = [entry, ...recents.filter((r) => r.id !== doc.meta.id)].slice(0, 60)
  await platform.storeSet('recents', next)
}

export async function removeRecent(id: string): Promise<void> {
  const recents = await listRecents()
  await platform.storeSet(
    'recents',
    recents.filter((r) => r.id !== id),
  )
  await platform.storeSet('doc:' + id, undefined)
}

// ---------- autosave (store-backed drafts) ----------

export async function autosave(doc: AnleoDocument): Promise<void> {
  doc.meta.updatedAt = Date.now()
  await platform.storeSet('doc:' + doc.meta.id, { meta: doc.meta, content: doc.content })
  await touchRecent(doc)
  // If the doc is bound to a real file, keep the file in sync too.
  if (doc.meta.filePath && platform.isElectron) {
    await platform.writePath(doc.meta.filePath, serialize(doc))
  }
}

export async function loadDraft(id: string): Promise<AnleoDocument | null> {
  const stored = await platform.storeGet<{ meta: AnleoDocument['meta']; content: AnyContent }>(
    'doc:' + id,
  )
  if (!stored || !stored.meta) return null
  return { meta: stored.meta, content: stored.content }
}

// ---------- explicit save / open ----------

export interface SaveResult {
  saved: boolean
  /** File name the user ended up with, for feedback toasts. */
  fileName?: string
  /** Extension actually written (adoc/docx/pdf/xlsx/…). */
  format?: string
  error?: string
}

/**
 * Save As with a real format choice: the native dialog's format menu offers the
 * Anleo format plus everything the current editor registered (docx, pdf, xlsx,
 * pptx, …), so files can go straight into Word, Apple Pages, Excel, Keynote.
 */
export async function saveDocumentAs(doc: AnleoDocument): Promise<SaveResult> {
  const ext = FILE_EXT[doc.meta.kind]
  const title = doc.meta.title || 'Untitled'

  if (!platform.isElectron) {
    const res = await platform.saveFile(`${title}.${ext}`, serialize(doc), [
      { name: FILE_DESC[doc.meta.kind], extensions: [ext] },
    ])
    if (res.canceled) return { saved: false }
    await touchRecent(doc)
    return { saved: true, fileName: res.name ?? `${title}.${ext}`, format: ext }
  }

  const formats = getExporters(doc.meta.kind)
  const filters = [
    { name: FILE_DESC[doc.meta.kind], extensions: [ext] },
    ...formats.map((f) => ({ name: f.label, extensions: [f.ext] })),
  ]
  const res = await platform.choosePath(`${title}.${ext}`, filters)
  if (res.canceled || !res.path || !res.name) return { saved: false }

  const chosen = (res.name.includes('.') ? res.name.split('.').pop()! : ext).toLowerCase()
  const fmt = formats.find((f) => f.ext === chosen)

  if (!fmt || chosen === ext) {
    // Native Anleo format: becomes the document's bound file.
    const out = await platform.writePath(res.path, serialize(doc))
    if (!out.ok) return { saved: false, error: out.error }
    doc.meta.filePath = res.path
    await touchRecent(doc)
    return { saved: true, fileName: res.name, format: ext }
  }

  // Exported copy in a foreign format (doc stays bound to its Anleo file/draft).
  const payload = await fmt.produce(doc)
  if ('pdfHtml' in payload) {
    const out = await platform.exportPdfToPath(payload.pdfHtml, res.path, {
      landscape: payload.landscape,
      footerTitle: payload.footerTitle,
    })
    if (!out.ok) return { saved: false, error: out.error }
  } else {
    const out = await platform.writePath(res.path, payload.data, payload.binary)
    if (!out.ok) return { saved: false, error: out.error }
  }
  return { saved: true, fileName: res.name, format: chosen }
}

/**
 * "Download as" — save a copy in one explicit foreign format (Google-Docs-style
 * menu item). Never rebinds the document's own file.
 */
export async function saveDocumentCopyAs(doc: AnleoDocument, ext: string): Promise<SaveResult> {
  const title = doc.meta.title || 'Untitled'
  const fmt = getExporters(doc.meta.kind).find((f) => f.ext === ext)
  if (!fmt) return { saved: false, error: `No exporter for .${ext}` }

  if (platform.isElectron) {
    const res = await platform.choosePath(`${title}.${ext}`, [
      { name: fmt.label, extensions: [ext] },
    ])
    if (res.canceled || !res.path || !res.name) return { saved: false }
    const payload = await fmt.produce(doc)
    if ('pdfHtml' in payload) {
      const out = await platform.exportPdfToPath(payload.pdfHtml, res.path, {
        landscape: payload.landscape,
        footerTitle: payload.footerTitle,
      })
      if (!out.ok) return { saved: false, error: out.error }
    } else {
      const out = await platform.writePath(res.path, payload.data, payload.binary)
      if (!out.ok) return { saved: false, error: out.error }
    }
    return { saved: true, fileName: res.name, format: ext }
  }

  const payload = await fmt.produce(doc)
  if ('pdfHtml' in payload) return { saved: false, error: 'PDF export needs the desktop app' }
  const res = await platform.saveFile(
    `${title}.${ext}`,
    payload.data,
    [{ name: fmt.label, extensions: [ext] }],
    payload.binary,
  )
  if (res.canceled) return { saved: false }
  return { saved: true, fileName: res.name ?? `${title}.${ext}`, format: ext }
}

export async function saveDocument(doc: AnleoDocument): Promise<SaveResult> {
  if (doc.meta.filePath && platform.isElectron) {
    const res = await platform.writePath(doc.meta.filePath, serialize(doc))
    if (res.ok) {
      await touchRecent(doc)
      const fileName = doc.meta.filePath.split('/').pop()
      return { saved: true, fileName, format: FILE_EXT[doc.meta.kind] }
    }
  }
  return saveDocumentAs(doc)
}

export async function openDocumentDialog(kind?: AppKind): Promise<AnleoDocument | null> {
  const filters = kind
    ? [{ name: FILE_DESC[kind], extensions: [FILE_EXT[kind]] }]
    : [{ name: 'Anleo Documents', extensions: ['adoc', 'asheet', 'aslides'] }]
  const res = await platform.openFile(filters)
  if (res.canceled || !res.data) return null
  const doc = parseDocument(res.data)
  if (!doc) return null
  if (res.path) doc.meta.filePath = res.path
  await autosave(doc)
  return doc
}

export async function openDocumentFromPath(path: string): Promise<AnleoDocument | null> {
  const res = await platform.readPath(path)
  if (!res.ok || !res.data) return null
  const doc = parseDocument(res.data)
  if (!doc) return null
  doc.meta.filePath = path
  await autosave(doc)
  return doc
}
