import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Sheet, Cell, CellStyle, ChartSpec, SheetFilter } from '../../shared/types'
import { cssFamily } from '../../shared/fonts'
import type { ComputedCell } from './engine/formula'
import { isErr } from './engine/formula'
import { refToString } from './engine/refs'
import { buildOffsetsFromSizer, indexAtOffset, colLabel, usedRange } from './gridMath'
import { ROW_HEADER_W, COL_HEADER_H, MIN_COL_W, MIN_ROW_H, normalizeSel, type CellPos, type SelRect } from './types'
import { mergeSpanAt, parseMergeRange, stepPastSpanSkippingHidden } from './merge'
import { computeCondFormatStyles, type CondStyle } from './condFormat'
import { columnDistinctValues, computeFilterHiddenRows, filterBoundsOf } from './filter'
import { computeValidationMap, isValueInOptions } from './validation'
import ChartLayer from './ChartLayer'
import MergeOverlay from './MergeOverlay'
import FilterPopover from './FilterPopover'
import { IcFunnel } from './icons'

const OVERSCAN = 10

export interface ContextMenuTarget {
  x: number
  y: number
  kind: 'cell' | 'col' | 'row'
}

export interface EditingState {
  row: number
  col: number
  value: string
}

export interface GridProps {
  sheet: Sheet
  computed: Map<string, ComputedCell>
  rowCount: number
  colCount: number
  sel: SelRect
  active: CellPos
  editing: EditingState | null
  zoom: number
  onSelChange: (sel: SelRect, active: CellPos) => void
  onStartEdit: (row: number, col: number, initial?: string) => void
  onEditValueChange: (value: string) => void
  onCommitEdit: (moveDir: 'down' | 'up' | 'right' | 'left' | 'none') => void
  onCancelEdit: () => void
  onClearSelection: () => void
  onColResize: (col: number, width: number) => void
  onRowResize: (row: number, height: number) => void
  onFillApply: (src: SelRect, dest: SelRect) => void
  onOpenContextMenu: (target: ContextMenuTarget) => void
  rootRef: React.RefObject<HTMLDivElement | null>
  editInputRef: React.RefObject<HTMLInputElement | null>
  charts: ChartSpec[]
  onChartUpdate: (id: string, patch: Partial<Pick<ChartSpec, 'x' | 'y' | 'w' | 'h'>>) => void
  onChartEdit: (chart: ChartSpec) => void
  onChartDelete: (id: string) => void
  onFilterChange: (next: SheetFilter) => void
  onPickOption: (row: number, col: number, value: string) => void
  /** Format painter is armed — shows a cursor hint and an accent outline. */
  paintArmed?: boolean
}

function cellDisplay(computed: Map<string, ComputedCell>, ref: string): { text: string; err: boolean } {
  const c = computed.get(ref)
  if (!c) return { text: '', err: false }
  return { text: c.display, err: isErr(c.value) }
}

function cellStyleCss(style: CellStyle | undefined, numeric: boolean, cond?: CondStyle): React.CSSProperties {
  const s: React.CSSProperties = {}
  if (style?.bold) s.fontWeight = 700
  if (style?.italic) s.fontStyle = 'italic'
  if (style?.underline && style?.strike) s.textDecoration = 'underline line-through'
  else if (style?.underline) s.textDecoration = 'underline'
  else if (style?.strike) s.textDecoration = 'line-through'
  if (style?.color) s.color = style.color
  if (style?.fill) s.background = style.fill
  if (style?.fontSize) s.fontSize = style.fontSize
  if (style?.fontFamily) s.fontFamily = cssFamily(style.fontFamily)
  s.textAlign = style?.align ?? (numeric ? 'right' : 'left')
  // Default (undefined valign) leaves alignItems unset so the CSS class's
  // existing center default keeps applying — matches prior baseline behavior.
  if (style?.valign === 'top') s.alignItems = 'flex-start'
  else if (style?.valign === 'bottom') s.alignItems = 'flex-end'
  else if (style?.valign === 'middle') s.alignItems = 'center'
  if (style?.wrap) {
    s.whiteSpace = 'pre-wrap'
    s.wordBreak = 'break-word'
  }
  // Conditional-format fill/color OVERRIDES explicit cell style, matching Excel.
  if (cond?.fill) s.background = cond.fill
  if (cond?.color) s.color = cond.color
  return s
}

export default function Grid({
  sheet,
  computed,
  rowCount,
  colCount,
  sel,
  active,
  editing,
  zoom,
  onSelChange,
  onStartEdit,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  onClearSelection,
  onColResize,
  onRowResize,
  onFillApply,
  onOpenContextMenu,
  rootRef,
  editInputRef,
  charts,
  onChartUpdate,
  onChartEdit,
  onChartDelete,
  onFilterChange,
  onPickOption,
  paintArmed,
}: GridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewport, setViewport] = useState({ w: 800, h: 600 })

  const isSelectingRef = useRef(false)
  const isFillingRef = useRef(false)
  const fillSrcRef = useRef<SelRect | null>(null)
  const [fillPreview, setFillPreview] = useState<SelRect | null>(null)
  const resizeState = useRef<{ kind: 'col' | 'row'; index: number; start: number; startSize: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<{ kind: 'col' | 'row'; index: number; size: number } | null>(null)
  const [filterPopover, setFilterPopover] = useState<{ colOffset: number; anchor: HTMLElement } | null>(null)

  // ---------------- conditional formatting / filter / validation (precomputed once per render pass) ----------------

  const condStyles = useMemo(() => computeCondFormatStyles(sheet, computed), [sheet.condFormats, computed])
  const validationMap = useMemo(() => computeValidationMap(sheet), [sheet.validations])
  const filterBounds = useMemo(() => filterBoundsOf(sheet), [sheet.filter])
  const filterHiddenRowSet = useMemo(() => computeFilterHiddenRows(sheet, computed), [sheet.filter, computed])
  const filterPopoverValues = useMemo(
    () => (filterPopover ? columnDistinctValues(sheet, computed, filterPopover.colOffset) : []),
    [filterPopover, sheet, computed],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setViewport({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---------------- hidden rows/cols ----------------

  // Composes stage-1 explicit row-hides with the column filter's row exclusions —
  // either mechanism hiding a row is enough to collapse it to zero height.
  const hiddenRowSet = useMemo(() => {
    const set = new Set(sheet.hiddenRows ?? [])
    for (const r of filterHiddenRowSet) set.add(r)
    return set
  }, [sheet.hiddenRows, filterHiddenRowSet])
  const hiddenColSet = useMemo(() => new Set(sheet.hiddenCols ?? []), [sheet.hiddenCols])

  // effColW/effRowH are the single source of truth for track sizing: 0 when
  // hidden, the live resize-preview size while dragging, else the stored/default
  // size. Offsets (for virtualization + overlay positioning) are derived from
  // these so every consumer agrees on hidden/resizing state.
  const effColW = useCallback(
    (c: number) => {
      if (hiddenColSet.has(c)) return 0
      if (resizePreview && resizePreview.kind === 'col' && resizePreview.index === c) return resizePreview.size
      return sheet.colWidths[c] ?? 100
    },
    [resizePreview, sheet.colWidths, hiddenColSet],
  )
  const effRowH = useCallback(
    (r: number) => {
      if (hiddenRowSet.has(r)) return 0
      if (resizePreview && resizePreview.kind === 'row' && resizePreview.index === r) return resizePreview.size
      return sheet.rowHeights[r] ?? 24
    },
    [resizePreview, sheet.rowHeights, hiddenRowSet],
  )

  const colOffsets = useMemo(() => buildOffsetsFromSizer(colCount, effColW), [colCount, effColW])
  const rowOffsets = useMemo(() => buildOffsetsFromSizer(rowCount, effRowH), [rowCount, effRowH])
  const totalWidth = colOffsets[colCount] ?? 0
  const totalHeight = rowOffsets[rowCount] ?? 0

  const visRowStart = Math.max(0, indexAtOffset(rowOffsets, Math.max(0, scrollTop)) - OVERSCAN)
  const visRowEnd = Math.min(rowCount - 1, indexAtOffset(rowOffsets, scrollTop + viewport.h) + OVERSCAN)
  const visColStart = Math.max(0, indexAtOffset(colOffsets, Math.max(0, scrollLeft)) - OVERSCAN)
  const visColEnd = Math.min(colCount - 1, indexAtOffset(colOffsets, scrollLeft + viewport.w) + OVERSCAN)

  // ---------------- freeze panes ----------------

  const freezeRows = Math.max(0, Math.min(sheet.freeze?.rows ?? 0, rowCount))
  const freezeCols = Math.max(0, Math.min(sheet.freeze?.cols ?? 0, colCount))

  /** Content-space Y for row r's top edge — offset by scrollTop while r is in the frozen band, so it paints pinned like a sticky element regardless of scroll. */
  const rowEdgeY = useCallback(
    (r: number) => {
      const y = COL_HEADER_H + (rowOffsets[r] ?? totalHeight)
      return r < freezeRows ? y + scrollTop : y
    },
    [rowOffsets, freezeRows, scrollTop, totalHeight],
  )
  const colEdgeX = useCallback(
    (c: number) => {
      const x = ROW_HEADER_W + (colOffsets[c] ?? totalWidth)
      return c < freezeCols ? x + scrollLeft : x
    },
    [colOffsets, freezeCols, scrollLeft, totalWidth],
  )

  const visRows: number[] = []
  {
    const seen = new Set<number>()
    for (let r = 0; r < freezeRows; r++) {
      if (hiddenRowSet.has(r)) continue
      seen.add(r)
      visRows.push(r)
    }
    for (let r = visRowStart; r <= visRowEnd; r++) {
      if (hiddenRowSet.has(r) || seen.has(r)) continue
      visRows.push(r)
    }
  }
  const visCols: number[] = []
  {
    const seen = new Set<number>()
    for (let c = 0; c < freezeCols; c++) {
      if (hiddenColSet.has(c)) continue
      seen.add(c)
      visCols.push(c)
    }
    for (let c = visColStart; c <= visColEnd; c++) {
      if (hiddenColSet.has(c) || seen.has(c)) continue
      visCols.push(c)
    }
  }
  const frozenRowIdxs = visRows.filter((r) => r < freezeRows)
  const windowedRowIdxs = visRows.filter((r) => r >= freezeRows)
  const frozenColIdxs = visCols.filter((c) => c < freezeCols)
  const windowedColIdxs = visCols.filter((c) => c >= freezeCols)

  const colGapW = windowedColIdxs.length ? Math.max(0, colOffsets[windowedColIdxs[0]] - colOffsets[freezeCols]) : 0
  const rowGapH = windowedRowIdxs.length ? Math.max(0, rowOffsets[windowedRowIdxs[0]] - rowOffsets[freezeRows]) : 0
  const rowBottomH = windowedRowIdxs.length
    ? Math.max(0, totalHeight - rowOffsets[windowedRowIdxs[windowedRowIdxs.length - 1] + 1])
    : Math.max(0, totalHeight - rowOffsets[freezeRows])

  // ---------------- merges ----------------

  /** Cells (top-left AND covered) whose per-row text should render blank — the real content paints via MergeOverlay on top. */
  const mergeBlankSet = useMemo(() => {
    const set = new Set<string>()
    for (const m of sheet.merges ?? []) {
      const span = parseMergeRange(m)
      if (!span) continue
      for (let r = span.r0; r <= span.r1; r++) {
        for (let c = span.c0; c <= span.c1; c++) set.add(`${r},${c}`)
      }
    }
    return set
  }, [sheet.merges])

  const activeSpan = useMemo(() => mergeSpanAt(sheet.merges, active.row, active.col), [sheet.merges, active.row, active.col])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    setScrollLeft(el.scrollLeft)
  }, [])

  // ---------------- scroll active cell into view (handles keyboard nav + find/replace jumps) ----------------

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const { row, col } = active
    if (row >= freezeRows) {
      const top = rowOffsets[row] ?? 0
      const bottom = rowOffsets[row + 1] ?? top
      const frozenBand = rowOffsets[freezeRows] ?? 0
      if (top - frozenBand < scrollTop) el.scrollTop = Math.max(0, top - frozenBand)
      else if (bottom - frozenBand > scrollTop + (viewport.h - frozenBand)) el.scrollTop = bottom - viewport.h
    }
    if (col >= freezeCols) {
      const left = colOffsets[col] ?? 0
      const right = colOffsets[col + 1] ?? left
      const frozenBand = colOffsets[freezeCols] ?? 0
      if (left - frozenBand < scrollLeft) el.scrollLeft = Math.max(0, left - frozenBand)
      else if (right - frozenBand > scrollLeft + (viewport.w - frozenBand)) el.scrollLeft = right - viewport.w
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.row, active.col])

  // ---------------- selection helpers ----------------

  const startSelect = useCallback(
    (row: number, col: number, extend: boolean) => {
      if (editing) onCommitEdit('none')
      if (extend) {
        onSelChange(normalizeSel(active, { row, col }), active)
      } else {
        onSelChange({ r0: row, c0: col, r1: row, c1: col }, { row, col })
      }
    },
    [editing, onCommitEdit, onSelChange, active],
  )

  const extendSelectTo = useCallback(
    (row: number, col: number) => {
      onSelChange(normalizeSel(active, { row, col }), active)
    },
    [onSelChange, active],
  )

  const selectCol = useCallback(
    (col: number, extend: boolean) => {
      if (editing) onCommitEdit('none')
      if (extend) {
        onSelChange({ r0: 0, c0: Math.min(active.col, col), r1: rowCount - 1, c1: Math.max(active.col, col) }, active)
      } else {
        onSelChange({ r0: 0, c0: col, r1: rowCount - 1, c1: col }, { row: 0, col })
      }
    },
    [editing, onCommitEdit, onSelChange, active, rowCount],
  )

  const selectRow = useCallback(
    (row: number, extend: boolean) => {
      if (editing) onCommitEdit('none')
      if (extend) {
        onSelChange({ r0: Math.min(active.row, row), c0: 0, r1: Math.max(active.row, row), c1: colCount - 1 }, active)
      } else {
        onSelChange({ r0: row, c0: 0, r1: row, c1: colCount - 1 }, { row, col: 0 })
      }
    },
    [editing, onCommitEdit, onSelChange, active, colCount],
  )

  const selectAllUsed = useCallback(() => {
    if (editing) onCommitEdit('none')
    const { maxRow, maxCol } = usedRange(sheet)
    const r1 = Math.max(0, maxRow)
    const c1 = Math.max(0, maxCol)
    onSelChange({ r0: 0, c0: 0, r1, c1 }, { row: 0, col: 0 })
  }, [editing, onCommitEdit, onSelChange, sheet])

  useEffect(() => {
    const onUp = () => {
      isSelectingRef.current = false
      if (isFillingRef.current) {
        isFillingRef.current = false
        if (fillSrcRef.current && fillPreview && !sameSel(fillSrcRef.current, fillPreview)) {
          onFillApply(fillSrcRef.current, fillPreview)
        }
        fillSrcRef.current = null
        setFillPreview(null)
      }
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [fillPreview, onFillApply])

  function sameSel(a: SelRect, b: SelRect) {
    return a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1
  }

  // ---------------- resize ----------------

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const st = resizeState.current
      if (!st) return
      if (st.kind === 'col') {
        const w = Math.max(MIN_COL_W, st.startSize + (e.clientX - st.start))
        setResizePreview({ kind: 'col', index: st.index, size: w })
      } else {
        const h = Math.max(MIN_ROW_H, st.startSize + (e.clientY - st.start))
        setResizePreview({ kind: 'row', index: st.index, size: h })
      }
    }
    function onUp() {
      const st = resizeState.current
      if (st && resizePreview) {
        if (st.kind === 'col') onColResize(st.index, resizePreview.size)
        else onRowResize(st.index, resizePreview.size)
      }
      resizeState.current = null
      setResizePreview(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizePreview, onColResize, onRowResize])

  // ---------------- keyboard ----------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommitEdit(e.shiftKey ? 'up' : 'down')
        } else if (e.key === 'Tab') {
          e.preventDefault()
          onCommitEdit(e.shiftKey ? 'left' : 'right')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancelEdit()
        }
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllUsed()
        return
      }
      if (mod) return // let Cmd+Z/S/C/V/X/F etc. pass through to global handlers
      const { row, col } = active
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const dir = e.key === 'ArrowDown' ? 'down' : e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowRight' ? 'right' : 'left'
        const stepped = stepPastSpanSkippingHidden(sheet.merges, hiddenRowSet, hiddenColSet, row, col, dir, rowCount, colCount)
        const nr = Math.max(0, Math.min(rowCount - 1, stepped.row))
        const nc = Math.max(0, Math.min(colCount - 1, stepped.col))
        if (e.shiftKey) {
          onSelChange(normalizeSel(active, { row: nr, col: nc }), active)
        } else {
          onSelChange({ r0: nr, c0: nc, r1: nr, c1: nc }, { row: nr, col: nc })
        }
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const stepped = stepPastSpanSkippingHidden(sheet.merges, hiddenRowSet, hiddenColSet, row, col, e.shiftKey ? 'left' : 'right', rowCount, colCount)
        const nc = Math.max(0, Math.min(colCount - 1, stepped.col))
        onSelChange({ r0: row, c0: nc, r1: row, c1: nc }, { row, col: nc })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const stepped = stepPastSpanSkippingHidden(sheet.merges, hiddenRowSet, hiddenColSet, row, col, e.shiftKey ? 'up' : 'down', rowCount, colCount)
        const nr = Math.max(0, Math.min(rowCount - 1, stepped.row))
        onSelChange({ r0: nr, c0: col, r1: nr, c1: col }, { row: nr, col })
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        onStartEdit(row, col)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onClearSelection()
        return
      }
      if (e.key.length === 1 && !e.altKey) {
        onStartEdit(row, col, '')
        onEditValueChange(e.key)
      }
    },
    [
      editing,
      active,
      rowCount,
      colCount,
      sheet.merges,
      hiddenRowSet,
      hiddenColSet,
      onSelChange,
      onStartEdit,
      onEditValueChange,
      onCommitEdit,
      onCancelEdit,
      onClearSelection,
      selectAllUsed,
    ],
  )

  // ---------------- editing overlay position (merge-span aware) ----------------

  const editSpan = editing ? mergeSpanAt(sheet.merges, editing.row, editing.col) : null
  const editTop = editSpan ? rowEdgeY(editSpan.r0) : 0
  const editLeft = editSpan ? colEdgeX(editSpan.c0) : 0
  const editW = editSpan ? Math.max(0, colEdgeX(editSpan.c1 + 1) - colEdgeX(editSpan.c0)) : 0
  const editH = editSpan ? Math.max(0, rowEdgeY(editSpan.r1 + 1) - rowEdgeY(editSpan.r0)) : 0
  const editValidation = editing ? validationMap.get(refToString(editing.col, editing.row)) : undefined

  // ---------------- render ----------------

  const selOverlay = {
    top: rowEdgeY(sel.r0),
    left: colEdgeX(sel.c0),
    width: Math.max(0, colEdgeX(sel.c1 + 1) - colEdgeX(sel.c0)),
    height: Math.max(0, rowEdgeY(sel.r1 + 1) - rowEdgeY(sel.r0)),
  }
  const activeOverlay = {
    top: rowEdgeY(activeSpan.r0),
    left: colEdgeX(activeSpan.c0),
    width: Math.max(0, colEdgeX(activeSpan.c1 + 1) - colEdgeX(activeSpan.c0)),
    height: Math.max(0, rowEdgeY(activeSpan.r1 + 1) - rowEdgeY(activeSpan.r0)),
  }
  const fillDisplaySel = fillPreview ?? sel
  const isMultiSel = sel.r0 !== sel.r1 || sel.c0 !== sel.c1

  function colHeadStyle(c: number, frozen: boolean): React.CSSProperties {
    const style: React.CSSProperties = { width: effColW(c) }
    if (frozen) {
      style.position = 'sticky'
      style.left = ROW_HEADER_W + colOffsets[c]
      style.zIndex = 2
      style.background = 'var(--surface-2)'
    }
    if (hiddenColSet.has(c - 1)) style.borderLeft = '3px double var(--text-3)'
    return style
  }

  function renderColHead(c: number, frozen: boolean) {
    return (
      <div
        key={c}
        className={'sx-colhead' + (c >= sel.c0 && c <= sel.c1 ? ' sel' : '')}
        style={colHeadStyle(c, frozen)}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).classList.contains('sx-colresize')) return
          selectCol(c, e.shiftKey)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const isColSel = sel.r0 === 0 && sel.r1 === rowCount - 1 && c >= sel.c0 && c <= sel.c1
          if (!isColSel) selectCol(c, false)
          onOpenContextMenu({ x: e.clientX, y: e.clientY, kind: 'col' })
        }}
      >
        <span>{colLabel(c)}</span>
        <div
          className="sx-colresize"
          onMouseDown={(e) => {
            e.stopPropagation()
            resizeState.current = { kind: 'col', index: c, start: e.clientX, startSize: effColW(c) }
            setResizePreview({ kind: 'col', index: c, size: effColW(c) })
          }}
        />
      </div>
    )
  }

  function renderCell(r: number, c: number, frozenCol: boolean) {
    const ref = refToString(c, r)
    const cell: Cell | undefined = sheet.cells[ref]
    const { text, err } = cellDisplay(computed, ref)
    const numeric = !err && typeof computed.get(ref)?.value === 'number'
    const isActive = active.row === r && active.col === c
    const isBlankForMerge = mergeBlankSet.has(`${r},${c}`)
    const cond = condStyles.get(ref)
    const style: React.CSSProperties = { width: effColW(c), ...cellStyleCss(cell?.style, numeric, cond) }
    if (frozenCol) {
      style.position = 'sticky'
      style.left = ROW_HEADER_W + colOffsets[c]
      style.zIndex = 2
      style.background = cond?.fill ?? cell?.style?.fill ?? 'var(--surface)'
    }
    if (hiddenColSet.has(c - 1)) style.borderLeft = '3px double var(--text-3)'

    const isEditingHere = isActive && !!editing
    const filterColOffset =
      filterBounds && r === filterBounds.r0 && c >= filterBounds.c0 && c <= filterBounds.c1 ? c - filterBounds.c0 : null
    const filterHasExclusion = filterColOffset !== null && (sheet.filter?.excluded[filterColOffset]?.length ?? 0) > 0
    const validation = !isBlankForMerge ? validationMap.get(ref) : undefined
    const showWarn = !isEditingHere && !!validation && !isValueInOptions(validation, cell?.v)

    return (
      <div
        key={c}
        className={'sx-cell' + (err ? ' err' : '')}
        style={style}
        onMouseDown={(e) => {
          if (e.button !== 0) return
          isSelectingRef.current = true
          startSelect(r, c, e.shiftKey)
        }}
        onMouseEnter={() => {
          if (isSelectingRef.current) extendSelectTo(r, c)
          if (isFillingRef.current && fillSrcRef.current) {
            setFillPreview(extendFillRect(fillSrcRef.current, r, c))
          }
        }}
        onDoubleClick={() => onStartEdit(r, c)}
      >
        {isEditingHere ? null : isBlankForMerge ? '' : text}
        {!isEditingHere && validation && <span className="sx-dd-chevron">▾</span>}
        {showWarn && <span className="sx-warn-corner" title="Not in dropdown list" />}
        {filterColOffset !== null && (
          <button
            className={'sx-filter-btn' + (filterHasExclusion ? ' active' : '')}
            title="Filter"
            onMouseDown={(e) => {
              e.stopPropagation()
              setFilterPopover({ colOffset: filterColOffset, anchor: e.currentTarget })
            }}
          >
            <IcFunnel />
          </button>
        )}
      </div>
    )
  }

  function renderRow(r: number, frozenRow: boolean) {
    const style: React.CSSProperties = { height: effRowH(r) }
    if (frozenRow) {
      style.position = 'sticky'
      style.top = COL_HEADER_H + rowOffsets[r]
      style.zIndex = 3
      style.background = 'var(--surface)'
    }
    if (hiddenRowSet.has(r - 1)) style.borderTop = '3px double var(--text-3)'
    return (
      <div className="sx-row" key={r} style={style}>
        <div
          className={'sx-rowhead' + (r >= sel.r0 && r <= sel.r1 ? ' sel' : '')}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).classList.contains('sx-rowresize')) return
            selectRow(r, e.shiftKey)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const isRowSel = sel.c0 === 0 && sel.c1 === colCount - 1 && r >= sel.r0 && r <= sel.r1
            if (!isRowSel) selectRow(r, false)
            onOpenContextMenu({ x: e.clientX, y: e.clientY, kind: 'row' })
          }}
        >
          <span>{r + 1}</span>
          <div
            className="sx-rowresize"
            onMouseDown={(e) => {
              e.stopPropagation()
              resizeState.current = { kind: 'row', index: r, start: e.clientY, startSize: effRowH(r) }
              setResizePreview({ kind: 'row', index: r, size: effRowH(r) })
            }}
          />
        </div>
        {frozenColIdxs.map((c) => renderCell(r, c, true))}
        <div style={{ width: colGapW, flexShrink: 0 }} />
        {windowedColIdxs.map((c) => renderCell(r, c, false))}
      </div>
    )
  }

  return (
    <div
      className={'sx-gridroot' + (paintArmed ? ' sx-paint-armed' : '')}
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpenContextMenu({ x: e.clientX, y: e.clientY, kind: 'cell' })
      }}
    >
      <div className="sx-scroll" ref={scrollRef} onScroll={onScroll} style={{ zoom: zoom / 100 }}>
        <div className="sx-content" style={{ width: ROW_HEADER_W + totalWidth }}>
          <div className="sx-headrow" style={{ height: COL_HEADER_H }}>
            <div className="sx-corner" onClick={selectAllUsed} title="Select all" />
            {frozenColIdxs.map((c) => renderColHead(c, true))}
            <div style={{ width: colGapW, flexShrink: 0 }} />
            {windowedColIdxs.map((c) => renderColHead(c, false))}
          </div>

          {frozenRowIdxs.map((r) => renderRow(r, true))}
          <div style={{ height: rowGapH }} />
          {windowedRowIdxs.map((r) => renderRow(r, false))}
          <div style={{ height: rowBottomH }} />

          {/* Selection + fill overlays — absolutely positioned so they overlap
              the content coordinate space instead of adding to its flow height. */}
          <div className="sx-overlay-layer">
          <MergeOverlay sheet={sheet} computed={computed} rowEdgeY={rowEdgeY} colEdgeX={colEdgeX} cellStyleCss={cellStyleCss} condStyles={condStyles} />
          {isMultiSel && (
            <div
              className="sx-selrect"
              style={{ top: selOverlay.top, left: selOverlay.left, width: selOverlay.width, height: selOverlay.height }}
            />
          )}
          <div
            className="sx-activecell"
            style={{ top: activeOverlay.top, left: activeOverlay.left, width: activeOverlay.width, height: activeOverlay.height }}
          />
          {fillPreview && (
            <div
              className="sx-fillrect"
              style={{
                top: rowEdgeY(fillDisplaySel.r0),
                left: colEdgeX(fillDisplaySel.c0),
                width: Math.max(0, colEdgeX(fillDisplaySel.c1 + 1) - colEdgeX(fillDisplaySel.c0)),
                height: Math.max(0, rowEdgeY(fillDisplaySel.r1 + 1) - rowEdgeY(fillDisplaySel.r0)),
              }}
            />
          )}
          <div
            className="sx-fillhandle"
            style={{
              top: rowEdgeY(sel.r1 + 1) - 4,
              left: colEdgeX(sel.c1 + 1) - 4,
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              isFillingRef.current = true
              fillSrcRef.current = sel
              setFillPreview(sel)
            }}
          />
          {editing && (
            <input
              ref={editInputRef}
              className="sx-editinput"
              style={{ top: editTop, left: editLeft, width: Math.max(editW, 60), minHeight: editH }}
              value={editing.value}
              autoFocus
              spellCheck={false}
              onChange={(e) => onEditValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onCommitEdit(e.shiftKey ? 'up' : 'down')
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  onCommitEdit(e.shiftKey ? 'left' : 'right')
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  onCancelEdit()
                }
              }}
            />
          )}
          {editing && editValidation && (
            <DropdownOptionList
              top={editTop + editH + 2}
              left={editLeft}
              minWidth={Math.max(editW, 140)}
              options={editValidation.options}
              row={editing.row}
              col={editing.col}
              onPick={onPickOption}
            />
          )}
          <ChartLayer
            charts={charts}
            computed={computed}
            offsetX={ROW_HEADER_W}
            offsetY={COL_HEADER_H}
            onUpdate={onChartUpdate}
            onEdit={onChartEdit}
            onDelete={onChartDelete}
          />
          </div>
        </div>
      </div>
      {filterPopover && sheet.filter && (
        <FilterPopover
          anchor={filterPopover.anchor}
          values={filterPopoverValues}
          excluded={sheet.filter.excluded[filterPopover.colOffset] ?? []}
          onChange={(next) => {
            const filter = sheet.filter
            if (!filter) return
            onFilterChange({ ...filter, excluded: { ...filter.excluded, [filterPopover.colOffset]: next } })
          }}
          onClose={() => setFilterPopover(null)}
        />
      )}
    </div>
  )
}

/** Options list shown while editing a validated cell — click an option to
 *  commit it immediately (free typing still works alongside this). */
function DropdownOptionList({
  top,
  left,
  minWidth,
  options,
  row,
  col,
  onPick,
}: {
  top: number
  left: number
  minWidth: number
  options: string[]
  row: number
  col: number
  onPick: (row: number, col: number, value: string) => void
}) {
  return (
    <div className="sx-dd-list" style={{ top, left, minWidth }}>
      {options.map((opt, i) => (
        <button
          key={i}
          className="sx-dd-item"
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(row, col, opt)
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function extendFillRect(src: SelRect, r: number, c: number): SelRect {
  // Fill can only extend in one axis at a time — pick whichever the pointer moved further along.
  const dDown = r - src.r1
  const dUp = src.r0 - r
  const dRight = c - src.c1
  const dLeft = src.c0 - c
  const best = Math.max(dDown, dUp, dRight, dLeft, 0)
  if (best === 0) return src
  if (best === dDown) return { r0: src.r0, c0: src.c0, r1: r, c1: src.c1 }
  if (best === dUp) return { r0: r, c0: src.c0, r1: src.r1, c1: src.c1 }
  if (best === dRight) return { r0: src.r0, c0: src.c0, r1: src.r1, c1: c }
  return { r0: src.r0, c0: c, r1: src.r1, c1: src.c1 }
}
