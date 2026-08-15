// Unit tests for the chart geometry module and the two renderers that share it.
// The point of chartGeom.ts is that ChartRender.tsx and chartSvg.ts cannot
// drift, so the last section renders the same spec through both and compares
// the geometry they emit number for number.
// Run: npx vite build --ssr src/apps/sheets/chart.test.ts --outDir .tmp-charttest \
//        && node .tmp-charttest/chart.test.js

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChartType } from '../../shared/types'
import type { ChartData } from './chartData'
import {
  buildChartScene,
  categoryCount,
  chartFamily,
  decimalsForStep,
  fmtAxis,
  fmtCompact,
  fmtNumber,
  isHorizontal,
  isStacked,
  labelAt,
  niceScale,
  niceStep,
  paint,
  resolveOptions,
  seriesColor,
  slicePath,
  stackTotals,
  textWidth,
  truncate,
  valueAt,
  CHART_COLORS,
  type ChartNode,
  type ChartScene,
  type ChartSpecLike,
  type Palette,
} from './chartGeom'
import { chartSceneSvg } from './chartSvg'
import ChartRender from './ChartRender'

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

function data(labels: string[], series: Array<[string, Array<number | undefined>]>): ChartData {
  return { labels, series: series.map(([name, values]) => ({ name, values: values as number[] })) }
}

const ALL_TYPES: ChartType[] = [
  'bar',
  'column',
  'stackedBar',
  'stackedColumn',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'combo',
]

// ---------- tick selection ----------

eq('niceStep: 1 ladder', niceStep(50), 10)
eq('niceStep: 2 ladder', niceStep(100), 20)
eq('niceStep: 5 ladder', niceStep(250), 50)
eq('niceStep: sub-unit', niceStep(0.5), 0.1)
ok('niceStep: only 1/2/5 mantissas', [1, 5, 9, 37, 120, 640, 8300, 91000, 0.03, 0.7].every((r) => {
  const s = niceStep(r)
  const m = s / Math.pow(10, Math.floor(Math.log10(s)))
  return Math.abs(m - 1) < 1e-9 || Math.abs(m - 2) < 1e-9 || Math.abs(m - 5) < 1e-9
}))
eq('niceStep: zero range falls back to 1', niceStep(0), 1)
eq('niceStep: negative range falls back to 1', niceStep(-5), 1)
eq('niceStep: NaN falls back to 1', niceStep(NaN), 1)

const s1 = niceScale(0, 100)
eq('niceScale: round ticks', s1.ticks, [0, 20, 40, 60, 80, 100])
eq('niceScale: domain min', s1.min, 0)
eq('niceScale: domain max', s1.max, 100)

const s2 = niceScale(0, 97)
ok('niceScale: covers the data', s2.max >= 97 && s2.min <= 0, s2.ticks)
ok('niceScale: no ugly decimals', s2.ticks.every((t) => Number.isInteger(t)), s2.ticks)

const s3 = niceScale(-40, 90)
ok('niceScale: negatives covered', s3.min <= -40 && s3.max >= 90, s3.ticks)
ok('niceScale: includes zero when it straddles', s3.ticks.includes(0), s3.ticks)

const s4 = niceScale(0, 0.35)
ok('niceScale: fractional ticks stay short', s4.ticks.every((t) => String(t).replace('-', '').replace(/^\d*\.?/, '').length <= 2), s4.ticks)

const s5 = niceScale(0, 1234567)
ok('niceScale: large range terminates', s5.ticks.length > 1 && s5.ticks.length < 30, s5.ticks.length)
ok('niceScale: large ticks are exact', s5.ticks.every((t) => Number.isFinite(t) && t % s5.step === 0), s5.ticks)

eq('niceScale: flat zero series', niceScale(0, 0).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1])
const flatPos = niceScale(7, 7)
ok('niceScale: flat positive series spans zero to above it', flatPos.min === 0 && flatPos.max >= 7, flatPos)
const flatNeg = niceScale(-7, -7)
ok('niceScale: flat negative series spans below it to zero', flatNeg.max === 0 && flatNeg.min <= -7, flatNeg)
const swapped = niceScale(90, 10)
ok('niceScale: swaps reversed bounds', swapped.min <= 10 && swapped.max >= 90, swapped)
const nan = niceScale(NaN, NaN)
ok('niceScale: NaN bounds produce a usable domain', nan.ticks.every(Number.isFinite) && nan.ticks.length > 1, nan.ticks)
const inf = niceScale(-Infinity, Infinity)
ok('niceScale: infinite bounds produce a usable domain', inf.ticks.every(Number.isFinite), inf.ticks)
ok('niceScale: tick count is bounded', niceScale(0, 1e18).ticks.length <= 201)

// ---------- number formatting ----------

eq('decimalsForStep: whole steps', decimalsForStep(5), 0)
eq('decimalsForStep: tenths', decimalsForStep(0.2), 1)
eq('decimalsForStep: hundredths', decimalsForStep(0.05), 2)
eq('fmtNumber: grouping', fmtNumber(1234567, 0), '1,234,567')
eq('fmtNumber: decimals kept', fmtNumber(3.5, 1), '3.5')
eq('fmtNumber: negative', fmtNumber(-2500, 0), '-2,500')
eq('fmtNumber: negative zero loses its sign', fmtNumber(-0.2, 0), '0')
eq('fmtNumber: non-finite is blank', fmtNumber(NaN, 0), '')
eq('fmtCompact: millions', fmtCompact(2500000), '2.5M')
eq('fmtCompact: thousands', fmtCompact(42000), '42k')
eq('fmtCompact: small numbers untouched', fmtCompact(950), '950')
eq('fmtCompact: billions', fmtCompact(3.2e9), '3.2B')
eq('fmtCompact: trillions', fmtCompact(2.5e12), '2.5T')
ok('fmtCompact: the ladder never grows the number it shortens', [1e5, 1e7, 4.2e9, 2.5e12, 9e14].every((v) => fmtCompact(v).length <= fmtNumber(v, 0).length), [fmtCompact(2.5e12), fmtCompact(9e14)])
eq('fmtAxis: coarse step abbreviates', fmtAxis(2000000, 500000), '2M')
eq('fmtAxis: fine step keeps digits', fmtAxis(12000, 10), '12,000')
eq('fmtAxis: decimals follow the step', fmtAxis(0.4, 0.2), '0.4')
ok('fmtAxis: never leaks float dust', !fmtAxis(0.30000000000000004, 0.1).includes('0000'), fmtAxis(0.30000000000000004, 0.1))

eq('truncate: short strings pass through', truncate('Q1', 12), 'Q1')
eq('truncate: long strings get an ellipsis', truncate('September Total', 12), 'September T…')
ok('textWidth: grows with length', textWidth('abcd', 10) > textWidth('ab', 10))
ok('textWidth: grows with size', textWidth('ab', 12) > textWidth('ab', 9))

// ---------- colours and paint roles ----------

eq('seriesColor: first colour', seriesColor(0), CHART_COLORS[0])
eq('seriesColor: wraps past the palette', seriesColor(CHART_COLORS.length + 2), CHART_COLORS[2])
ok('seriesColor: 12 series all get a colour', Array.from({ length: 12 }, (_, i) => seriesColor(i)).every((c) => /^#[0-9a-f]{6}$/.test(c)))
const testPalette: Palette = { text: 'T', text2: 'T2', text3: 'T3', line: 'L', surface: 'S' }
eq('paint: hex passes through', paint('#2563eb', testPalette), '#2563eb')
eq('paint: role resolves', paint('text3', testPalette), 'T3')

// ---------- spec resolution ----------

eq('chartFamily: column', chartFamily('column'), 'cartesian')
eq('chartFamily: donut', chartFamily('donut'), 'pie')
eq('chartFamily: scatter', chartFamily('scatter'), 'scatter')
ok('isStacked: both stacked types', isStacked('stackedBar') && isStacked('stackedColumn'))
ok('isStacked: plain types are not', !isStacked('column') && !isStacked('bar'))
ok('legacy bar stays vertical', !isHorizontal('bar') && !isHorizontal('column'))
ok('stackedBar is the horizontal one', isHorizontal('stackedBar') && !isHorizontal('stackedColumn'))

const twoSeries = data(['A', 'B'], [['S1', [1, 2]], ['S2', [3, 4]]])
const oneSeries = data(['A', 'B'], [['S1', [1, 2]]])
eq('resolveOptions: gridlines default on', resolveOptions({ type: 'column', title: '' }, twoSeries).gridlines, true)
eq('resolveOptions: data labels default off', resolveOptions({ type: 'column', title: '' }, twoSeries).dataLabels, false)
eq('resolveOptions: legend defaults to bottom for many series', resolveOptions({ type: 'column', title: '' }, twoSeries).legend, 'bottom')
eq('resolveOptions: no legend for a single series', resolveOptions({ type: 'column', title: '' }, oneSeries).legend, 'none')
eq('resolveOptions: pie keeps its slice callouts by default', resolveOptions({ type: 'pie', title: '' }, twoSeries).legend, 'none')
eq('resolveOptions: explicit legend wins', resolveOptions({ type: 'column', title: '', legend: 'right' }, oneSeries).legend, 'right')
eq('resolveOptions: combo defaults the last series to a line', resolveOptions({ type: 'combo', title: '' }, twoSeries).lineSeries, [1])
eq('resolveOptions: combo with one series has no line', resolveOptions({ type: 'combo', title: '' }, oneSeries).lineSeries, [])
eq('resolveOptions: non-combo has no lines', resolveOptions({ type: 'column', title: '' }, twoSeries).lineSeries, [])
eq('resolveOptions: out-of-range lineSeries dropped', resolveOptions({ type: 'combo', title: '', lineSeries: [0, 5, -1] }, twoSeries).lineSeries, [0])
eq('resolveOptions: explicit empty lineSeries respected', resolveOptions({ type: 'combo', title: '', lineSeries: [] }, twoSeries).lineSeries, [])

// ---------- data shaping ----------

eq('valueAt: number', valueAt({ name: 's', values: [4] }, 0), 4)
eq('valueAt: missing index', valueAt({ name: 's', values: [4] }, 3), null)
eq('valueAt: NaN is missing', valueAt({ name: 's', values: [NaN] }, 0), null)
eq('valueAt: Infinity is missing', valueAt({ name: 's', values: [Infinity] }, 0), null)

const stackSeries = [
  { name: 'a', values: [10, -5, 0] },
  { name: 'b', values: [20, -15, 0] },
  { name: 'c', values: [5] },
]
const totals = stackTotals(stackSeries, 3)
eq('stackTotals: positives accumulate', totals.pos, [35, 0, 0])
eq('stackTotals: negatives accumulate separately', totals.neg, [0, -20, 0])
eq('stackTotals: short series contribute nothing past their end', stackTotals([{ name: 'a', values: [1] }], 3).pos, [1, 0, 0])
eq('stackTotals: zero categories', stackTotals(stackSeries, 0), { pos: [], neg: [] })

eq('categoryCount: longest series wins', categoryCount(data(['A'], [['s1', [1]], ['s2', [1, 2, 3]]])), 3)
eq('categoryCount: no series', categoryCount({ labels: [], series: [] }), 0)
eq('labelAt: uses the label', labelAt(data(['Jan'], [['s', [1]]]), 0), 'Jan')
eq('labelAt: falls back to the row number', labelAt(data([], [['s', [1]]]), 0), '1')
eq('labelAt: blank label falls back too', labelAt(data([''], [['s', [1]]]), 0), '1')

// ---------- slice paths ----------

const wedge = slicePath(50, 50, 40, 0, 0, Math.PI / 2)
ok('slicePath: wedge starts at the centre', wedge.startsWith('M50,50'))
ok('slicePath: wedge has no NaN', !/NaN/.test(wedge))
const ring = slicePath(50, 50, 40, 20, 0, Math.PI / 2)
ok('slicePath: ring segment does not touch the centre', !ring.includes('M50,50'), ring)
ok('slicePath: ring segment has two arcs', (ring.match(/A/g) ?? []).length === 2, ring)
const fullPie = slicePath(50, 50, 40, 0, 0, Math.PI * 2)
ok('slicePath: a whole circle is two half arcs, not a zero-length wedge', (fullPie.match(/A/g) ?? []).length === 2, fullPie)
const fullRing = slicePath(50, 50, 40, 20, 0, Math.PI * 2)
ok('slicePath: a whole ring keeps its hole', (fullRing.match(/A/g) ?? []).length === 4, fullRing)
ok('slicePath: no NaN in any full turn', !/NaN/.test(fullPie + fullRing))

// ---------- scene sanity ----------

function nodeNumbers(n: ChartNode): number[] {
  switch (n.t) {
    case 'rect':
      return [n.x, n.y, n.w, n.h, n.rx ?? 0, n.opacity ?? 1]
    case 'line':
      return [n.x1, n.y1, n.x2, n.y2, n.sw ?? 1, n.opacity ?? 1]
    case 'circle':
      return [n.cx, n.cy, n.r]
    case 'path':
      return [n.sw ?? 1, n.opacity ?? 1]
    case 'text':
      return [n.x, n.y, n.size, n.weight ?? 400, n.rotate ?? 0]
  }
}

function sceneProblems(scene: ChartScene): string[] {
  const bad: string[] = []
  for (const n of scene.nodes) {
    for (const v of nodeNumbers(n)) if (!Number.isFinite(v)) bad.push(`${n.t}: non-finite ${v}`)
    if (n.t === 'rect' && (n.w < 0 || n.h < 0)) bad.push(`rect: negative size ${n.w}x${n.h}`)
    if (n.t === 'circle' && n.r < 0) bad.push('circle: negative radius')
    if (n.t === 'path' && /NaN|Infinity|undefined/.test(n.d)) bad.push(`path: ${n.d.slice(0, 60)}`)
    if (n.t === 'text' && /NaN|undefined/.test(n.s)) bad.push(`text: ${n.s}`)
  }
  return bad
}

function textsOf(scene: ChartScene): string[] {
  return scene.nodes.filter((n): n is Extract<ChartNode, { t: 'text' }> => n.t === 'text').map((n) => n.s)
}

const healthy = data(
  ['Q1', 'Q2', 'Q3', 'Q4'],
  [['Revenue', [120, 340, 210, 480]], ['Costs', [90, 150, 180, 260]]],
)

for (const type of ALL_TYPES) {
  const scene = buildChartScene({ type, title: 'T' }, healthy, 380, 260)
  eq(`${type}: scene keeps its size`, [scene.width, scene.height], [380, 260])
  ok(`${type}: draws something`, scene.nodes.length > 3, scene.nodes.length)
  eq(`${type}: no NaN or negative geometry`, sceneProblems(scene), [])
  ok(`${type}: title is drawn`, textsOf(scene).includes('T'))
}

// ---------- degenerate inputs ----------

const degenerate: Array<[string, ChartData]> = [
  ['no series', { labels: [], series: [] }],
  ['no rows', data([], [['s', []]])],
  ['one row', data(['only'], [['s', [42]]])],
  ['all zeros', data(['a', 'b', 'c'], [['s', [0, 0, 0]]])],
  ['all negative', data(['a', 'b'], [['s', [-5, -12]]])],
  ['mixed signs', data(['a', 'b', 'c'], [['s', [-5, 12, -3]]])],
  ['non-numeric cells', data(['a', 'b', 'c'], [['s', [undefined, 5, NaN]]])],
  ['ragged series', data(['a', 'b', 'c'], [['s1', [1, 2, 3]], ['s2', [9]]])],
  ['huge values', data(['a', 'b'], [['s', [1e12, 2.5e12]]])],
  ['tiny values', data(['a', 'b'], [['s', [0.0004, 0.0009]]])],
  ['single series', data(['a', 'b'], [['only', [3, 4]]])],
  ['long labels', data(['A very long category name indeed', 'Another enormous label'], [['s', [3, 4]]])],
]
for (const [label, d] of degenerate) {
  for (const type of ALL_TYPES) {
    const scene = buildChartScene({ type, title: '' }, d, 300, 200)
    eq(`${type} / ${label}: renders cleanly`, sceneProblems(scene), [])
  }
}

const twelve = data(
  ['a', 'b', 'c'],
  Array.from({ length: 12 }, (_, i) => [`Series ${i + 1}`, [i + 1, i + 2, i + 3]] as [string, number[]]),
)
for (const type of ALL_TYPES) {
  eq(`${type} / 12 series: renders cleanly`, sceneProblems(buildChartScene({ type, title: '' }, twelve, 420, 300)), [])
}
const twelveLegend = buildChartScene({ type: 'column', title: '', legend: 'right' }, twelve, 420, 200)
ok(
  '12 series: a right legend that cannot fit says how many are hidden',
  textsOf(twelveLegend).some((s) => /^\+\d+ more$/.test(s)),
  textsOf(twelveLegend),
)

const emptyScene = buildChartScene({ type: 'column', title: 'T' }, { labels: [], series: [] }, 300, 200)
eq('no data: says so', textsOf(emptyScene), ['No data'])
const zeroPie = buildChartScene({ type: 'pie', title: '' }, data(['a', 'b'], [['s', [0, 0]]]), 300, 200)
eq('pie of zeros: says no data rather than drawing a blank ring', textsOf(zeroPie), ['No data'])
ok('degenerate size: clamped rather than inverted', buildChartScene({ type: 'column', title: '' }, healthy, -50, 0).width >= 60)

// ---------- axis behaviour ----------

const cols = buildChartScene({ type: 'column', title: '' }, healthy, 380, 260)
// Legend swatches are rects too, so orientation and bar-count checks turn it off.
const bare = (type: ChartType, extra: Partial<ChartSpecLike> = {}, d: ChartData = healthy) =>
  buildChartScene({ type, title: '', legend: 'none', ...extra }, d, 400, 260)
const rectsOf = (scene: ChartScene) => scene.nodes.filter((n): n is Extract<ChartNode, { t: 'rect' }> => n.t === 'rect')
eq('column: one rect per value', rectsOf(bare('column')).length, 8)
const stacked = buildChartScene({ type: 'stackedColumn', title: '' }, healthy, 380, 260)
const stackedTicks = textsOf(stacked)
ok(
  'stackedColumn: axis reaches the cumulative total, not the largest single value',
  stackedTicks.some((t) => Number(t.replace(/,/g, '')) >= 740),
  stackedTicks,
)
const grouped = buildChartScene({ type: 'column', title: '' }, healthy, 380, 260)
ok(
  'column: axis stops near the largest single value',
  textsOf(grouped).every((t) => Number(t.replace(/,/g, '')) < 740 || isNaN(Number(t))),
  textsOf(grouped),
)

// Category labels: trim to the band while that still reads, then rotate.
const months = data(
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  [['s', Array.from({ length: 12 }, (_, i) => i + 1)]],
)
const crowded = buildChartScene({ type: 'column', title: '' }, months, 320, 220)
ok(
  'crowded labels: rotated rather than shaved to nothing',
  crowded.nodes.some((n) => n.t === 'text' && n.rotate === -45),
  textsOf(crowded),
)
ok('crowded labels: kept long enough to identify', textsOf(crowded).includes('September'), textsOf(crowded))
const roomy = buildChartScene({ type: 'column', title: '' }, data(['September Total', 'October Total'], [['s', [1, 2]]]), 380, 240)
ok('roomy labels: left upright', roomy.nodes.every((n) => n.t !== 'text' || !n.rotate), textsOf(roomy))
ok('roomy labels: shown in full when they fit', textsOf(roomy).includes('September Total'), textsOf(roomy))
const narrow = buildChartScene({ type: 'column', title: '' }, data(['September Total', 'October Total', 'November Total', 'December Total'], [['s', [1, 2, 3, 4]]]), 260, 200)
ok(
  'narrow labels: trimmed with an ellipsis rather than overlapping',
  textsOf(narrow).some((t) => t.endsWith('…')),
  textsOf(narrow),
)

const negScene = buildChartScene({ type: 'column', title: '' }, data(['a', 'b'], [['s', [-40, 60]]]), 300, 200)
ok('negatives: the axis dips below zero', textsOf(negScene).some((t) => t.startsWith('-')), textsOf(negScene))

const gridOn = buildChartScene({ type: 'column', title: '', gridlines: true }, healthy, 380, 260)
const gridOff = buildChartScene({ type: 'column', title: '', gridlines: false }, healthy, 380, 260)
ok(
  'gridlines: switching them off removes lines',
  gridOff.nodes.filter((n) => n.t === 'line').length < gridOn.nodes.filter((n) => n.t === 'line').length,
)
ok('gridlines: the baseline survives', gridOff.nodes.some((n) => n.t === 'line'))
eq(
  'gridlines: the tick labels survive',
  textsOf(gridOff).length,
  textsOf(gridOn).length,
)

const titled = buildChartScene({ type: 'column', title: '', xTitle: 'Quarter', yTitle: 'Revenue' }, healthy, 380, 260)
ok('axis titles: x title drawn', textsOf(titled).includes('Quarter'))
ok('axis titles: y title drawn', textsOf(titled).includes('Revenue'))
ok(
  'axis titles: the y title is rotated upright',
  titled.nodes.some((n) => n.t === 'text' && n.s === 'Revenue' && n.rotate === -90),
)
ok(
  'axis titles: the plot shifts right to make room',
  (titled.nodes.find((n) => n.t === 'rect') as { x: number }).x >
    (cols.nodes.find((n) => n.t === 'rect') as { x: number }).x,
)

const labelled = buildChartScene({ type: 'column', title: '', dataLabels: true }, healthy, 420, 300)
ok('data labels: values appear', textsOf(labelled).includes('480'), textsOf(labelled))
ok('data labels: off by default', !textsOf(cols).includes('480'))
const stackedLabelled = buildChartScene({ type: 'stackedColumn', title: '', dataLabels: true }, healthy, 420, 300)
ok('data labels: a stack is labelled with its total', textsOf(stackedLabelled).includes('740'), textsOf(stackedLabelled))

const legendRight = buildChartScene({ type: 'column', title: '', legend: 'right' }, healthy, 380, 260)
const legendNone = buildChartScene({ type: 'column', title: '', legend: 'none' }, healthy, 380, 260)
function plotRight(scene: ChartScene): number {
  let max = 0
  for (const n of scene.nodes) if (n.t === 'line') max = Math.max(max, n.x2)
  return max
}
ok('legend right: the plot gives up width for it', plotRight(legendRight) < plotRight(legendNone), [plotRight(legendRight), plotRight(legendNone)])
ok('legend right: series names are drawn', textsOf(legendRight).includes('Revenue') && textsOf(legendRight).includes('Costs'))
ok('legend none: series names are not drawn', !textsOf(legendNone).includes('Revenue'))
const legendBottom = buildChartScene({ type: 'column', title: '', legend: 'bottom' }, healthy, 380, 260)
ok('legend bottom: sits below the plot', legendBottom.nodes.some((n) => n.t === 'text' && n.s === 'Revenue' && n.y > 200), textsOf(legendBottom))
const piePlusLegend = buildChartScene({ type: 'pie', title: '', legend: 'bottom' }, healthy, 380, 260)
ok('legend: a pie legend names its slices, not its series', textsOf(piePlusLegend).includes('Q1'), textsOf(piePlusLegend))

// ---------- scatter ----------

const scatterData = data(['', '', ''], [['X', [100, 110, 120]], ['Y', [55, 58, 61]]])
const scatter = buildChartScene({ type: 'scatter', title: '' }, scatterData, 400, 260)
const scatterTexts = textsOf(scatter).map((t) => Number(t.replace(/,/g, ''))).filter((n) => Number.isFinite(n))
ok('scatter: the y axis frames the data instead of starting at zero', Math.min(...scatterTexts) >= 50, scatterTexts)
ok('scatter: the x axis frames the data too', scatterTexts.some((n) => n >= 100 && n <= 125), scatterTexts)
eq('scatter: one point per pair', scatter.nodes.filter((n) => n.t === 'circle').length, 3)
const scatterOne = buildChartScene({ type: 'scatter', title: '' }, data([], [['Y', [5, 6, 7]]]), 400, 260)
eq('scatter: a lone series is plotted against its row number', scatterOne.nodes.filter((n) => n.t === 'circle').length, 3)
const scatterFlat = buildChartScene({ type: 'scatter', title: '' }, data([], [['X', [5, 5]], ['Y', [2, 2]]]), 300, 200)
eq('scatter: a completely flat cloud still renders', sceneProblems(scatterFlat), [])
const scatterGaps = buildChartScene(
  { type: 'scatter', title: '' },
  data([], [['X', [1, undefined, 3]], ['Y', [4, 5, undefined]]]),
  300,
  200,
)
eq('scatter: pairs with a missing half are skipped', scatterGaps.nodes.filter((n) => n.t === 'circle').length, 1)

// ---------- pie and donut ----------

const pieData = data(['A', 'B', 'C'], [['s', [50, 30, 20]]])
const pie = buildChartScene({ type: 'pie', title: '' }, pieData, 300, 240)
eq('pie: one wedge per slice', pie.nodes.filter((n) => n.t === 'path').length, 3)
ok('pie: percentages are drawn', textsOf(pie).includes('50%'), textsOf(pie))
const donut = buildChartScene({ type: 'donut', title: '' }, pieData, 300, 240)
eq('donut: one ring segment per slice', donut.nodes.filter((n) => n.t === 'path').length, 3)
ok('donut: the total sits in the hole', textsOf(donut).includes('100'), textsOf(donut))
const arcCount = (scene: ChartScene) =>
  scene.nodes.filter((n): n is Extract<ChartNode, { t: 'path' }> => n.t === 'path').map((n) => (n.d.match(/A/g) ?? []).length)
eq('pie: a wedge is one arc back to the centre', arcCount(pie), [1, 1, 1])
eq('donut: a ring segment is an outer and an inner arc', arcCount(donut), [2, 2, 2])
const onePie = buildChartScene({ type: 'pie', title: '' }, data(['only'], [['s', [7]]]), 300, 240)
eq('pie: a single slice renders', onePie.nodes.filter((n) => n.t === 'path').length, 1)
eq('pie: a single slice has clean geometry', sceneProblems(onePie), [])
const negPie = buildChartScene({ type: 'pie', title: '' }, data(['a', 'b'], [['s', [-4, 10]]]), 300, 240)
eq('pie: negative slices are dropped rather than drawn backwards', negPie.nodes.filter((n) => n.t === 'path').length, 1)

// ---------- combo ----------

const combo = bare('combo', { lineSeries: [1] })
eq('combo: the column series is drawn as bars', rectsOf(combo).length, 4)
ok('combo: the line series is drawn as a stroked path', combo.nodes.some((n) => n.t === 'path' && !!n.stroke))
eq('combo: every series can be a line', rectsOf(bare('combo', { lineSeries: [0, 1] })).length, 0)
eq('combo: no lines means plain grouped columns', rectsOf(bare('combo', { lineSeries: [] })).length, 8)
ok(
  'combo: columns and the line share one value axis',
  JSON.stringify(textsOf(bare('combo', { lineSeries: [1] }))) === JSON.stringify(textsOf(bare('column'))),
  textsOf(combo),
)

// ---------- line gaps ----------

const gapLine = buildChartScene({ type: 'line', title: '' }, data(['a', 'b', 'c', 'd'], [['s', [1, undefined, 3, 4]]]), 300, 200)
eq('line: a gap splits the path rather than dropping to zero', gapLine.nodes.filter((n) => n.t === 'path').length, 2)
const areaScene = buildChartScene({ type: 'area', title: '' }, oneSeries, 300, 200)
ok('area: a filled band accompanies the line', areaScene.nodes.some((n) => n.t === 'path' && !!n.fill && n.fill !== 'none'))

// ---------- bar keeps its historical meaning ----------

const asBar = buildChartScene({ type: 'bar', title: '' }, healthy, 380, 260)
const asColumn = buildChartScene({ type: 'column', title: '' }, healthy, 380, 260)
eq("'bar' still draws exactly what 'column' draws", JSON.stringify(asBar.nodes), JSON.stringify(asColumn.nodes))
const sbRects = rectsOf(bare('stackedBar'))
const scRects = rectsOf(bare('stackedColumn'))
ok('stackedBar and stackedColumn differ in orientation', JSON.stringify(sbRects) !== JSON.stringify(scRects))
// A stack runs along one axis: the bar's thickness on the other axis is fixed.
ok('stackedBar segments share a fixed height and vary in width', new Set(sbRects.map((r) => r.h)).size === 1 && new Set(sbRects.map((r) => r.w)).size > 1, sbRects.slice(0, 2))
ok('stackedColumn segments share a fixed width and vary in height', new Set(scRects.map((r) => r.w)).size === 1 && new Set(scRects.map((r) => r.h)).size > 1, scRects.slice(0, 2))
eq('stackedColumn: two series stack into one bar per category', scRects.length, 8)

// ---------- nothing is drawn outside the frame ----------

// The svg is clipped at its own edge, so a label placed past it is not "slightly
// off" — it is gone. Boxes are estimated the same generous way textWidth() is.
type TextNode = Extract<ChartNode, { t: 'text' }>
function inkBox(n: TextNode): [number, number, number, number] {
  const tw = textWidth(n.s, n.size)
  const asc = n.size * 0.8
  const desc = n.size * 0.2
  // Rotated about (x, y): the corners land where sin/cos 45° put them.
  if (n.rotate === -45) return [n.x - 0.707 * (tw + asc), n.y - 0.707 * asc, n.x + 0.707 * desc, n.y + 0.707 * (tw + desc)]
  if (n.rotate === -90) return [n.x - asc, n.y - tw / 2, n.x + desc, n.y + tw / 2]
  const x0 = n.anchor === 'end' ? n.x - tw : n.anchor === 'middle' ? n.x - tw / 2 : n.x
  return [x0, n.y - asc, x0 + tw, n.y + desc]
}

// Half a pixel of slack, which is what r2() rounds to; nothing needs more.
function outsideFrame(scene: ChartScene, tol = 0.5): string[] {
  const bad: string[] = []
  const check = (x0: number, y0: number, x1: number, y1: number, what: string) => {
    if (x0 < -tol || y0 < -tol || x1 > scene.width + tol || y1 > scene.height + tol) bad.push(what)
  }
  for (const n of scene.nodes) {
    if (n.t === 'rect') check(n.x, n.y, n.x + n.w, n.y + n.h, `rect ${n.x},${n.y} ${n.w}x${n.h}`)
    else if (n.t === 'circle') check(n.cx - n.r, n.cy - n.r, n.cx + n.r, n.cy + n.r, `circle ${n.cx},${n.cy}`)
    else if (n.t === 'text') {
      const [x0, y0, x1, y1] = inkBox(n)
      check(x0, y0, x1, y1, `text ${JSON.stringify(n.s)} ${x0.toFixed(1)},${y0.toFixed(1)}..${x1.toFixed(1)},${y1.toFixed(1)}`)
    }
  }
  return bad
}

const wide = data(['a', 'b'], [['s', [900, 1500]]])
// Long enough that the bottom band hits its ceiling — the labels have to be cut
// to what the band holds, or their tails hang off the bottom of the chart.
const longRotated = data(
  Array.from({ length: 12 }, (_, i) => `Northwest Region ${i + 1} extremely long`),
  [['s', Array.from({ length: 12 }, (_, i) => i + 1)]],
)
const framed: Array<[string, ChartSpecLike, ChartData]> = [
  ['data labels', { type: 'column', title: '', dataLabels: true }, oneSeries],
  ['data labels on the top tick', { type: 'column', title: '', dataLabels: true }, pieData],
  ['data labels below zero', { type: 'column', title: '', dataLabels: true }, data(['a', 'b'], [['s', [-40, 60]]])],
  ['stacked labels', { type: 'stackedColumn', title: '', dataLabels: true }, healthy],
  ['horizontal labels', { type: 'stackedBar', title: '', dataLabels: true }, oneSeries],
  ['horizontal negatives', { type: 'stackedBar', title: '', dataLabels: true }, data(['a', 'b'], [['s', [-30, -50]]])],
  ['line labels', { type: 'line', title: '', dataLabels: true }, healthy],
  ['scatter labels', { type: 'scatter', title: '', dataLabels: true }, scatterData],
  ['wide tick labels', { type: 'stackedBar', title: '' }, wide],
  ['huge tick labels', { type: 'stackedBar', title: '' }, data(['a', 'b'], [['s', [1e12, 2.5e12]]])],
  ['pie callouts', { type: 'pie', title: '' }, healthy],
  ['pie callouts beside a legend', { type: 'pie', title: '', legend: 'right' }, healthy],
  ['pie callouts above a legend', { type: 'pie', title: '', legend: 'bottom' }, healthy],
  ['donut callouts beside a legend', { type: 'donut', title: '', legend: 'right', dataLabels: true }, healthy],
  ['long legend names', { type: 'column', title: '', legend: 'right' }, data(['a', 'b'], [['A very long series name', [1, 2]], ['Another very long one', [3, 4]]])],
  ['an overflowing legend', { type: 'column', title: '', legend: 'right' }, twelve],
  ['rotated labels', { type: 'column', title: '' }, months],
  ['rotated long labels', { type: 'column', title: '' }, longRotated],
]
for (const [name, spec, d] of framed) {
  for (const [fw, fh] of [[400, 280], [220, 140], [1200, 800]] as Array<[number, number]>) {
    eq(`frame / ${name} @ ${fw}x${fh}`, outsideFrame(buildChartScene(spec, d, fw, fh)), [])
  }
}

// A value printed beside its mark needs somewhere to go, so the plot gives up a
// strip: without it the tallest bar's label is drawn above the frame.
const topLabelled = buildChartScene({ type: 'column', title: '', dataLabels: true, legend: 'none' }, oneSeries, 400, 280)
const topBar = rectsOf(topLabelled).reduce((a, b) => (a.y <= b.y ? a : b))
ok(
  'data labels: the tallest bar still has room above it',
  textsOf(topLabelled).includes('2.0') && topBar.y > 12,
  topBar.y,
)
const negLabelled = buildChartScene({ type: 'column', title: '', dataLabels: true, legend: 'none' }, data(['a', 'b'], [['s', [-40, 60]]]), 400, 280)
const belowBar = negLabelled.nodes.find((n): n is TextNode => n.t === 'text' && n.s === '-40' && n.size === 9)
const catLabel = negLabelled.nodes.find((n): n is TextNode => n.t === 'text' && n.s === 'a')
ok(
  'data labels: one below the axis does not land on the category label',
  !!belowBar && !!catLabel && catLabel.y - belowBar.y >= 10,
  [belowBar?.y, catLabel?.y],
)

// A horizontal stack runs left from zero when it is negative, so its total has
// to go left too — printed on the right it would sit on top of the bar.
const hNeg = buildChartScene({ type: 'stackedBar', title: '', dataLabels: true, legend: 'none' }, data(['a', 'b'], [['s', [-30, -50]]]), 400, 280)
const hNegBar = rectsOf(hNeg).reduce((a, b) => (a.x <= b.x ? a : b))
const hNegLabel = hNeg.nodes.find((n): n is TextNode => n.t === 'text' && n.s === '-50' && n.size === 9)
ok(
  'horizontal stack: a negative total is printed clear of its bar',
  !!hNegLabel && hNegLabel.anchor === 'end' && hNegLabel.x <= hNegBar.x,
  [hNegLabel?.x, hNegLabel?.anchor, hNegBar.x],
)

// The legend column is capped at a third of the chart, so the name has to be cut
// to the column it got rather than to the 16 characters it asked for.
const tightLegend = buildChartScene(
  { type: 'column', title: '', legend: 'right' },
  data(['a', 'b'], [['A very long series name', [1, 2]], ['Another very long one', [3, 4]]]),
  220,
  140,
)
ok(
  'legend right: names are cut to the column, not just to 16 characters',
  textsOf(tightLegend).some((s) => s.endsWith('…') && s.length < 16),
  textsOf(tightLegend),
)

// ---------- the two renderers agree ----------

// Colours are the one thing that legitimately differs (theme vars vs the
// exported page's vars), so strip them before comparing — along with the
// namespace URI the export needs and the standalone string carries digits in.
function geometryOf(svg: string): number[] {
  const stripped = svg
    .replace(/\sxmlns="[^"]*"/g, '')
    .replace(/\s(?:fill|stroke)="[^"]*"/g, '')
    .replace(/>[^<]*</g, '><')
  return (stripped.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
}
// React and escapeHtml() spell the same character differently (&#x27; vs &#39;),
// which is not a divergence — decode before comparing so the check is about the
// text each renderer shows, not about which entity it reached for.
function labelsOf(svg: string): string[] {
  return Array.from(svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)).map((m) =>
    m[1]
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  )
}

const parityCases: Array<[string, ChartSpecLike, ChartData]> = [
  ['column', { type: 'column', title: 'Sales' }, healthy],
  ['stackedColumn', { type: 'stackedColumn', title: '', legend: 'right' }, healthy],
  ['stackedBar', { type: 'stackedBar', title: 'H', dataLabels: true }, healthy],
  ['line', { type: 'line', title: '', xTitle: 'Quarter', yTitle: 'Revenue' }, healthy],
  ['area', { type: 'area', title: '', gridlines: false }, oneSeries],
  ['pie', { type: 'pie', title: 'Split' }, pieData],
  ['donut', { type: 'donut', title: '', legend: 'bottom' }, pieData],
  ['scatter', { type: 'scatter', title: 'Cloud', dataLabels: true }, scatterData],
  ['combo', { type: 'combo', title: '', lineSeries: [1] }, healthy],
  ['12 series', { type: 'column', title: 'Many', legend: 'right' }, twelve],
  ['no data', { type: 'column', title: 'Empty' }, { labels: [], series: [] }],
  ['rotated labels', { type: 'column', title: '' }, months],
  ['data labels', { type: 'column', title: '', dataLabels: true }, oneSeries],
  ['negative horizontal stack', { type: 'stackedBar', title: '', dataLabels: true }, data(['a', 'b'], [['s', [-30, -50]]])],
  // Apostrophes and ampersands are ordinary in a spreadsheet and the two
  // renderers escape them by different routes; the drawn text must still match.
  ['escaped labels', { type: 'column', title: "Q1 '24 <b>&</b>" }, data(["Q1 '24", 'A&B'], [["O'Brien & Co", [3, 4]]])],
]

for (const [name, spec, d] of parityCases) {
  const exported = chartSceneSvg(spec, d, 400, 280)
  const live = renderToStaticMarkup(React.createElement(ChartRender, { spec, data: d, width: 400, height: 280 }))
  eq(`parity / ${name}: identical geometry`, geometryOf(live), geometryOf(exported))
  eq(`parity / ${name}: identical text`, labelsOf(live), labelsOf(exported))
  ok(`parity / ${name}: export emits no NaN`, !/NaN|undefined/.test(exported), exported.slice(0, 120))
  ok(`parity / ${name}: live emits no NaN`, !/NaN|undefined/.test(live), live.slice(0, 120))
}

const exportedSvg = chartSceneSvg({ type: 'column', title: 'X' }, healthy, 400, 280)
ok('export: is a self-contained svg element', exportedSvg.startsWith('<svg') && exportedSvg.endsWith('</svg>'))
// The xmlns is a namespace identifier, never fetched; nothing else may look like a URL.
ok('export: references nothing over the network', !/https?:|url\(/.test(exportedSvg.replace(/\sxmlns="[^"]*"/g, '')))
ok('export: declares the svg namespace so it stands alone', exportedSvg.includes('xmlns="http://www.w3.org/2000/svg"'))
ok('export: uses the living-page colour vars', exportedSvg.includes('var(--ink)') || exportedSvg.includes('var(--muted)'))
ok('export: escapes markup in labels', chartSceneSvg({ type: 'column', title: '<b>&</b>' }, healthy, 300, 200).includes('&lt;b&gt;&amp;&lt;/b&gt;'))

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} assertions)`)
if (failed) process.exitCode = 1
else console.log('ALL CHART TESTS PASSED')
