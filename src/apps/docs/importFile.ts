// Import handling for Anleo Docs: .docx (mammoth), .md (marked), .txt, .html.
// Every function returns the resulting body HTML (ready for editor.setContent)
// or null if the user canceled the file picker.

import mammoth from 'mammoth'
import { marked } from 'marked'
import { platform, b64ToBytes } from '../../shared/platform'
import { sanitizeHtml, describeSanitizeReport } from '../../shared/sanitizeHtml'

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

export function plainTextToHtml(text: string): string {
  const paras = text.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return paras
    .map((p) => `<p>${escapeHtml(p).split('\n').join('<br>') || ''}</p>`)
    .join('')
}

export { sanitizeImportedHtml } from '../../shared/sanitizeHtml'

export type ImportedDoc = { html: string; name: string; notice?: string } | null

/**
 * Every import goes through the allowlist sanitizer before it reaches the
 * editor — including .docx and .md, which can both carry raw HTML. `notice`
 * tells the user when something was stripped rather than doing it silently.
 */
function clean(html: string, name: string): NonNullable<ImportedDoc> {
  const { html: safe, report } = sanitizeHtml(html)
  return { html: safe, name, notice: describeSanitizeReport(report) ?? undefined }
}

export async function importDocxFile(): Promise<ImportedDoc> {
  const res = await platform.openFile([{ name: 'Word Document', extensions: ['docx'] }], true)
  if (res.canceled || !res.data || !res.name) return null
  const bytes = b64ToBytes(res.data)
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer })
  return clean(result.value, res.name)
}

export async function importMarkdownFile(): Promise<ImportedDoc> {
  const res = await platform.openFile([{ name: 'Markdown', extensions: ['md', 'markdown'] }], false)
  if (res.canceled || !res.data || !res.name) return null
  // marked passes raw HTML through untouched, so sanitizing here is essential.
  const html = await marked.parse(res.data)
  return clean(html, res.name)
}

export async function importTextFile(): Promise<ImportedDoc> {
  const res = await platform.openFile([{ name: 'Plain Text', extensions: ['txt'] }], false)
  if (res.canceled || !res.data || !res.name) return null
  return { html: plainTextToHtml(res.data), name: res.name }
}

export async function importHtmlFile(): Promise<ImportedDoc> {
  const res = await platform.openFile([{ name: 'Web Page', extensions: ['html', 'htm'] }], false)
  if (res.canceled || !res.data || !res.name) return null
  return clean(res.data, res.name)
}
