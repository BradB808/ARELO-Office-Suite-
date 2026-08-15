// Where the author reads what came back. There is no inbox to poll: replies
// arrive as .aresp files or pasted codes that the author feeds in by hand, so
// importing is the primary action rather than an afterthought.

import React, { useMemo, useRef, useState } from 'react'
import type { FormQuestion, FormResponse, FormsContent } from '../../shared/types'
import { platform } from '../../shared/platform'
import { Button, MenuButton, Modal, Segmented, Spacer, type MenuItem } from '../../shared/ui'
import { IcExport, IcMore, IcSheets, IcTrash } from '../../shared/icons'
import { answerToText, isAnswerable, questionNumbers } from './model'
import {
  parseResponsePayload,
  responsesToCsv,
  responsesToSheet,
  scoreStats,
  summarize,
  type ScoreStats,
  type Summary,
} from './responses'
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

interface Bucket {
  label: string
  count: number
}

function Bars({ buckets, of }: { buckets: Bucket[]; of: number }) {
  const total = Math.max(1, of)
  return (
    <div className="fm-resp-bars">
      {buckets.map((b, i) => {
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
  )
}

// ---------- pie and donut, drawn by hand ----------
//
// No chart library, so the arcs are built here. The slices are one accent
// stepped down towards a neutral rather than a set of unrelated hues: there is
// exactly one themed colour to work with, and a rainbow would imply the options
// mean something they do not.

const SIZE = 132
const R = 62
const CENTRE = SIZE / 2

function polar(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [CENTRE + radius * Math.cos(rad), CENTRE + radius * Math.sin(rad)]
}

function slicePath(from: number, to: number, inner: number): string {
  const big = to - from > 180 ? 1 : 0
  const [x0, y0] = polar(R, from)
  const [x1, y1] = polar(R, to)
  if (inner <= 0) return `M${CENTRE} ${CENTRE} L${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} Z`
  const [x2, y2] = polar(inner, to)
  const [x3, y3] = polar(inner, from)
  return `M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${inner} ${inner} 0 ${big} 0 ${x3} ${y3} Z`
}

/** Slice i of n: the accent, faded towards the panel as the list goes on. */
function sliceFill(i: number, n: number): string {
  const weight = n < 2 ? 100 : Math.round(100 - (i * 62) / (n - 1))
  return `color-mix(in srgb, var(--accent) ${weight}%, var(--surface-3))`
}

function Pie({ buckets, donut }: { buckets: Bucket[]; donut: boolean }) {
  const shown = buckets.filter((b) => b.count > 0)
  const total = shown.reduce((n, b) => n + b.count, 0)
  const inner = donut ? R * 0.58 : 0
  if (total === 0) return <div className="fm-resp-none">Nobody has answered this yet.</div>

  let at = 0
  const slices = shown.map((b, i) => {
    const from = at
    at += (b.count / total) * 360
    return { key: `${b.label}-${i}`, d: slicePath(from, at, inner), fill: sliceFill(i, shown.length) }
  })

  return (
    <div className="fm-resp-chart">
      <svg
        className="fm-resp-pie"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={shown.map((b) => `${b.label}: ${b.count}`).join(', ')}
      >
        {/* One answer is a whole circle, and an arc from 0° to 360° draws
            nothing at all — the two endpoints are the same point. */}
        {shown.length === 1 ? (
          <>
            <circle cx={CENTRE} cy={CENTRE} r={R} fill={sliceFill(0, 1)} />
            {donut && <circle cx={CENTRE} cy={CENTRE} r={inner} className="fm-resp-hole" />}
          </>
        ) : (
          slices.map((s) => <path key={s.key} d={s.d} fill={s.fill} className="fm-resp-slice" />)
        )}
        {donut && (
          <text className="fm-resp-pie-n" x={CENTRE} y={CENTRE + 6} textAnchor="middle">
            {total}
          </text>
        )}
      </svg>
      <ul className="fm-resp-legend">
        {shown.map((b, i) => (
          <li key={`${b.label}-${i}`}>
            <span className="fm-resp-swatch" style={{ background: sliceFill(i, shown.length) }} />
            <span className="fm-resp-legend-label" title={b.label}>
              {b.label}
            </span>
            <span className="fm-resp-legend-n">
              {b.count}
              <span className="fm-resp-pct">{Math.round((b.count / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type ChartMode = 'bars' | 'pie' | 'donut'

/** Only the pick-one-of-a-list kinds: a pie of a scale implies the slices have
 *  no order, and a pie of free text would have as many slices as answers. */
const PIEABLE = ['choice', 'checkboxes', 'dropdown']

function SummaryCard({ summary, number }: { summary: Summary; number: number | undefined }) {
  const q = summary.question
  const [mode, setMode] = useState<ChartMode>('bars')
  const canPie = PIEABLE.includes(q.kind) && summary.buckets.length > 0

  return (
    <section className="fm-resp-card">
      <div className="fm-resp-qhead">
        {number !== undefined && <span className="fm-resp-num">{number}.</span>}
        <h4 className="fm-resp-qtitle">{q.title || 'Untitled question'}</h4>
        {canPie && (
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as ChartMode)}
            options={[
              { value: 'bars', label: 'Bars' },
              { value: 'pie', label: 'Pie' },
              { value: 'donut', label: 'Donut' },
            ]}
          />
        )}
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
        canPie && mode !== 'bars' ? (
          <Pie buckets={summary.buckets} donut={mode === 'donut'} />
        ) : (
          <Bars buckets={summary.buckets} of={summary.answered} />
        )
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

/** How the class did overall — the first thing an author wants after a quiz. */
function ScoreCard({ stats, responses }: { stats: ScoreStats; responses: number }) {
  const figures: [string, number][] = [
    ['Average', stats.average],
    ['Highest', stats.highest],
    ['Lowest', stats.lowest],
    ['Out of', stats.outOf],
  ]
  return (
    <section className="fm-resp-card fm-score-card">
      <div className="fm-resp-qhead">
        <h4 className="fm-resp-qtitle">Marks</h4>
      </div>
      <div className="fm-resp-qmeta">
        {stats.count === responses
          ? `every response marked · ${Math.round((stats.average / stats.outOf) * 100)}% average`
          : `${stats.count} of ${responses} responses were marked · ${Math.round((stats.average / stats.outOf) * 100)}% average`}
      </div>
      <div className="fm-score-figures">
        {figures.map(([label, value]) => (
          <div className="fm-score-figure" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Bars buckets={stats.distribution} of={stats.count} />
    </section>
  )
}

function ResponseTable({
  questions,
  numbers,
  responses,
  scored,
  onDelete,
}: {
  questions: FormQuestion[]
  numbers: Record<string, number>
  responses: FormResponse[]
  scored: boolean
  onDelete: (id: string) => void
}) {
  return (
    <div className="fm-resp-tablewrap">
      <table className="fm-resp-table">
        <thead>
          <tr>
            <th className="fm-resp-idx">#</th>
            <th>Submitted</th>
            {scored && <th>Score</th>}
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
              {scored && (
                <td className="fm-resp-score">
                  {r.score ? `${r.score.earned} / ${r.score.total}` : <span className="fm-resp-blank">—</span>}
                </td>
              )}
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
  const stats = useMemo(() => scoreStats(responses), [responses])

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
            {stats && <ScoreCard stats={stats} responses={count} />}
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
            scored={stats !== null}
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
