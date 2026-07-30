// Renders each merged range's top-left content spanning the full merge box,
// absolutely positioned over the (blanked-out) underlying grid cells. Always
// renders every merge unconditionally (not virtualized) so content stays
// correct even when only the middle of a tall merge is scrolled into view.
// Sits inside .sx-overlay-layer, so it inherits pointer-events:none and lets
// clicks pass through to the real per-row cells beneath for selection.

import React from 'react'
import type { CellStyle, Sheet } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { isErr } from './engine/formula'
import { refToString } from './engine/refs'
import { parseMergeRange } from './merge'
import type { CondStyle } from './condFormat'

export default function MergeOverlay({
  sheet,
  computed,
  rowEdgeY,
  colEdgeX,
  cellStyleCss,
  condStyles,
}: {
  sheet: Sheet
  computed: Map<string, ComputedCell>
  rowEdgeY: (r: number) => number
  colEdgeX: (c: number) => number
  cellStyleCss: (style: CellStyle | undefined, numeric: boolean, cond?: CondStyle) => React.CSSProperties
  condStyles: Map<string, CondStyle>
}) {
  const merges = sheet.merges
  if (!merges || !merges.length) return null
  return (
    <>
      {merges.map((m) => {
        const span = parseMergeRange(m)
        if (!span) return null
        const ref = refToString(span.c0, span.r0)
        const cell = sheet.cells[ref]
        const cond = condStyles.get(ref)
        const c = computed.get(ref)
        const text = c?.display ?? ''
        const err = c ? isErr(c.value) : false
        const numeric = !err && typeof c?.value === 'number'
        const top = rowEdgeY(span.r0)
        const left = colEdgeX(span.c0)
        const width = Math.max(0, colEdgeX(span.c1 + 1) - left)
        const height = Math.max(0, rowEdgeY(span.r1 + 1) - top)
        if (width <= 0 || height <= 0) return null
        return (
          <div
            key={m}
            className={'sx-cell sx-merge-cell' + (err ? ' err' : '')}
            style={{
              position: 'absolute',
              top,
              left,
              width,
              height,
              background: cond?.fill ?? cell?.style?.fill ?? 'var(--surface)',
              ...cellStyleCss(cell?.style, numeric, cond),
            }}
          >
            {text}
          </div>
        )
      })}
    </>
  )
}
