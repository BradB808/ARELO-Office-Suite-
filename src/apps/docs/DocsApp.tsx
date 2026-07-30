import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import type { JSONContent } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import type { Slice } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color, FontFamily, FontSize, LineHeight } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Image from '@tiptap/extension-image'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { CharacterCount, Placeholder } from '@tiptap/extensions'

import type { DocsContent, EditorAppProps } from '../../shared/types'
import { Modal, Button } from '../../shared/ui'
import { installFontFiles } from '../../shared/fonts'
import { platform } from '../../shared/platform'
import { registerExporters } from '../../shared/exporters'
import { registerCommands, clearCommands } from '../../shared/commands'
import { ShareWebPageModal } from '../../shared/ShareWebPageModal'

import { Toolbar, applyCaseChange, type ExportKind, type ImportKind } from './Toolbar'
import { FindReplace } from './FindReplace'
import { StatusBar } from './StatusBar'
import { AiPanel } from './AiPanel'
import { PageBreak } from './pageBreakExtension'
import { LiveRange } from './liveRangeExtension'
import { refreshLiveRanges } from './liveRangeRefresh'
import { pasteLiveRangeFromClipboard } from './liveRangeClipboard'
import { insertTableOfContents } from './toc'
import { buildLivingDocumentHtml } from './living'
import {
  exportDocx,
  exportMarkdown,
  exportHtml,
  exportPlainText,
  buildDocxBase64,
  standaloneHtmlDocument,
  htmlToMarkdown,
} from './export'
import { buildRtf } from './convert/rtf'
import { buildOdtBase64 } from './convert/odt'
import { buildEpubBase64 } from './convert/epub'
import { importDocxFile, importMarkdownFile, importTextFile, importHtmlFile, type ImportedDoc } from './importFile'
import { fileToSizedImage, isImageFile } from './imageUtils'
import './docs.css'

const PAGE_WIDTH = 816

// Image with a text-wrap mode: 'inline' (block in flow), 'left' or 'right'
// (floated — text flows around it). Freely draggable to any spot in the doc.
const FloatImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      wrap: {
        default: 'inline',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-wrap') || 'inline',
        renderHTML: (attrs: { wrap?: string }) =>
          attrs.wrap && attrs.wrap !== 'inline' ? { 'data-wrap': attrs.wrap } : {},
      },
    }
  },

  addNodeView() {
    // The stock resizable node view never re-applies changed attributes to its
    // <img>, so a wrap-mode change would leave stale DOM. Force a rebuild when
    // `wrap` changes; everything else keeps the parent behavior.
    const parentFactory = this.parent?.()
    if (!parentFactory) return null
    return (props) => {
      const view = parentFactory(props)
      if (!view || typeof view === 'boolean') return view
      let currentWrap = props.node.attrs.wrap as string
      const origUpdate = view.update?.bind(view)
      view.update = (node, decorations, innerDecorations) => {
        if (node.type.name === 'image' && node.attrs.wrap !== currentWrap) return false
        currentWrap = node.attrs.wrap as string
        return origUpdate ? origUpdate(node, decorations, innerDecorations) : true
      }

      // ProseMirror doesn't mark custom node views draggable on its own — flag
      // the container and select the node on dragstart so PM moves the whole
      // image node (with a drop cursor) instead of doing nothing.
      const dom = view.dom as HTMLElement
      if (dom && dom instanceof HTMLElement) {
        dom.draggable = true
        dom.addEventListener('dragstart', () => {
          const pos = props.getPos()
          if (typeof pos !== 'number') return
          const pmView = props.editor.view
          pmView.dispatch(pmView.state.tr.setSelection(NodeSelection.create(pmView.state.doc, pos)))
        })
      }
      return view
    }
  },
})

export default function DocsApp({ doc, onDocChange, onTitleChange, requestSave }: EditorAppProps<DocsContent>) {
  // `doc.content` is typed as the cross-app `AnyContent` union on the shared
  // contract (only `onDocChange` is specialized to `DocsContent`) — narrow it
  // once here since every field below is Docs-specific.
  const content = doc.content as DocsContent

  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ImportedDoc>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const docRef = useRef(content)
  docRef.current = content
  const onDocChangeRef = useRef(onDocChange)
  onDocChangeRef.current = onDocChange
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDocId = useRef(doc.meta.id)

  const margin = content.margin ?? 72
  const contentWidthPx = Math.max(160, PAGE_WIDTH - margin * 2)
  const contentWidthRef = useRef(contentWidthPx)
  contentWidthRef.current = contentWidthPx

  const editorRef = useRef<Editor | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      FloatImage.configure({
        allowBase64: true,
        inline: false,
        resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 40, minHeight: 40 },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      PageBreak,
      LiveRange,
      CharacterCount,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    [],
  )

  // Stable handlers (deps: []) so `editorProps` never changes identity across
  // renders — keeps every keystroke from re-triggering ProseMirror's
  // `view.setProps`. Live values (editor instance, content width) come from
  // refs kept fresh above, not from render-time closures.
  const handleDrop = useCallback((view: EditorView, event: DragEvent, _slice: Slice, moved: boolean) => {
    if (moved) return false
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (!files.length) return false
    const fontFiles = files.filter((f) => /\.(ttf|otf|woff2?)$/i.test(f.name))
    const imageFiles = files.filter((f) => isImageFile(f.name))
    if (!fontFiles.length && !imageFiles.length) return false
    event.preventDefault()
    const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
    const pos = coords?.pos ?? view.state.selection.from
    void (async () => {
      if (fontFiles.length) {
        const installed = await installFontFiles(fontFiles)
        if (installed.length) showToastRef.current(`Installed ${installed.join(', ')}`)
      }
      let insertAt = pos
      for (const file of imageFiles) {
        const img = await fileToSizedImage(file, contentWidthRef.current)
        editorRef.current
          ?.chain()
          .focus()
          .insertContentAt(insertAt, { type: 'image', attrs: { src: img.src, width: img.width, height: img.height } })
          .run()
        insertAt += 1
      }
    })()
    return true
  }, [])

  const handlePaste = useCallback((_view: EditorView, event: ClipboardEvent) => {
    const items = Array.from(event.clipboardData?.items ?? [])
    const imageItems = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (!imageItems.length) return false
    event.preventDefault()
    void (async () => {
      for (const item of imageItems) {
        const file = item.getAsFile()
        if (!file) continue
        const img = await fileToSizedImage(file, contentWidthRef.current)
        editorRef.current?.chain().focus().setImage({ src: img.src, width: img.width, height: img.height }).run()
      }
    })()
    return true
  }, [])

  const editorProps = useMemo(
    () => ({
      attributes: { class: 'dx-prosemirror', spellcheck: 'true' },
      handleDrop,
      handlePaste,
    }),
    [handleDrop, handlePaste],
  )

  // Frozen at mount — subsequent edits flow through onUpdate, not this prop.
  const initialHtml = useRef(content.html || '<p></p>').current

  const editor = useEditor(
    {
      extensions,
      content: initialHtml,
      shouldRerenderOnTransaction: true,
      editorProps,
      onUpdate({ editor: ed }) {
        onDocChangeRef.current({ ...docRef.current, html: ed.getHTML() })
      },
    },
    [],
  )

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // Reset internal state when the shell hands us a different document.
  useEffect(() => {
    if (!editor) return
    if (doc.meta.id === lastDocId.current) return
    lastDocId.current = doc.meta.id
    const nextHtml = content.html || '<p></p>'
    if (nextHtml !== editor.getHTML()) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
    setFindOpen(false)
    setFindQuery('')
    setAiOpen(false)
    setZoom(100)
    setPendingImport(null)
    setShareOpen(false)
  }, [doc.meta.id, editor])

  // On document open — the very first load and every later switch to a
  // different document — silently reconcile every live range against its
  // Sheets source. refreshLiveRanges never dispatches a transaction when
  // nothing actually changed, so this never dirties autosave on its own.
  useEffect(() => {
    if (!editor) return
    void refreshLiveRanges(editor)
  }, [editor, doc.meta.id])

  // Cmd+F opens find while the editor has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && editor?.isFocused) {
        e.preventDefault()
        const { from, to } = editor.state.selection
        const selected = from !== to ? editor.state.doc.textBetween(from, to, ' ') : ''
        setFindQuery(selected)
        setFindOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  // Cmd+J opens/closes the AI panel — works regardless of where focus is
  // (editor or the panel itself), unlike find which only opens on editor focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setAiOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const setMargin = (px: number) => {
    onDocChange({ ...content, margin: px })
  }

  const pageNumbers = content.pageNumbers ?? false
  const setPageNumbers = (v: boolean) => {
    onDocChange({ ...content, pageNumbers: v })
  }

  const applyImport = (result: NonNullable<ImportedDoc>) => {
    if (!editor) return
    editor.commands.setContent(result.html, { emitUpdate: true })
    const base = result.name.replace(/\.[^.]+$/, '')
    if (base) onTitleChange(base)
    setPendingImport(null)
  }

  const runImport = async (kind: ImportKind) => {
    if (!editor) return
    let result: ImportedDoc = null
    if (kind === 'docx') result = await importDocxFile()
    else if (kind === 'md') result = await importMarkdownFile()
    else if (kind === 'txt') result = await importTextFile()
    else if (kind === 'html') result = await importHtmlFile()
    if (!result) return
    if (!editor.isEmpty) setPendingImport(result)
    else applyImport(result)
  }

  const triggerPrint = () => {
    document.body.classList.add('dx-printing')
    const cleanup = () => {
      document.body.classList.remove('dx-printing')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  // Register save-dialog formats so Save As offers Word/PDF/Markdown/HTML/text
  // directly (Word .docx opens in Apple Pages too). Reads live editor state via
  // refs, so registering once per doc/margin change is enough.
  const marginRef = useRef(margin)
  marginRef.current = margin
  const titleRef = useRef(doc.meta.title)
  titleRef.current = doc.meta.title
  const pageNumbersRef = useRef(pageNumbers)
  pageNumbersRef.current = pageNumbers

  useEffect(() => {
    registerExporters('docs', [
      {
        ext: 'docx',
        label: 'Word document',
        produce: async () => {
          const ed = editorRef.current!
          const m = marginRef.current
          const contentWidthPx = Math.max(200, PAGE_WIDTH - m * 2)
          return {
            data: await buildDocxBase64(ed.getJSON() as JSONContent, { marginPx: m, contentWidthPx }),
            binary: true,
          }
        },
      },
      {
        ext: 'pdf',
        label: 'PDF',
        produce: async () => ({
          pdfHtml: standaloneHtmlDocument(editorRef.current!.getHTML(), titleRef.current, marginRef.current),
          footerTitle: pageNumbersRef.current ? titleRef.current : undefined,
        }),
      },
      {
        ext: 'odt',
        label: 'OpenDocument text',
        produce: async () => ({
          data: await buildOdtBase64(editorRef.current!.getJSON() as JSONContent, { title: titleRef.current }),
          binary: true,
        }),
      },
      {
        ext: 'txt',
        label: 'Plain text',
        produce: async () => ({
          data: editorRef.current!.getText({ blockSeparator: '\n\n' }),
          binary: false,
        }),
      },
      {
        ext: 'rtf',
        label: 'Rich text format',
        produce: async () => ({
          data: buildRtf(editorRef.current!.getJSON() as JSONContent, { title: titleRef.current }),
          binary: false,
        }),
      },
      {
        ext: 'html',
        label: 'Web page',
        produce: async () => ({
          data: standaloneHtmlDocument(editorRef.current!.getHTML(), titleRef.current, marginRef.current),
          binary: false,
        }),
      },
      {
        ext: 'epub',
        label: 'EPUB publication',
        produce: async () => ({
          data: await buildEpubBase64(editorRef.current!.getJSON() as JSONContent, { title: titleRef.current }),
          binary: true,
        }),
      },
      {
        ext: 'md',
        label: 'Markdown',
        produce: async () => ({ data: htmlToMarkdown(editorRef.current!.getHTML()), binary: false }),
      },
    ])
  }, [])

  const exportPdfDirect = async (title: string, html: string) => {
    if (!platform.isElectron) {
      // Browser build has no PDF renderer — fall back to the print dialog.
      triggerPrint()
      return
    }
    const res = await platform.choosePath(`${title || 'Untitled'}.pdf`, [
      { name: 'PDF', extensions: ['pdf'] },
    ])
    if (res.canceled || !res.path) return
    const out = await platform.exportPdfToPath(standaloneHtmlDocument(html, title, margin), res.path, {
      footerTitle: pageNumbers ? title : undefined,
    })
    setToast(out.ok ? `Saved “${res.name}”` : 'PDF export failed')
    setTimeout(() => setToast(null), 3000)
  }

  const runExport = async (kind: ExportKind) => {
    if (!editor) return
    const title = doc.meta.title
    if (kind === 'adoc') {
      await requestSave()
      return
    }
    if (kind === 'docx') {
      await exportDocx(editor.getJSON() as JSONContent, title, margin)
      return
    }
    if (kind === 'md') {
      await exportMarkdown(editor.getHTML(), title)
      return
    }
    if (kind === 'html') {
      await exportHtml(editor.getHTML(), title, margin)
      return
    }
    if (kind === 'living') {
      setShareOpen(true)
      return
    }
    if (kind === 'txt') {
      await exportPlainText(editor.getText({ blockSeparator: '\n\n' }), title)
      return
    }
    if (kind === 'odt') {
      const b64 = await buildOdtBase64(editor.getJSON() as JSONContent, { title })
      await platform.saveFile(`${title || 'Untitled'}.odt`, b64, [{ name: 'OpenDocument Text', extensions: ['odt'] }], true)
      return
    }
    if (kind === 'rtf') {
      const rtf = buildRtf(editor.getJSON() as JSONContent, { title })
      await platform.saveFile(`${title || 'Untitled'}.rtf`, rtf, [{ name: 'Rich Text Format', extensions: ['rtf'] }])
      return
    }
    if (kind === 'epub') {
      const b64 = await buildEpubBase64(editor.getJSON() as JSONContent, { title })
      await platform.saveFile(`${title || 'Untitled'}.epub`, b64, [{ name: 'EPUB Publication', extensions: ['epub'] }], true)
      return
    }
    if (kind === 'pdf') {
      await exportPdfDirect(title, editor.getHTML())
      return
    }
    if (kind === 'print') {
      triggerPrint()
    }
  }

  // Runs only when the user confirms in ShareWebPageModal — the export
  // itself and its file extension are unchanged from the old "Living
  // document" menu entry, just gated behind the plain-English explainer.
  const runShareExport = async () => {
    if (!editor) return
    const title = doc.meta.title
    const livingHtml = buildLivingDocumentHtml(editor.getHTML(), title)
    const res = await platform.saveFile(`${title || 'Untitled'}.html`, livingHtml, [{ name: 'Web Page', extensions: ['html'] }], false)
    setShareOpen(false)
    if (!res.canceled) showToast('Web page saved — open it in any browser, or send it to anyone.')
  }

  const words = editor?.storage.characterCount?.words() ?? 0
  const characters = editor?.storage.characterCount?.characters() ?? 0

  // Command-palette entry point (⌘K, built elsewhere) — refs keep every
  // closure reading live state without re-registering on each keystroke.
  const runExportRef = useRef(runExport)
  runExportRef.current = runExport
  const findOpenRef = useRef(findOpen)
  findOpenRef.current = findOpen

  useEffect(() => {
    registerCommands('docs', [
      {
        id: 'insert-page-break',
        title: 'Insert page break',
        group: 'Docs',
        hint: '⌘⏎',
        run: () => {
          editorRef.current?.chain().focus().setPageBreak().run()
        },
      },
      {
        id: 'insert-toc',
        title: 'Insert table of contents',
        group: 'Docs',
        run: () => {
          if (editorRef.current) insertTableOfContents(editorRef.current)
        },
      },
      {
        id: 'insert-live-range',
        title: 'Insert live range from Sheets',
        group: 'Docs',
        keywords: 'paste link table sheets live',
        run: async () => {
          if (!editorRef.current) return
          const result = await pasteLiveRangeFromClipboard(editorRef.current)
          if (result === 'empty') showToastRef.current('Copy a range from Sheets first, then try again.')
        },
      },
      {
        id: 'toggle-ai-panel',
        title: 'Toggle AI panel',
        group: 'Docs',
        hint: '⌘J',
        keywords: 'sparkle assistant write',
        run: () => setAiOpen((o) => !o),
      },
      {
        id: 'find-replace',
        title: 'Find & replace',
        group: 'Docs',
        hint: '⌘F',
        run: () => {
          const ed = editorRef.current
          if (!ed) return
          if (findOpenRef.current) {
            setFindOpen(false)
            return
          }
          const { from, to } = ed.state.selection
          setFindQuery(from !== to ? ed.state.doc.textBetween(from, to, ' ') : '')
          setFindOpen(true)
        },
      },
      {
        // 'Export as PDF' / 'Export as Word' already exist generically —
        // App.tsx builds one command per registerExporters('docs', …) entry
        // (id `export-${ext}`, driving the same Save-a-copy-as flow as the
        // toolbar's export menu). Living document isn't in that registry
        // (see exporters.ts's single-html-extension rule), so it needs its
        // own command here.
        id: 'export-living-doc',
        title: 'Share as web page',
        group: 'Docs',
        keywords: 'html interactive export share',
        run: () => runExportRef.current('living'),
      },
      {
        id: 'case-upper',
        title: 'Change case: UPPERCASE',
        group: 'Docs',
        keywords: 'change case',
        run: () => {
          if (editorRef.current) applyCaseChange(editorRef.current, 'upper')
        },
      },
      {
        id: 'case-lower',
        title: 'Change case: lowercase',
        group: 'Docs',
        keywords: 'change case',
        run: () => {
          if (editorRef.current) applyCaseChange(editorRef.current, 'lower')
        },
      },
      {
        id: 'case-title',
        title: 'Change case: Title Case',
        group: 'Docs',
        keywords: 'change case',
        run: () => {
          if (editorRef.current) applyCaseChange(editorRef.current, 'title')
        },
      },
      {
        id: 'insert-special-char',
        title: 'Insert special character',
        group: 'Docs',
        run: () => {
          document.querySelector<HTMLButtonElement>('.dx-toolbar [data-special-chars-trigger]')?.click()
        },
      },
      {
        id: 'word-count',
        title: 'Word count',
        group: 'Docs',
        run: () => {
          const ed = editorRef.current
          if (!ed) return
          const w = ed.storage.characterCount?.words() ?? 0
          const c = ed.storage.characterCount?.characters() ?? 0
          showToastRef.current(`${w.toLocaleString()} words, ${c.toLocaleString()} characters`)
        },
      },
    ])
    return () => clearCommands('docs')
  }, [])

  if (!editor) {
    return <div className="empty-hint">Loading editor…</div>
  }

  return (
    <div className="dx-root">
      <Toolbar
        editor={editor}
        findOpen={findOpen}
        onToggleFind={() => {
          if (findOpen) {
            setFindOpen(false)
          } else {
            const { from, to } = editor.state.selection
            const selected = from !== to ? editor.state.doc.textBetween(from, to, ' ') : ''
            setFindQuery(selected)
            setFindOpen(true)
          }
        }}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((o) => !o)}
        onImport={runImport}
        onExport={runExport}
        contentWidthPx={contentWidthPx}
      />

      <div className="dx-body">
        <div
          className={'dx-canvas-scroll' + (dragOver ? ' dx-drag-over' : '')}
          onDragOver={(e) => {
            if (e.dataTransfer?.types.includes('Files')) {
              e.preventDefault()
              setDragOver(true)
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={() => setDragOver(false)}
        >
          <div className="dx-canvas-inner" style={{ zoom: zoom / 100 }}>
            <div className="dx-page" style={{ width: PAGE_WIDTH, minHeight: 1056, padding: margin }}>
              <EditorContent editor={editor} />
            </div>
          </div>

          <ImageWrapMenu editor={editor} />

          {findOpen && <FindReplace editor={editor} initialQuery={findQuery} onClose={() => setFindOpen(false)} />}

          {toast && <div className="dx-toast">{toast}</div>}

          {dragOver && (
            <div className="dx-dropveil">
              <span>Drop to insert image or install font</span>
            </div>
          )}
        </div>

        {aiOpen && <AiPanel editor={editor} onClose={() => setAiOpen(false)} />}
      </div>

      <StatusBar
        words={words}
        characters={characters}
        marginPx={margin}
        onMarginChange={setMargin}
        pageNumbers={pageNumbers}
        onPageNumbersChange={setPageNumbers}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      {pendingImport && (
        <Modal
          title="Replace document contents?"
          subtitle={`Importing "${pendingImport.name}" will replace everything currently in this document. This can be undone with ⌘Z.`}
          onClose={() => setPendingImport(null)}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button variant="outline" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => applyImport(pendingImport)}>
              Replace contents
            </Button>
          </div>
        </Modal>
      )}

      {shareOpen && (
        <ShareWebPageModal kind="docs" onClose={() => setShareOpen(false)} onExport={() => void runShareExport()} />
      )}
    </div>
  )
}

// ---------- Floating image wrap toolbar ----------
// Appears above a selected image: choose how text flows around it. The image
// itself can be dragged anywhere in the document (ProseMirror moves the node
// and shows a drop cursor), and text reflows around the new position.

const WRAP_MODES: { mode: 'inline' | 'left' | 'right'; label: string; icon: React.ReactNode }[] = [
  {
    mode: 'inline',
    label: 'In line with text',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
        <path d="M3 4h14M3 16h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="6" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    mode: 'left',
    label: 'Wrap text right (image left)',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
        <rect x="3" y="6" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <path d="M12.5 7h4.5M12.5 10h4.5M12.5 13h4.5M3 3.5h14M3 16.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    mode: 'right',
    label: 'Wrap text left (image right)',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
        <rect x="10" y="6" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 7h4.5M3 10h4.5M3 13h4.5M3 3.5h14M3 16.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
]

function ImageWrapMenu({ editor }: { editor: Editor | null }) {
  const [, force] = useState(0)

  // Reposition when the canvas scrolls (rects are viewport-based).
  useEffect(() => {
    const onScroll = () => force((t) => t + 1)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  if (!editor) return null
  const sel = editor.state.selection
  if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return null
  const dom = editor.view.nodeDOM(sel.from) as HTMLElement | null
  if (!dom || typeof dom.getBoundingClientRect !== 'function') return null
  const rect = dom.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null

  const current = (sel.node.attrs.wrap as string) || 'inline'
  const top = Math.max(8, rect.top - 44)
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - 76), window.innerWidth - 170)

  return (
    <div className="dx-image-menu" style={{ top, left }}>
      {WRAP_MODES.map((w) => (
        <button
          key={w.mode}
          className={'iconbtn' + (current === w.mode ? ' active' : '')}
          title={w.label}
          aria-label={w.label}
          onMouseDown={(e) => {
            e.preventDefault()
            editor.chain().focus().updateAttributes('image', { wrap: w.mode }).run()
          }}
        >
          {w.icon}
        </button>
      ))}
      <div className="toolbar-divider" />
      <button
        className="iconbtn"
        title="Delete image"
        aria-label="Delete image"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().deleteSelection().run()
        }}
      >
        <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
          <path d="M4 5.5h12M8 5V3.8A.8.8 0 0 1 8.8 3h2.4a.8.8 0 0 1 .8.8V5M6.5 5.5l.6 10a1.2 1.2 0 0 0 1.2 1.1h3.4a1.2 1.2 0 0 0 1.2-1.1l.6-10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
