import React, { useLayoutEffect, useRef, useState } from 'react'
import type { ChartSpec } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { IconBtn, Popover, Segmented } from '../../shared/ui'
import { IcEdit } from './icons'
import { IcTrash, IcSettings } from '../../shared/icons'
import ChartRender from './ChartRender'
import { extractChartData, type ChartData } from './chartData'
import { resolveOptions } from './chartGeom'

const MIN_W = 220
const MIN_H = 140

// Legend, axis titles, labels and gridlines live here rather than in the insert
// dialog: they are adjustments you make while looking at the finished chart.
function OptionsPopover({
  anchor,
  chart,
  data,
  onUpdate,
  onClose,
}: {
  anchor: HTMLElement | null
  chart: ChartSpec
  data: ChartData
  onUpdate: (id: string, patch: Partial<ChartSpec>) => void
  onClose: () => void
}) {
  const opts = resolveOptions(chart, data)
  const set = (patch: Partial<ChartSpec>) => onUpdate(chart.id, patch)
  const lineSet = new Set(opts.lineSeries)

  return (
    <Popover anchor={anchor} onClose={onClose} width={230} align="right">
      <div className="sx-chart-opts">
        <div className="sx-chart-opt-row">
          <span className="sx-chart-opt-label">Legend</span>
          <Segmented
            value={opts.legend}
            onChange={(v) => set({ legend: v as ChartSpec['legend'] })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'right', label: 'Right' },
              { value: 'bottom', label: 'Bottom' },
            ]}
          />
        </div>
        <label className="sx-filter-row">
          <input type="checkbox" checked={opts.gridlines} onChange={(e) => set({ gridlines: e.target.checked })} />
          <span>Gridlines</span>
        </label>
        <label className="sx-filter-row">
          <input type="checkbox" checked={opts.dataLabels} onChange={(e) => set({ dataLabels: e.target.checked })} />
          <span>Data labels</span>
        </label>
        <div className="sx-chart-opt-row">
          <span className="sx-chart-opt-label">Horizontal axis title</span>
          <input
            className="textfield"
            value={chart.xTitle ?? ''}
            onChange={(e) => set({ xTitle: e.target.value })}
            placeholder="e.g. Quarter"
          />
        </div>
        <div className="sx-chart-opt-row">
          <span className="sx-chart-opt-label">Vertical axis title</span>
          <input
            className="textfield"
            value={chart.yTitle ?? ''}
            onChange={(e) => set({ yTitle: e.target.value })}
            placeholder="e.g. Revenue"
          />
        </div>
        {chart.type === 'combo' && (
          <div className="sx-chart-opt-row">
            <span className="sx-chart-opt-label">Draw as line</span>
            {data.series.map((s, i) => (
              <label key={i} className="sx-filter-row">
                <input
                  type="checkbox"
                  checked={lineSet.has(i)}
                  onChange={(e) => {
                    const next = new Set(lineSet)
                    if (e.target.checked) next.add(i)
                    else next.delete(i)
                    set({ lineSeries: Array.from(next).sort((a, b) => a - b) })
                  }}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Popover>
  )
}

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
  onUpdate: (id: string, patch: Partial<ChartSpec>) => void
  onEdit: (chart: ChartSpec) => void
  onDelete: (id: string) => void
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [optsAnchor, setOptsAnchor] = useState<HTMLElement | null>(null)
  const dragOrigin = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [plot, setPlot] = useState<{ w: number; h: number } | null>(null)

  const x = drag?.x ?? chart.x
  const y = drag?.y ?? chart.y
  const w = size?.w ?? chart.w
  const h = size?.h ?? chart.h

  // The header's height depends on font and icon metrics, so measure the body
  // rather than guess: guessing high clips whatever the chart draws along its
  // bottom edge — the legend, or the category labels.
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const cs = getComputedStyle(el)
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    setPlot({ w: Math.max(60, el.clientWidth - padX), h: Math.max(60, el.clientHeight - padY) })
  }, [w, h])

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
        <div className={'sx-chart-actions' + (optsAnchor ? ' pinned' : '')} onMouseDown={(e) => e.stopPropagation()}>
          <IconBtn
            label="Chart options"
            active={!!optsAnchor}
            onClick={(e) => {
              const btn = e.currentTarget
              setOptsAnchor((a) => (a ? null : btn))
            }}
          >
            <IcSettings />
          </IconBtn>
          <IconBtn label="Edit chart" onClick={() => onEdit(chart)}>
            <IcEdit />
          </IconBtn>
          <IconBtn label="Delete chart" onClick={() => onDelete(chart.id)}>
            <IcTrash />
          </IconBtn>
        </div>
      </div>
      <div className="sx-chart-body" ref={bodyRef}>
        <ChartRender spec={{ ...chart, title: '' }} data={data} width={plot?.w ?? w - 12} height={plot?.h ?? h - 46} />
      </div>
      <div className="sx-chart-resize" onMouseDown={startResize} />
      {optsAnchor && (
        <OptionsPopover anchor={optsAnchor} chart={chart} data={data} onUpdate={onUpdate} onClose={() => setOptsAnchor(null)} />
      )}
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
  onUpdate: (id: string, patch: Partial<ChartSpec>) => void
  onEdit: (chart: ChartSpec) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      {charts.map((c) => (
        <ChartCard
          key={c.id}
          chart={c}
          computed={computed}
          offsetX={offsetX}
          offsetY={offsetY}
          onUpdate={onUpdate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}
