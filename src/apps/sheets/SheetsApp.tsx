import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorAppProps, SheetsContent, Sheet, Cell, CellStyle, ChartSpec, CondRule, PivotSpec, SheetFilter, Validation } from '../../shared/types'
import { uid } from '../../shared/types'
import { platform } from '../../shared/platform'
import { registerExporters } from '../../shared/exporters'
import { registerCommands, clearCommands } from '../../shared/commands'
import { putLinkClipboard, rangeToA1, readRange } from '../../shared/livelink'
import { Modal, Button, type MenuItem } from '../../shared/ui'
import { computeSheet, isFormula } from './engine/formula'
import { parseCellRef, refToString } from './engine/refs'
import { usedRange } from './gridMath'
import { buildLivingSpreadsheetHtml } from './livingExport'
import { ShareWebPageModal } from '../../shared/ShareWebPageModal'
import AiFormulaModal from './AiFormulaModal'
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  GROW_ROWS,
  GROW_COLS,
  EDGE_PAD,
  normalizeSel,
  type SelRect,
  type CellPos,
  type ClipboardPayload,
} from './types'
import { computeFillPatch } from './fill'
import {
  buildClipboardPayload,
  tsvFromSelection,
  parseExternalText,
  applyPayloadToCells,
  INTERNAL_MIME,
} from './clipboard'
import {
  exportXlsxBase64,
  exportCsv,
  base64ToWorkbook,
  workbookToSheets,
  csvToSheet,
  newSheetName,
  blankSheet,
} from './export'
import { guessChartSpecFromSelection } from './chartData'
import {
  anchorValid,
  buildPivot,
  parseSourceRef,
  pivotColWidths,
  pivotConflicts,
  pivotPatch,
  qualifySource,
  readSource,
  refreshConflicts,
  suggestAnchor,
  suggestFields,
  type SourceTable,
} from './pivot'
import PivotModal, { type PivotFormValue } from './PivotModal'
import type { ChartFormValue } from './ChartModal'
import Toolbar, { type BorderKind, type AutosumOp, type PaintMode } from './Toolbar'
import { tablePatchFor, removeTableStylePatch } from './tableStyle'
import FormulaBar from './FormulaBar'
import Grid, { type ContextMenuTarget, type EditingState } from './Grid'
import SheetTabs from './SheetTabs'
import StatusBar from './StatusBar'
import ContextMenu from './ContextMenu'
import ChartModal from './ChartModal'
import FindReplace from './FindReplace'
import CondFormatModal from './CondFormatModal'
import ValidationModal from './ValidationModal'
import { computeFilterHiddenRows, filterBoundsOf, shiftFilterForColDelete, shiftFilterForColInsert } from './filter'
import {
  applyMerge,
  applyUnmerge,
  mergeRangeStr,
  mergeSpanAt,
  mergesIntersectCols,
  mergesIntersectRect,
  mergesIntersectRows,
  shiftMergesForColDelete,
  shiftMergesForColInsert,
  shiftMergesForRowDelete,
  shiftMergesForRowInsert,
  snapSelToMerges,
  stepPastSpanSkippingHidden,
} from './merge'
import { hideCols, hideRows, isColHidden, isRowHidden, shiftHiddenForDelete, shiftHiddenForInsert, unhideCols, unhideRows } from './hide'
import { shiftRangeForColDelete, shiftRangeForColInsert, shiftRangeForRowDelete, shiftRangeForRowInsert } from './rangeShift'
import './sheets.css'

const HISTORY_CAP = 100

function ensureSheet(content: SheetsContent): SheetsContent {
  if (content.sheets.length === 0) {
    return { sheets: [blankSheet('Sheet 1')], active: 0 }
  }
  if (content.active < 0 || content.active >= content.sheets.length) {
    return { ...content, active: 0 }
  }
  return content
}

/** Merges a style mutation into a cell, returning null when the result is fully empty (deletes the cell). */
function mergeStyle(existing: Cell | undefined, mutate: (s: CellStyle) => void): Cell | null {
  const style: CellStyle = { ...existing?.style }
  mutate(style)
  const cleaned: CellStyle = {}
  ;(Object.keys(style) as (keyof CellStyle)[]).forEach((k) => {
    const v = style[k]
    if (v === undefined || v === false) return
    if (k === 'borders') {
      const b = v as CellStyle['borders']
      if (!b || !(b.top || b.right || b.bottom || b.left)) return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cleaned as any)[k] = v
  })
  const hasStyle = Object.keys(cleaned).length > 0
  if (existing?.v !== undefined) return { v: existing.v, ...(hasStyle ? { style: cleaned } : {}) }
  return hasStyle ? { style: cleaned } : null
}

export default function SheetsApp({ doc, onDocChange, requestSave }: EditorAppProps<SheetsContent>) {
  const initialContent = ensureSheet(doc.content as SheetsContent)
  const [content, setContentState] = useState<SheetsContent>(initialContent)
  const contentRef = useRef(content)
  contentRef.current = content

  const [sel, setSelState] = useState<SelRect>({ r0: 0, c0: 0, r1: 0, c1: 0 })
  const selRef = useRef(sel)
  selRef.current = sel
  const [active, setActiveState] = useState<CellPos>({ row: 0, col: 0 })
  const activeRef = useRef(active)
  activeRef.current = active
  const [editing, setEditing] = useState<EditingState | null>(null)
  const editingRef = useRef(editing)
  editingRef.current = editing
  const [zoom, setZoom] = useState(100)
  const [sizeOverrides, setSizeOverrides] = useState<Record<number, { rows: number; cols: number }>>({})
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null)
  const [chartModal, setChartModal] = useState<{ mode: 'new' | 'edit'; chart?: ChartSpec } | null>(null)
  const [pivotOpen, setPivotOpen] = useState(false)
  const [importPending, setImportPending] = useState<{ kind: 'xlsx' | 'csv'; run: () => void } | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [condFormatOpen, setCondFormatOpen] = useState(false)
  const [validationOpen, setValidationOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  // Format painter: 'once' auto-disarms after the next grid click/drag applies
  // it, 'sticky' (double-click to arm) stays on until Esc. The captured style
  // and the live mode are mirrored into refs so the window-level mouseup/keydown
  // listeners below always see the current value without re-subscribing.
  const [paintMode, setPaintMode] = useState<PaintMode>('off')
  const paintModeRef = useRef<PaintMode>('off')
  const paintStyleRef = useRef<CellStyle>({})

  const undoStack = useRef<SheetsContent[]>([])
  const redoStack = useRef<SheetsContent[]>([])
  const [historyTick, setHistoryTick] = useState(0)
  const clipboardRef = useRef<ClipboardPayload | null>(null)

  const gridRootRef = useRef<HTMLDivElement | null>(null)
  const gridEditInputRef = useRef<HTMLInputElement | null>(null)
  const fxInputRef = useRef<HTMLInputElement | null>(null)

  const docIdRef = useRef(doc.meta.id)
  useEffect(() => {
    if (doc.meta.id !== docIdRef.current) {
      docIdRef.current = doc.meta.id
      const next = ensureSheet(doc.content as SheetsContent)
      setContentState(next)
      contentRef.current = next
      undoStack.current = []
      redoStack.current = []
      setHistoryTick((t) => t + 1)
      setSizeOverrides({})
      setSel({ r0: 0, c0: 0, r1: 0, c1: 0 })
      setActive({ row: 0, col: 0 })
      setEditing(null)
      setCtxMenu(null)
      setChartModal(null)
      setPivotOpen(false)
      setCondFormatOpen(false)
      setValidationOpen(false)
      setAiModalOpen(false)
      setShareOpen(false)
      // A format painter armed against the previous document must not survive
      // the switch — otherwise the captured style (and the armed cursor/outline
      // hint) would leak in and apply itself to the newly-loaded document.
      paintModeRef.current = 'off'
      setPaintMode('off')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.meta.id])

  // Save As format menu: Excel and CSV alongside the native format.
  useEffect(() => {
    registerExporters('sheets', [
      {
        ext: 'xlsx',
        label: 'Excel workbook',
        produce: async () => ({ data: exportXlsxBase64(contentRef.current), binary: true }),
      },
      {
        ext: 'csv',
        label: 'CSV (active sheet)',
        produce: async () => ({
          data: exportCsv(contentRef.current.sheets[contentRef.current.active]),
          binary: false,
        }),
      },
    ])
  }, [])

  // Cmd+K palette commands. Re-registered whenever selection/content changes
  // so each command always acts on the CURRENT selection/sheet, not whatever
  // was active the first time this effect ran; cleared on unmount so a closed
  // document never leaves stale sheets commands in the palette.
  useEffect(() => {
    registerCommands('sheets', [
      { id: 'sheets.autosum', title: 'AutoSum', group: 'Sheets', run: () => applyAutosum('SUM') },
      { id: 'sheets.insertChart', title: 'Insert chart', group: 'Sheets', run: () => setChartModal({ mode: 'new' }) },
      {
        id: 'sheets.freezePanes',
        title: 'Freeze panes',
        group: 'Sheets',
        keywords: 'freeze row column',
        run: () => setFreeze(sheet.freeze && (sheet.freeze.rows || sheet.freeze.cols) ? undefined : { rows: 1, cols: 0 }),
      },
      {
        id: 'sheets.pivotTable',
        title: 'Pivot table',
        group: 'Sheets',
        keywords: 'summarise summarize group aggregate crosstab',
        run: () => setPivotOpen(true),
      },
      {
        id: 'sheets.refreshPivots',
        title: 'Refresh pivot tables',
        group: 'Sheets',
        keywords: 'pivot recompute update',
        run: () => refreshPivots(),
      },
      { id: 'sheets.condFormat', title: 'Conditional formatting', group: 'Sheets', run: () => setCondFormatOpen(true) },
      { id: 'sheets.createFilter', title: 'Create filter', group: 'Sheets', run: () => toggleFilter() },
      { id: 'sheets.mergeCenter', title: 'Merge & center', group: 'Sheets', run: () => mergeSelection(true) },
      {
        id: 'sheets.copyLiveLink',
        title: 'Copy as live link',
        group: 'Sheets',
        keywords: 'paste docs slides embed',
        run: () => void copyAsLiveLink(),
      },
      {
        id: 'sheets.aiFormula',
        title: 'AI formula assistant',
        group: 'Sheets',
        keywords: 'ai sparkle describe explain openrouter',
        run: () => setAiModalOpen(true),
      },
      { id: 'sheets.exportXlsx', title: 'Export as Excel', group: 'Sheets', keywords: 'xlsx download', run: () => void handleExport('xlsx') },
      { id: 'sheets.exportCsv', title: 'Export as CSV', group: 'Sheets', keywords: 'download', run: () => void handleExport('csv') },
      {
        id: 'sheets.exportLiving',
        title: 'Share as web page',
        group: 'Sheets',
        keywords: 'html interactive export download living',
        run: () => void handleExport('living'),
      },
      { id: 'sheets.addSheet', title: 'Add sheet', group: 'Sheets', run: () => addSheet() },
    ])
    return () => clearCommands('sheets')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, sel, active])

  function setSel(next: SelRect) {
    setSelState(next)
  }
  function setActive(next: CellPos) {
    setActiveState(next)
    ensureGrowth(next.row, next.col)
  }
  // Central selection gateway: every Grid interaction (click, drag, arrow keys,
  // header select, find/replace jumps) routes selection changes through here,
  // so merged ranges always expand to their full extent and the active cell
  // always lands on a merge's top-left, in one place.
  function onSelChange(nextSel: SelRect, nextActive: CellPos) {
    const merges = content.sheets[content.active].merges
    const snappedSel = snapSelToMerges(merges, nextSel)
    const activeSpan = mergeSpanAt(merges, nextActive.row, nextActive.col)
    const snappedActive = { row: activeSpan.r0, col: activeSpan.c0 }
    setSelState(snappedSel)
    setActiveState(snappedActive)
    ensureGrowth(Math.max(snappedSel.r1, snappedActive.row), Math.max(snappedSel.c1, snappedActive.col))
  }

  const sheetIndex = content.active
  const sheet = content.sheets[sheetIndex]
  const computed = useMemo(() => computeSheet(sheet), [sheet])

  const growth = sizeOverrides[sheetIndex] ?? { rows: DEFAULT_ROWS, cols: DEFAULT_COLS }
  const { maxRow, maxCol } = useMemo(() => usedRange(sheet), [sheet])
  const rowCount = Math.max(growth.rows, maxRow + 2)
  const colCount = Math.max(growth.cols, maxCol + 2)

  function ensureGrowth(row: number, col: number) {
    setSizeOverrides((prev) => {
      const g = prev[sheetIndex] ?? { rows: DEFAULT_ROWS, cols: DEFAULT_COLS }
      let rows = g.rows
      let cols = g.cols
      if (row >= rows - EDGE_PAD) rows = Math.max(rows, row + GROW_ROWS)
      if (col >= cols - EDGE_PAD) cols = Math.max(cols, col + GROW_COLS)
      if (rows === g.rows && cols === g.cols) return prev
      return { ...prev, [sheetIndex]: { rows, cols } }
    })
  }

  // ---------------- core commit / history ----------------

  function commitContent(next: SheetsContent, opts?: { snapshot?: boolean }) {
    const snapshot = opts?.snapshot !== false
    if (snapshot) {
      undoStack.current.push(structuredClone(contentRef.current))
      if (undoStack.current.length > HISTORY_CAP) undoStack.current.shift()
      redoStack.current = []
      setHistoryTick((t) => t + 1)
    }
    contentRef.current = next
    setContentState(next)
    onDocChange(next)
  }

  function commitSheetUpdate(nextSheet: Sheet, opts?: { snapshot?: boolean }) {
    const cur = contentRef.current
    const sheets = cur.sheets.slice()
    sheets[cur.active] = nextSheet
    commitContent({ ...cur, sheets }, opts)
  }

  function applyCellPatch(patch: Record<string, Cell | null>, opts?: { snapshot?: boolean }) {
    const cur = contentRef.current
    const target = cur.sheets[cur.active]
    const nextCells = { ...target.cells }
    for (const [ref, val] of Object.entries(patch)) {
      if (val === null) delete nextCells[ref]
      else nextCells[ref] = val
    }
    commitSheetUpdate({ ...target, cells: nextCells }, opts)
  }

  function undo() {
    if (!undoStack.current.length) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(structuredClone(contentRef.current))
    contentRef.current = prev
    setContentState(prev)
    onDocChange(prev)
    setHistoryTick((t) => t + 1)
  }
  function redo() {
    if (!redoStack.current.length) return
    const next = redoStack.current.pop()!
    undoStack.current.push(structuredClone(contentRef.current))
    contentRef.current = next
    setContentState(next)
    onDocChange(next)
    setHistoryTick((t) => t + 1)
  }
  const canUndo = undoStack.current.length > 0
  const canRedo = redoStack.current.length > 0
  void historyTick // referenced so state changes above force a re-render for canUndo/canRedo

  useEffect(() => {
    function onUndoEvt() {
      undo()
    }
    function onRedoEvt() {
      redo()
    }
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z') return
      const el = document.activeElement as HTMLElement | null
      const editable = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (editable) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('anleo-undo', onUndoEvt)
    window.addEventListener('anleo-redo', onRedoEvt)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('anleo-undo', onUndoEvt)
      window.removeEventListener('anleo-redo', onRedoEvt)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------- format painter ----------------

  function armPaintOnce() {
    if (paintModeRef.current !== 'off') {
      paintModeRef.current = 'off'
      setPaintMode('off')
      return
    }
    paintStyleRef.current = activeStyle ? structuredClone(activeStyle) : {}
    paintModeRef.current = 'once'
    setPaintMode('once')
  }
  function armPaintSticky() {
    paintStyleRef.current = activeStyle ? structuredClone(activeStyle) : {}
    paintModeRef.current = 'sticky'
    setPaintMode('sticky')
  }

  // Applying happens on mouseup (once the click/drag gesture that picked the
  // destination has finished) rather than on every intermediate onSelChange
  // call during a drag — that keeps it to exactly one undo snapshot per use.
  // A mousedown->mouseup pair only counts as "the next selection click" when
  // it started on a plain cell/row-header/col-header — NOT on a column/row
  // resize handle, the fill handle, a chart, or a filter button — otherwise
  // resizing a column (say) while the painter is armed would misfire a paint
  // application using whatever the selection happened to be at the time.
  const paintGestureRef = useRef(false)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (paintModeRef.current === 'off') return
      const root = gridRootRef.current
      const target = e.target as HTMLElement | null
      paintGestureRef.current =
        !!root &&
        !!target &&
        root.contains(target) &&
        !target.closest('.sx-colresize, .sx-rowresize, .sx-fillhandle, .sx-chart-card, .sx-filter-btn, .sx-editinput, .sx-dd-list')
    }
    function onUp(e: MouseEvent) {
      if (paintModeRef.current === 'off') return
      const wasGesture = paintGestureRef.current
      paintGestureRef.current = false
      if (!wasGesture) return
      const root = gridRootRef.current
      if (!root || !(e.target instanceof Node) || !root.contains(e.target)) return
      const captured = paintStyleRef.current
      applyStyleMutation((s) => {
        ;(Object.keys(s) as (keyof CellStyle)[]).forEach((k) => delete s[k])
        Object.assign(s, structuredClone(captured))
      }, selRef.current)
      if (paintModeRef.current === 'once') {
        paintModeRef.current = 'off'
        setPaintMode('off')
      }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && paintModeRef.current !== 'off') {
        paintModeRef.current = 'off'
        setPaintMode('off')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------------- find & replace (Cmd+F while the grid has focus) ----------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'f') return
      if (chartModal || importPending) return
      if (findOpen) {
        e.preventDefault()
        return
      }
      const activeEl = document.activeElement
      const insideGrid = !!gridRootRef.current && (gridRootRef.current === activeEl || gridRootRef.current.contains(activeEl))
      const insideFx = fxInputRef.current === activeEl
      if (!insideGrid && !insideFx) return
      e.preventDefault()
      setFindOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chartModal, importPending, findOpen])

  function findJump(pos: CellPos) {
    onSelChange({ r0: pos.row, c0: pos.col, r1: pos.row, c1: pos.col }, pos)
  }
  function findReplaceCell(pos: CellPos, nextRaw: string) {
    commitCellValue(pos.row, pos.col, nextRaw)
  }
  function findReplaceAll(patch: { pos: CellPos; nextRaw: string }[]) {
    const cur = contentRef.current.sheets[contentRef.current.active]
    const cellPatch: Record<string, Cell | null> = {}
    for (const { pos, nextRaw } of patch) {
      const ref = refToString(pos.col, pos.row)
      const existing = cur.cells[ref]
      cellPatch[ref] = nextRaw === '' ? (existing?.style ? { style: existing.style } : null) : existing?.style ? { v: nextRaw, style: existing.style } : { v: nextRaw }
    }
    applyCellPatch(cellPatch)
  }

  // ---------------- clipboard ----------------

  useEffect(() => {
    function gridIsActive() {
      return !editingRef.current && !!gridRootRef.current && gridRootRef.current.contains(document.activeElement)
    }
    function onCopy(e: ClipboardEvent) {
      if (!gridIsActive()) return
      e.preventDefault()
      const cur = contentRef.current
      const s = cur.sheets[cur.active]
      const payload = buildClipboardPayload(s, selRef.current, 'copy')
      clipboardRef.current = payload
      e.clipboardData?.setData('text/plain', tsvFromSelection(s, selRef.current))
      e.clipboardData?.setData(INTERNAL_MIME, JSON.stringify(payload))
    }
    function onCut(e: ClipboardEvent) {
      if (!gridIsActive()) return
      e.preventDefault()
      const cur = contentRef.current
      const s = cur.sheets[cur.active]
      const payload = buildClipboardPayload(s, selRef.current, 'cut')
      clipboardRef.current = payload
      e.clipboardData?.setData('text/plain', tsvFromSelection(s, selRef.current))
      e.clipboardData?.setData(INTERNAL_MIME, JSON.stringify(payload))
      clearRect(selRef.current)
    }
    function onPaste(e: ClipboardEvent) {
      if (!gridIsActive()) return
      e.preventDefault()
      const dest = activeRef.current
      const internal = e.clipboardData?.getData(INTERNAL_MIME)
      if (internal) {
        try {
          const payload: ClipboardPayload = JSON.parse(internal)
          pasteInternalPayload(payload, dest)
          return
        } catch {
          /* fall through to text */
        }
      }
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (text) pasteExternalText(text, dest)
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pasteInternalPayload(payload: ClipboardPayload, dest: CellPos) {
    const cur = contentRef.current
    const s = cur.sheets[cur.active]
    const nextCells = { ...s.cells }
    applyPayloadToCells(nextCells, payload, dest.row, dest.col)
    commitSheetUpdate({ ...s, cells: nextCells })
    const r1 = dest.row + payload.rows - 1
    const c1 = dest.col + payload.cols - 1
    onSelChange({ r0: dest.row, c0: dest.col, r1, c1 }, dest)
  }

  function pasteExternalText(text: string, dest: CellPos) {
    const grid = parseExternalText(text)
    const cur = contentRef.current
    const s = cur.sheets[cur.active]
    const nextCells = { ...s.cells }
    grid.forEach((row, r) => {
      row.forEach((val, c) => {
        const ref = refToString(dest.col + c, dest.row + r)
        const existing = nextCells[ref]
        if (val === '') {
          if (existing?.style) nextCells[ref] = { style: existing.style }
          else delete nextCells[ref]
        } else {
          nextCells[ref] = existing?.style ? { v: val, style: existing.style } : { v: val }
        }
      })
    })
    commitSheetUpdate({ ...s, cells: nextCells })
    const r1 = dest.row + grid.length - 1
    const c1 = dest.col + (grid[0]?.length ?? 1) - 1
    onSelChange({ r0: dest.row, c0: dest.col, r1, c1 }, dest)
  }

  function copyViaMenu(cut: boolean) {
    const s = contentRef.current.sheets[contentRef.current.active]
    const payload = buildClipboardPayload(s, selRef.current, cut ? 'cut' : 'copy')
    clipboardRef.current = payload
    navigator.clipboard?.writeText(tsvFromSelection(s, selRef.current)).catch(() => {})
    if (cut) clearRect(selRef.current)
  }
  async function pasteViaMenu() {
    if (clipboardRef.current) {
      pasteInternalPayload(clipboardRef.current, activeRef.current)
      return
    }
    try {
      const text = await navigator.clipboard?.readText()
      if (text) pasteExternalText(text, activeRef.current)
    } catch {
      /* clipboard read unavailable — ignore */
    }
  }

  // ---------------- cell value editing ----------------

  function commitCellValue(row: number, col: number, raw: string) {
    const ref = refToString(col, row)
    const cur = contentRef.current
    const s = cur.sheets[cur.active]
    const existing = s.cells[ref]
    let val: Cell | null
    if (raw === '') {
      val = existing?.style ? { style: existing.style } : null
    } else {
      val = existing?.style ? { v: raw, style: existing.style } : { v: raw }
    }
    applyCellPatch({ [ref]: val })
  }

  function startEdit(row: number, col: number, initial?: string) {
    // Editing a covered cell (or an F2/typed-key start on a merge) always edits the top-left.
    const span = mergeSpanAt(sheet.merges, row, col)
    const r = span.r0
    const c = span.c0
    const ref = refToString(c, r)
    const raw = initial !== undefined ? initial : (sheet.cells[ref]?.v ?? '')
    setEditing({ row: r, col: c, value: raw })
    setActiveState({ row: r, col: c })
  }

  function commitEdit(moveDir: 'down' | 'up' | 'right' | 'left' | 'none') {
    const ed = editingRef.current
    if (!ed) return
    commitCellValue(ed.row, ed.col, ed.value)
    setEditing(null)
    let nr = ed.row
    let nc = ed.col
    if (moveDir !== 'none') {
      // Step past the FAR edge of the merge being edited, not just row/col ± 1 —
      // otherwise Enter/Tab on a multi-row/col merge would land back inside it.
      // Also keeps stepping past hidden/filtered-out rows & cols so the cursor
      // never parks on an invisible cell after committing an edit.
      const hiddenRowSet = new Set(sheet.hiddenRows ?? [])
      for (const r of computeFilterHiddenRows(sheet, computed)) hiddenRowSet.add(r)
      const hiddenColSet = new Set(sheet.hiddenCols ?? [])
      const stepped = stepPastSpanSkippingHidden(sheet.merges, hiddenRowSet, hiddenColSet, ed.row, ed.col, moveDir, rowCount, colCount)
      nr = Math.max(0, Math.min(rowCount - 1, stepped.row))
      nc = Math.max(0, Math.min(colCount - 1, stepped.col))
    }
    onSelChange({ r0: nr, c0: nc, r1: nr, c1: nc }, { row: nr, col: nc })
  }

  function cancelEdit() {
    setEditing(null)
  }

  function clearRect(rect: SelRect) {
    const cur = contentRef.current
    const s = cur.sheets[cur.active]
    const patch: Record<string, Cell | null> = {}
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        const ref = refToString(c, r)
        const existing = s.cells[ref]
        patch[ref] = existing?.style ? { style: existing.style } : null
      }
    }
    applyCellPatch(patch)
  }

  // ---------------- style mutations ----------------

  function applyStyleMutation(mutate: (s: CellStyle, ref: string, r: number, c: number) => void, rect: SelRect = sel) {
    const cur = contentRef.current
    const s = cur.sheets[cur.active]
    const patch: Record<string, Cell | null> = {}
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        const ref = refToString(c, r)
        patch[ref] = mergeStyle(s.cells[ref], (st) => mutate(st, ref, r, c))
      }
    }
    applyCellPatch(patch)
  }

  const activeRef1 = refToString(active.col, active.row)
  const activeStyle = sheet.cells[activeRef1]?.style

  function toggleStyle(key: 'bold' | 'italic' | 'underline' | 'strike') {
    const turnOn = !activeStyle?.[key]
    applyStyleMutation((s) => {
      s[key] = turnOn
    })
  }
  function setFontSize(size: number) {
    applyStyleMutation((s) => {
      s.fontSize = size
    })
  }
  function setColor(color: string) {
    applyStyleMutation((s) => {
      if (color) s.color = color
      else delete s.color
    })
  }
  function setFill(color: string) {
    applyStyleMutation((s) => {
      if (color) s.fill = color
      else delete s.fill
    })
  }
  function setAlign(align: 'left' | 'center' | 'right') {
    applyStyleMutation((s) => {
      s.align = align
    })
  }
  function setValign(valign: 'top' | 'middle' | 'bottom') {
    applyStyleMutation((s) => {
      s.valign = valign
    })
  }
  function setFontFamily(family: string) {
    applyStyleMutation((s) => {
      s.fontFamily = family
    })
  }
  function toggleWrap() {
    const turnOn = !activeStyle?.wrap
    applyStyleMutation((s) => {
      s.wrap = turnOn
    })
  }
  function setFormat(format: NonNullable<CellStyle['format']>) {
    applyStyleMutation((s) => {
      if (format === 'auto') delete s.format
      else s.format = format
    })
  }
  function setDecimals(delta: 1 | -1) {
    applyStyleMutation((s) => {
      const cur = s.decimals ?? 2
      s.decimals = Math.max(0, Math.min(10, cur + delta))
    })
  }
  function setQuickFormat(kind: 'currency' | 'percent' | 'comma') {
    applyStyleMutation((s) => {
      if (kind === 'currency') {
        s.format = 'currency'
      } else if (kind === 'percent') {
        s.format = 'percent'
      } else {
        s.format = 'number'
        s.decimals = 2
      }
    })
  }
  function setBorders(kind: BorderKind) {
    applyStyleMutation((s, _ref, r, c) => {
      if (kind === 'clear') {
        delete s.borders
        return
      }
      const b = { ...s.borders }
      if (kind === 'all') {
        b.top = b.right = b.bottom = b.left = true
      } else if (kind === 'outer') {
        if (r === sel.r0) b.top = true
        if (r === sel.r1) b.bottom = true
        if (c === sel.c0) b.left = true
        if (c === sel.c1) b.right = true
      } else if (kind === 'top' && r === sel.r0) b.top = true
      else if (kind === 'bottom' && r === sel.r1) b.bottom = true
      else if (kind === 'left' && c === sel.c0) b.left = true
      else if (kind === 'right' && c === sel.c1) b.right = true
      s.borders = b
    })
  }
  function clearFormatting() {
    applyStyleMutation((s) => {
      ;(Object.keys(s) as (keyof CellStyle)[]).forEach((k) => delete s[k])
    })
  }

  /** "Clear all" — wipes both value and style, i.e. deletes the cell entirely. */
  function clearAllCells(rect: SelRect) {
    const patch: Record<string, Cell | null> = {}
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) patch[refToString(c, r)] = null
    }
    applyCellPatch(patch)
  }

  // ---------------- format as table ----------------

  function formatAsTable(presetId: string) {
    applyCellPatch(tablePatchFor(sheet, sel, presetId))
  }
  function removeTableStyle() {
    applyCellPatch(removeTableStylePatch(sheet, sel))
  }

  // ---------------- autosum ----------------

  function writeFormulaAt(row: number, col: number, op: AutosumOp, rangeStr: string) {
    const ref = refToString(col, row)
    const cur = contentRef.current
    const s = cur.sheets[cur.active]
    const existing = s.cells[ref]
    const val: Cell = existing?.style ? { v: `=${op}(${rangeStr})`, style: existing.style } : { v: `=${op}(${rangeStr})` }
    applyCellPatch({ [ref]: val })
    onSelChange({ r0: row, c0: col, r1: row, c1: col }, { row, col })
  }

  /** Excel-style AutoSum: on a range, totals the range into the adjacent cell
   *  (below for a tall/vertical range, right for a wide/horizontal one). On a
   *  single cell, sums the contiguous numeric run directly above it, falling
   *  back to the run directly to its left, or no-ops with a toast. */
  function applyAutosum(op: AutosumOp) {
    const isSingle = sel.r0 === sel.r1 && sel.c0 === sel.c1
    if (isSingle) {
      const { row, col } = active
      let r = row - 1
      while (r >= 0 && typeof computed.get(refToString(col, r))?.value === 'number') r--
      const aboveStart = r + 1
      if (aboveStart <= row - 1) {
        writeFormulaAt(row, col, op, `${refToString(col, aboveStart)}:${refToString(col, row - 1)}`)
        return
      }
      let c = col - 1
      while (c >= 0 && typeof computed.get(refToString(c, row))?.value === 'number') c--
      const leftStart = c + 1
      if (leftStart <= col - 1) {
        writeFormulaAt(row, col, op, `${refToString(leftStart, row)}:${refToString(col - 1, row)}`)
        return
      }
      showToast('No numbers found to sum')
      return
    }
    const rangeStr = mergeRangeStr(sel)
    const vertical = sel.c0 === sel.c1 ? true : sel.r0 === sel.r1 ? false : sel.r1 - sel.r0 >= sel.c1 - sel.c0
    // The cell just past the selected range is the natural target, but never
    // clobber existing content there — walk forward (down for a vertical sum,
    // right for a horizontal one) to the next empty cell and let the user know
    // the formula landed somewhere other than immediately adjacent.
    const s = contentRef.current.sheets[contentRef.current.active]
    const isOccupied = (row: number, col: number) => {
      const v = s.cells[refToString(col, row)]?.v
      return v !== undefined && v !== ''
    }
    if (vertical) {
      let row = sel.r1 + 1
      let shifted = false
      while (isOccupied(row, sel.c0)) {
        row++
        shifted = true
      }
      if (shifted) showToast('Adjacent cell had data — sum placed below it')
      writeFormulaAt(row, sel.c0, op, rangeStr)
    } else {
      let col = sel.c1 + 1
      let shifted = false
      while (isOccupied(sel.r0, col)) {
        col++
        shifted = true
      }
      if (shifted) showToast('Adjacent cell had data — sum placed next to it')
      writeFormulaAt(sel.r0, col, op, rangeStr)
    }
  }

  // ---------------- row / col ops ----------------

  // Re-maps condFormats/validations/filter ranges the same way merges already
  // are, so a row/col insert or delete never leaves a rule pointing at stale cells.
  function shiftCondFormats(rules: CondRule[] | undefined, fn: (range: string) => string | null): CondRule[] | undefined {
    if (!rules || !rules.length) return rules
    const out: CondRule[] = []
    for (const r of rules) {
      const range = fn(r.range)
      if (range) out.push({ ...r, range })
    }
    return out
  }
  function shiftValidations(vals: Validation[] | undefined, fn: (range: string) => string | null): Validation[] | undefined {
    if (!vals || !vals.length) return vals
    const out: Validation[] = []
    for (const v of vals) {
      const range = fn(v.range)
      if (range) out.push({ ...v, range })
    }
    return out
  }
  function shiftFilter(filter: SheetFilter | undefined, fn: (range: string) => string | null): SheetFilter | undefined {
    if (!filter) return filter
    const range = fn(filter.range)
    return range ? { ...filter, range } : undefined
  }

  function colResize(col: number, width: number) {
    commitSheetUpdate({ ...sheet, colWidths: { ...sheet.colWidths, [col]: Math.round(width) } })
  }
  function rowResize(row: number, height: number) {
    commitSheetUpdate({ ...sheet, rowHeights: { ...sheet.rowHeights, [row]: Math.round(height) } })
  }

  function insertRowAt(pivot: number) {
    const nextCells: Record<string, Cell> = {}
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      const p = parseCellRef(ref)
      if (!p) continue
      const newRow = p.row >= pivot ? p.row + 1 : p.row
      nextCells[refToString(p.col, newRow)] = cell
    }
    const nextRowHeights: Record<number, number> = {}
    for (const [k, v] of Object.entries(sheet.rowHeights)) {
      const idx = Number(k)
      nextRowHeights[idx >= pivot ? idx + 1 : idx] = v
    }
    const nextFreeze = sheet.freeze && pivot <= sheet.freeze.rows ? { ...sheet.freeze, rows: sheet.freeze.rows + 1 } : sheet.freeze
    commitSheetUpdate({
      ...sheet,
      cells: nextCells,
      rowHeights: nextRowHeights,
      merges: shiftMergesForRowInsert(sheet.merges, pivot),
      hiddenRows: shiftHiddenForInsert(sheet.hiddenRows, pivot),
      freeze: nextFreeze,
      condFormats: shiftCondFormats(sheet.condFormats, (r) => shiftRangeForRowInsert(r, pivot)),
      validations: shiftValidations(sheet.validations, (r) => shiftRangeForRowInsert(r, pivot)),
      filter: shiftFilter(sheet.filter, (r) => shiftRangeForRowInsert(r, pivot)),
    })
  }
  function insertColAt(pivot: number) {
    const nextCells: Record<string, Cell> = {}
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      const p = parseCellRef(ref)
      if (!p) continue
      const newCol = p.col >= pivot ? p.col + 1 : p.col
      nextCells[refToString(newCol, p.row)] = cell
    }
    const nextColWidths: Record<number, number> = {}
    for (const [k, v] of Object.entries(sheet.colWidths)) {
      const idx = Number(k)
      nextColWidths[idx >= pivot ? idx + 1 : idx] = v
    }
    const nextFreeze = sheet.freeze && pivot <= sheet.freeze.cols ? { ...sheet.freeze, cols: sheet.freeze.cols + 1 } : sheet.freeze
    commitSheetUpdate({
      ...sheet,
      cells: nextCells,
      colWidths: nextColWidths,
      merges: shiftMergesForColInsert(sheet.merges, pivot),
      hiddenCols: shiftHiddenForInsert(sheet.hiddenCols, pivot),
      freeze: nextFreeze,
      condFormats: shiftCondFormats(sheet.condFormats, (r) => shiftRangeForColInsert(r, pivot)),
      validations: shiftValidations(sheet.validations, (r) => shiftRangeForColInsert(r, pivot)),
      filter: sheet.filter ? shiftFilterForColInsert(sheet.filter, pivot) : undefined,
    })
  }
  function deleteRowsAt(rows: number[]) {
    const set = new Set(rows)
    const sorted = rows.slice().sort((a, b) => a - b)
    const shift = (row: number) => row - sorted.filter((d) => d < row).length
    const nextCells: Record<string, Cell> = {}
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      const p = parseCellRef(ref)
      if (!p || set.has(p.row)) continue
      nextCells[refToString(p.col, shift(p.row))] = cell
    }
    const nextRowHeights: Record<number, number> = {}
    for (const [k, v] of Object.entries(sheet.rowHeights)) {
      const idx = Number(k)
      if (set.has(idx)) continue
      nextRowHeights[shift(idx)] = v
    }
    const nextFreeze = sheet.freeze ? { ...sheet.freeze, rows: Math.max(0, shift(sheet.freeze.rows)) } : sheet.freeze
    commitSheetUpdate({
      ...sheet,
      cells: nextCells,
      rowHeights: nextRowHeights,
      merges: shiftMergesForRowDelete(sheet.merges, rows),
      hiddenRows: shiftHiddenForDelete(sheet.hiddenRows, rows),
      freeze: nextFreeze,
      condFormats: shiftCondFormats(sheet.condFormats, (r) => shiftRangeForRowDelete(r, rows)),
      validations: shiftValidations(sheet.validations, (r) => shiftRangeForRowDelete(r, rows)),
      filter: shiftFilter(sheet.filter, (r) => shiftRangeForRowDelete(r, rows)),
    })
  }
  function deleteColsAt(cols: number[]) {
    const set = new Set(cols)
    const sorted = cols.slice().sort((a, b) => a - b)
    const shift = (col: number) => col - sorted.filter((d) => d < col).length
    const nextCells: Record<string, Cell> = {}
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      const p = parseCellRef(ref)
      if (!p || set.has(p.col)) continue
      nextCells[refToString(shift(p.col), p.row)] = cell
    }
    const nextColWidths: Record<number, number> = {}
    for (const [k, v] of Object.entries(sheet.colWidths)) {
      const idx = Number(k)
      if (set.has(idx)) continue
      nextColWidths[shift(idx)] = v
    }
    const nextFreeze = sheet.freeze ? { ...sheet.freeze, cols: Math.max(0, shift(sheet.freeze.cols)) } : sheet.freeze
    commitSheetUpdate({
      ...sheet,
      cells: nextCells,
      colWidths: nextColWidths,
      merges: shiftMergesForColDelete(sheet.merges, cols),
      hiddenCols: shiftHiddenForDelete(sheet.hiddenCols, cols),
      freeze: nextFreeze,
      condFormats: shiftCondFormats(sheet.condFormats, (r) => shiftRangeForColDelete(r, cols)),
      validations: shiftValidations(sheet.validations, (r) => shiftRangeForColDelete(r, cols)),
      filter: sheet.filter ? (shiftFilterForColDelete(sheet.filter, cols) ?? undefined) : undefined,
    })
  }

  // ---------------- merge / freeze / hide ----------------

  function toggleMerge() {
    const isSingleCell = sel.r0 === sel.r1 && sel.c0 === sel.c1
    if (isSingleCell) return
    const isExactMerge = (sheet.merges ?? []).includes(mergeRangeStr(sel))
    if (isExactMerge) {
      commitSheetUpdate(applyUnmerge(sheet, sel))
      return
    }
    const nextSheet = applyMerge(sheet, sel)
    commitSheetUpdate(nextSheet)
    const span = mergeSpanAt(nextSheet.merges, sel.r0, sel.c0)
    setSel(span)
    setActive({ row: span.r0, col: span.c0 })
  }

  /** Toolbar "Merge cells" menu: absorbs overlaps like toggleMerge's merge
   *  branch, optionally re-styling the resulting top-left cell to center/middle
   *  ("Merge & center"). Unlike toggleMerge, this never unmerges. */
  function mergeSelection(center: boolean) {
    if (sel.r0 === sel.r1 && sel.c0 === sel.c1) return
    const merged = applyMerge(sheet, sel)
    const span = mergeSpanAt(merged.merges, sel.r0, sel.c0)
    let nextSheet = merged
    if (center) {
      const ref = refToString(span.c0, span.r0)
      const existing = merged.cells[ref]
      const style: CellStyle = { ...existing?.style, align: 'center', valign: 'middle' }
      nextSheet = { ...merged, cells: { ...merged.cells, [ref]: existing?.v !== undefined ? { v: existing.v, style } : { style } } }
    }
    commitSheetUpdate(nextSheet)
    setSel(span)
    setActive({ row: span.r0, col: span.c0 })
  }

  /** Toolbar "Unmerge" menu item — removes every merge the selection touches,
   *  regardless of whether the selection is an exact match for one. */
  function unmergeSelection() {
    commitSheetUpdate(applyUnmerge(sheet, sel))
  }

  function setFreeze(freeze: { rows: number; cols: number } | undefined) {
    commitSheetUpdate({ ...sheet, freeze })
  }

  function hideRowsAction(rows: number[]) {
    if (mergesIntersectRows(sheet.merges, rows)) {
      showToast('Unmerge cells before hiding')
      return
    }
    commitSheetUpdate(hideRows(sheet, rows))
  }
  function hideColsAction(cols: number[]) {
    if (mergesIntersectCols(sheet.merges, cols)) {
      showToast('Unmerge cells before hiding')
      return
    }
    commitSheetUpdate(hideCols(sheet, cols))
  }
  function unhideRowsAction(rows: number[]) {
    commitSheetUpdate(unhideRows(sheet, rows))
  }
  function unhideColsAction(cols: number[]) {
    commitSheetUpdate(unhideCols(sheet, cols))
  }

  // ---------------- conditional formatting / filter / validation ----------------

  function addCondRule(rule: CondRule) {
    commitSheetUpdate({ ...sheet, condFormats: [...(sheet.condFormats ?? []), rule] })
  }
  function deleteCondRule(id: string) {
    commitSheetUpdate({ ...sheet, condFormats: (sheet.condFormats ?? []).filter((r) => r.id !== id) })
  }

  function toggleFilter() {
    if (sheet.filter) {
      commitSheetUpdate({ ...sheet, filter: undefined })
      return
    }
    const isSingleCell = sel.r0 === sel.r1 && sel.c0 === sel.c1
    const range = isSingleCell
      ? (() => {
          const { maxRow, maxCol } = usedRange(sheet)
          return { r0: 0, c0: 0, r1: Math.max(0, maxRow), c1: Math.max(0, maxCol) }
        })()
      : sel
    commitSheetUpdate({ ...sheet, filter: { range: mergeRangeStr(range), excluded: {} } })
  }
  function setFilterFromGrid(next: SheetFilter) {
    commitSheetUpdate({ ...sheet, filter: next })
  }

  function saveValidation(range: string, options: string[]) {
    const existingIdx = (sheet.validations ?? []).findIndex((v) => v.range === range)
    let next: Validation[]
    if (existingIdx >= 0) {
      next = sheet.validations!.slice()
      next[existingIdx] = { ...next[existingIdx], options }
    } else {
      next = [...(sheet.validations ?? []), { id: uid(), range, options }]
    }
    commitSheetUpdate({ ...sheet, validations: next })
  }
  function pickDropdownOption(row: number, col: number, value: string) {
    commitCellValue(row, col, value)
    setEditing(null)
  }

  function sortByColumn(col: number, asc: boolean) {
    const { maxRow: mr, maxCol: mc } = usedRange(sheet)
    if (mr < 0) return
    if (mergesIntersectRect(sheet.merges, { r0: 0, c0: 0, r1: mr, c1: mc })) {
      showToast('Unmerge cells before sorting')
      return
    }
    const map = computeSheet(sheet)
    const rows: (Cell | undefined)[][] = []
    for (let r = 0; r <= mr; r++) {
      const row: (Cell | undefined)[] = []
      for (let c = 0; c <= mc; c++) {
        const ref = refToString(c, r)
        const cell = sheet.cells[ref]
        if (cell?.v !== undefined && isFormula(cell.v)) {
          const val = map.get(ref)?.value
          const flat = val === undefined ? '' : typeof val === 'string' ? val : typeof val === 'boolean' ? (val ? 'TRUE' : 'FALSE') : String(val)
          row.push(cell.style ? { v: flat, style: cell.style } : { v: flat })
        } else {
          row.push(cell)
        }
      }
      rows.push(row)
    }
    const order = rows.map((_, i) => i)
    order.sort((ia, ib) => {
      const av = rows[ia][col]?.v
      const bv = rows[ib][col]?.v
      const aBlank = av === undefined || av === ''
      const bBlank = bv === undefined || bv === ''
      if (aBlank && bBlank) return 0
      if (aBlank) return 1
      if (bBlank) return -1
      const an = Number(av)
      const bn = Number(bv)
      const cmp = !Number.isNaN(an) && !Number.isNaN(bn) ? an - bn : String(av).toLowerCase().localeCompare(String(bv).toLowerCase())
      return asc ? cmp : -cmp
    })
    const nextCells: Record<string, Cell> = {}
    order.forEach((orig, newIdx) => {
      rows[orig].forEach((cell, c) => {
        if (cell) nextCells[refToString(c, newIdx)] = cell
      })
    })
    commitSheetUpdate({ ...sheet, cells: nextCells })
  }

  function fillApply(src: SelRect, dest: SelRect) {
    const patch = computeFillPatch(sheet, src, dest)
    applyCellPatch(patch)
    onSelChange(normalizeSel({ row: dest.r0, col: dest.c0 }, { row: dest.r1, col: dest.c1 }), active)
  }

  // ---------------- sheet tabs ----------------

  function switchSheet(i: number) {
    commitContent({ ...content, active: i }, { snapshot: false })
    setSel({ r0: 0, c0: 0, r1: 0, c1: 0 })
    setActiveState({ row: 0, col: 0 })
  }
  function addSheet() {
    const name = newSheetName(content.sheets.map((s) => s.name))
    const next = { sheets: [...content.sheets, blankSheet(name)], active: content.sheets.length }
    commitContent(next)
    setSel({ r0: 0, c0: 0, r1: 0, c1: 0 })
    setActiveState({ row: 0, col: 0 })
  }
  function renameSheet(i: number, name: string) {
    const sheets = content.sheets.slice()
    sheets[i] = { ...sheets[i], name }
    commitContent({ ...content, sheets })
  }
  function deleteSheet(i: number) {
    if (content.sheets.length <= 1) return
    if (!window.confirm(`Delete "${content.sheets[i].name}"? This can't be undone via redo once saved.`)) return
    const sheets = content.sheets.filter((_, idx) => idx !== i)
    const active = Math.max(0, Math.min(content.active - (i < content.active ? 1 : 0), sheets.length - 1))
    commitContent({ sheets, active })
    setSel({ r0: 0, c0: 0, r1: 0, c1: 0 })
    setActiveState({ row: 0, col: 0 })
  }

  // ---------------- charts ----------------

  function chartFormInitial(mode: 'new' | 'edit', chart?: ChartSpec): ChartFormValue {
    if (mode === 'edit' && chart) {
      return {
        type: chart.type,
        title: chart.title,
        labelRange: chart.labelRange ?? '',
        dataRanges: chart.dataRanges.join(', '),
        seriesNames: (chart.seriesNames ?? []).join(', '),
      }
    }
    const guess = guessChartSpecFromSelection(sheet, computed, sel)
    return {
      type: 'bar',
      title: '',
      labelRange: guess.labelRange ?? '',
      dataRanges: guess.dataRanges.join(', '),
      seriesNames: (guess.seriesNames ?? []).join(', '),
    }
  }

  function submitChartModal(v: ChartFormValue) {
    const dataRanges = v.dataRanges
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const seriesNames = v.seriesNames
      .split(',')
      .map((s) => s.trim())
    if (chartModal?.mode === 'edit' && chartModal.chart) {
      const charts = (sheet.charts ?? []).map((c) =>
        c.id === chartModal.chart!.id
          ? { ...c, type: v.type, title: v.title, labelRange: v.labelRange || undefined, dataRanges, seriesNames }
          : c,
      )
      commitSheetUpdate({ ...sheet, charts })
    } else {
      const newChart: ChartSpec = {
        id: uid(),
        type: v.type,
        title: v.title,
        labelRange: v.labelRange || undefined,
        dataRanges,
        seriesNames,
        x: 60,
        y: 60,
        w: 380,
        h: 260,
      }
      commitSheetUpdate({ ...sheet, charts: [...(sheet.charts ?? []), newChart] })
    }
    setChartModal(null)
  }

  function updateChartRect(id: string, patch: Partial<Pick<ChartSpec, 'x' | 'y' | 'w' | 'h'>>) {
    const charts = (sheet.charts ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c))
    commitSheetUpdate({ ...sheet, charts }, { snapshot: false })
  }
  function deleteChart(id: string) {
    commitSheetUpdate({ ...sheet, charts: (sheet.charts ?? []).filter((c) => c.id !== id) })
  }

  // ---------------- pivot tables ----------------

  /** Resolves a (possibly sheet-qualified) source range against the workbook. */
  function readPivotTable(source: string): SourceTable | null {
    const ref = parseSourceRef(source)
    if (!ref) return null
    const cur = contentRef.current
    const src = ref.sheetName ? cur.sheets.find((s) => s.name === ref.sheetName) : sheet
    if (!src) return null
    return readSource(src, src === sheet ? computed : computeSheet(src), ref)
  }

  function specFromForm(v: PivotFormValue, id: string): PivotSpec {
    // A pivot on its own sheet has to record which sheet the data is on — but
    // only if the user hasn't already said, or qualifying it twice names a
    // sheet ("Data!Q1!A1:C9") that does not exist.
    const source = v.source.trim()
    const qualify = v.newSheet && !parseSourceRef(source)?.sheetName
    return {
      id,
      source: qualify ? qualifySource(sheet.name, source) : source,
      rows: v.rows,
      cols: v.cols,
      values: v.values,
      anchor: v.newSheet ? 'A1' : v.anchor.trim(),
      showTotals: v.showTotals,
    }
  }

  function pivotFormInitial(): PivotFormValue {
    // A single cell says nothing about what to summarise, so fall back to
    // everything the sheet has in it.
    const { maxRow: mr, maxCol: mc } = usedRange(sheet)
    const source =
      sel.r0 === sel.r1 && sel.c0 === sel.c1 && mr >= 0
        ? `A1:${refToString(mc, mr)}`
        : mergeRangeStr(sel)
    const ref = parseSourceRef(source)
    const table = ref ? readPivotTable(source) : null
    const guess = table ? suggestFields(table) : { rows: [], values: [] }
    return {
      source,
      rows: guess.rows,
      cols: [],
      values: guess.values,
      anchor: ref ? suggestAnchor(ref) : 'A1',
      showTotals: true,
      newSheet: false,
    }
  }

  function pivotConflictsFor(v: PivotFormValue): string[] {
    const table = readPivotTable(v.source)
    if (!table) return []
    const spec = specFromForm({ ...v, newSheet: false }, 'preview')
    return pivotConflicts(sheet, spec, buildPivot(table, spec))
  }

  function applyPatchTo(cells: Record<string, Cell>, patch: Record<string, Cell | null>): Record<string, Cell> {
    const next = { ...cells }
    for (const [ref, cell] of Object.entries(patch)) {
      if (cell === null) delete next[ref]
      else next[ref] = cell
    }
    return next
  }

  function pivotSheetName(existing: string[]): string {
    let n = 1
    while (existing.includes(`Pivot ${n}`)) n++
    return `Pivot ${n}`
  }

  function submitPivot(v: PivotFormValue) {
    const spec = specFromForm(v, uid())
    const table = readPivotTable(spec.source)
    if (!table) {
      showToast('That source range is not valid.')
      return
    }
    // Without a real anchor every write lands nowhere, and the pivot would
    // report success having put nothing in the sheet.
    if (!anchorValid(spec.anchor)) {
      showToast('That is not a cell to start the pivot at — try something like H1.')
      return
    }
    const build = buildPivot(table, spec)
    if (build.error) {
      showToast(build.error)
      return
    }
    if (v.newSheet) {
      const cur = contentRef.current
      const target = blankSheet(pivotSheetName(cur.sheets.map((s) => s.name)))
      const placed: Sheet = {
        ...target,
        cells: applyPatchTo(target.cells, pivotPatch(target, spec, build)),
        colWidths: pivotColWidths(target, spec, build),
        pivots: [spec],
      }
      commitContent({ sheets: [...cur.sheets, placed], active: cur.sheets.length })
      setSel({ r0: 0, c0: 0, r1: 0, c1: 0 })
      setActiveState({ row: 0, col: 0 })
    } else {
      const conflicts = pivotConflicts(sheet, spec, build)
      if (conflicts.length > 0) {
        showToast(`A pivot there would write over ${conflicts[0]} — pick another spot or a new sheet.`)
        return
      }
      commitSheetUpdate({
        ...sheet,
        cells: applyPatchTo(sheet.cells, pivotPatch(sheet, spec, build)),
        colWidths: pivotColWidths(sheet, spec, build),
        pivots: [...(sheet.pivots ?? []), spec],
      })
    }
    setPivotOpen(false)
    showToast('Pivot table created. Use Data → Refresh when the source data changes.')
  }

  /** Rebuilds every pivot in the workbook in place — the source data has moved
   *  on, but the block is ordinary cells and cannot notice on its own. */
  function refreshPivots() {
    const cur = contentRef.current
    let done = 0
    let blockedBy: string | null = null
    const sheets = cur.sheets.map((s) => {
      if (!s.pivots?.length) return s
      let cells = s.cells
      let colWidths = s.colWidths
      for (const spec of s.pivots) {
        const ref = parseSourceRef(spec.source)
        if (!ref) continue
        const src = ref.sheetName ? cur.sheets.find((x) => x.name === ref.sheetName) : s
        if (!src) continue
        const build = buildPivot(readSource(src, computeSheet(src), ref), spec)
        if (build.error) continue
        // The pivot has grown into cells that were never its own — better to
        // leave it stale than to eat whatever the user put beside it.
        const inTheWay = refreshConflicts({ ...s, cells }, spec, build)
        if (inTheWay.length > 0) {
          blockedBy = inTheWay[0]
          continue
        }
        cells = applyPatchTo(cells, pivotPatch({ ...s, cells }, spec, build))
        colWidths = pivotColWidths({ ...s, colWidths }, spec, build)
        done++
      }
      return cells === s.cells ? s : { ...s, cells, colWidths }
    })
    if (done === 0) {
      showToast(
        blockedBy
          ? `That pivot has more rows now and ${blockedBy} is in the way. Clear it, or rebuild the pivot somewhere roomier.`
          : 'No pivot tables to refresh yet.',
      )
      return
    }
    commitContent({ ...cur, sheets })
    showToast(done === 1 ? 'Pivot table refreshed.' : `${done} pivot tables refreshed.`)
  }

  // ---------------- export / import ----------------

  async function handleExport(kind: 'asheet' | 'xlsx' | 'csv' | 'living') {
    if (kind === 'asheet') {
      await requestSave()
      return
    }
    if (kind === 'living') {
      setShareOpen(true)
      return
    }
    const title = doc.meta.title || 'Untitled'
    if (kind === 'xlsx') {
      const b64 = exportXlsxBase64(content)
      await platform.saveFile(`${title}.xlsx`, b64, [{ name: 'Excel Workbook', extensions: ['xlsx'] }], true)
    } else {
      const csv = exportCsv(sheet)
      await platform.saveFile(`${title}.csv`, csv, [{ name: 'CSV', extensions: ['csv'] }], false)
    }
  }

  async function runShareExport() {
    const title = doc.meta.title || 'Untitled'
    const html = buildLivingSpreadsheetHtml(content, title)
    await platform.saveFile(`${title}.html`, html, [{ name: 'Web Page', extensions: ['html'] }], false)
    setShareOpen(false)
    showToast('Web page saved — open it in any browser, or send it to anyone.')
  }

  // ---------------- copy as live link ----------------

  async function copyAsLiveLink() {
    const range = rangeToA1(sel.r0, sel.c0, sel.r1, sel.c1)
    const rows = readRange(sheet, range)
    if (!rows) return
    await putLinkClipboard({
      sourceId: doc.meta.id,
      sourceTitle: doc.meta.title || 'Untitled',
      sheetName: sheet.name,
      range,
      rows,
    })
    showToast('Live link copied — paste it in Docs or Slides')
  }

  // ---------------- AI formula assistant ----------------

  function insertAiFormula(formula: string) {
    const text = formula.trim()
    if (!text) return
    const raw = text.startsWith('=') ? text : `=${text}`
    const { row, col } = active
    const ref = refToString(col, row)
    const cur = contentRef.current
    const s = cur.sheets[cur.active]
    const existing = s.cells[ref]
    const val: Cell = existing?.style ? { v: raw, style: existing.style } : { v: raw }
    applyCellPatch({ [ref]: val })
  }

  const activeCellRaw = sheet.cells[refToString(active.col, active.row)]?.v
  const activeFormulaForAi = isFormula(activeCellRaw) ? activeCellRaw : undefined

  const aiHeaderRow = useMemo(() => {
    const { maxCol } = usedRange(sheet)
    const out: string[] = []
    for (let c = 0; c <= Math.max(0, maxCol); c++) {
      const d = computed.get(refToString(c, 0))?.display
      if (d) out.push(d)
    }
    return out
  }, [sheet, computed])

  async function handleImport(kind: 'xlsx' | 'csv') {
    const filters = kind === 'xlsx' ? [{ name: 'Excel Workbook', extensions: ['xlsx'] }] : [{ name: 'CSV', extensions: ['csv'] }]
    const res = await platform.openFile(filters, kind === 'xlsx')
    if (res.canceled || !res.data) return
    const data = res.data
    const run = () => {
      const next = kind === 'xlsx' ? workbookToSheets(base64ToWorkbook(data)) : { sheets: [csvToSheet(data)], active: 0 }
      setSizeOverrides({})
      setSel({ r0: 0, c0: 0, r1: 0, c1: 0 })
      setActiveState({ row: 0, col: 0 })
      commitContent(next)
    }
    const nonEmpty = content.sheets.some((s) => Object.keys(s.cells).length > 0)
    if (nonEmpty) setImportPending({ kind, run })
    else run()
  }

  // ---------------- status bar stats ----------------

  const stats = useMemo(() => {
    let sum = 0
    let count = 0
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        const v = computed.get(refToString(c, r))?.value
        if (typeof v === 'number') {
          sum += v
          count++
        }
      }
    }
    return { sum, avg: count ? sum / count : 0, count }
  }, [sel, computed])

  const filterInfo = useMemo(() => {
    if (!sheet.filter) return null
    const bounds = filterBoundsOf(sheet)
    if (!bounds) return null
    const total = bounds.r1 - bounds.r0
    const hidden = computeFilterHiddenRows(sheet, computed).size
    return { shown: total - hidden, total }
  }, [sheet, computed])

  // ---------------- ref label for formula bar ----------------

  const refLabel = useMemo(() => {
    if (sel.r0 !== sel.r1 || sel.c0 !== sel.c1) {
      return `${sel.r1 - sel.r0 + 1}R x ${sel.c1 - sel.c0 + 1}C`
    }
    return refToString(active.col, active.row)
  }, [sel, active])

  const fxValue = editing ? editing.value : sheet.cells[refToString(active.col, active.row)]?.v ?? ''

  // ---------------- context menu ----------------

  function openContextMenu(target: ContextMenuTarget) {
    // Right-clicking outside the current selection re-targets it to that cell first.
    if (target.kind === 'cell') {
      // Grid always reports 'cell' kind for now with just x/y; selection stays as-is.
    }
    setCtxMenu({ x: target.x, y: target.y, target })
  }

  const mergeDisabled = sel.r0 === sel.r1 && sel.c0 === sel.c1
  const mergeActive = !mergeDisabled && (sheet.merges ?? []).includes(mergeRangeStr(sel))
  const unmergeDisabled = !mergesIntersectRect(sheet.merges, sel)

  function ctxItemsFor(target: ContextMenuTarget): (MenuItem | 'sep' | { header: string })[] {
    if (target.kind === 'row') {
      const rows = Array.from({ length: sel.r1 - sel.r0 + 1 }, (_, i) => sel.r0 + i)
      const anyHidden = rows.some((r) => isRowHidden(sheet, r))
      const items: (MenuItem | 'sep' | { header: string })[] = [
        { label: rows.length > 1 ? 'Hide rows' : 'Hide row', onClick: () => hideRowsAction(rows) },
      ]
      if (anyHidden) items.push({ label: 'Unhide rows', onClick: () => unhideRowsAction(rows) })
      items.push(
        'sep',
        { label: 'Insert row above', onClick: () => insertRowAt(sel.r0) },
        { label: 'Insert row below', onClick: () => insertRowAt(sel.r1 + 1) },
        'sep',
        { label: rows.length > 1 ? 'Delete rows' : 'Delete row', onClick: () => deleteRowsAt(rows) },
      )
      return items
    }
    if (target.kind === 'col') {
      const cols = Array.from({ length: sel.c1 - sel.c0 + 1 }, (_, i) => sel.c0 + i)
      const anyHidden = cols.some((c) => isColHidden(sheet, c))
      const items: (MenuItem | 'sep' | { header: string })[] = [
        { label: cols.length > 1 ? 'Hide columns' : 'Hide column', onClick: () => hideColsAction(cols) },
      ]
      if (anyHidden) items.push({ label: 'Unhide columns', onClick: () => unhideColsAction(cols) })
      items.push(
        'sep',
        { label: 'Insert column left', onClick: () => insertColAt(sel.c0) },
        { label: 'Insert column right', onClick: () => insertColAt(sel.c1 + 1) },
        'sep',
        { label: cols.length > 1 ? 'Delete columns' : 'Delete column', onClick: () => deleteColsAt(cols) },
      )
      return items
    }
    return [
      { label: 'Cut', onClick: () => copyViaMenu(true) },
      { label: 'Copy', onClick: () => copyViaMenu(false) },
      { label: 'Paste', onClick: () => void pasteViaMenu() },
      { label: 'Copy as live link', onClick: () => void copyAsLiveLink() },
      'sep',
      { label: 'Insert row above', onClick: () => insertRowAt(sel.r0) },
      { label: 'Insert row below', onClick: () => insertRowAt(sel.r1 + 1) },
      { label: 'Insert column left', onClick: () => insertColAt(sel.c0) },
      { label: 'Insert column right', onClick: () => insertColAt(sel.c1 + 1) },
      'sep',
      {
        label: sel.r1 > sel.r0 ? 'Delete rows' : 'Delete row',
        onClick: () => deleteRowsAt(Array.from({ length: sel.r1 - sel.r0 + 1 }, (_, i) => sel.r0 + i)),
      },
      {
        label: sel.c1 > sel.c0 ? 'Delete columns' : 'Delete column',
        onClick: () => deleteColsAt(Array.from({ length: sel.c1 - sel.c0 + 1 }, (_, i) => sel.c0 + i)),
      },
      'sep',
      { label: mergeActive ? 'Unmerge cells' : 'Merge cells', disabled: mergeDisabled, onClick: toggleMerge },
      'sep',
      { label: 'Clear formatting', onClick: clearFormatting },
      'sep',
      { label: 'Sort sheet A → Z by this column', onClick: () => sortByColumn(active.col, true) },
      { label: 'Sort sheet Z → A by this column', onClick: () => sortByColumn(active.col, false) },
    ]
  }

  const ctxItems = ctxMenu ? ctxItemsFor(ctxMenu.target) : []

  return (
    <div className="sx-root" data-sheets-zoom={zoom}>
      <Toolbar
        style={activeStyle}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onToggle={toggleStyle}
        onFontSize={setFontSize}
        onFontFamily={setFontFamily}
        onColor={setColor}
        onFill={setFill}
        onAlign={setAlign}
        onValign={setValign}
        onWrap={toggleWrap}
        onBorders={setBorders}
        onFormat={setFormat}
        onDecimals={setDecimals}
        onQuickFormat={setQuickFormat}
        onInsertRow={(before) => insertRowAt(before ? sel.r0 : sel.r1 + 1)}
        onInsertCol={(before) => insertColAt(before ? sel.c0 : sel.c1 + 1)}
        onSort={(asc) => sortByColumn(active.col, asc)}
        onInsertChart={() => setChartModal({ mode: 'new' })}
        onExport={handleExport}
        onImport={handleImport}
        mergeDisabled={mergeDisabled}
        unmergeDisabled={unmergeDisabled}
        onMergeCenter={() => mergeSelection(true)}
        onMergePlain={() => mergeSelection(false)}
        onUnmerge={unmergeSelection}
        freeze={sheet.freeze}
        onFreeze={setFreeze}
        onOpenCondFormat={() => setCondFormatOpen(true)}
        filterActive={!!sheet.filter}
        onToggleFilter={toggleFilter}
        onOpenValidation={() => setValidationOpen(true)}
        onOpenPivot={() => setPivotOpen(true)}
        onRefreshPivots={refreshPivots}
        paintMode={paintMode}
        onPaintOnce={armPaintOnce}
        onPaintSticky={armPaintSticky}
        onAutosum={applyAutosum}
        onClearContents={() => clearRect(sel)}
        onClearFormats={clearFormatting}
        onClearAll={() => clearAllCells(sel)}
        onFormatAsTable={formatAsTable}
        onRemoveTableStyle={removeTableStyle}
        aiOpen={aiModalOpen}
        onOpenAi={() => setAiModalOpen(true)}
        onCopyLiveLink={() => void copyAsLiveLink()}
      />
      <FormulaBar
        refLabel={refLabel}
        value={fxValue}
        inputRef={fxInputRef}
        onFocus={() => {
          if (!editing) startEdit(active.row, active.col)
        }}
        onChange={(v) => {
          if (editing) setEditing({ ...editing, value: v })
          else startEdit(active.row, active.col, v)
        }}
        onCommit={commitEdit}
        onCancel={cancelEdit}
      />

      <div className="sx-gridwrap">
        <Grid
          sheet={sheet}
          computed={computed}
          rowCount={rowCount}
          colCount={colCount}
          sel={sel}
          active={active}
          editing={editing}
          zoom={zoom}
          onSelChange={onSelChange}
          onStartEdit={startEdit}
          onEditValueChange={(v) => editing && setEditing({ ...editing, value: v })}
          onCommitEdit={commitEdit}
          onCancelEdit={cancelEdit}
          onClearSelection={() => clearRect(sel)}
          onColResize={colResize}
          onRowResize={rowResize}
          onFillApply={fillApply}
          onOpenContextMenu={openContextMenu}
          rootRef={gridRootRef}
          editInputRef={gridEditInputRef}
          charts={sheet.charts ?? []}
          onChartUpdate={updateChartRect}
          onChartEdit={(chart) => setChartModal({ mode: 'edit', chart })}
          onChartDelete={deleteChart}
          onFilterChange={setFilterFromGrid}
          paintArmed={paintMode !== 'off'}
          onPickOption={pickDropdownOption}
        />
        {findOpen && (
          <FindReplace
            sheet={sheet}
            computed={computed}
            initialQuery=""
            onJump={findJump}
            onReplaceCell={findReplaceCell}
            onReplaceAll={findReplaceAll}
            onClose={() => setFindOpen(false)}
          />
        )}
      </div>

      <div className="sx-bottombar">
        <SheetTabs
          sheets={content.sheets}
          active={content.active}
          onSwitch={switchSheet}
          onAdd={addSheet}
          onRename={renameSheet}
          onDelete={deleteSheet}
        />
        <button className="sx-grow-btn" onClick={() => setSizeOverrides((p) => ({ ...p, [sheetIndex]: { rows: (p[sheetIndex]?.rows ?? DEFAULT_ROWS) + GROW_ROWS, cols: p[sheetIndex]?.cols ?? DEFAULT_COLS } }))}>
          + Add 100 rows
        </button>
        <button className="sx-grow-btn" onClick={() => setSizeOverrides((p) => ({ ...p, [sheetIndex]: { rows: p[sheetIndex]?.rows ?? DEFAULT_ROWS, cols: (p[sheetIndex]?.cols ?? DEFAULT_COLS) + GROW_COLS } }))}>
          + Add 26 columns
        </button>
        <StatusBar sum={stats.sum} avg={stats.avg} count={stats.count} zoom={zoom} onZoomChange={setZoom} filterInfo={filterInfo} />
      </div>

      {toast && <div className="sx-toast">{toast}</div>}

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems} onClose={() => setCtxMenu(null)} />}

      {chartModal && (
        <ChartModal
          isEdit={chartModal.mode === 'edit'}
          initial={chartFormInitial(chartModal.mode, chartModal.chart)}
          onCancel={() => setChartModal(null)}
          onSubmit={submitChartModal}
          preview={(v) => {
            const dataRanges = v.dataRanges.split(',').map((s) => s.trim()).filter(Boolean)
            const seriesNames = v.seriesNames.split(',').map((s) => s.trim())
            return extractChartDataSafe(computed, { labelRange: v.labelRange || undefined, dataRanges, seriesNames })
          }}
        />
      )}

      {pivotOpen && (
        <PivotModal
          initial={pivotFormInitial()}
          readTable={(source) => readPivotTable(source)}
          conflictsFor={pivotConflictsFor}
          onCancel={() => setPivotOpen(false)}
          onSubmit={submitPivot}
        />
      )}

      {condFormatOpen && (
        <CondFormatModal
          rules={sheet.condFormats ?? []}
          initialRange={mergeRangeStr(sel)}
          onAdd={addCondRule}
          onDelete={deleteCondRule}
          onClose={() => setCondFormatOpen(false)}
        />
      )}

      {validationOpen &&
        (() => {
          const range = mergeRangeStr(sel)
          const existing = (sheet.validations ?? []).find((v) => v.range === range)
          return (
            <ValidationModal
              initialRange={range}
              initialOptions={existing ? existing.options.join('\n') : ''}
              onSave={saveValidation}
              onClose={() => setValidationOpen(false)}
            />
          )
        })()}

      {aiModalOpen && (
        <AiFormulaModal
          activeRef={refToString(active.col, active.row)}
          headerRow={aiHeaderRow}
          activeFormula={activeFormulaForAi}
          onInsert={insertAiFormula}
          onClose={() => setAiModalOpen(false)}
        />
      )}

      {shareOpen && (
        <ShareWebPageModal kind="sheets" onClose={() => setShareOpen(false)} onExport={() => void runShareExport()} />
      )}

      {importPending && (
        <Modal
          title={`Replace current spreadsheet?`}
          subtitle={`Importing this .${importPending.kind} file will replace everything in this document. This can be undone with Cmd+Z.`}
          onClose={() => setImportPending(null)}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button variant="outline" onClick={() => setImportPending(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                importPending.run()
                setImportPending(null)
              }}
            >
              Replace
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Re-imported lazily to avoid a top-level circular type reference with ChartModal's preview signature.
import { extractChartData as extractChartDataSafe } from './chartData'
