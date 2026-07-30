import type { Cell, CellStyle, ChartSpec, Sheet, SheetsContent, SheetsTemplate } from '../shared/types'
import { uid } from '../shared/types'

// ============================================================================
// Grid building helpers — same small DSL used across the other sheets template
// packs, so each template reads as plain data instead of hand-written A1
// string bookkeeping.
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

/** A compact KPI "card": a label row + a big-number value row, filled solid in the accent color. */
function kpiCard(
  g: Grid,
  c1: number,
  c2: number,
  r: number,
  label: string,
  valueExpr: string,
  accent: string,
  opts?: { format?: CellStyle['format']; decimals?: number },
) {
  for (let c = c1; c <= c2; c++) {
    g.style(c, r, { fill: accent })
    g.style(c, r + 1, { fill: accent })
  }
  g.val(c1, r, label, { color: '#ffffff', bold: true, fontSize: 11, wrap: true })
  g.val(c1, r + 1, valueExpr, {
    color: '#ffffff',
    bold: true,
    fontSize: 22,
    format: opts?.format,
    decimals: opts?.decimals,
  })
}

// ============================================================================
// 1. Meal planner + grocery list
// ============================================================================

function makeMealPlanner(): SheetsContent {
  const accent = '#0d9488'
  const soft = '#ccfbf1'
  const softText = '#115e59'
  const g = new Grid()
  g.colWidths = { 0: 150, 1: 130, 2: 130, 3: 130, 4: 130, 5: 130, 6: 130, 7: 130 }

  g.val(0, 1, 'Weekly Meal Planner', TITLE)
  g.val(0, 2, 'Week of Aug 17 – Aug 23, 2026 · Plan meals, then shop from the list below', SUBTITLE)

  kpiCard(g, 0, 1, 4, 'Meals planned', f('COUNTA(B8:H11)'), accent)
  kpiCard(g, 3, 4, 4, 'Grocery items', f('COUNTA(A15:A34)'), accent)
  kpiCard(g, 6, 7, 4, 'Est. grocery cost', f('SUM(E15:E34)'), accent, { format: 'currency' })

  // ---- Meal grid ----
  g.headerRow(7, 0, ['Meal', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], accent)
  const meals: [string, string[]][] = [
    [
      'Breakfast',
      [
        'Greek yogurt & granola',
        'Veggie omelet & toast',
        'Oatmeal with berries',
        'Avocado toast & eggs',
        'Breakfast burrito',
        'Pancakes & fruit',
        'Smoothie bowl',
      ],
    ],
    [
      'Lunch',
      [
        'Chicken Caesar salad',
        'Turkey & avocado wrap',
        'Leftover stir-fry',
        'Quinoa power bowl',
        'Grilled cheese & soup',
        'Poke bowl',
        'BLT sandwich',
      ],
    ],
    [
      'Dinner',
      [
        'Baked salmon & broccoli',
        'Turkey chili',
        'Chicken stir-fry',
        'Spaghetti & meatballs',
        'Homemade pizza night',
        'Tacos al pastor',
        'Roast chicken & veggies',
      ],
    ],
    [
      'Snacks',
      ['Apple & almond butter', 'Hummus & carrots', 'Trail mix', 'Greek yogurt', 'Popcorn', 'Cheese & crackers', 'Fruit salad'],
    ],
  ]
  meals.forEach(([label, days], i) => {
    const r = 8 + i
    g.rowHeights[r] = 40
    const zebra = i % 2 === 1 ? { fill: '#f0fdfa' } : undefined
    g.val(0, r, label, { ...zebra, bold: true })
    days.forEach((meal, di) => g.val(1 + di, r, meal, { ...zebra, wrap: true, fontSize: 11 }))
  })
  g.box(0, 7, 7, 11)

  // ---- Grocery list ----
  g.val(0, 13, 'Grocery List', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 4; c++) g.style(c, 13, { fill: soft })
  g.headerRow(14, 0, ['Item', 'Category', 'Qty', 'Unit', 'Est. cost'], accent)

  const grocery: [string, string, number, string, number][] = [
    ['Bananas', 'Produce', 6, 'count', 1.8],
    ['Spinach', 'Produce', 1, 'bag', 3.49],
    ['Bell peppers', 'Produce', 3, 'count', 4.2],
    ['Avocados', 'Produce', 4, 'count', 5],
    ['Broccoli crowns', 'Produce', 2, 'count', 3.6],
    ['Whole milk', 'Dairy & Eggs', 1, 'half-gal', 2.99],
    ['Greek yogurt', 'Dairy & Eggs', 32, 'oz tub', 5.49],
    ['Eggs', 'Dairy & Eggs', 1, 'dozen', 4.29],
    ['Shredded cheddar', 'Dairy & Eggs', 8, 'oz bag', 3.79],
    ['Salmon fillets', 'Meat & Seafood', 1.5, 'lb', 14.25],
    ['Chicken breast', 'Meat & Seafood', 2, 'lb', 9.5],
    ['Ground turkey', 'Meat & Seafood', 1, 'lb', 6.75],
    ['Bacon', 'Meat & Seafood', 1, 'pack', 5.99],
    ['Brown rice', 'Pantry', 2, 'lb bag', 3.2],
    ['Olive oil', 'Pantry', 1, 'bottle', 8.99],
    ['Black beans (canned)', 'Pantry', 2, 'cans', 2.4],
    ['Pasta', 'Pantry', 2, 'boxes', 3],
    ['Whole wheat bread', 'Bakery', 1, 'loaf', 3.99],
    ['Bagels', 'Bakery', 1, 'pack of 6', 4.29],
    ['Tortillas', 'Bakery', 1, 'pack', 3.49],
  ]
  grocery.forEach(([item, cat, qty, unit, cost], i) => {
    const r = 15 + i
    const zebra = i % 2 === 1 ? { fill: '#f0fdfa' } : undefined
    g.val(0, r, item, zebra)
    g.val(1, r, cat, zebra)
    g.val(2, r, qty, { ...zebra, align: 'center' })
    g.val(3, r, unit, { ...zebra, align: 'center' })
    g.val(4, r, cost, { ...zebra, format: 'currency' })
  })
  g.box(0, 14, 4, 34)

  // ---- Cost by category ----
  g.val(0, 36, 'Cost by Category', { bold: true, fill: soft, color: softText })
  g.style(1, 36, { fill: soft })
  g.headerRow(37, 0, ['Category', 'Total'], accent)
  const categories = ['Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Pantry', 'Bakery']
  categories.forEach((cat, i) => {
    const r = 38 + i
    g.val(0, r, cat)
    g.val(1, r, f(`SUMIF(B15:B34,"${cat}",E15:E34)`), { format: 'currency' })
  })
  g.val(0, 43, 'Grand total', { bold: true, borders: { top: true } })
  g.val(1, 43, f('SUM(B38:B42)'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(0, 37, 1, 43)

  g.charts.push({
    id: uid(),
    type: 'pie',
    title: 'Grocery cost by category',
    labelRange: 'A38:A42',
    dataRanges: ['B38:B42'],
    x: 320,
    y: 840,
    w: 380,
    h: 260,
  })

  return { sheets: [g.sheet('Meal Plan')], active: 0 }
}

// ============================================================================
// 2. Wedding budget
// ============================================================================

function makeWeddingBudget(): SheetsContent {
  const accent = '#db2777'
  const soft = '#fce7f3'
  const softText = '#9d174d'
  const g = new Grid()
  g.colWidths = { 0: 190, 1: 110, 2: 110, 3: 100, 4: 100 }

  g.val(0, 1, 'Wedding Budget Tracker', TITLE)
  g.val(0, 2, '[Partner 1] & [Partner 2] · Saturday, October 10, 2026', SUBTITLE)

  kpiCard(g, 0, 0, 4, 'Total budget', f('B20'), accent, { format: 'currency' })
  kpiCard(g, 2, 2, 4, 'Total spent', f('C20'), accent, { format: 'currency' })
  kpiCard(g, 4, 4, 4, 'Remaining', f('B20-C20'), accent, { format: 'currency' })

  g.headerRow(7, 0, ['Category', 'Budgeted', 'Actual', 'Variance', '% of total'], accent)
  const items: [string, number, number][] = [
    ['Venue & catering', 12000, 12500],
    ['Photography & video', 4200, 4200],
    ['Attire & beauty', 2200, 1950],
    ['Flowers & decor', 2800, 3100],
    ['Music & entertainment', 1800, 1800],
    ['Wedding rings', 1500, 1350],
    ['Invitations & stationery', 600, 540],
    ['Wedding planner', 2500, 2500],
    ['Transportation', 700, 650],
    ['Officiant', 400, 400],
    ['Favors & gifts', 500, 620],
    ['Miscellaneous / buffer', 1000, 400],
  ]
  items.forEach(([cat, budget, actual], i) => {
    const r = 8 + i
    const zebra = i % 2 === 1 ? { fill: '#fdf2f8' } : undefined
    g.val(0, r, cat, zebra)
    g.val(1, r, budget, { ...zebra, format: 'currency' })
    g.val(2, r, actual, { ...zebra, format: 'currency' })
    g.val(3, r, f(`C${r}-B${r}`), { ...zebra, format: 'currency' })
    g.val(4, r, f(`C${r}/$C$20`), { ...zebra, format: 'percent' })
  })
  g.val(0, 20, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 20, f('SUM(B8:B19)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(2, 20, f('SUM(C8:C19)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(3, 20, f('C20-B20'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(4, 20, f('C20/$C$20'), { bold: true, format: 'percent', borders: { top: true } })
  g.box(0, 7, 4, 20)

  g.val(0, 22, 'Summary', { bold: true, fill: soft, color: softText })
  g.style(1, 22, { fill: soft })
  g.val(0, 23, 'Total budget')
  g.val(1, 23, f('B20'), { format: 'currency' })
  g.val(0, 24, 'Total spent')
  g.val(1, 24, f('C20'), { format: 'currency' })
  g.val(0, 25, 'Remaining', { bold: true, borders: { top: true } })
  g.val(1, 25, f('B23-B24'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(0, 26, '% of budget spent')
  g.val(1, 26, f('B24/B23'), { format: 'percent' })
  g.val(0, 27, 'Days until wedding')
  g.val(1, 27, f('DATE(2026,10,10)-TODAY()'), { format: 'number', decimals: 0 })
  g.box(0, 22, 1, 27)

  g.charts.push({
    id: uid(),
    type: 'pie',
    title: 'Actual spend by category',
    labelRange: 'A8:A19',
    dataRanges: ['C8:C19'],
    x: 650,
    y: 144,
    w: 460,
    h: 380,
  })

  return { sheets: [g.sheet('Wedding Budget')], active: 0 }
}

// ============================================================================
// 3. Travel itinerary + budget
// ============================================================================

function makeTravelItinerary(): SheetsContent {
  const accent = '#0284c7'
  const soft = '#e0f2fe'
  const softText = '#075985'
  const g = new Grid()
  g.colWidths = { 0: 70, 1: 95, 2: 170, 3: 170, 4: 170, 5: 100 }

  g.val(0, 1, 'Travel Itinerary & Budget', TITLE)
  g.val(0, 2, 'Lisbon, Portugal · Oct 12–18, 2026 · 7 days', SUBTITLE)

  kpiCard(g, 0, 0, 4, 'Trip length (days)', f('COUNTA(A8:A14)'), accent)
  kpiCard(g, 2, 3, 4, 'Total budget', f('SUM(F18:F24)'), accent, { format: 'currency' })
  kpiCard(g, 4, 5, 4, 'Avg cost / day', f('AVERAGE(F18:F24)'), accent, { format: 'currency' })

  g.headerRow(7, 0, ['Day', 'Date', 'Morning', 'Afternoon', 'Evening'], accent)
  const days: [string, string, string, string, string][] = [
    ['1', '2026-10-12', 'Arrive & check into hotel', 'Wander the Alfama district', 'Dinner at Time Out Market'],
    ['2', '2026-10-13', 'Belém Tower & Jerónimos Monastery', 'Pastéis de Belém tasting', 'Fado show in Alfama'],
    ['3', '2026-10-14', 'Day trip to Sintra — Pena Palace', 'Quinta da Regaleira', 'Dinner in Sintra town'],
    ['4', '2026-10-15', 'LX Factory shopping', 'Tram 28 sightseeing loop', 'Rooftop bar at sunset'],
    ['5', '2026-10-16', 'Day trip to Cascais beach', 'Coastal walk to Estoril', 'Seafood dinner by the marina'],
    ['6', '2026-10-17', 'National Tile Museum', 'Free time / shopping', 'Farewell dinner river cruise'],
    ['7', '2026-10-18', 'Pack & check out', 'Flight home', '—'],
  ]
  days.forEach(([day, date, morning, afternoon, evening], i) => {
    const r = 8 + i
    g.rowHeights[r] = 36
    const zebra = i % 2 === 1 ? { fill: '#f0f9ff' } : undefined
    g.val(0, r, day, { ...zebra, align: 'center', bold: true })
    g.val(1, r, date, { ...zebra, format: 'date' })
    g.val(2, r, morning, { ...zebra, wrap: true, fontSize: 11 })
    g.val(3, r, afternoon, { ...zebra, wrap: true, fontSize: 11 })
    g.val(4, r, evening, { ...zebra, wrap: true, fontSize: 11 })
  })
  g.box(0, 7, 4, 14)

  g.val(0, 16, 'Daily Budget (USD)', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 5; c++) g.style(c, 16, { fill: soft })
  g.headerRow(17, 0, ['Day', 'Transport', 'Lodging', 'Food', 'Activities', 'Total'], accent)
  const budget: [number, number, number, number][] = [
    [45, 140, 60, 0],
    [12, 140, 75, 25],
    [35, 140, 65, 40],
    [8, 140, 70, 15],
    [20, 140, 80, 10],
    [15, 140, 90, 60],
    [45, 0, 30, 0],
  ]
  budget.forEach(([transport, lodging, food, activities], i) => {
    const r = 18 + i
    const zebra = i % 2 === 1 ? { fill: '#f0f9ff' } : undefined
    g.val(0, r, i + 1, { ...zebra, align: 'center' })
    g.val(1, r, transport, { ...zebra, format: 'currency' })
    g.val(2, r, lodging, { ...zebra, format: 'currency' })
    g.val(3, r, food, { ...zebra, format: 'currency' })
    g.val(4, r, activities, { ...zebra, format: 'currency' })
    g.val(5, r, f(`B${r}+C${r}+D${r}+E${r}`), { ...zebra, format: 'currency', bold: true })
  })
  g.val(0, 25, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 25, f('SUM(B18:B24)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(2, 25, f('SUM(C18:C24)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(3, 25, f('SUM(D18:D24)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(4, 25, f('SUM(E18:E24)'), { bold: true, format: 'currency', borders: { top: true } })
  g.val(5, 25, f('SUM(F18:F24)'), { bold: true, format: 'currency', borders: { top: true } })
  g.box(0, 17, 5, 25)

  g.charts.push({
    id: uid(),
    type: 'bar',
    title: 'Daily spend by category',
    labelRange: 'A18:A24',
    dataRanges: ['B18:B24', 'C18:C24', 'D18:D24', 'E18:E24'],
    seriesNames: ['Transport', 'Lodging', 'Food', 'Activities'],
    x: 40,
    y: 624,
    w: 680,
    h: 300,
  })

  return { sheets: [g.sheet('Itinerary')], active: 0 }
}

// ============================================================================
// 4. GPA tracker
// ============================================================================

function makeGpaTracker(): SheetsContent {
  const accent = '#7c3aed'
  const soft = '#ede9fe'
  const softText = '#5b21b6'
  const g = new Grid()
  g.colWidths = { 0: 220, 1: 80, 2: 80, 3: 100, 4: 110 }

  g.val(0, 1, 'GPA Tracker', TITLE)
  g.val(0, 2, '[Your Name] · B.S. Computer Science · Cumulative through Spring 2026', SUBTITLE)

  kpiCard(g, 0, 0, 4, 'Cumulative GPA', f('B30'), accent, { format: 'number', decimals: 2 })
  kpiCard(g, 2, 2, 4, 'Total credits', f('B28'), accent)
  kpiCard(g, 4, 4, 4, 'Courses completed', f('COUNTA(A9:A13,A19:A23)'), accent)

  const gradePts = (cellRef: string) =>
    f(
      `IFS(${cellRef}="A",4,${cellRef}="A-",3.7,${cellRef}="B+",3.3,${cellRef}="B",3,${cellRef}="B-",2.7,${cellRef}="C+",2.3,${cellRef}="C",2,${cellRef}="C-",1.7,${cellRef}="D+",1.3,${cellRef}="D",1,${cellRef}="F",0)`,
    )

  // ---- Fall 2025 ----
  g.val(0, 7, 'Fall 2025', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 4; c++) g.style(c, 7, { fill: soft })
  g.headerRow(8, 0, ['Course', 'Credits', 'Grade', 'Grade pts', 'Quality pts'], accent)
  const fall: [string, number, string][] = [
    ['Intro to Programming', 4, 'A'],
    ['Calculus I', 4, 'B+'],
    ['English Composition', 3, 'A-'],
    ['World History', 3, 'B'],
    ['Intro to Psychology', 3, 'A'],
  ]
  fall.forEach(([course, credits, grade], i) => {
    const r = 9 + i
    const zebra = i % 2 === 1 ? { fill: '#f5f3ff' } : undefined
    g.val(0, r, course, zebra)
    g.val(1, r, credits, { ...zebra, align: 'center' })
    g.val(2, r, grade, { ...zebra, align: 'center' })
    g.val(3, r, gradePts(`C${r}`), { ...zebra, align: 'center', format: 'number', decimals: 1 })
    g.val(4, r, f(`B${r}*D${r}`), { ...zebra, align: 'center', format: 'number', decimals: 1 })
  })
  g.val(0, 14, 'Semester total', { bold: true, borders: { top: true } })
  g.val(1, 14, f('SUM(B9:B13)'), { bold: true, align: 'center', borders: { top: true } })
  g.val(4, 14, f('SUM(E9:E13)'), { bold: true, align: 'center', format: 'number', decimals: 1, borders: { top: true } })
  g.val(0, 15, 'Semester GPA', { bold: true, fill: soft, color: softText })
  g.val(1, 15, f('E14/B14'), { bold: true, fill: soft, color: softText, format: 'number', decimals: 2 })
  g.box(0, 7, 4, 15)

  // ---- Spring 2026 ----
  g.val(0, 17, 'Spring 2026', { bold: true, fill: soft, color: softText })
  for (let c = 1; c <= 4; c++) g.style(c, 17, { fill: soft })
  g.headerRow(18, 0, ['Course', 'Credits', 'Grade', 'Grade pts', 'Quality pts'], accent)
  const spring: [string, number, string][] = [
    ['Data Structures', 4, 'A-'],
    ['Linear Algebra', 3, 'B'],
    ['Statistics', 3, 'A'],
    ['Technical Writing', 3, 'B+'],
    ['Database Systems', 4, 'A'],
  ]
  spring.forEach(([course, credits, grade], i) => {
    const r = 19 + i
    const zebra = i % 2 === 1 ? { fill: '#f5f3ff' } : undefined
    g.val(0, r, course, zebra)
    g.val(1, r, credits, { ...zebra, align: 'center' })
    g.val(2, r, grade, { ...zebra, align: 'center' })
    g.val(3, r, gradePts(`C${r}`), { ...zebra, align: 'center', format: 'number', decimals: 1 })
    g.val(4, r, f(`B${r}*D${r}`), { ...zebra, align: 'center', format: 'number', decimals: 1 })
  })
  g.val(0, 24, 'Semester total', { bold: true, borders: { top: true } })
  g.val(1, 24, f('SUM(B19:B23)'), { bold: true, align: 'center', borders: { top: true } })
  g.val(4, 24, f('SUM(E19:E23)'), { bold: true, align: 'center', format: 'number', decimals: 1, borders: { top: true } })
  g.val(0, 25, 'Semester GPA', { bold: true, fill: soft, color: softText })
  g.val(1, 25, f('E24/B24'), { bold: true, fill: soft, color: softText, format: 'number', decimals: 2 })
  g.box(0, 17, 4, 25)

  // ---- Cumulative ----
  g.val(0, 27, 'Cumulative Summary', { bold: true, fill: soft, color: softText })
  g.style(1, 27, { fill: soft })
  g.val(0, 28, 'Total credits')
  g.val(1, 28, f('B14+B24'), { align: 'center' })
  g.val(0, 29, 'Total quality points')
  g.val(1, 29, f('E14+E24'), { align: 'center', format: 'number', decimals: 1 })
  g.val(0, 30, 'Cumulative GPA', { bold: true, borders: { top: true } })
  g.val(1, 30, f('B29/B28'), { bold: true, align: 'center', format: 'number', decimals: 2, borders: { top: true } })
  g.box(0, 27, 1, 30)

  return { sheets: [g.sheet('GPA')], active: 0 }
}

// ============================================================================
// 5. Reading log
// ============================================================================

function makeReadingLog(): SheetsContent {
  const accent = '#a16207'
  const soft = '#fef9c3'
  const softText = '#713f12'
  const g = new Grid()
  g.colWidths = { 0: 210, 1: 150, 2: 65, 3: 95, 4: 95, 5: 110, 6: 60, 7: 85 }

  g.val(0, 1, 'Reading Log', TITLE)
  g.val(0, 2, '2026 reading challenge · Goal: 24 books', SUBTITLE)

  kpiCard(g, 0, 1, 4, 'Books finished', f('COUNTIF(F8:F19,"Finished")'), accent)
  kpiCard(g, 3, 4, 4, 'In progress', f('COUNTIF(F8:F19,"In progress")'), accent)
  kpiCard(g, 6, 7, 4, 'Pages read', f('SUMIF(F8:F19,"Finished",C8:C19)'), accent)

  g.headerRow(7, 0, ['Title', 'Author', 'Pages', 'Started', 'Finished', 'Status', 'Days', 'Pages/day'], accent)

  const statusStyle: Record<string, CellStyle> = {
    Finished: { fill: '#dcfce7', color: '#166534' },
    'In progress': { fill: '#fef3c7', color: '#92400e' },
    'Want to read': { fill: '#f3f4f6', color: '#6b7280' },
  }

  // Started/Finished are built with DATE(y,m,d) formulas rather than raw ISO
  // strings — the engine only treats *numeric* cell values as real dates
  // (format:'date' just formats a number), so a formula date is required for
  // the Days column below to be able to subtract them.
  type YMD = [number, number, number] | null
  const books: [string, string, number, YMD, YMD, string][] = [
    ['Fourth Wing', 'Rebecca Yarros', 512, [2026, 1, 3], [2026, 1, 15], 'Finished'],
    ['Atomic Habits', 'James Clear', 320, [2026, 1, 16], [2026, 1, 24], 'Finished'],
    ['The Song of Achilles', 'Madeline Miller', 416, [2026, 1, 25], [2026, 2, 5], 'Finished'],
    ['Project Hail Mary', 'Andy Weir', 496, [2026, 2, 6], [2026, 2, 20], 'Finished'],
    ['Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin', 416, [2026, 2, 21], [2026, 3, 2], 'Finished'],
    ['Educated', 'Tara Westover', 352, [2026, 3, 3], [2026, 3, 14], 'Finished'],
    ['The Midnight Library', 'Matt Haig', 304, [2026, 3, 15], [2026, 3, 22], 'Finished'],
    ['Circe', 'Madeline Miller', 400, [2026, 3, 23], [2026, 4, 2], 'Finished'],
    ['Sapiens', 'Yuval Noah Harari', 464, [2026, 4, 10], null, 'In progress'],
    ['Lessons in Chemistry', 'Bonnie Garmus', 400, null, null, 'Want to read'],
    ['The Seven Husbands of Evelyn Hugo', 'Taylor Jenkins Reid', 400, null, null, 'Want to read'],
    ['Klara and the Sun', 'Kazuo Ishiguro', 320, null, null, 'Want to read'],
  ]
  books.forEach(([title, author, pages, started, finished, status], i) => {
    const r = 8 + i
    const zebra = i % 2 === 1 ? { fill: '#fefce8' } : undefined
    g.val(0, r, title, zebra)
    g.val(1, r, author, zebra)
    g.val(2, r, pages, { ...zebra, align: 'center' })
    if (started) g.val(3, r, f(`DATE(${started[0]},${started[1]},${started[2]})`), { ...zebra, format: 'date' })
    else g.style(3, r, { ...zebra })
    if (finished) g.val(4, r, f(`DATE(${finished[0]},${finished[1]},${finished[2]})`), { ...zebra, format: 'date' })
    else g.style(4, r, { ...zebra })
    g.val(5, r, status, { ...zebra, ...statusStyle[status], align: 'center', bold: true })
    g.val(6, r, f(`IF(D${r}="","",IF(E${r}="","",E${r}-D${r}))`), { ...zebra, align: 'center' })
    g.val(7, r, f(`IF(OR(G${r}="",G${r}=0),"",ROUND(C${r}/G${r},1))`), { ...zebra, align: 'center' })
  })
  g.box(0, 7, 7, 19)

  g.val(0, 21, 'Reading Pace', { bold: true, fill: soft, color: softText })
  g.style(1, 21, { fill: soft })
  g.val(0, 22, 'Books finished')
  g.val(1, 22, f('COUNTIF(F8:F19,"Finished")'), { align: 'center' })
  g.val(0, 23, 'Total pages read')
  g.val(1, 23, f('SUMIF(F8:F19,"Finished",C8:C19)'), { align: 'center' })
  g.val(0, 24, 'Avg days per book')
  g.val(1, 24, f('AVERAGEIF(F8:F19,"Finished",G8:G19)'), { align: 'center', format: 'number', decimals: 1 })
  g.val(0, 25, 'Avg pages per day', { bold: true, borders: { top: true } })
  g.val(1, 25, f('AVERAGEIF(F8:F19,"Finished",H8:H19)'), {
    bold: true,
    align: 'center',
    format: 'number',
    decimals: 1,
    borders: { top: true },
  })
  g.box(0, 21, 1, 25)

  return { sheets: [g.sheet('Reading Log')], active: 0 }
}

// ============================================================================
// 6. Event guest list
// ============================================================================

function makeEventGuestList(): SheetsContent {
  const accent = '#a21caf'
  const soft = '#fae8ff'
  const softText = '#701a75'
  const g = new Grid()
  g.colWidths = { 0: 190, 1: 100, 2: 100, 3: 120, 4: 170 }

  g.val(0, 1, 'Event Guest List', TITLE)
  g.val(0, 2, '[Event name] · Saturday, Sept 12, 2026 · Venue: [Venue name]', SUBTITLE)

  kpiCard(g, 0, 0, 4, 'Total invited', f('COUNTA(A8:A27)'), accent)
  kpiCard(g, 2, 2, 4, 'Confirmed guests', f('SUMIF(C8:C27,"Yes",B8:B27)'), accent)
  kpiCard(g, 4, 4, 4, 'Response rate', f('(COUNTIF(C8:C27,"Yes")+COUNTIF(C8:C27,"No"))/COUNTA(A8:A27)'), accent, {
    format: 'percent',
  })

  g.headerRow(7, 0, ['Guest / Party', 'Party size', 'RSVP', 'Meal choice', 'Notes'], accent)

  const rsvpStyle: Record<string, CellStyle> = {
    Yes: { fill: '#dcfce7', color: '#166534' },
    No: { fill: '#fee2e2', color: '#991b1b' },
    Pending: { fill: '#fef3c7', color: '#92400e' },
  }

  const guests: [string, number, string, string, string][] = [
    ['Sarah & Mike Chen', 2, 'Yes', 'Chicken', 'Allergic to shellfish'],
    ['Priya Patel', 1, 'Yes', 'Vegetarian', ''],
    ['James & Laura Wilson', 2, 'Yes', 'Fish', ''],
    ['The Martinez Family', 4, 'Yes', 'Kids meal', '2 children under 10'],
    ['David Kim', 1, 'Pending', '—', ''],
    ['Emma Thompson', 1, 'Yes', 'Chicken', ''],
    ['Robert & Angela Davis', 2, 'No', '—', "Traveling, can't attend"],
    ['Sophia Rodriguez', 1, 'Yes', 'Vegetarian', ''],
    ['The Nguyen Family', 3, 'Yes', 'Fish', ''],
    ['Chris & Taylor Brooks', 2, 'Pending', '—', ''],
    ['Olivia Bennett', 1, 'Yes', 'Chicken', ''],
    ['Marcus Johnson', 1, 'Yes', 'Vegetarian', 'Gluten-free'],
    ['The Patel Family', 3, 'Yes', 'Chicken', ''],
    ['Grace Lee', 1, 'No', '—', ''],
    ['Ethan & Mia Carter', 2, 'Yes', 'Fish', ''],
    ['Aunt Carol & Uncle Frank', 2, 'Yes', 'Chicken', ''],
    ['Ben Foster', 1, 'Pending', '—', ''],
    ['Isabella Garcia', 1, 'Yes', 'Vegetarian', ''],
    ['The Osei Family', 4, 'Yes', 'Kids meal', ''],
    ['Noah & Ava Bell', 2, 'Yes', 'Fish', ''],
  ]
  guests.forEach(([name, size, rsvp, meal, notes], i) => {
    const r = 8 + i
    const zebra = i % 2 === 1 ? { fill: '#fdf4ff' } : undefined
    g.val(0, r, name, zebra)
    g.val(1, r, size, { ...zebra, align: 'center' })
    g.val(2, r, rsvp, { ...zebra, ...rsvpStyle[rsvp], align: 'center', bold: true })
    g.val(3, r, meal, { ...zebra, align: 'center' })
    g.val(4, r, notes, zebra)
  })
  g.val(0, 28, 'Total attending', { bold: true, borders: { top: true } })
  g.val(1, 28, f('SUMIF(C8:C27,"Yes",B8:B27)'), { bold: true, align: 'center', borders: { top: true } })
  g.box(0, 7, 4, 28)

  g.val(0, 30, 'RSVP Summary', { bold: true, fill: soft, color: softText })
  g.style(1, 30, { fill: soft })
  g.val(3, 30, 'Meal Choices', { bold: true, fill: soft, color: softText })
  g.style(4, 30, { fill: soft })

  g.headerRow(31, 0, ['Status', 'Count'], accent)
  g.headerRow(31, 3, ['Meal', 'Count'], accent)

  const rsvpCounts = ['Yes', 'No', 'Pending']
  rsvpCounts.forEach((status, i) => {
    const r = 32 + i
    g.val(0, r, status)
    g.val(1, r, f(`COUNTIF(C8:C27,"${status}")`), { align: 'center' })
  })
  g.val(0, 35, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 35, f('SUM(B32:B34)'), { bold: true, align: 'center', borders: { top: true } })
  g.box(0, 31, 1, 35)

  const meals = ['Chicken', 'Fish', 'Vegetarian', 'Kids meal']
  meals.forEach((meal, i) => {
    const r = 32 + i
    g.val(3, r, meal)
    g.val(4, r, f(`COUNTIF(D8:D27,"${meal}")`), { align: 'center' })
  })
  g.box(3, 31, 4, 35)

  g.charts.push({
    id: uid(),
    type: 'pie',
    title: 'RSVP breakdown',
    labelRange: 'A32:A34',
    dataRanges: ['B32:B34'],
    x: 720,
    y: 696,
    w: 380,
    h: 280,
  })

  return { sheets: [g.sheet('Guest List')], active: 0 }
}

// ============================================================================
// 7. Workout program
// ============================================================================

function makeWorkoutProgram(): SheetsContent {
  const accent = '#65a30d'
  const soft = '#ecfccb'
  const softText = '#3f6212'
  const g = new Grid()
  g.colWidths = { 0: 190, 1: 60, 2: 60, 3: 100, 4: 100 }

  g.val(0, 1, '4-Week Workout Program', TITLE)
  g.val(0, 2, 'Strength cycle — squat / bench / deadlift focus, linear progression', SUBTITLE)

  kpiCard(g, 0, 1, 4, 'Total volume (4 wks)', f('SUM(E9:E13,E18:E22,E27:E31,E36:E40)'), accent, {
    format: 'number',
    decimals: 0,
  })
  kpiCard(g, 3, 3, 4, 'Avg weekly volume', f('AVERAGE(B45:B48)'), accent, { format: 'number', decimals: 0 })
  kpiCard(g, 4, 4, 4, 'Heaviest lift (lb)', f('MAX(D9:D13,D18:D22,D27:D31,D36:D40)'), accent)

  type Week = [string, number, number, number][]
  const weeks: { label: string; exercises: Week }[] = [
    {
      label: 'Week 1',
      exercises: [
        ['Back squat', 3, 5, 135],
        ['Bench press', 3, 5, 115],
        ['Deadlift', 1, 5, 155],
        ['Overhead press', 3, 5, 75],
        ['Barbell row', 3, 5, 95],
      ],
    },
    {
      label: 'Week 2',
      exercises: [
        ['Back squat', 3, 5, 140],
        ['Bench press', 3, 5, 120],
        ['Deadlift', 1, 5, 170],
        ['Overhead press', 3, 5, 80],
        ['Barbell row', 3, 5, 100],
      ],
    },
    {
      label: 'Week 3',
      exercises: [
        ['Back squat', 3, 5, 145],
        ['Bench press', 3, 5, 125],
        ['Deadlift', 1, 5, 185],
        ['Overhead press', 3, 5, 85],
        ['Barbell row', 3, 5, 105],
      ],
    },
    {
      label: 'Week 4',
      exercises: [
        ['Back squat', 3, 5, 150],
        ['Bench press', 3, 5, 130],
        ['Deadlift', 1, 5, 200],
        ['Overhead press', 3, 5, 90],
        ['Barbell row', 3, 5, 110],
      ],
    },
  ]
  const sectionTop = [7, 16, 25, 34]
  const zebraFill = '#f7fee7'
  weeks.forEach((week, wi) => {
    const top = sectionTop[wi]
    g.val(0, top, week.label, { bold: true, fill: soft, color: softText })
    for (let c = 1; c <= 4; c++) g.style(c, top, { fill: soft })
    g.headerRow(top + 1, 0, ['Exercise', 'Sets', 'Reps', 'Weight (lb)', 'Volume'], accent)
    week.exercises.forEach(([exercise, sets, reps, weight], i) => {
      const r = top + 2 + i
      const zebra = i % 2 === 1 ? { fill: zebraFill } : undefined
      g.val(0, r, exercise, zebra)
      g.val(1, r, sets, { ...zebra, align: 'center' })
      g.val(2, r, reps, { ...zebra, align: 'center' })
      g.val(3, r, weight, { ...zebra, align: 'center' })
      g.val(4, r, f(`B${r}*C${r}*D${r}`), { ...zebra, align: 'center', bold: true })
    })
    const subtotalRow = top + 7
    g.val(0, subtotalRow, `${week.label} total volume`, { bold: true, borders: { top: true } })
    g.val(4, subtotalRow, f(`SUM(E${top + 2}:E${top + 6})`), {
      bold: true,
      align: 'center',
      format: 'number',
      decimals: 0,
      borders: { top: true },
    })
    g.box(0, top, 4, subtotalRow)
  })

  g.val(0, 43, 'Weekly Volume Summary', { bold: true, fill: soft, color: softText })
  g.style(1, 43, { fill: soft })
  g.headerRow(44, 0, ['Week', 'Total volume'], accent)
  ;['Week 1', 'Week 2', 'Week 3', 'Week 4'].forEach((label, i) => {
    const r = 45 + i
    g.val(0, r, label)
    g.val(1, r, f(`E${14 + i * 9}`), { align: 'center', format: 'number', decimals: 0 })
  })
  g.val(0, 49, 'Total', { bold: true, borders: { top: true } })
  g.val(1, 49, f('SUM(B45:B48)'), { bold: true, align: 'center', format: 'number', decimals: 0, borders: { top: true } })
  g.box(0, 44, 1, 49)

  g.charts.push({
    id: uid(),
    type: 'line',
    title: 'Weekly volume progression',
    labelRange: 'A45:A48',
    dataRanges: ['B45:B48'],
    x: 290,
    y: 1008,
    w: 420,
    h: 280,
  })

  return { sheets: [g.sheet('Program')], active: 0 }
}

// ============================================================================
// Template registry
// ============================================================================

export const sheetsPlanningTemplates: SheetsTemplate[] = [
  {
    id: 'meal-planner-grocery-list',
    name: 'Meal Planner & Grocery List',
    description: 'Plan a week of breakfasts, lunches, and dinners, then shop from an auto-costed grocery list by category.',
    category: 'Personal',
    accent: '#0d9488',
    glyph: '🍽️',
    make: makeMealPlanner,
  },
  {
    id: 'wedding-budget',
    name: 'Wedding Budget Tracker',
    description: 'Track budgeted vs. actual spend by category with automatic variance, share of total, and a cost-breakdown chart.',
    category: 'Events',
    accent: '#db2777',
    glyph: '💍',
    make: makeWeddingBudget,
  },
  {
    id: 'travel-itinerary-budget',
    name: 'Travel Itinerary & Budget',
    description: 'Plan a day-by-day trip schedule alongside a daily expense budget that totals automatically.',
    category: 'Personal',
    accent: '#0284c7',
    glyph: '✈️',
    make: makeTravelItinerary,
  },
  {
    id: 'gpa-tracker',
    name: 'GPA Tracker',
    description: 'Log courses and letter grades each term with automatic grade points and a running cumulative GPA.',
    category: 'Education',
    accent: '#7c3aed',
    glyph: '🧮',
    make: makeGpaTracker,
  },
  {
    id: 'reading-log',
    name: 'Reading Log',
    description: 'Track books read toward a yearly goal with automatic finished counts, pages read, and reading pace.',
    category: 'Personal',
    accent: '#a16207',
    glyph: '📚',
    make: makeReadingLog,
  },
  {
    id: 'event-guest-list',
    name: 'Event Guest List & RSVPs',
    description: 'Track invitees, RSVP status, and meal choices with automatic headcount and response-rate summaries.',
    category: 'Events',
    accent: '#a21caf',
    glyph: '🎉',
    make: makeEventGuestList,
  },
  {
    id: 'workout-program',
    name: '4-Week Workout Program',
    description: 'Plan a progressive strength program with per-session volume and automatic weekly totals and trend chart.',
    category: 'Personal',
    accent: '#65a30d',
    glyph: '💪',
    make: makeWorkoutProgram,
  },
]
