import type { Cell, CellStyle, ChartSpec, Sheet, SheetsContent, SheetsTemplate } from '../shared/types'
import { uid } from '../shared/types'

// ============================================================================
// Grid building helpers — a small DSL so each template reads as plain data
// instead of hand-written A1 string bookkeeping.
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

  /** Lay a row of values out starting at (startCol, r). */
  row(r: number, startCol: number, values: (string | number)[], style?: CellStyle) {
    values.forEach((v, i) => this.set(startCol + i, r, v, style))
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

  fillRow(r: number, c1: number, c2: number, fill: string) {
    for (let c = c1; c <= c2; c++) this.style(c, r, { fill })
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

// ============================================================================
// 1. Monthly budget
// ============================================================================

function makeMonthlyBudget(): SheetsContent {
  const accent = '#2563eb'
  const soft = '#dbeafe'
  const softText = '#1e3a8a'
  const g = new Grid()
  g.colWidths = { 0: 190, 1: 110, 2: 110, 3: 110, 4: 100 }

  g.val(0, 1, 'Monthly Budget', TITLE)
  g.val(0, 2, 'August 2026', SUBTITLE)

  g.headerRow(4, 0, ['Category', 'Budgeted', 'Actual', 'Difference', '% used'], accent)

  g.val(0, 5, 'Income', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 4; c++) g.style(c, 5, { fill: soft })

  const income: [string, number, number][] = [
    ['Salary', 4200, 4200],
    ['Freelance', 600, 750],
    ['Other income', 100, 60],
  ]
  income.forEach(([name, budget, actual], i) => {
    const r = 6 + i
    const zebra = i % 2 === 1 ? { fill: '#f9fafb' } : undefined
    g.val(0, r, name, zebra)
    g.val(1, r, budget, { ...zebra, format: 'currency' })
    g.val(2, r, actual, { ...zebra, format: 'currency' })
    g.val(3, r, f(`C${r}-B${r}`), { ...zebra, format: 'currency' })
    g.val(4, r, f(`C${r}/B${r}`), { ...zebra, format: 'percent' })
  })
  const incTotal = 9
  g.val(0, incTotal, 'Total income', { bold: true, borders: { top: true } })
  g.val(1, incTotal, f('SUM(B6:B8)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(2, incTotal, f('SUM(C6:C8)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(3, incTotal, f(`C${incTotal}-B${incTotal}`), { bold: true, format: 'currency', borders: { top: true } })
  g.val(4, incTotal, f(`C${incTotal}/B${incTotal}`), { bold: true, format: 'percent', borders: { top: true } })
  g.box(0, 4, 4, incTotal)

  g.val(0, 11, 'Expenses', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 4; c++) g.style(c, 11, { fill: soft })

  const expenses: [string, number, number][] = [
    ['Rent', 1500, 1500],
    ['Utilities', 180, 210],
    ['Groceries', 500, 540],
    ['Transportation', 220, 190],
    ['Insurance', 150, 150],
    ['Subscriptions', 45, 52],
    ['Entertainment', 150, 175],
    ['Savings & investing', 500, 500],
  ]
  expenses.forEach(([name, budget, actual], i) => {
    const r = 12 + i
    const zebra = i % 2 === 1 ? { fill: '#f9fafb' } : undefined
    g.val(0, r, name, zebra)
    g.val(1, r, budget, { ...zebra, format: 'currency' })
    g.val(2, r, actual, { ...zebra, format: 'currency' })
    g.val(3, r, f(`C${r}-B${r}`), { ...zebra, format: 'currency' })
    g.val(4, r, f(`C${r}/B${r}`), { ...zebra, format: 'percent' })
  })
  const expTotal = 20
  g.val(0, expTotal, 'Total expenses', { bold: true, borders: { top: true } })
  g.val(1, expTotal, f('SUM(B12:B19)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(2, expTotal, f('SUM(C12:C19)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(3, expTotal, f(`C${expTotal}-B${expTotal}`), { bold: true, format: 'currency', borders: { top: true } })
  g.val(4, expTotal, f(`C${expTotal}/B${expTotal}`), { bold: true, format: 'percent', borders: { top: true } })
  g.box(0, 11, 4, expTotal)

  g.val(0, 22, 'Summary', { bold: true, fill: soft, color: softText })
  g.style(1, 22, { fill: soft })
  g.val(0, 23, 'Total income')
  g.val(1, 23, f('C9'), { format: 'currency' })
  g.val(0, 24, 'Total expenses')
  g.val(1, 24, f('C20'), { format: 'currency' })
  g.val(0, 25, 'Remaining', { bold: true, borders: { top: true } })
  g.val(1, 25, f('B23-B24'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(0, 26, '% of income spent')
  g.val(1, 26, f('B24/B23'), { format: 'percent' })
  g.box(0, 22, 1, 26)

  return { sheets: [g.sheet('Budget')], active: 0 }
}

// ============================================================================
// 2. Invoice
// ============================================================================

function makeInvoice(): SheetsContent {
  const accent = '#4f46e5'
  const soft = '#e0e7ff'
  const softText = '#3730a3'
  const g = new Grid()
  g.colWidths = { 0: 230, 1: 60, 2: 110, 3: 110 }

  g.val(0, 1, 'INVOICE', { bold: true, fontSize: 26, color: accent })

  g.val(0, 2, 'Anleo Design Co.', { bold: true, fontSize: 13 })
  g.val(2, 2, 'Invoice #', { color: '#6b7280', align: 'right' })
  g.val(3, 2, 'INV-1042')
  g.val(0, 3, '482 Market Street')
  g.val(2, 3, 'Date', { color: '#6b7280', align: 'right' })
  g.val(3, 3, f('TODAY()'), { format: 'date' })
  g.val(0, 4, 'San Francisco, CA 94105')
  g.val(2, 4, 'Due date', { color: '#6b7280', align: 'right' })
  g.val(3, 4, '2026-08-21', { format: 'date' })
  g.val(0, 5, 'hello@anleodesign.com')
  g.val(2, 5, 'Terms', { color: '#6b7280', align: 'right' })
  g.val(3, 5, 'Net 15')

  g.val(0, 7, 'Bill to', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 3; c++) g.style(c, 7, { fill: soft })
  g.val(0, 8, 'Northwind Traders', { bold: true })
  g.val(0, 9, '220 Harbor Blvd, Suite 300')
  g.val(0, 10, 'Oakland, CA 94612')

  g.headerRow(12, 0, ['Description', 'Qty', 'Unit price', 'Amount'], accent)
  const items: [string, number, number][] = [
    ['Website design', 1, 2400],
    ['Logo & branding', 1, 850],
    ['Hosting setup (hrs)', 4, 75],
    ['Content migration', 6, 60],
    ['Rush delivery fee', 1, 150],
  ]
  items.forEach(([desc, qty, price], i) => {
    const r = 13 + i
    const zebra = i % 2 === 1 ? { fill: '#f9fafb' } : undefined
    g.val(0, r, desc, zebra)
    g.val(1, r, qty, { ...zebra, align: 'center' })
    g.val(2, r, price, { ...zebra, format: 'currency', align: 'right' })
    g.val(3, r, f(`B${r}*C${r}`), { ...zebra, format: 'currency', align: 'right' })
  })
  g.box(0, 12, 3, 17)

  g.val(2, 19, 'Subtotal', { align: 'right', color: '#6b7280' })
  g.val(3, 19, f('SUM(D13:D17)'), { format: 'currency', align: 'right' })
  g.val(2, 20, 'Tax rate', { align: 'right', color: '#6b7280' })
  g.val(3, 20, 0.08, { format: 'percent', align: 'right' })
  g.val(2, 21, 'Tax', { align: 'right', color: '#6b7280' })
  g.val(3, 21, f('D19*D20'), { format: 'currency', align: 'right' })
  g.val(2, 22, 'TOTAL', { bold: true, fontSize: 14, align: 'right', borders: { top: true } })
  g.val(3, 22, f('D19+D21'), { bold: true, fontSize: 14, format: 'currency', align: 'right', borders: { top: true } })

  g.val(0, 24, 'Thank you for your business!', { italic: true, color: '#6b7280' })

  return { sheets: [g.sheet('Invoice')], active: 0 }
}

// ============================================================================
// 3. Habit tracker
// ============================================================================

function makeHabitTracker(): SheetsContent {
  const accent = '#9333ea'
  const soft = '#f3e8ff'
  const softText = '#6b21a8'
  const g = new Grid()
  g.colWidths[0] = 200
  for (let d = 1; d <= 30; d++) g.colWidths[d] = 28
  g.colWidths[31] = 70

  g.val(0, 1, 'Habit Tracker', TITLE)
  g.val(0, 2, 'August 2026', SUBTITLE)

  const dayHeaders = Array.from({ length: 30 }, (_, i) => String(i + 1))
  g.headerRow(4, 0, ['Habit', ...dayHeaders, 'Total'], accent)

  const habits = [
    'Drink 8 glasses of water',
    'Exercise 30 min',
    'Read 20 pages',
    'Sleep 8 hours',
    'Meditate 10 min',
    'No added sugar',
    'Journal',
    'Stretch',
  ]
  habits.forEach((habit, hi) => {
    const r = 6 + hi
    g.val(0, r, habit, hi % 2 === 1 ? { fill: '#faf5ff' } : undefined)
    for (let d = 1; d <= 30; d++) {
      const checked = (d * 3 + hi * 5) % 10 < 5
      if (checked) g.val(d, r, '1', { align: 'center', fill: soft, color: softText, bold: true })
    }
    g.val(31, r, f(`COUNTIF(B${r}:AE${r},"1")`), { bold: true, align: 'center' })
  })

  g.val(0, 15, 'Daily total', { bold: true, borders: { top: true } })
  for (let d = 1; d <= 30; d++) {
    const cl = colLetter(d)
    g.val(d, 15, f(`COUNTIF(${cl}6:${cl}13,"1")`), { align: 'center', borders: { top: true } })
  }
  g.val(31, 15, f('SUM(B15:AE15)'), { bold: true, align: 'center', borders: { top: true } })
  g.box(0, 4, 31, 15)

  return { sheets: [g.sheet('Habits')], active: 0 }
}

// ============================================================================
// 4. Gradebook
// ============================================================================

function makeGradebook(): SheetsContent {
  const accent = '#ea580c'
  const soft = '#ffedd5'
  const softText = '#9a3412'
  const g = new Grid()
  g.colWidths = { 0: 170, 1: 90, 2: 90, 3: 90, 4: 90, 5: 100, 6: 110, 7: 100 }

  g.val(0, 1, 'Gradebook', TITLE)
  g.val(0, 2, 'Period 2 — Algebra I', SUBTITLE)

  g.val(0, 4, 'Weight', { italic: true, fill: soft, color: softText })
  const weights = [0.15, 0.15, 0.25, 0.2, 0.25]
  weights.forEach((w, i) =>
    g.val(1 + i, 4, w, { italic: true, fill: soft, color: softText, format: 'percent', align: 'center' }),
  )
  g.style(6, 4, { fill: soft })
  g.style(7, 4, { fill: soft })

  g.headerRow(
    5,
    0,
    ['Student', 'Quiz 1', 'Quiz 2', 'Midterm', 'Project', 'Final exam', 'Weighted avg', 'Letter grade'],
    accent,
  )

  const students: [string, number, number, number, number, number][] = [
    ['Ava Thompson', 92, 88, 95, 98, 94],
    ['Liam Chen', 78, 82, 75, 88, 80],
    ['Noah Martinez', 65, 70, 68, 75, 72],
    ['Emma Davis', 100, 96, 98, 100, 99],
    ['Olivia Kim', 84, 79, 88, 90, 85],
    ['Sophia Patel', 91, 93, 89, 95, 92],
    ['Mason Lee', 73, 68, 71, 80, 74],
    ['Isabella Garcia', 88, 91, 85, 92, 90],
    ['Ethan Wright', 60, 65, 58, 70, 62],
    ['Mia Johnson', 95, 97, 93, 98, 96],
  ]
  students.forEach((row, i) => {
    const r = 6 + i
    const [name, q1, q2, mid, proj, fin] = row
    const zebra = i % 2 === 1 ? { fill: '#fff7ed' } : undefined
    g.val(0, r, name, zebra)
    g.val(1, r, q1, { ...zebra, align: 'center' })
    g.val(2, r, q2, { ...zebra, align: 'center' })
    g.val(3, r, mid, { ...zebra, align: 'center' })
    g.val(4, r, proj, { ...zebra, align: 'center' })
    g.val(5, r, fin, { ...zebra, align: 'center' })
    g.val(6, r, f(`B${r}*$B$4+C${r}*$C$4+D${r}*$D$4+E${r}*$E$4+F${r}*$F$4`), {
      ...zebra,
      format: 'number',
      decimals: 1,
      align: 'center',
      bold: true,
    })
    g.val(7, r, f(`IF(G${r}>=90,"A",IF(G${r}>=80,"B",IF(G${r}>=70,"C",IF(G${r}>=60,"D","F"))))`), {
      ...zebra,
      align: 'center',
      bold: true,
    })
  })
  g.box(0, 5, 7, 15)

  g.val(0, 17, 'Class average', { bold: true, borders: { top: true } })
  ;['B', 'C', 'D', 'E', 'F', 'G'].forEach((col, i) => {
    g.val(1 + i, 17, f(`AVERAGE(${col}6:${col}15)`), {
      bold: true,
      format: 'number',
      decimals: 1,
      align: 'center',
      borders: { top: true },
    })
  })

  return { sheets: [g.sheet('Grades')], active: 0 }
}

// ============================================================================
// 5. Project tracker
// ============================================================================

function makeProjectTracker(): SheetsContent {
  const accent = '#0891b2'
  const soft = '#cffafe'
  const softText = '#155e75'
  const g = new Grid()
  g.colWidths = { 0: 260, 1: 130, 2: 120, 3: 90, 4: 110 }

  g.val(0, 1, 'Project Tracker', TITLE)
  g.val(0, 2, 'Website Relaunch — Q3 2026', SUBTITLE)

  g.headerRow(4, 0, ['Task', 'Owner', 'Status', 'Priority', 'Due date'], accent)

  const statusStyle: Record<string, CellStyle> = {
    'Not started': { fill: '#f3f4f6', color: '#6b7280' },
    'In progress': { fill: '#fef3c7', color: '#92400e' },
    Done: { fill: '#dcfce7', color: '#166534' },
    Blocked: { fill: '#fee2e2', color: '#991b1b' },
  }
  const priorityStyle: Record<string, CellStyle> = {
    High: { color: '#dc2626', bold: true },
    Medium: { color: '#d97706', bold: true },
    Low: { color: '#6b7280' },
  }

  const tasks: [string, string, string, string, string][] = [
    ['Audit current site content', 'Jordan', 'Done', 'Low', '2026-07-10'],
    ['Define new sitemap', 'Jordan', 'Done', 'Medium', '2026-07-14'],
    ['Wireframe homepage', 'Priya', 'Done', 'High', '2026-07-18'],
    ['Wireframe product pages', 'Priya', 'In progress', 'High', '2026-07-25'],
    ['Visual design — homepage', 'Sam', 'In progress', 'High', '2026-07-29'],
    ['Visual design — product pages', 'Sam', 'Not started', 'Medium', '2026-08-05'],
    ['Build design system components', 'Chris', 'In progress', 'High', '2026-08-01'],
    ['Develop homepage', 'Chris', 'Not started', 'High', '2026-08-12'],
    ['Develop product pages', 'Alex', 'Not started', 'Medium', '2026-08-19'],
    ['Content migration', 'Jordan', 'Not started', 'Medium', '2026-08-22'],
    ['QA & cross-browser testing', 'Alex', 'Not started', 'High', '2026-08-27'],
    ['Launch & DNS cutover', 'Chris', 'Blocked', 'High', '2026-08-29'],
  ]
  tasks.forEach(([task, owner, status, priority, due], i) => {
    const r = 5 + i
    const zebra = i % 2 === 1 ? { fill: '#f9fafb' } : undefined
    g.val(0, r, task, zebra)
    g.val(1, r, owner, zebra)
    g.val(2, r, status, { ...zebra, ...statusStyle[status], align: 'center' })
    g.val(3, r, priority, { ...zebra, ...priorityStyle[priority], align: 'center' })
    g.val(4, r, due, { ...zebra, format: 'date' })
  })
  g.box(0, 4, 4, 16)

  g.val(0, 19, 'Status summary', { bold: true, fill: soft, color: softText })
  g.style(1, 19, { fill: soft })
  g.headerRow(20, 0, ['Status', 'Count'], accent)

  const statuses = ['Not started', 'In progress', 'Done', 'Blocked']
  statuses.forEach((status, i) => {
    const r = 21 + i
    g.val(0, r, status)
    g.val(1, r, f(`COUNTIF(C5:C16,"${status}")`), { align: 'center' })
  })
  g.val(0, 25, 'Total tasks', { bold: true, borders: { top: true } })
  g.val(1, 25, f('SUM(B21:B24)'), { bold: true, align: 'center', borders: { top: true } })
  g.val(0, 26, '% complete')
  g.val(1, 26, f('B23/B25'), { format: 'percent' })
  g.box(0, 20, 1, 26)

  return { sheets: [g.sheet('Tasks')], active: 0 }
}

// ============================================================================
// 6. Expense report
// ============================================================================

function makeExpenseReport(): SheetsContent {
  const accent = '#e11d48'
  const soft = '#ffe4e6'
  const softText = '#9f1239'
  const g = new Grid()
  g.colWidths = { 0: 100, 1: 130, 2: 220, 3: 100 }

  g.val(0, 1, 'Expense Report', TITLE)
  g.val(0, 2, 'Sales Trip — Chicago, Aug 2026', SUBTITLE)

  g.headerRow(4, 0, ['Date', 'Category', 'Description', 'Amount'], accent)

  const items: [string, string, string, number][] = [
    ['2026-08-03', 'Airfare', 'Flight ORD round trip', 412.5],
    ['2026-08-03', 'Transportation', 'Taxi to hotel', 38],
    ['2026-08-03', 'Lodging', 'Hotel night 1', 189],
    ['2026-08-04', 'Meals', 'Client dinner', 96.4],
    ['2026-08-04', 'Lodging', 'Hotel night 2', 189],
    ['2026-08-04', 'Meals', 'Breakfast', 14.25],
    ['2026-08-05', 'Meals', 'Lunch with prospect', 42.1],
    ['2026-08-05', 'Transportation', 'Rideshare', 22.5],
    ['2026-08-05', 'Lodging', 'Hotel night 3', 189],
    ['2026-08-06', 'Supplies', 'Printed materials', 58.75],
    ['2026-08-06', 'Meals', 'Dinner', 31.6],
    ['2026-08-06', 'Transportation', 'Flight home taxi', 35],
  ]
  items.forEach(([date, category, desc, amount], i) => {
    const r = 5 + i
    const zebra = i % 2 === 1 ? { fill: '#fff1f2' } : undefined
    g.val(0, r, date, { ...zebra, format: 'date' })
    g.val(1, r, category, zebra)
    g.val(2, r, desc, zebra)
    g.val(3, r, amount, { ...zebra, format: 'currency' })
  })
  g.val(0, 17, 'Total', { bold: true, borders: { top: true } })
  g.val(3, 17, f('SUM(D5:D16)'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(0, 4, 3, 17)

  g.val(0, 19, 'Summary by category', { bold: true, fill: soft, color: softText })
  g.style(1, 19, { fill: soft })
  g.headerRow(20, 0, ['Category', 'Total'], accent)

  const categories = ['Airfare', 'Lodging', 'Meals', 'Transportation', 'Supplies']
  categories.forEach((cat, i) => {
    const r = 21 + i
    g.val(0, r, cat)
    g.val(1, r, f(`SUMIF(B5:B16,"${cat}",D5:D16)`), { format: 'currency' })
  })
  g.val(0, 26, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 26, f('SUM(B21:B25)'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(0, 20, 1, 26)

  return { sheets: [g.sheet('Expenses')], active: 0 }
}

// ============================================================================
// 7. Workout log
// ============================================================================

function makeWorkoutLog(): SheetsContent {
  const accent = '#dc2626'
  const soft = '#fee2e2'
  const softText = '#991b1b'
  const g = new Grid()
  g.colWidths = { 0: 90, 1: 190, 2: 60, 3: 60, 4: 90, 5: 100 }

  g.val(0, 1, 'Workout Log', TITLE)
  g.val(0, 2, 'Week of Aug 17, 2026 — Push / Pull / Legs', SUBTITLE)

  g.headerRow(4, 0, ['Date', 'Exercise', 'Sets', 'Reps', 'Weight (lb)', 'Volume'], accent)

  const days: [string, [string, number, number, number][]][] = [
    [
      '2026-08-17',
      [
        ['Bench press', 4, 8, 135],
        ['Overhead press', 3, 10, 65],
        ['Incline DB press', 3, 10, 50],
        ['Triceps pushdown', 3, 12, 40],
        ['Lateral raise', 3, 15, 15],
      ],
    ],
    [
      '2026-08-19',
      [
        ['Deadlift', 3, 5, 225],
        ['Barbell row', 4, 8, 115],
        ['Lat pulldown', 3, 10, 100],
        ['Face pull', 3, 15, 35],
        ['Bicep curl', 3, 12, 30],
      ],
    ],
    [
      '2026-08-21',
      [
        ['Back squat', 4, 6, 185],
        ['Romanian deadlift', 3, 8, 135],
        ['Leg press', 3, 10, 270],
        ['Walking lunge', 3, 12, 40],
        ['Calf raise', 4, 15, 90],
      ],
    ],
  ]

  let r = 5
  days.forEach(([date, exercises], di) => {
    exercises.forEach(([name, sets, reps, weight]) => {
      const zebra = di % 2 === 1 ? { fill: '#fef2f2' } : undefined
      g.val(0, r, date, { ...zebra, format: 'date' })
      g.val(1, r, name, zebra)
      g.val(2, r, sets, { ...zebra, align: 'center' })
      g.val(3, r, reps, { ...zebra, align: 'center' })
      g.val(4, r, weight, { ...zebra, align: 'center' })
      g.val(5, r, f(`C${r}*D${r}*E${r}`), { ...zebra, align: 'center', bold: true })
      r++
    })
  })
  g.box(0, 4, 5, 19)

  g.val(0, 21, 'Weekly totals', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 5; c++) g.style(c, 21, { fill: soft })
  g.val(0, 22, 'Total volume (lb)')
  g.val(5, 22, f('SUM(F5:F19)'), { bold: true, align: 'center' })
  g.val(0, 23, 'Total sets')
  g.val(2, 23, f('SUM(C5:C19)'), { bold: true, align: 'center' })
  g.val(0, 24, 'Avg weight per set (lb)')
  g.val(4, 24, f('AVERAGE(E5:E19)'), { bold: true, align: 'center' })

  return { sheets: [g.sheet('Workouts')], active: 0 }
}

// ============================================================================
// 8. Loan calculator
// ============================================================================

function makeLoanCalculator(): SheetsContent {
  const accent = '#475569'
  const soft = '#f1f5f9'
  const softText = '#334155'
  const g = new Grid()
  g.colWidths = { 0: 220, 1: 110, 2: 100, 3: 100, 4: 110 }

  g.val(0, 1, 'Loan Calculator', TITLE)
  g.val(0, 2, 'Auto loan amortization', SUBTITLE)

  g.val(0, 4, 'Loan amount')
  g.val(1, 4, 28000, { format: 'currency', bold: true })
  g.val(0, 5, 'Annual interest rate')
  g.val(1, 5, 0.0649, { format: 'percent', decimals: 2, bold: true })
  g.val(0, 6, 'Loan term (years)')
  g.val(1, 6, 5, { format: 'number', bold: true })
  g.val(0, 7, 'Monthly rate')
  g.val(1, 7, f('B5/12'), { format: 'percent', decimals: 3 })
  g.val(0, 8, 'Number of payments')
  g.val(1, 8, f('B6*12'), { format: 'number' })
  g.val(0, 9, 'Monthly payment', { bold: true })
  g.val(1, 9, f('B4*B7/(1-(1+B7)^-B8)'), { format: 'currency', bold: true, fill: soft, color: softText })
  g.val(0, 10, 'Total paid')
  g.val(1, 10, f('B9*B8'), { format: 'currency' })
  g.val(0, 11, 'Total interest')
  g.val(1, 11, f('B10-B4'), { format: 'currency' })

  g.val(0, 13, 'Payment schedule (year 1)', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 4; c++) g.style(c, 13, { fill: soft })
  g.headerRow(14, 0, ['#', 'Payment', 'Principal', 'Interest', 'Balance'], accent)

  for (let i = 0; i < 12; i++) {
    const r = 15 + i
    const zebra = i % 2 === 1 ? { fill: '#f8fafc' } : undefined
    g.val(0, r, i + 1, { ...zebra, align: 'center' })
    g.val(1, r, f('$B$9'), { ...zebra, format: 'currency' })
    g.val(3, r, i === 0 ? f('$B$4*$B$7') : f(`E${r - 1}*$B$7`), { ...zebra, format: 'currency' })
    g.val(2, r, f(`B${r}-D${r}`), { ...zebra, format: 'currency' })
    g.val(4, r, i === 0 ? f(`$B$4-C${r}`) : f(`E${r - 1}-C${r}`), { ...zebra, format: 'currency' })
  }
  g.box(0, 14, 4, 26)

  g.val(0, 28, 'Remaining balance after 12 months', { bold: true })
  g.val(1, 28, f('E26'), { format: 'currency', bold: true })

  return { sheets: [g.sheet('Loan')], active: 0 }
}

// ============================================================================
// 9. Inventory
// ============================================================================

function makeInventory(): SheetsContent {
  const accent = '#ca8a04'
  const g = new Grid()
  g.colWidths = { 0: 90, 1: 200, 2: 110, 3: 100, 4: 100, 5: 90, 6: 110, 7: 90 }

  g.val(0, 1, 'Inventory', TITLE)
  g.val(0, 2, 'Warehouse stock — Aug 2026', SUBTITLE)

  g.headerRow(
    4,
    0,
    ['SKU', 'Item', 'Category', 'Qty on hand', 'Reorder pt', 'Unit cost', 'Total value', 'Status'],
    accent,
  )

  const items: [string, string, string, number, number, number][] = [
    ['SK-1001', 'Wireless mouse', 'Electronics', 42, 20, 14.5],
    ['SK-1002', 'USB-C cable 2m', 'Accessories', 15, 25, 6.25],
    ['SK-1003', 'Notebook — ruled', 'Office', 120, 40, 2.1],
    ['SK-1004', 'Desk lamp', 'Electronics', 8, 10, 22],
    ['SK-1005', 'Standing desk mat', 'Accessories', 30, 12, 35],
    ['SK-1006', 'Mechanical keyboard', 'Electronics', 18, 15, 68],
    ['SK-1007', 'Webcam 1080p', 'Electronics', 6, 10, 45],
    ['SK-1008', 'Laptop stand', 'Accessories', 25, 15, 28.5],
    ['SK-1009', 'Whiteboard marker set', 'Office', 60, 30, 8.75],
    ['SK-1010', 'Sticky notes (pack)', 'Office', 200, 50, 3.2],
    ['SK-1011', 'HDMI adapter', 'Electronics', 10, 20, 12],
    ['SK-1012', 'Cable organizer', 'Accessories', 33, 15, 9.5],
  ]
  items.forEach(([sku, item, cat, qty, reorder, cost], i) => {
    const r = 5 + i
    const zebra = i % 2 === 1 ? { fill: '#fefce8' } : undefined
    g.val(0, r, sku, zebra)
    g.val(1, r, item, zebra)
    g.val(2, r, cat, zebra)
    g.val(3, r, qty, { ...zebra, align: 'center' })
    g.val(4, r, reorder, { ...zebra, align: 'center' })
    g.val(5, r, cost, { ...zebra, format: 'currency' })
    g.val(6, r, f(`D${r}*F${r}`), { ...zebra, format: 'currency' })
    g.val(7, r, f(`IF(D${r}<E${r},"Reorder","OK")`), { ...zebra, align: 'center', bold: true })
  })
  g.box(0, 4, 7, 16)

  g.val(0, 18, 'Items to reorder', { bold: true })
  g.val(1, 18, f('COUNTIF(H5:H16,"Reorder")'), { bold: true, align: 'center' })
  g.val(0, 19, 'Total inventory value', { bold: true })
  g.val(1, 19, f('SUM(G5:G16)'), { bold: true, format: 'currency' })

  return { sheets: [g.sheet('Inventory')], active: 0 }
}

// ============================================================================
// 10. Savings goal
// ============================================================================

function makeSavingsGoal(): SheetsContent {
  const accent = '#059669'
  const soft = '#d1fae5'
  const softText = '#065f46'
  const g = new Grid()
  g.colWidths = { 0: 170, 1: 130, 2: 130, 3: 110 }

  g.val(0, 1, 'Savings Goal Tracker', TITLE)
  g.val(0, 2, 'Emergency fund — 2026', SUBTITLE)

  g.val(0, 4, 'Goal target', { bold: true })
  g.val(1, 4, 10000, { format: 'currency', bold: true, fill: soft, color: softText })
  g.val(0, 5, 'Target date')
  g.val(1, 5, '2026-12-31', { format: 'date' })

  g.headerRow(7, 0, ['Date', 'Amount saved', 'Running total', '% of goal'], accent)

  const months: [string, number][] = [
    ['2026-01-31', 800],
    ['2026-02-28', 750],
    ['2026-03-31', 900],
    ['2026-04-30', 700],
    ['2026-05-31', 850],
    ['2026-06-30', 950],
    ['2026-07-31', 800],
    ['2026-08-31', 900],
    ['2026-09-30', 750],
    ['2026-10-31', 1000],
    ['2026-11-30', 850],
    ['2026-12-31', 900],
  ]
  months.forEach(([date, amount], i) => {
    const r = 8 + i
    const zebra = i % 2 === 1 ? { fill: '#f0fdf4' } : undefined
    g.val(0, r, date, { ...zebra, format: 'date' })
    g.val(1, r, amount, { ...zebra, format: 'currency' })
    g.val(2, r, f(`SUM($B$8:B${r})`), { ...zebra, format: 'currency' })
    g.val(3, r, f(`C${r}/$B$4`), { ...zebra, format: 'percent' })
  })
  g.box(0, 7, 3, 19)

  g.val(0, 21, 'Total saved', { bold: true, borders: { top: true } })
  g.val(1, 21, f('SUM(B8:B19)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(0, 22, 'Remaining to goal')
  g.val(1, 22, f('$B$4-B21'), { format: 'currency' })
  g.val(0, 23, '% complete', { bold: true })
  g.val(1, 23, f('B21/$B$4'), { format: 'percent', bold: true })

  return { sheets: [g.sheet('Savings')], active: 0 }
}

// ============================================================================
// 11. Weekly schedule
// ============================================================================

function makeWeeklySchedule(): SheetsContent {
  const accent = '#0ea5e9'
  const g = new Grid()
  g.colWidths = { 0: 90, 1: 140, 2: 140, 3: 140, 4: 140, 5: 140, 6: 140, 7: 140 }

  g.val(0, 1, 'Weekly Schedule', TITLE)
  g.val(0, 2, 'Aug 17 – Aug 23, 2026', SUBTITLE)

  g.headerRow(4, 0, ['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], accent)

  const times = [
    '7:00 AM',
    '8:00 AM',
    '9:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '1:00 PM',
    '2:00 PM',
    '3:00 PM',
    '4:00 PM',
    '5:00 PM',
    '6:00 PM',
  ]
  times.forEach((t, i) => {
    const r = 5 + i
    g.val(0, r, t, { bold: true, align: 'right', color: '#6b7280' })
    if (i % 2 === 1) for (let c = 1; c <= 7; c++) g.style(c, r, { fill: '#f8fafc' })
  })
  g.box(0, 4, 7, 16)

  const categoryStyle: Record<string, CellStyle> = {
    health: { fill: '#dcfce7', color: '#166534' },
    work: { fill: '#dbeafe', color: '#1e3a8a' },
    personal: { fill: '#fef9c3', color: '#854d0e' },
    social: { fill: '#fce7f3', color: '#9d174d' },
  }
  const events: [number, number, string, keyof typeof categoryStyle][] = [
    [5, 1, 'Gym', 'health'],
    [5, 3, 'Gym', 'health'],
    [5, 5, 'Gym', 'health'],
    [5, 6, 'Long run', 'health'],
    [6, 1, 'Team standup', 'work'],
    [6, 2, 'Team standup', 'work'],
    [6, 3, 'Team standup', 'work'],
    [6, 4, 'Team standup', 'work'],
    [6, 5, 'Team standup', 'work'],
    [7, 1, 'Deep work', 'work'],
    [7, 2, 'Deep work', 'work'],
    [7, 3, 'Deep work', 'work'],
    [7, 4, 'Deep work', 'work'],
    [7, 5, 'Deep work', 'work'],
    [9, 3, '1:1 w/ manager', 'work'],
    [10, 1, 'Lunch', 'personal'],
    [10, 2, 'Lunch', 'personal'],
    [10, 3, 'Lunch', 'personal'],
    [10, 4, 'Lunch', 'personal'],
    [10, 5, 'Lunch', 'personal'],
    [11, 2, 'Client call', 'work'],
    [12, 4, 'Project review', 'work'],
    [13, 5, 'Errands', 'personal'],
    [14, 1, 'Deep work', 'work'],
    [14, 3, 'Deep work', 'work'],
    [15, 6, 'Grocery run', 'health'],
    [15, 7, 'Family time', 'social'],
    [16, 5, 'Dinner with friends', 'social'],
    [16, 7, 'Family dinner', 'social'],
  ]
  events.forEach(([r, c, text, cat]) => {
    g.val(c, r, text, { ...categoryStyle[cat], align: 'center', wrap: true, bold: true })
  })

  g.val(0, 18, 'Gym sessions', { bold: true })
  g.val(1, 18, f('COUNTIF(B5:H16,"Gym")'), { bold: true, align: 'center' })

  return { sheets: [g.sheet('Schedule')], active: 0 }
}

// ============================================================================
// 12. Sales dashboard
// ============================================================================

function makeSalesDashboard(): SheetsContent {
  const accent = '#16a34a'
  const g = new Grid()
  g.colWidths = { 0: 140, 1: 110, 2: 110, 3: 110 }

  g.val(0, 1, 'Sales Dashboard', TITLE)
  g.val(0, 2, 'FY2026 — Regional performance', SUBTITLE)

  g.headerRow(4, 0, ['Month', 'Target', 'Actual', '% to target'], accent)

  const months: [string, number, number][] = [
    ['January', 42000, 39500],
    ['February', 43000, 44200],
    ['March', 45000, 47100],
    ['April', 44000, 41800],
    ['May', 46000, 48300],
    ['June', 48000, 50200],
    ['July', 47000, 45900],
    ['August', 49000, 51500],
    ['September', 50000, 48700],
    ['October', 51000, 53400],
    ['November', 53000, 55800],
    ['December', 56000, 60200],
  ]
  months.forEach(([month, target, actual], i) => {
    const r = 5 + i
    const zebra = i % 2 === 1 ? { fill: '#f0fdf4' } : undefined
    g.val(0, r, month, zebra)
    g.val(1, r, target, { ...zebra, format: 'currency' })
    g.val(2, r, actual, { ...zebra, format: 'currency' })
    g.val(3, r, f(`C${r}/B${r}`), { ...zebra, format: 'percent' })
  })
  g.val(0, 17, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 17, f('SUM(B5:B16)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(2, 17, f('SUM(C5:C16)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(3, 17, f('C17/B17'), { bold: true, format: 'percent', borders: { top: true } })
  g.box(0, 4, 3, 17)

  g.charts.push({
    id: uid(),
    type: 'bar',
    title: 'Monthly sales: target vs actual',
    labelRange: 'A5:A16',
    dataRanges: ['B5:B16', 'C5:C16'],
    seriesNames: ['Target', 'Actual'],
    x: 540,
    y: 90,
    w: 520,
    h: 340,
  })

  return { sheets: [g.sheet('Sales')], active: 0 }
}

// ============================================================================
// Template registry
// ============================================================================

export const sheetsTemplates: SheetsTemplate[] = [
  {
    id: 'monthly-budget',
    name: 'Monthly budget',
    description: 'Plan income and expenses by category with automatic totals, difference, and remaining balance.',
    category: 'Finance',
    accent: '#2563eb',
    glyph: '💰',
    make: makeMonthlyBudget,
  },
  {
    id: 'invoice-builder',
    name: 'Invoice',
    description: 'Client-ready invoice with line-item totals, tax, and a grand total that updates automatically.',
    category: 'Finance',
    accent: '#4f46e5',
    glyph: '🧾',
    make: makeInvoice,
  },
  {
    id: 'habit-tracker',
    name: 'Habit tracker',
    description: 'Check off daily habits across a 30-day grid with automatic streak and daily-total counts.',
    category: 'Personal',
    accent: '#9333ea',
    glyph: '✅',
    make: makeHabitTracker,
  },
  {
    id: 'gradebook',
    name: 'Gradebook',
    description: 'Score students across assignments with a weighted final average and automatic letter grades.',
    category: 'Education',
    accent: '#ea580c',
    glyph: '🎓',
    make: makeGradebook,
  },
  {
    id: 'project-tracker',
    name: 'Project tracker',
    description: 'Track tasks, owners, priority, and due dates with a live status-count summary.',
    category: 'Business',
    accent: '#0891b2',
    glyph: '📋',
    make: makeProjectTracker,
  },
  {
    id: 'expense-report',
    name: 'Expense report',
    description: 'Log trip expenses by category and roll them up into a per-category summary and grand total.',
    category: 'Finance',
    accent: '#e11d48',
    glyph: '🧳',
    make: makeExpenseReport,
  },
  {
    id: 'workout-log',
    name: 'Workout log',
    description: 'Log sets, reps, and weight per exercise with automatic per-set volume and weekly totals.',
    category: 'Personal',
    accent: '#dc2626',
    glyph: '🏋️',
    make: makeWorkoutLog,
  },
  {
    id: 'loan-calculator',
    name: 'Loan calculator',
    description: 'Enter principal, rate, and term to compute the monthly payment and a full amortization schedule.',
    category: 'Finance',
    accent: '#475569',
    glyph: '🏦',
    make: makeLoanCalculator,
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Track stock levels against reorder points with automatic low-stock flags and total value.',
    category: 'Business',
    accent: '#ca8a04',
    glyph: '📦',
    make: makeInventory,
  },
  {
    id: 'savings-goal',
    name: 'Savings goal',
    description: 'Log contributions toward a target with a running total and live percent-to-goal.',
    category: 'Finance',
    accent: '#059669',
    glyph: '🐷',
    make: makeSavingsGoal,
  },
  {
    id: 'weekly-schedule',
    name: 'Weekly schedule',
    description: 'A color-coded time-block grid across the week for work, health, and personal commitments.',
    category: 'Personal',
    accent: '#0ea5e9',
    glyph: '🗓️',
    make: makeWeeklySchedule,
  },
  {
    id: 'sales-dashboard',
    name: 'Sales dashboard',
    description: 'Monthly target-vs-actual sales table with automatic totals and a bar chart of performance.',
    category: 'Business',
    accent: '#16a34a',
    glyph: '📈',
    make: makeSalesDashboard,
  },
]
