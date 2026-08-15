import React, { useMemo, useState } from 'react'
import type { PivotAgg, PivotSpec } from '../../shared/types'
import { Modal, Button, Select } from '../../shared/ui'
import {
  AGG_LABELS,
  PIVOT_AGGS,
  anchorValid,
  buildPivot,
  fieldLabel,
  parseSourceRef,
  pivotCellText,
  suggestAnchor,
  type SourceTable,
} from './pivot'

export interface PivotFormValue {
  source: string
  rows: number[]
  cols: number[]
  values: { col: number; agg: PivotAgg }[]
  anchor: string
  showTotals: boolean
  /** Put the block on a sheet of its own instead of beside the data. */
  newSheet: boolean
}

type Role = 'none' | 'rows' | 'cols' | 'values'

const ROLE_OPTIONS = [
  { value: 'none', label: 'Not used' },
  { value: 'rows', label: 'Rows' },
  { value: 'cols', label: 'Columns' },
  { value: 'values', label: 'Values' },
]

const AGG_OPTIONS = PIVOT_AGGS.map((a) => ({ value: a, label: AGG_LABELS[a] }))

const PREVIEW_ROWS = 9
const PREVIEW_COLS = 7

export default function PivotModal({
  initial,
  readTable,
  conflictsFor,
  onCancel,
  onSubmit,
}: {
  initial: PivotFormValue
  /** Reads the source range off the sheet; null when the range is unparseable. */
  readTable: (source: string) => SourceTable | null
  /** Refs the block would land on top of — empty when it has clear ground. */
  conflictsFor: (v: PivotFormValue) => string[]
  onCancel: () => void
  onSubmit: (v: PivotFormValue) => void
}) {
  const [form, setForm] = useState<PivotFormValue>(initial)
  // Retype the source and the suggested spot follows it — until the user picks
  // a spot of their own, at which point it stays put.
  const [anchorPinned, setAnchorPinned] = useState(false)
  const set = <K extends keyof PivotFormValue>(k: K, v: PivotFormValue[K]) => setForm((f) => ({ ...f, [k]: v }))

  function setSource(next: string) {
    const ref = anchorPinned ? null : parseSourceRef(next)
    setForm((f) => ({ ...f, source: next, ...(ref ? { anchor: suggestAnchor(ref) } : {}) }))
  }

  const table = useMemo(() => readTable(form.source), [form.source, readTable])
  const build = useMemo(() => {
    if (!table) return null
    const spec: PivotSpec = {
      id: 'preview',
      source: form.source,
      rows: form.rows,
      cols: form.cols,
      values: form.values,
      anchor: form.anchor,
      showTotals: form.showTotals,
    }
    return buildPivot(table, spec)
  }, [table, form])
  const conflicts = useMemo(() => (form.newSheet ? [] : conflictsFor(form)), [form, conflictsFor])

  function setRole(col: number, role: Role) {
    setForm((f) => {
      const rows = f.rows.filter((c) => c !== col)
      const cols = f.cols.filter((c) => c !== col)
      const values = f.values.filter((v) => v.col !== col)
      if (role === 'rows') rows.push(col)
      if (role === 'cols') cols.push(col)
      if (role === 'values') values.push({ col, agg: guessAgg(table, col) })
      return { ...f, rows, cols, values }
    })
  }
  function roleOf(col: number): Role {
    if (form.rows.includes(col)) return 'rows'
    if (form.cols.includes(col)) return 'cols'
    if (form.values.some((v) => v.col === col)) return 'values'
    return 'none'
  }

  const blocked = conflicts.length > 0
  const anchorOk = form.newSheet || anchorValid(form.anchor)
  const canCreate = !!table && !!build && !build.error && !blocked && anchorOk
  const rangeProblem = !table

  return (
    <Modal title="Pivot table" subtitle="Summarise a range by grouping its columns." onClose={onCancel} width={560}>
      <div className="pv-field">
        <span className="pv-label">Source range</span>
        <input
          className="textfield"
          value={form.source}
          spellCheck={false}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. A1:E40"
        />
        <span className={rangeProblem ? 'pv-warn' : 'pv-hint'}>
          {rangeProblem
            ? 'That is not a range — use something like A1:E40.'
            : `${table.rows.length} row${table.rows.length === 1 ? '' : 's'} of data. The first row is used as headers.`}
        </span>
      </div>

      {table && (
        <div className="pv-field">
          <span className="pv-label">Fields</span>
          <div className="pv-fields">
            {table.fields.map((_, i) => {
              const role = roleOf(i)
              const value = form.values.find((v) => v.col === i)
              return (
                <div className="pv-row" key={i}>
                  <span className="pv-name" title={fieldLabel(table, i)}>
                    {fieldLabel(table, i)}
                  </span>
                  <Select value={role} width={110} compact options={ROLE_OPTIONS} onChange={(v) => setRole(i, v as Role)} />
                  {value ? (
                    <Select
                      value={value.agg}
                      width={130}
                      compact
                      options={AGG_OPTIONS}
                      onChange={(agg) =>
                        set(
                          'values',
                          form.values.map((v) => (v.col === i ? { ...v, agg: agg as PivotAgg } : v)),
                        )
                      }
                    />
                  ) : (
                    <span />
                  )}
                </div>
              )
            })}
          </div>
          <span className="pv-hint">Rows and Columns group the data; Values are the numbers in the middle.</span>
        </div>
      )}

      <div className="pv-field">
        <span className="pv-label">Place it</span>
        <div className="pv-place">
          <input
            className="textfield"
            style={{ width: 110 }}
            value={form.anchor}
            spellCheck={false}
            disabled={form.newSheet}
            onChange={(e) => {
              setAnchorPinned(true)
              set('anchor', e.target.value.toUpperCase())
            }}
            placeholder="e.g. H1"
          />
          <label className="pv-check">
            <input type="checkbox" checked={form.newSheet} onChange={(e) => set('newSheet', e.target.checked)} />
            <span>On a new sheet</span>
          </label>
          <label className="pv-check">
            <input type="checkbox" checked={form.showTotals} onChange={(e) => set('showTotals', e.target.checked)} />
            <span>Grand totals</span>
          </label>
        </div>
      </div>

      {!anchorOk && <div className="pv-warn pv-notice">That is not a cell to start from — use something like H1.</div>}
      {build?.error && <div className="pv-warn pv-notice">{build.error}</div>}
      {blocked && (
        <div className="pv-warn pv-notice">
          {conflictLine(conflicts)} Move the anchor, or tick “On a new sheet”.
        </div>
      )}

      {build && !build.error && (
        <div className="pv-field">
          <span className="pv-label">Preview</span>
          <div className="pv-preview">
            <table>
              <tbody>
                {build.cells.slice(0, PREVIEW_ROWS).map((row, r) => (
                  <tr key={r}>
                    {row.slice(0, PREVIEW_COLS).map((cell, c) => (
                      <td key={c} className={cellClass(cell.style?.bold, cell.style?.align)}>
                        {pivotCellText(cell)}
                      </td>
                    ))}
                    {row.length > PREVIEW_COLS && <td className="pv-more">…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="pv-hint">
            {build.height} × {build.width} cells
            {build.height > PREVIEW_ROWS || build.width > PREVIEW_COLS ? ' — showing the top-left corner.' : '.'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canCreate} onClick={() => onSubmit(form)}>
          Create pivot table
        </Button>
      </div>
    </Modal>
  )
}

function cellClass(bold?: boolean, align?: string): string {
  return [bold ? 'pv-h' : '', align === 'right' ? 'pv-num' : ''].filter(Boolean).join(' ')
}

function conflictLine(conflicts: string[]): string {
  const shown = conflicts.slice(0, 3).join(', ')
  const rest = conflicts.length - Math.min(3, conflicts.length)
  return rest > 0
    ? `That would write over ${shown} and ${rest} other cell${rest === 1 ? '' : 's'}.`
    : `That would write over ${shown}.`
}

/** Numbers get summed, anything else counted — the choice a user would make. */
function guessAgg(table: SourceTable | null, col: number): PivotAgg {
  if (!table) return 'sum'
  const numeric = table.rows.filter((r) => typeof r[col]?.value === 'number').length
  return numeric > table.rows.length / 2 ? 'sum' : 'count'
}
