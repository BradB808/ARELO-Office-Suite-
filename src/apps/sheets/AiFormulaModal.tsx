// AI formula assistant: "Describe → formula" turns a plain-English request
// into one spreadsheet formula, and "Explain" describes the active cell's
// formula in plain English. Both are opt-in (button click) and both send
// data to OpenRouter — see the privacy line in each tab.

import React, { useEffect, useRef, useState } from 'react'
import { Modal, Button, Segmented } from '../../shared/ui'
import { isAiConfigured, aiComplete, loadAiSettings, stripFence, subscribeAi, AiError } from '../../shared/ai'
import { AiSettingsControl } from '../../shared/AiSettings'

type Tab = 'describe' | 'explain'

export default function AiFormulaModal({
  activeRef,
  headerRow,
  activeFormula,
  onInsert,
  onClose,
}: {
  activeRef: string
  headerRow: string[]
  activeFormula?: string
  onInsert: (formula: string) => void
  onClose: () => void
}) {
  const [configured, setConfigured] = useState(isAiConfigured())
  const [tab, setTab] = useState<Tab>('describe')
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState('')
  const [explanation, setExplanation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Picks up a key added in Settings while this modal is already open.
  useEffect(() => subscribeAi(() => setConfigured(isAiConfigured())), [])
  // isAiConfigured() reads a module-level cache that's only populated by an
  // explicit loadAiSettings() call. If this modal is the first AI surface
  // touched this session (Settings was never opened), the cache can still be
  // empty at mount even though a key was saved in an earlier session —
  // subscribeAi only fires on save, not on load. Loading here keeps this
  // modal honest on its own, regardless of what else has run this session.
  useEffect(() => {
    void loadAiSettings().then(() => setConfigured(isAiConfigured()))
  }, [])

  // The Cancel buttons abort explicitly, but the modal can also go away via the
  // backdrop, Escape (both call onClose directly — see shared/ui Modal), or the
  // host switching documents out from under it. Without this, an in-flight
  // OpenRouter stream keeps running and calling setState on an unmounted
  // component instead of being cut off.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }

  async function runDescribe() {
    const task = prompt.trim()
    if (!task) return
    setBusy(true)
    setError(null)
    setResult('')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const headerCtx = headerRow.length ? `Header row: ${headerRow.join(', ')}.` : 'This sheet has no header row.'
      let acc = ''
      const out = await aiComplete({
        system:
          'You write exactly one Anleo Sheets formula (Excel-style syntax). ' +
          'Reply with ONLY the formula text, starting with "=". No explanation, no markdown code fences, no commentary — raw formula only.',
        prompt: `${headerCtx}\nActive cell: ${activeRef}.\nTask: ${task}`,
        signal: ac.signal,
        maxTokens: 200,
        onToken: (t) => {
          acc += t
          setResult(acc)
        },
      })
      setResult(stripFence(out))
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof AiError ? err.message : 'Something went wrong')
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  async function runExplain() {
    if (!activeFormula) return
    setBusy(true)
    setError(null)
    setExplanation('')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      let acc = ''
      await aiComplete({
        system:
          'Explain what a spreadsheet formula does, in one or two short plain-English sentences. ' +
          'No markdown, no restating the formula verbatim, no preamble.',
        prompt: `Cell ${activeRef} contains: ${activeFormula}`,
        signal: ac.signal,
        maxTokens: 200,
        onToken: (t) => {
          acc += t
          setExplanation(acc)
        },
      })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof AiError ? err.message : 'Something went wrong')
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <Modal title="AI formula assistant" onClose={onClose} width={380}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, marginTop: -6 }}>
        <AiSettingsControl />
      </div>
      {!configured ? (
        <div className="empty-hint" style={{ padding: '18px 4px' }}>
          Add an OpenRouter API key in Settings to use AI features.
        </div>
      ) : (
        <>
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { value: 'describe', label: 'Describe → formula' },
              { value: 'explain', label: 'Explain' },
            ]}
          />

          {tab === 'describe' ? (
            <div style={{ marginTop: 12 }}>
              <div className="sx-ai-privacy">Sends your prompt and this sheet's header row to OpenRouter.</div>
              <textarea
                className="textfield sx-ai-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. sum sales in B where region in A is West"
                rows={3}
                disabled={busy}
              />
              <div className="sx-ai-actions">
                <Button variant="primary" small disabled={busy || !prompt.trim()} onClick={runDescribe}>
                  {busy ? 'Thinking…' : 'Generate'}
                </Button>
                {busy && (
                  <Button variant="outline" small onClick={stop}>
                    Cancel
                  </Button>
                )}
              </div>
              {error && <div className="sx-ai-error">{error}</div>}
              {result && (
                <>
                  <div className="sx-ai-formula">{result}</div>
                  <div className="sx-ai-actions">
                    <Button
                      variant="primary"
                      small
                      onClick={() => {
                        onInsert(result)
                        onClose()
                      }}
                    >
                      Insert into {activeRef}
                    </Button>
                    <Button variant="outline" small onClick={() => navigator.clipboard?.writeText(result).catch(() => {})}>
                      Copy
                    </Button>
                    <Button variant="outline" small onClick={onClose}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="sx-ai-privacy">Sends this cell's formula to OpenRouter.</div>
              {!activeFormula ? (
                <div className="empty-hint" style={{ padding: '14px 4px' }}>
                  Select a cell containing a formula to explain it.
                </div>
              ) : (
                <>
                  <div className="sx-ai-formula">
                    {activeRef}: {activeFormula}
                  </div>
                  <div className="sx-ai-actions">
                    <Button variant="primary" small disabled={busy} onClick={runExplain}>
                      {busy ? 'Thinking…' : 'Explain'}
                    </Button>
                    {busy && (
                      <Button variant="outline" small onClick={stop}>
                        Cancel
                      </Button>
                    )}
                  </div>
                  {error && <div className="sx-ai-error">{error}</div>}
                  {explanation && <div className="sx-ai-explanation">{explanation}</div>}
                </>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
