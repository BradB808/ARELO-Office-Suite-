// Shared UI kit. Zero-dependency React components styled by theme.css.

import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

// ---------- Button ----------

export function Button({
  variant,
  small,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'soft' | 'danger'
  small?: boolean
}) {
  const cls = ['btn', variant ?? '', small ? 'small' : ''].filter(Boolean).join(' ')
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

// ---------- IconButton ----------

export function IconBtn({
  active,
  label,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  label: string
}) {
  return (
    <button
      className={'iconbtn' + (active ? ' active' : '')}
      title={label}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ToolbarDivider() {
  return <div className="toolbar-divider" />
}

// ---------- Popover positioning ----------

export function usePopover() {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  return { open, setOpen, close, toggle, anchorRef }
}

export function Popover({
  anchor,
  onClose,
  children,
  width,
  align = 'left',
}: {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  width?: number
  align?: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    const w = width ?? ref.current?.offsetWidth ?? 160
    let left = align === 'right' ? r.right - w : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    let top = r.bottom + 4
    const h = ref.current?.offsetHeight ?? 200
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4)
    setPos({ top, left })
  }, [anchor, width, align])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor?.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchor])

  return createPortal(
    <div
      className="popover"
      ref={ref}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
    >
      {children}
    </div>,
    document.body,
  )
}

// ---------- Select ----------

export interface SelectOption {
  value: string
  label: ReactNode
  labelStyle?: React.CSSProperties
}

export function Select({
  value,
  options,
  onChange,
  width,
  triggerLabel,
  compact,
}: {
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  width?: number
  /** Override what shows in the closed trigger. */
  triggerLabel?: ReactNode
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const current = options.find((o) => o.value === value)
  return (
    <>
      <button
        ref={btnRef}
        className="select-trigger"
        style={{ width, height: compact ? 26 : undefined }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            textAlign: 'left',
          }}
        >
          {triggerLabel ?? current?.label ?? value}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <Popover anchor={btnRef.current} onClose={() => setOpen(false)} width={width && width > 150 ? width : undefined}>
          {options.map((o) => (
            <button
              key={o.value}
              className={'popover-item' + (o.value === value ? ' selected' : '')}
              style={o.labelStyle}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              {o.label}
            </button>
          ))}
        </Popover>
      )}
    </>
  )
}

// ---------- Menu (icon/button trigger + arbitrary items) ----------

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export function MenuButton({
  trigger,
  items,
  label,
  align = 'left',
}: {
  trigger: ReactNode
  items: (MenuItem | 'sep' | { header: string })[]
  label: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  return (
    <>
      <button
        ref={btnRef}
        className="iconbtn"
        style={{ width: 'auto', paddingLeft: 6, paddingRight: 6 }}
        title={label}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <Popover anchor={btnRef.current} onClose={() => setOpen(false)} align={align}>
          {items.map((it, i) =>
            it === 'sep' ? (
              <div key={i} className="popover-sep" />
            ) : 'header' in it ? (
              <div key={i} className="popover-label">
                {it.header}
              </div>
            ) : (
              <button
                key={i}
                className={'popover-item' + (it.danger ? ' danger' : '')}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
              >
                {it.icon}
                {it.label}
              </button>
            ),
          )}
        </Popover>
      )}
    </>
  )
}

// ---------- Modal ----------

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  width,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: width ? `min(${width}px, 94vw)` : undefined }}>
        <h3>{title}</h3>
        {subtitle && <div className="modal-sub">{subtitle}</div>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ---------- Segmented control ----------

export function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: ReactNode }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Color picker ----------

export const PALETTE: string[] = [
  '#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6', '#ffffff', '#7c2d12', '#78350f',
  '#dc2626', '#ea580c', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#059669', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#2563eb', '#4f46e5', '#7c3aed', '#9333ea', '#c026d3', '#db2777', '#e11d48', '#f43f5e', '#fb7185', '#fda4af',
  '#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bbf7d0', '#a7f3d0', '#99f6e4', '#a5f3fc', '#bae6fd', '#bfdbfe',
  '#c7d2fe', '#ddd6fe', '#e9d5ff', '#f5d0fe', '#fbcfe8', '#fecdd3', '#1e3a8a', '#065f46', '#7f1d1d', '#581c87',
]

/** "1a73e8", "#1A73E8", "abc" → "#1a73e8" / "#aabbcc"; null when not a valid hex. */
export function normalizeHex(input: string): string | null {
  let v = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(v)) v = v.split('').map((c) => c + c).join('')
  return /^[0-9a-fA-F]{6}$/.test(v) ? '#' + v.toLowerCase() : null
}

export function ColorGrid({
  value,
  onPick,
  allowNone,
  noneLabel = 'None',
}: {
  value?: string
  onPick: (color: string) => void
  allowNone?: boolean
  noneLabel?: string
}) {
  const [hexDraft, setHexDraft] = useState(value && /^#/.test(value) ? value : '')
  const draftValid = normalizeHex(hexDraft)

  const applyHex = () => {
    const hex = normalizeHex(hexDraft)
    if (hex) onPick(hex)
  }

  return (
    <div>
      <div className="swatch-grid">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={'swatch' + (value === c ? ' selected' : '')}
            style={{ background: c }}
            title={c}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '2px 8px 8px', alignItems: 'center' }}>
        <input
          type="color"
          title="Pick a custom color"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#4f46e5'}
          onChange={(e) => {
            setHexDraft(e.target.value)
            onPick(e.target.value)
          }}
          style={{ width: 26, height: 26, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
        />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            padding: '0 7px',
            height: 26,
            flex: 1,
            minWidth: 0,
            background: 'var(--surface)',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              flexShrink: 0,
              background: draftValid ?? 'transparent',
              border: '1px solid var(--border)',
            }}
          />
          <input
            value={hexDraft}
            spellCheck={false}
            placeholder="#1a73e8"
            aria-label="Hex color"
            onChange={(e) => {
              setHexDraft(e.target.value)
              const hex = normalizeHex(e.target.value)
              if (hex) onPick(hex)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyHex()
              }
              e.stopPropagation()
            }}
            onBlur={applyHex}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              minWidth: 0,
              fontSize: 12,
              color: 'var(--text)',
              fontFamily: 'ui-monospace, Menlo, monospace',
            }}
          />
        </div>
        {allowNone && (
          <Button small onClick={() => onPick('')}>
            {noneLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

export function ColorPickerButton({
  label,
  icon,
  value,
  onPick,
  allowNone,
}: {
  label: string
  icon: ReactNode
  value?: string
  onPick: (color: string) => void
  allowNone?: boolean
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  return (
    <>
      <button ref={btnRef} className="iconbtn" title={label} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          {icon}
          <span
            style={{
              width: 15,
              height: 3,
              borderRadius: 2,
              background: value || 'var(--text-3)',
              display: 'block',
            }}
          />
        </span>
      </button>
      {open && (
        <Popover anchor={btnRef.current} onClose={() => setOpen(false)} width={288}>
          <ColorGrid
            value={value}
            allowNone={allowNone}
            onPick={(c) => {
              onPick(c)
              setOpen(false)
            }}
          />
        </Popover>
      )}
    </>
  )
}

// ---------- Misc ----------

export function Spacer() {
  return <div style={{ flex: 1 }} />
}
