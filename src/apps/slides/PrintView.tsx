// Hidden-on-screen, print-only container: every slide at fixed 1280x720 size,
// one per landscape page. Toggled on with @media print (see slides.css).

import React from 'react'
import type { Slide, SlidesTheme } from '../../shared/types'
import { SlideView } from './SlideView'

export function PrintView({ slides, theme, showSlideNumbers }: { slides: Slide[]; theme: SlidesTheme; showSlideNumbers?: boolean }) {
  return (
    <div className="px-print-root">
      {slides.map((s, i) => (
        <div className="px-print-page" key={s.id}>
          <SlideView slide={s} theme={theme} scale={1} pageNumber={showSlideNumbers && i > 0 ? i + 1 : undefined} />
        </div>
      ))}
    </div>
  )
}
