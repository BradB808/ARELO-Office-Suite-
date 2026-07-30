import React from 'react'
import type { ChartData } from './chartData'

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

export default function ChartRender({
  type,
  title,
  data,
  width,
  height,
}: {
  type: 'bar' | 'line' | 'pie' | 'area'
  title: string
  data: ChartData
  width: number
  height: number
}) {
  const { labels, series } = data
  const hasData = series.length > 0 && series[0].values.length > 0
  const showLegend = series.length > 1

  if (!hasData) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="var(--text-3)">
          No data
        </text>
      </svg>
    )
  }

  if (type === 'pie') {
    return <PieChart title={title} labels={labels} series={series[0]} width={width} height={height} />
  }

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

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {title && (
        <text x={width / 2} y={16} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--text)">
          {title}
        </text>
      )}
      {showLegend && (
        <g>
          {series.map((s, i) => {
            const itemW = Math.min(120, plotW / series.length)
            const x = padLeft + i * itemW
            return (
              <g key={i} transform={`translate(${x},${padTop + 4})`}>
                <rect width={9} height={9} rx={2} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                <text x={13} y={8.5} fontSize={10.5} fill="var(--text-2)">
                  {s.name}
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* gridlines + y ticks */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padLeft} x2={width - padRight} y1={yFor(t)} y2={yFor(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={padLeft - 6} y={yFor(t) + 3} textAnchor="end" fontSize={9.5} fill="var(--text-3)">
            {fmtTick(t)}
          </text>
        </g>
      ))}

      {/* x labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={padLeft + bandW * i + bandW / 2}
          y={height - padBottom + 14}
          textAnchor="middle"
          fontSize={9.5}
          fill="var(--text-3)"
        >
          {truncate(l, 10)}
        </text>
      ))}

      {type === 'bar' &&
        series.map((s, si) => {
          const groupW = bandW * 0.7
          const barW = groupW / series.length
          return s.values.map((v, i) => {
            const x = padLeft + bandW * i + (bandW - groupW) / 2 + si * barW
            const y0 = yFor(0)
            const y1 = yFor(v)
            const top = Math.min(y0, y1)
            const h = Math.abs(y1 - y0)
            return (
              <rect
                key={si + '-' + i}
                x={x}
                y={top}
                width={Math.max(1, barW - 2)}
                height={Math.max(0, h)}
                rx={1.5}
                fill={CHART_COLORS[si % CHART_COLORS.length]}
              />
            )
          })
        })}

      {(type === 'line' || type === 'area') &&
        series.map((s, si) => {
          const pts = s.values.map((v, i) => [padLeft + bandW * i + bandW / 2, yFor(v)] as const)
          const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
          const areaPath = `${linePath} L${pts[pts.length - 1][0]},${yFor(domainMin)} L${pts[0][0]},${yFor(domainMin)} Z`
          const color = CHART_COLORS[si % CHART_COLORS.length]
          return (
            <g key={si}>
              {type === 'area' && <path d={areaPath} fill={color} opacity={0.16} stroke="none" />}
              <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={2.6} fill={color} />
              ))}
            </g>
          )
        })}
    </svg>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function PieChart({
  title,
  labels,
  series,
  width,
  height,
}: {
  title: string
  labels: string[]
  series: { name: string; values: number[] }
  width: number
  height: number
}) {
  const total = series.values.reduce((a, b) => a + Math.max(0, b), 0)
  const cx = width / 2
  const cy = title ? (height + 16) / 2 : height / 2
  const r = Math.max(10, Math.min(width, height - (title ? 30 : 8)) / 2 - 8)
  let angle = -Math.PI / 2
  const slices = series.values.map((v, i) => {
    const frac = total > 0 ? Math.max(0, v) / total : 0
    const start = angle
    const end = angle + frac * Math.PI * 2
    angle = end
    return { start, end, frac, label: labels[i] ?? String(i + 1), color: CHART_COLORS[i % CHART_COLORS.length] }
  })

  function arcPath(startA: number, endA: number): string {
    const x1 = cx + r * Math.cos(startA)
    const y1 = cy + r * Math.sin(startA)
    const x2 = cx + r * Math.cos(endA)
    const y2 = cy + r * Math.sin(endA)
    const large = endA - startA > Math.PI ? 1 : 0
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {title && (
        <text x={width / 2} y={16} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--text)">
          {title}
        </text>
      )}
      {total <= 0 ? (
        <text x={cx} y={cy} textAnchor="middle" fontSize={11} fill="var(--text-3)">
          No data
        </text>
      ) : (
        slices.map((s, i) => {
          const mid = (s.start + s.end) / 2
          const lx = cx + (r + 14) * Math.cos(mid)
          const ly = cy + (r + 14) * Math.sin(mid)
          const showLabel = s.frac > 0.03
          return (
            <g key={i}>
              <path d={arcPath(s.start, s.end)} fill={s.color} stroke="var(--surface)" strokeWidth={1.5} />
              {showLabel && (
                <text x={lx} y={ly} textAnchor={Math.cos(mid) > 0 ? 'start' : 'end'} fontSize={9.5} fill="var(--text-2)">
                  {Math.round(s.frac * 100)}%
                </text>
              )}
            </g>
          )
        })
      )}
    </svg>
  )
}
