import React, { useState } from 'react'
import type { CondRule } from '../../shared/types'
import { uid } from '../../shared/types'
import { Modal, Button, Select, ColorGrid } from '../../shared/ui'
import { IcClose } from '../../shared/icons'
import { ruleDescription } from './condFormat'

const RULE_TYPES: { value: CondRule['type']; label: string }[] = [
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'between', label: 'Between' },
  { value: 'eq', label: 'Equal to' },
  { value: 'contains', label: 'Text contains' },
  { value: 'duplicate', label: 'Duplicate values' },
  { value: 'colorScale', label: 'Color scale' },
]

export default function CondFormatModal({
  rules,
  initialRange,
  onAdd,
  onDelete,
  onClose,
}: {
  rules: CondRule[]
  initialRange: string
  onAdd: (rule: CondRule) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [range, setRange] = useState(initialRange)
  const [type, setType] = useState<CondRule['type']>('gt')
  const [v1, setV1] = useState('')
  const [v2, setV2] = useState('')
  const [fill, setFill] = useState('#fecaca')
  const [color, setColor] = useState('')
  const [scaleFrom, setScaleFrom] = useState('#f8696b')
  const [scaleTo, setScaleTo] = useState('#63be7b')

  const needsValue = type === 'gt' || type === 'lt' || type === 'eq' || type === 'contains'
  const canAdd = range.trim() !== '' && (!needsValue || v1.trim() !== '') && (type !== 'between' || v2.trim() !== '')

  function addRule() {
    if (!canAdd) return
    const base = { id: uid(), range: range.trim(), type }
    let rule: CondRule
    if (type === 'colorScale') {
      rule = { ...base, scaleFrom, scaleTo }
    } else if (type === 'duplicate') {
      rule = { ...base, fill: fill || undefined, color: color || undefined }
    } else if (type === 'between') {
      rule = { ...base, v1: Number(v1), v2: Number(v2), fill: fill || undefined, color: color || undefined }
    } else if (type === 'contains') {
      rule = { ...base, v1, fill: fill || undefined, color: color || undefined }
    } else {
      rule = { ...base, v1: Number(v1), fill: fill || undefined, color: color || undefined }
    }
    onAdd(rule)
    setV1('')
    setV2('')
  }

  return (
    <Modal title="Conditional formatting" subtitle="Rule fill/color overrides explicit cell formatting, and later rules win over earlier ones." onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 220, overflowY: 'auto' }}>
        {rules.length === 0 && <div className="empty-hint" style={{ padding: '10px 4px' }}>No rules yet.</div>}
        {rules.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-s)',
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                flexShrink: 0,
                background: r.type === 'colorScale' ? `linear-gradient(90deg, ${r.scaleFrom || '#f8696b'}, ${r.scaleTo || '#63be7b'})` : r.fill || 'var(--surface-3)',
                border: '1px solid var(--border)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.range}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{ruleDescription(r)}</div>
            </div>
            <button className="iconbtn" title="Delete rule" onClick={() => onDelete(r.id)}>
              <IcClose />
            </button>
          </div>
        ))}
      </div>

      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Range</span>
        <input className="textfield" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. B2:B30" />
      </div>
      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Rule type</span>
        <Select value={type} onChange={(v) => setType(v as CondRule['type'])} options={RULE_TYPES} width={220} />
      </div>

      {type === 'between' && (
        <div className="sx-series-row" style={{ marginBottom: 12 }}>
          <input className="textfield" value={v1} onChange={(e) => setV1(e.target.value)} placeholder="Min" />
          <input className="textfield" value={v2} onChange={(e) => setV2(e.target.value)} placeholder="Max" />
        </div>
      )}
      {type === 'contains' && (
        <div className="sx-chartmodal-row">
          <input className="textfield" value={v1} onChange={(e) => setV1(e.target.value)} placeholder="Text" />
        </div>
      )}
      {(type === 'gt' || type === 'lt' || type === 'eq') && (
        <div className="sx-chartmodal-row">
          <input className="textfield" value={v1} onChange={(e) => setV1(e.target.value)} placeholder="Value" />
        </div>
      )}

      {type === 'colorScale' ? (
        <div className="sx-chartmodal-row">
          <span className="sx-chartmodal-label">Low value color</span>
          <ColorGrid value={scaleFrom} onPick={setScaleFrom} />
          <span className="sx-chartmodal-label" style={{ marginTop: 8 }}>
            High value color
          </span>
          <ColorGrid value={scaleTo} onPick={setScaleTo} />
        </div>
      ) : (
        <>
          <div className="sx-chartmodal-row">
            <span className="sx-chartmodal-label">Fill color</span>
            <ColorGrid value={fill} onPick={setFill} allowNone />
          </div>
          <div className="sx-chartmodal-row">
            <span className="sx-chartmodal-label">Text color (optional)</span>
            <ColorGrid value={color} onPick={setColor} allowNone />
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={addRule} disabled={!canAdd}>
          Add rule
        </Button>
      </div>
    </Modal>
  )
}
