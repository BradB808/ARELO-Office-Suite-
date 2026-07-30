import React, { useState } from 'react'
import { Modal, Button } from '../../shared/ui'

export default function ValidationModal({
  initialRange,
  initialOptions,
  onSave,
  onClose,
}: {
  initialRange: string
  initialOptions: string
  onSave: (range: string, options: string[]) => void
  onClose: () => void
}) {
  const [range, setRange] = useState(initialRange)
  const [text, setText] = useState(initialOptions)

  const options = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const canSave = range.trim() !== '' && options.length > 0

  function save() {
    if (!canSave) return
    onSave(range.trim(), options)
    onClose()
  }

  return (
    <Modal title="Dropdown list" subtitle="Cells in this range show a dropdown of allowed values; other entries get a soft warning." onClose={onClose} width={380}>
      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Range</span>
        <input className="textfield" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. B2:B30" />
      </div>
      <div className="sx-chartmodal-row">
        <span className="sx-chartmodal-label">Options (one per line)</span>
        <textarea
          className="textfield"
          style={{ height: 140, resize: 'vertical', paddingTop: 8, paddingBottom: 8 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Yes\nNo\nMaybe'}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={!canSave}>
          Save
        </Button>
      </div>
    </Modal>
  )
}
