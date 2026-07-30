// Format registry for multi-format Save As. Each editor registers the formats
// it can produce; the native save dialog then offers them in its format menu
// (e.g. Word .docx that opens in Apple Pages, real .pdf, .xlsx, .pptx).

import type { AnleoDocument, AppKind } from './types'

export type ExportPayload =
  | { data: string; binary: boolean }
  | { pdfHtml: string; landscape?: boolean; footerTitle?: string }

export interface ExportFormat {
  ext: string
  label: string
  produce: (doc: AnleoDocument) => Promise<ExportPayload>
}

const registry = new Map<AppKind, ExportFormat[]>()

export function registerExporters(kind: AppKind, formats: ExportFormat[]): void {
  registry.set(kind, formats)
}

export function getExporters(kind: AppKind): ExportFormat[] {
  return registry.get(kind) ?? []
}
