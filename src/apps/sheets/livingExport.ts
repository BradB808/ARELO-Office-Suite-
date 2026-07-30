// "Living spreadsheet" export: one self-contained .html file with a real,
// editable grid where formulas keep recalculating after the recipient edits
// a cell — no app, no account, no network. See src/shared/livingDoc.ts for
// the shared page shell and src/apps/sheets/engine/standalone.ts /
// scripts/build-engine-bundle.mjs for how the embedded engine gets built.
//
// Design: the INITIAL grid is server-rendered here (in TypeScript, using the
// same engine the app already runs) so the file opens already showing correct
// values with zero script execution latency. The embedded engine bundle only
// takes over from that point on, recomputing the sheet in the reader's
// browser whenever they commit an edit. Charts are rendered once, at export
// time, as static SVG (see chartSvg.ts) — they reflect the sheet's values at
// export time and do not recalculate after edits.

import type { Sheet, SheetsContent, CellStyle } from '../../shared/types'
import { computeSheet } from './engine/formula'
import { colToLetters, refToString } from './engine/refs'
import { usedRange } from './gridMath'
import { mergeSpanAt } from './merge'
import { cssFamily } from '../../shared/fonts'
import { livingPage, escapeHtml, jsonForScript } from '../../shared/livingDoc'
import { renderChartSvg } from './chartSvg'
import engineSrc from './engine/engineBundle.gen.js?raw'

const PAD_ROWS = 5
const PAD_COLS = 3
const MIN_ROWS = 8
const MIN_COLS = 6
const ROW_HEADER_W = 42
const DEFAULT_COL_W = 100
const DEFAULT_ROW_H = 24

function cellStyleCss(style: CellStyle | undefined, numeric: boolean): string {
  const parts: string[] = []
  if (style?.bold) parts.push('font-weight:700')
  if (style?.italic) parts.push('font-style:italic')
  if (style?.underline && style?.strike) parts.push('text-decoration:underline line-through')
  else if (style?.underline) parts.push('text-decoration:underline')
  else if (style?.strike) parts.push('text-decoration:line-through')
  if (style?.color) parts.push(`color:${style.color}`)
  if (style?.fill) parts.push(`background:${style.fill}`)
  if (style?.fontSize) parts.push(`font-size:${style.fontSize}px`)
  if (style?.fontFamily) parts.push(`font-family:${cssFamily(style.fontFamily)}`)
  parts.push(`text-align:${style?.align ?? (numeric ? 'right' : 'left')}`)
  if (style?.wrap) parts.push('white-space:pre-wrap', 'word-break:break-word')
  if (style?.valign === 'top' || style?.valign === 'bottom') {
    // The input/textarea normally stretches to fill the row (height:100%),
    // which forces its native vertical-centering regardless of any CSS —
    // drop that stretch so the <td>'s own vertical-align (set by the caller)
    // can actually position the content top/bottom, matching Grid.tsx.
    parts.push('height:auto')
  }
  return parts.join(';')
}

function cellValignAttr(style: CellStyle | undefined): string {
  if (style?.valign === 'top') return ' style="vertical-align:top"'
  if (style?.valign === 'bottom') return ' style="vertical-align:bottom"'
  return ''
}

function renderSheetTable(sheet: Sheet, idx: number, isActive: boolean): string {
  const computed = computeSheet(sheet)
  const { maxRow, maxCol } = usedRange(sheet)
  const rows = Math.max(maxRow + 1 + PAD_ROWS, MIN_ROWS)
  const cols = Math.max(maxCol + 1 + PAD_COLS, MIN_COLS)

  let colgroup = `<col style="width:${ROW_HEADER_W}px">`
  for (let c = 0; c < cols; c++) colgroup += `<col style="width:${sheet.colWidths[c] ?? DEFAULT_COL_W}px">`

  let thead = '<tr><th class="axs-corner"></th>'
  for (let c = 0; c < cols; c++) thead += `<th>${colToLetters(c)}</th>`
  thead += '</tr>'

  let body = ''
  const skip = new Set<string>()
  for (let r = 0; r < rows; r++) {
    const h = sheet.rowHeights[r] ?? DEFAULT_ROW_H
    let rowHtml = `<tr style="height:${h}px"><th>${r + 1}</th>`
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`
      if (skip.has(key)) continue
      const span = mergeSpanAt(sheet.merges, r, c)
      const rowSpan = span.r1 - span.r0 + 1
      const colSpan = span.c1 - span.c0 + 1
      if (rowSpan > 1 || colSpan > 1) {
        for (let rr = span.r0; rr <= span.r1; rr++)
          for (let cc = span.c0; cc <= span.c1; cc++) if (rr !== r || cc !== c) skip.add(`${rr},${cc}`)
      }
      const ref = refToString(c, r)
      const cell = sheet.cells[ref]
      const cc = computed.get(ref)
      const numeric = typeof cc?.value === 'number'
      const display = cc?.display ?? ''
      const raw = cell?.v ?? ''
      const styleCss = escapeHtml(cellStyleCss(cell?.style, numeric))
      const spanAttrs = `${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''}${colSpan > 1 ? ` colspan="${colSpan}"` : ''}`
      // A wrapped cell needs an element that can actually break onto multiple
      // lines. <input> never does that regardless of white-space (single-line
      // elements ignore wrapping CSS entirely), so the "wrap text" style would
      // silently render as plain single-line text in the export even though it
      // wraps in the app's own grid. <textarea> renders identically to <input>
      // for every handler below (both expose a plain .value) so no script
      // changes are needed — only which tag gets emitted here.
      const tag = cell?.style?.wrap ? 'textarea' : 'input'
      const valueAttr = tag === 'input' ? ` value="${escapeHtml(display)}"` : ''
      const inner = tag === 'textarea' ? escapeHtml(display) : ''
      const closeTag = tag === 'textarea' ? `>${inner}</textarea>` : ' />'
      const valignAttr = cellValignAttr(cell?.style)
      rowHtml += `<td class="axs-cell"${valignAttr}${spanAttrs}><${tag} class="axs-input" style="${styleCss}" data-ref="${ref}" data-raw="${escapeHtml(raw)}"${valueAttr} spellcheck="false"${closeTag}</td>`
    }
    rowHtml += '</tr>'
    body += rowHtml
  }

  const chartsHtml = renderChartsBlock(sheet, computed)

  return `<section class="axs-sheet" data-sheet="${idx}" style="${isActive ? '' : 'display:none'}">
    <div class="axs-tablewrap"><table class="axs-grid"><colgroup>${colgroup}</colgroup><thead>${thead}</thead><tbody>${body}</tbody></table></div>
    ${chartsHtml}
  </section>`
}

function renderChartsBlock(sheet: Sheet, computed: ReturnType<typeof computeSheet>): string {
  const charts = sheet.charts ?? []
  if (!charts.length) return ''
  const cards = charts
    .map((c) => `<div class="axs-chartcard">${renderChartSvg(c, computed, Math.max(240, c.w), Math.max(160, c.h))}</div>`)
    .join('')
  return `<div class="axs-charts">${cards}</div>`
}

const SHEETS_LIVING_CSS = `
  .axs-wrap { padding-top: 2px; }
  .axs-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .axs-tab {
    border: 1px solid var(--line); background: var(--surface); color: var(--muted);
    font: inherit; font-size: 12.5px; font-weight: 600; padding: 6px 14px;
    border-radius: 999px; cursor: pointer;
  }
  .axs-tab.on { background: var(--accent); color: #fff; border-color: var(--accent); }
  .axs-sheet { margin-bottom: 24px; }
  .axs-tablewrap { overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); max-height: 72vh; }
  table.axs-grid { border-collapse: separate; border-spacing: 0; width: max-content; font-size: 12.5px; }
  .axs-grid th, .axs-grid td { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 0; }
  .axs-grid thead th {
    background: var(--bg); color: var(--muted); font-weight: 600; font-size: 11px;
    padding: 5px 6px; position: sticky; top: 0; z-index: 2;
  }
  .axs-grid tbody th {
    background: var(--bg); color: var(--muted); font-weight: 600; font-size: 11px;
    padding: 4px 6px; position: sticky; left: 0; z-index: 1; text-align: center;
  }
  .axs-corner { position: sticky; left: 0; top: 0; z-index: 3; background: var(--bg); }
  .axs-cell { position: relative; }
  .axs-input {
    display: block; width: 100%; height: 100%; min-height: 26px; box-sizing: border-box;
    border: none; outline: none; background: transparent; font: inherit; color: inherit;
    padding: 4px 6px; resize: none; overflow: hidden;
  }
  .axs-input:focus { background: color-mix(in srgb, var(--accent) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); }
  .axs-charts { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
  .axs-chartcard { border: 1px solid var(--line); border-radius: 10px; padding: 8px; background: var(--surface); }
  .axs-footnote { margin-top: 20px; font-size: 11.5px; color: var(--muted); text-align: center; }
`

/** Vanilla JS glue: cell focus/blur/edit handling, recompute-on-commit via the
 *  embedded engine, and sheet-tab switching. Kept dependency-free so it runs
 *  in any browser with no build step. */
function buildRuntimeScript(content: SheetsContent): string {
  const sheetsData = content.sheets.map((s) => ({
    cells: s.cells,
    merges: s.merges,
    colWidths: s.colWidths,
    rowHeights: s.rowHeights,
  }))
  return `${engineSrc}
;(function () {
  var SHEETS = ${jsonForScript(sheetsData)};
  var active = ${content.active};
  var engine = window.AnleoEngine;

  function refreshSheet(idx) {
    var sheet = SHEETS[idx];
    var root = document.querySelector('.axs-sheet[data-sheet="' + idx + '"]');
    if (!sheet || !root || !engine) return;
    var computed = engine.computeSheet(sheet);
    var inputs = root.querySelectorAll('.axs-input');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (document.activeElement === el) continue;
      var ref = el.getAttribute('data-ref');
      var cell = sheet.cells[ref];
      var rawVal = cell && cell.v !== undefined ? cell.v : '';
      el.setAttribute('data-raw', rawVal);
      var c = computed.get(ref);
      el.value = c ? c.display : '';
    }
  }

  function commit(el) {
    var ref = el.getAttribute('data-ref');
    var sheet = SHEETS[active];
    if (!sheet) return;
    var next = el.value;
    var existing = sheet.cells[ref];
    if (next === '') {
      if (existing && existing.style) sheet.cells[ref] = { style: existing.style };
      else delete sheet.cells[ref];
    } else {
      sheet.cells[ref] = existing && existing.style ? { v: next, style: existing.style } : { v: next };
    }
    refreshSheet(active);
  }

  document.addEventListener(
    'focusin',
    function (e) {
      var el = e.target;
      if (!el.classList || !el.classList.contains('axs-input')) return;
      el.value = el.getAttribute('data-raw') || '';
      el.select();
    },
    true,
  )

  document.addEventListener(
    'focusout',
    function (e) {
      var el = e.target;
      if (!el.classList || !el.classList.contains('axs-input')) return;
      commit(el);
    },
    true,
  )

  document.addEventListener(
    'keydown',
    function (e) {
      var el = e.target;
      if (!el.classList || !el.classList.contains('axs-input')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        var ref = el.getAttribute('data-ref');
        var cell = SHEETS[active].cells[ref];
        el.value = cell && cell.v !== undefined ? cell.v : '';
        el.blur();
      }
    },
    true,
  )

  var tabs = document.querySelectorAll('.axs-tab');
  for (var t = 0; t < tabs.length; t++) {
    tabs[t].addEventListener('click', function (e) {
      var idx = Number(e.currentTarget.getAttribute('data-tab'));
      active = idx;
      var allTabs = document.querySelectorAll('.axs-tab');
      for (var j = 0; j < allTabs.length; j++) {
        allTabs[j].classList.toggle('on', Number(allTabs[j].getAttribute('data-tab')) === idx);
      }
      var sections = document.querySelectorAll('.axs-sheet');
      for (var k = 0; k < sections.length; k++) {
        sections[k].style.display = Number(sections[k].getAttribute('data-sheet')) === idx ? '' : 'none';
      }
    });
  }
})();
`
}

/** Builds the full standalone "Living spreadsheet" .html document. */
export function buildLivingSpreadsheetHtml(content: SheetsContent, title: string): string {
  const tabsHtml =
    content.sheets.length > 1
      ? `<div class="axs-tabs">${content.sheets
          .map((s, i) => `<button type="button" class="axs-tab${i === content.active ? ' on' : ''}" data-tab="${i}">${escapeHtml(s.name)}</button>`)
          .join('')}</div>`
      : ''

  const sheetsHtml = content.sheets.map((s, i) => renderSheetTable(s, i, i === content.active)).join('')

  const body = `<div class="anleo-wrap axs-wrap">
  ${tabsHtml}
  ${sheetsHtml}
  <div class="axs-footnote">Edits stay in your browser — nothing is uploaded.</div>
</div>`

  return livingPage({
    title: title || 'Untitled',
    badge: 'Interactive spreadsheet',
    css: SHEETS_LIVING_CSS,
    body,
    script: buildRuntimeScript(content),
  })
}
