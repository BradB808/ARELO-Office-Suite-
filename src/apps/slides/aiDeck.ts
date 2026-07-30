// AI deck builder: prompt construction, response sanitizing, and turning a
// generated outline into real slides using the current theme + layout helpers.

import type { Slide, SlideElement, SlidesTheme } from '../../shared/types'
import { uid } from '../../shared/types'
import { getLayout } from './layouts'

export interface AiOutlineSlide {
  title: string
  bullets: string[]
  notes?: string
}

/** Strict, short system prompt: raw JSON only, no preamble, no markdown fences. */
export function buildAiSystemPrompt(count: number, tone: string): string {
  return [
    'You write presentation outlines for a slide deck.',
    'Output ONLY raw JSON — no markdown fences, no commentary, no leading or trailing text.',
    'Schema: {"slides":[{"title":string,"bullets":string[],"notes":string}]}',
    `Produce exactly ${count} slide objects, in the "slides" array, in presentation order.`,
    'Each "title" is plain text, at most 60 characters, no trailing punctuation.',
    'Each slide has 3 to 5 "bullets", each at most 90 characters, plain text with no leading dashes, bullet characters, or numbering.',
    '"notes" is 1-2 sentences of speaker guidance for that slide.',
    `Tone: ${tone}.`,
    'Return nothing except the JSON object.',
  ].join(' ')
}

/** Validates + coerces a parsed AI response into a safe outline, or null when unusable. */
export function sanitizeAiOutline(raw: unknown): AiOutlineSlide[] | null {
  const obj = raw as { slides?: unknown } | null
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.slides) || !obj.slides.length) return null
  const slides: AiOutlineSlide[] = obj.slides.map((s) => {
    const rec = (s ?? {}) as Record<string, unknown>
    const title = typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim().slice(0, 120) : 'Untitled slide'
    const bullets = Array.isArray(rec.bullets)
      ? rec.bullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).map((b) => b.trim().slice(0, 200)).slice(0, 8)
      : []
    const notes = typeof rec.notes === 'string' ? rec.notes.trim().slice(0, 600) : ''
    return { title, bullets, notes }
  })
  return slides.length ? slides : null
}

/**
 * Builds real Slide objects: the first item becomes a Title layout slide, the
 * rest become Title+content layout slides with bullets:true text + speaker notes.
 * Uses the CURRENT theme so colors/fonts match the rest of the deck.
 */
export function buildSlidesFromOutline(outline: AiOutlineSlide[], theme: SlidesTheme): Slide[] {
  return outline.map((item, i) => {
    const layout = getLayout(i === 0 ? 'title' : 'title-content')
    const built = layout.build(theme)
    const elements: SlideElement[] = built.elements.map((el, idx) => {
      if (el.kind !== 'text') return el
      if (i === 0) {
        // Title layout: [0] = title, [1] = subtitle.
        return { ...el, text: idx === 0 ? item.title : item.bullets[0] || item.notes || '' }
      }
      // Title+content layout: the bulleted text element is the content body.
      if (el.bullets) return { ...el, text: item.bullets.length ? item.bullets.join('\n') : item.title }
      return { ...el, text: item.title }
    })
    return { id: uid(), elements, background: built.background, notes: item.notes || '' }
  })
}
