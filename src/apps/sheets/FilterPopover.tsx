import React, { useMemo } from 'react'
import { Popover, Button } from '../../shared/ui'

export default function FilterPopover({
  anchor,
  values,
  excluded,
  onChange,
  onClose,
}: {
  anchor: HTMLElement | null
  values: string[]
  excluded: string[]
  onChange: (next: string[]) => void
  onClose: () => void
}) {
  const excludedSet = useMemo(() => new Set(excluded), [excluded])

  return (
    <Popover anchor={anchor} onClose={onClose} width={210}>
      <div style={{ display: 'flex', gap: 6, padding: '6px 8px 2px' }}>
        <Button small onClick={() => onChange([])}>
          Select all
        </Button>
        <Button small onClick={() => onChange(values.slice())}>
          Clear
        </Button>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '2px 4px 6px' }}>
        {values.length === 0 && (
          <div className="empty-hint" style={{ padding: '10px 4px' }}>
            No values
          </div>
        )}
        {values.map((v) => (
          <label key={v} className="sx-filter-row">
            <input
              type="checkbox"
              checked={!excludedSet.has(v)}
              onChange={(e) => {
                const next = new Set(excludedSet)
                if (e.target.checked) next.delete(v)
                else next.add(v)
                onChange(Array.from(next))
              }}
            />
            <span>{v === '' ? '(blank)' : v}</span>
          </label>
        ))}
      </div>
    </Popover>
  )
}
