// Standalone bundle entry point — NOT used by the app itself. This is the
// input `scripts/build-engine-bundle.mjs` bundles (with plain Vite/Rollup)
// into `engineBundle.gen.js`, an IIFE embedded verbatim in the "Living
// spreadsheet" export (see ../livingExport.ts) so an exported .html file can
// recalculate formulas fully offline, in any browser, with zero dependency
// on the rest of Anleo Office.
//
// Keep this file's surface tiny and stable: exported page JS (livingExport.ts)
// calls `AnleoEngine.computeSheet(sheet)` and reads the returned Map directly,
// exactly like the in-app code does.

import { computeSheet } from './formula'

declare global {
  // eslint-disable-next-line no-var
  var AnleoEngine: { computeSheet: typeof computeSheet } | undefined
}

globalThis.AnleoEngine = { computeSheet }
