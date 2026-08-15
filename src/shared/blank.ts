import type {
  AnyContent,
  AppKind,
  DocsContent,
  FormsContent,
  SheetsContent,
  SlidesContent,
} from './types'
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

/** The default look for a new form — the same blue the suite uses elsewhere. */
export const DEFAULT_FORM_THEME = {
  accent: '#7c3aed',
  headerFrom: '#7c3aed',
  headerTo: '#4f46e5',
  headerColor: '#ffffff',
  fontFamily: 'System (San Francisco)',
}

export function blankForms(): FormsContent {
  return {
    description: '',
    questions: [
      {
        id: uid(),
        kind: 'short',
        title: 'Untitled question',
        required: false,
      },
    ],
    theme: { ...DEFAULT_FORM_THEME },
    responses: [],
    settings: {
      confirmation: 'Thanks — your response has been recorded.',
      showQuestionNumbers: false,
      showProgress: true,
    },
  }
}

export function blankContent(kind: AppKind): AnyContent {
  if (kind === 'docs') return blankDocs()
  if (kind === 'sheets') return blankSheets()
  if (kind === 'forms') return blankForms()
  return blankSlides()
}

export const APP_NAMES: Record<AppKind, string> = {
  docs: 'Anleo Docs',
  sheets: 'Anleo Sheets',
  slides: 'Anleo Slides',
  forms: 'Anleo Forms',
}

export const NEW_TITLES: Record<AppKind, string> = {
  docs: 'Untitled document',
  sheets: 'Untitled spreadsheet',
  slides: 'Untitled presentation',
  forms: 'Untitled form',
}
