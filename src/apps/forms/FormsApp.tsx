// The Forms editor. Building a form is only half of it — because there is no
// server to collect anything, the author also has to understand the round trip
// (export one .html file → send it → get a response file or code back → import
// it here). The Share modal below is where that gets explained, in plain words.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { EditorAppProps, FormOption, FormQuestion, FormsContent, QuestionKind } from '../../shared/types'
import { uid } from '../../shared/types'
import { platform } from '../../shared/platform'
import { registerExporters } from '../../shared/exporters'
import { registerCommands, clearCommands } from '../../shared/commands'
import { SYSTEM_FONTS, cssFamily } from '../../shared/fonts'
import { Button, IconBtn, MenuButton, Modal, Select, Spacer, ToolbarDivider, type MenuItem } from '../../shared/ui'
import { IcCheck, IcExport, IcPlus, IcSettings, IcTrash } from '../../shared/icons'
import {
  BRANCH_END,
  FORM_THEMES,
  QUESTION_KINDS,
  branchProblems,
  hasAnswerKey,
  isAnswerable,
  newQuestion,
  questionMarks,
  questionNumbers,
  quizTotal,
  sectionsAfter,
} from './model'
import { responsesToCsv } from './responses'
import { renderFillableForm, renderPrintableForm } from './render'
import { ResponsesPanel } from './ResponsesPanel'
import './forms.css'

const HTML_FILTERS = [{ name: 'Web Page', extensions: ['html'] }]
const CSV_FILTERS = [{ name: 'Comma-separated values', extensions: ['csv'] }]

/** Kinds that carry a list of answers the author writes. */
const OPTION_KINDS: QuestionKind[] = ['choice', 'checkboxes', 'dropdown']

/** Kinds that can route the respondent onward: one answer, chosen from a list. */
const BRANCHING_KINDS: QuestionKind[] = ['choice', 'dropdown']

/** Kinds whose answer key is text the author types rather than an option they tick. */
const TYPED_KEY_KINDS: QuestionKind[] = ['short', 'number', 'date', 'time']

// ---------- small local icons ----------

function IcUp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
      <path d="M10 15.5V5m0 0L5.8 9.2M10 5l4.2 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IcDown() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
      <path d="M10 4.5V15m0 0l4.2-4.2M10 15l-4.2-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IcCopy() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
      <rect x="7.2" y="7.2" width="9.3" height="9.3" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 4.5H5.5A1.5 1.5 0 0 0 4 6v7.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IcEye() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
      <path d="M1.9 10S4.9 4.8 10 4.8 18.1 10 18.1 10 15.1 15.2 10 15.2 1.9 10 1.9 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ---------- shared bits ----------

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      className={'fm-toggle' + (checked ? ' on' : '')}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="fm-toggle-track">
        <span className="fm-toggle-knob" />
      </span>
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fm-field">
      <span>{label}</span>
      {children}
    </div>
  )
}

/** Keeps the description box exactly as tall as its text. */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function kindLabel(kind: QuestionKind): string {
  return QUESTION_KINDS.find((k) => k.kind === kind)?.label ?? kind
}

/**
 * A deleted option must not linger in the answer key or the routing, where it
 * would mark and route an answer nobody can give any more. Only runs when the
 * option list itself changed — on those questions the key holds option ids, so
 * there is nothing else in it to lose.
 */
function withPrunedOptionRefs(q: FormQuestion, patch: Partial<FormQuestion>): FormQuestion {
  if (!patch.options) return q
  const ids = new Set(patch.options.map((o) => o.id))
  return {
    ...q,
    correct: q.correct?.filter((c) => ids.has(c)),
    branches: q.branches?.filter((b) => ids.has(b.optionId)),
  }
}

// ---------- option list editor ----------

/**
 * Where an option may send the respondent. Only sections *after* this question
 * are offered — a branch that jumps backwards can walk someone round the same
 * pages forever, so the editor does not hand out the rope. One that already
 * exists (a question moved below the section it routes to, or a section since
 * deleted) is still listed, named for what it is, so it can be seen and changed.
 */
function branchOptions(
  all: FormQuestion[],
  q: FormQuestion,
  current: string | undefined,
): { value: string; label: string }[] {
  const out = [
    { value: '', label: 'Continue to the next section' },
    ...sectionsAfter(all, q.id).map((s) => ({ value: s.id, label: s.title.trim() || 'Untitled section' })),
    { value: BRANCH_END, label: 'Submit the form' },
  ]
  if (current && !out.some((o) => o.value === current)) {
    const earlier = all.find((x) => x.id === current && x.kind === 'section')
    out.splice(1, 0, {
      value: current,
      label: earlier
        ? `${earlier.title.trim() || 'Untitled section'} — jumps backwards`
        : 'A section that no longer exists',
    })
  }
  return out
}

function OptionsEditor({
  q,
  all,
  quiz,
  branching,
  onChange,
  onPatch,
}: {
  q: FormQuestion
  all: FormQuestion[]
  quiz: boolean
  branching: boolean
  onChange: (options: FormOption[]) => void
  onPatch: (patch: Partial<FormQuestion>) => void
}) {
  const options = q.options ?? []
  const markClass = q.kind === 'choice' ? 'round' : q.kind === 'checkboxes' ? 'square' : 'num'
  const correct = q.correct ?? []
  const branches = q.branches ?? []

  function patch(i: number, label: string) {
    onChange(options.map((o, n) => (n === i ? { ...o, label } : o)))
  }

  function move(i: number, dir: -1 | 1) {
    const to = i + dir
    if (to < 0 || to >= options.length) return
    const arr = [...options]
    ;[arr[i], arr[to]] = [arr[to], arr[i]]
    onChange(arr)
  }

  function toggleCorrect(id: string) {
    // One right answer for a radio or a dropdown, any number for checkboxes.
    if (q.kind !== 'checkboxes') {
      onPatch({ correct: correct.includes(id) ? [] : [id] })
      return
    }
    onPatch({ correct: correct.includes(id) ? correct.filter((c) => c !== id) : [...correct, id] })
  }

  function setBranch(id: string, goTo: string) {
    const rest = branches.filter((b) => b.optionId !== id)
    onPatch({ branches: goTo === '' ? rest : [...rest, { optionId: id, goTo }] })
  }

  return (
    <div className="fm-opts">
      {options.map((o, i) => {
        const goTo = branches.find((b) => b.optionId === o.id)?.goTo ?? ''
        return (
          <div key={o.id} className="fm-optgroup">
            <div className="fm-opt">
              {quiz && (
                <button
                  className={'fm-key' + (correct.includes(o.id) ? ' on' : '')}
                  title={correct.includes(o.id) ? 'This is a correct answer' : 'Mark as a correct answer'}
                  aria-pressed={correct.includes(o.id)}
                  onClick={() => toggleCorrect(o.id)}
                >
                  <IcCheck />
                </button>
              )}
              <span className={'fm-opt-mark ' + markClass}>{markClass === 'num' ? i + 1 : ''}</span>
              <input
                className="fm-input fm-grow"
                value={o.label}
                placeholder={`Option ${i + 1}`}
                onChange={(e) => patch(i, e.target.value)}
              />
              <IconBtn label="Move option up" disabled={i === 0} onClick={() => move(i, -1)}>
                <IcUp />
              </IconBtn>
              <IconBtn label="Move option down" disabled={i === options.length - 1} onClick={() => move(i, 1)}>
                <IcDown />
              </IconBtn>
              <IconBtn
                label="Remove option"
                disabled={options.length <= 1}
                onClick={() => onChange(options.filter((_, n) => n !== i))}
              >
                <IcTrash />
              </IconBtn>
            </div>
            {branching && (
              <div className="fm-branch">
                <span className="fm-branch-arrow" aria-hidden="true">
                  ↳
                </span>
                <span>then go to</span>
                <Select
                  value={goTo}
                  width={230}
                  compact
                  onChange={(v) => setBranch(o.id, v)}
                  options={branchOptions(all, q, goTo)}
                />
              </div>
            )}
          </div>
        )
      })}

      {q.otherOption && (
        <div className="fm-opt">
          <span className={'fm-opt-mark ' + markClass} />
          <span className="fm-opt-other">Other — they type their own answer</span>
        </div>
      )}

      <div className="fm-opt">
        <Button small onClick={() => onChange([...options, { id: uid(), label: '' }])}>
          <IcPlus /> Add option
        </Button>
      </div>
    </div>
  )
}

// ---------- kind-specific settings ----------

function KindSettings({
  q,
  all,
  quiz,
  onPatch,
}: {
  q: FormQuestion
  all: FormQuestion[]
  quiz: boolean
  onPatch: (patch: Partial<FormQuestion>) => void
}) {
  // Held here rather than in the document: an author who opens the routing rows
  // and picks nothing has expressed no routing, and should not have an empty
  // branch list saved on their behalf.
  const [branchOpen, setBranchOpen] = useState(false)

  if (OPTION_KINDS.includes(q.kind)) {
    // Routing needs somewhere to route to, so the toggle only appears once a
    // section exists further down the form.
    const canBranch = BRANCHING_KINDS.includes(q.kind) && sectionsAfter(all, q.id).length > 0
    const routed = (q.branches ?? []).length > 0
    return (
      <>
        <OptionsEditor
          q={q}
          all={all}
          quiz={quiz}
          branching={canBranch && (branchOpen || routed)}
          onChange={(options) => onPatch({ options })}
          onPatch={onPatch}
        />
        {q.kind !== 'dropdown' && (
          <Toggle
            checked={!!q.otherOption}
            label="Offer an “Other” box"
            onChange={(v) => onPatch({ otherOption: v })}
          />
        )}
        {canBranch && (
          <Toggle
            checked={branchOpen || routed}
            label="Send them to a section based on their answer"
            onChange={(v) => {
              setBranchOpen(v)
              if (!v) onPatch({ branches: [] })
            }}
          />
        )}
      </>
    )
  }

  if (q.kind === 'scale') {
    const min = q.scaleMin ?? 1
    const max = q.scaleMax ?? 5
    return (
      <div className="fm-fields">
        <Field label="From">
          <Select
            value={String(min)}
            width={70}
            onChange={(v) => onPatch({ scaleMin: Number(v) })}
            options={[0, 1].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Field>
        <Field label="To">
          <Select
            value={String(max)}
            width={70}
            onChange={(v) => onPatch({ scaleMax: Number(v) })}
            options={[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Field>
        <Field label={`Label for ${min}`}>
          <input
            className="fm-input"
            style={{ width: 180 }}
            value={q.scaleMinLabel ?? ''}
            placeholder="Not at all"
            onChange={(e) => onPatch({ scaleMinLabel: e.target.value })}
          />
        </Field>
        <Field label={`Label for ${max}`}>
          <input
            className="fm-input"
            style={{ width: 180 }}
            value={q.scaleMaxLabel ?? ''}
            placeholder="Very much"
            onChange={(e) => onPatch({ scaleMaxLabel: e.target.value })}
          />
        </Field>
      </div>
    )
  }

  if (q.kind === 'number') {
    return (
      <div className="fm-fields">
        <Field label="Smallest allowed">
          <input
            className="fm-input fm-num"
            type="number"
            value={q.min ?? ''}
            onChange={(e) => onPatch({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </Field>
        <Field label="Largest allowed">
          <input
            className="fm-input fm-num"
            type="number"
            value={q.max ?? ''}
            onChange={(e) => onPatch({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </Field>
        <Field label="Placeholder">
          <input
            className="fm-input"
            style={{ width: 200 }}
            value={q.placeholder ?? ''}
            onChange={(e) => onPatch({ placeholder: e.target.value })}
          />
        </Field>
      </div>
    )
  }

  if (q.kind === 'paragraph') {
    return (
      <div className="fm-fields">
        <Field label="Placeholder">
          <input
            className="fm-input"
            style={{ width: 260 }}
            value={q.placeholder ?? ''}
            placeholder="Shown in the empty box"
            onChange={(e) => onPatch({ placeholder: e.target.value })}
          />
        </Field>
        <Field label="Box height (lines)">
          <input
            className="fm-input fm-num"
            type="number"
            min={2}
            max={12}
            value={q.rows ?? 4}
            onChange={(e) => onPatch({ rows: Math.max(2, Math.min(12, Number(e.target.value) || 4)) })}
          />
        </Field>
      </div>
    )
  }

  if (q.kind === 'short' || q.kind === 'email') {
    return (
      <div className="fm-fields">
        <Field label="Placeholder">
          <input
            className="fm-input"
            style={{ width: 300 }}
            value={q.placeholder ?? ''}
            placeholder={q.kind === 'email' ? 'name@example.com' : 'Shown in the empty box'}
            onChange={(e) => onPatch({ placeholder: e.target.value })}
          />
        </Field>
      </div>
    )
  }

  return null
}

// ---------- marking ----------

/** The accepted answers for a question whose key is typed, not ticked. Several
 *  rows because "17", "seventeen" and "Seventeen" are all the same answer to a
 *  person, and the marker compares trimmed and case-insensitively. */
function AnswerKeyEditor({ q, onPatch }: { q: FormQuestion; onPatch: (patch: Partial<FormQuestion>) => void }) {
  const answers = q.correct ?? []
  const rows = answers.length ? answers : ['']

  // Blank rows are left in the list rather than filtered on every keystroke —
  // dropping one mid-typing shifts every row below it under the cursor. Every
  // reader of the key ignores blanks, so an empty row means nothing to anyone.
  function set(i: number, value: string) {
    onPatch({ correct: rows.map((a, n) => (n === i ? value : a)) })
  }

  return (
    <div className="fm-keylist">
      {rows.map((a, i) => (
        <div className="fm-keyrow" key={i}>
          <span className="fm-key on" aria-hidden="true">
            <IcCheck />
          </span>
          <input
            className="fm-input fm-grow"
            value={a}
            placeholder={i === 0 ? 'The answer you will accept' : 'Another wording you will accept'}
            onChange={(e) => set(i, e.target.value)}
          />
          <IconBtn
            label="Remove this accepted answer"
            disabled={rows.length <= 1}
            onClick={() => onPatch({ correct: rows.filter((_, n) => n !== i) })}
          >
            <IcTrash />
          </IconBtn>
        </div>
      ))}
      <Button small onClick={() => onPatch({ correct: [...rows, ''] })}>
        <IcPlus /> Accept another answer
      </Button>
    </div>
  )
}

function QuizSettings({ q, onPatch }: { q: FormQuestion; onPatch: (patch: Partial<FormQuestion>) => void }) {
  const keyed = hasAnswerKey(q)
  return (
    <div className="fm-quiz-block">
      <div className="fm-card-label">Marking</div>
      {TYPED_KEY_KINDS.includes(q.kind) ? (
        <AnswerKeyEditor q={q} onPatch={onPatch} />
      ) : OPTION_KINDS.includes(q.kind) ? (
        <div className="fm-card-note">
          {keyed
            ? q.kind === 'checkboxes'
              ? 'Ticked options above are the answer. Part marks are given, less one answer’s worth for each wrong tick.'
              : 'The ticked option above is the answer.'
            : 'Tick the correct option above to mark this question.'}
        </div>
      ) : (
        <div className="fm-card-note">This kind of question is not marked — it counts for no marks.</div>
      )}
      {keyed && (
        <div className="fm-fields">
          <Field label="Marks">
            <input
              className="fm-input fm-num"
              type="number"
              min={0}
              step={0.5}
              value={q.points ?? 1}
              onChange={(e) =>
                onPatch({ points: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })
              }
            />
          </Field>
          <Field label="Feedback after marking">
            <input
              className="fm-input"
              style={{ width: 340 }}
              value={q.feedback ?? ''}
              placeholder="Shown whether they got it right or wrong (optional)"
              onChange={(e) => onPatch({ feedback: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

// ---------- question card ----------

function QuestionCard({
  q,
  number,
  selected,
  canMoveUp,
  canMoveDown,
  onSelect,
  onPatch,
  onChangeKind,
  onDuplicate,
  onDelete,
  onMove,
  all,
  quiz,
  problems,
}: {
  q: FormQuestion
  number: number | undefined
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onPatch: (patch: Partial<FormQuestion>) => void
  onChangeKind: (kind: QuestionKind) => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  all: FormQuestion[]
  quiz: boolean
  problems: string[]
}) {
  const section = q.kind === 'section'
  const cls = ['fm-qcard', selected ? 'selected' : '', section ? 'section' : ''].filter(Boolean).join(' ')
  const routes = (q.branches ?? []).length

  return (
    <div className={cls} onClick={selected ? undefined : onSelect}>
      <div className="fm-qhead">
        <span className="fm-qnum">{section ? '§' : number}</span>

        {selected ? (
          <div className="fm-grow fm-erow">
            <input
              className="fm-input fm-input-title fm-grow"
              value={q.title}
              placeholder={section ? 'Section heading' : 'Question'}
              onChange={(e) => onPatch({ title: e.target.value })}
            />
            <Select
              value={q.kind}
              width={190}
              onChange={(v) => onChangeKind(v as QuestionKind)}
              options={QUESTION_KINDS.map((k) => ({ value: k.kind, label: k.label }))}
            />
          </div>
        ) : (
          <div className="fm-qsummary">
            <div className={'fm-qsummary-title' + (q.title.trim() ? '' : ' placeholder')}>
              {q.title.trim() || (section ? 'Untitled section' : 'Untitled question')}
              {q.required && <span className="fm-req-mark"> *</span>}
            </div>
            <div className="fm-qsummary-meta">
              <span>{kindLabel(q.kind)}</span>
              {OPTION_KINDS.includes(q.kind) && <span>· {(q.options ?? []).length} options</span>}
              {q.help?.trim() && <span>· has help text</span>}
              {quiz && isAnswerable(q) && (
                <span className={hasAnswerKey(q) ? 'fm-meta-key' : ''}>
                  · {hasAnswerKey(q) ? `${questionMarks(q)} ${questionMarks(q) === 1 ? 'mark' : 'marks'}` : 'no answer key'}
                </span>
              )}
              {routes > 0 && <span className="fm-meta-branch">· routes {routes === 1 ? '1 answer' : `${routes} answers`}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Shown whether or not the card is open: a branch that has quietly gone
          wrong is exactly the thing an author would otherwise never look at. */}
      {problems.map((p) => (
        <div className="fm-qwarn" key={p}>
          {p}
        </div>
      ))}

      {selected && (
        <>
          <div className="fm-estack">
            <input
              className="fm-input"
              value={q.help ?? ''}
              placeholder={section ? 'Describe this part of the form (optional)' : 'Help text (optional)'}
              onChange={(e) => onPatch({ help: e.target.value })}
            />
            <KindSettings q={q} all={all} quiz={quiz} onPatch={onPatch} />
            {quiz && isAnswerable(q) && <QuizSettings q={q} onPatch={onPatch} />}
          </div>

          <div className="fm-qactions">
            <IconBtn label="Move up" disabled={!canMoveUp} onClick={() => onMove(-1)}>
              <IcUp />
            </IconBtn>
            <IconBtn label="Move down" disabled={!canMoveDown} onClick={() => onMove(1)}>
              <IcDown />
            </IconBtn>
            <IconBtn label="Duplicate" onClick={onDuplicate}>
              <IcCopy />
            </IconBtn>
            <IconBtn label="Delete" onClick={onDelete}>
              <IcTrash />
            </IconBtn>
            <Spacer />
            {isAnswerable(q) && (
              <Toggle checked={!!q.required} label="Required" onChange={(v) => onPatch({ required: v })} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------- app ----------

export default function FormsApp({ doc, onDocChange, onTitleChange }: EditorAppProps<FormsContent>) {
  const initial = doc.content as FormsContent

  const [content, setContent] = useState<FormsContent>(initial)
  const contentRef = useRef(content)
  const docIdRef = useRef(doc.meta.id)
  // Refreshed every render so a command registered once at mount never exports
  // under a stale title after the user opens a different form.
  const docTitleRef = useRef(doc.meta.title)
  docTitleRef.current = doc.meta.title

  const [tab, setTab] = useState<'questions' | 'responses'>('questions')
  const [selectedId, setSelectedId] = useState(initial.questions[0]?.id ?? '')
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  const descRef = useRef<HTMLTextAreaElement | null>(null)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3600)
  }

  useEffect(() => {
    if (doc.meta.id !== docIdRef.current) {
      docIdRef.current = doc.meta.id
      const c = doc.content as FormsContent
      contentRef.current = c
      setContent(c)
      setTab('questions')
      setSelectedId(c.questions[0]?.id ?? '')
      setPreviewOpen(false)
      setShareOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.meta.id])

  // A callback ref fires only at mount, so without this the description box kept
  // the height of whichever form was open first.
  useLayoutEffect(() => autoGrow(descRef.current), [content.description])

  function commit(next: FormsContent) {
    contentRef.current = next
    setContent(next)
    onDocChange(next)
  }

  // ---------- question actions ----------

  function patchQuestion(id: string, patch: Partial<FormQuestion>) {
    const c = contentRef.current
    commit({ ...c, questions: c.questions.map((q) => (q.id === id ? withPrunedOptionRefs({ ...q, ...patch }, patch) : q)) })
  }

  function changeKind(id: string, kind: QuestionKind) {
    const c = contentRef.current
    commit({
      ...c,
      questions: c.questions.map((q) => {
        if (q.id !== id) return q
        // Rebuild from a fresh question so settings that no longer apply (a
        // scale's end labels, a number's bounds) can't linger out of sight and
        // resurface if the author switches back.
        const fresh = newQuestion(kind)
        const keepOptions = OPTION_KINDS.includes(kind) && OPTION_KINDS.includes(q.kind)
        return {
          ...fresh,
          id: q.id,
          title: q.title,
          help: q.help,
          required: kind === 'section' ? undefined : q.required,
          options: keepOptions ? q.options : fresh.options,
          // Marks and feedback survive any change of kind; the key and the
          // routing only survive while the options they name still exist.
          points: q.points,
          feedback: q.feedback,
          correct: keepOptions ? q.correct : undefined,
          branches: keepOptions && BRANCHING_KINDS.includes(kind) ? q.branches : undefined,
        }
      }),
    })
  }

  function addQuestion(kind: QuestionKind) {
    const c = contentRef.current
    const q = newQuestion(kind)
    const idx = c.questions.findIndex((x) => x.id === selectedIdRef.current)
    const arr = [...c.questions]
    arr.splice(idx < 0 ? arr.length : idx + 1, 0, q)
    commit({ ...c, questions: arr })
    setSelectedId(q.id)
    setTab('questions')
  }

  function duplicateQuestion(id: string) {
    const c = contentRef.current
    const idx = c.questions.findIndex((q) => q.id === id)
    if (idx < 0) return
    const src = c.questions[idx]
    // Fresh option ids, so the answer key and the routing have to be carried
    // across to them or the copy would silently mark and route nothing.
    const remap = new Map((src.options ?? []).map((o) => [o.id, uid()]))
    const clone: FormQuestion = {
      ...structuredClone(src),
      id: uid(),
      options: src.options?.map((o) => ({ ...o, id: remap.get(o.id) ?? uid() })),
      correct: src.correct?.map((cid) => remap.get(cid) ?? cid),
      branches: src.branches?.map((b) => ({ ...b, optionId: remap.get(b.optionId) ?? b.optionId })),
    }
    const arr = [...c.questions]
    arr.splice(idx + 1, 0, clone)
    commit({ ...c, questions: arr })
    setSelectedId(clone.id)
  }

  function deleteQuestion(id: string) {
    const c = contentRef.current
    const idx = c.questions.findIndex((q) => q.id === id)
    if (idx < 0) return
    // Deleting a section is the usual way a branch ends up pointing at nothing.
    // Clearing those here is the difference between "it carries on, as it says
    // in the editor" and a dangling route nobody notices until someone fills
    // the form in.
    const orphaned = c.questions.reduce(
      (n, q) => n + (q.branches ?? []).filter((b) => b.goTo === id).length,
      0,
    )
    const arr = c.questions
      .filter((q) => q.id !== id)
      .map((q) =>
        (q.branches ?? []).some((b) => b.goTo === id)
          ? { ...q, branches: q.branches?.filter((b) => b.goTo !== id) }
          : q,
      )
    commit({ ...c, questions: arr })
    if (orphaned > 0) {
      showToast(
        orphaned === 1
          ? 'One answer routed to that section — it now continues to the next one.'
          : `${orphaned} answers routed to that section — they now continue to the next one.`,
      )
    }
    if (selectedIdRef.current === id) setSelectedId(arr[Math.min(idx, arr.length - 1)]?.id ?? '')
  }

  function moveQuestion(id: string, dir: -1 | 1) {
    const c = contentRef.current
    const idx = c.questions.findIndex((q) => q.id === id)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= c.questions.length) return
    const arr = [...c.questions]
    ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
    commit({ ...c, questions: arr })
  }

  // ---------- export ----------

  function formTitle(): string {
    return docTitleRef.current.trim() || 'Untitled form'
  }

  async function runShareExport() {
    const html = renderFillableForm(formTitle(), contentRef.current)
    const res = await platform.saveFile(`${formTitle()}.html`, html, HTML_FILTERS, false)
    setShareOpen(false)
    if (!res.canceled) showToast('Form saved — send that one file to anyone you like.')
  }

  async function exportCsv() {
    const c = contentRef.current
    if (!c.responses.length) {
      showToast('No responses yet — import one on the Responses tab first.')
      return
    }
    const csv = responsesToCsv(c.questions, c.responses)
    const res = await platform.saveFile(`${formTitle()} responses.csv`, csv, CSV_FILTERS, false)
    if (!res.canceled) showToast(`Exported ${c.responses.length} responses.`)
  }

  useEffect(() => {
    registerExporters('forms', [
      {
        ext: 'html',
        label: 'Fillable form',
        produce: async () => ({ data: renderFillableForm(formTitle(), contentRef.current), binary: false }),
      },
      {
        ext: 'pdf',
        label: 'Printable form',
        produce: async () => ({ pdfHtml: renderPrintableForm(formTitle(), contentRef.current) }),
      },
      {
        ext: 'csv',
        label: 'Responses',
        produce: async () => ({
          data: responsesToCsv(contentRef.current.questions, contentRef.current.responses),
          binary: false,
        }),
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    registerCommands('forms', [
      { id: 'forms-add', title: 'Add question', group: 'Forms', keywords: 'new insert field', run: () => addQuestion('short') },
      { id: 'forms-add-section', title: 'Add section', group: 'Forms', keywords: 'heading break part page', run: () => addQuestion('section') },
      { id: 'forms-preview', title: 'Preview form', group: 'Forms', keywords: 'see test respondent view', run: () => setPreviewOpen(true) },
      { id: 'forms-share', title: 'Share form', group: 'Forms', keywords: 'export html send offline distribute', run: () => setShareOpen(true) },
      { id: 'forms-export-csv', title: 'Export responses as CSV', group: 'Forms', keywords: 'download spreadsheet answers', run: exportCsv },
      { id: 'forms-responses', title: 'Show responses', group: 'Forms', keywords: 'answers results import tab', run: () => setTab('responses') },
    ])
    return () => clearCommands('forms')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- derived ----------

  const theme = content.theme
  const numbers = useMemo(() => questionNumbers(content.questions), [content.questions])
  const currentThemeId =
    FORM_THEMES.find(
      (t) =>
        t.theme.accent === theme.accent &&
        t.theme.headerFrom === theme.headerFrom &&
        t.theme.headerTo === theme.headerTo,
    )?.id ?? ''

  // The srcDoc frame inherits the app's own strict CSP, so the exported file's
  // inline script cannot run here: the preview is faithful in look and layout,
  // but submitting only works in the real saved file. Said as much in the modal.
  const previewHtml = useMemo(
    () => (previewOpen ? renderFillableForm(formTitle(), content) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewOpen, content, doc.meta.title],
  )

  const addItems: (MenuItem | 'sep' | { header: string })[] = [
    { header: 'Add a question' },
    ...QUESTION_KINDS.filter((k) => k.kind !== 'section').map(
      (k): MenuItem => ({ label: k.label, onClick: () => addQuestion(k.kind) }),
    ),
    'sep',
    { label: 'Section break', onClick: () => addQuestion('section') },
  ]

  function toggleSetting(key: 'showQuestionNumbers' | 'showProgress' | 'showScore') {
    const c = contentRef.current
    commit({ ...c, settings: { ...c.settings, [key]: !c.settings[key] } })
  }

  function setQuizMode(on: boolean) {
    const c = contentRef.current
    // Showing the score is what makes a self-marking quiz worth having, so it
    // comes on with it; an author who wants marks kept back can turn it off.
    commit({ ...c, settings: { ...c.settings, quizMode: on, showScore: on ? true : c.settings.showScore } })
  }

  const quiz = !!content.settings.quizMode
  const marksTotal = useMemo(() => quizTotal(content.questions), [content.questions])
  const marked = useMemo(() => content.questions.filter(hasAnswerKey).length, [content.questions])

  // Grouped by question so a card can show its own problems without every card
  // scanning the whole form.
  const problems = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const p of branchProblems(content.questions)) (map[p.questionId] ??= []).push(p.message)
    return map
  }, [content.questions])
  const problemCount = Object.values(problems).reduce((n, list) => n + list.length, 0)

  return (
    <div className="fm-root">
      <div className="toolbar fm-toolbar">
        <MenuButton
          label="Add question"
          items={addItems}
          trigger={
            <span className="fm-menu-trigger">
              <IcPlus /> Add question
            </span>
          }
        />

        <ToolbarDivider />

        <Select
          value={currentThemeId}
          width={172}
          triggerLabel={
            <span className="fm-theme-opt">
              <span
                className="fm-theme-swatch"
                style={{ background: `linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})` }}
              />
              {FORM_THEMES.find((t) => t.id === currentThemeId)?.name ?? 'Custom'}
            </span>
          }
          onChange={(id) => {
            const picked = FORM_THEMES.find((t) => t.id === id)
            if (picked) commit({ ...contentRef.current, theme: { ...picked.theme } })
          }}
          options={FORM_THEMES.map((t) => ({
            value: t.id,
            label: (
              <span className="fm-theme-opt">
                <span
                  className="fm-theme-swatch"
                  style={{ background: `linear-gradient(135deg, ${t.theme.headerFrom}, ${t.theme.headerTo})` }}
                />
                {t.name}
              </span>
            ),
          }))}
        />

        {/* System faces only: the exported file has to look right on a machine
            that has never heard of this Mac's installed fonts. */}
        <Select
          value={theme.fontFamily}
          width={168}
          onChange={(f) => commit({ ...contentRef.current, theme: { ...contentRef.current.theme, fontFamily: f } })}
          options={SYSTEM_FONTS.map((f) => ({
            value: f,
            label: f,
            labelStyle: { fontFamily: cssFamily(f) },
          }))}
        />

        <MenuButton
          label="Form settings"
          trigger={<IcSettings />}
          items={[
            { header: 'In the exported form' },
            {
              label: 'Number the questions',
              icon: content.settings.showQuestionNumbers ? <IcCheck /> : <span style={{ width: 17 }} />,
              onClick: () => toggleSetting('showQuestionNumbers'),
            },
            {
              label: 'Show a progress bar',
              icon: content.settings.showProgress ? <IcCheck /> : <span style={{ width: 17 }} />,
              onClick: () => toggleSetting('showProgress'),
            },
            'sep',
            { header: 'Marking' },
            {
              label: 'Make this a quiz',
              icon: quiz ? <IcCheck /> : <span style={{ width: 17 }} />,
              onClick: () => setQuizMode(!quiz),
            },
            {
              label: 'Show respondents their score',
              icon: content.settings.showScore ? <IcCheck /> : <span style={{ width: 17 }} />,
              disabled: !quiz,
              onClick: () => toggleSetting('showScore'),
            },
          ]}
        />

        <Spacer />

        <Button onClick={() => setPreviewOpen(true)}>
          <IcEye /> Preview
        </Button>
        <Button variant="primary" onClick={() => setShareOpen(true)}>
          <IcExport /> Share form
        </Button>
      </div>

      <div className="fm-tabs">
        <button className={'fm-tab' + (tab === 'questions' ? ' on' : '')} onClick={() => setTab('questions')}>
          Questions
          <span className="fm-tab-count">{content.questions.filter(isAnswerable).length}</span>
        </button>
        <button className={'fm-tab' + (tab === 'responses' ? ' on' : '')} onClick={() => setTab('responses')}>
          Responses
          <span className="fm-tab-count">{content.responses.length}</span>
        </button>
      </div>

      {tab === 'questions' ? (
        <div className="fm-scroll">
          <div className="fm-page" style={{ '--fm-accent': theme.accent } as React.CSSProperties}>
            <div
              className="fm-header-card"
              style={{
                background: `linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})`,
                color: theme.headerColor,
                fontFamily: cssFamily(theme.fontFamily),
              }}
            >
              <input
                className="fm-title-input"
                value={doc.meta.title}
                spellCheck={false}
                placeholder="Untitled form"
                onChange={(e) => onTitleChange(e.target.value)}
              />
              <textarea
                className="fm-desc-input"
                rows={1}
                value={content.description}
                placeholder="Add a description — what this is for, how long it takes, when you need it back."
                ref={descRef}
                onChange={(e) => commit({ ...contentRef.current, description: e.target.value })}
              />
            </div>

            {problemCount > 0 && (
              <div className="fm-warn-card" role="status">
                <strong>
                  {problemCount === 1 ? 'One answer routes somewhere it should not' : `${problemCount} answers route somewhere they should not`}
                </strong>
                <span>
                  Marked on the questions below. The exported form ignores a route it cannot follow and
                  simply carries on, so nobody gets stuck — but it will not do what you meant.
                </span>
              </div>
            )}

            {content.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                all={content.questions}
                quiz={quiz}
                problems={problems[q.id] ?? []}
                number={numbers[q.id]}
                selected={q.id === selectedId}
                canMoveUp={i > 0}
                canMoveDown={i < content.questions.length - 1}
                onSelect={() => setSelectedId(q.id)}
                onPatch={(patch) => patchQuestion(q.id, patch)}
                onChangeKind={(kind) => changeKind(q.id, kind)}
                onDuplicate={() => duplicateQuestion(q.id)}
                onDelete={() => deleteQuestion(q.id)}
                onMove={(dir) => moveQuestion(q.id, dir)}
              />
            ))}

            {!content.questions.length && (
              <div className="empty-hint">No questions yet — add the first one below.</div>
            )}

            <div className="fm-add-row">
              <MenuButton
                label="Add question"
                items={addItems}
                trigger={
                  <span className="fm-menu-trigger">
                    <IcPlus /> Add question
                  </span>
                }
              />
            </div>

            <div className="fm-settings-card">
              <div className="fm-card-label">Marking</div>
              <Toggle checked={quiz} label="Make this a quiz" onChange={setQuizMode} />
              {quiz && (
                <>
                  <Toggle
                    checked={!!content.settings.showScore}
                    label="Show respondents their score and answers straight after they submit"
                    onChange={() => toggleSetting('showScore')}
                  />
                  <div className="fm-card-note">
                    {marked === 0
                      ? 'No question has an answer key yet — open a question and tick the answer, or type the answers you will accept.'
                      : `${marked} of ${content.questions.filter(isAnswerable).length} questions are marked, worth ${marksTotal} ${marksTotal === 1 ? 'mark' : 'marks'} in total.`}
                  </div>
                  {/* The honest bit. Marking happens on the respondent's machine
                      because there is nowhere else for it to happen. */}
                  <div className="fm-card-note">
                    The form marks itself in the respondent’s own browser, so the answer key travels inside
                    the file they receive — someone determined can read it. Good for practice, homework and
                    self-assessment; not for an exam you need to invigilate.
                  </div>
                </>
              )}
            </div>

            <div className="fm-settings-card">
              <div className="fm-card-label">After they submit</div>
              <input
                className="fm-input"
                value={content.settings.confirmation}
                placeholder="Thanks — your response has been recorded."
                onChange={(e) =>
                  commit({
                    ...contentRef.current,
                    settings: { ...contentRef.current.settings, confirmation: e.target.value },
                  })
                }
              />
              <div className="fm-card-note">
                Shown on the same page, along with the response file and code they send back to you.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ResponsesPanel content={content} onChange={commit} title={doc.meta.title} />
      )}

      {previewOpen && (
        <Modal
          title="Preview"
          subtitle="Exactly what the people you send this to will see. Submitting only works in the saved file."
          onClose={() => setPreviewOpen(false)}
          width={940}
        >
          <iframe className="fm-preview-frame" title="Form preview" sandbox="allow-scripts" srcDoc={previewHtml} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Button variant="primary" onClick={() => setPreviewOpen(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {shareOpen && (
        <Modal
          title="Share this form"
          subtitle="Anleo has no server, so a form travels as a file. Here is the whole round trip."
          onClose={() => setShareOpen(false)}
          width={490}
        >
          <ol className="share-steps">
            <li>
              <strong>You get one .html file.</strong> The questions, the styling and the code that
              collects the answers are all inside it.
            </li>
            <li>
              <strong>Send it however you like</strong> — email, AirDrop, a USB stick, a shared folder.
            </li>
            <li>
              <strong>They double-click it and fill it in.</strong> Any browser, on any computer or
              phone. No app, no account, no internet.
            </li>
            <li>
              <strong>Their answers come back to them, not to a server.</strong> On submit the page
              hands them a small .aresp file and a code they can paste into a message.
            </li>
            <li>
              <strong>They send that back and you import it</strong> on the Responses tab, where every
              reply adds up into a summary you can export.
            </li>
          </ol>

          <div className="share-note">
            Nobody in the middle ever sees the answers — not a server, not us. The only copies are the
            one they send you and the one on this Mac.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void runShareExport()}>
              Save the form file
            </Button>
          </div>
        </Modal>
      )}

      {toast && <div className="fm-toast">{toast}</div>}
    </div>
  )
}
