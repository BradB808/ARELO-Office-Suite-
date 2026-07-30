// Main editor toolbar: insert tools, slide-level controls (background, theme,
// transition), z-order, contextual formatting for the current selection, and
// the right-side notes/export/present cluster.

import React, { useEffect, useRef, useState } from 'react'
import type { Slide, SlideBackground, SlideElement, ShapeElement, ShapeKind, SlidesTheme } from '../../shared/types'
import { linkLabel } from '../../shared/livelink'
import { IcExport } from '../../shared/icons'
import { AiButton } from '../../shared/AiButton'
import { Button, ColorGrid, ColorPickerButton, IconBtn, MenuButton, Popover, Segmented, Select, Spacer, ToolbarDivider } from '../../shared/ui'
import { SYSTEM_FONTS, cssFamily, getCustomFonts, installFontsViaPicker, subscribeFonts } from '../../shared/fonts'
import { SLIDES_THEMES } from './themes'
import { backgroundStyle } from './SlideView'
import { SHAPE_KINDS, shapePath } from './shapes'
import { currentListMode, nextListPatch, clearTextFormatting, type AlignMode, type ElementPatch, type ZOrderAction } from './elementOps'
import { SHAPE_QUICK_STYLES, type ShapeQuickStylePatch } from './quickStyles'
import {
  IcAlignC,
  IcAlignL,
  IcAlignObjects,
  IcAlignR,
  IcArrowEnd,
  IcArrowStart,
  IcBackground,
  IcBackward,
  IcBold,
  IcBringFront,
  IcBullets,
  IcClearFormat,
  IcCornerRadius,
  IcDistribute,
  IcForward,
  IcHeaderRow,
  IcImageAdd,
  IcItalic,
  IcLineHeight,
  IcNotes,
  IcNumbered,
  IcOpacity,
  IcPresent,
  IcQuickStyles,
  IcRefresh,
  IcReplace,
  IcSendBack,
  IcShape,
  IcSlideNumber,
  IcTable,
  IcTextBox,
  IcUnderline,
  IcValignBot,
  IcValignMid,
  IcValignTop,
} from './icons'

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 54, 60, 66, 72, 80, 96, 110, 130]
const LINE_HEIGHTS = [
  { value: 1, label: '1.0' },
  { value: 1.15, label: '1.15' },
  { value: 1.35, label: '1.35' },
  { value: 1.5, label: '1.5' },
  { value: 2, label: '2.0' },
  { value: 2.5, label: '2.5' },
  { value: 3, label: '3.0' },
]
const STROKE_WIDTHS = [0, 1, 2, 3, 4]

function ShapePickerGrid({ onPick }: { onPick: (kind: ShapeKind) => void }) {
  return (
    <div className="px-shape-grid">
      {SHAPE_KINDS.map(({ kind, label }) => (
        <button key={kind} className="px-shape-cell" title={label} onClick={() => onPick(kind)}>
          <svg viewBox="0 0 28 22" width="28" height="22">
            {kind === 'line' ? (
              <line x1={2} y1={20} x2={26} y2={2} stroke="var(--text-2)" strokeWidth={2} strokeLinecap="round" />
            ) : (
              <path d={shapePath(kind, 26, 20)} transform="translate(1,1)" fill="var(--text-2)" />
            )}
          </svg>
        </button>
      ))}
    </div>
  )
}

function ThemeSwatch({ theme }: { theme: SlidesTheme }) {
  return (
    <span
      style={{
        width: 15,
        height: 15,
        borderRadius: 4,
        display: 'inline-block',
        border: '1px solid var(--border-strong)',
        flexShrink: 0,
        ...backgroundStyle(undefined, theme),
      }}
    />
  )
}

function BackgroundPanel({
  bg,
  onChange,
  onPickImage,
}: {
  bg: SlideBackground | undefined
  /** `live: true` marks a mid-drag tick (color/angle sliders) — the caller coalesces these into one undo step. */
  onChange: (bg: SlideBackground | undefined, live?: boolean) => void
  onPickImage: () => void
}) {
  const [tab, setTab] = useState<'solid' | 'gradient' | 'image'>(bg?.type === 'image' ? 'image' : bg?.type === 'gradient' ? 'gradient' : 'solid')
  return (
    <div style={{ padding: 6, width: 284 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as 'solid' | 'gradient' | 'image')}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'image', label: 'Image' },
          ]}
        />
      </div>
      {tab === 'solid' && (
        <ColorGrid value={bg?.type === 'solid' ? bg.color : undefined} onPick={(c) => onChange({ type: 'solid', color: c })} />
      )}
      {tab === 'gradient' && (
        <div style={{ padding: '4px 6px 8px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>From</label>
            <input
              type="color"
              value={bg?.type === 'gradient' ? bg.from || '#111827' : '#111827'}
              onChange={(e) =>
                onChange({ type: 'gradient', from: e.target.value, to: bg?.type === 'gradient' ? bg.to || '#374151' : '#374151', angle: bg?.type === 'gradient' ? (bg.angle ?? 135) : 135 }, true)
              }
              style={{ width: 30, height: 26, border: 'none', cursor: 'pointer' }}
            />
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>To</label>
            <input
              type="color"
              value={bg?.type === 'gradient' ? bg.to || '#374151' : '#374151'}
              onChange={(e) =>
                onChange({ type: 'gradient', from: bg?.type === 'gradient' ? bg.from || '#111827' : '#111827', to: e.target.value, angle: bg?.type === 'gradient' ? (bg.angle ?? 135) : 135 }, true)
              }
              style={{ width: 30, height: 26, border: 'none', cursor: 'pointer' }}
            />
          </div>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
            Angle: {bg?.type === 'gradient' ? (bg.angle ?? 135) : 135}°
          </label>
          <input
            type="range"
            min={0}
            max={360}
            value={bg?.type === 'gradient' ? (bg.angle ?? 135) : 135}
            onChange={(e) =>
              onChange(
                {
                  type: 'gradient',
                  from: bg?.type === 'gradient' ? bg.from || '#111827' : '#111827',
                  to: bg?.type === 'gradient' ? bg.to || '#374151' : '#374151',
                  angle: Number(e.target.value),
                },
                true,
              )
            }
            style={{ width: '100%' }}
          />
        </div>
      )}
      {tab === 'image' && (
        <div style={{ padding: '6px 4px' }}>
          <Button variant="outline" onClick={onPickImage} style={{ width: '100%' }}>
            Choose image…
          </Button>
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
        <Button small variant="soft" onClick={() => onChange(undefined)} style={{ width: '100%' }}>
          Use theme default
        </Button>
      </div>
    </div>
  )
}

type ShapeGradient = NonNullable<ShapeElement['gradient']>

function ShapeFillPanel({
  fill,
  gradient,
  onSolid,
  onGradient,
}: {
  fill: string | undefined
  gradient: ShapeGradient | undefined
  onSolid: (c: string) => void
  /** `live: true` marks a mid-drag angle-slider tick — the caller coalesces these into one undo step. */
  onGradient: (g: ShapeGradient | undefined, live?: boolean) => void
}) {
  const [tab, setTab] = useState<'solid' | 'gradient'>(gradient ? 'gradient' : 'solid')
  const [stop, setStop] = useState<'from' | 'to'>('from')
  const from = gradient?.from || '#2563eb'
  const to = gradient?.to || '#7c3aed'
  const angle = gradient?.angle ?? 135

  function pickStop(c: string) {
    onGradient({ from: stop === 'from' ? c : from, to: stop === 'to' ? c : to, angle })
  }

  return (
    <div style={{ padding: 6, width: 284 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as 'solid' | 'gradient')}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'gradient', label: 'Gradient' },
          ]}
        />
      </div>
      {tab === 'solid' && <ColorGrid value={fill} onPick={onSolid} />}
      {tab === 'gradient' && (
        <div style={{ padding: '4px 6px 8px' }}>
          <div
            style={{
              display: 'flex',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 8,
              background: 'linear-gradient(90deg, ' + from + ', ' + to + ')',
              height: 8,
            }}
          />
          <div style={{ marginBottom: 8 }}>
            <Segmented
              value={stop}
              onChange={(v) => setStop(v as 'from' | 'to')}
              options={[
                {
                  value: 'from',
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: from, display: 'inline-block' }} />
                      From
                    </span>
                  ),
                },
                {
                  value: 'to',
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: to, display: 'inline-block' }} />
                      To
                    </span>
                  ),
                },
              ]}
            />
          </div>
          <ColorGrid value={stop === 'from' ? from : to} onPick={pickStop} />
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', margin: '6px 0 4px' }}>Angle: {angle}°</label>
          <input
            type="range"
            min={0}
            max={360}
            value={angle}
            onChange={(e) => onGradient({ from, to, angle: Number(e.target.value) }, true)}
            style={{ width: '100%' }}
          />
        </div>
      )}
      {gradient && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
          <Button small variant="soft" onClick={() => onGradient(undefined)} style={{ width: '100%' }}>
            Clear gradient
          </Button>
        </div>
      )}
    </div>
  )
}

function ShapeFillButton({
  fill,
  gradient,
  onSolid,
  onGradient,
}: {
  fill: string | undefined
  gradient: ShapeGradient | undefined
  onSolid: (c: string) => void
  onGradient: (g: ShapeGradient | undefined, live?: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement | null>(null)
  const barStyle: React.CSSProperties = gradient
    ? { background: `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})` }
    : { background: fill || 'var(--text-3)' }
  return (
    <>
      <button ref={ref} className={'iconbtn' + (open ? ' active' : '')} title="Fill color" aria-label="Fill color" onClick={() => setOpen((o) => !o)}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <IcShape />
          <span style={{ width: 15, height: 3, borderRadius: 2, display: 'block', ...barStyle }} />
        </span>
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={288}>
          <ShapeFillPanel fill={fill} gradient={gradient} onSolid={onSolid} onGradient={onGradient} />
        </Popover>
      )}
    </>
  )
}

function ShapeQuickStylesButton({ theme, onApply }: { theme: SlidesTheme; onApply: (patch: ShapeQuickStylePatch) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement | null>(null)
  return (
    <>
      <button ref={ref} className={'iconbtn' + (open ? ' active' : '')} title="Quick styles" aria-label="Quick styles" onClick={() => setOpen((o) => !o)}>
        <IcQuickStyles />
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={168}>
          <div className="px-shape-grid">
            {SHAPE_QUICK_STYLES.map((qs) => {
              const patch = qs.build(theme)
              const swatchStyle: React.CSSProperties = patch.gradient
                ? { background: `linear-gradient(${patch.gradient.angle}deg, ${patch.gradient.from}, ${patch.gradient.to})` }
                : { background: patch.fill }
              return (
                <button
                  key={qs.id}
                  className="px-shape-cell"
                  title={qs.name}
                  onClick={() => {
                    onApply(patch)
                    setOpen(false)
                  }}
                >
                  <span
                    className="px-style-swatch"
                    style={{
                      ...swatchStyle,
                      borderColor: patch.stroke || 'transparent',
                      borderWidth: patch.stroke ? Math.min(4, Math.max(1.5, patch.strokeWidth / 1.4)) : 1,
                      color: patch.color,
                    }}
                  >
                    Aa
                  </span>
                </button>
              )
            })}
          </div>
        </Popover>
      )}
    </>
  )
}

function useFontOptions() {
  const [custom, setCustom] = useState(getCustomFonts())
  useEffect(() => subscribeFonts(() => setCustom(getCustomFonts())), [])
  return custom
}

export function Toolbar({
  themeId,
  onThemeChange,
  slide,
  onBackgroundChange,
  onPickBackgroundImage,
  onTransitionChange,
  selected,
  onAddText,
  onAddShape,
  onAddImage,
  onZOrder,
  onPatch,
  onReplaceImage,
  onAlign,
  onDistribute,
  notesOpen,
  onToggleNotes,
  showSlideNumbers,
  onToggleSlideNumbers,
  onExportNative,
  onExportPptx,
  onExportPdf,
  onExportLiving,
  onPresent,
  hasLinkClipboard,
  onPasteLiveRange,
  onRefreshLinks,
  aiOpen,
  onOpenAiBuilder,
}: {
  themeId: string
  onThemeChange: (id: string) => void
  slide: Slide
  /** `live: true` marks a mid-drag tick (color/angle/opacity sliders) — coalesced into one undo step. */
  onBackgroundChange: (bg: SlideBackground | undefined, live?: boolean) => void
  onPickBackgroundImage: () => void
  onTransitionChange: (t: NonNullable<Slide['transition']>) => void
  selected: SlideElement[]
  onAddText: () => void
  onAddShape: (kind: ShapeKind) => void
  onAddImage: () => void
  onZOrder: (action: ZOrderAction) => void
  onPatch: (patch: ElementPatch, live?: boolean) => void
  onReplaceImage: () => void
  onAlign: (mode: AlignMode) => void
  onDistribute: (axis: 'horizontal' | 'vertical') => void
  notesOpen: boolean
  onToggleNotes: () => void
  showSlideNumbers: boolean
  onToggleSlideNumbers: () => void
  onExportNative: () => void
  onExportPptx: () => void
  onExportPdf: () => void
  onExportLiving: () => void
  onPresent: () => void
  /** Whether a live range is sitting in the cross-app clipboard, ready to paste. */
  hasLinkClipboard: boolean
  onPasteLiveRange: () => void
  onRefreshLinks: () => void
  /** Whether the AI deck builder modal is currently open. */
  aiOpen: boolean
  onOpenAiBuilder: () => void
}) {
  const customFonts = useFontOptions()
  const bgBtnRef = useRef<HTMLButtonElement | null>(null)
  const [bgOpen, setBgOpen] = useState(false)
  const shapeBtnRef = useRef<HTMLButtonElement | null>(null)
  const [shapeOpen, setShapeOpen] = useState(false)

  const hasSelection = selected.length > 0
  const texts = selected.filter((e): e is Extract<SlideElement, { kind: 'text' }> => e.kind === 'text')
  const shapesSel = selected.filter((e): e is Extract<SlideElement, { kind: 'shape' }> => e.kind === 'shape')
  const images = selected.filter((e): e is Extract<SlideElement, { kind: 'image' }> => e.kind === 'image')
  const linked = selected.filter((e): e is Extract<SlideElement, { kind: 'linked' }> => e.kind === 'linked')
  const firstText = texts[0]
  const firstShape = shapesSel[0]
  const firstImage = images[0]
  const firstLinked = linked[0]
  const first = selected[0]
  const currentTheme = SLIDES_THEMES.find((t) => t.id === themeId) || SLIDES_THEMES[0]

  async function handleFontChange(v: string) {
    if (v === '__install__') {
      const installed = await installFontsViaPicker()
      if (installed[0]) onPatch({ fontFamily: installed[0] })
      return
    }
    onPatch({ fontFamily: v })
  }

  const fontOptions = [
    ...SYSTEM_FONTS.map((f) => ({ value: f, label: <span style={{ fontFamily: cssFamily(f) }}>{f}</span> })),
    ...customFonts.map((f) => ({ value: f, label: <span style={{ fontFamily: cssFamily(f) }}>{f}</span> })),
    { value: '__install__', label: <span style={{ color: 'var(--accent)' }}>Install font…</span> },
  ]

  return (
    <div className="toolbar px-toolbar">
      <IconBtn label="Add text box" onClick={onAddText}>
        <IcTextBox />
      </IconBtn>
      <button ref={shapeBtnRef} className={'iconbtn' + (shapeOpen ? ' active' : '')} title="Add shape" aria-label="Add shape" onClick={() => setShapeOpen((o) => !o)}>
        <IcShape />
      </button>
      {shapeOpen && (
        <Popover anchor={shapeBtnRef.current} onClose={() => setShapeOpen(false)} width={190}>
          <ShapePickerGrid
            onPick={(kind) => {
              onAddShape(kind)
              setShapeOpen(false)
            }}
          />
        </Popover>
      )}
      <ToolbarDivider />
      <IconBtn label="Add image" onClick={onAddImage}>
        <IcImageAdd />
      </IconBtn>
      <IconBtn
        label={hasLinkClipboard ? 'Paste live range' : 'Paste live range — copy a range from Sheets first'}
        onClick={onPasteLiveRange}
        disabled={!hasLinkClipboard}
      >
        <IcTable />
      </IconBtn>
      <IconBtn label="Refresh links" onClick={onRefreshLinks}>
        <IcRefresh />
      </IconBtn>

      <ToolbarDivider />

      <button ref={bgBtnRef} className={'iconbtn' + (bgOpen ? ' active' : '')} title="Slide background" aria-label="Slide background" onClick={() => setBgOpen((o) => !o)}>
        <IcBackground />
      </button>
      {bgOpen && (
        <Popover anchor={bgBtnRef.current} onClose={() => setBgOpen(false)}>
          <BackgroundPanel bg={slide.background} onChange={onBackgroundChange} onPickImage={onPickBackgroundImage} />
        </Popover>
      )}

      <Select
        value={themeId}
        onChange={onThemeChange}
        width={148}
        triggerLabel={
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ThemeSwatch theme={SLIDES_THEMES.find((t) => t.id === themeId) || SLIDES_THEMES[0]} />
            {(SLIDES_THEMES.find((t) => t.id === themeId) || SLIDES_THEMES[0]).name}
          </span>
        }
        options={SLIDES_THEMES.map((t) => ({
          value: t.id,
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ThemeSwatch theme={t} />
              {t.name}
            </span>
          ),
        }))}
      />

      <Select
        value={slide.transition || 'none'}
        onChange={(v) => onTransitionChange(v as NonNullable<Slide['transition']>)}
        width={104}
        options={[
          { value: 'none', label: 'No transition' },
          { value: 'fade', label: 'Fade' },
          { value: 'slide', label: 'Slide' },
        ]}
      />

      <ToolbarDivider />

      <MenuButton
        label="Arrange"
        trigger={<IcBringFront />}
        items={
          hasSelection
            ? [
                { label: 'Bring to front', icon: <IcBringFront />, onClick: () => onZOrder('front') },
                { label: 'Bring forward', icon: <IcForward />, onClick: () => onZOrder('forward') },
                { label: 'Send backward', icon: <IcBackward />, onClick: () => onZOrder('backward') },
                { label: 'Send to back', icon: <IcSendBack />, onClick: () => onZOrder('back') },
              ]
            : [{ label: 'Select an element first', onClick: () => {}, disabled: true }]
        }
      />

      <MenuButton
        label="Align & distribute"
        trigger={<IcAlignObjects />}
        items={
          hasSelection
            ? [
                { header: selected.length > 1 ? 'Align to selection' : 'Align to slide' },
                { label: 'Align left', icon: <IcAlignL />, onClick: () => onAlign('left') },
                { label: 'Align center', icon: <IcAlignC />, onClick: () => onAlign('center') },
                { label: 'Align right', icon: <IcAlignR />, onClick: () => onAlign('right') },
                { label: 'Align top', icon: <IcValignTop />, onClick: () => onAlign('top') },
                { label: 'Align middle', icon: <IcValignMid />, onClick: () => onAlign('middle') },
                { label: 'Align bottom', icon: <IcValignBot />, onClick: () => onAlign('bottom') },
                'sep',
                {
                  label: 'Distribute horizontally',
                  icon: <IcDistribute />,
                  disabled: selected.length < 3,
                  onClick: () => onDistribute('horizontal'),
                },
                {
                  label: 'Distribute vertically',
                  icon: <IcDistribute />,
                  disabled: selected.length < 3,
                  onClick: () => onDistribute('vertical'),
                },
              ]
            : [{ label: 'Select an element first', onClick: () => {}, disabled: true }]
        }
      />

      {hasSelection && <ToolbarDivider />}

      {texts.length > 0 && firstText && (
        <>
          <Select value={firstText.fontFamily || 'System (San Francisco)'} onChange={handleFontChange} width={150} options={fontOptions} />
          <NumberField value={firstText.fontSize ?? 24} min={6} max={400} onChange={(v) => onPatch({ fontSize: v })} presets={FONT_SIZES} />
          <IconBtn label="Clear formatting" onClick={() => onPatch(clearTextFormatting())}>
            <IcClearFormat />
          </IconBtn>
          <IconBtn label="Bold" active={texts.every((t) => t.bold)} onClick={() => onPatch({ bold: !texts.every((t) => t.bold) })}>
            <IcBold />
          </IconBtn>
          <IconBtn label="Italic" active={texts.every((t) => t.italic)} onClick={() => onPatch({ italic: !texts.every((t) => t.italic) })}>
            <IcItalic />
          </IconBtn>
          <IconBtn label="Underline" active={texts.every((t) => t.underline)} onClick={() => onPatch({ underline: !texts.every((t) => t.underline) })}>
            <IcUnderline />
          </IconBtn>
          <ColorPickerButton label="Text color" icon={<span style={{ fontWeight: 700, fontSize: 13 }}>A</span>} value={firstText.color} onPick={(c) => onPatch({ color: c })} />
          <ToolbarDivider />
          <IconBtn label="Align left" active={(firstText.align || 'left') === 'left'} onClick={() => onPatch({ align: 'left' })}>
            <IcAlignL />
          </IconBtn>
          <IconBtn label="Align center" active={firstText.align === 'center'} onClick={() => onPatch({ align: 'center' })}>
            <IcAlignC />
          </IconBtn>
          <IconBtn label="Align right" active={firstText.align === 'right'} onClick={() => onPatch({ align: 'right' })}>
            <IcAlignR />
          </IconBtn>
          <IconBtn label="Align top" active={(firstText.valign || 'top') === 'top'} onClick={() => onPatch({ valign: 'top' })}>
            <IcValignTop />
          </IconBtn>
          <IconBtn label="Align middle" active={firstText.valign === 'middle'} onClick={() => onPatch({ valign: 'middle' })}>
            <IcValignMid />
          </IconBtn>
          <IconBtn label="Align bottom" active={firstText.valign === 'bottom'} onClick={() => onPatch({ valign: 'bottom' })}>
            <IcValignBot />
          </IconBtn>
          <ToolbarDivider />
          <Select
            value={String(firstText.lineHeight ?? 1.25)}
            onChange={(v) => onPatch({ lineHeight: Number(v) })}
            width={72}
            triggerLabel={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IcLineHeight /> {(firstText.lineHeight ?? 1.25).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}
              </span>
            }
            options={LINE_HEIGHTS.map((l) => ({ value: String(l.value), label: l.label }))}
          />
          <IconBtn
            label={
              currentListMode(firstText) === 'none'
                ? 'List: none — click for bulleted list'
                : currentListMode(firstText) === 'bullets'
                  ? 'List: bulleted — click for numbered list'
                  : 'List: numbered — click to remove list'
            }
            active={currentListMode(firstText) !== 'none'}
            onClick={() => onPatch(nextListPatch(currentListMode(firstText)))}
          >
            {currentListMode(firstText) === 'numbered' ? <IcNumbered /> : <IcBullets />}
          </IconBtn>
        </>
      )}

      {shapesSel.length > 0 && firstShape && (
        <>
          {firstShape.shape === 'line' ? (
            <ColorPickerButton label="Fill color" icon={<IcShape />} value={firstShape.fill} onPick={(c) => onPatch({ fill: c })} />
          ) : (
            <ShapeFillButton
              fill={firstShape.fill}
              gradient={firstShape.gradient}
              onSolid={(c) => onPatch({ fill: c, gradient: undefined })}
              onGradient={(g, live) => onPatch({ gradient: g }, live)}
            />
          )}
          <ColorPickerButton label="Stroke color" icon={<span style={{ fontSize: 11 }}>Line</span>} value={firstShape.stroke} allowNone onPick={(c) => onPatch({ stroke: c || undefined })} />
          <Select
            value={String(firstShape.strokeWidth ?? 0)}
            onChange={(v) => onPatch({ strokeWidth: Number(v) })}
            width={64}
            options={STROKE_WIDTHS.map((w) => ({ value: String(w), label: `${w}px` }))}
          />
          {firstShape.shape === 'line' ? (
            <>
              <IconBtn label="Start arrow" active={!!firstShape.arrowStart} onClick={() => onPatch({ arrowStart: !firstShape.arrowStart })}>
                <IcArrowStart />
              </IconBtn>
              <IconBtn label="End arrow" active={!!firstShape.arrowEnd} onClick={() => onPatch({ arrowEnd: !firstShape.arrowEnd })}>
                <IcArrowEnd />
              </IconBtn>
            </>
          ) : (
            <>
              <ToolbarDivider />
              <ShapeQuickStylesButton theme={currentTheme} onApply={(patch) => onPatch(patch)} />
              <span className="px-hint" title="Double-click the shape on the canvas to edit its label">
                Double-click to label
              </span>
            </>
          )}
        </>
      )}

      {images.length > 0 && firstImage && (
        <>
          <OpacityPopover value={firstImage.opacity ?? 1} onChange={(v) => onPatch({ opacity: v }, true)} />
          <NumberField value={firstImage.borderRadius ?? 0} min={0} max={200} onChange={(v) => onPatch({ borderRadius: v })} icon={<IcCornerRadius />} />
          <IconBtn label="Replace image" onClick={onReplaceImage}>
            <IcReplace />
          </IconBtn>
        </>
      )}

      {linked.length > 0 && firstLinked && (
        <>
          <Select value={firstLinked.fontFamily || 'System (San Francisco)'} onChange={handleFontChange} width={150} options={fontOptions} />
          <NumberField value={firstLinked.fontSize ?? 16} min={6} max={120} onChange={(v) => onPatch({ fontSize: v })} presets={FONT_SIZES} />
          <ColorPickerButton
            label="Text color"
            icon={<span style={{ fontWeight: 700, fontSize: 13 }}>A</span>}
            value={firstLinked.color}
            onPick={(c) => onPatch({ color: c })}
          />
          <ToolbarDivider />
          <IconBtn
            label={firstLinked.link.headerRow ? 'Header row — click to remove' : 'No header row — click to add'}
            active={!!firstLinked.link.headerRow}
            onClick={() => onPatch({ link: { ...firstLinked.link, headerRow: !firstLinked.link.headerRow } })}
          >
            <IcHeaderRow />
          </IconBtn>
          <ColorPickerButton
            label="Header fill"
            icon={<IcTable />}
            value={firstLinked.headerFill}
            allowNone
            onPick={(c) => onPatch({ headerFill: c || undefined })}
          />
          <ColorPickerButton
            label="Header text color"
            icon={<span style={{ fontWeight: 700, fontSize: 13 }}>A</span>}
            value={firstLinked.headerColor}
            allowNone
            onPick={(c) => onPatch({ headerColor: c || undefined })}
          />
          <OpacityPopover value={firstLinked.opacity ?? 1} onChange={(v) => onPatch({ opacity: v }, true)} />
          <span className="px-hint" title={linkLabel(firstLinked.link)}>
            Live · {linkLabel(firstLinked.link)}
          </span>
        </>
      )}

      {hasSelection && shapesSel.length === 0 && images.length === 0 && linked.length === 0 && (
        <OpacityPopover value={first?.opacity ?? 1} onChange={(v) => onPatch({ opacity: v }, true)} />
      )}

      <Spacer />

      <IconBtn label={showSlideNumbers ? 'Hide slide numbers' : 'Show slide numbers'} active={showSlideNumbers} onClick={onToggleSlideNumbers}>
        <IcSlideNumber />
      </IconBtn>
      <IconBtn label={notesOpen ? 'Hide speaker notes' : 'Show speaker notes'} active={notesOpen} onClick={onToggleNotes}>
        <IcNotes />
      </IconBtn>
      <AiButton active={aiOpen} onClick={onOpenAiBuilder} label="AI assistant" />
      <MenuButton
        label="Export"
        align="right"
        trigger={<IcExport />}
        items={[
          { label: 'Save as .aslides', onClick: onExportNative },
          { label: 'PowerPoint (.pptx)', onClick: onExportPptx },
          { label: 'PDF (via Print…)', onClick: onExportPdf },
          { label: 'Share as web page (.html)', onClick: onExportLiving },
        ]}
      />
      <Button variant="primary" onClick={onPresent} style={{ gap: 6 }}>
        <IcPresent /> Present
      </Button>
    </div>
  )
}

function NumberField({
  value,
  min,
  max,
  onChange,
  presets,
  icon,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  presets?: number[]
  icon?: React.ReactNode
}) {
  const [text, setText] = useState(String(Math.round(value)))
  useEffect(() => setText(String(Math.round(value))), [value])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  function commit(v: string) {
    const n = Math.round(Number(v))
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
  }

  return (
    <div ref={ref} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
      {icon}
      <input
        className="px-numfield"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => presets && setOpen(true)}
        onBlur={() => {
          commit(text)
          setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(text)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {open && presets && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={64}>
          {presets.map((p) => (
            <button
              key={p}
              className="popover-item"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(p)
                setOpen(false)
              }}
            >
              {p}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}

function OpacityPopover({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement | null>(null)
  return (
    <>
      <button ref={ref} className={'iconbtn' + (open ? ' active' : '')} title="Opacity" aria-label="Opacity" onClick={() => setOpen((o) => !o)}>
        <IcOpacity />
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={180}>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Opacity — {Math.round(value * 100)}%</div>
            <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
        </Popover>
      )}
    </>
  )
}
