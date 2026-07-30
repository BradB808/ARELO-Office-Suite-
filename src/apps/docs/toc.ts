// "Insert table of contents" — walks the current document's h1/h2/h3
// headings and inserts a static, styled snapshot at the cursor: a "Contents"
// heading followed by a nested list mirroring the heading hierarchy.
// Deliberately simple: it's a plain list, not a field/link — re-running the
// command never edits or replaces a prior TOC, it just inserts another one.

import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'

interface HeadingEntry {
  level: number
  text: string
}

interface TocNode extends HeadingEntry {
  children: TocNode[]
}

function collectHeadings(editor: Editor): HeadingEntry[] {
  const out: HeadingEntry[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'heading') {
      const level = (node.attrs.level as number) ?? 1
      if (level <= 3) {
        const text = node.textContent.trim()
        if (text) out.push({ level, text })
      }
    }
    return true
  })
  return out
}

/** Turn the flat, ordered heading list into a level-nested tree. Tolerant of
 *  skipped levels (e.g. h1 -> h3 directly nests the h3 under the h1). */
function buildTocTree(headings: HeadingEntry[]): TocNode[] {
  const root: TocNode[] = []
  const stack: TocNode[] = []
  for (const h of headings) {
    const node: TocNode = { ...h, children: [] }
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop()
    if (stack.length === 0) root.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return root
}

function tocTreeToList(nodes: TocNode[]): JSONContent {
  return {
    type: 'bulletList',
    content: nodes.map((n) => ({
      type: 'listItem',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: n.text }] },
        ...(n.children.length ? [tocTreeToList(n.children)] : []),
      ],
    })),
  }
}

/** Insert a static table-of-contents snapshot at the current cursor. */
export function insertTableOfContents(editor: Editor): void {
  const headings = collectHeadings(editor)
  const tree = buildTocTree(headings)

  const body: JSONContent[] = tree.length
    ? [tocTreeToList(tree)]
    : [{ type: 'paragraph', content: [{ type: 'text', text: 'No headings found.' }] }]

  editor
    .chain()
    .focus()
    .insertContent([
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Contents' }] },
      ...body,
      { type: 'paragraph' },
    ])
    .run()
}
