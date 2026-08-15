// Static SVG rendering for charts embedded in the "Living spreadsheet" export.
// Layout is not computed here: buildChartScene() in chartGeom.ts produces the
// same primitives the live renderer draws, so an exported chart is the on-screen
// chart. Values are frozen at export time — the page does not recalculate after
// the reader edits a cell (see livingExport.ts).
//
// Paint roles resolve to the custom properties LIVING_BASE_CSS defines (--ink /
// --muted / --line), not the app's own theme vars, since this only ever runs
// inside an exported standalone page.

import type { ChartSpec } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { extractChartData, type ChartData } from './chartData'
import { escapeHtml } from '../../shared/livingDoc'
import { buildChartScene, paint, type ChartNode, type ChartSpecLike, type Palette } from './chartGeom'

export { CHART_COLORS } from './chartGeom'

const EXPORT_PALETTE: Palette = {
  text: 'var(--ink)',
  text2: 'var(--muted)',
  text3: 'var(--muted)',
  line: 'var(--line)',
  surface: 'var(--surface)',
}

const num = (n: number): string => String(n)

function attr(name: string, v: string | number | undefined): string {
  return v === undefined ? '' : ` ${name}="${v}"`
}

function nodeMarkup(n: ChartNode): string {
  const c = (p: string) => paint(p, EXPORT_PALETTE)
  switch (n.t) {
    case 'rect':
      return `<rect x="${num(n.x)}" y="${num(n.y)}" width="${num(n.w)}" height="${num(n.h)}"${attr('rx', n.rx)} fill="${c(n.fill)}"${attr('opacity', n.opacity)}/>`
    case 'line':
      return `<line x1="${num(n.x1)}" y1="${num(n.y1)}" x2="${num(n.x2)}" y2="${num(n.y2)}" stroke="${c(n.stroke)}" stroke-width="${n.sw ?? 1}"${attr('opacity', n.opacity)}/>`
    case 'circle':
      return `<circle cx="${num(n.cx)}" cy="${num(n.cy)}" r="${num(n.r)}" fill="${c(n.fill)}"/>`
    case 'path':
      return (
        `<path d="${n.d}" fill="${n.fill ? c(n.fill) : 'none'}"` +
        (n.evenodd ? ' fill-rule="evenodd"' : '') +
        attr('stroke', n.stroke ? c(n.stroke) : undefined) +
        attr('stroke-width', n.sw) +
        ' stroke-linejoin="round" stroke-linecap="round"' +
        attr('opacity', n.opacity) +
        '/>'
      )
    case 'text':
      return (
        `<text x="${num(n.x)}" y="${num(n.y)}" font-size="${num(n.size)}" fill="${c(n.fill)}"` +
        attr('text-anchor', n.anchor) +
        attr('font-weight', n.weight) +
        (n.rotate ? ` transform="rotate(${n.rotate} ${num(n.x)} ${num(n.y)})"` : '') +
        `>${escapeHtml(n.s)}</text>`
      )
  }
}

function svgWrap(width: number, height: number, inner: string): string {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">${inner}</svg>`
}

/** Renders a spec plus already-extracted data to a self-contained <svg> string. */
export function chartSceneSvg(spec: ChartSpecLike, data: ChartData, width: number, height: number): string {
  const scene = buildChartScene(spec, data, width, height)
  return svgWrap(scene.width, scene.height, scene.nodes.map(nodeMarkup).join(''))
}

/** Renders one chart to a self-contained <svg>…</svg> string using values computed at export time. */
export function renderChartSvg(spec: ChartSpec, computed: Map<string, ComputedCell>, width: number, height: number): string {
  return chartSceneSvg(spec, extractChartData(computed, spec), width, height)
}
