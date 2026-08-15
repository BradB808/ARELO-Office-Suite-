# Office parity audit — Anleo vs Excel / Word / PowerPoint / Google Forms

Audit of the mainstream feature surface of Microsoft Office (and Google Workspace),
triaged for a free, offline, single-user suite. ✅ shipped · 🕐 later · ✖ out of scope.

## Sheets vs Excel

| Feature | Status |
|---|---|
| Formula engine, cell/range/absolute refs | ✅ |
| Core functions (math/text/logic/date/lookup, ~70) | ✅ |
| Multi-criteria: SUMIFS, COUNTIFS, AVERAGEIFS, MAXIFS, MINIFS | ✅ |
| XLOOKUP, ROW/COLUMN/ROWS/COLUMNS, SUMPRODUCT | ✅ |
| Financial: PMT, FV, PV, NPER, RATE, NPV, IRR | ✅ |
| Trig + advanced math (SIN…ATAN2, GCD, COMBIN, FACT, MROUND…) | ✅ |
| Statistics: PERCENTILE, QUARTILE, CORREL, SLOPE, FORECAST… | ✅ |
| Date power tools: EDATE, EOMONTH, WORKDAY, NETWORKDAYS, DATEDIF | ✅ |
| Number formats (currency, %, date, decimals) | ✅ |
| Charts (bar/line/pie/area) | ✅ |
| **Merged cells** | ✅ |
| **Freeze panes** | ✅ |
| **Hide/unhide rows & columns** | ✅ |
| **Find & replace** | ✅ |
| **Conditional formatting** (rules + color scales) | ✅ |
| **Column filters** | ✅ |
| **Data validation (dropdown lists)** | ✅ |
| Sort, fill handle, multi-sheet, xlsx/csv both ways | ✅ |
| Pivot tables | 🕐 |
| Named ranges, array formulas | 🕐 |
| Macros/VBA, Power Query, external data | ✖ (offline/free scope) |
| Real-time collaboration | ✖ (no servers by design) |

## Docs vs Word

| Feature | Status |
|---|---|
| Rich formatting, styles, lists, tables, images, links | ✅ |
| Find & replace | ✅ |
| Custom font install | ✅ (beyond Word) |
| Export docx/pdf/odt/rtf/epub/html/md/txt | ✅ |
| Import docx/md/html/txt | ✅ |
| **Floating images with text wrap** (drag anywhere, wrap left/right, exports as real Word square-wrap) | ✅ |
| **Page breaks** | ✅ |
| **Table of contents** | ✅ |
| **Page numbers (PDF/print footer)** | ✅ |
| **Special character picker** | ✅ |
| **Change case (UPPER/lower/Title)** | ✅ |
| **Spellcheck with suggestions** | ✅ (system spellcheck + right-click suggestions) |
| Footnotes, captions, cross-references | 🕐 |
| Track changes / comments | ✖ (single-user scope; revisit) |
| Mail merge | ✖ |

## Slides vs PowerPoint

| Feature | Status |
|---|---|
| Canvas editing, themes, layouts, present mode, transitions | ✅ |
| Speaker notes, pptx export, PDF | ✅ |
| **More shapes (15 total: +plus, cross, pentagon, hexagon, speech, cloud)** | ✅ |
| **Gradient shape fills** | ✅ |
| **Line arrowheads** | ✅ |
| **Align & distribute selected elements** | ✅ |
| **Slide numbers** | ✅ |
| **Presenter tools (notes overlay + timer while presenting)** | ✅ |
| Element entrance animations | 🕐 |
| Tables & embedded charts on slides | 🕐 |
| Group/ungroup | 🕐 |
| Video/audio embeds | 🕐 |
| Live co-presenting | ✖ (no servers by design) |

## Forms vs Google Forms

Google Forms is a server product: you publish a link and answers land in
Google's database. Anleo has no server, so the round trip is different — the
form travels as a file, and so do the answers. Nobody in the middle sees them.

| Feature | Status |
|---|---|
| Question types: short, paragraph, choice, checkboxes, dropdown, scale, date, time, email, number | ✅ |
| Sections, help text, required questions, "Other" option | ✅ |
| Themes, question numbering, progress bar | ✅ |
| Live preview of exactly what respondents see | ✅ |
| **Share as one self-contained .html file** (no link, no account, works offline) | ✅ |
| **Responses come back as a file or a paste-able code** | ✅ |
| Response summaries with per-question charts | ✅ |
| Export responses to CSV | ✅ |
| **Send responses straight into Anleo Sheets** | ✅ |
| Printable paper version (PDF) | ✅ |
| Form templates | ✅ (10) |
| Response validation (required, email, number range) | ✅ |
| Automatic collection from a public link | ✖ (needs a server — that is the trade) |
| Live response notifications | ✖ (no servers by design) |
| Branching / conditional questions | 🕐 |
| File upload questions | 🕐 |

### Why the file round trip is a feature, not a workaround

A form that collects sensitive answers — a tip line, a health questionnaire, an
HR complaint — normally routes every answer through a third party. Anleo's
never leave the two people involved. The exported page carries a CSP that
forbids it from contacting anything, so a respondent can verify that for
themselves before typing a word.
