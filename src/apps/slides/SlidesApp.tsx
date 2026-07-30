import React, { useEffect, useRef, useState } from 'react'
import type { EditorAppProps, ShapeKind, Slide, SlideBackground, SlidesContent } from '../../shared/types'
import { SLIDE_H, SLIDE_W, uid } from '../../shared/types'
import { platform } from '../../shared/platform'
import { registerExporters } from '../../shared/exporters'
import { registerCommands, clearCommands } from '../../shared/commands'
import { getLinkClipboard, resolveLiveLink } from '../../shared/livelink'
import { IcTrash } from '../../shared/icons'
import { getTheme } from './themes'
import { getLayout } from './layouts'
import { exportPptx } from './pptx'
import { buildLivingPresentation } from './livingPresentation'
import { buildSlidesFromOutline, type AiOutlineSlide } from './aiDeck'
import { AiDeckModal } from './AiDeckModal'
import { ShareWebPageModal } from '../../shared/ShareWebPageModal'
import {
  alignElements,
  cloneWithNewId,
  defaultImageElement,
  defaultLinkedTableElement,
  defaultShapeElement,
  defaultTextElement,
  distributeElements,
  duplicateElements,
  patchElements,
  reorderZ,
  type AlignMode,
  type ElementPatch,
  type ZOrderAction,
} from './elementOps'
import { Toolbar } from './Toolbar'
import { Thumbnails } from './Thumbnails'
import { Canvas } from './Canvas'
import { Present } from './Present'
import { PrintView } from './PrintView'
import { ContextMenu } from './ContextMenu'
import { IcDuplicate } from './icons'
import './slides.css'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }
  return map[ext] || 'image/png'
}

function measureImage(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 })
    img.onerror = () => resolve({ w: 400, h: 300 })
    img.src = src
  })
}

function isTypingTarget(): boolean {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export default function SlidesApp({ doc, onDocChange, requestSave, isDark }: EditorAppProps<SlidesContent>) {
  const initial = doc.content as SlidesContent

  const [content, setContent] = useState<SlidesContent>(initial)
  const contentRef = useRef(content)
  const docIdRef = useRef(doc.meta.id)
  // Kept fresh every render (unlike the functions registered once in the command
  // palette below) so a stale mount-time title never leaks into an export
  // triggered after switching to a different slides document.
  const docTitleRef = useRef(doc.meta.title)
  docTitleRef.current = doc.meta.title

  const [activeSlideId, setActiveSlideId] = useState(initial.slides[0]?.id ?? '')
  const activeSlideIdRef = useRef(activeSlideId)
  activeSlideIdRef.current = activeSlideId

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedIdsRef = useRef<string[]>([])
  selectedIdsRef.current = selectedIds

  const [notesOpen, setNotesOpen] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const presentingRef = useRef(presenting)
  presentingRef.current = presenting

  const [canvasScale, setCanvasScale] = useState(0.5)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null)

  // Linked-table element id -> resolve error from the last refresh (editor-only chip).
  const [linkWarnings, setLinkWarnings] = useState<Record<string, string>>({})
  // Whether the cross-app live-range clipboard currently has a payload (drives the
  // toolbar's "Paste live range" enabled state).
  const [hasLinkClipboard, setHasLinkClipboard] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  const canvasAreaRef = useRef<HTMLDivElement | null>(null)
  const historyRef = useRef<{ past: SlidesContent[]; future: SlidesContent[] }>({ past: [], future: [] })
  const clipboardRef = useRef<import('../../shared/types').SlideElement[]>([])
  // Coalesces a continuous drag gesture (opacity/angle sliders, native color-picker
  // drags) into a single undo step: the first tick of a gesture pushes one history
  // snapshot, subsequent ticks just update state, and the next pointerup ends the
  // gesture so the following drag starts its own step.
  const dragGestureRef = useRef(false)

  // ---------- reset on document switch ----------
  useEffect(() => {
    if (doc.meta.id !== docIdRef.current) {
      docIdRef.current = doc.meta.id
      const c = doc.content as SlidesContent
      contentRef.current = c
      setContent(c)
      setActiveSlideId(c.slides[0]?.id ?? '')
      setSelectedIds([])
      setNotesOpen(false)
      setPresenting(false)
      setCtxMenu(null)
      setLinkWarnings({})
      setAiOpen(false)
      setShareOpen(false)
      historyRef.current = { past: [], future: [] }
      clipboardRef.current = []
      dragGestureRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.meta.id])

  // ---------- live-range links: refresh on open, and watch the paste clipboard ----------

  useEffect(() => {
    refreshLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.meta.id])

  useEffect(() => {
    let alive = true
    async function check() {
      const payload = await getLinkClipboard()
      if (alive) setHasLinkClipboard(!!payload)
    }
    check()
    window.addEventListener('focus', check)
    return () => {
      alive = false
      window.removeEventListener('focus', check)
    }
  }, [])

  // Save As format menu: PowerPoint alongside the native format.
  useEffect(() => {
    registerExporters('slides', [
      {
        ext: 'pptx',
        label: 'PowerPoint presentation',
        produce: async () => ({ data: await exportPptx(contentRef.current), binary: true }),
      },
    ])
  }, [])

  // ---------- canvas auto-fit scale ----------
  useEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    const compute = () => {
      const availW = el.clientWidth - 48
      const availH = el.clientHeight - 48
      const s = Math.max(0.15, Math.min(availW / SLIDE_W, availH / SLIDE_H))
      setCanvasScale(s)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---------- core commit / history ----------

  function commit(next: SlidesContent) {
    historyRef.current.past.push(structuredClone(contentRef.current))
    if (historyRef.current.past.length > 100) historyRef.current.past.shift()
    historyRef.current.future = []
    dragGestureRef.current = false
    contentRef.current = next
    setContent(next)
    onDocChange(next)
  }

  /** Like commit(), but repeated calls within the same drag gesture only push ONE history entry. */
  function commitLive(next: SlidesContent) {
    if (!dragGestureRef.current) {
      historyRef.current.past.push(structuredClone(contentRef.current))
      if (historyRef.current.past.length > 100) historyRef.current.past.shift()
      historyRef.current.future = []
      dragGestureRef.current = true
    }
    contentRef.current = next
    setContent(next)
    onDocChange(next)
  }

  function updateSlide(slideId: string, updater: (s: Slide) => Slide, live?: boolean) {
    const c = contentRef.current
    const next = { ...c, slides: c.slides.map((s) => (s.id === slideId ? updater(s) : s)) }
    if (live) commitLive(next)
    else commit(next)
  }

  function currentSlide(): Slide {
    const c = contentRef.current
    return c.slides.find((s) => s.id === activeSlideIdRef.current) ?? c.slides[0]
  }

  function pruneSelection(c: SlidesContent) {
    const slide = c.slides.find((s) => s.id === activeSlideIdRef.current)
    if (!slide) {
      setActiveSlideId(c.slides[0]?.id ?? '')
      setSelectedIds([])
      return
    }
    const validIds = new Set(slide.elements.map((el) => el.id))
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)))
  }

  function undo() {
    const h = historyRef.current
    if (!h.past.length) return
    const prevSnap = h.past.pop()!
    h.future.push(structuredClone(contentRef.current))
    dragGestureRef.current = false
    contentRef.current = prevSnap
    setContent(prevSnap)
    onDocChange(prevSnap)
    pruneSelection(prevSnap)
  }

  function redo() {
    const h = historyRef.current
    if (!h.future.length) return
    const nextSnap = h.future.pop()!
    h.past.push(structuredClone(contentRef.current))
    dragGestureRef.current = false
    contentRef.current = nextSnap
    setContent(nextSnap)
    onDocChange(nextSnap)
    pruneSelection(nextSnap)
  }

  // ---------- element actions (ref-based: usable from stable listeners) ----------

  function deleteSelected() {
    const ids = selectedIdsRef.current
    if (!ids.length) return
    updateSlide(currentSlide().id, (s) => ({ ...s, elements: s.elements.filter((el) => !ids.includes(el.id)) }))
    setSelectedIds([])
  }

  function nudgeSelected(dx: number, dy: number) {
    const ids = selectedIdsRef.current
    if (!ids.length) return
    updateSlide(currentSlide().id, (s) => ({
      ...s,
      elements: s.elements.map((el) => (ids.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)),
    }))
  }

  function duplicateSelected() {
    const ids = selectedIdsRef.current
    if (!ids.length) return
    const slide = currentSlide()
    const { elements, newIds } = duplicateElements(slide.elements, ids)
    updateSlide(slide.id, (s) => ({ ...s, elements }))
    setSelectedIds(newIds)
  }

  function copySelected() {
    const ids = selectedIdsRef.current
    if (!ids.length) return
    const slide = currentSlide()
    clipboardRef.current = slide.elements.filter((el) => ids.includes(el.id)).map((el) => structuredClone(el))
  }

  function pasteClipboard() {
    if (!clipboardRef.current.length) return
    const slide = currentSlide()
    const clones = clipboardRef.current.map((el) => cloneWithNewId(el, 16, 16))
    updateSlide(slide.id, (s) => ({ ...s, elements: [...s.elements, ...clones] }))
    setSelectedIds(clones.map((c) => c.id))
    clipboardRef.current = clones.map((el) => structuredClone(el))
  }

  function centerSelection() {
    const ids = selectedIdsRef.current
    if (!ids.length) return
    updateSlide(currentSlide().id, (s) => ({
      ...s,
      elements: alignElements(alignElements(s.elements, ids, 'center'), ids, 'middle'),
    }))
  }

  /** Ref-based "New slide" (Title + content layout) — safe to call from a stable listener. */
  function insertDefaultSlide() {
    const layout = getLayout('title-content')
    const built = layout.build(getTheme(contentRef.current.themeId))
    const newSlide: Slide = { id: uid(), elements: built.elements, background: built.background }
    const c = contentRef.current
    const idx = c.slides.findIndex((s) => s.id === activeSlideIdRef.current)
    const arr = [...c.slides]
    arr.splice(idx + 1, 0, newSlide)
    commit({ ...c, slides: arr })
    setActiveSlideId(newSlide.id)
    setSelectedIds([])
  }

  // ---------- live links (paste + refresh) ----------

  async function pasteLiveRange() {
    const payload = await getLinkClipboard()
    if (!payload) return
    const el = defaultLinkedTableElement(payload)
    updateSlide(currentSlide().id, (s) => ({ ...s, elements: [...s.elements, el] }))
    setSelectedIds([el.id])
  }

  /** Resolves every linked element across the whole deck. One undo step total, skipped when nothing changed. */
  async function refreshLinks() {
    // The component instance is reused across documents (see the "reset on
    // document switch" effect above), so this async walk can still be in
    // flight when the user opens a different slides file. Guard against
    // applying a stale document's resolved links — and its warnings — on top
    // of whatever is open by the time we get back.
    const startDocId = docIdRef.current
    const c = contentRef.current
    const errors: Record<string, string> = {}
    let changed = false
    const nextSlides = await Promise.all(
      c.slides.map(async (s) => {
        const nextElements = await Promise.all(
          s.elements.map(async (el) => {
            if (el.kind !== 'linked') return el
            const res = await resolveLiveLink(el.link)
            if (!res.ok) {
              if (res.error) errors[el.id] = res.error
              return el
            }
            if (JSON.stringify(res.rows) === JSON.stringify(el.link.snapshot)) return el
            changed = true
            return { ...el, link: { ...el.link, snapshot: res.rows, refreshedAt: Date.now() } }
          }),
        )
        return { ...s, elements: nextElements }
      }),
    )
    if (docIdRef.current !== startDocId) return
    setLinkWarnings(errors)
    if (changed) commit({ ...c, slides: nextSlides })
  }

  // ---------- AI deck builder ----------

  function applyAiOutline(outline: AiOutlineSlide[], mode: 'replace' | 'append') {
    const theme = getTheme(contentRef.current.themeId)
    const built = buildSlidesFromOutline(outline, theme)
    if (!built.length) return
    const c = contentRef.current
    const nextSlides = mode === 'replace' ? built : [...c.slides, ...built]
    commit({ ...c, slides: nextSlides })
    setActiveSlideId(built[0].id)
    setSelectedIds([])
    setAiOpen(false)
  }

  // ---------- global keyboard + menu events ----------

  useEffect(() => {
    function onUndoEvt() {
      undo()
    }
    function onRedoEvt() {
      redo()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (presentingRef.current) return
      const mod = e.metaKey || e.ctrlKey
      const typing = isTypingTarget()

      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        undo()
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        redo()
        return
      }
      if (typing) return

      if (e.key === 'Escape') {
        setSelectedIds([])
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdsRef.current.length) {
        e.preventDefault()
        deleteSelected()
        return
      }
      if (e.key.startsWith('Arrow') && selectedIdsRef.current.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        nudgeSelected(dx, dy)
        return
      }
      if (mod && e.key.toLowerCase() === 'd' && selectedIdsRef.current.length) {
        e.preventDefault()
        duplicateSelected()
        return
      }
      if (mod && e.key.toLowerCase() === 'c' && selectedIdsRef.current.length) {
        copySelected()
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        pasteClipboard()
        return
      }
    }
    function onGestureEnd() {
      dragGestureRef.current = false
    }
    window.addEventListener('anleo-undo', onUndoEvt)
    window.addEventListener('anleo-redo', onRedoEvt)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerup', onGestureEnd)
    window.addEventListener('mouseup', onGestureEnd)
    return () => {
      window.removeEventListener('anleo-undo', onUndoEvt)
      window.removeEventListener('anleo-redo', onRedoEvt)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerup', onGestureEnd)
      window.removeEventListener('mouseup', onGestureEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- derived ----------

  const theme = getTheme(content.themeId)
  const activeSlide = content.slides.find((s) => s.id === activeSlideId) ?? content.slides[0]
  const activeSlideIndex = Math.max(0, content.slides.findIndex((s) => s.id === activeSlide.id))
  const selectedElements = activeSlide.elements.filter((el) => selectedIds.includes(el.id))
  const activePageNumber = content.showSlideNumbers && activeSlideIndex > 0 ? activeSlideIndex + 1 : undefined

  // ---------- toolbar-driven actions ----------

  function setThemeId(id: string) {
    commit({ ...contentRef.current, themeId: id })
  }

  function setBackground(bg: SlideBackground | undefined, live?: boolean) {
    updateSlide(activeSlide.id, (s) => ({ ...s, background: bg }), live)
  }

  function setTransition(t: NonNullable<Slide['transition']>) {
    updateSlide(activeSlide.id, (s) => ({ ...s, transition: t }))
  }

  function addText() {
    const el = defaultTextElement(SLIDE_W / 2 - 210, SLIDE_H / 2 - 45)
    updateSlide(activeSlide.id, (s) => ({ ...s, elements: [...s.elements, el] }))
    setSelectedIds([el.id])
  }

  function addShape(kind: ShapeKind) {
    const size = kind === 'line' ? { w: 260, h: 4 } : { w: 220, h: 170 }
    const el = defaultShapeElement(kind, SLIDE_W / 2 - size.w / 2, SLIDE_H / 2 - size.h / 2)
    updateSlide(activeSlide.id, (s) => ({ ...s, elements: [...s.elements, el] }))
    setSelectedIds([el.id])
  }

  async function addImage() {
    const res = await platform.openFile(IMAGE_FILTERS, true)
    if (res.canceled || !res.data || !res.name) return
    const src = `data:${mimeFromName(res.name)};base64,${res.data}`
    const dims = await measureImage(src)
    const w = Math.min(560, dims.w)
    const h = w * (dims.h / dims.w || 0.75)
    const el = defaultImageElement(src, SLIDE_W / 2 - w / 2, SLIDE_H / 2 - h / 2, w, h)
    updateSlide(activeSlide.id, (s) => ({ ...s, elements: [...s.elements, el] }))
    setSelectedIds([el.id])
  }

  async function pickBackgroundImage() {
    const res = await platform.openFile(IMAGE_FILTERS, true)
    if (res.canceled || !res.data || !res.name) return
    const src = `data:${mimeFromName(res.name)};base64,${res.data}`
    setBackground({ type: 'image', src })
  }

  async function replaceImage() {
    const ids = selectedIds
    if (!ids.length) return
    const res = await platform.openFile(IMAGE_FILTERS, true)
    if (res.canceled || !res.data || !res.name) return
    const src = `data:${mimeFromName(res.name)};base64,${res.data}`
    updateSlide(activeSlide.id, (s) => ({
      ...s,
      elements: s.elements.map((el) => (ids.includes(el.id) && el.kind === 'image' ? { ...el, src } : el)),
    }))
  }

  function zOrder(action: ZOrderAction) {
    if (!selectedIds.length) return
    updateSlide(activeSlide.id, (s) => ({ ...s, elements: reorderZ(s.elements, selectedIds, action) }))
  }

  function patchSelected(patch: ElementPatch, live?: boolean) {
    if (!selectedIds.length) return
    updateSlide(activeSlide.id, (s) => ({ ...s, elements: patchElements(s.elements, selectedIds, patch) }), live)
  }

  function alignSelected(mode: AlignMode) {
    if (!selectedIds.length) return
    updateSlide(activeSlide.id, (s) => ({ ...s, elements: alignElements(s.elements, selectedIds, mode) }))
  }

  function distributeSelected(axis: 'horizontal' | 'vertical') {
    if (selectedIds.length < 3) return
    updateSlide(activeSlide.id, (s) => ({ ...s, elements: distributeElements(s.elements, selectedIds, axis) }))
  }

  function toggleSlideNumbers() {
    commit({ ...contentRef.current, showSlideNumbers: !contentRef.current.showSlideNumbers })
  }

  function updateNotesLive(text: string) {
    const c = contentRef.current
    const next = { ...c, slides: c.slides.map((s) => (s.id === activeSlide.id ? { ...s, notes: text } : s)) }
    contentRef.current = next
    setContent(next)
    onDocChange(next)
  }

  // ---------- thumbnails-driven actions ----------

  function selectSlide(id: string) {
    setActiveSlideId(id)
    setSelectedIds([])
  }

  function reorderSlides(from: number, drop: number) {
    const c = contentRef.current
    const arr = [...c.slides]
    const [moved] = arr.splice(from, 1)
    const insertAt = from < drop ? drop - 1 : drop
    arr.splice(insertAt, 0, moved)
    commit({ ...c, slides: arr })
  }

  function addSlideFromLayout(layoutId: string) {
    const layout = getLayout(layoutId)
    const built = layout.build(getTheme(contentRef.current.themeId))
    const newSlide: Slide = { id: uid(), elements: built.elements, background: built.background }
    const c = contentRef.current
    const idx = c.slides.findIndex((s) => s.id === activeSlideId)
    const arr = [...c.slides]
    arr.splice(idx + 1, 0, newSlide)
    commit({ ...c, slides: arr })
    setActiveSlideId(newSlide.id)
    setSelectedIds([])
  }

  function duplicateSlide(id: string) {
    const c = contentRef.current
    const idx = c.slides.findIndex((s) => s.id === id)
    if (idx < 0) return
    const src = structuredClone(c.slides[idx])
    const clone: Slide = { ...src, id: uid(), elements: src.elements.map((el) => ({ ...el, id: uid() })) }
    const arr = [...c.slides]
    arr.splice(idx + 1, 0, clone)
    commit({ ...c, slides: arr })
    setActiveSlideId(clone.id)
    setSelectedIds([])
  }

  function deleteSlide(id: string) {
    const c = contentRef.current
    if (c.slides.length <= 1) return
    const idx = c.slides.findIndex((s) => s.id === id)
    const arr = c.slides.filter((s) => s.id !== id)
    commit({ ...c, slides: arr })
    if (activeSlideId === id) {
      const newIdx = Math.min(idx, arr.length - 1)
      setActiveSlideId(arr[newIdx].id)
      setSelectedIds([])
    }
  }

  function moveSlide(id: string, dir: -1 | 1) {
    const c = contentRef.current
    const idx = c.slides.findIndex((s) => s.id === id)
    const swap = idx + dir
    if (idx < 0 || swap < 0 || swap >= c.slides.length) return
    const arr = [...c.slides]
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    commit({ ...c, slides: arr })
  }

  // ---------- export ----------

  async function exportPptxFile() {
    const base64 = await exportPptx(contentRef.current)
    await platform.saveFile(`${docTitleRef.current || 'Untitled'}.pptx`, base64, [{ name: 'PowerPoint Presentation', extensions: ['pptx'] }], true)
  }

  /** Runs the actual "share as web page" export — called once the user confirms in ShareWebPageModal. */
  async function runShareExport() {
    const html = buildLivingPresentation(contentRef.current, docTitleRef.current || 'Untitled')
    await platform.saveFile(`${docTitleRef.current || 'Untitled'}.html`, html, [{ name: 'Web Page', extensions: ['html'] }], false)
    setShareOpen(false)
    showToast('Web page saved — open it in any browser, or send it to anyone.')
  }

  // ---------- command palette ----------

  useEffect(() => {
    registerCommands('slides', [
      { id: 'slides-new', title: 'New slide', group: 'Slides', hint: 'Title + content', keywords: 'insert add layout', run: insertDefaultSlide },
      { id: 'slides-duplicate', title: 'Duplicate slide', group: 'Slides', run: () => duplicateSlide(currentSlide().id) },
      { id: 'slides-delete', title: 'Delete slide', group: 'Slides', run: () => deleteSlide(currentSlide().id) },
      { id: 'slides-present', title: 'Present', group: 'Slides', run: () => setPresenting(true) },
      { id: 'slides-paste-link', title: 'Paste live range', group: 'Slides', keywords: 'live link sheet table paste', run: pasteLiveRange },
      { id: 'slides-refresh-links', title: 'Refresh links', group: 'Slides', keywords: 'live link update sheet', run: refreshLinks },
      { id: 'slides-ai', title: 'AI deck builder', group: 'Slides', keywords: 'generate outline openrouter ai', run: () => setAiOpen(true) },
      { id: 'slides-align', title: 'Align & distribute', group: 'Slides', hint: 'Center selection', run: centerSelection },
      { id: 'slides-toggle-numbers', title: 'Toggle slide numbers', group: 'Slides', run: toggleSlideNumbers },
      { id: 'slides-export-pptx', title: 'Export as PowerPoint', group: 'Slides', keywords: 'pptx powerpoint export', run: exportPptxFile },
      { id: 'slides-export-pdf', title: 'Export as PDF', group: 'Slides', keywords: 'pdf print export', run: () => window.print() },
      {
        id: 'slides-export-living',
        title: 'Share as web page',
        group: 'Slides',
        keywords: 'html interactive export download living share web page',
        run: () => setShareOpen(true),
      },
    ])
    return () => clearCommands('slides')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="px-root">
      <Toolbar
        themeId={content.themeId}
        onThemeChange={setThemeId}
        slide={activeSlide}
        onBackgroundChange={setBackground}
        onPickBackgroundImage={pickBackgroundImage}
        onTransitionChange={setTransition}
        selected={selectedElements}
        onAddText={addText}
        onAddShape={addShape}
        onAddImage={addImage}
        onZOrder={zOrder}
        onPatch={patchSelected}
        onReplaceImage={replaceImage}
        onAlign={alignSelected}
        onDistribute={distributeSelected}
        notesOpen={notesOpen}
        onToggleNotes={() => setNotesOpen((o) => !o)}
        showSlideNumbers={!!content.showSlideNumbers}
        onToggleSlideNumbers={toggleSlideNumbers}
        onExportNative={() => requestSave(false)}
        onExportPptx={exportPptxFile}
        onExportPdf={() => window.print()}
        onExportLiving={() => setShareOpen(true)}
        onPresent={() => setPresenting(true)}
        hasLinkClipboard={hasLinkClipboard}
        onPasteLiveRange={pasteLiveRange}
        onRefreshLinks={refreshLinks}
        aiOpen={aiOpen}
        onOpenAiBuilder={() => setAiOpen(true)}
      />

      <div className="px-body">
        <Thumbnails
          slides={content.slides}
          theme={theme}
          activeId={activeSlide.id}
          showSlideNumbers={!!content.showSlideNumbers}
          onSelect={selectSlide}
          onReorder={reorderSlides}
          onAddSlide={addSlideFromLayout}
          onDuplicate={duplicateSlide}
          onDelete={deleteSlide}
          onMoveUp={(id) => moveSlide(id, -1)}
          onMoveDown={(id) => moveSlide(id, 1)}
        />

        <div className="px-canvas-area" ref={canvasAreaRef}>
          <Canvas
            key={activeSlide.id}
            slide={activeSlide}
            theme={theme}
            scale={canvasScale}
            pageNumber={activePageNumber}
            selectedIds={selectedIds}
            onSelectedIds={setSelectedIds}
            onCommit={(elements) => updateSlide(activeSlide.id, (s) => ({ ...s, elements }))}
            onElementContextMenu={(x, y, id) => setCtxMenu({ x, y, id })}
            linkWarnings={linkWarnings}
          />
        </div>
      </div>

      {notesOpen && (
        <div className="px-notes">
          <div className="px-notes-label">Speaker notes</div>
          <textarea
            value={activeSlide.notes || ''}
            placeholder="Add notes for this slide…"
            onChange={(e) => updateNotesLive(e.target.value)}
          />
        </div>
      )}

      {presenting && (
        <Present
          slides={content.slides}
          theme={theme}
          startIndex={activeSlideIndex}
          showSlideNumbers={!!content.showSlideNumbers}
          onClose={() => setPresenting(false)}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: 'Duplicate', icon: <IcDuplicate />, onClick: duplicateSelected },
            { label: 'Copy', onClick: copySelected },
            'sep',
            { label: 'Bring to front', onClick: () => zOrder('front') },
            { label: 'Bring forward', onClick: () => zOrder('forward') },
            { label: 'Send backward', onClick: () => zOrder('backward') },
            { label: 'Send to back', onClick: () => zOrder('back') },
            'sep',
            { label: 'Delete', icon: <IcTrash />, danger: true, onClick: deleteSelected },
          ]}
        />
      )}

      <PrintView slides={content.slides} theme={theme} showSlideNumbers={!!content.showSlideNumbers} />

      {aiOpen && <AiDeckModal onClose={() => setAiOpen(false)} onApply={applyAiOutline} />}

      {shareOpen && (
        <ShareWebPageModal kind="slides" onClose={() => setShareOpen(false)} onExport={() => void runShareExport()} />
      )}

      {toast && <div className="px-toast">{toast}</div>}
    </div>
  )
}
