# Anleo Office — working notes

A free, offline macOS office suite: Docs, Sheets, Slides and Forms in one
Electron app. No server, no account, no telemetry.

## The rule that outranks everything else

**The app makes no network requests.** Not "few" — none, except OpenRouter when
the user has personally supplied an API key. This is the product, not a nice
property of it, and several people rely on it.

Before adding anything, check it does not:

- fetch a font, icon, stylesheet, script or image from a URL
- send an error report, a metric, a heartbeat or an update check
- load remote content into a document, a preview or an export

`npm run verify:security` must stay green. It gates `npm run dist`, so a build
that produces a DMG is a build that passed. If you need to relax a control,
that is a conversation, not a commit.

Related invariants:

- **Imports are sanitized.** Anything from outside (docx, md, html, paste) goes
  through `src/shared/sanitizeHtml.ts` — an allowlist, never a blocklist. It
  strips remote images and scripts so a document cannot report being opened.
- **Exports are self-contained.** Living pages and exported forms embed a
  restrictive CSP and inline everything. The recipient's browser must not
  contact anything.
- **Releases are unsigned** (`CSC_IDENTITY_AUTO_DISCOVERY=false` in `npm run
  dist`). Signing embeds the signer's legal name in the binary. Use
  `npm run dist:signed` only deliberately.

## Layout

```
electron/
  main.cjs        window, IPC, native dialogs, PDF export, file associations
  security.cjs    network gate, navigation guards, keychain secrets, temp files
  preload.cjs     the entire renderer↔main surface (a fixed list, nothing else)
src/
  App.tsx         shell: rail, routing, autosave, global commands, settings
  shared/         everything cross-app (see below)
  shell/          command palette (⌘K), shortcuts help (⌘/)
  hub/            home screen, template gallery, content previews
  apps/docs/      TipTap editor, import/export, floating images
  apps/sheets/    grid + formula engine (tokenizer → parser → evaluator)
  apps/slides/    canvas editor, present mode, pptx export
  apps/forms/     form builder, fillable HTML export, response collection
  templates/      the template library, pooled in all.ts
scripts/          icon generation, security checks, screenshots
```

### `src/shared` — the parts everything depends on

| File | Purpose |
|---|---|
| `types.ts` | The document model. `AppKind` drives the whole shell. |
| `platform.ts` | The only path to files/storage. Electron IPC with a browser fallback so the suite also runs as a plain web page for testing. |
| `documents.ts` | Autosave, save/open, recents, file extensions. |
| `exporters.ts` | Per-app export format registry. Apps register on mount. |
| `blank.ts` | Empty content + display names per app kind. |
| `commands.ts` | Command registry behind ⌘K. Scope-based register/clear. |
| `livingDoc.ts` | Self-contained HTML page builder (shared by living docs and forms). |
| `livelink.ts` | Cross-app live ranges — a Sheets range pasted into Docs/Slides. |
| `sanitizeHtml.ts` | Allowlist sanitizer for imported markup. |
| `ai.ts` | OpenRouter client. Off unless a key is stored. |
| `ui.tsx` | Modal, Select, Button, MenuButton — use these, don't hand-roll. |

## Adding a new app kind

Touching `AppKind` ripples. The full checklist:

1. `shared/types.ts` — add to `AppKind`, define its `*Content` interface, add to
   `AnyContent`, add a `*Template` alias
2. `shared/blank.ts` — `blankX()`, `blankContent()`, `APP_NAMES`, `NEW_TITLES`
3. `shared/documents.ts` — `FILE_EXT`, `FILE_DESC`, `parseDocument` kind guard
4. `shared/icons.tsx` — a case in `AppGlyph`
5. `shared/theme.css` — `--c-<kind>` and `--c-<kind>-soft`
6. `App.tsx` — rail button, editor render branch, switch-to command
7. `hub/ContentPreview.tsx` — a preview renderer for gallery cards
8. `templates/all.ts` — pool its templates
9. `electron/main.cjs` — `fileAssociations` + the `open-file` extension regex
10. `package.json` `build.mac.fileAssociations`

Miss one and it usually still compiles — it just quietly does nothing. Grep for
an existing kind (e.g. `'slides'`) to find every site.

## Conventions

- TypeScript strict. `npm run typecheck` before anything else.
- No CSS-in-JS libraries. Each app has one `.css` file; shared tokens live in
  `shared/theme.css`. Use the CSS variables (`--text`, `--text-2`, `--border`,
  `--surface`, `--ok`, `--warn`, `--danger`) — do not hardcode colours, dark
  mode depends on them.
- Comments explain *why*, not what. Match the surrounding density.
- Document content is plain JSON. Keep it serializable — no class instances, no
  functions, no `undefined` where `null` is meant.
- `uid()` from `types.ts` for ids.

## Testing

There is no test runner dependency. Suites are plain TypeScript compiled with
Vite and run under Node, except those needing a DOM, which run in a browser.

```bash
npm run typecheck
npm run verify:security                      # 34 assertions, real Electron
npm run test:all                             # every Node-runnable suite
npm run dev                                  # then open the browser suites:
#   http://localhost:5173/security-test.html
```

| Suite | Where |
|---|---|
| Formula engine | `src/apps/sheets/engine/formula.test.ts` |
| Chart geometry, both renderers | `src/apps/sheets/chart.test.ts` |
| Document conversion | `src/apps/docs/convert/convert.test.ts` |
| Shared contracts | `src/shared/shared.test.ts` |
| Forms model + responses | `src/apps/forms/forms.test.ts` |
| Import sanitizer (needs DOM) | `src/shared/sanitizeHtml.test.ts` |
| Security layer (needs Electron) | `scripts/security-check.cjs` |
| Forms round trip (needs Electron) | `npm run test:forms-e2e` |
| Forms UI (needs Electron) | `npm run test:ui` |
| Charts on screen (needs Electron) | `npm run test:charts` |
| Colour contrast, all apps + themes | `npm run test:contrast` |

`test:forms-e2e` is the one that matters most for Forms: it writes the exported
HTML to disk, loads it in a real BrowserWindow with a request filter attached,
fills every control, submits, and feeds the code the page produced back through
the app's own decoder. It fails if the page attempts a single network request.

`test:charts` is the one that matters most for Sheets charts: the layout has no
DOM to measure text with, so it estimates from the characters — and every
reserve that keeps a label on the frame is computed from that estimate. The
suite opens a shipped template in the real app and compares `getBBox()` against
the estimate the chart was laid out with. That is how the estimate was caught
running 16% short for digits, which no unit test could have seen.

`test:contrast` reads computed styles from the running app in both themes. Two
traps it took a while to get right, worth knowing before you trust its output:
`color-mix()` resolves to `color(srgb 0.72 0.61 0.94)` with components in 0..1,
not 0..255; and a translucent background must be composited over what is behind
it or you end up scoring a colour against itself and reporting 1.0.

Run one by hand:

```bash
npx vite build --ssr src/shared/shared.test.ts --outDir .tmp && node .tmp/shared.test.js
```

**Test the real app, not just the units.** `scripts/screenshots.cjs` shows the
pattern: boot `electron/main.cjs` against a throwaway `userData` profile, drive
the renderer with `webContents.executeJavaScript`, assert on what comes back.
That has caught things unit tests could not — a modal unmounting mid-interaction,
a dropdown rendered behind its own backdrop, permissions not applying to an
existing file.

Two gotchas when driving the app that way:

- `capturePage()` returns the last *committed* frame. Take one capture, discard
  it, then take the real one.
- `requestAnimationFrame` does not fire when the window is occluded. Awaiting it
  hangs forever. Use plain timeouts.

## Charts

There are two chart renderers — `ChartRender.tsx` draws into the app, `chartSvg.ts`
produces the SVG that goes into exports. They used to duplicate all the maths and
could silently disagree. **All geometry now lives in `chartGeom.ts`**, which turns a
spec plus data into a flat list of drawing primitives; both renderers only serialise
that list. Put new chart maths there, never in a renderer.

Colour is the one thing `chartGeom` cannot decide, because the app paints against
`--text`/`--border`/`--surface` and an exported page against `--ink`/`--muted`/`--line`.
A node's fill is therefore either a literal series colour or a role name each renderer
resolves through its own palette.

**`bar` means vertical columns.** Excel's convention is bar = horizontal, and the newer
types follow it, but this app has always drawn `bar` vertically and it is baked into
shipped templates and every saved document. Its meaning is pinned; use `column` for new
charts and `stackedBar` for the horizontal one.

## Build

```bash
npm run dev            # Vite on :5173
npm run dev:electron   # Electron against the dev server
npm run dist           # universal DMG (unsigned) in release/
```

The renderer is fully bundled — the packaged app ships no `node_modules`.
