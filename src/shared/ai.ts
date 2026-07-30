// Optional AI assistance via OpenRouter (bring your own key).
//
// PRIVACY: everything else in Anleo is fully offline. These calls are the one
// exception — the text you send is transmitted to OpenRouter. The feature is
// off until the user enters a key, and every surface that uses it says so.

import { platform } from './platform'

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface AiSettings {
  apiKey?: string
  model?: string
}

export const AI_MODELS: { id: string; label: string; note: string }[] = [
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', note: 'Best writing quality' },
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', note: 'Fast and cheap' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 mini', note: 'Fast, low cost' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Very fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', note: 'Open model' },
]

export const DEFAULT_MODEL = AI_MODELS[0].id

let cached: AiSettings | null = null
const listeners = new Set<() => void>()

export function subscribeAi(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * The model preference is an ordinary setting; the key is a credential and
 * comes from encrypted storage, so the two are loaded from different places
 * and only joined together here in memory.
 */
export async function loadAiSettings(): Promise<AiSettings> {
  if (cached) return cached
  const stored = (await platform.storeGet<{ model?: string }>('ai')) ?? {}
  const apiKey = await platform.secretGet()
  cached = { model: stored.model, apiKey: apiKey || undefined }
  return cached
}

export function getAiSettings(): AiSettings {
  return cached ?? {}
}

export async function setAiSettings(next: AiSettings): Promise<void> {
  cached = { ...cached, ...next }
  if ('apiKey' in next) {
    // Writing an empty key also closes the network gate in the main process.
    await platform.secretSet(next.apiKey ?? '')
  }
  if ('model' in next) {
    await platform.storeSet('ai', { model: cached.model })
  }
  listeners.forEach((cb) => cb())
}

export function isAiConfigured(): boolean {
  return !!getAiSettings().apiKey
}

export interface AiRequestInit {
  system: string
  prompt: string
  model?: string
  apiKey: string
  maxTokens?: number
}

/** Pure request builder — unit-testable without touching the network. */
export function buildAiRequest(init: AiRequestInit): { url: string; options: RequestInit } {
  return {
    url: OPENROUTER_URL,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${init.apiKey}`,
        'HTTP-Referer': 'https://anleo.local',
        'X-Title': 'Anleo Office',
      },
      body: JSON.stringify({
        model: init.model || DEFAULT_MODEL,
        stream: true,
        max_tokens: init.maxTokens ?? 1400,
        messages: [
          { role: 'system', content: init.system },
          { role: 'user', content: init.prompt },
        ],
      }),
    },
  }
}

/** Parses one SSE chunk into content deltas. Exported for tests. */
export function parseSseChunk(chunk: string): { deltas: string[]; done: boolean } {
  const deltas: string[] = []
  let done = false
  for (const rawLine of chunk.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload === '[DONE]') {
      done = true
      continue
    }
    try {
      const obj = JSON.parse(payload)
      const delta = obj?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) deltas.push(delta)
    } catch {
      // Partial JSON across chunk boundaries — the caller buffers and retries.
    }
  }
  return { deltas, done }
}

export class AiError extends Error {}

export interface AiRunOptions {
  system: string
  prompt: string
  onToken?: (text: string) => void
  signal?: AbortSignal
  maxTokens?: number
}

/** Streams a completion. Throws AiError with a human-readable message. */
export async function aiComplete(opts: AiRunOptions): Promise<string> {
  const settings = await loadAiSettings()
  if (!settings.apiKey) {
    throw new AiError('Add an OpenRouter API key in Settings to use AI features.')
  }

  const { url, options } = buildAiRequest({
    system: opts.system,
    prompt: opts.prompt,
    apiKey: settings.apiKey,
    model: settings.model,
    maxTokens: opts.maxTokens,
  })

  let res: Response
  try {
    res = await fetch(url, { ...options, signal: opts.signal })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new AiError('Could not reach OpenRouter. Check your internet connection.')
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401) throw new AiError('OpenRouter rejected the API key. Check it in Settings.')
    if (res.status === 402) throw new AiError('Your OpenRouter account is out of credit.')
    if (res.status === 429) throw new AiError('Rate limited by OpenRouter — try again in a moment.')
    throw new AiError(`OpenRouter error ${res.status}. ${body.slice(0, 160)}`)
  }

  if (!res.body) throw new AiError('OpenRouter returned an empty response.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let out = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Process only complete SSE events; keep any partial tail buffered.
    const lastBreak = buffer.lastIndexOf('\n')
    if (lastBreak === -1) continue
    const ready = buffer.slice(0, lastBreak)
    buffer = buffer.slice(lastBreak + 1)
    const { deltas, done: finished } = parseSseChunk(ready)
    for (const d of deltas) {
      out += d
      opts.onToken?.(d)
    }
    if (finished) break
  }
  if (buffer.trim()) {
    const { deltas } = parseSseChunk(buffer)
    for (const d of deltas) {
      out += d
      opts.onToken?.(d)
    }
  }

  if (!out.trim()) throw new AiError('The model returned nothing. Try again or pick another model.')
  return out
}

/** Strips markdown code fences the models like to wrap answers in. */
export function stripFence(text: string): string {
  const trimmed = text.trim()
  const m = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/)
  return (m ? m[1] : trimmed).trim()
}
