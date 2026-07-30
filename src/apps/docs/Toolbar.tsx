// The Docs toolbar: one wrapping .toolbar row with every formatting control.
// Reads active state straight off the live `editor` each render — DocsApp
// mounts the editor with `shouldRerenderOnTransaction: true` so this stays
// in sync with the cursor/selection automatically.

import React, { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Select, MenuButton, ColorPickerButton, ToolbarDivider, Popover, Button, Spacer, type MenuItem } from '../../shared/ui'
import { IcExport } from '../../shared/icons'
import { AiButton } from '../../shared/AiButton'
import { SYSTEM_FONTS, cssFamily, getCustomFonts, subscribeFonts } from '../../shared/fonts'
import { getLinkClipboard } from '../../shared/livelink'
import { pasteLiveRangeFromClipboard } from './liveRangeClipboard'
import { FontFamilyMenu } from './FontFamilyMenu'
import { SpecialCharsMenu } from './SpecialCharsMenu'
import { pickImageViaDialog } from './imageUtils'
import { insertTableOfContents } from './toc'
import {
  IcUndo,
  IcRedo,
  IcBold,
  IcItalic,
  IcUnderline,
  IcStrike,
  IcSubscript,
  IcSuperscript,
  IcAlignLeft,
  IcAlignCenter,
  IcAlignRight,
  IcAlignJustify,
  IcBulletList,
  IcOrderedList,
  IcTaskList,
  IcIndent,
  IcOutdent,
  IcLink,
  IcImage,
  IcTable,
  IcHr,
  IcInsertBreak,
  IcClearFormat,
  IcFind,
  IcTextColor,
  IcHighlight,
  IcImport,
} from './icons'

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72]
const LINE_HEIGHTS: { value: string; label: string }[] = [
  { value: '1', label: 'Single' },
  { value: '1.15', label: '1.15' },
  { value: '1.35', label: '1.35' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: 'Double' },
]

export type ExportKind =
  | 'adoc'
  | 'docx'
  | 'pdf'
  | 'odt'
  | 'txt'
  | 'rtf'
  | 'html'
  | 'living'
  | 'epub'
  | 'md'
  | 'print'
export type ImportKind = 'docx' | 'md' | 'txt' | 'html'

// ---------- editor state <-> control value helpers ----------

function currentBlockValue(editor: Editor): string {
  if (editor.isActive('heading', { level: 1 })) return 'h1'
  if (editor.isActive('heading', { level: 2 })) return 'h2'
  if (editor.isActive('heading', { level: 3 })) return 'h3'
  if (editor.isActive('heading', { level: 4 })) return 'h4'
  if (editor.isActive('blockquote')) return 'blockquote'
  if (editor.isActive('codeBlock')) return 'codeBlock'
  return 'paragraph'
}

function applyBlockValue(editor: Editor, value: string) {
  const chain = editor.chain().focus()
  if (value === 'paragraph') chain.setParagraph().run()
  else if (value === 'blockquote') chain.setBlockquote().run()
  else if (value === 'codeBlock') chain.setCodeBlock().run()
  else if (/^h[1-4]$/.test(value)) chain.setHeading({ level: Number(value[1]) as 1 | 2 | 3 | 4 }).run()
}

function currentFontDisplay(editor: Editor, customFonts: string[]): string {
  const raw = editor.getAttributes('textStyle').fontFamily as string | undefined
  if (!raw) return SYSTEM_FONTS[0]
  const all = [...customFonts, ...SYSTEM_FONTS]
  const found = all.find((n) => cssFamily(n) === raw)
  return found ?? raw.replace(/^['"]|['"]$/g, '')
}

function currentFontSize(editor: Editor): string {
  const raw = editor.getAttributes('textStyle').fontSize as string | undefined
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isNaN(n) ? '16' : String(n)
}

function currentLineHeight(editor: Editor): string {
  const raw = editor.getAttributes('textStyle').lineHeight as string | undefined
  return raw && LINE_HEIGHTS.some((l) => l.value === raw) ? raw : '1.5'
}

/** Line height is a textStyle mark (per-run), but the toolbar control should
 *  feel block-wide — so it merges the value into every run's existing
 *  textStyle attrs across every textblock touched by the selection. */
function setBlockLineHeight(editor: Editor, value: string) {
  const { state, view } = editor
  const markType = state.schema.marks.textStyle
  if (!markType) return
  const tr = state.tr
  state.selection.ranges.forEach((r) => {
    state.doc.nodesBetween(r.$from.pos, r.$to.pos, (node, pos) => {
      if (!node.isTextblock) return
      node.forEach((child, offset) => {
        if (!child.isInline) return
        const from = pos + 1 + offset
        const to = from + child.nodeSize
        const existing = child.marks.find((m) => m.type === markType)
        tr.addMark(from, to, markType.create({ ...(existing?.attrs ?? {}), lineHeight: value }))
      })
    })
  })
  view.dispatch(tr)
  editor.commands.focus()
}

// ---------- change case ----------

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence'

/** Case-fold a run of text, threading word/sentence-boundary state across
 *  calls so title/sentence case stay correct across a selection that spans
 *  several differently-marked text nodes (see applyCaseChange). */
function foldCase(text: string, mode: CaseMode, boundary: { atStart: boolean }): string {
  if (mode === 'upper') return text.toUpperCase()
  if (mode === 'lower') return text.toLowerCase()
  let out = ''
  for (const ch of text) {
    const isLetter = /\p{L}/u.test(ch)
    if (!isLetter) {
      out += ch
      if (mode === 'title') {
        if (/\s/.test(ch)) boundary.atStart = true
      } else if (/[.!?]/.test(ch)) {
        boundary.atStart = true
      }
      continue
    }
    if (boundary.atStart) {
      out += ch.toUpperCase()
      boundary.atStart = false
    } else {
      out += ch.toLowerCase()
    }
  }
  return out
}

/** Rewrite the text of the current selection in place, node by node, so
 *  each text run keeps its own marks (bold/color/etc.) — no HTML round trip. */
export function applyCaseChange(editor: Editor, mode: CaseMode) {
  const { state, view } = editor
  const { from, to } = state.selection
  if (from === to) return
  const { tr, schema } = state
  const boundary = { atStart: true }
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return
    const nodeFrom = pos
    const nodeTo = pos + node.nodeSize
    const start = Math.max(nodeFrom, from)
    const end = Math.min(nodeTo, to)
    if (start >= end) return
    const slice = node.text.slice(start - nodeFrom, end - nodeFrom)
    const replaced = foldCase(slice, mode, boundary)
    if (replaced === slice) return
    // Map through steps already applied in this transaction — most case
    // folds preserve length, but a few (e.g. German 'ß'.toUpperCase() ===
    // 'SS') don't, which would desync later positions computed against the
    // pre-transaction `state.doc` otherwise.
    const mappedStart = tr.mapping.map(start)
    const mappedEnd = tr.mapping.map(end)
    tr.replaceWith(mappedStart, mappedEnd, schema.text(replaced, node.marks))
  })
  if (tr.docChanged) {
    view.dispatch(tr)
    editor.commands.focus()
  }
}

function ChangeCaseMenu({ editor }: { editor: Editor }) {
  const hasSelection = !editor.state.selection.empty
  const items: (MenuItem | 'sep' | { header: string })[] = [
    { label: 'UPPERCASE', disabled: !hasSelection, onClick: () => applyCaseChange(editor, 'upper') },
    { label: 'lowercase', disabled: !hasSelection, onClick: () => applyCaseChange(editor, 'lower') },
    { label: 'Title Case', disabled: !hasSelection, onClick: () => applyCaseChange(editor, 'title') },
    { label: 'Sentence case', disabled: !hasSelection, onClick: () => applyCaseChange(editor, 'sentence') },
  ]
  return <MenuButton trigger={<span style={{ fontSize: 12.5, fontWeight: 700 }}>Aa</span>} label="Change case" items={items} />
}

// ---------- insert menu (page break, table of contents) ----------

function InsertMenu({ editor }: { editor: Editor }) {
  const [hasClip, setHasClip] = useState(false)

  // Recheck on mount and whenever the window regains focus — the payload
  // typically comes from copying a range in Sheets in another window/tab.
  useEffect(() => {
    let alive = true
    const check = () => {
      void getLinkClipboard().then((p) => {
        if (alive) setHasClip(!!p)
      })
    }
    check()
    window.addEventListener('focus', check)
    return () => {
      alive = false
      window.removeEventListener('focus', check)
    }
  }, [])

  const items: (MenuItem | 'sep' | { header: string })[] = [
    { label: 'Page break (⌘⏎)', onClick: () => editor.chain().focus().setPageBreak().run() },
    { label: 'Table of contents', onClick: () => insertTableOfContents(editor) },
    {
      label: 'Paste live range from Sheets',
      disabled: !hasClip,
      onClick: () => {
        void pasteLiveRangeFromClipboard(editor)
      },
    },
  ]
  return <MenuButton trigger={<IcInsertBreak />} label="Insert" items={items} />
}

function indent(editor: Editor) {
  const chain = editor.chain().focus()
  if (editor.can().sinkListItem('listItem')) chain.sinkListItem('listItem').run()
  else if (editor.can().sinkListItem('taskItem')) chain.sinkListItem('taskItem').run()
}

function outdent(editor: Editor) {
  const chain = editor.chain().focus()
  if (editor.can().liftListItem('listItem')) chain.liftListItem('listItem').run()
  else if (editor.can().liftListItem('taskItem')) chain.liftListItem('taskItem').run()
}

// ---------- link popover ----------

function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const active = editor.isActive('link')

  const openPopover = () => {
    setUrl((editor.getAttributes('link').href as string) ?? '')
    setOpen(true)
  }

  const apply = () => {
    const href = url.trim()
    if (!href) return
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setOpen(false)
  }
  const remove = () => {
    editor.chain().focus().unsetLink().run()
    setOpen(false)
  }

  return (
    <>
      <button ref={btnRef} className={'iconbtn' + (active ? ' active' : '')} title="Insert link" aria-label="Insert link" onClick={openPopover}>
        <IcLink />
      </button>
      {open && (
        <Popover anchor={btnRef.current} onClose={() => setOpen(false)} width={280}>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="textfield"
              placeholder="https://example.com"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  apply()
                }
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {active && (
                <Button small variant="danger" onClick={remove}>
                  Remove
                </Button>
              )}
              <Button small variant="primary" onClick={apply} disabled={!url.trim()}>
                Apply
              </Button>
            </div>
          </div>
        </Popover>
      )}
    </>
  )
}

// ---------- table menu ----------

function TableMenu({ editor }: { editor: Editor }) {
  const items: (MenuItem | 'sep' | { header: string })[] = [
    {
      label: 'Insert 3×3 table',
      onClick: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    'sep',
    { label: 'Add row above', disabled: !editor.can().addRowBefore(), onClick: () => editor.chain().focus().addRowBefore().run() },
    { label: 'Add row below', disabled: !editor.can().addRowAfter(), onClick: () => editor.chain().focus().addRowAfter().run() },
    { label: 'Add column left', disabled: !editor.can().addColumnBefore(), onClick: () => editor.chain().focus().addColumnBefore().run() },
    { label: 'Add column right', disabled: !editor.can().addColumnAfter(), onClick: () => editor.chain().focus().addColumnAfter().run() },
    'sep',
    { label: 'Delete row', disabled: !editor.can().deleteRow(), onClick: () => editor.chain().focus().deleteRow().run() },
    { label: 'Delete column', disabled: !editor.can().deleteColumn(), onClick: () => editor.chain().focus().deleteColumn().run() },
    'sep',
    { label: 'Toggle header row', disabled: !editor.can().toggleHeaderRow(), onClick: () => editor.chain().focus().toggleHeaderRow().run() },
    'sep',
    { label: 'Delete table', danger: true, disabled: !editor.can().deleteTable(), onClick: () => editor.chain().focus().deleteTable().run() },
  ]
  return <MenuButton trigger={<IcTable />} label="Table" items={items} />
}

// ---------- main toolbar ----------

export function Toolbar({
  editor,
  onToggleFind,
  findOpen,
  aiOpen,
  onToggleAi,
  onImport,
  onExport,
  contentWidthPx,
}: {
  editor: Editor
  findOpen: boolean
  onToggleFind: () => void
  aiOpen: boolean
  onToggleAi: () => void
  onImport: (kind: ImportKind) => void
  onExport: (kind: ExportKind) => void
  contentWidthPx: number
}) {
  const [customFonts, setCustomFonts] = useState<string[]>(getCustomFonts())
  useEffect(() => subscribeFonts(() => setCustomFonts(getCustomFonts())), [])

  const insertImage = async () => {
    const img = await pickImageViaDialog(contentWidthPx)
    if (!img) return
    editor.chain().focus().setImage({ src: img.src, width: img.width, height: img.height }).run()
  }

  const exportItems: (MenuItem | 'sep' | { header: string })[] = [
    { label: 'Anleo document (.adoc)', onClick: () => onExport('adoc') },
    { label: 'Microsoft Word (.docx)', onClick: () => onExport('docx') },
    { label: 'PDF document (.pdf)', onClick: () => onExport('pdf') },
    { label: 'OpenDocument format (.odt)', onClick: () => onExport('odt') },
    { label: 'Plain text (.txt)', onClick: () => onExport('txt') },
    { label: 'Rich text format (.rtf)', onClick: () => onExport('rtf') },
    { label: 'Web page (.html)', onClick: () => onExport('html') },
    { label: 'Share as web page (.html)', onClick: () => onExport('living') },
    { label: 'EPUB publication (.epub)', onClick: () => onExport('epub') },
    { label: 'Markdown (.md)', onClick: () => onExport('md') },
    { label: 'Print…', onClick: () => onExport('print') },
    'sep',
    { header: 'Import' },
    { label: 'Word (.docx)…', icon: <IcImport />, onClick: () => onImport('docx') },
    { label: 'Markdown (.md)…', icon: <IcImport />, onClick: () => onImport('md') },
    { label: 'Web page (.html)…', icon: <IcImport />, onClick: () => onImport('html') },
    { label: 'Plain text (.txt)…', icon: <IcImport />, onClick: () => onImport('txt') },
  ]

  return (
    <div className="toolbar dx-toolbar">
      <button className="iconbtn" title="Undo" aria-label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <IcUndo />
      </button>
      <button className="iconbtn" title="Redo" aria-label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <IcRedo />
      </button>

      <ToolbarDivider />

      <Select
        value={currentBlockValue(editor)}
        onChange={(v) => applyBlockValue(editor, v)}
        width={132}
        options={[
          { value: 'paragraph', label: 'Normal text' },
          { value: 'h1', label: 'Heading 1' },
          { value: 'h2', label: 'Heading 2' },
          { value: 'h3', label: 'Heading 3' },
          { value: 'h4', label: 'Heading 4' },
          { value: 'blockquote', label: 'Quote' },
          { value: 'codeBlock', label: 'Code block' },
        ]}
      />

      <ChangeCaseMenu editor={editor} />

      <FontFamilyMenu
        value={currentFontDisplay(editor, customFonts)}
        onChange={(name) => editor.chain().focus().setFontFamily(cssFamily(name)).run()}
      />

      <Select
        value={currentFontSize(editor)}
        onChange={(v) => editor.chain().focus().setFontSize(`${v}px`).run()}
        width={64}
        options={FONT_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
      />

      <ToolbarDivider />

      <button className={'iconbtn' + (editor.isActive('bold') ? ' active' : '')} title="Bold" aria-label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
        <IcBold />
      </button>
      <button className={'iconbtn' + (editor.isActive('italic') ? ' active' : '')} title="Italic" aria-label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <IcItalic />
      </button>
      <button className={'iconbtn' + (editor.isActive('underline') ? ' active' : '')} title="Underline" aria-label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <IcUnderline />
      </button>
      <button className={'iconbtn' + (editor.isActive('strike') ? ' active' : '')} title="Strikethrough" aria-label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>
        <IcStrike />
      </button>

      <ColorPickerButton
        label="Text color"
        icon={<IcTextColor />}
        value={editor.getAttributes('textStyle').color as string | undefined}
        allowNone
        onPick={(c) => (c ? editor.chain().focus().setColor(c).run() : editor.chain().focus().unsetColor().run())}
      />
      <ColorPickerButton
        label="Highlight color"
        icon={<IcHighlight />}
        value={editor.getAttributes('highlight').color as string | undefined}
        allowNone
        onPick={(c) => (c ? editor.chain().focus().setHighlight({ color: c }).run() : editor.chain().focus().unsetHighlight().run())}
      />

      <button className={'iconbtn' + (editor.isActive('subscript') ? ' active' : '')} title="Subscript" aria-label="Subscript" onClick={() => editor.chain().focus().toggleSubscript().run()}>
        <IcSubscript />
      </button>
      <button className={'iconbtn' + (editor.isActive('superscript') ? ' active' : '')} title="Superscript" aria-label="Superscript" onClick={() => editor.chain().focus().toggleSuperscript().run()}>
        <IcSuperscript />
      </button>

      <ToolbarDivider />

      <button
        className={
          'iconbtn' +
          (editor.isActive({ textAlign: 'left' }) ||
          (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' }))
            ? ' active'
            : '')
        }
        title="Align left"
        aria-label="Align left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <IcAlignLeft />
      </button>
      <button className={'iconbtn' + (editor.isActive({ textAlign: 'center' }) ? ' active' : '')} title="Align center" aria-label="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <IcAlignCenter />
      </button>
      <button className={'iconbtn' + (editor.isActive({ textAlign: 'right' }) ? ' active' : '')} title="Align right" aria-label="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <IcAlignRight />
      </button>
      <button className={'iconbtn' + (editor.isActive({ textAlign: 'justify' }) ? ' active' : '')} title="Justify" aria-label="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <IcAlignJustify />
      </button>

      <Select
        value={currentLineHeight(editor)}
        onChange={(v) => setBlockLineHeight(editor, v)}
        width={92}
        options={LINE_HEIGHTS.map((l) => ({ value: l.value, label: l.label }))}
      />

      <ToolbarDivider />

      <button className={'iconbtn' + (editor.isActive('bulletList') ? ' active' : '')} title="Bulleted list" aria-label="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <IcBulletList />
      </button>
      <button className={'iconbtn' + (editor.isActive('orderedList') ? ' active' : '')} title="Numbered list" aria-label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <IcOrderedList />
      </button>
      <button className={'iconbtn' + (editor.isActive('taskList') ? ' active' : '')} title="Task list" aria-label="Task list" onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <IcTaskList />
      </button>
      <button className="iconbtn" title="Decrease indent" aria-label="Decrease indent" onClick={() => outdent(editor)}>
        <IcOutdent />
      </button>
      <button className="iconbtn" title="Increase indent" aria-label="Increase indent" onClick={() => indent(editor)}>
        <IcIndent />
      </button>

      <ToolbarDivider />

      <LinkPopover editor={editor} />
      <button className="iconbtn" title="Insert image" aria-label="Insert image" onClick={insertImage}>
        <IcImage />
      </button>
      <TableMenu editor={editor} />
      <button className="iconbtn" title="Insert horizontal rule" aria-label="Insert horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <IcHr />
      </button>
      <InsertMenu editor={editor} />
      <SpecialCharsMenu editor={editor} />
      <button className="iconbtn" title="Clear formatting" aria-label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <IcClearFormat />
      </button>

      <ToolbarDivider />

      <button className={'iconbtn' + (findOpen ? ' active' : '')} title="Find & replace (⌘F)" aria-label="Find & replace" onClick={onToggleFind}>
        <IcFind />
      </button>

      <Spacer />

      <AiButton active={aiOpen} onClick={onToggleAi} label="AI assistant" hint="⌘J" />
      <MenuButton trigger={<IcExport />} label="Export & import" align="right" items={exportItems} />
    </div>
  )
}
