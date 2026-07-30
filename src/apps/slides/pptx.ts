// PowerPoint export mapping. Pure mapping functions (element -> pptxgenjs
// option objects) plus a thin orchestration function that walks the deck and
// calls the pptxgenjs API. Coordinates: logical px -> inches (96 px/in);
// font sizes: px -> pt (* 0.75).

import PptxGenJS from 'pptxgenjs'
import type {
  ImageElement,
  LinkedTableElement,
  Slide,
  SlideBackground,
  ShapeElement,
  ShapeKind,
  SlidesContent,
  TextElement,
} from '../../shared/types'
import { SLIDE_H, SLIDE_W } from '../../shared/types'
import { getTheme } from './themes'

const PX_PER_IN = 96

export function pxToIn(px: number): number {
  return px / PX_PER_IN
}

export function pxToPt(px: number): number {
  return px * 0.75
}

export function hex(color: string | undefined, fallback = '000000'): string {
  if (!color) return fallback
  const c = color.trim().replace('#', '')
  if (/^[0-9a-fA-F]{6}$/.test(c)) return c.toUpperCase()
  if (/^[0-9a-fA-F]{3}$/.test(c)) {
    return c
      .split('')
      .map((ch) => ch + ch)
      .join('')
      .toUpperCase()
  }
  return fallback
}

export function mapShapeType(kind: ShapeKind): PptxGenJS.SHAPE_NAME {
  switch (kind) {
    case 'rect':
      return 'rect'
    case 'roundRect':
      return 'roundRect'
    case 'ellipse':
      return 'ellipse'
    case 'triangle':
      return 'triangle'
    case 'diamond':
      return 'diamond'
    case 'star':
      return 'star5'
    case 'chevron':
      return 'chevron'
    case 'arrow':
      return 'rightArrow'
    case 'line':
      return 'line'
    case 'plus':
      return 'plus'
    case 'cross':
      return 'mathMultiply'
    case 'pentagon':
      return 'pentagon'
    case 'hexagon':
      return 'hexagon'
    case 'speech':
      return 'wedgeRoundRectCallout'
    case 'cloud':
      return 'cloud'
    default:
      return 'rect'
  }
}

/** Solid fill color for a shape: the gradient's `from` stop when a gradient is set, else the plain fill. */
export function shapeFillColor(el: ShapeElement): string {
  return hex(el.gradient?.from ?? el.fill, 'FFFFFF')
}

export function backgroundFill(bg: SlideBackground | undefined, themeBg: SlideBackground): PptxGenJS.BackgroundProps {
  const b = bg ?? themeBg
  if (b.type === 'image' && b.src) return { data: b.src }
  if (b.type === 'gradient') return { color: hex(b.from, 'FFFFFF') }
  return { color: hex(b.color, 'FFFFFF') }
}

export function textElementOptions(
  el: TextElement,
  themeFont: string,
  themeColor: string,
): PptxGenJS.TextPropsOptions {
  return {
    x: pxToIn(el.x),
    y: pxToIn(el.y),
    w: pxToIn(el.w),
    h: pxToIn(el.h),
    fontFace: el.fontFamily || themeFont,
    fontSize: pxToPt(el.fontSize ?? 24),
    color: hex(el.color, hex(themeColor)),
    bold: !!el.bold,
    italic: !!el.italic,
    underline: el.underline ? { style: 'sng' } : undefined,
    align: el.align || 'left',
    valign: el.valign === 'middle' ? 'middle' : el.valign === 'bottom' ? 'bottom' : 'top',
    lineSpacingMultiple: el.lineHeight ?? 1.25,
    rotate: el.rotation ?? 0,
    // Numbered wins over bullets when both are somehow set (matches SlideView).
    bullet: el.numbered ? { type: 'number' } : el.bullets ? true : undefined,
    wrap: true,
    fit: 'none',
  }
}

export function shapeTextOptions(el: ShapeElement): PptxGenJS.TextPropsOptions {
  return {
    shape: mapShapeType(el.shape),
    x: pxToIn(el.x),
    y: pxToIn(el.y),
    w: pxToIn(el.w),
    h: pxToIn(el.h),
    fill: { color: shapeFillColor(el) },
    line: el.stroke ? { color: hex(el.stroke), width: el.strokeWidth ?? 1 } : { type: 'none' },
    rotate: el.rotation ?? 0,
    fontFace: el.fontFamily || 'Helvetica Neue',
    fontSize: pxToPt(el.fontSize ?? 18),
    color: hex(el.color, 'FFFFFF'),
    bold: !!el.bold,
    align: 'center',
    valign: 'middle',
    fit: 'shrink',
  }
}

export function lineShapeOptions(el: ShapeElement): PptxGenJS.ShapeProps {
  return {
    x: pxToIn(el.x),
    y: pxToIn(el.y),
    w: pxToIn(el.w),
    h: pxToIn(el.h),
    line: {
      color: hex(el.stroke || el.fill, '111827'),
      width: el.strokeWidth ?? 2,
      beginArrowType: el.arrowStart ? 'triangle' : 'none',
      endArrowType: el.arrowEnd ? 'triangle' : 'none',
    },
    rotate: el.rotation ?? 0,
  }
}

export function imageElementOptions(el: ImageElement): PptxGenJS.ImageProps {
  return {
    data: el.src,
    x: pxToIn(el.x),
    y: pxToIn(el.y),
    w: pxToIn(el.w),
    h: pxToIn(el.h),
    rotate: el.rotation ?? 0,
    transparency: el.opacity !== undefined ? Math.round((1 - el.opacity) * 100) : 0,
  }
}

/** Header row (if any) uses headerFill/headerColor and bold text; body rows use fontSize/color/fontFamily. */
export function linkedTableRows(
  el: LinkedTableElement,
  themeFont: string,
  themeColor: string,
): PptxGenJS.TableRow[] {
  const fontFace = el.fontFamily || themeFont
  const fontSize = pxToPt(el.fontSize ?? 16)
  const bodyColor = hex(el.color, hex(themeColor))
  const headerFill = hex(el.headerFill, '2563EB')
  const headerColor = hex(el.headerColor, 'FFFFFF')
  return el.link.snapshot.map((row, ri) => {
    const isHeader = !!el.link.headerRow && ri === 0
    return row.map((text) => ({
      text,
      options: {
        fontFace,
        fontSize,
        color: isHeader ? headerColor : bodyColor,
        bold: isHeader,
        fill: isHeader ? { color: headerFill } : undefined,
        align: 'left' as const,
        valign: 'middle' as const,
        margin: [0.03, 0.07, 0.03, 0.07] as [number, number, number, number],
      },
    }))
  })
}

export function linkedTableOptions(el: LinkedTableElement): PptxGenJS.TableProps {
  return {
    x: pxToIn(el.x),
    y: pxToIn(el.y),
    w: pxToIn(el.w),
    h: pxToIn(el.h),
    border: { type: 'solid', color: 'D1D5DB', pt: 0.75 },
    autoPage: false,
  }
}

function addSlideContent(pptx: InstanceType<typeof PptxGenJS>, slide: Slide, themeId: string) {
  const theme = getTheme(themeId)
  const s = pptx.addSlide()
  s.background = backgroundFill(slide.background, theme.bg)
  for (const el of slide.elements) {
    if (el.kind === 'text') {
      s.addText(el.text, textElementOptions(el, theme.bodyFont, theme.bodyColor))
    } else if (el.kind === 'shape') {
      if (el.shape === 'line') {
        s.addShape('line', lineShapeOptions(el))
      } else {
        s.addText(el.text || '', shapeTextOptions(el))
      }
    } else if (el.kind === 'image') {
      s.addImage(imageElementOptions(el))
    } else if (el.kind === 'linked') {
      s.addTable(linkedTableRows(el, theme.bodyFont, theme.bodyColor), linkedTableOptions(el))
    }
  }
  if (slide.notes) s.addNotes(slide.notes)
  return s
}

/** Build the full deck and return it base64-encoded, ready for platform.saveFile. */
export async function exportPptx(content: SlidesContent): Promise<string> {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'ANLEO_SLIDE', width: SLIDE_W / PX_PER_IN, height: SLIDE_H / PX_PER_IN })
  pptx.layout = 'ANLEO_SLIDE'
  const theme = getTheme(content.themeId)
  content.slides.forEach((slide, i) => {
    const s = addSlideContent(pptx, slide, content.themeId)
    if (content.showSlideNumbers && i > 0) {
      s.slideNumber = {
        x: pxToIn(SLIDE_W - 70),
        y: pxToIn(SLIDE_H - 42),
        fontSize: 11,
        color: hex(theme.bodyColor),
      }
    }
  })
  const out = await pptx.write({ outputType: 'base64' })
  return out as string
}
