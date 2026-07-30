# Office parity audit — Anleo vs Excel / Word / PowerPoint

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
