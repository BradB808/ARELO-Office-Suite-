import React, { useEffect, useMemo, useState } from 'react'
import type { AnleoDocument, AppKind, RecentEntry, Template } from '../shared/types'
import { greeting, timeAgo } from '../shared/util'
import { AppGlyph, IcClose, IcFolder, IcSearch } from '../shared/icons'
import { Segmented, Button } from '../shared/ui'
import { loadDraft } from '../shared/documents'
import { ContentPreview } from './ContentPreview'
import { TemplateCard } from './TemplateCard'
import { templatePool, interleaveByKind, searchTemplates } from '../templates/all'

const KIND_LABEL: Record<AppKind, string> = {
  docs: 'Docs',
  sheets: 'Sheets',
  slides: 'Slides',
  forms: 'Forms',
}

const CARD_W = 172
const CARD_PREVIEW_H = 168

function RecentCard({
  entry,
  onOpen,
  onRemove,
}: {
  entry: RecentEntry
  onOpen: () => void
  onRemove: () => void
}) {
  const [doc, setDoc] = useState<AnleoDocument | null>(null)
  useEffect(() => {
    let alive = true
    loadDraft(entry.id).then((d) => {
      if (alive) setDoc(d)
    })
    return () => {
      alive = false
    }
  }, [entry.id, entry.updatedAt])

  return (
    <div className="recent-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="tpl-preview">
        {doc ? (
          <ContentPreview kind={entry.kind} content={doc.content} width={CARD_W - 2} height={CARD_PREVIEW_H} />
        ) : (
          <div style={{ height: CARD_PREVIEW_H }} />
        )}
      </div>
      <div className="recent-card-meta">
        <AppGlyph kind={entry.kind} size={22} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tpl-name" style={{ padding: 0 }}>
            {entry.title}
          </div>
          <div className="recent-when">
            {timeAgo(entry.updatedAt)}
            {entry.filePath ? ' · file' : ''}
          </div>
        </div>
        <button
          className="iconbtn recent-x"
          title="Remove from recents"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <IcClose />
        </button>
      </div>
    </div>
  )
}

export function Home({
  recents,
  onNew,
  onOpenRecent,
  onOpenFile,
  onRemoveRecent,
  onBrowseTemplates,
}: {
  recents: RecentEntry[]
  onNew: (kind: AppKind, template?: Template) => void
  onOpenRecent: (entry: RecentEntry) => void
  onOpenFile: () => void
  onRemoveRecent: (id: string) => void
  onBrowseTemplates: () => void
}) {
  const [tplFilter, setTplFilter] = useState<'all' | AppKind>('all')

  const visibleTemplates = useMemo(() => {
    const filtered = searchTemplates(templatePool, { kind: tplFilter })
    return (tplFilter === 'all' ? interleaveByKind(filtered) : filtered).slice(0, 10)
  }, [tplFilter])

  return (
    <div className="hub">
      <div className="hub-inner">
        <div className="hub-greeting">{greeting()}</div>
        <div className="hub-sub">
          Free forever · works fully offline · your documents never leave this Mac
        </div>

        <div className="hub-newrow">
          <button className="new-card" data-app="docs" onClick={() => onNew('docs')}>
            <AppGlyph kind="docs" size={44} />
            <div>
              <div className="nc-title">New document</div>
              <div className="nc-sub">Anleo Docs</div>
            </div>
          </button>
          <button className="new-card" data-app="sheets" onClick={() => onNew('sheets')}>
            <AppGlyph kind="sheets" size={44} />
            <div>
              <div className="nc-title">New spreadsheet</div>
              <div className="nc-sub">Anleo Sheets</div>
            </div>
          </button>
          <button className="new-card" data-app="slides" onClick={() => onNew('slides')}>
            <AppGlyph kind="slides" size={44} />
            <div>
              <div className="nc-title">New presentation</div>
              <div className="nc-sub">Anleo Slides</div>
            </div>
          </button>
        </div>

        <div className="hub-section">
          <h2>Start from a template</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Segmented
              value={tplFilter}
              onChange={(v) => setTplFilter(v as 'all' | AppKind)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'docs', label: 'Docs' },
                { value: 'sheets', label: 'Sheets' },
                { value: 'slides', label: 'Slides' },
              ]}
            />
            <Button variant="outline" small onClick={onBrowseTemplates}>
              <IcSearch /> Browse all {templatePool.length}
            </Button>
          </div>
        </div>

        {visibleTemplates.length === 0 ? (
          <div className="empty-hint">Templates are loading…</div>
        ) : (
          <div className="tpl-row">
            {visibleTemplates.map(({ kind, tpl }) => (
              <TemplateCard key={kind + tpl.id} kind={kind} tpl={tpl} onPick={() => onNew(kind, tpl)} />
            ))}
          </div>
        )}

        <div className="hub-section">
          <h2>Recent documents</h2>
          <Button variant="outline" small onClick={onOpenFile}>
            <IcFolder /> Open file…
          </Button>
        </div>

        {recents.length === 0 ? (
          <div className="empty-hint">
            Documents you create will appear here. Everything autosaves locally as you type.
          </div>
        ) : (
          <div className="tpl-row">
            {recents.slice(0, 18).map((r) => (
              <RecentCard key={r.id} entry={r} onOpen={() => onOpenRecent(r)} onRemove={() => onRemoveRecent(r.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
