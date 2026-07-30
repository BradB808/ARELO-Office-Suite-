// AI settings, reachable from two places with one implementation:
//   • the app Settings dialog (AiSettingsFields)
//   • directly inside any AI panel (AiSettingsControl → AiSettingsModal)
// so the key and model can always be changed from where you are working.

import React, { useEffect, useState } from 'react'
import { Modal, Select, Button } from './ui'
import {
  AI_MODELS,
  DEFAULT_MODEL,
  getAiSettings,
  loadAiSettings,
  setAiSettings,
  subscribeAi,
} from './ai'

function modelLabel(id: string | undefined): string {
  return AI_MODELS.find((m) => m.id === (id || DEFAULT_MODEL))?.label ?? 'Choose a model'
}

/** The key + model fields, without any dialog chrome. */
export function AiSettingsFields({ onChanged }: { onChanged?: () => void }) {
  const [key, setKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [reveal, setReveal] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    loadAiSettings().then((s) => {
      setKey(s.apiKey ?? '')
      setModel(s.model ?? DEFAULT_MODEL)
    })
  }, [])

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 1800)
  }

  const persist = async (next: { apiKey?: string; model?: string }, msg: string) => {
    await setAiSettings(next)
    flash(msg)
    onChanged?.()
  }

  const hasKey = key.trim().length > 0

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 14 }}>
        AI features use your own <strong>OpenRouter</strong> account. The key is stored only on this
        Mac; text you send with an AI action goes to OpenRouter. Remove the key to keep Anleo fully
        offline.
      </div>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 5 }}>
        OpenRouter API key
      </label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          className="textfield"
          type={reveal ? 'text' : 'password'}
          placeholder="sk-or-v1-…"
          value={key}
          spellCheck={false}
          onChange={(e) => setKey(e.target.value)}
          onBlur={() => key.trim() !== (getAiSettings().apiKey ?? '') && persist({ apiKey: key.trim() }, 'Key saved.')}
        />
        <Button small onClick={() => setReveal((r) => !r)}>
          {reveal ? 'Hide' : 'Show'}
        </Button>
        <Button small variant="outline" onClick={() => persist({ apiKey: key.trim() }, 'Key saved.')}>
          Save
        </Button>
      </div>
      {hasKey && (
        <div style={{ marginBottom: 14 }}>
          <Button
            small
            variant="danger"
            onClick={() => {
              setKey('')
              persist({ apiKey: '' }, 'Key removed — AI is off.')
            }}
          >
            Remove key
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 12.5 }}>Model</span>
        <Select
          value={model}
          width={240}
          onChange={(v) => {
            setModel(v)
            persist({ model: v }, 'Model changed.')
          }}
          options={AI_MODELS.map((m) => ({ value: m.id, label: `${m.label} — ${m.note}` }))}
        />
      </div>

      <div
        style={{
          fontSize: 11.5,
          color: status ? 'var(--ok)' : 'var(--text-3)',
          marginTop: 10,
          minHeight: 16,
        }}
      >
        {status ?? (hasKey ? 'AI features are enabled.' : 'Get a key at openrouter.ai — pay only for what you use.')}
      </div>
    </div>
  )
}

/** Standalone dialog — used by the in-panel settings button. */
export function AiSettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="AI settings" subtitle="Change your OpenRouter key or switch models." onClose={onClose} width={480}>
      <AiSettingsFields />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  )
}

function IcGear() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2.9l1 1.8 2.1-.4.9 1.9 2 .5-.4 2.1 1.4 1.5-1.4 1.5.4 2.1-2 .5-.9 1.9-2.1-.4-1 1.8-1-1.8-2.1.4-.9-1.9-2-.5.4-2.1L2.6 10 4 8.5l-.4-2.1 2-.5.9-1.9 2.1.4 1-1.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Shows the model currently in use and opens AI settings — drop this into any
 * AI panel header so the key and model are always one click away.
 */
export function AiSettingsControl() {
  const [, force] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeAi(() => force((n) => n + 1)), [])
  useEffect(() => {
    loadAiSettings().then(() => force((n) => n + 1))
  }, [])

  const settings = getAiSettings()

  return (
    <>
      <button
        className="ai-settings-chip"
        title="AI settings — change model or API key"
        onClick={() => setOpen(true)}
      >
        <span className="ai-settings-model">{modelLabel(settings.model)}</span>
        <IcGear />
      </button>
      {open && <AiSettingsModal onClose={() => setOpen(false)} />}
    </>
  )
}
