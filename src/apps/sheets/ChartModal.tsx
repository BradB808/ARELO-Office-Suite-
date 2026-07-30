import React, { useMemo, useState } from 'react'
import type { ChartSpec } from '../../shared/types'
import { Modal, Segmented, Button } from '../../shared/ui'
import ChartRender from './ChartRender'
import type { ChartData } from './chartData'

export interface ChartFormValue {
  type: ChartSpec['type']
  title: string
  labelRange: string
  dataRanges: string
  seriesNames: string
}

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
  const [form, setForm] = useState<ChartFormValue>(initial)
  const previewData = useMemo(() => preview(form), [form, preview])

  const set = <K extends keyof ChartFormValue>(k: K, v: ChartFormValue[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal title={isEdit ? 'Edit chart' : 'Insert chart'} onClose={onCancel} width={480}>
      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Chart type</span>
        <Segmented
          value={form.type}
          onChange={(v) => set('type', v as ChartSpec['type'])}
          options={[
            { value: 'bar', label: 'Bar' },
            { value: 'line', label: 'Line' },
            { value: 'area', label: 'Area' },
            { value: 'pie', label: 'Pie' },
          ]}
        />
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

      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-m)',
          background: 'var(--canvas)',
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <ChartRender type={form.type} title={form.title} data={previewData} width={420} height={172} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onSubmit(form)}
          disabled={form.dataRanges.trim() === ''}
        >
          {isEdit ? 'Save chart' : 'Insert chart'}
        </Button>
      </div>
    </Modal>
  )
}
