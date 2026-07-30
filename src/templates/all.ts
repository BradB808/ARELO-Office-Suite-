// Combined template pool + category helpers for the hub and gallery.

import type { AppKind, Template } from '../shared/types'
import { docsTemplates } from './docs'
import { docsCareerTemplates } from './docs-career'
import { docsBusinessTemplates } from './docs-business'
import { sheetsTemplates } from './sheets'
import { sheetsFinanceTemplates } from './sheets-finance'
import { sheetsPlanningTemplates } from './sheets-planning'
import { slidesTemplates } from './slides'
import { slidesBusinessTemplates } from './slides-business'
import { slidesCreativeTemplates } from './slides-creative'

export interface PoolEntry {
  kind: AppKind
  tpl: Template
}

export const templatePool: PoolEntry[] = [
  ...[...docsTemplates, ...docsCareerTemplates, ...docsBusinessTemplates].map((tpl) => ({
    kind: 'docs' as AppKind,
    tpl: tpl as Template,
  })),
  ...[...sheetsTemplates, ...sheetsFinanceTemplates, ...sheetsPlanningTemplates].map((tpl) => ({
    kind: 'sheets' as AppKind,
    tpl: tpl as Template,
  })),
  ...[...slidesTemplates, ...slidesBusinessTemplates, ...slidesCreativeTemplates].map((tpl) => ({
    kind: 'slides' as AppKind,
    tpl: tpl as Template,
  })),
]

/** Preferred chip order; anything unexpected sorts to the end alphabetically. */
const CATEGORY_ORDER = [
  'Career',
  'Letters',
  'Business',
  'Marketing',
  'Finance',
  'Education',
  'Personal',
  'Events',
  'Creative',
]

export function categoriesWithCounts(entries: PoolEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.tpl.category, (counts.get(e.tpl.category) ?? 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.name)
      const ib = CATEGORY_ORDER.indexOf(b.name)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.name.localeCompare(b.name)
    })
}

export function searchTemplates(
  entries: PoolEntry[],
  opts: { kind?: AppKind | 'all'; category?: string | 'all'; query?: string },
): PoolEntry[] {
  const q = (opts.query ?? '').trim().toLowerCase()
  return entries.filter((e) => {
    if (opts.kind && opts.kind !== 'all' && e.kind !== opts.kind) return false
    if (opts.category && opts.category !== 'all' && e.tpl.category !== opts.category) return false
    if (q) {
      const hay = (e.tpl.name + ' ' + e.tpl.description + ' ' + e.tpl.category).toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Interleave docs/sheets/slides so mixed rows feel varied. */
export function interleaveByKind(entries: PoolEntry[]): PoolEntry[] {
  const by: Record<string, PoolEntry[]> = { docs: [], sheets: [], slides: [] }
  entries.forEach((e) => by[e.kind].push(e))
  const out: PoolEntry[] = []
  for (let i = 0; i < Math.max(by.docs.length, by.sheets.length, by.slides.length); i++) {
    if (by.docs[i]) out.push(by.docs[i])
    if (by.sheets[i]) out.push(by.sheets[i])
    if (by.slides[i]) out.push(by.slides[i])
  }
  return out
}
