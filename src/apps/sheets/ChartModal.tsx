import React, { useMemo, useState } from 'react'
import type { ChartSpec } from '../../shared/types'
import { Modal, Button } from '../../shared/ui'
import ChartRender from './ChartRender'
import type { ChartData } from './chartData'

export interface ChartFormValue {
  type: ChartSpec['type']
  title: string
  labelRange: string
  dataRanges: string
  seriesNames: string
}

const TYPES: { value: ChartSpec['type']; label: string; hint: string }[] = [
  { value: 'column', label: 'Column', hint: 'Vertical bars, one group per category' },
  { value: 'stackedColumn', label: 'Stacked column', hint: 'Series stacked into one bar per category' },
  { value: 'stackedBar', label: 'Stacked bar', hint: 'Stacked, drawn horizontally — good for long labels' },
  { value: 'line', label: 'Line', hint: 'Values connected across categories' },
  { value: 'area', label: 'Area', hint: 'Line with the space below it filled' },
  { value: 'combo', label: 'Combo', hint: 'Columns with the last series drawn as a line' },
  { value: 'scatter', label: 'Scatter', hint: 'First range is x, the rest are y' },
  { value: 'pie', label: 'Pie', hint: 'First series only, as shares of the total' },
  { value: 'donut', label: 'Donut', hint: 'Pie with the total in the middle' },
]

export default function ChartModal({
  initial,
  onCancel,
  onSubmit,
  isEdit,
  preview,
}: {
  initial: ChartFormValue
  onCancel: () => void
  onSubmit: (v: ChartFormValue) => void
  isEdit: boolean
  preview: (v: ChartFormValue) => ChartData
}) {
  // 'bar' predates the split into bar/column and has always drawn vertical
  // columns, so it maps onto 'column' — same geometry, current name.
  const [form, setForm] = useState<ChartFormValue>(() => ({ ...initial, type: initial.type === 'bar' ? 'column' : initial.type }))
  const previewData = useMemo(() => preview(form), [form, preview])
  const current = TYPES.find((t) => t.value === form.type)

  const set = <K extends keyof ChartFormValue>(k: K, v: ChartFormValue[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal title={isEdit ? 'Edit chart' : 'Insert chart'} onClose={onCancel} width={520}>
      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Chart type</span>
        <div className="sx-charttype-grid">
          {TYPES.map((t) => (
            <button
              key={t.value}
              className={'sx-charttype' + (t.value === form.type ? ' on' : '')}
              title={t.hint}
              onClick={() => set('type', t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {current && <span className="sx-chartmodal-hint">{current.hint}</span>}
      </div>

      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Title</span>
        <input className="textfield" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Chart title" />
      </div>

      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Label range</span>
        <input className="textfield" value={form.labelRange} onChange={(e) => set('labelRange', e.target.value)} placeholder="e.g. A2:A10" />
      </div>

      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Data ranges</span>
        <input
          className="textfield"
          value={form.dataRanges}
          onChange={(e) => set('dataRanges', e.target.value)}
          placeholder="e.g. B2:B10, C2:C10"
        />
        <span className="sx-chartmodal-hint">Comma-separated A1 ranges — one per series.</span>
      </div>

      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Series names</span>
        <input
          className="textfield"
          value={form.seriesNames}
          onChange={(e) => set('seriesNames', e.target.value)}
          placeholder="e.g. Revenue, Costs"
        />
      </div>

      <div className="sx-chart-preview">
        <ChartRender spec={{ type: form.type, title: form.title }} data={previewData} width={452} height={196} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSubmit(form)} disabled={form.dataRanges.trim() === ''}>
          {isEdit ? 'Save chart' : 'Insert chart'}
        </Button>
      </div>
    </Modal>
  )
}
