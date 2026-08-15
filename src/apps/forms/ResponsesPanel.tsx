// Where the author reads what came back. There is no inbox to poll: replies
// arrive as .aresp files or pasted codes that the author feeds in by hand, so
// importing is the primary action rather than an afterthought.

import React, { useMemo, useRef, useState } from 'react'
import type { FormQuestion, FormResponse, FormsContent } from '../../shared/types'
import { platform } from '../../shared/platform'
import { Button, MenuButton, Modal, Segmented, Spacer, type MenuItem } from '../../shared/ui'
import { IcExport, IcMore, IcSheets, IcTrash } from '../../shared/icons'
import { answerToText, isAnswerable, questionNumbers } from './model'
import { parseResponsePayload, responsesToCsv, responsesToSheet, summarize, type Summary } from './responses'
import './responses.css'

const ARESP_FILTER = [{ name: 'Anleo response', extensions: ['aresp'] }]

interface Note {
  kind: 'ok' | 'warn' | 'err'
  text: string
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function whenText(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function SummaryCard({ summary, number }: { summary: Summary; number: number | undefined }) {
  const q = summary.question
  const total = Math.max(1, summary.answered)

  return (
    <section className="fm-resp-card">
      <div className="fm-resp-qhead">
        {number !== undefined && <span className="fm-resp-num">{number}.</span>}
        <h4 className="fm-resp-qtitle">{q.title || 'Untitled question'}</h4>
      </div>
      <div className="fm-resp-qmeta">
        {plural(summary.answered, 'answer', 'answers')}
        {summary.skipped > 0 && ` · ${summary.skipped} skipped`}
        {summary.average !== null && (
          <>
            {' · '}
            <span className="fm-resp-avg">average {summary.average.toFixed(1)}</span>
          </>
        )}
      </div>

      {/* summarize() only fills buckets for the countable kinds, so the shape of
          the result picks the view rather than a second list of kinds here. */}
      {summary.buckets.length > 0 ? (
        <div className="fm-resp-bars">
          {summary.buckets.map((b, i) => {
            const pct = Math.round((b.count / total) * 100)
            return (
              <div className="fm-resp-bar-row" key={`${b.label}-${i}`}>
                <span className="fm-resp-bar-label" title={b.label}>
                  {b.label}
                </span>
                <div className="fm-resp-track">
                  {b.count > 0 && <div className="fm-resp-fill" style={{ width: `${Math.max(pct, 1)}%` }} />}
                </div>
                <span className="fm-resp-bar-n">
                  {b.count}
                  <span className="fm-resp-pct">{pct}%</span>
                </span>
              </div>
            )
          })}
        </div>
      ) : summary.texts.length === 0 ? (
        <div className="fm-resp-none">Nobody has answered this yet.</div>
      ) : (
        <ul className="fm-resp-texts">
          {summary.texts.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ResponseTable({
  questions,
  numbers,
  responses,
  onDelete,
}: {
  questions: FormQuestion[]
  numbers: Record<string, number>
  responses: FormResponse[]
  onDelete: (id: string) => void
}) {
  return (
    <div className="fm-resp-tablewrap">
      <table className="fm-resp-table">
        <thead>
          <tr>
            <th className="fm-resp-idx">#</th>
            <th>Submitted</th>
            {questions.map((q) => (
              <th key={q.id}>
                {numbers[q.id] !== undefined ? `${numbers[q.id]}. ` : ''}
                {q.title || 'Untitled question'}
              </th>
            ))}
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {responses.map((r, i) => (
            <tr key={r.id}>
              <td className="fm-resp-idx">{i + 1}</td>
              <td className="fm-resp-when">{whenText(r.submittedAt)}</td>
              {questions.map((q) => {
                const text = answerToText(q, r.answers[q.id])
                return (
                  <td className="fm-resp-cell" key={q.id} title={text}>
                    {text || <span className="fm-resp-blank">—</span>}
                  </td>
                )
              })}
              <td>
                <button
                  className="fm-resp-del"
                  title="Delete this response"
                  aria-label={`Delete response ${i + 1}`}
                  onClick={() => onDelete(r.id)}
                >
                  <IcTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ResponsesPanel({
  content,
  onChange,
  title,
}: {
  content: FormsContent
  onChange: (next: FormsContent) => void
  title: string
}) {
  const [view, setView] = useState<'summary' | 'table'>('summary')
  const [note, setNote] = useState<Note | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  // Imports run inside an await loop, so the props captured at click time go
  // stale after the first append. Everything mutating reads through this.
  const contentRef = useRef(content)
  contentRef.current = content

  const responses = content.responses
  const count = responses.length
  // The table brings its own scrolling, so the container around it has to stop.
  const showTable = count > 0 && view === 'table'

  const answerable = useMemo(() => content.questions.filter(isAnswerable), [content.questions])
  const numbers = useMemo(() => questionNumbers(content.questions), [content.questions])
  const summaries = useMemo(
    () => answerable.map((q) => summarize(q, responses)),
    [answerable, responses],
  )

  /** Returns false when that response is already collected. */
  function append(r: FormResponse): boolean {
    const current = contentRef.current
    if (current.responses.some((x) => x.id === r.id)) return false
    const next: FormsContent = { ...current, responses: [...current.responses, r] }
    contentRef.current = next
    onChange(next)
    return true
  }

  function removeResponse(id: string) {
    const current = contentRef.current
    const next: FormsContent = { ...current, responses: current.responses.filter((r) => r.id !== id) }
    contentRef.current = next
    onChange(next)
  }

  async function importFiles() {
    setNote(null)
    let added = 0
    let dupes = 0
    let bad = 0
    // The picker takes one file at a time and a batch of replies is the normal
    // case, so keep reopening it until they cancel.
    for (;;) {
      const res = await platform.openFile(ARESP_FILTER)
      if (res.canceled || !res.data) break
      const parsed = parseResponsePayload(res.data)
      if (!parsed) bad++
      else if (append(parsed)) added++
      else dupes++
    }
    if (added === 0 && dupes === 0 && bad === 0) return
    const parts: string[] = []
    if (added > 0) parts.push(`Imported ${plural(added, 'response', 'responses')}`)
    if (dupes > 0) parts.push(`${plural(dupes, 'response was', 'responses were')} already imported`)
    if (bad > 0) parts.push(`${plural(bad, 'file was', 'files were')} not an Anleo response`)
    setNote({ kind: added > 0 ? 'ok' : bad > 0 ? 'err' : 'warn', text: parts.join(' · ') })
  }

  function importPasted() {
    const parsed = parseResponsePayload(pasteText)
    if (!parsed) {
      setPasteError("That doesn't look like an Anleo response code.")
      return
    }
    if (!append(parsed)) {
      setPasteError('Already imported — this is a response you already have.')
      return
    }
    setPasteOpen(false)
    setPasteText('')
    setPasteError(null)
    setNote({ kind: 'ok', text: 'Imported 1 response' })
  }

  async function exportCsv() {
    setNote(null)
    const csv = responsesToCsv(content.questions, responses)
    const res = await platform.saveFile(`${title || 'Form'} responses.csv`, csv, [
      { name: 'CSV', extensions: ['csv'] },
    ])
    if (!res.canceled) setNote({ kind: 'ok', text: `Exported ${plural(count, 'response', 'responses')} to CSV` })
  }

  function openInSheets() {
    setNote(null)
    window.dispatchEvent(
      new CustomEvent('anleo-open-doc', {
        detail: {
          kind: 'sheets',
          title: `${title} — responses`,
          content: responsesToSheet(content.questions, responses),
        },
      }),
    )
  }

  function clearAll() {
    const next: FormsContent = { ...contentRef.current, responses: [] }
    contentRef.current = next
    onChange(next)
    setClearOpen(false)
    setNote({ kind: 'warn', text: 'All responses deleted' })
  }

  const menuItems: (MenuItem | 'sep' | { header: string })[] = [
    { label: 'Export CSV', icon: <IcExport />, disabled: count === 0, onClick: () => void exportCsv() },
    { label: 'Open in Sheets', icon: <IcSheets />, disabled: count === 0, onClick: openInSheets },
    'sep',
    {
      label: 'Delete all responses',
      icon: <IcTrash />,
      danger: true,
      disabled: count === 0,
      onClick: () => setClearOpen(true),
    },
  ]

  return (
    <div className="fm-resp">
      <div className="fm-resp-bar">
        <div className="fm-resp-count">
          <strong>{count}</strong>
          {count === 1 ? 'response' : 'responses'}
        </div>
        {count > 0 && (
          <Segmented
            value={view}
            onChange={(v) => setView(v === 'table' ? 'table' : 'summary')}
            options={[
              { value: 'summary', label: 'Summary' },
              { value: 'table', label: 'Table' },
            ]}
          />
        )}
        <Spacer />
        <Button small variant="outline" onClick={() => void importFiles()}>
          Import response file
        </Button>
        <Button
          small
          variant="outline"
          onClick={() => {
            setPasteError(null)
            setPasteText('')
            setPasteOpen(true)
          }}
        >
          Paste a response code
        </Button>
        <MenuButton trigger={<IcMore />} label="More response actions" align="right" items={menuItems} />
      </div>

      {note && (
        <div className={`fm-resp-note ${note.kind}`} role="status">
          {note.text}
        </div>
      )}

      <div className={'fm-resp-scroll' + (showTable ? ' table' : '')}>
        {count === 0 ? (
          <div className="fm-resp-empty">
            <h3>No responses yet</h3>
            <p>Anleo has no server, so nothing arrives on its own. Responses come back to you as files.</p>
            <ol className="fm-resp-steps">
              <li>
                <span className="fm-resp-step-n">1</span>
                <span>Export this form as a fillable web page and send the file to people however you like.</span>
              </li>
              <li>
                <span className="fm-resp-step-n">2</span>
                <span>They open it in any browser — offline — fill it in, and get back a .aresp file and a code.</span>
              </li>
              <li>
                <span className="fm-resp-step-n">3</span>
                <span>They send that back to you, and you import it here. Answers land in this document.</span>
              </li>
            </ol>
            <div className="fm-resp-empty-foot">
              Nobody in between ever sees the answers — no account, no upload, no database.
            </div>
            <div className="fm-resp-empty-cta">
              <Button variant="primary" onClick={() => void importFiles()}>
                Import response file
              </Button>
            </div>
          </div>
        ) : !showTable ? (
          <div className="fm-resp-column">
            {summaries.length === 0 ? (
              <div className="fm-resp-card">
                <div className="fm-resp-none">This form has no questions to summarise yet.</div>
              </div>
            ) : (
              summaries.map((s) => <SummaryCard key={s.question.id} summary={s} number={numbers[s.question.id]} />)
            )}
          </div>
        ) : (
          <ResponseTable
            questions={answerable}
            numbers={numbers}
            responses={responses}
            onDelete={removeResponse}
          />
        )}
      </div>

      {pasteOpen && (
        <Modal
          title="Paste a response code"
          subtitle="Paste the code someone sent you, or the whole contents of their .aresp file."
          width={520}
          onClose={() => setPasteOpen(false)}
        >
          <textarea
            className="fm-resp-paste"
            autoFocus
            spellCheck={false}
            value={pasteText}
            placeholder="ANLEO-RESPONSE…"
            onChange={(e) => {
              setPasteText(e.target.value)
              setPasteError(null)
            }}
          />
          {pasteError && <div className="fm-resp-modal-err">{pasteError}</div>}
          <div className="fm-resp-modal-actions">
            <Button variant="outline" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pasteText.trim() === ''} onClick={importPasted}>
              Import
            </Button>
          </div>
        </Modal>
      )}

      {clearOpen && (
        <Modal
          title="Delete all responses?"
          subtitle={`${plural(count, 'response', 'responses')} will be removed from this form. The original files you imported are untouched.`}
          width={400}
          onClose={() => setClearOpen(false)}
        >
          <div className="fm-resp-modal-actions">
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={clearAll}>
              Delete all
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
