// Full-screen Canva-style template browser: search, kind filter, category chips.

import React, { useMemo, useState } from 'react'
import type { AppKind, Template } from '../shared/types'
import { Segmented } from '../shared/ui'
import { IcChevronL, IcSearch } from '../shared/icons'
import { templatePool, categoriesWithCounts, searchTemplates, interleaveByKind } from '../templates/all'
import { TemplateCard } from './TemplateCard'

export function TemplateGallery({
  onNew,
  goHome,
}: {
  onNew: (kind: AppKind, template?: Template) => void
  goHome: () => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | AppKind>('all')
  const [category, setCategory] = useState<string>('all')

  // Chips reflect the kind filter (so counts stay honest) but not the query.
  const chipSource = useMemo(
    () => searchTemplates(templatePool, { kind, category: 'all', query: '' }),
    [kind],
  )
  const chips = useMemo(() => categoriesWithCounts(chipSource), [chipSource])

  const results = useMemo(() => {
    const found = searchTemplates(templatePool, { kind, category, query })
    return kind === 'all' && category === 'all' && !query.trim() ? interleaveByKind(found) : found
  }, [kind, category, query])

  return (
    <div className="hub gallery">
      <div className="hub-inner wide">
        <div className="gallery-head">
          <button className="iconbtn" title="Back to home" onClick={goHome}>
            <IcChevronL />
          </button>
          <h1>Templates</h1>
          <span className="gallery-count">{templatePool.length} designs · all free</span>
          <div style={{ flex: 1 }} />
          <div className="gallery-search">
            <IcSearch />
            <input
              className="gallery-search-input"
              placeholder="Search templates…"
              value={query}
              autoFocus
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="iconbtn" title="Clear search" onClick={() => setQuery('')} style={{ width: 22, height: 22, minWidth: 22 }}>
                <svg viewBox="0 0 20 20" fill="none" width="13" height="13">
                  <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <Segmented
            value={kind}
            onChange={(v) => {
              setKind(v as 'all' | AppKind)
              setCategory('all')
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'docs', label: 'Docs' },
              { value: 'sheets', label: 'Sheets' },
              { value: 'slides', label: 'Slides' },
            ]}
          />
        </div>

        <div className="chip-row">
          <button className={'chip' + (category === 'all' ? ' on' : '')} onClick={() => setCategory('all')}>
            All
            <span className="chip-count">{chipSource.length}</span>
          </button>
          {chips.map((c) => (
            <button
              key={c.name}
              className={'chip' + (category === c.name ? ' on' : '')}
              onClick={() => setCategory(category === c.name ? 'all' : c.name)}
            >
              {c.name}
              <span className="chip-count">{c.count}</span>
            </button>
          ))}
        </div>

        {results.length === 0 ? (
          <div className="empty-hint">No templates match “{query}”. Try a different search.</div>
        ) : (
          <div className="tpl-row gallery-grid">
            {results.map(({ kind: k, tpl }) => (
              <TemplateCard key={k + tpl.id} kind={k} tpl={tpl} previewH={190} onPick={() => onNew(k, tpl)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
