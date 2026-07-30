// Custom TipTap node: an explicit, user-inserted page break. Renders in the
// editor as a full-width dashed divider with a small "Page break" pill; a
// true schema-level atom so it selects/deletes as one unit like an image or
// horizontal rule. Export mapping lives in export.ts (docx/PDF/markdown) and
// docs.css (print).

import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a page break at the current selection. */
      setPageBreak: () => ReturnType
    }
  }
}

/** Data attribute every renderer (export.ts, docs.css) keys off of. */
export const PAGE_BREAK_ATTR = 'data-page-break'

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  // Outrank extension-hard-break's default Mod-Enter binding (see the
  // priority docs in @tiptap/core — higher wins shared keymap conflicts)
  // so Cmd+Enter inserts a page break here instead of a <br>.
  priority: 200,

  parseHTML() {
    return [{ tag: `div[${PAGE_BREAK_ATTR}]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { [PAGE_BREAK_ATTR]: '', class: 'dx-page-break' }),
      ['span', { class: 'dx-page-break-label' }, 'Page break'],
    ]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name }).run()
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    }
  },
})
