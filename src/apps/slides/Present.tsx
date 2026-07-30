// Fullscreen present mode. Falls back to a windowed fixed overlay if the
// Fullscreen API is denied. Honors each slide's transition on advance.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Slide, SlidesTheme } from '../../shared/types'
import { SLIDE_H, SLIDE_W } from '../../shared/types'
import { SlideView } from './SlideView'

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Present({
  slides,
  theme,
  startIndex,
  showSlideNumbers,
  onClose,
}: {
  slides: Slide[]
  theme: SlidesTheme
  startIndex: number
  showSlideNumbers?: boolean
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const indexRef = useRef(startIndex)
  const [index, setIndex] = useState(startIndex)
  const [prev, setPrev] = useState<{ index: number; dir: 1 | -1 } | null>(null)
  const [entered, setEntered] = useState(true)
  const [showChip, setShowChip] = useState(true)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [notesVisible, setNotesVisible] = useState(false)
  const startedAtRef = useRef(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  const go = useCallback(
    (delta: number) => {
      const cur = indexRef.current
      const next = Math.min(slides.length - 1, Math.max(0, cur + delta))
      if (next === cur) return
      setPrev({ index: cur, dir: delta > 0 ? 1 : -1 })
      setEntered(false)
      indexRef.current = next
      setIndex(next)
      requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
      window.setTimeout(() => setPrev(null), 380)
    },
    [slides.length],
  )

  // Reveal the fading chrome (exit button, index/timer chips, notes panel) and
  // restart the idle-hide countdown. Shared by mouse movement and the N toggle.
  const bumpChrome = useCallback(() => {
    setShowChip(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setShowChip(false), 2200)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    el?.requestFullscreen?.().catch(() => {})
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) onClose()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [onClose])

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Escape') {
        onClose()
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setNotesVisible((v) => !v)
        bumpChrome()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose, bumpChrome])

  // ---------- elapsed timer ----------
  useEffect(() => {
    startedAtRef.current = Date.now()
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    bumpChrome()
    window.addEventListener('mousemove', bumpChrome)
    return () => {
      window.removeEventListener('mousemove', bumpChrome)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [bumpChrome])

  const scale = Math.min(size.w / SLIDE_W, size.h / SLIDE_H)
  const slide = slides[index]
  const transitionKind = prev ? slides[prev.index].transition || 'none' : 'none'
  const showPrevLayer = !!prev && transitionKind !== 'none'

  return createPortal(
    <div ref={containerRef} className="px-present" onClick={() => go(1)}>
      <div className="px-present-stage" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
        {showPrevLayer && prev && (
          <div
            className={
              'px-present-layer ' +
              (transitionKind === 'fade' ? 'px-fade-out' : prev.dir > 0 ? 'px-slide-out-l' : 'px-slide-out-r') +
              (entered ? ' settled' : '')
            }
          >
            <SlideView
              slide={slides[prev.index]}
              theme={theme}
              scale={scale}
              pageNumber={showSlideNumbers && prev.index > 0 ? prev.index + 1 : undefined}
            />
          </div>
        )}
        <div
          className={
            'px-present-layer' +
            (showPrevLayer && prev
              ? (transitionKind === 'fade' ? ' px-fade-in' : prev.dir > 0 ? ' px-slide-in-r' : ' px-slide-in-l') + (entered ? ' settled' : '')
              : '')
          }
        >
          <SlideView slide={slide} theme={theme} scale={scale} pageNumber={showSlideNumbers && index > 0 ? index + 1 : undefined} />
        </div>
      </div>

      <button
        className={'px-present-exit' + (showChip ? ' show' : '')}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        title="Exit presentation (Esc)"
      >
        Esc
      </button>
      <div className={'px-present-chip' + (showChip ? ' show' : '')} onClick={(e) => e.stopPropagation()}>
        {index + 1} / {slides.length}
      </div>

      <div className={'px-present-timer' + (showChip ? ' show' : '')} onClick={(e) => e.stopPropagation()}>
        <span className="px-present-timer-clock">{formatElapsed(elapsedMs)}</span>
        <span className="px-present-timer-hint">N notes · ← → navigate</span>
      </div>

      {notesVisible && (
        <div className={'px-present-notes' + (showChip ? ' show' : '')} onClick={(e) => e.stopPropagation()}>
          <div className="px-present-notes-label">Speaker notes</div>
          <div className="px-present-notes-body">{slide.notes || 'No notes for this slide.'}</div>
        </div>
      )}
    </div>,
    document.body,
  )
}
