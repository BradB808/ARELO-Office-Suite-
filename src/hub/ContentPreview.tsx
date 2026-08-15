// Miniature live previews of document content — used for template cards and
// recent-document cards on the hub, like Google Docs' template thumbnails.

import React, { useMemo } from 'react'
import type {
  AnyContent,
  AppKind,
  DocsContent,
  FormsContent,
  SheetsContent,
  SlidesContent,
  SlideElement,
  SlideBackground,
} from '../shared/types'
import { SLIDE_W, SLIDE_H } from '../shared/types'
import { getTheme } from '../apps/slides/themes'
import { cssFamily } from '../shared/fonts'

function colLetter(i: number): string {
  let s = ''
  i += 1
  while (i > 0) {
    const m = (i - 1) % 26
    s = String.fromCharCode(65 + m) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

function DocsPreview({ content, width, height }: { content: DocsContent; width: number; height: number }) {
  const pageW = content.pageWidth ?? 816
  const scale = (width - 24) / pageW
  return (
    <div style={{ width, height, overflow: 'hidden', display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
      <div
        style={{
          width: pageW,
          flexShrink: 0,
          height: (height - 10) / scale,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          background: '#ffffff',
          color: '#1f2328',
          borderRadius: 6,
          boxShadow: '0 1px 4px rgba(15,18,25,0.14)',
          padding: (content.margin ?? 72) * 0.75,
          overflow: 'hidden',
          pointerEvents: 'none',
          textAlign: 'left',
        }}
        className="cp-doc"
        dangerouslySetInnerHTML={{ __html: content.html }}
      />
    </div>
  )
}

function SheetsPreview({ content, width, height }: { content: SheetsContent; width: number; height: number }) {
  const sheet = content.sheets[content.active] ?? content.sheets[0]
  const COLS = 6
  const ROWS = 9
  const cells = useMemo(() => {
    const out: { text: string; style?: React.CSSProperties }[][] = []
    for (let r = 0; r < ROWS; r++) {
      const row: { text: string; style?: React.CSSProperties }[] = []
      for (let c = 0; c < COLS; c++) {
        const cell = sheet?.cells[colLetter(c) + (r + 1)]
        const st: React.CSSProperties = {}
        if (cell?.style?.fill) st.background = cell.style.fill
        if (cell?.style?.color) st.color = cell.style.color
        if (cell?.style?.bold) st.fontWeight = 700
        if (cell?.style?.align) st.textAlign = cell.style.align
        let text = cell?.v ?? ''
        if (text.startsWith('=')) text = '…'
        row.push({ text, style: st })
      }
      out.push(row)
    }
    return out
  }, [sheet])

  return (
    <div style={{ width, height, overflow: 'hidden', padding: '12px 14px', pointerEvents: 'none' }}>
      <div
        style={{
          background: '#ffffff',
          borderRadius: 6,
          boxShadow: '0 1px 4px rgba(15,18,25,0.14)',
          overflow: 'hidden',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: 1,
          padding: 1,
          backgroundColor: '#e5e7eb',
        }}
      >
        {cells.flatMap((row, r) =>
          row.map((cell, c) => (
            <div
              key={r + '-' + c}
              style={{
                background: '#fff',
                fontSize: 6.5,
                lineHeight: '1.6',
                padding: '1px 3px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                color: '#374151',
                ...cell.style,
              }}
            >
              {cell.text}
            </div>
          )),
        )}
      </div>
    </div>
  )
}

function bgToCss(bg: SlideBackground | undefined, fallback: string): string {
  if (!bg) return fallback
  if (bg.type === 'solid') return bg.color ?? fallback
  if (bg.type === 'gradient') return `linear-gradient(${bg.angle ?? 135}deg, ${bg.from ?? '#333'}, ${bg.to ?? '#666'})`
  return fallback
}

function MiniElement({ el, theme }: { el: SlideElement; theme: ReturnType<typeof getTheme> }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: el.opacity,
  }
  if (el.kind === 'text') {
    const lines = el.text.split('\n')
    return (
      <div
        style={{
          ...base,
          color: el.color ?? theme.bodyColor,
          fontSize: el.fontSize ?? 24,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : undefined,
          fontFamily: cssFamily(el.fontFamily ?? theme.bodyFont),
          textAlign: el.align ?? 'left',
          lineHeight: el.lineHeight ?? 1.4,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: el.valign === 'middle' ? 'center' : el.valign === 'bottom' ? 'flex-end' : 'flex-start',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
        }}
      >
        {el.bullets ? (
          <div style={{ textAlign: 'left' }}>
            {lines.map((l, i) => (
              <div key={i}>• {l}</div>
            ))}
          </div>
        ) : (
          el.text
        )}
      </div>
    )
  }
  if (el.kind === 'shape') {
    const s: React.CSSProperties = {
      ...base,
      background: el.gradient ? `linear-gradient(${el.gradient.angle}deg, ${el.gradient.from}, ${el.gradient.to})` : el.fill,
    }
    if (el.stroke && el.strokeWidth) s.border = `${el.strokeWidth}px solid ${el.stroke}`
    if (el.shape === 'ellipse') s.borderRadius = '50%'
    if (el.shape === 'roundRect') s.borderRadius = 16
    if (el.shape === 'triangle') s.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)'
    if (el.shape === 'diamond') s.clipPath = 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)'
    if (el.shape === 'star')
      s.clipPath =
        'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
    if (el.shape === 'chevron') s.clipPath = 'polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%, 25% 50%)'
    if (el.shape === 'arrow') s.clipPath = 'polygon(0 30%, 60% 30%, 60% 0, 100% 50%, 60% 100%, 60% 70%, 0 70%)'
    if (el.shape === 'plus')
      s.clipPath =
        'polygon(34% 0%, 66% 0%, 66% 34%, 100% 34%, 100% 66%, 66% 66%, 66% 100%, 34% 100%, 34% 66%, 0% 66%, 0% 34%, 34% 34%)'
    if (el.shape === 'cross')
      s.clipPath =
        'polygon(30% 0%, 50% 18%, 70% 0%, 100% 30%, 82% 50%, 100% 70%, 70% 100%, 50% 82%, 30% 100%, 0% 70%, 18% 50%, 0% 30%)'
    if (el.shape === 'pentagon') s.clipPath = 'polygon(50% 0%, 97.5% 34.5%, 79.4% 90.5%, 20.6% 90.5%, 2.5% 34.5%)'
    if (el.shape === 'hexagon') s.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
    if (el.shape === 'speech') s.clipPath = 'polygon(0% 0%, 100% 0%, 100% 78%, 40% 78%, 18% 100%, 18% 78%, 0% 78%)'
    if (el.shape === 'cloud')
      s.clipPath =
        'polygon(20% 85%, 8% 85%, 2% 65%, 8% 45%, 20% 38%, 22% 20%, 40% 8%, 58% 15%, 68% 8%, 85% 20%, 92% 40%, 98% 55%, 90% 75%, 80% 85%)'
    return <div style={s} />
  }
  if (el.kind === 'linked') {
    // Linked spreadsheet range: sketch its rows so the thumbnail reads as a table.
    const rows = el.link.snapshot.slice(0, 6)
    return (
      <div style={{ ...base, background: '#ffffff', border: '1px solid rgba(15,18,25,0.15)', overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', height: el.h / Math.max(rows.length, 1) }}>
            {row.slice(0, 6).map((cell, j) => (
              <div
                key={j}
                style={{
                  flex: 1,
                  fontSize: (el.fontSize ?? 18) * 0.8,
                  padding: '0 4px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  background: i === 0 && el.link.headerRow ? (el.headerFill ?? '#e5e7eb') : undefined,
                  color: i === 0 && el.link.headerRow ? (el.headerColor ?? '#111827') : (el.color ?? '#374151'),
                  fontWeight: i === 0 && el.link.headerRow ? 700 : 400,
                  borderBottom: '1px solid rgba(15,18,25,0.08)',
                }}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }
  return <div style={{ ...base, background: 'rgba(120,130,150,0.25)', borderRadius: el.borderRadius ?? 4 }} />
}

function SlidesPreview({ content, width, height }: { content: SlidesContent; width: number; height: number }) {
  const theme = getTheme(content.themeId)
  const slide = content.slides[0]
  const scale = (width - 24) / SLIDE_W
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          background: bgToCss(slide?.background ?? theme.bg, '#111'),
          borderRadius: 10,
          boxShadow: '0 1px 4px rgba(15,18,25,0.2)',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {slide?.elements.map((el) => <MiniElement key={el.id} el={el} theme={theme} />)}
      </div>
    </div>
  )
}

function FormsPreview({ content, width, height }: { content: FormsContent; width: number; height: number }) {
  // A form card is mostly its header and the first few questions — enough to
  // tell two templates apart at thumbnail size.
  const CARD_W = 460
  const scale = (width - 24) / CARD_W
  const theme = content.theme
  const shown = content.questions.slice(0, 5)

  return (
    <div style={{ width, height, overflow: 'hidden', display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
      <div
        style={{
          width: CARD_W,
          flexShrink: 0,
          height: (height - 10) / scale,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          pointerEvents: 'none',
          textAlign: 'left',
          fontFamily: cssFamily(theme.fontFamily),
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})`,
            color: theme.headerColor,
            borderRadius: '8px 8px 0 0',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
            {content.description ? content.description.slice(0, 60) : 'Form'}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '0 0 8px 8px', padding: '6px 0 12px' }}>
          {shown.map((q) => (
            <div
              key={q.id}
              style={{
                background: '#fff',
                borderTop: '1px solid rgba(15,18,25,0.08)',
                padding: '12px 20px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2328', marginBottom: 7 }}>
                {q.title.slice(0, 52)}
                {q.required && <span style={{ color: '#dc2626' }}> *</span>}
              </div>
              {q.kind === 'choice' || q.kind === 'checkboxes' || q.kind === 'dropdown' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(q.options ?? []).slice(0, 3).map((o) => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: q.kind === 'checkboxes' ? 2 : '50%',
                          border: '1.5px solid rgba(15,18,25,0.32)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 11.5, color: '#4b5160' }}>{o.label.slice(0, 40)}</span>
                    </div>
                  ))}
                </div>
              ) : q.kind === 'scale' ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  {Array.from({ length: Math.min(5, (q.scaleMax ?? 5) - (q.scaleMin ?? 1) + 1) }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        border: '1.5px solid rgba(15,18,25,0.32)',
                      }}
                    />
                  ))}
                </div>
              ) : q.kind === 'section' ? null : (
                <div style={{ height: 1, background: 'rgba(15,18,25,0.22)', width: '68%' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ContentPreview({
  kind,
  content,
  width,
  height,
}: {
  kind: AppKind
  content: AnyContent
  width: number
  height: number
}) {
  if (kind === 'docs') return <DocsPreview content={content as DocsContent} width={width} height={height} />
  if (kind === 'sheets') return <SheetsPreview content={content as SheetsContent} width={width} height={height} />
  if (kind === 'forms') return <FormsPreview content={content as FormsContent} width={width} height={height} />
  return <SlidesPreview content={content as SlidesContent} width={width} height={height} />
}
