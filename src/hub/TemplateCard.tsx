import React, { useMemo } from 'react'
import type { AnyContent, AppKind, Template } from '../shared/types'
import { ContentPreview } from './ContentPreview'

const KIND_LABEL: Record<AppKind, string> = {
  docs: 'Docs',
  sheets: 'Sheets',
  slides: 'Slides',
  forms: 'Forms',
}

export function TemplateCard({
  kind,
  tpl,
  onPick,
  previewH = 168,
}: {
  kind: AppKind
  tpl: Template
  onPick: () => void
  previewH?: number
}) {
  // Templates are pure factories; build the preview content once.
  const preview = useMemo<AnyContent>(() => tpl.make(), [tpl])
  return (
    <button className="tpl-card" data-app={kind} onClick={onPick} title={tpl.description}>
      <div className="tpl-preview" style={{ height: previewH }}>
        <PreviewSizer previewH={previewH}>
          {(w) => <ContentPreview kind={kind} content={preview} width={w} height={previewH} />}
        </PreviewSizer>
      </div>
      <div className="tpl-meta">
        <div className="tpl-name">{tpl.name}</div>
        <div className="tpl-cat">
          <span className="tpl-kind-dot" style={{ background: `var(--c-${kind})` }} />
          {KIND_LABEL[kind]} · {tpl.category}
        </div>
      </div>
    </button>
  )
}

/** Measures its own width so preview cards can be fluid in grid tracks. */
function PreviewSizer({
  previewH,
  children,
}: {
  previewH: number
  children: (width: number) => React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [w, setW] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ width: '100%', height: previewH, overflow: 'hidden' }}>
      {w > 0 && children(w)}
    </div>
  )
}
