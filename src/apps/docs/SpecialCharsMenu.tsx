// Toolbar "Ω" button: a popover of glyph grids grouped into category tabs.
// Clicking a glyph inserts it at the cursor and keeps the popover open so
// several characters can be inserted in a row; Esc (handled by the shared
// Popover component) closes it.

import React, { useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Popover, Segmented } from '../../shared/ui'

interface CharCategory {
  name: string
  chars: string[]
}

const CATEGORIES: CharCategory[] = [
  {
    name: 'Arrows',
    chars: ['←', '→', '↑', '↓', '↔', '↕', '⇐', '⇒', '⇑', '⇓', '⇔', '⇕', '↖', '↗', '↘', '↙', '↩', '↪', '↺', '↻', '⤴', '⤵', '⟵', '⟶', '⟷', '➔', '➤', '⇢'],
  },
  {
    name: 'Math',
    chars: ['±', '×', '÷', '≠', '≈', '≤', '≥', '√', '∞', '∑', '∏', '∫', '∂', '∆', '∇', '°', '‰', '∝', '∴', '∵', '∈', '∉', '⊂', '⊃', '∪', '∩', '⊕', '⊗'],
  },
  {
    name: 'Currency',
    chars: ['$', '€', '£', '¥', '¢', '₹', '₩', '₽', '₺', '₴', '₦', '₪', '₫', '฿', '₱', '₡', '₲', '₵', '₸', '₭', '₮', '₼', '₾', '₠', '₢', '₣', '₤', '₧'],
  },
  {
    name: 'Symbols',
    chars: ['©', '®', '™', '§', '¶', '†', '‡', '•', '★', '☆', '♠', '♣', '♥', '♦', '♪', '♫', '☀', '☁', '☂', '☃', '✓', '✗', '✔', '✘', '☎', '✉', '⌘', '⌥'],
  },
  {
    name: 'Greek',
    chars: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Γ', 'Δ', 'Θ', 'Ω'],
  },
]

export function SpecialCharsMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0].name)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const active = CATEGORIES.find((c) => c.name === category) ?? CATEGORIES[0]

  const insert = (ch: string) => {
    editor.chain().focus().insertContent(ch).run()
  }

  return (
    <>
      <button
        ref={btnRef}
        className="iconbtn"
        title="Special characters"
        aria-label="Special characters"
        data-special-chars-trigger=""
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1 }}>Ω</span>
      </button>
      {open && (
        <Popover anchor={btnRef.current} onClose={() => setOpen(false)} width={306}>
          <div className="dx-charmenu">
            <Segmented
              value={category}
              onChange={setCategory}
              options={CATEGORIES.map((c) => ({ value: c.name, label: c.name }))}
            />
            <div className="dx-char-grid">
              {active.chars.map((ch, i) => (
                <button key={`${ch}-${i}`} type="button" className="dx-char-btn" title={ch} onClick={() => insert(ch)}>
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </Popover>
      )}
    </>
  )
}
