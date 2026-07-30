# Anleo Office — Build Plan

A completely free, offline office suite for macOS (Intel + Apple Silicon). One app, three editors.
No servers, no database, no accounts — documents are plain local files, so it costs nothing to run.

## Suite structure

| App | Color | Purpose | Native format | Interop |
|-----|-------|---------|---------------|---------|
| **Anleo Docs** | Blue `#2563EB` | Word processor | `.adoc` (JSON) | Export .docx/.md/.html/.txt/PDF · Import .docx/.md/.txt/.html |
| **Anleo Sheets** | Green `#059669` | Spreadsheets | `.asheet` (JSON) | Export .xlsx/.csv · Import .xlsx/.csv |
| **Anleo Slides** | Orange `#EA580C` | Presentations | `.aslides` (JSON) | Export .pptx/PDF |

Shell: a Home hub with recents + template gallery, sidebar app switcher, dark/light mode,
autosave, keyboard shortcuts, settings. 2026 design language: clean neutrals, rounded geometry,
subtle depth, per-app accent color, Inter-style typography.

## Feature checklists

### Shared shell
- [x] Home hub: app tiles, recent documents, template gallery per app
- [x] Sidebar switcher (Docs / Sheets / Slides) — no separate downloads
- [x] Dark / light / system theme
- [x] Autosave + recents (local app-data JSON), native open/save dialogs
- [x] Keyboard shortcuts (Cmd+S, Cmd+N, Cmd+Z…), zoom
- [x] Settings panel

### Docs
- Bold/italic/underline/strikethrough/sub/superscript, headings H1–H6, quote, code block
- Font family + size, text color, highlight, line height, alignment, indent
- Lists: bullet, numbered, task; links, images, tables, horizontal rule
- **Custom font import**: drag .ttf/.otf/.woff/.woff2 in, persisted to the app's font library
- Undo/redo, find & replace, word/char count, page-style canvas, zoom
- 12+ templates (resumes, letters, reports, invoice, meeting notes, newsletter…)

### Sheets
- Editable grid (cols A–Z+, 200+ rows, growable), row/col insert/delete/resize, multi-select
- Formula engine written from scratch: cell refs, ranges, `$A$1` absolute refs, 50+ functions
  (SUM, AVERAGE, IF, VLOOKUP, INDEX, MATCH, COUNTIF, SUMIF, TEXT ops, date ops, math ops…)
- Formatting: bold/italic, colors, borders, alignment, number formats (currency, %, date…)
- Multiple sheet tabs, sort by column, fill down/right, TSV copy/paste
- Charts: bar, line, pie, area (custom SVG)
- 10+ templates (budget, invoice, habit tracker, gradebook, project tracker…)

### Slides
- Canvas editor (1280×720): text boxes, shapes, images — drag, resize, rotate, snap, z-order
- Slide thumbnails panel: add/duplicate/delete/drag-reorder
- 10+ themes; layouts (title, title+content, two-column, section, quote, blank)
- Speaker notes, fullscreen present mode with arrow-key navigation
- 10+ template decks (pitch, marketing, lesson, portfolio, roadmap…)

### Packaging
- Custom-designed icons (suite + 3 apps) → .icns
- electron-builder → universal macOS DMG (x64 + arm64)

## Tech
Electron + Vite + React + TypeScript. Rich text: TipTap (MIT). Interop: `docx`, `mammoth`,
SheetJS CE, `pptxgenjs` — all free licenses, bundled at build time. Formula engine: custom.
Storage backends: Electron IPC (real files) with a browser/localStorage fallback used for testing.

## Execution
1. Scaffold + design system + shared contracts (types, storage, UI kit) — done inline
2. Multi-agent build: Docs / Sheets+engine / Slides editors + 3 template packs + icons, in parallel
3. Integration + full in-browser test pass of every feature, fix bugs
4. Icons → .icns, universal build, launch the real app and verify end-to-end
