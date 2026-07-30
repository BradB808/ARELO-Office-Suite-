// "What can I do here?" — every command available right now, grouped, plus the
// keyboard shortcuts. Opens from the ? button in the rail or with Cmd+/.

import React, { useEffect, useMemo, useState } from 'react'
import { Modal } from '../shared/ui'
import { getCommands, subscribeCommands, type Command } from '../shared/commands'

const KEYS: { keys: string; what: string }[] = [
  { keys: '⌘K', what: 'Open the command palette (search everything)' },
  { keys: '⌘/', what: 'Show this help' },
  { keys: '⌘N', what: 'New document' },
  { keys: '⌘O', what: 'Open a file' },
  { keys: '⌘S', what: 'Save' },
  { keys: '⇧⌘S', what: 'Save a copy as…' },
  { keys: '⌘Z / ⇧⌘Z', what: 'Undo / redo' },
  { keys: '⌘F', what: 'Find & replace (Docs, Sheets)' },
  { keys: '⌘J', what: 'AI assistant (Docs)' },
  { keys: '⌘⏎', what: 'Insert page break (Docs)' },
]

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [version, setVersion] = useState(0)
  useEffect(() => subscribeCommands(() => setVersion((v) => v + 1)), [])

  const groups = useMemo(() => {
    void version
    const out = new Map<string, Command[]>()
    for (const c of getCommands()) {
      const list = out.get(c.group) ?? []
      list.push(c)
      out.set(c.group, list)
    }
    return [...out.entries()]
  }, [version, open])

  if (!open) return null

  return (
    <Modal
      title="Keyboard shortcuts & commands"
      subtitle="Press ⌘K anywhere to search and run any of these."
      onClose={onClose}
      width={640}
    >
      <div className="help-section-title">Shortcuts</div>
      <div className="help-keys">
        {KEYS.map((k) => (
          <div className="help-key-row" key={k.keys}>
            <span className="kbd">{k.keys}</span>
            <span>{k.what}</span>
          </div>
        ))}
      </div>

      <div className="help-section-title" style={{ marginTop: 20 }}>
        Available now ({getCommands().length} commands)
      </div>
      <div className="help-cmds">
        {groups.map(([group, cmds]) => (
          <div key={group} className="help-group">
            <div className="help-group-name">{group}</div>
            <ul>
              {cmds.map((c) => (
                <li key={c.id}>
                  {c.title}
                  {c.hint && <span className="help-hint"> {c.hint}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="help-foot">
        Commands change with what you're doing — open a spreadsheet or a deck and this list
        updates with that app's tools.
      </div>
    </Modal>
  )
}
