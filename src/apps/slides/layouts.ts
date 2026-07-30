// Six starter layouts for the "+ New slide" popover. Each is built fresh from
// the CURRENT theme so colors/fonts always match — explicit values, no CSS vars.

import type { Slide, SlideBackground, SlideElement, SlidesTheme } from '../../shared/types'
import { uid } from '../../shared/types'

export interface LayoutResult {
  background?: SlideBackground
  elements: SlideElement[]
}

export interface LayoutDef {
  id: string
  name: string
  build: (theme: SlidesTheme) => LayoutResult
}

function darken(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

const title: LayoutDef = {
  id: 'title',
  name: 'Title',
  build: (theme) => ({
    elements: [
      {
        id: uid(),
        kind: 'text',
        x: 120,
        y: 246,
        w: 1040,
        h: 128,
        text: 'Click to add title',
        fontFamily: theme.titleFont,
        fontSize: 60,
        bold: true,
        color: theme.titleColor,
        align: 'center',
        valign: 'middle',
      },
      {
        id: uid(),
        kind: 'text',
        x: 220,
        y: 386,
        w: 840,
        h: 60,
        text: 'Click to add subtitle',
        fontFamily: theme.bodyFont,
        fontSize: 24,
        color: theme.bodyColor,
        align: 'center',
        valign: 'middle',
      },
    ],
  }),
}

const titleContent: LayoutDef = {
  id: 'title-content',
  name: 'Title + content',
  build: (theme) => ({
    elements: [
      {
        id: uid(),
        kind: 'text',
        x: 80,
        y: 56,
        w: 1120,
        h: 84,
        text: 'Click to add title',
        fontFamily: theme.titleFont,
        fontSize: 40,
        bold: true,
        color: theme.titleColor,
        align: 'left',
        valign: 'middle',
      },
      {
        id: uid(),
        kind: 'shape',
        shape: 'rect',
        x: 80,
        y: 150,
        w: 90,
        h: 5,
        fill: theme.accent,
      },
      {
        id: uid(),
        kind: 'text',
        x: 80,
        y: 190,
        w: 1120,
        h: 470,
        text: 'First point\nSecond point\nThird point',
        fontFamily: theme.bodyFont,
        fontSize: 26,
        color: theme.bodyColor,
        align: 'left',
        valign: 'top',
        bullets: true,
        lineHeight: 1.5,
      },
    ],
  }),
}

const twoColumn: LayoutDef = {
  id: 'two-column',
  name: 'Two column',
  build: (theme) => ({
    elements: [
      {
        id: uid(),
        kind: 'text',
        x: 80,
        y: 56,
        w: 1120,
        h: 84,
        text: 'Click to add title',
        fontFamily: theme.titleFont,
        fontSize: 40,
        bold: true,
        color: theme.titleColor,
        align: 'left',
        valign: 'middle',
      },
      {
        id: uid(),
        kind: 'shape',
        shape: 'rect',
        x: 80,
        y: 150,
        w: 90,
        h: 5,
        fill: theme.accent,
      },
      {
        id: uid(),
        kind: 'text',
        x: 80,
        y: 190,
        w: 522,
        h: 470,
        text: 'First point\nSecond point\nThird point',
        fontFamily: theme.bodyFont,
        fontSize: 24,
        color: theme.bodyColor,
        align: 'left',
        valign: 'top',
        bullets: true,
        lineHeight: 1.5,
      },
      {
        id: uid(),
        kind: 'text',
        x: 678,
        y: 190,
        w: 522,
        h: 470,
        text: 'First point\nSecond point\nThird point',
        fontFamily: theme.bodyFont,
        fontSize: 24,
        color: theme.bodyColor,
        align: 'left',
        valign: 'top',
        bullets: true,
        lineHeight: 1.5,
      },
    ],
  }),
}

const sectionHeader: LayoutDef = {
  id: 'section',
  name: 'Section header',
  build: (theme) => {
    // Always land on a dramatic, deep-toned gradient rooted in the theme's
    // own accent hue (darkened if the accent itself is too pale for white
    // text), rather than a generic navy that ignores the theme's palette.
    const from = isLight(theme.accent) ? darken(theme.accent, -110) : darken(theme.accent, -20)
    const to = isLight(theme.accent) ? darken(theme.accent, -40) : theme.accent
    return {
      background: { type: 'gradient', from, to, angle: 135 },
      elements: [
        {
          id: uid(),
          kind: 'shape',
          shape: 'rect',
          x: 120,
          y: 300,
          w: 70,
          h: 8,
          fill: '#ffffff',
        },
        {
          id: uid(),
          kind: 'text',
          x: 120,
          y: 328,
          w: 1000,
          h: 120,
          text: 'Section title',
          fontFamily: theme.titleFont,
          fontSize: 52,
          bold: true,
          color: '#ffffff',
          align: 'left',
          valign: 'middle',
        },
      ],
    }
  },
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return true
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

const quote: LayoutDef = {
  id: 'quote',
  name: 'Quote',
  build: (theme) => ({
    elements: [
      {
        id: uid(),
        kind: 'text',
        x: 160,
        y: 150,
        w: 120,
        h: 100,
        text: '“',
        fontFamily: theme.titleFont,
        fontSize: 110,
        bold: true,
        color: theme.accent,
        align: 'left',
        valign: 'top',
      },
      {
        id: uid(),
        kind: 'text',
        x: 200,
        y: 250,
        w: 880,
        h: 200,
        text: 'A short, memorable quote goes here.',
        fontFamily: theme.titleFont,
        fontSize: 38,
        italic: true,
        color: theme.titleColor,
        align: 'center',
        valign: 'middle',
      },
      {
        id: uid(),
        kind: 'text',
        x: 300,
        y: 460,
        w: 680,
        h: 50,
        text: '— Attribution, title',
        fontFamily: theme.bodyFont,
        fontSize: 22,
        color: theme.bodyColor,
        align: 'center',
        valign: 'middle',
      },
    ],
  }),
}

const blank: LayoutDef = {
  id: 'blank',
  name: 'Blank',
  build: () => ({ elements: [] }),
}

export const LAYOUTS: LayoutDef[] = [title, titleContent, twoColumn, sectionHeader, quote, blank]

export function getLayout(id: string): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0]
}
