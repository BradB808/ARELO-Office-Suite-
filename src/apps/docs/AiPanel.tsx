// Right-hand AI slide-over panel: preset rewrite modes + a free-form
// instruction box. Acts on the current editor selection, or the whole
// document when the selection is empty — the source label always says which.
// Streams into a local preview; nothing touches the document until the user
// picks Replace or Insert (each a single, one-undo-step command). Privacy:
// this is the only surface in Docs that sends anything off the machine, so
// the note naming OpenRouter is always visible while the panel is usable.

import React, { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { aiComplete, isAiConfigured, loadAiSettings, stripFence, subscribeAi, AiError } from '../../shared/ai'
import { getCommands } from '../../shared/commands'
import { Button, Select } from '../../shared/ui'
import { IcClose } from '../../shared/icons'
import { AiSettingsControl, AiSettingsModal } from '../../shared/AiSettings'
import { IcSparkle } from './icons'

type Mode = 'improve' | 'shorter' | 'longer' | 'tone' | 'summarize' | 'continue' | 'grammar'

const TONES = ['Professional', 'Casual', 'Confident', 'Friendly']

const MODES: { id: Mode; label: string; maxTokens: number }[] = [
  { id: 'improve', label: 'Improve writing', maxTokens: 1300 },
  { id: 'shorter', label: 'Make shorter', maxTokens: 700 },
  { id: 'longer', label: 'Make longer', maxTokens: 1600 },
  { id: 'tone', label: 'Change tone', maxTokens: 1300 },
  { id: 'summarize', label: 'Summarize', maxTokens: 500 },
  { id: 'continue', label: 'Continue writing', maxTokens: 700 },
  { id: 'grammar', label: 'Fix spelling & grammar', maxTokens: 1300 },
]

function systemFor(mode: Mode, tone: string): string {
  switch (mode) {
    case 'improve':
      return 'You are an expert editor embedded in a word processor. Rewrite the given text to improve clarity, flow, and word choice, keeping its meaning and roughly the same length. Reply with only the rewritten text — no preamble, no quotes, no commentary.'
    case 'shorter':
      return 'You are an expert editor. Rewrite the given text to be noticeably more concise while keeping its key meaning. Reply with only the rewritten text — no preamble, no quotes, no commentary.'
    case 'longer':
      return 'You are an expert editor. Expand the given text with more supporting detail, in the same voice and tone. Reply with only the rewritten text — no preamble, no quotes, no commentary.'
    case 'tone':
      return `You are an expert editor. Rewrite the given text in a ${tone.toLowerCase()} tone, keeping its meaning. Reply with only the rewritten text — no preamble, no quotes, no commentary.`
    case 'summarize':
      return 'You are an expert editor. Summarize the given text, keeping only the key points, as tightly as possible. Reply with only the summary — no preamble, no quotes, no commentary.'
    case 'continue':
      return 'You are a skilled writer continuing a document. Continue the given text naturally, in the same voice, style, and tense, picking up exactly where it stops. Reply with only the new continuation — no preamble, no quotes, no commentary, and do not repeat any of the given text.'
    case 'grammar':
      return 'You are a meticulous proofreader. Fix all spelling, grammar, and punctuation mistakes in the given text without changing its meaning, tone, or style. Reply with only the corrected text — no preamble, no quotes, no commentary.'
  }
}

const CUSTOM_SYSTEM =
  'You are a writing assistant embedded in a word processor. Follow the instruction exactly and apply it to the given text. Reply with only the resulting text — no preamble, no quotes, no commentary.'

/** Plain AI output -> paragraph/hardBreak JSON, so blank-line breaks become
 *  real paragraphs instead of one run-on block when inserted into the doc. */
function textToContent(text: string): JSONContent[] {
  const paras = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!paras.length) return [{ type: 'paragraph' }]
  return paras.map((p) => {
    const lines = p.split('\n')
    const content: JSONContent[] = []
    lines.forEach((line, i) => {
      if (i > 0) content.push({ type: 'hardBreak' })
      if (line) content.push({ type: 'text', text: line })
    })
    return { type: 'paragraph', ...(content.length ? { content } : {}) }
  })
}

interface Source {
  text: string
  label: string
  range: { from: number; to: number } | null
}

function selectionSource(editor: Editor): Source {
  const { from, to, empty } = editor.state.selection
  if (empty) {
    return { text: editor.getText({ blockSeparator: '\n\n' }), label: 'Whole document', range: null }
  }
  const text = editor.state.doc.textBetween(from, to, '\n')
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return { text, label: `Selection · ${words} word${words === 1 ? '' : 's'}`, range: { from, to } }
}

function openSettings() {
  getCommands()
    .find((c) => c.id === 'settings')
    ?.run()
}

export function AiPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [configured, setConfigured] = useState(isAiConfigured())
  const [keySetupOpen, setKeySetupOpen] = useState(false)
  const [tone, setTone] = useState(TONES[0])
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => subscribeAi(() => setConfigured(isAiConfigured())), [])
  // isAiConfigured() reads a module-level cache that's only populated by an
  // explicit loadAiSettings() call (Settings does this on mount, but only
  // *while it's open* — subscribeAi only fires on save, not on load). A key
  // saved in an earlier session would otherwise leave this panel stuck
  // showing "not configured" for the whole session until the user reopens
  // Settings and re-saves. Loading here — regardless of whether Settings has
  // ever been opened this session — keeps this panel honest on its own.
  useEffect(() => {
    void loadAiSettings().then(() => setConfigured(isAiConfigured()))
  }, [])
  useEffect(() => () => abortRef.current?.abort(), [])

  const start = (src: Source, label: string) => {
    setError(null)
    setPreview('')
    setActiveLabel(label)
    setSource(src)
    setBusy(true)
  }

  const finish = () => {
    setBusy(false)
    abortRef.current = null
  }

  const runMode = async (mode: Mode) => {
    if (busy) return
    const src = selectionSource(editor)
    if (!src.text.trim()) {
      setError('There is no text to work with yet.')
      return
    }
    const label = mode === 'tone' ? `Change tone · ${tone}` : MODES.find((m) => m.id === mode)!.label
    start(src, label)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await aiComplete({
        system: systemFor(mode, tone),
        prompt: src.text,
        maxTokens: MODES.find((m) => m.id === mode)!.maxTokens,
        signal: controller.signal,
        onToken: (t) => setPreview((p) => p + t),
      })
      setPreview(stripFence(result))
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof AiError ? err.message : 'Something went wrong.')
      }
    } finally {
      finish()
    }
  }

  const runCustom = async () => {
    if (busy) return
    const text = instruction.trim()
    if (!text) return
    const src = selectionSource(editor)
    if (!src.text.trim()) {
      setError('There is no text to work with yet.')
      return
    }
    start(src, `“${text}”`)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await aiComplete({
        system: CUSTOM_SYSTEM,
        prompt: `Instruction: ${text}\n\nText:\n${src.text}`,
        maxTokens: 1400,
        signal: controller.signal,
        onToken: (t) => setPreview((p) => p + t),
      })
      setPreview(stripFence(result))
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof AiError ? err.message : 'Something went wrong.')
      }
    } finally {
      finish()
    }
  }

  const reset = () => {
    setPreview('')
    setActiveLabel(null)
    setSource(null)
    setError(null)
  }

  const cancel = () => {
    if (busy) {
      abortRef.current?.abort()
      finish()
      return
    }
    reset()
  }

  const applyReplace = () => {
    if (!preview.trim() || !source) return
    const content = textToContent(preview)
    if (source.range) editor.chain().focus().insertContentAt(source.range, content).run()
    else editor.chain().focus().insertContentAt({ from: 0, to: editor.state.doc.content.size }, content).run()
    reset()
  }

  const applyInsertBelow = () => {
    if (!preview.trim() || !source) return
    const content = textToContent(preview)
    const at = source.range ? source.range.to : editor.state.doc.content.size
    editor.chain().focus().insertContentAt(at, content).run()
    reset()
  }

  const applyCopy = () => {
    if (!preview.trim()) return
    void navigator.clipboard?.writeText(preview)
  }

  const showResult = busy || !!source
  const liveSource = !showResult ? selectionSource(editor) : null

  return (
    <div className="dx-ai-panel">
      <div className="dx-ai-head">
        {/* Short title: the model chip beside it carries the detail, and a
            longer phrase truncates awkwardly in the fixed-width panel. */}
        <span className="dx-ai-title">
          <IcSparkle /> AI
        </span>
        <div style={{ flex: 1 }} />
        <AiSettingsControl />
        <button className="iconbtn" title="Close AI panel" aria-label="Close AI panel" onClick={onClose}>
          <IcClose />
        </button>
      </div>

      {keySetupOpen && <AiSettingsModal onClose={() => setKeySetupOpen(false)} />}

      <div className="dx-ai-privacy">Sends the selected text to OpenRouter when you use a tool below.</div>

      {!configured ? (
        <div className="dx-ai-empty">
          <IcSparkle />
          <p>Add an OpenRouter API key to turn on AI writing help.</p>
          <Button variant="outline" small onClick={() => setKeySetupOpen(true)}>
            Add API key
          </Button>
        </div>
      ) : !showResult ? (
        <div className="dx-ai-body">
          <div className="dx-ai-source">Works on: {liveSource?.label}</div>

          <div className="dx-ai-modes">
            {MODES.map((m) =>
              m.id === 'tone' ? (
                <div key={m.id} className="dx-ai-tone-row">
                  <button className="dx-ai-mode-btn" onClick={() => void runMode('tone')}>
                    Change tone
                  </button>
                  <Select compact value={tone} onChange={setTone} width={118} options={TONES.map((t) => ({ value: t, label: t }))} />
                </div>
              ) : (
                <button key={m.id} className="dx-ai-mode-btn" onClick={() => void runMode(m.id)}>
                  {m.label}
                </button>
              ),
            )}
          </div>

          <div className="dx-ai-custom">
            <textarea
              className="dx-ai-textarea"
              placeholder="Or tell the AI what to do…"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void runCustom()
                }
              }}
              rows={3}
            />
            <Button variant="primary" small onClick={() => void runCustom()} disabled={!instruction.trim()}>
              Generate
            </Button>
          </div>

          {error && <div className="dx-ai-error">{error}</div>}
        </div>
      ) : (
        <div className="dx-ai-result">
          <div className="dx-ai-source">
            {activeLabel}
            {source ? ` · ${source.label}` : ''}
          </div>
          <div className="dx-ai-preview">
            {preview}
            {busy && <span className="dx-ai-caret" />}
          </div>
          {error && <div className="dx-ai-error">{error}</div>}
          <div className="dx-ai-actions">
            <Button variant="outline" small onClick={cancel}>
              Cancel
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="soft" small disabled={busy || !preview.trim()} onClick={applyCopy}>
              Copy
            </Button>
            <Button variant="soft" small disabled={busy || !preview.trim()} onClick={applyInsertBelow}>
              Insert below
            </Button>
            <Button variant="primary" small disabled={busy || !preview.trim()} onClick={applyReplace}>
              {source?.range ? 'Replace selection' : 'Replace document'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
