import type { Cell, CellStyle, ChartSpec, Sheet, SheetsContent, SheetsTemplate } from '../shared/types'
import { uid } from '../shared/types'

// ============================================================================
// Grid building helpers — mirrors the DSL in sheets.ts so each template reads
// as plain data instead of hand-written A1 string bookkeeping. Duplicated
// locally (not imported) because sheets.ts only exports its template array.
// ============================================================================

type Borders = NonNullable<CellStyle['borders']>

function colLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function ref(c: number, r: number): string {
  return colLetter(c) + r
}

/** Wrap a formula body with the leading '='. */
function f(expr: string): string {
  return '=' + expr
}

class Grid {
  cells: Record<string, Cell> = {}
  colWidths: Record<number, number> = {}
  rowHeights: Record<number, number> = {}
  charts: ChartSpec[] = []

  /** Set (or merge into) a cell's raw value + style. */
  set(c: number, r: number, v: string | number | undefined, style?: CellStyle) {
    const key = ref(c, r)
    const existing = this.cells[key]
    const value = v === undefined ? existing?.v : typeof v === 'number' ? String(v) : v
    let mergedStyle: CellStyle | undefined = existing?.style
    if (style) {
      mergedStyle = { ...existing?.style, ...style }
      if (existing?.style?.borders || style.borders) {
        mergedStyle.borders = { ...existing?.style?.borders, ...style.borders }
      }
    }
    const cell: Cell = {}
    if (value !== undefined) cell.v = value
    if (mergedStyle) cell.style = mergedStyle
    this.cells[key] = cell
  }

  /** Shorthand for set() when a value is always supplied. */
  val(c: number, r: number, v: string | number, style?: CellStyle) {
    this.set(c, r, v, style)
  }

  /** Style-only update — never touches the existing value. */
  style(c: number, r: number, style: CellStyle) {
    this.set(c, r, undefined, style)
  }

  border(c: number, r: number, sides: Borders) {
    this.style(c, r, { borders: sides })
  }

  hline(r: number, c1: number, c2: number, side: 'top' | 'bottom') {
    for (let c = c1; c <= c2; c++) this.border(c, r, side === 'top' ? { top: true } : { bottom: true })
  }

  vline(c: number, r1: number, r2: number, side: 'left' | 'right') {
    for (let r = r1; r <= r2; r++) this.border(c, r, side === 'left' ? { left: true } : { right: true })
  }

  /** Outline the perimeter of a table block. */
  box(c1: number, r1: number, c2: number, r2: number) {
    this.hline(r1, c1, c2, 'top')
    this.hline(r2, c1, c2, 'bottom')
    this.vline(c1, r1, r2, 'left')
    this.vline(c2, r1, r2, 'right')
  }

  /** Bold white-on-accent header row. */
  headerRow(r: number, c1: number, labels: string[], accent: string, align: 'left' | 'center' = 'center') {
    labels.forEach((label, i) => {
      this.set(c1 + i, r, label, {
        bold: true,
        color: '#ffffff',
        fill: accent,
        align: i === 0 ? 'left' : align,
        borders: { bottom: true },
      })
    })
  }

  sheet(name: string): Sheet {
    return {
      name,
      cells: this.cells,
      colWidths: this.colWidths,
      rowHeights: this.rowHeights,
      ...(this.charts.length ? { charts: this.charts } : {}),
    }
  }
}

const TITLE: CellStyle = { bold: true, fontSize: 20 }
const SUBTITLE: CellStyle = { color: '#6b7280', fontSize: 12 }

/**
 * Sheet.rowHeights is keyed by the 0-based row index the engine uses
 * internally (parseCellRef("A5") -> row 4), but every template addresses
 * rows with the 1-based number that appears in the A1 ref (the `r` passed to
 * g.val/g.set) — hence the -1 here. colWidths needs no such adjustment
 * because the `c` column index is already 0-based on both sides.
 */
function setRowHeight(g: Grid, displayRow: number, px: number) {
  g.rowHeights[displayRow - 1] = px
}

/** A soft-filled banner label spanning a couple of columns (section header). */
function sectionBanner(g: Grid, row: number, c1: number, c2: number, label: string, soft: string, softText: string) {
  for (let c = c1; c <= c2; c++) g.style(c, row, { fill: soft })
  g.val(c1, row, label, { bold: true, fill: soft, color: softText })
}

interface KpiCard {
  label: string
  /** Starting (leftmost) column of the card. */
  col: number
  /** How many columns wide the card's fill block is. */
  span: number
  /** Full formula string, including the leading '='. */
  formula: string
  format: 'currency' | 'percent' | 'number'
  decimals?: number
}

/** 2-3 side-by-side "big number" summary cards: a small label row over a big value row. */
function kpiCards(g: Grid, accent: string, labelRow: number, valueRow: number, cards: KpiCard[]) {
  setRowHeight(g, labelRow, 20)
  setRowHeight(g, valueRow, 38)
  for (const card of cards) {
    for (let i = 0; i < card.span; i++) {
      g.style(card.col + i, labelRow, { fill: accent })
      g.style(card.col + i, valueRow, { fill: accent })
    }
    g.val(card.col, labelRow, card.label, {
      bold: true,
      color: '#ffffff',
      fill: accent,
      fontSize: 10,
    })
    g.val(card.col, valueRow, card.formula, {
      bold: true,
      color: '#ffffff',
      fill: accent,
      fontSize: 22,
      format: card.format,
      decimals: card.decimals,
    })
  }
}

// ============================================================================
// 1. Net worth tracker
// ============================================================================

function makeNetWorthTracker(): SheetsContent {
  const accent = '#1e293b'
  const soft = '#e2e8f0'
  const softText = '#1e293b'
  const zebra = '#f8fafc'
  const g = new Grid()
  g.colWidths = { 0: 190, 1: 110, 2: 20, 3: 150, 4: 110, 5: 20, 6: 150, 7: 110 }

  g.val(0, 1, 'Net Worth Tracker', TITLE)
  g.val(0, 2, 'Personal balance sheet — [Month] [Year]', SUBTITLE)

  kpiCards(g, accent, 4, 5, [
    { label: 'TOTAL ASSETS', col: 0, span: 2, formula: f('B17'), format: 'currency', decimals: 0 },
    { label: 'TOTAL LIABILITIES', col: 3, span: 2, formula: f('E15'), format: 'currency', decimals: 0 },
    { label: 'NET WORTH', col: 6, span: 2, formula: f('B17-E15'), format: 'currency', decimals: 0 },
  ])

  sectionBanner(g, 8, 0, 1, 'Assets', soft, softText)
  sectionBanner(g, 8, 3, 4, 'Liabilities', soft, softText)
  g.headerRow(9, 0, ['Item', 'Value'], accent)
  g.headerRow(9, 3, ['Item', 'Value'], accent)

  const assets: [string, number][] = [
    ['Checking account', 2400],
    ['Savings account', 8600],
    ['Brokerage account', 15200],
    ['Retirement (401k)', 42500],
    ['Home value', 380000],
    ['Vehicles', 14000],
    ['Other assets', 1800],
  ]
  assets.forEach(([name, value], i) => {
    const r = 10 + i
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(0, r, name, zebraStyle)
    g.val(1, r, value, { ...zebraStyle, format: 'currency' })
  })
  g.val(0, 17, 'Total assets', { bold: true, borders: { top: true } })
  g.val(1, 17, f('SUM(B10:B16)'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(0, 9, 1, 17)

  const liabilities: [string, number][] = [
    ['Credit cards', 3200],
    ['Student loans', 18500],
    ['Auto loan', 9800],
    ['Mortgage balance', 265000],
    ['Other debts', 1200],
  ]
  liabilities.forEach(([name, value], i) => {
    const r = 10 + i
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(3, r, name, zebraStyle)
    g.val(4, r, value, { ...zebraStyle, format: 'currency' })
  })
  g.val(3, 15, 'Total liabilities', { bold: true, borders: { top: true } })
  g.val(4, 15, f('SUM(E10:E14)'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(3, 9, 4, 15)

  g.charts.push({
    id: uid(),
    type: 'pie',
    title: 'Asset allocation',
    labelRange: 'A10:A16',
    dataRanges: ['B10:B16'],
    x: 930,
    y: 100,
    w: 380,
    h: 320,
  })

  return { sheets: [g.sheet('Net Worth')], active: 0 }
}

// ============================================================================
// 2. Cash flow forecast
// ============================================================================

function makeCashFlowForecast(): SheetsContent {
  const accent = '#0369a1'
  const soft = '#e0f2fe'
  const softText = '#075985'
  const zebra = '#f0f9ff'
  const g = new Grid()
  g.colWidths = { 0: 210, 1: 110, 2: 110, 3: 120, 4: 130, 5: 110 }

  g.val(0, 1, 'Cash Flow Forecast', TITLE)
  g.val(0, 2, '12-month projection — [Company Name]', SUBTITLE)

  sectionBanner(g, 4, 0, 1, 'Assumptions', soft, softText)
  g.val(0, 5, 'Starting cash balance')
  g.val(1, 5, 18000, { format: 'currency', bold: true })

  kpiCards(g, accent, 7, 8, [
    { label: 'STARTING CASH', col: 0, span: 2, formula: f('B5'), format: 'currency', decimals: 0 },
    { label: 'TOTAL NET CASH FLOW', col: 2, span: 2, formula: f('D23'), format: 'currency', decimals: 0 },
    { label: 'ENDING CASH BALANCE', col: 4, span: 2, formula: f('E22'), format: 'currency', decimals: 0 },
  ])

  g.headerRow(10, 0, ['Month', 'Cash in', 'Cash out', 'Net cash flow', 'Running balance'], accent)

  const months: [string, number, number][] = [
    ['Aug 2026', 24000, 19500],
    ['Sep 2026', 25500, 20200],
    ['Oct 2026', 26800, 21000],
    ['Nov 2026', 31000, 24500],
    ['Dec 2026', 34500, 27000],
    ['Jan 2027', 21000, 19800],
    ['Feb 2027', 22500, 19900],
    ['Mar 2027', 24800, 20500],
    ['Apr 2027', 26200, 21200],
    ['May 2027', 27500, 21800],
    ['Jun 2027', 28800, 22400],
    ['Jul 2027', 30200, 23100],
  ]
  months.forEach(([month, cashIn, cashOut], i) => {
    const r = 11 + i
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(0, r, month, zebraStyle)
    g.val(1, r, cashIn, { ...zebraStyle, format: 'currency' })
    g.val(2, r, cashOut, { ...zebraStyle, format: 'currency' })
    g.val(3, r, f(`B${r}-C${r}`), { ...zebraStyle, format: 'currency' })
    g.val(4, r, i === 0 ? f(`$B$5+D${r}`) : f(`E${r - 1}+D${r}`), { ...zebraStyle, format: 'currency' })
  })
  g.val(0, 23, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 23, f('SUM(B11:B22)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(2, 23, f('SUM(C11:C22)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(3, 23, f('SUM(D11:D22)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(4, 23, f('E22'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(0, 10, 4, 23)

  g.charts.push({
    id: uid(),
    type: 'line',
    title: 'Running cash balance',
    labelRange: 'A11:A22',
    dataRanges: ['E11:E22'],
    seriesNames: ['Running balance'],
    x: 860,
    y: 90,
    w: 440,
    h: 340,
  })

  return { sheets: [g.sheet('Cash Flow')], active: 0 }
}

// ============================================================================
// 3. Startup runway calculator
// ============================================================================

function makeStartupRunway(): SheetsContent {
  const accent = '#4338ca'
  const soft = '#e0e7ff'
  const softText = '#3730a3'
  const zebra = '#eef2ff'
  const g = new Grid()
  g.colWidths = { 0: 170, 1: 110, 2: 110, 3: 110, 4: 130, 5: 110 }

  g.val(0, 1, 'Startup Runway', TITLE)
  g.val(0, 2, 'Cash runway projection — [Company Name]', SUBTITLE)

  sectionBanner(g, 4, 0, 1, 'Assumptions', soft, softText)
  g.val(0, 5, 'Starting cash balance')
  g.val(1, 5, 750000, { format: 'currency', bold: true })
  g.val(0, 6, 'Monthly revenue')
  g.val(1, 6, 18000, { format: 'currency' })
  g.val(0, 7, 'Monthly operating expenses')
  g.val(1, 7, 62000, { format: 'currency' })
  g.val(0, 8, 'Monthly burn rate (net)', { bold: true, borders: { top: true } })
  g.val(1, 8, f('B7-B6'), { bold: true, format: 'currency', borders: { top: true } })

  kpiCards(g, accent, 10, 11, [
    { label: 'STARTING CASH', col: 0, span: 2, formula: f('B5'), format: 'currency', decimals: 0 },
    { label: 'MONTHLY BURN RATE', col: 2, span: 2, formula: f('B8'), format: 'currency', decimals: 0 },
    { label: 'RUNWAY (MONTHS)', col: 4, span: 2, formula: f('ROUNDDOWN(B5/B8,1)'), format: 'number', decimals: 1 },
  ])

  g.headerRow(13, 0, ['Month', 'Revenue', 'Expenses', 'Net burn', 'Cash balance'], accent)

  for (let i = 0; i < 12; i++) {
    const r = 14 + i
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(0, r, `Month ${i + 1}`, zebraStyle)
    g.val(1, r, i === 0 ? f('$B$6') : f(`B${r - 1}*1.04`), { ...zebraStyle, format: 'currency' })
    g.val(2, r, i === 0 ? f('$B$7') : f(`C${r - 1}*1.01`), { ...zebraStyle, format: 'currency' })
    g.val(3, r, f(`C${r}-B${r}`), { ...zebraStyle, format: 'currency' })
    g.val(4, r, i === 0 ? f(`$B$5-D${r}`) : f(`E${r - 1}-D${r}`), { ...zebraStyle, format: 'currency' })
  }
  g.box(0, 13, 4, 25)

  g.val(0, 27, 'Cash balance after 12 months', { bold: true })
  g.val(1, 27, f('E25'), { bold: true, format: 'currency' })

  g.charts.push({
    id: uid(),
    type: 'line',
    title: 'Projected cash balance',
    labelRange: 'A14:A25',
    dataRanges: ['E14:E25'],
    seriesNames: ['Cash balance'],
    x: 810,
    y: 90,
    w: 440,
    h: 340,
  })

  return { sheets: [g.sheet('Runway')], active: 0 }
}

// ============================================================================
// 4. Pricing calculator
// ============================================================================

function makePricingCalculator(): SheetsContent {
  const accent = '#c2410c'
  const soft = '#ffedd5'
  const softText = '#7c2d12'
  const zebra = '#fff7ed'
  const g = new Grid()
  g.colWidths = { 0: 210, 1: 110, 2: 110, 3: 110, 4: 100, 5: 100 }

  g.val(0, 1, 'Pricing Calculator', TITLE)
  g.val(0, 2, 'Cost-plus pricing for [Product or Service Name]', SUBTITLE)

  sectionBanner(g, 4, 0, 1, 'Cost inputs', soft, softText)
  g.val(0, 5, 'Unit cost (materials + labor)')
  g.val(1, 5, 18.5, { format: 'currency', bold: true })
  g.val(0, 6, 'Overhead allocation per unit')
  g.val(1, 6, 3.25, { format: 'currency', bold: true })
  g.val(0, 7, 'Total cost per unit', { bold: true, borders: { top: true } })
  g.val(1, 7, f('B5+B6'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(0, 8, 'Target margin %')
  g.val(1, 8, 0.45, { format: 'percent', bold: true })

  kpiCards(g, accent, 10, 11, [
    { label: 'COST PER UNIT', col: 0, span: 2, formula: f('B7'), format: 'currency', decimals: 2 },
    { label: 'TARGET MARGIN', col: 2, span: 2, formula: f('B8'), format: 'percent', decimals: 0 },
    { label: 'SUGGESTED PRICE', col: 4, span: 2, formula: f('B7/(1-B8)'), format: 'currency', decimals: 2 },
  ])

  g.headerRow(13, 0, ['Tier', 'Price', 'Cost', 'Margin $', 'Margin %'], accent)
  const tiers: [string, string][] = [
    ['Starter', '$E$11*0.85'],
    ['Standard', '$E$11'],
    ['Premium', '$E$11*1.25'],
  ]
  tiers.forEach(([name, priceExpr], i) => {
    const r = 14 + i
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(0, r, name, zebraStyle)
    g.val(1, r, f(priceExpr), { ...zebraStyle, format: 'currency' })
    g.val(2, r, f('$B$7'), { ...zebraStyle, format: 'currency' })
    g.val(3, r, f(`B${r}-C${r}`), { ...zebraStyle, format: 'currency' })
    g.val(4, r, f(`D${r}/B${r}`), { ...zebraStyle, format: 'percent' })
  })
  g.box(0, 13, 4, 16)

  g.charts.push({
    id: uid(),
    type: 'bar',
    title: 'Price by tier',
    labelRange: 'A14:A16',
    dataRanges: ['B14:B16', 'C14:C16'],
    seriesNames: ['Price', 'Cost'],
    x: 810,
    y: 90,
    w: 380,
    h: 280,
  })

  return { sheets: [g.sheet('Pricing')], active: 0 }
}

// ============================================================================
// 5. Timesheet
// ============================================================================

function makeTimesheet(): SheetsContent {
  const accent = '#0e7490'
  const soft = '#cffafe'
  const softText = '#164e63'
  const zebra = '#ecfeff'
  const g = new Grid()
  g.colWidths = { 0: 110, 1: 110, 2: 110, 3: 130, 4: 110, 5: 100, 6: 110 }

  g.val(0, 1, 'Timesheet', TITLE)
  g.val(0, 2, 'Pay period: [Start date] – [End date] · [Employee name]', SUBTITLE)

  sectionBanner(g, 4, 0, 1, 'Pay settings', soft, softText)
  g.val(0, 5, 'Hourly rate')
  g.val(1, 5, 24.5, { format: 'currency', bold: true })
  g.val(0, 6, 'Overtime multiplier')
  g.val(1, 6, 1.5, { format: 'number', decimals: 2, bold: true })

  kpiCards(g, accent, 8, 9, [
    { label: 'TOTAL HOURS', col: 0, span: 2, formula: f('C19'), format: 'number', decimals: 1 },
    { label: 'OVERTIME HOURS', col: 2, span: 2, formula: f('F19'), format: 'number', decimals: 1 },
    { label: 'GROSS PAY', col: 4, span: 2, formula: f('G19'), format: 'currency', decimals: 2 },
  ])

  g.headerRow(11, 0, ['Day', 'Date', 'Hours', 'Cumulative', 'Regular', 'Overtime', 'Daily pay'], accent)

  const days: [string, string, number][] = [
    ['Mon', 'Aug 3', 8],
    ['Tue', 'Aug 4', 8],
    ['Wed', 'Aug 5', 8.5],
    ['Thu', 'Aug 6', 9],
    ['Fri', 'Aug 7', 8],
    ['Sat', 'Aug 8', 4],
    ['Sun', 'Aug 9', 0],
  ]
  days.forEach(([day, date, hours], i) => {
    const r = 12 + i
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(0, r, day, zebraStyle)
    g.val(1, r, date, zebraStyle)
    g.val(2, r, hours, { ...zebraStyle, format: 'number', decimals: 1, align: 'center' })
    g.val(3, r, i === 0 ? f(`C${r}`) : f(`D${r - 1}+C${r}`), { ...zebraStyle, format: 'number', decimals: 1 })
    g.val(
      4,
      r,
      i === 0 ? f(`MIN(C${r},40)`) : f(`MAX(0,MIN(D${r},40)-MIN(D${r - 1},40))`),
      { ...zebraStyle, format: 'number', decimals: 1 },
    )
    g.val(5, r, f(`IF(C${r}>E${r},C${r}-E${r},0)`), { ...zebraStyle, format: 'number', decimals: 1 })
    g.val(6, r, f(`E${r}*$B$5+F${r}*$B$5*$B$6`), { ...zebraStyle, format: 'currency' })
  })
  g.val(0, 19, 'Weekly total', { bold: true, borders: { top: true } })
  g.style(1, 19, { borders: { top: true } })
  g.val(2, 19, f('SUM(C12:C18)'), { bold: true, format: 'number', decimals: 1, borders: { top: true } })
  g.style(3, 19, { borders: { top: true } })
  g.val(4, 19, f('SUM(E12:E18)'), { bold: true, format: 'number', decimals: 1, borders: { top: true } })
  g.val(5, 19, f('SUM(F12:F18)'), { bold: true, format: 'number', decimals: 1, borders: { top: true } })
  g.val(6, 19, f('SUM(G12:G18)'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(0, 11, 6, 19)

  return { sheets: [g.sheet('Timesheet')], active: 0 }
}

// ============================================================================
// 6. Break-even analysis
// ============================================================================

function makeBreakEvenAnalysis(): SheetsContent {
  const accent = '#be123c'
  const soft = '#ffe4e6'
  const softText = '#881337'
  const zebra = '#fff1f2'
  const g = new Grid()
  g.colWidths = { 0: 220, 1: 110, 2: 120, 3: 110, 4: 120, 5: 110 }

  g.val(0, 1, 'Break-Even Analysis', TITLE)
  g.val(0, 2, '[Product or service name] — unit economics', SUBTITLE)

  sectionBanner(g, 4, 0, 1, 'Inputs', soft, softText)
  g.val(0, 5, 'Fixed costs (monthly)')
  g.val(1, 5, 12000, { format: 'currency', bold: true })
  g.val(0, 6, 'Variable cost per unit')
  g.val(1, 6, 18, { format: 'currency', bold: true })
  g.val(0, 7, 'Price per unit')
  g.val(1, 7, 45, { format: 'currency', bold: true })
  g.val(0, 8, 'Contribution margin per unit', { bold: true, borders: { top: true } })
  g.val(1, 8, f('B7-B6'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(0, 9, 'Contribution margin %')
  g.val(1, 9, f('B8/B7'), { format: 'percent' })

  kpiCards(g, accent, 11, 12, [
    { label: 'BREAK-EVEN UNITS', col: 0, span: 2, formula: f('ROUNDUP(B5/B8,0)'), format: 'number', decimals: 0 },
    { label: 'BREAK-EVEN REVENUE', col: 2, span: 2, formula: f('B5/B8*B7'), format: 'currency', decimals: 0 },
    { label: 'CONTRIBUTION MARGIN %', col: 4, span: 2, formula: f('B9'), format: 'percent', decimals: 0 },
  ])

  g.headerRow(14, 0, ['Units sold', 'Revenue', 'Variable cost', 'Total cost', 'Profit / (Loss)'], accent)
  for (let i = 0; i < 13; i++) {
    const r = 15 + i
    const units = i * 50
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(0, r, units, { ...zebraStyle, format: 'number', decimals: 0 })
    g.val(1, r, f(`A${r}*$B$7`), { ...zebraStyle, format: 'currency' })
    g.val(2, r, f(`A${r}*$B$6`), { ...zebraStyle, format: 'currency' })
    g.val(3, r, f(`$B$5+C${r}`), { ...zebraStyle, format: 'currency' })
    g.val(4, r, f(`B${r}-D${r}`), { ...zebraStyle, format: 'currency' })
  }
  g.box(0, 14, 4, 27)

  g.charts.push({
    id: uid(),
    type: 'bar',
    title: 'Revenue vs. total cost by volume',
    labelRange: 'A15:A27',
    dataRanges: ['B15:B27', 'D15:D27'],
    seriesNames: ['Revenue', 'Total cost'],
    x: 860,
    y: 90,
    w: 460,
    h: 360,
  })

  return { sheets: [g.sheet('Break-Even')], active: 0 }
}

// ============================================================================
// 7. Debt payoff planner
// ============================================================================

function makeDebtPayoffPlanner(): SheetsContent {
  const accent = '#15803d'
  const soft = '#dcfce7'
  const softText = '#14532d'
  const zebra = '#f0fdf4'
  const g = new Grid()
  g.colWidths = { 0: 220, 1: 120, 2: 120, 3: 100, 4: 110, 5: 100, 6: 100 }

  g.val(0, 1, 'Debt Payoff Planner', TITLE)
  g.val(0, 2, 'Avalanche method — highest interest rate first', SUBTITLE)

  kpiCards(g, accent, 4, 5, [
    { label: 'TOTAL DEBT', col: 0, span: 2, formula: f('C14'), format: 'currency', decimals: 0 },
    { label: 'MONTHLY MIN. PAYMENTS', col: 2, span: 2, formula: f('E14'), format: 'currency', decimals: 0 },
    { label: 'OVERALL PROGRESS', col: 4, span: 3, formula: f('G14'), format: 'percent', decimals: 0 },
  ])

  g.headerRow(
    8,
    0,
    ['Debt', 'Starting balance', 'Current balance', 'Interest rate', 'Min payment', 'Payoff order', 'Progress %'],
    accent,
  )

  const debts: [string, number, number, number, number][] = [
    ['Credit card — Visa', 6200, 4350, 0.2299, 150],
    ['Credit card — Store card', 1800, 900, 0.2699, 60],
    ['Auto loan', 14500, 11200, 0.0649, 320],
    ['Student loan', 22000, 19800, 0.0549, 230],
    ['Personal loan', 5000, 3100, 0.1099, 140],
  ]
  debts.forEach(([name, start, current, rate, minPay], i) => {
    const r = 9 + i
    const zebraStyle = i % 2 === 1 ? { fill: zebra } : undefined
    g.val(0, r, name, zebraStyle)
    g.val(1, r, start, { ...zebraStyle, format: 'currency' })
    g.val(2, r, current, { ...zebraStyle, format: 'currency' })
    g.val(3, r, rate, { ...zebraStyle, format: 'percent', decimals: 2 })
    g.val(4, r, minPay, { ...zebraStyle, format: 'currency' })
    g.val(5, r, f(`COUNTIF($D$9:$D$13,">"&D${r})+1`), { ...zebraStyle, align: 'center' })
    g.val(6, r, f(`(B${r}-C${r})/B${r}`), { ...zebraStyle, format: 'percent' })
  })
  g.val(0, 14, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 14, f('SUM(B9:B13)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(2, 14, f('SUM(C9:C13)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(3, 14, f('AVERAGE(D9:D13)'), { bold: true, format: 'percent', decimals: 2, borders: { top: true } })
  g.val(4, 14, f('SUM(E9:E13)'), { bold: true, format: 'currency', borders: { top: true } })
  g.style(5, 14, { borders: { top: true } })
  g.val(6, 14, f('(B14-C14)/B14'), { bold: true, format: 'percent', borders: { top: true } })
  g.box(0, 8, 6, 14)

  g.charts.push({
    id: uid(),
    type: 'bar',
    title: 'Remaining balance by debt',
    labelRange: 'A9:A13',
    dataRanges: ['C9:C13'],
    seriesNames: ['Current balance'],
    x: 940,
    y: 90,
    w: 380,
    h: 300,
  })

  return { sheets: [g.sheet('Debt Payoff')], active: 0 }
}

// ============================================================================
// Template registry
// ============================================================================

export const sheetsFinanceTemplates: SheetsTemplate[] = [
  {
    id: 'net-worth-tracker',
    name: 'Net worth tracker',
    description: 'Track assets against liabilities and watch your net worth update automatically as you go.',
    category: 'Finance',
    accent: '#1e293b',
    glyph: '⚖️',
    make: makeNetWorthTracker,
  },
  {
    id: 'cash-flow-forecast',
    name: 'Cash flow forecast',
    description: 'Project 12 months of cash in, cash out, and running balance so you never get caught short.',
    category: 'Finance',
    accent: '#0369a1',
    glyph: '💵',
    make: makeCashFlowForecast,
  },
  {
    id: 'startup-runway',
    name: 'Startup runway calculator',
    description: 'Turn burn rate into a clear runway estimate so you know exactly how many months of cash remain.',
    category: 'Business',
    accent: '#4338ca',
    glyph: '🚀',
    make: makeStartupRunway,
  },
  {
    id: 'pricing-calculator',
    name: 'Pricing calculator',
    description: 'Turn unit cost and target margin into ready-to-quote Good, Better, Best pricing tiers.',
    category: 'Business',
    accent: '#c2410c',
    glyph: '🏷️',
    make: makePricingCalculator,
  },
  {
    id: 'timesheet',
    name: 'Timesheet',
    description: 'Log daily hours and let regular pay, overtime, and weekly totals calculate themselves.',
    category: 'Business',
    accent: '#0e7490',
    glyph: '⏱️',
    make: makeTimesheet,
  },
  {
    id: 'break-even-analysis',
    name: 'Break-even analysis',
    description: 'Find the exact sales volume where revenue covers costs, with a live break-even chart.',
    category: 'Business',
    accent: '#be123c',
    glyph: '📐',
    make: makeBreakEvenAnalysis,
  },
  {
    id: 'debt-payoff-planner',
    name: 'Debt payoff planner',
    description: 'Rank debts by interest rate and track payoff progress toward becoming debt-free.',
    category: 'Finance',
    accent: '#15803d',
    glyph: '💳',
    make: makeDebtPayoffPlanner,
  },
]
