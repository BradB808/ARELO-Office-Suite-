// The live on-canvas renderer. All layout maths lives in chartGeom.ts, which
// chartSvg.ts (the export renderer) shares — this file only turns the scene's
// primitives into JSX and resolves paint roles to the app's theme variables.

import React from 'react'
import type { ChartData } from './chartData'
import {
  buildChartScene,
  paint,
  type ChartNode,
  type ChartSpecLike,
  type Palette,
} from './chartGeom'

export { CHART_COLORS } from './chartGeom'

const APP_PALETTE: Palette = {
  text: 'var(--text)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  line: 'var(--border)',
  surface: 'var(--surface)',
}

function Node({ n }: { n: ChartNode }) {
  const c = (p: string) => paint(p, APP_PALETTE)
  switch (n.t) {
    case 'rect':
      return <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.rx} fill={c(n.fill)} opacity={n.opacity} />
    case 'line':
      return <line x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={c(n.stroke)} strokeWidth={n.sw ?? 1} opacity={n.opacity} />
    case 'circle':
      return <circle cx={n.cx} cy={n.cy} r={n.r} fill={c(n.fill)} />
    case 'path':
      return (
        <path
          d={n.d}
          fill={n.fill ? c(n.fill) : 'none'}
          fillRule={n.evenodd ? 'evenodd' : undefined}
          stroke={n.stroke ? c(n.stroke) : undefined}
          strokeWidth={n.sw}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={n.opacity}
        />
      )
    case 'text':
      return (
        <text
          x={n.x}
          y={n.y}
          textAnchor={n.anchor}
          fontSize={n.size}
          fontWeight={n.weight}
          fill={c(n.fill)}
          transform={n.rotate ? `rotate(${n.rotate} ${n.x} ${n.y})` : undefined}
        >
          {n.s}
        </text>
      )
  }
}

export default function ChartRender({
  spec,
  data,
  width,
  height,
}: {
  spec: ChartSpecLike
  data: ChartData
  width: number
  height: number
}) {
  const scene = buildChartScene(spec, data, width, height)
  return (
    <svg width={scene.width} height={scene.height} viewBox={`0 0 ${scene.width} ${scene.height}`}>
      {scene.nodes.map((n, i) => (
        <Node key={i} n={n} />
      ))}
    </svg>
  )
}
