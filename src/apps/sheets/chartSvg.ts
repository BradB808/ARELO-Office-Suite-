// Static SVG rendering for charts embedded in the "Living spreadsheet" export.
// This mirrors the layout math in ChartRender.tsx (the live in-app renderer)
// but emits a plain SVG markup string instead of JSX, computed once at export
// time from the sheet's values as they are the moment you export — it does
// not recalculate after the reader edits a cell (see livingExport.ts / notes).
//
// Uses the CSS custom properties defined by LIVING_BASE_CSS (--ink / --muted
// / --line), not the app's own theme vars, since this only ever runs inside
// an exported standalone page.

import type { ChartSpec } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { extractChartData, type ChartData } from './chartData'
import { escapeHtml } from '../../shared/livingDoc'

export const CHART_COLORS = [
  '#2563eb',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#7c3aed',
  '#0ea5e9',
  '#eab308',
  '#db2777',
  '#14b8a6',
  '#4f46e5',
]

function niceStep(range: number, targetTicks = 5): number {
  if (range <= 0) return 1
  const rough = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  let step: number
  if (norm < 1.5) step = 1
  else if (norm < 3) step = 2
  else if (norm < 7) step = 5
  else step = 10
  return step * mag
}

function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    if (min === 0) return [0, 1]
    max = min > 0 ? min * 1.2 : 0
    min = min > 0 ? 0 : min * 1.2
  }
  const step = niceStep(max - min)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

function fmtTick(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/** Renders one chart to a self-contained <svg>…</svg> string using values computed at export time. */
export function renderChartSvg(spec: ChartSpec, computed: Map<string, ComputedCell>, width: number, height: number): string {
  const data = extractChartData(computed, spec)
  const hasData = data.series.length > 0 && data.series[0].values.length > 0
  if (!hasData) {
    return svgWrap(width, height, `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="12" fill="var(--muted)">No data</text>`)
  }
  if (spec.type === 'pie') return renderPie(spec.title, data, width, height)
  return renderCartesian(spec.type, spec.title, data, width, height)
}

function svgWrap(width: number, height: number, inner: string): string {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">${inner}</svg>`
}

function renderCartesian(type: ChartSpec['type'], title: string, data: ChartData, width: number, height: number): string {
  const { labels, series } = data
  const showLegend = series.length > 1
  const padTop = title ? 26 : 10
  const padBottom = 26
  const padLeft = 40
  const padRight = 12
  const legendH = showLegend ? 18 : 0
  const plotTop = padTop + legendH
  const plotW = Math.max(10, width - padLeft - padRight)
  const plotH = Math.max(10, height - plotTop - padBottom)

  let min = 0
  let max = 0
  for (const s of series) for (const v of s.values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const ticks = niceTicks(min, max)
  const domainMin = ticks[0]
  const domainMax = ticks[ticks.length - 1]
  const yFor = (v: number) => plotTop + plotH - ((v - domainMin) / (domainMax - domainMin || 1)) * plotH
  const n = labels.length
  const bandW = plotW / Math.max(1, n)

  let out = ''
  if (title) {
    out += `<text x="${width / 2}" y="16" text-anchor="middle" font-size="12.5" font-weight="600" fill="var(--ink)">${escapeHtml(title)}</text>`
  }
  if (showLegend) {
    out += '<g>'
    series.forEach((s, i) => {
      const itemW = Math.min(120, plotW / series.length)
      const x = padLeft + i * itemW
      out += `<g transform="translate(${x},${padTop + 4})"><rect width="9" height="9" rx="2" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/><text x="13" y="8.5" font-size="10.5" fill="var(--muted)">${escapeHtml(s.name)}</text></g>`
    })
    out += '</g>'
  }
  ticks.forEach((t) => {
    const y = yFor(t)
    out += `<line x1="${padLeft}" x2="${width - padRight}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`
    out += `<text x="${padLeft - 6}" y="${y + 3}" text-anchor="end" font-size="9.5" fill="var(--muted)">${escapeHtml(fmtTick(t))}</text>`
  })
  labels.forEach((l, i) => {
    out += `<text x="${padLeft + bandW * i + bandW / 2}" y="${height - padBottom + 14}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${escapeHtml(truncate(l, 10))}</text>`
  })

  if (type === 'bar') {
    series.forEach((s, si) => {
      const groupW = bandW * 0.7
      const barW = groupW / series.length
      s.values.forEach((v, i) => {
        const x = padLeft + bandW * i + (bandW - groupW) / 2 + si * barW
        const y0 = yFor(0)
        const y1 = yFor(v)
        const top = Math.min(y0, y1)
        const h = Math.abs(y1 - y0)
        out += `<rect x="${x}" y="${top}" width="${Math.max(1, barW - 2)}" height="${Math.max(0, h)}" rx="1.5" fill="${CHART_COLORS[si % CHART_COLORS.length]}"/>`
      })
    })
  } else {
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => [padLeft + bandW * i + bandW / 2, yFor(v)] as const)
      const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
      const color = CHART_COLORS[si % CHART_COLORS.length]
      out += '<g>'
      if (type === 'area' && pts.length) {
        const areaPath = `${linePath} L${pts[pts.length - 1][0]},${yFor(domainMin)} L${pts[0][0]},${yFor(domainMin)} Z`
        out += `<path d="${areaPath}" fill="${color}" opacity="0.16" stroke="none"/>`
      }
      out += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      pts.forEach(([x, y]) => {
        out += `<circle cx="${x}" cy="${y}" r="2.6" fill="${color}"/>`
      })
      out += '</g>'
    })
  }
  return svgWrap(width, height, out)
}

function renderPie(title: string, data: ChartData, width: number, height: number): string {
  const series = data.series[0]
  const total = series.values.reduce((a, b) => a + Math.max(0, b), 0)
  const cx = width / 2
  const cy = title ? (height + 16) / 2 : height / 2
  const r = Math.max(10, Math.min(width, height - (title ? 30 : 8)) / 2 - 8)
  let angle = -Math.PI / 2

  function arcPath(startA: number, endA: number): string {
    const x1 = cx + r * Math.cos(startA)
    const y1 = cy + r * Math.sin(startA)
    const x2 = cx + r * Math.cos(endA)
    const y2 = cy + r * Math.sin(endA)
    const large = endA - startA > Math.PI ? 1 : 0
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
  }

  let out = ''
  if (title) out += `<text x="${width / 2}" y="16" text-anchor="middle" font-size="12.5" font-weight="600" fill="var(--ink)">${escapeHtml(title)}</text>`
  if (total <= 0) {
    out += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="11" fill="var(--muted)">No data</text>`
  } else {
    series.values.forEach((v, i) => {
      const frac = Math.max(0, v) / total
      const start = angle
      const end = angle + frac * Math.PI * 2
      angle = end
      const color = CHART_COLORS[i % CHART_COLORS.length]
      out += `<path d="${arcPath(start, end)}" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>`
      if (frac > 0.03) {
        const mid = (start + end) / 2
        const lx = cx + (r + 14) * Math.cos(mid)
        const ly = cy + (r + 14) * Math.sin(mid)
        out += `<text x="${lx}" y="${ly}" text-anchor="${Math.cos(mid) > 0 ? 'start' : 'end'}" font-size="9.5" fill="var(--muted)">${Math.round(frac * 100)}%</text>`
      }
    })
  }
  return svgWrap(width, height, out)
}
