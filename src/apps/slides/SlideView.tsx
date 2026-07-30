// Pure slide renderer — no interactivity, no editing. Reused verbatim for the
// thumbnail rail, the canvas base layer, present mode and the print view.

import React from 'react'
import type {
  ImageElement,
  LinkedTableElement,
  Slide,
  SlideBackground,
  SlideElement,
  ShapeElement,
  SlidesTheme,
  TextElement,
} from '../../shared/types'
import { SLIDE_H, SLIDE_W } from '../../shared/types'
import { cssFamily } from '../../shared/fonts'
import { shapePath } from './shapes'

export function backgroundStyle(bg: SlideBackground | undefined, theme: SlidesTheme): React.CSSProperties {
  const b = bg ?? theme.bg
  if (b.type === 'image' && b.src) {
    return { backgroundImage: `url("${b.src}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (b.type === 'gradient') {
    return { background: `linear-gradient(${b.angle ?? 135}deg, ${b.from || '#111827'}, ${b.to || '#374151'})` }
  }
  return { background: b.color || '#ffffff' }
}

function TextBody({ el, theme }: { el: TextElement; theme: SlidesTheme }) {
  const justify = el.valign === 'top' ? 'flex-start' : el.valign === 'bottom' ? 'flex-end' : 'center'
  const wrapStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: justify,
    fontFamily: cssFamily(el.fontFamily || theme.bodyFont),
    fontSize: el.fontSize ?? 24,
    color: el.color || theme.bodyColor,
    fontWeight: el.bold ? 700 : 400,
    fontStyle: el.italic ? 'italic' : 'normal',
    textDecoration: el.underline ? 'underline' : 'none',
    textAlign: el.align || 'left',
    lineHeight: el.lineHeight ?? 1.25,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
  const lines = el.text.length ? el.text.split('\n') : ['']
  // Numbered wins over bullets when both are somehow set.
  if (el.numbered || el.bullets) {
    const ListTag = el.numbered ? 'ol' : 'ul'
    return (
      <div style={wrapStyle}>
        <ListTag style={{ margin: 0, paddingLeft: '1.15em', textAlign: el.align || 'left', listStylePosition: 'outside' }}>
          {lines.map((l, i) => (
            <li key={i} style={{ marginBottom: '0.18em' }}>
              {l || ' '}
            </li>
          ))}
        </ListTag>
      </div>
    )
  }
  return <div style={wrapStyle}>{el.text}</div>
}

/** Convert a CSS-style gradient angle (0deg = up, clockwise) to an objectBoundingBox gradient vector. */
function gradientVector(angle: number): { x1: string; y1: string; x2: string; y2: string } {
  const rad = (angle * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  return {
    x1: `${(50 - dx * 50).toFixed(2)}%`,
    y1: `${(50 - dy * 50).toFixed(2)}%`,
    x2: `${(50 + dx * 50).toFixed(2)}%`,
    y2: `${(50 + dy * 50).toFixed(2)}%`,
  }
}

function ShapeBody({ el }: { el: ShapeElement }) {
  const isLine = el.shape === 'line'
  const d = isLine ? '' : shapePath(el.shape, Math.max(el.w, 0.01), Math.max(el.h, 0.01))
  const gradId = `px-shgrad-${el.id}`
  const strokeW = el.strokeWidth ?? 2
  const arrowSize = Math.max(6, strokeW * 3.2)
  const arrowColor = el.stroke || el.fill || '#111827'
  const startMarkerId = `px-arrow-s-${el.id}`
  const endMarkerId = `px-arrow-e-${el.id}`
  const needsDefs = !isLine ? !!el.gradient : el.arrowStart || el.arrowEnd
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${Math.max(el.w, 0.01)} ${Math.max(el.h, 0.01)}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible', display: 'block' }}
      >
        {needsDefs && (
          <defs>
            {el.gradient && (
              <linearGradient id={gradId} {...gradientVector(el.gradient.angle)}>
                <stop offset="0%" stopColor={el.gradient.from} />
                <stop offset="100%" stopColor={el.gradient.to} />
              </linearGradient>
            )}
            {isLine && el.arrowStart && (
              <marker id={startMarkerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={arrowSize} markerHeight={arrowSize} orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill={arrowColor} />
              </marker>
            )}
            {isLine && el.arrowEnd && (
              <marker id={endMarkerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={arrowSize} markerHeight={arrowSize} orient="auto">
                <path d="M0,0 L10,5 L0,10 Z" fill={arrowColor} />
              </marker>
            )}
          </defs>
        )}
        {isLine ? (
          <line
            x1={0}
            y1={0}
            x2={el.w}
            y2={el.h}
            stroke={arrowColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            markerStart={el.arrowStart ? `url(#${startMarkerId})` : undefined}
            markerEnd={el.arrowEnd ? `url(#${endMarkerId})` : undefined}
          />
        ) : (
          <path
            d={d}
            fill={el.gradient ? `url(#${gradId})` : el.fill || 'transparent'}
            stroke={el.stroke || 'none'}
            strokeWidth={el.strokeWidth ?? 0}
            strokeLinejoin="round"
          />
        )}
      </svg>
      {!isLine && el.text && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4% 8%',
            textAlign: 'center',
            fontFamily: cssFamily(el.fontFamily || 'Helvetica Neue'),
            fontSize: el.fontSize ?? 18,
            color: el.color || '#ffffff',
            fontWeight: el.bold ? 700 : 500,
            lineHeight: 1.25,
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {el.text}
        </div>
      )}
    </div>
  )
}

/** Clean live-range table: header row (optional) styled via headerFill/headerColor,
 * body rows styled via fontSize/color/fontFamily. Rows are clipped to the element box. */
function LinkedTableBody({ el, theme }: { el: LinkedTableElement; theme: SlidesTheme }) {
  const rows = el.link.snapshot
  const hasHeader = !!el.link.headerRow && rows.length > 0
  const bodyRows = hasHeader ? rows.slice(1) : rows
  const cellStyle: React.CSSProperties = {
    padding: '5px 10px',
    border: '1px solid rgba(127,127,127,0.22)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'left',
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        fontFamily: cssFamily(el.fontFamily || theme.bodyFont),
        fontSize: el.fontSize ?? 16,
        color: el.color || theme.bodyColor,
      }}
    >
      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        {hasHeader && (
          <thead>
            <tr>
              {rows[0].map((cell, i) => (
                <th
                  key={i}
                  style={{
                    ...cellStyle,
                    background: el.headerFill || theme.accent,
                    color: el.headerColor || '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={cellStyle}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImageBody({ el }: { el: ImageElement }) {
  return (
    <img
      src={el.src}
      draggable={false}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: el.borderRadius ?? 0,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
}

function ElementView({ el, theme }: { el: SlideElement; theme: SlidesTheme }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: el.opacity ?? 1,
  }
  if (el.kind === 'text') {
    return (
      <div style={style}>
        <TextBody el={el} theme={theme} />
      </div>
    )
  }
  if (el.kind === 'shape') {
    return (
      <div style={style}>
        <ShapeBody el={el} />
      </div>
    )
  }
  if (el.kind === 'linked') {
    return (
      <div style={style}>
        <LinkedTableBody el={el} theme={theme} />
      </div>
    )
  }
  return (
    <div style={style}>
      <ImageBody el={el} />
    </div>
  )
}

export function SlideView({
  slide,
  theme,
  scale,
  className,
  style,
  pageNumber,
}: {
  slide: Slide
  theme: SlidesTheme
  scale: number
  className?: string
  style?: React.CSSProperties
  /** 1-based slide number chip, bottom-right. Omit to render no chip (e.g. slide 1, or numbers off). */
  pageNumber?: number
}) {
  return (
    <div
      className={'px-slideview' + (className ? ' ' + className : '')}
      style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, ...backgroundStyle(slide.background, theme), ...style }}
    >
      <div
        style={{
          position: 'relative',
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {slide.elements.map((el) => (
          <ElementView key={el.id} el={el} theme={theme} />
        ))}
        {pageNumber !== undefined && (
          <div
            style={{
              position: 'absolute',
              right: 22,
              bottom: 16,
              minWidth: 24,
              height: 24,
              padding: '0 7px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontFamily: cssFamily(theme.bodyFont),
              color: theme.bodyColor,
              background: 'rgba(127,127,127,0.18)',
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            {pageNumber}
          </div>
        )}
      </div>
    </div>
  )
}
