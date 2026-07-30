import React from 'react'
import { IcZoomIn, IcZoomOut } from './icons'

export default function StatusBar({
  sum,
  avg,
  count,
  zoom,
  onZoomChange,
  filterInfo,
}: {
  sum: number
  avg: number
  count: number
  zoom: number
  onZoomChange: (z: number) => void
  filterInfo?: { shown: number; total: number } | null
}) {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('en-US', { maximumFractionDigits: 4 }))
  return (
    <div className="sx-status">
      {filterInfo && (
        <span>
          <b>{filterInfo.shown}</b> of {filterInfo.total} rows shown
        </span>
      )}
      {count > 0 && (
        <>
          <span>
            Sum: <b>{fmt(sum)}</b>
          </span>
          <span>
            Avg: <b>{fmt(avg)}</b>
          </span>
          <span>
            Count: <b>{count}</b>
          </span>
        </>
      )}
      <div className="sx-zoom">
        <button className="iconbtn" title="Zoom out" onClick={() => onZoomChange(Math.max(50, zoom - 10))}>
          <IcZoomOut />
        </button>
        <span className="sx-zoom-val">{zoom}%</span>
        <button className="iconbtn" title="Zoom in" onClick={() => onZoomChange(Math.min(200, zoom + 10))}>
          <IcZoomIn />
        </button>
      </div>
    </div>
  )
}
