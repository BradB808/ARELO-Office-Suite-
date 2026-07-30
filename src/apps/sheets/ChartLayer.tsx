import React, { useRef, useState } from 'react'
import type { ChartSpec } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { IconBtn } from '../../shared/ui'
import { IcEdit } from './icons'
import { IcTrash } from '../../shared/icons'
import ChartRender from './ChartRender'
import { extractChartData } from './chartData'

const MIN_W = 220
const MIN_H = 140

function ChartCard({
  chart,
  computed,
  offsetX,
  offsetY,
  onUpdate,
  onEdit,
  onDelete,
}: {
  chart: ChartSpec
  computed: Map<string, ComputedCell>
  offsetX: number
  offsetY: number
  onUpdate: (id: string, patch: Partial<Pick<ChartSpec, 'x' | 'y' | 'w' | 'h'>>) => void
  onEdit: (chart: ChartSpec) => void
  onDelete: (id: string) => void
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const dragOrigin = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })

  const x = drag?.x ?? chart.x
  const y = drag?.y ?? chart.y
  const w = size?.w ?? chart.w
  const h = size?.h ?? chart.h

  const data = extractChartData(computed, chart)

  function startDrag(e: React.MouseEvent) {
    e.stopPropagation()
    dragOrigin.current = { mx: e.clientX, my: e.clientY, x: chart.x, y: chart.y, w: chart.w, h: chart.h }
    const onMove = (ev: MouseEvent) => {
      setDrag({
        x: Math.max(0, dragOrigin.current.x + (ev.clientX - dragOrigin.current.mx)),
        y: Math.max(0, dragOrigin.current.y + (ev.clientY - dragOrigin.current.my)),
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDrag((d) => {
        if (d) onUpdate(chart.id, { x: d.x, y: d.y })
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startResize(e: React.MouseEvent) {
    e.stopPropagation()
    dragOrigin.current = { mx: e.clientX, my: e.clientY, x: chart.x, y: chart.y, w: chart.w, h: chart.h }
    const onMove = (ev: MouseEvent) => {
      setSize({
        w: Math.max(MIN_W, dragOrigin.current.w + (ev.clientX - dragOrigin.current.mx)),
        h: Math.max(MIN_H, dragOrigin.current.h + (ev.clientY - dragOrigin.current.my)),
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setSize((s) => {
        if (s) onUpdate(chart.id, { w: s.w, h: s.h })
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={'sx-chart-card' + (drag ? ' dragging' : '') + (size ? ' resizing' : '')}
      style={{ left: offsetX + x, top: offsetY + y, width: w, height: h }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="sx-chart-head" onMouseDown={startDrag}>
        <span className="sx-chart-title">{chart.title || 'Untitled chart'}</span>
        <div className="sx-chart-actions">
          <IconBtn label="Edit chart" onClick={() => onEdit(chart)}>
            <IcEdit />
          </IconBtn>
          <IconBtn label="Delete chart" onClick={() => onDelete(chart.id)}>
            <IcTrash />
          </IconBtn>
        </div>
      </div>
      <div className="sx-chart-body">
        <ChartRender type={chart.type} title="" data={data} width={w - 12} height={h - 40} />
      </div>
      <div className="sx-chart-resize" onMouseDown={startResize} />
    </div>
  )
}

export default function ChartLayer({
  charts,
  computed,
  offsetX,
  offsetY,
  onUpdate,
  onEdit,
  onDelete,
}: {
  charts: ChartSpec[]
  computed: Map<string, ComputedCell>
  offsetX: number
  offsetY: number
  onUpdate: (id: string, patch: Partial<Pick<ChartSpec, 'x' | 'y' | 'w' | 'h'>>) => void
  onEdit: (chart: ChartSpec) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      {charts.map((c) => (
        <ChartCard key={c.id} chart={c} computed={computed} offsetX={offsetX} offsetY={offsetY} onUpdate={onUpdate} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  )
}
