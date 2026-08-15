// Unit tests for the pivot engine: grouping, aggregation, ordering, layout and
// the rules that stop a pivot from writing over someone's data.
// Run: npx vite build --ssr src/apps/sheets/pivot.test.ts --outDir .tmp-pivottest \
//        && node .tmp-pivottest/pivot.test.js

import {
  aggregate,
  anchorPos,
  anchorValid,
  buildPivot,
  fieldLabel,
  naturalCompare,
  parseSourceRef,
  pivotCellText,
  pivotColWidths,
  pivotConflicts,
  pivotPatch,
  pivotRect,
  qualifySource,
  readSource,
  refreshConflicts,
  suggestAnchor,
  valueLabel,
  type SourceTable,
} from './pivot'
import { computeSheet } from './engine/formula'
import { refToString } from './engine/refs'
import type { Cell, CellStyle, PivotSpec, Sheet } from '../../shared/types'

let passed = 0
let failed = 0

function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) passed++
  else {
    failed++
    console.error('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : '')
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
}

// ---------- fixtures ----------

function sheetOf(rows: (string | number | null)[][], styles?: Record<string, CellStyle>): Sheet {
  const cells: Record<string, Cell> = {}
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === null || v === '') return
      cells[refToString(c, r)] = { v: String(v) }
    }),
  )
  if (styles) {
    for (const [ref, style] of Object.entries(styles)) cells[ref] = { ...(cells[ref] ?? {}), style }
  }
  return { name: 'Data', cells, colWidths: {}, rowHeights: {} }
}

function tableOf(rows: (string | number | null)[][], range: string, styles?: Record<string, CellStyle>): SourceTable {
  const sheet = sheetOf(rows, styles)
  const ref = parseSourceRef(range)
  if (!ref) throw new Error('bad range ' + range)
  return readSource(sheet, computeSheet(sheet), ref)
}

function spec(patch: Partial<PivotSpec>): PivotSpec {
  return { id: 'p1', source: 'A1:D6', rows: [], cols: [], values: [], anchor: 'F1', ...patch }
}

/** The build as plain text, so an expectation reads like the block on screen. */
function grid(b: { cells: Cell[][] }): string[][] {
  return b.cells.map((row) => row.map((c) => c.v ?? ''))
}

const SALES: (string | number | null)[][] = [
  ['Region', 'Product', 'Qty', 'Amount'],
  ['East', 'Apple', 2, 10],
  ['East', 'Pear', 1, 5],
  ['West', 'Apple', 3, 7],
  ['West', 'Apple', 1, 3],
  ['North', 'Pear', 4, 20],
]

const sales = tableOf(SALES, 'A1:D6')

// ---------- source parsing ----------

eq('source: plain range', parseSourceRef('A1:D6'), { sheetName: null, r0: 0, c0: 0, r1: 5, c1: 3 })
eq('source: reversed corners normalise', parseSourceRef('D6:A1'), { sheetName: null, r0: 0, c0: 0, r1: 5, c1: 3 })
eq('source: absolute refs', parseSourceRef('$A$1:$D$6'), { sheetName: null, r0: 0, c0: 0, r1: 5, c1: 3 })
eq('source: sheet-qualified', parseSourceRef('Budget!A1:C4')?.sheetName, 'Budget')
eq('source: quoted sheet name', parseSourceRef("'Q1 data'!A1:C4")?.sheetName, 'Q1 data')
eq('source: sheet-qualified keeps the range', parseSourceRef('Budget!B2:C4'), {
  sheetName: 'Budget',
  r0: 1,
  c0: 1,
  r1: 3,
  c1: 2,
})
eq('source: single cell is not a range', parseSourceRef('A1'), null)
eq('source: nonsense', parseSourceRef('not a range'), null)
eq('qualifySource: bare word', qualifySource('Budget', 'A1:C4'), 'Budget!A1:C4')
eq('qualifySource: quotes odd names', qualifySource('Q1-data', 'A1:C4'), "'Q1-data'!A1:C4")
eq('suggestAnchor: two columns clear of the source', suggestAnchor(parseSourceRef('A1:D6')!), 'F1')

// ---------- reading the source ----------

eq('read: field names', sales.fields, ['Region', 'Product', 'Qty', 'Amount'])
eq('read: data rows', sales.rows.length, 5)
eq('read: first row values', sales.rows[0].map((c) => c.text), ['East', 'Apple', '2', '10'])
eq('read: numbers stay numbers', typeof sales.rows[0][3].value, 'number')
eq('fieldLabel', fieldLabel(sales, 1), 'Product')
eq('fieldLabel: falls back to the column letter', fieldLabel(tableOf([[null, null]], 'A1:B2'), 1), 'Column B')
eq('valueLabel: derived', valueLabel(sales, { col: 3, agg: 'sum' }), 'Sum of Amount')
eq('valueLabel: custom wins', valueLabel(sales, { col: 3, agg: 'sum', label: 'Revenue' }), 'Revenue')

const gappy = tableOf(
  [
    ['Region', 'Amount'],
    ['East', 10],
    [null, null],
    ['West', 5],
  ],
  'A1:B4',
)
eq('read: a wholly blank row is not a data point', gappy.rows.length, 2)

const formatted = tableOf(
  [
    ['Region', 'Amount'],
    ['East', 10],
  ],
  'A1:B2',
  { B2: { format: 'currency', decimals: 2 } },
)
eq('read: column number format is carried over', formatted.formats[1], { format: 'currency', decimals: 2 })
eq('read: unformatted column has no format', formatted.formats[0], undefined)

// ---------- aggregation ----------

const MIXED = [10, '', 'n/a', 5]
eq('agg: sum ignores blanks and text', aggregate(MIXED, 'sum'), 15)
eq('agg: count is non-empty cells', aggregate(MIXED, 'count'), 3)
eq('agg: average over numbers only', aggregate(MIXED, 'average'), 7.5)
eq('agg: min over numbers only', aggregate(MIXED, 'min'), 5)
eq('agg: max over numbers only', aggregate(MIXED, 'max'), 10)
eq('agg: countUnique counts distinct text', aggregate(MIXED, 'countUnique'), 3)
eq('agg: sum of nothing is zero', aggregate(['', ''], 'sum'), 0)
eq('agg: count of nothing is zero', aggregate(['', ''], 'count'), 0)
eq('agg: average of nothing is blank', aggregate(['', 'x'], 'average'), null)
eq('agg: min of nothing is blank', aggregate([''], 'min'), null)
eq('agg: max of nothing is blank', aggregate([''], 'max'), null)
eq('agg: negatives', aggregate([-4, -9, 2], 'min'), -9)
eq('agg: countUnique collapses repeats', aggregate(['a', 'a', 'b'], 'countUnique'), 2)
eq('agg: booleans are counted but not summed', aggregate([true, 4], 'sum'), 4)
eq('agg: booleans count as values', aggregate([true, 4], 'count'), 2)

// ---------- ordering ----------

eq('natural: digits compare numerically', naturalCompare('Week 2', 'Week 10') < 0, true)
eq('natural: plain alphabetical', naturalCompare('apple', 'banana') < 0, true)
eq('natural: case is not what decides the order', naturalCompare('apple', 'Banana') < 0, true)
eq('natural: same word, different case, still a stable order', naturalCompare('Apple', 'apple'), -1)
eq('natural: equal strings', naturalCompare('same', 'same'), 0)
eq('natural: prefix sorts first', naturalCompare('Item', 'Item 2') < 0, true)

const naturalGroups = buildPivot(
  tableOf(
    [
      ['Task', 'Hours'],
      ['Step 10', 1],
      ['Step 2', 1],
      ['Step 1', 1],
    ],
    'A1:B4',
  ),
  spec({ rows: [0], values: [{ col: 1, agg: 'sum' }] }),
)
eq('order: text groups sort naturally', grid(naturalGroups).slice(1).map((r) => r[0]), ['Step 1', 'Step 2', 'Step 10'])

const numericGroups = buildPivot(
  tableOf(
    [
      ['Year', 'Sales'],
      [2026, 1],
      [10, 1],
      [2, 1],
    ],
    'A1:B4',
  ),
  spec({ rows: [0], values: [{ col: 1, agg: 'sum' }] }),
)
// Labels are what the grid shows, thousands separator and all.
eq('order: numeric groups sort numerically', grid(numericGroups).slice(1).map((r) => r[0]), ['2', '10', '2,026'])

const dateGroups = buildPivot(
  tableOf(
    [
      ['Day', 'Sales'],
      ['2026-02-01', 1],
      ['2025-12-31', 1],
      ['2026-01-05', 1],
    ],
    'A1:B4',
  ),
  spec({ rows: [0], values: [{ col: 1, agg: 'sum' }] }),
)
eq('order: date text sorts chronologically', grid(dateGroups).slice(1).map((r) => r[0]), [
  '2025-12-31',
  '2026-01-05',
  '2026-02-01',
])

const blankGroups = buildPivot(
  tableOf(
    [
      ['Region', 'Amount'],
      [null, 3],
      ['West', 5],
      ['East', 2],
    ],
    'A1:B4',
  ),
  spec({ rows: [0], values: [{ col: 1, agg: 'sum' }] }),
)
eq('order: blank group sorts last', grid(blankGroups).slice(1).map((r) => r[0]), ['East', 'West', '(blank)'])
eq('order: blank group still aggregates', grid(blankGroups)[3][1], '3')

// ---------- one row field ----------

const byRegion = buildPivot(sales, spec({ rows: [0], values: [{ col: 3, agg: 'sum' }] }))
eq('rows: no error', byRegion.error, undefined)
eq('rows: size', [byRegion.height, byRegion.width], [4, 2])
eq('rows: group count', byRegion.rowGroups, 3)
eq('rows: header', grid(byRegion)[0], ['Region', 'Sum of Amount'])
eq('rows: body', grid(byRegion).slice(1), [
  ['East', '15'],
  ['North', '20'],
  ['West', '10'],
])
eq('rows: headers are bold', byRegion.cells[0][0].style?.bold, true)
eq('rows: headers carry a fill', typeof byRegion.cells[0][0].style?.fill, 'string')
eq('rows: values are right-aligned', byRegion.cells[1][1].style?.align, 'right')
eq('rows: labels are not right-aligned', byRegion.cells[1][0].style, undefined)

const byRegionTotals = buildPivot(sales, spec({ rows: [0], values: [{ col: 3, agg: 'sum' }], showTotals: true }))
eq('totals: a grand total row is appended', grid(byRegionTotals)[4], ['Grand Total', '45'])
eq('totals: grand total is bold', byRegionTotals.cells[4][1].style?.bold, true)
eq('totals: off by default', grid(byRegion).length, 4)

// ---------- nested row fields ----------

const nested = buildPivot(sales, spec({ rows: [0, 1], values: [{ col: 3, agg: 'sum' }], showTotals: true }))
eq('nested: width makes room for both fields', nested.width, 3)
eq('nested: header names both fields', grid(nested)[0], ['Region', 'Product', 'Sum of Amount'])
eq('nested: groups are nested and sorted', grid(nested).slice(1, 5), [
  ['East', 'Apple', '10'],
  ['East', 'Pear', '5'],
  ['North', 'Pear', '20'],
  ['West', 'Apple', '10'],
])
eq('nested: outer label repeats on every row', grid(nested)[2][0], 'East')
eq('nested: grand total spans the label columns', grid(nested)[5], ['Grand Total', '', '45'])
eq('nested: duplicate row fields are ignored', buildPivot(sales, spec({ rows: [0, 0], values: [{ col: 3, agg: 'sum' }] })).width, 2)

// ---------- row + column matrix ----------

const matrix = buildPivot(sales, spec({ rows: [0], cols: [1], values: [{ col: 3, agg: 'sum' }], showTotals: true }))
eq('matrix: size', [matrix.height, matrix.width], [6, 4])
eq('matrix: column groups', matrix.colGroups, 2)
eq('matrix: column header row', grid(matrix)[0], ['Product', 'Apple', 'Pear', 'Grand Total'])
eq('matrix: row field named under it', grid(matrix)[1][0], 'Region')
eq('matrix: East row', grid(matrix)[2], ['East', '10', '5', '15'])
eq('matrix: a combination with no data stays blank', grid(matrix)[3], ['North', '', '20', '20'])
eq('matrix: West row', grid(matrix)[4], ['West', '10', '', '10'])
eq('matrix: grand total row', grid(matrix)[5], ['Grand Total', '20', '25', '45'])
eq('matrix: a field used for rows is not reused for columns', buildPivot(sales, spec({ rows: [0], cols: [0], values: [{ col: 3, agg: 'sum' }] })).width, 2)

const twoCols = buildPivot(sales, spec({ rows: [0], cols: [1, 2], values: [{ col: 3, agg: 'sum' }] }))
eq('matrix: two column fields stack two header rows', grid(twoCols)[0][0], 'Product')
eq('matrix: inner column field is named too', grid(twoCols)[1][0], 'Qty')
eq('matrix: outer column label written once per span', grid(twoCols)[0].filter((v) => v === 'Apple').length, 1)

// ---------- several value fields ----------

const multi = buildPivot(
  sales,
  spec({
    rows: [0],
    values: [
      { col: 3, agg: 'sum' },
      { col: 2, agg: 'average' },
    ],
  }),
)
eq('values: one column per value field', multi.width, 3)
eq('values: header labels each one', grid(multi)[0], ['Region', 'Sum of Amount', 'Average of Qty'])
eq('values: East', grid(multi)[1], ['East', '15', '1.5'])

const everyAgg = buildPivot(
  sales,
  spec({
    rows: [0],
    values: [
      { col: 3, agg: 'sum' },
      { col: 3, agg: 'count' },
      { col: 3, agg: 'average' },
      { col: 3, agg: 'min' },
      { col: 3, agg: 'max' },
      { col: 1, agg: 'countUnique' },
    ],
  }),
)
eq('aggs: East across every aggregation', grid(everyAgg)[1], ['East', '15', '2', '7.5', '5', '10', '2'])
eq('aggs: North across every aggregation', grid(everyAgg)[2], ['North', '20', '1', '20', '20', '20', '1'])
eq('aggs: West distinct product count', grid(everyAgg)[3][6], '1')

const matrixMulti = buildPivot(
  sales,
  spec({
    rows: [0],
    cols: [1],
    values: [
      { col: 3, agg: 'sum' },
      { col: 2, agg: 'sum' },
    ],
    showTotals: true,
  }),
)
eq('values: matrix width is leaves x values plus totals', matrixMulti.width, 1 + 2 * 2 + 2)
eq('values: a label row appears under the column groups', grid(matrixMulti)[1].slice(1), [
  'Sum of Amount',
  'Sum of Qty',
  'Sum of Amount',
  'Sum of Qty',
  'Sum of Amount',
  'Sum of Qty',
])
eq('values: East across the matrix', grid(matrixMulti)[2], ['East', '10', '2', '5', '1', '15', '3'])

// ---------- messy numeric columns ----------

const messy = tableOf(
  [
    ['Region', 'Amount'],
    ['East', 10],
    ['East', 'pending'],
    ['East', null],
    ['East', 5],
    ['West', 'n/a'],
  ],
  'A1:B6',
)
const messySum = buildPivot(messy, spec({ rows: [0], values: [{ col: 1, agg: 'sum' }], showTotals: true }))
eq('messy: text and blanks do not poison the sum', grid(messySum)[1], ['East', '15'])
eq('messy: an all-text group sums to zero', grid(messySum)[2], ['West', '0'])
eq('messy: grand total ignores them too', grid(messySum)[3], ['Grand Total', '15'])
const messyCount = buildPivot(messy, spec({ rows: [0], values: [{ col: 1, agg: 'count' }] }))
eq('messy: count includes text but not blanks', grid(messyCount)[1], ['East', '3'])
const messyAvg = buildPivot(messy, spec({ rows: [0], values: [{ col: 1, agg: 'average' }] }))
eq('messy: average uses the numbers only', grid(messyAvg)[1], ['East', '7.5'])
eq('messy: average of no numbers is blank, not zero', grid(messyAvg)[2], ['West', ''])

const errorCol = tableOf(
  [
    ['Region', 'Amount'],
    ['East', 10],
    ['East', '=1/0'],
  ],
  'A1:B3',
)
eq('messy: an error cell is skipped', grid(buildPivot(errorCol, spec({ rows: [0], values: [{ col: 1, agg: 'sum' }] })))[1], ['East', '10'])

const floaty = tableOf(
  [
    ['Region', 'Amount'],
    ['East', 0.1],
    ['East', 0.2],
  ],
  'A1:B3',
)
eq('messy: float noise is rounded off', grid(buildPivot(floaty, spec({ rows: [0], values: [{ col: 1, agg: 'sum' }] })))[1], ['East', '0.3'])

// ---------- distinct counts ----------

const visitors = tableOf(
  [
    ['Day', 'User'],
    ['Mon', 'ana'],
    ['Mon', 'ana'],
    ['Mon', 'bo'],
    ['Tue', 'bo'],
  ],
  'A1:B5',
)
const distinct = buildPivot(visitors, spec({ rows: [0], values: [{ col: 1, agg: 'countUnique' }], showTotals: true }))
eq('distinct: per group', grid(distinct).slice(1, 3), [
  ['Mon', '2'],
  ['Tue', '1'],
])
eq('distinct: the grand total is not the sum of the groups', grid(distinct)[3], ['Grand Total', '2'])

// ---------- number formats ----------

const money = tableOf(
  [
    ['Region', 'Amount'],
    ['East', 10],
    ['West', 5],
  ],
  'A1:B3',
  { B2: { format: 'currency', decimals: 0 }, B3: { format: 'currency', decimals: 0 } },
)
const moneyPivot = buildPivot(
  money,
  spec({
    rows: [0],
    values: [
      { col: 1, agg: 'sum' },
      { col: 1, agg: 'count' },
    ],
  }),
)
eq('format: a currency column stays currency', moneyPivot.cells[1][1].style?.format, 'currency')
eq('format: decimals come along', moneyPivot.cells[1][1].style?.decimals, 0)
eq('format: a count of that column is not money', moneyPivot.cells[1][2].style?.format, undefined)
eq('format: counts are still right-aligned', moneyPivot.cells[1][2].style?.align, 'right')
eq('format: the cell reads back the way the grid shows it', pivotCellText(moneyPivot.cells[1][1]), '$10')
eq('format: text passes through untouched', pivotCellText({ v: 'Rent' }), 'Rent')
eq('format: a blank stays blank', pivotCellText({ v: '' }), '')

// ---------- column widths ----------

eq('width: the longest text in each column is measured', byRegion.colTextLen, ['Region'.length, 'Sum of Amount'.length])
const widthSpec = spec({ rows: [0], values: [{ col: 3, agg: 'sum' }] })
const widthSheet: Sheet = { name: 'S', cells: {}, colWidths: {}, rowHeights: {} }
const widths = pivotColWidths(widthSheet, widthSpec, byRegion)
ok('width: a column too narrow for its header is widened', (widths[6] ?? 0) > 100, widths)
eq('width: a column that already fits is left alone', widths[5], undefined)
eq('width: columns outside the block are untouched', widths[9], undefined)
const wideSheet: Sheet = { ...widthSheet, colWidths: { 6: 260 } }
eq('width: a hand-set wider column is kept', pivotColWidths(wideSheet, widthSpec, byRegion)[6], 260)

// ---------- degenerate sources ----------

const emptyBuild = buildPivot(tableOf([[null, null], [null, null]], 'A1:B2'), spec({ rows: [0], values: [{ col: 1, agg: 'sum' }] }))
eq('empty: nothing is built', [emptyBuild.height, emptyBuild.width], [0, 0])
ok('empty: says why', typeof emptyBuild.error === 'string' && emptyBuild.error.length > 0, emptyBuild.error)

const headersOnly = tableOf([['Region', 'Product', 'Amount']], 'A1:C1')
eq('headers only: fields still read', headersOnly.fields, ['Region', 'Product', 'Amount'])
eq('headers only: no data rows', headersOnly.rows.length, 0)
const headersBuild = buildPivot(headersOnly, spec({ rows: [0], values: [{ col: 2, agg: 'sum' }], showTotals: true }))
eq('headers only: header row is still produced', grid(headersBuild)[0], ['Region', 'Sum of Amount'])
eq('headers only: no groups', headersBuild.rowGroups, 0)
// No rows at all reads as blank; a group whose rows held no numbers reads as 0.
eq('headers only: nothing to total', grid(headersBuild)[1], ['Grand Total', ''])

const noValues = buildPivot(sales, spec({ rows: [0], values: [] }))
eq('no value field: nothing is built', noValues.height, 0)
ok('no value field: says why', (noValues.error ?? '').length > 0, noValues.error)
const badValue = buildPivot(sales, spec({ rows: [0], values: [{ col: 9, agg: 'sum' }] }))
eq('out-of-range value field is dropped', badValue.height, 0)
const badRow = buildPivot(sales, spec({ rows: [9], values: [{ col: 3, agg: 'sum' }] }))
eq('out-of-range row field is dropped', grid(badRow)[0], ['Sum of Amount'])
eq('no row field: a single total line', badRow.height, 2)
eq('no row field: the line holds everything', grid(badRow)[1], ['45'])

// ---------- labels that would come back to life as formulas ----------

// The engine treats any raw value opening with '=' as a formula, so a label
// lifted out of the source has to be defused before it is written back.
const injected = tableOf(
  [
    ['="=SUM(A1)"', 'Amount', 'Where'],
    ['="=1+1"', 10, '="=9*9"'],
    ['plain', 5, 'here'],
  ],
  'A1:C3',
)
eq('injection: the source really does display as a formula', injected.rows[0][0].text, '=1+1')
const injBuild = buildPivot(injected, spec({ rows: [0], cols: [2], values: [{ col: 1, agg: 'sum' }] }))
eq('injection: a row label cannot be a formula', grid(injBuild)[2][0], "'=1+1")
eq('injection: a field name cannot be a formula', grid(injBuild)[1][0], "'=SUM(A1)")
eq('injection: a column label cannot be a formula', grid(injBuild)[0][1], "'=9*9")
eq('injection: an ordinary label is left alone', grid(injBuild)[3][0], 'plain')
eq(
  'injection: a custom value label cannot be a formula',
  grid(buildPivot(sales, spec({ rows: [0], values: [{ col: 3, agg: 'sum', label: '=1+1' }] })))[0][1],
  "'=1+1",
)
// The proof that matters: put the block in a sheet and recompute it.
const injSheet = sheetOf([['Region', 'Amount'], ['="=1+1"', 10]])
const injSpec = spec({ rows: [0], values: [{ col: 1, agg: 'sum' }], anchor: 'D1' })
const injPlaced = applyPatch(
  injSheet,
  pivotPatch(injSheet, injSpec, buildPivot(tableOf([['Region', 'Amount'], ['="=1+1"', 10]], 'A1:B2'), injSpec)),
)
eq('injection: the written label stays text once the sheet recomputes', computeSheet(injPlaced).get('D2')?.display, "'=1+1")

// ---------- group keys that are also Object properties ----------

// Groups accumulate in Maps for exactly this reason: keyed on a plain object,
// "__proto__" would not take a value and "constructor" would find a function.
const hostile = buildPivot(
  tableOf(
    [
      ['Key', 'Amount'],
      ['__proto__', 1],
      ['constructor', 2],
      ['toString', 4],
      ['hasOwnProperty', 8],
      ['plain', 16],
    ],
    'A1:B6',
  ),
  spec({ rows: [0], values: [{ col: 1, agg: 'sum' }], showTotals: true }),
)
eq('hostile keys: every one gets its own group', hostile.rowGroups, 5)
eq('hostile keys: each aggregates on its own', grid(hostile).slice(1, 6), [
  ['__proto__', '1'],
  ['constructor', '2'],
  ['hasOwnProperty', '8'],
  ['plain', '16'],
  ['toString', '4'],
])
eq('hostile keys: the grand total is not thrown off', grid(hostile)[6][1], '31')
eq('hostile keys: nothing leaked onto Object.prototype', ({} as Record<string, unknown>).plain, undefined)
const hostileMatrix = buildPivot(
  tableOf(
    [
      ['Key', 'Col', 'Amount'],
      ['__proto__', 'constructor', 1],
      ['__proto__', 'toString', 2],
      ['plain', 'constructor', 4],
    ],
    'A1:C4',
  ),
  spec({ rows: [0], cols: [1], values: [{ col: 2, agg: 'sum' }], showTotals: true }),
)
eq('hostile keys: intersections land in the right cells', grid(hostileMatrix).slice(2), [
  ['__proto__', '1', '2', '3'],
  ['plain', '4', '', '4'],
  ['Grand Total', '5', '2', '7'],
])

// ---------- sizes a mis-selected range can ask for ----------

const bulk: (string | number | null)[][] = [['Region', 'Product', 'Amount']]
for (let i = 0; i < 10000; i++) bulk.push([`R${i % 40}`, `P${i % 6}`, i % 97])
const bulkTable = tableOf(bulk, `A1:C${bulk.length}`)
eq('10k rows: all of them read', bulkTable.rows.length, 10000)
const bulkStart = Date.now()
const bulkBuild = buildPivot(bulkTable, spec({ rows: [0], cols: [1], values: [{ col: 2, agg: 'sum' }], showTotals: true }))
const bulkMs = Date.now() - bulkStart
ok('10k rows: builds without hanging', bulkMs < 5000, bulkMs)
eq('10k rows: 40 groups across 6 columns', [bulkBuild.rowGroups, bulkBuild.colGroups], [40, 6])
eq('10k rows: every row is accounted for', grid(bulkBuild)[bulkBuild.height - 1][7], String(bulk.slice(1).reduce((s, r) => s + (r[2] as number), 0)))

const wide: (string | number | null)[][] = [['R', 'C', 'A']]
for (let i = 0; i < 9000; i++) wide.push([`r${i % 4500}`, `c${i % 180}`, i])
const wideBuild = buildPivot(
  tableOf(wide, `A1:C${wide.length}`),
  spec({
    rows: [0],
    cols: [1],
    values: [
      { col: 2, agg: 'sum' },
      { col: 2, agg: 'count' },
      { col: 2, agg: 'average' },
      { col: 2, agg: 'max' },
    ],
    showTotals: true,
  }),
)
// 4503 x 725 is three million cells — every one of them would be saved into
// the document, and rebuilt on every keystroke of the preview.
ok('huge: a pivot of millions of cells is refused', (wideBuild.error ?? '').includes('too big'), wideBuild.error)
eq('huge: nothing is built', wideBuild.cells.length, 0)

// ---------- degenerate shapes that produce nowhere to write ----------

const cornerOnly = buildPivot(
  tableOf([['Region', 'Amount']], 'A1:B1'),
  spec({ rows: [], cols: [0], values: [{ col: 1, agg: 'sum' }], showTotals: false }),
)
ok('no data rows: grouping only by columns is refused', (cornerOnly.error ?? '').length > 0, cornerOnly.error)
eq('no data rows: a zero-width block is never handed back', cornerOnly.width, 0)
const emptyMatrix = buildPivot(
  tableOf([['Region', 'Product', 'Amount']], 'A1:C1'),
  spec({ rows: [0], cols: [1], values: [{ col: 2, agg: 'sum' }], showTotals: true }),
)
eq('no data rows: the grand total is blank, not zero', grid(emptyMatrix)[2][1], '')

// ---------- placing the block ----------

eq('anchor: a cell reference', anchorValid('H1'), true)
eq('anchor: lowercase is still a cell', anchorValid('h12'), true)
eq('anchor: a range is not a place to start', anchorValid('H1:J4'), false)
eq('anchor: row zero does not exist', anchorValid('A0'), false)
eq('anchor: nonsense', anchorValid('zz'), false)
eq('anchor: empty', anchorValid(''), false)

const target = sheetOf(SALES)
const fresh = spec({ rows: [0], values: [{ col: 3, agg: 'sum' }], showTotals: true, anchor: 'F1' })
const freshBuild = buildPivot(sales, fresh)
eq('place: anchor parses', anchorPos(fresh), { row: 0, col: 5 })
eq('place: rect', pivotRect(fresh, freshBuild), { r0: 0, c0: 5, r1: 4, c1: 6 })
eq('place: clear ground has no conflicts', pivotConflicts(target, fresh, freshBuild), [])
const onTop = { ...fresh, anchor: 'A1' }
ok('place: refuses to sit on existing data', pivotConflicts(target, onTop, buildPivot(sales, onTop)).length > 0)
eq('place: first conflict is named', pivotConflicts(target, onTop, buildPivot(sales, onTop))[0], 'A1')
eq('place: a bad anchor has no rect', pivotRect({ ...fresh, anchor: 'zz' }, freshBuild), null)

const patch = pivotPatch(target, fresh, freshBuild)
eq('patch: writes the header', patch['F1']?.v, 'Region')
eq('patch: writes a value', patch['G2']?.v, '15')
eq('patch: writes the grand total', patch['F5']?.v, 'Grand Total')
eq('patch: stays inside the block', patch['H1'], undefined)

function applyPatch(sheet: Sheet, p: Record<string, Cell | null>): Sheet {
  const cells = { ...sheet.cells }
  for (const [ref, cell] of Object.entries(p)) {
    if (cell === null) delete cells[ref]
    else cells[ref] = cell
  }
  return { ...sheet, cells }
}

const written = applyPatch(target, patch)
eq('refresh: the block is really in the sheet', written.cells['G2']?.v, '15')

// Same pivot, one region gone: the block shrinks and the stale row must go.
const shrunk = tableOf(SALES.filter((r) => r[0] !== 'North'), 'A1:D5')
const refreshed = pivotPatch(written, fresh, buildPivot(shrunk, fresh))
eq('refresh: shrinking clears the row that fell off', refreshed['F5'], null)
eq('refresh: the grand total moves up', refreshed['F4']?.v, 'Grand Total')
eq('refresh: totals recomputed', refreshed['G4']?.v, '25')
const afterRefresh = applyPatch(written, refreshed)
eq('refresh: no stale tail left behind', afterRefresh.cells['F5'], undefined)
eq('refresh: rewriting in place is not a conflict with itself', buildPivot(shrunk, fresh).error, undefined)
eq('refresh: a pivot rewriting its own block is not blocked', refreshConflicts(written, fresh, freshBuild), [])
eq('refresh: shrinking is never blocked', refreshConflicts(written, fresh, buildPivot(shrunk, fresh)), [])

// Two more regions than last time: the block now reaches two rows further down.
const grown = tableOf([...SALES, ['South', 'Pear', 1, 4], ['Mid', 'Apple', 1, 9]], 'A1:D8')
const grownBuild = buildPivot(grown, fresh)
eq('refresh: growing needs two more rows', grownBuild.height, freshBuild.height + 2)
eq('refresh: clear ground below is fine', refreshConflicts(written, fresh, grownBuild), [])
const crowded = applyPatch(written, { F7: { v: 'my notes' } })
eq('refresh: it will not grow across a gap onto someone else', refreshConflicts(crowded, fresh, grownBuild), ['F7'])
// A cell touching the block with no gap counts as part of it — same rule the
// clear-the-old-block scan uses, and the reason to leave a pivot some air.
const touching = applyPatch(written, { F6: { v: 'my notes' } })
eq('refresh: a cell flush against the block is treated as the block', refreshConflicts(touching, fresh, grownBuild), [])

// ...but reading it as part of the block must not mean deleting it. The stale
// tail a refresh clears stops at the first line the pivot did not style.
const notes: Record<string, Cell | null> = {}
for (let r = 6; r <= 300; r++) notes[refToString(5, r)] = { v: `note ${r}` }
const belowNotes = applyPatch(written, notes)
const sameSizePatch = pivotPatch(belowNotes, fresh, freshBuild)
eq('refresh: a column of notes flush below the block survives', sameSizePatch['F7'], undefined)
eq('refresh: and is still there afterwards', applyPatch(belowNotes, sameSizePatch).cells['F250']?.v, 'note 249')
// Shrinking still has to clear its own leftovers, notes or no notes.
const shrunkOverNotes = pivotPatch(belowNotes, fresh, buildPivot(shrunk, fresh))
eq('refresh: the pivot still clears the row it lost', shrunkOverNotes['F5'], null)

// A neighbouring table flush to the right is the same mistake sideways.
const beside: Record<string, Cell | null> = {}
for (let r = 0; r < 5; r++) for (let c = 7; c < 30; c++) beside[refToString(c, r)] = { v: 'theirs' }
const rightNeighbour = applyPatch(written, beside)
const besidePatch = pivotPatch(rightNeighbour, fresh, freshBuild)
eq('refresh: the table next door is not swept up', besidePatch['H1'], undefined)
ok('refresh: the patch stays the size of the pivot', Object.keys(besidePatch).length === 10, Object.keys(besidePatch).length)

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} assertions)`)
if (failed) process.exitCode = 1
else console.log('ALL PIVOT TESTS PASSED')
