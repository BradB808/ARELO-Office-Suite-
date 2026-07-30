import type { AnyContent, AppKind, DocsContent, SheetsContent, SlidesContent } from './types'
import { uid } from './types'

export function blankDocs(): DocsContent {
  return { html: '<p></p>' }
}

export function blankSheets(): SheetsContent {
  return {
    sheets: [{ name: 'Sheet 1', cells: {}, colWidths: {}, rowHeights: {} }],
    active: 0,
  }
}

export function blankSlides(): SlidesContent {
  return {
    themeId: 'aurora',
    slides: [
      {
        id: uid(),
        elements: [
          {
            id: uid(),
            kind: 'text',
            text: 'Click to add a title',
            x: 140,
            y: 250,
            w: 1000,
            h: 120,
            fontSize: 64,
            bold: true,
            align: 'center',
            valign: 'middle',
          },
          {
            id: uid(),
            kind: 'text',
            text: 'Click to add a subtitle',
            x: 240,
            y: 390,
            w: 800,
            h: 60,
            fontSize: 26,
            align: 'center',
            valign: 'middle',
          },
        ],
      },
    ],
  }
}

export function blankContent(kind: AppKind): AnyContent {
  if (kind === 'docs') return blankDocs()
  if (kind === 'sheets') return blankSheets()
  return blankSlides()
}

export const APP_NAMES: Record<AppKind, string> = {
  docs: 'Anleo Docs',
  sheets: 'Anleo Sheets',
  slides: 'Anleo Slides',
}

export const NEW_TITLES: Record<AppKind, string> = {
  docs: 'Untitled document',
  sheets: 'Untitled spreadsheet',
  slides: 'Untitled presentation',
}
