// AI deck builder modal: topic/outline -> streamed JSON outline -> review -> apply.
// Never sends anything until the user clicks Generate; always names OpenRouter.

import React, { useEffect, useRef, useState } from 'react'
import { AiError, aiComplete, isAiConfigured, loadAiSettings, stripFence, subscribeAi } from '../../shared/ai'
import { Button, Modal, Select } from '../../shared/ui'
import { AiSettingsControl } from '../../shared/AiSettings'
import { IcSparkle } from './icons'
import { buildAiSystemPrompt, sanitizeAiOutline, type AiOutlineSlide } from './aiDeck'

const SLIDE_COUNTS = [4, 6, 8, 10]
const TONES = ['Professional', 'Casual', 'Persuasive', 'Inspirational', 'Technical']

export function AiDeckModal({
  onClose,
  onApply,
}: {
  onClose: () => void
  onApply: (slides: AiOutlineSlide[], mode: 'replace' | 'append') => void
}) {
  const [configured, setConfigured] = useState(isAiConfigured())
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(6)
  const [tone, setTone] = useState('Professional')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiOutlineSlide[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => subscribeAi(() => setConfigured(isAiConfigured())), [])
  // isAiConfigured() reads a module-level cache that's only populated by an
  // earlier loadAiSettings() call elsewhere in the app — force a load here so
  // opening this modal first still shows the right state (not just changes
  // made while it's open).
  useEffect(() => {
    void loadAiSettings().then(() => setConfigured(isAiConfigured()))
  }, [])

  async function generate() {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const text = await aiComplete({
        system: buildAiSystemPrompt(count, tone),
        prompt: topic.trim(),
        signal: controller.signal,
        maxTokens: Math.min(4000, 300 * count + 500),
        onToken: (t) => setProgress((p) => p + t),
      })
      let parsed: unknown
      try {
        parsed = JSON.parse(stripFence(text))
      } catch {
        setError('The model returned an unexpected format — try again.')
        return
      }
      const outline = sanitizeAiOutline(parsed)
      if (!outline) {
        setError('The model returned an unexpected format — try again.')
        return
      }
      setResult(outline)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // user cancelled — no error banner
      } else if (err instanceof AiError) {
        setError(err.message)
      } else {
        setError('Something went wrong.')
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  return (
    <Modal title="AI deck builder" onClose={onClose} width={520}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, marginTop: -6 }}>
        <AiSettingsControl />
      </div>
      {!configured ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
            Add an OpenRouter API key in Settings to use AI features.
          </p>
          <Button variant="outline" onClick={onClose} style={{ alignSelf: 'flex-end' }}>
            Close
          </Button>
        </div>
      ) : !result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            className="px-ai-textarea"
            value={topic}
            disabled={busy}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic or rough outline, e.g. “Quarterly sales review for the Northeast region — wins, misses, next quarter plan”"
            rows={5}
          />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)' }}>
              Slides
              <Select
                value={String(count)}
                onChange={(v) => setCount(Number(v))}
                width={64}
                options={SLIDE_COUNTS.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)' }}>
              Tone
              <Select value={tone} onChange={setTone} width={140} options={TONES.map((t) => ({ value: t, label: t }))} />
            </label>
          </div>
          <div className="px-ai-privacy">
            <IcSparkle /> Sends the topic/outline text above to OpenRouter.
          </div>
          {error && <div className="px-ai-error">{error}</div>}
          {busy && (
            <div className="px-ai-progress">{progress || 'Thinking…'}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {busy ? (
              <Button variant="outline" onClick={cancel}>
                Cancel
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={generate} disabled={!topic.trim()}>
                  Generate
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{result.length} slides drafted from your topic.</div>
          <div className="px-ai-review">
            {result.map((s, i) => (
              <div key={i} className="px-ai-review-slide">
                <div className="px-ai-review-title">
                  {i + 1}. {s.title}
                </div>
                <ul>
                  {s.bullets.map((b, bi) => (
                    <li key={bi}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={() => setResult(null)}>
              Back
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={() => onApply(result, 'append')}>
                Append slides
              </Button>
              <Button variant="primary" onClick={() => onApply(result, 'replace')}>
                Replace deck
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
