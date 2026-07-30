// Shared TYPE-ONLY definitions for the Docs export converters (RTF / ODT / EPUB).
//
// IMPORTANT — why this file has no runtime exports used across converters:
// `rtf.ts`, `odt.ts`, and `epub.ts` are executed directly by Node (via
// `node src/apps/docs/convert/convert.test.ts`) as plain ESM. Node's native
// TypeScript support requires every relative import specifier to carry its
// real file extension (e.g. `./walk.ts`), but this project's tsconfig does
// not set `allowImportingTsExtensions`, so any *runtime* relative import
// written with a literal `.ts` suffix fails `tsc --noEmit` with TS5097 — and
// project rules forbid touching tsconfig.json.
//
// `import type { ... }` from a relative, extension-less specifier sidesteps
// both problems: TypeScript resolves it fine under `moduleResolution:
// "bundler"` (no TS5097, since there's no literal extension in the text),
// and Node's type-stripping erases the whole statement before it ever tries
// to resolve the module at runtime. That is the only cross-file coupling
// used here — every runtime helper is intentionally duplicated locally in
// each converter file so each one stays a fully self-contained ES module.

/** Normalized view of a TipTap text node's marks, shared shape across all
 *  three converters (each file re-implements `readMarks` locally). */
export interface NormalizedMarks {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  subscript?: boolean
  superscript?: boolean
  color?: string
  highlight?: string
  fontFamily?: string
  fontSizePx?: number
  lineHeight?: number
  linkHref?: string
}

/** Result of decoding a `data:` URL. */
export interface DecodedDataUrl {
  bytes: Uint8Array
  mime: string
}

export type ListKind = 'bullet' | 'ordered' | 'task'
