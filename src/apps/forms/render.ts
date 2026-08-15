// Turning a form into a page someone else can fill in. Anleo has no server, so
// a form leaves the app as one self-contained .html file: the author sends it
// wherever they like, the recipient opens it offline, and on submit the page
// hands their answers straight back to them as a .aresp file and a paste-able
// code. Nothing is transmitted — see the CSP in shared/livingDoc.ts, which
// forbids this page from reaching the network at all.
//
// Answers go on the wire in exactly the shape FormResponse.answers holds:
// option questions emit the option's *label* (an "Other" entry emits whatever
// the respondent typed), checkboxes emit an array of those, everything else
// emits its control value, and unanswered questions are simply absent. Labels
// rather than option ids keep a response file readable on its own, which
// matters when it may sit in someone's inbox for a week before it is imported.
//
// The response encoder is duplicated inside the generated page's script. It has
// to be: the page is standalone and cannot import responses.ts. Both sides
// produce "ANLEO-RESPONSE:" + URL-safe base64 of the UTF-8 JSON — keep them in
// step, decodeResponse() is the only thing that ever reads this output.

import type { FormQuestion, FormsContent, FormTheme } from '../../shared/types'
import { DEFAULT_FORM_THEME } from '../../shared/blank'
import { cssFamily } from '../../shared/fonts'
import { escapeHtml, jsonForScript, livingPage } from '../../shared/livingDoc'
import { questionNumbers } from './model'

const MAX_SCALE_POINTS = 20
const MAX_ROWS = 12

/** Theme colours are user data that ends up inside a <style> block, so only
 *  let through shapes that cannot terminate a declaration and inject rules. */
function safeColor(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim()
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback
}

function safeFamily(name: string | undefined): string {
  const clean = (name ?? '').replace(/[^A-Za-z0-9 ()-]/g, '')
  const family = cssFamily(clean || DEFAULT_FORM_THEME.fontFamily)
  // This family lands on <body> of a file opened on a machine we know nothing
  // about. Without a fallback, a font the recipient lacks drops them to Times.
  return family.endsWith('sans-serif') ? family : `${family}, -apple-system, system-ui, sans-serif`
}

/** Numbers that become attributes, labels or loop bounds. TypeScript vouches for
 *  the shape of a form the app built; it cannot vouch for a file that arrived
 *  from elsewhere, and every one of these is reachable from parsed JSON. */
function intOr(value: unknown, fallback: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? n : fallback
}

/** Omitted entirely rather than emitted as "NaN" when the value is nonsense. */
function numAttr(name: string, value: number | undefined): string {
  const n = Number(value)
  return value === undefined || !Number.isFinite(n) ? '' : ` ${name}="${n}"`
}

/** Same ceiling the editor's stepper enforces — on the printable form each row
 *  becomes a ruled line, so an out-of-range value would emit thousands. */
function rowCount(q: FormQuestion, least: number): number {
  return Math.min(MAX_ROWS, Math.max(least, intOr(q.rows, 4)))
}

function scalePoints(q: FormQuestion): number[] {
  const min = intOr(q.scaleMin, 1)
  const max = intOr(q.scaleMax, 5)
  const out: number[] = []
  // A scale is a row of buttons, so a nonsense range must not emit thousands.
  for (let n = min; n <= Math.min(max, min + MAX_SCALE_POINTS - 1); n++) out.push(n)
  return out.length ? out : [min]
}

function fileSlug(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'form'
}

function themeCss(theme: FormTheme | undefined): string {
  const t = theme ?? DEFAULT_FORM_THEME
  return `:root {
    --accent: ${safeColor(t.accent, DEFAULT_FORM_THEME.accent)};
    --head-from: ${safeColor(t.headerFrom, DEFAULT_FORM_THEME.headerFrom)};
    --head-to: ${safeColor(t.headerTo, DEFAULT_FORM_THEME.headerTo)};
    --head-ink: ${safeColor(t.headerColor, DEFAULT_FORM_THEME.headerColor)};
    --form-font: ${safeFamily(t.fontFamily)};
  }`
}

const PRIVACY_LINE =
  'This page is not connected to the internet and cannot send anything anywhere. Your answers stay on this device until you choose who to send them to.'

// ---------- fillable ----------

function optionRows(q: FormQuestion, type: 'radio' | 'checkbox'): string {
  const name = `q_${escapeHtml(q.id)}`
  const rows = (q.options ?? [])
    .map(
      (o) =>
        `<label class="afx-opt"><input type="${type}" name="${name}" value="${escapeHtml(o.label)}"><span>${escapeHtml(o.label)}</span></label>`,
    )
    .join('')
  if (!q.otherOption) return rows
  // The "Other" text box sits outside the <label> on purpose: nested inside it,
  // a click meant for the text field would toggle the radio instead.
  return `${rows}<div class="afx-otherrow">
      <label class="afx-opt"><input type="${type}" name="${name}" value="" data-other-pick><span>Other</span></label>
      <input type="text" class="afx-other" data-other-text placeholder="Your answer" aria-label="Other answer for ${escapeHtml(q.title)}">
    </div>`
}

function controlHtml(q: FormQuestion): string {
  const ph = q.placeholder ? ` placeholder="${escapeHtml(q.placeholder)}"` : ''
  const label = ` aria-label="${escapeHtml(q.title)}"`
  switch (q.kind) {
    case 'paragraph':
      return `<textarea class="afx-field" rows="${rowCount(q, 2)}"${ph}${label}></textarea>`
    case 'choice':
      return `<div class="afx-opts" role="radiogroup" aria-label="${escapeHtml(q.title)}">${optionRows(q, 'radio')}</div>`
    case 'checkboxes':
      return `<div class="afx-opts" role="group" aria-label="${escapeHtml(q.title)}">${optionRows(q, 'checkbox')}</div>`
    case 'dropdown': {
      const opts = (q.options ?? [])
        .map((o) => `<option value="${escapeHtml(o.label)}">${escapeHtml(o.label)}</option>`)
        .join('')
      return `<select class="afx-field afx-select"${label}><option value="">Choose…</option>${opts}</select>`
    }
    case 'scale': {
      const pts = scalePoints(q)
      const name = `q_${escapeHtml(q.id)}`
      const cells = pts
        .map(
          (n) =>
            `<label class="afx-pt"><span class="afx-ptn">${n}</span><input type="radio" name="${name}" value="${n}" aria-label="${n}"></label>`,
        )
        .join('')
      const lo = q.scaleMinLabel ? `<span class="afx-endlab">${escapeHtml(q.scaleMinLabel)}</span>` : ''
      const hi = q.scaleMaxLabel ? `<span class="afx-endlab">${escapeHtml(q.scaleMaxLabel)}</span>` : ''
      return `<div class="afx-scale" role="radiogroup" aria-label="${escapeHtml(q.title)}">${lo}<div class="afx-pts">${cells}</div>${hi}</div>`
    }
    case 'date':
      return `<input type="date" class="afx-field afx-narrow"${label}>`
    case 'time':
      return `<input type="time" class="afx-field afx-narrow"${label}>`
    case 'email':
      return `<input type="email" class="afx-field" autocomplete="off"${ph}${label}>`
    case 'number':
      return `<input type="number" class="afx-field afx-narrow"${numAttr('min', q.min)}${numAttr('max', q.max)}${ph}${label}>`
    default:
      return `<input type="text" class="afx-field"${ph}${label}>`
  }
}

function questionHtml(q: FormQuestion, number: number | undefined): string {
  const help = q.help ? `<p class="afx-help">${escapeHtml(q.help)}</p>` : ''
  if (q.kind === 'section')
    return `<section class="afx-q afx-sec"><h2>${escapeHtml(q.title)}</h2>${help}</section>`

  const num = number === undefined ? '' : `<span class="afx-num">${number}.</span> `
  const req = q.required ? '<span class="afx-req" aria-label="required">*</span>' : ''
  return `<section class="afx-q" data-qid="${escapeHtml(q.id)}" data-kind="${escapeHtml(q.kind)}" data-required="${q.required ? '1' : '0'}">
    <div class="afx-qtitle">${num}${escapeHtml(q.title)}${req}</div>
    ${help}
    ${controlHtml(q)}
    <p class="afx-err" role="alert" hidden></p>
  </section>`
}

const FILLABLE_CSS = `
  body { font-family: var(--form-font); }
  /* Inherited by every question, option and heading. Titles routinely carry a
     URL or a part number with nothing to break on, and on a phone one of those
     otherwise sets the width of the whole page. */
  .afx-page { max-width: 760px; margin: 0 auto; padding: 22px 16px 64px; overflow-wrap: anywhere; }
  .afx-head {
    background: linear-gradient(135deg, var(--head-from), var(--head-to));
    color: var(--head-ink); border-radius: 16px; padding: 30px 28px;
  }
  .afx-head h1 { margin: 0; font-size: 27px; line-height: 1.25; font-weight: 700; }
  .afx-head p { margin: 10px 0 0; font-size: 15px; line-height: 1.55; opacity: 0.92; white-space: pre-wrap; }
  .afx-privacy {
    margin: 14px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--muted);
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 11px 14px;
  }
  /* Deliberately not sticky: the page shell already has a sticky bar of its own,
     whose height changes with the title, and a second one lands on top of it. */
  .afx-bar { margin: 16px 0 0; }
  .afx-track { height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; }
  .afx-fill { height: 100%; width: 0; background: var(--accent); transition: width 0.2s ease; }
  .afx-count { margin: 6px 0 0; font-size: 11.5px; color: var(--muted); }
  .afx-q {
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    padding: 20px 22px; margin-top: 14px;
  }
  .afx-q.afx-bad { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.12); }
  .afx-sec { background: transparent; border: none; border-bottom: 2px solid var(--line); border-radius: 0; padding: 26px 2px 10px; }
  .afx-sec h2 { margin: 0; font-size: 19px; font-weight: 700; }
  .afx-qtitle { font-size: 15.5px; font-weight: 600; line-height: 1.45; }
  .afx-num { color: var(--muted); font-weight: 600; }
  .afx-req { color: #dc2626; margin-left: 3px; }
  .afx-help { margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); white-space: pre-wrap; }
  .afx-field {
    display: block; width: 100%; margin-top: 12px; font: inherit; font-size: 15px; color: inherit;
    background: var(--bg); border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px;
  }
  .afx-field:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
  textarea.afx-field { resize: vertical; line-height: 1.5; }
  .afx-narrow { max-width: 240px; }
  .afx-opts { margin-top: 10px; display: flex; flex-direction: column; gap: 2px; }
  .afx-opt { display: flex; align-items: flex-start; gap: 10px; padding: 7px 4px; font-size: 15px; line-height: 1.4; cursor: pointer; }
  .afx-opt input { accent-color: var(--accent); width: 17px; height: 17px; margin: 1px 0 0; flex: none; }
  .afx-otherrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .afx-otherrow .afx-opt { flex: none; }
  .afx-other {
    flex: 1; min-width: 180px; font: inherit; font-size: 14.5px; color: inherit; background: transparent;
    border: none; border-bottom: 1px solid var(--line); padding: 5px 2px;
  }
  .afx-other:focus { outline: none; border-bottom-color: var(--accent); }
  .afx-scale { display: flex; align-items: center; gap: 14px; margin-top: 14px; flex-wrap: wrap; }
  .afx-endlab { font-size: 13px; color: var(--muted); }
  .afx-pts { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; justify-content: space-between; min-width: 220px; }
  .afx-pt { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; padding: 2px 6px; }
  .afx-ptn { font-size: 13px; color: var(--muted); }
  .afx-pt input { accent-color: var(--accent); width: 18px; height: 18px; margin: 0; }
  .afx-err { margin: 10px 0 0; font-size: 13px; color: #dc2626; font-weight: 500; }
  .afx-actions { margin-top: 20px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .afx-btn {
    font: inherit; font-size: 15px; font-weight: 600; color: #fff; background: var(--accent);
    border: none; border-radius: 10px; padding: 12px 26px; cursor: pointer;
  }
  .afx-btn:hover { filter: brightness(1.07); }
  .afx-btn.afx-ghost { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
  .afx-done { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 30px 28px; margin-top: 18px; }
  .afx-done h2 { margin: 0; font-size: 21px; line-height: 1.35; }
  .afx-done > p { margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: var(--muted); }
  .afx-ways { display: flex; gap: 14px; margin-top: 20px; flex-wrap: wrap; }
  .afx-way { flex: 1 1 260px; border: 1px solid var(--line); border-radius: 12px; padding: 18px; background: var(--bg); }
  .afx-way h3 { margin: 0 0 6px; font-size: 14.5px; }
  .afx-way p { margin: 0 0 14px; font-size: 13px; line-height: 1.55; color: var(--muted); }
  .afx-code {
    width: 100%; font-family: Menlo, Monaco, monospace; font-size: 11.5px; line-height: 1.45;
    color: inherit; background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
    padding: 9px; resize: vertical; word-break: break-all;
  }
  .afx-said { font-size: 12.5px; color: var(--muted); margin-left: 4px; }
  @media (max-width: 560px) {
    .afx-page { padding: 14px 12px 48px; }
    .afx-head { padding: 22px 18px; border-radius: 13px; }
    .afx-head h1 { font-size: 22px; }
    .afx-q { padding: 16px 15px; border-radius: 12px; }
    .afx-btn { width: 100%; }
    /* Too narrow for "Never [1..5] Definitely" on one line, so the end labels
       drop underneath, each still sitting beneath the point it describes. */
    .afx-scale { display: grid; grid-template-columns: 1fr 1fr; row-gap: 6px; }
    .afx-pts { grid-area: 1 / 1 / 2 / 3; }
    .afx-endlab:first-child { grid-area: 2 / 1 / 3 / 2; }
    .afx-endlab:last-child { grid-area: 2 / 2 / 3 / 3; text-align: right; }
  }
`

/** Vanilla, dependency-free page script: validation, progress, and the two
 *  ways back. Everything it needs is already in the DOM, so no question data
 *  is duplicated into the script beyond the download filename. */
function fillableScript(fileName: string): string {
  return `;(function () {
  var FILE = ${jsonForScript(fileName)};
  var qs = [].slice.call(document.querySelectorAll('.afx-q[data-qid]'));
  var form = document.getElementById('afx-form');
  var done = document.getElementById('afx-done');
  var fill = document.getElementById('afx-fill');
  var count = document.getElementById('afx-count');
  var code = '';

  function otherText(pick) {
    var box = pick.parentNode.parentNode.querySelector('[data-other-text]');
    return box ? box.value.trim() : '';
  }

  function collect(sec) {
    var kind = sec.getAttribute('data-kind');
    if (kind === 'checkboxes') {
      var out = [];
      var boxes = sec.querySelectorAll('input[type="checkbox"]');
      for (var i = 0; i < boxes.length; i++) {
        if (!boxes[i].checked) continue;
        if (boxes[i].hasAttribute('data-other-pick')) {
          var t = otherText(boxes[i]);
          if (t) out.push(t);
        } else out.push(boxes[i].value);
      }
      return out;
    }
    if (kind === 'choice' || kind === 'scale') {
      var picked = sec.querySelector('input[type="radio"]:checked');
      if (!picked) return '';
      return picked.hasAttribute('data-other-pick') ? otherText(picked) : picked.value;
    }
    var field = sec.querySelector('.afx-field');
    return field ? String(field.value).trim() : '';
  }

  function isEmpty(a) {
    return Array.isArray(a) ? a.length === 0 : a === '';
  }

  // The same checks (and the same wording) as validateAnswer() in model.ts, so a
  // response the page accepts is one the author's app also accepts on import.
  function problem(sec) {
    var a = collect(sec);
    if (sec.getAttribute('data-required') === '1' && isEmpty(a)) return 'This question is required';
    if (isEmpty(a)) return null;
    var kind = sec.getAttribute('data-kind');
    if (kind === 'email' && !/^[^\\s@,;]+@[^\\s@,;]+\\.[A-Za-z]{2,}$/.test(a)) return 'Enter a valid email address';
    // A browser too old for type="date"/"time" hands the respondent a plain text
    // box, and whatever they type there has to clear the same bar as everyone
    // else's — including rejecting 2025-02-30, exactly as isValidDate() does.
    if (kind === 'date') {
      var d = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(a);
      var dt = d ? new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])) : null;
      if (!d || !dt || dt.getUTCFullYear() !== +d[1] || dt.getUTCMonth() !== +d[2] - 1 || dt.getUTCDate() !== +d[3])
        return 'Enter a valid date';
    }
    if (kind === 'time') {
      var t = /^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?$/.exec(a);
      if (!t || +t[1] > 23 || +t[2] > 59 || +(t[3] || 0) > 59) return 'Enter a valid time';
    }
    if (kind === 'number') {
      var n = Number(a);
      if (a === '' || !isFinite(n)) return 'Enter a number';
      var field = sec.querySelector('.afx-field');
      var min = field.getAttribute('min');
      var max = field.getAttribute('max');
      if (min !== null && n < Number(min)) return 'Must be at least ' + min;
      if (max !== null && n > Number(max)) return 'Must be at most ' + max;
    }
    return null;
  }

  function setError(sec, msg) {
    var el = sec.querySelector('.afx-err');
    el.textContent = msg || '';
    el.hidden = !msg;
    sec.classList.toggle('afx-bad', !!msg);
  }

  // Required questions are what the bar is about; with none set, tracking every
  // question still gives an honest sense of how far along they are.
  var tracked = qs.filter(function (s) { return s.getAttribute('data-required') === '1'; });
  if (!tracked.length) tracked = qs;

  function progress() {
    if (!fill) return;
    var n = 0;
    for (var i = 0; i < tracked.length; i++) if (!isEmpty(collect(tracked[i]))) n++;
    fill.style.width = tracked.length ? Math.round((n / tracked.length) * 100) + '%' : '0%';
    count.textContent = n + ' of ' + tracked.length + ' answered';
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.hasAttribute && t.hasAttribute('data-other-text') && t.value) {
      var pick = t.parentNode.querySelector('[data-other-pick]');
      if (pick) pick.checked = true;
    }
    touched(t);
  });
  document.addEventListener('change', function (e) { touched(e.target); });

  function touched(t) {
    var sec = t && t.closest ? t.closest('.afx-q[data-qid]') : null;
    if (sec && sec.classList.contains('afx-bad') && !problem(sec)) setError(sec, null);
    progress();
  }

  function rid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // Mirrors encodeResponse() in src/apps/forms/responses.ts — base64 over the
  // UTF-8 bytes (not the code units), so accents and emoji survive the trip.
  function encode(resp) {
    var bytes = new TextEncoder().encode(JSON.stringify(resp));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'ANLEO-RESPONSE:' + btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  }

  function submit() {
    var first = null;
    for (var i = 0; i < qs.length; i++) {
      var msg = problem(qs[i]);
      setError(qs[i], msg);
      if (msg && !first) first = qs[i];
    }
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var focusable = first.querySelector('.afx-field, input');
      if (focusable) focusable.focus({ preventScroll: true });
      return;
    }
    var answers = {};
    for (var j = 0; j < qs.length; j++) {
      var a = collect(qs[j]);
      if (!isEmpty(a)) answers[qs[j].getAttribute('data-qid')] = a;
    }
    code = encode({ id: rid(), submittedAt: Date.now(), answers: answers });
    document.getElementById('afx-code').value = code;
    form.hidden = true;
    done.hidden = false;
    window.scrollTo(0, 0);
  }

  document.getElementById('afx-submit').addEventListener('click', submit);

  // The file leads with a line for whoever double-clicks it out of curiosity;
  // parseResponsePayload() reads the code lines that follow the marker.
  var NOTE = 'Anleo Forms response.\\nSend this file back to whoever gave you the form — they can import it in Anleo Office.\\n\\n';

  document.getElementById('afx-download').addEventListener('click', function () {
    var url = URL.createObjectURL(new Blob([NOTE + code + '\\n'], { type: 'text/plain;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = FILE;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    said('afx-said-file', 'Saved — send it back however you like.');
  });

  document.getElementById('afx-copy').addEventListener('click', function () {
    var ta = document.getElementById('afx-code');
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function () {});
    said('afx-said-code', 'Copied.');
  });

  function said(id, text) {
    var el = document.getElementById(id);
    el.textContent = text;
    el.hidden = false;
  }

  progress();
})();`
}

/** The standalone .html a respondent fills in — offline, in any browser. */
export function renderFillableForm(title: string, content: FormsContent): string {
  const name = title || 'Untitled form'
  const numbers = content.settings?.showQuestionNumbers ? questionNumbers(content.questions) : {}
  const questions = content.questions.map((q) => questionHtml(q, numbers[q.id])).join('')

  const desc = content.description ? `<p>${escapeHtml(content.description)}</p>` : ''
  const progress = content.settings?.showProgress
    ? `<div class="afx-bar"><div class="afx-track"><div class="afx-fill" id="afx-fill"></div></div><p class="afx-count" id="afx-count"></p></div>`
    : ''

  const body = `<div class="afx-page">
  <header class="afx-head">
    <h1>${escapeHtml(name)}</h1>
    ${desc}
  </header>
  <p class="afx-privacy">${PRIVACY_LINE}</p>
  <div id="afx-form">
    ${progress}
    ${questions}
    <div class="afx-actions">
      <button type="button" class="afx-btn" id="afx-submit">Submit</button>
    </div>
  </div>
  <section class="afx-done" id="afx-done" hidden>
    <h2>${escapeHtml(content.settings?.confirmation || 'Thanks — your response has been recorded.')}</h2>
    <p>Nothing was sent anywhere. Return your answers to whoever gave you this form, either way below — both contain the same thing.</p>
    <div class="afx-ways">
      <div class="afx-way">
        <h3>Download the response file</h3>
        <p>Saves <strong>${escapeHtml(fileSlug(name))}-response.aresp</strong>. Attach it to an email or message.</p>
        <button type="button" class="afx-btn" id="afx-download">Download response file</button>
        <span class="afx-said" id="afx-said-file" hidden></span>
      </div>
      <div class="afx-way">
        <h3>Or copy the response code</h3>
        <p>Paste this text into a message instead — no attachment needed.</p>
        <textarea class="afx-code" id="afx-code" rows="4" readonly spellcheck="false"></textarea>
        <div class="afx-actions">
          <button type="button" class="afx-btn afx-ghost" id="afx-copy">Copy code</button>
          <span class="afx-said" id="afx-said-code" hidden></span>
        </div>
      </div>
    </div>
  </section>
</div>`

  return livingPage({
    title: name,
    badge: 'Fillable form',
    css: `${themeCss(content.theme)}\n${FILLABLE_CSS}`,
    body,
    script: fillableScript(`${fileSlug(name)}-response.aresp`),
  })
}

// ---------- printable ----------

function printLines(n: number): string {
  let out = ''
  for (let i = 0; i < n; i++) out += '<div class="afp-line"></div>'
  return out
}

function printControl(q: FormQuestion): string {
  const box = (round: boolean, label: string) =>
    `<div class="afp-opt"><span class="afp-box${round ? ' afp-round' : ''}"></span><span>${label}</span></div>`
  switch (q.kind) {
    case 'paragraph':
      return `<div class="afp-lines">${printLines(rowCount(q, 3))}</div>`
    case 'choice':
    case 'dropdown':
    case 'checkboxes': {
      const round = q.kind !== 'checkboxes'
      const rows = (q.options ?? []).map((o) => box(round, escapeHtml(o.label))).join('')
      const other = q.otherOption && q.kind !== 'dropdown'
        ? `<div class="afp-opt"><span class="afp-box${round ? ' afp-round' : ''}"></span><span>Other:</span><span class="afp-inline"></span></div>`
        : ''
      return `<div class="afp-opts">${rows}${other}</div>`
    }
    case 'scale': {
      const pts = scalePoints(q)
        .map((n) => `<span class="afp-pt">${n}</span>`)
        .join('')
      const lo = q.scaleMinLabel ? `<span class="afp-endlab">${escapeHtml(q.scaleMinLabel)}</span>` : ''
      const hi = q.scaleMaxLabel ? `<span class="afp-endlab">${escapeHtml(q.scaleMaxLabel)}</span>` : ''
      return `<div class="afp-scale">${lo}<span class="afp-pts">${pts}</span>${hi}</div>`
    }
    case 'date':
      return `<div class="afp-lines afp-short">${printLines(1)}<span class="afp-hint">DD / MM / YYYY</span></div>`
    case 'time':
      return `<div class="afp-lines afp-short">${printLines(1)}<span class="afp-hint">HH : MM</span></div>`
    default:
      return `<div class="afp-lines">${printLines(1)}</div>`
  }
}

const PRINTABLE_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0; background: #ffffff; color: #16181d;
    font-family: var(--form-font); -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* overflow-wrap inherits: an unbroken title would otherwise run off the sheet. */
  .afp-page { max-width: 720px; margin: 0 auto; padding: 24px 28px 40px; overflow-wrap: anywhere; }
  .afp-head {
    background: linear-gradient(135deg, var(--head-from), var(--head-to));
    color: var(--head-ink); border-radius: 12px; padding: 24px 26px; margin-bottom: 8px;
  }
  .afp-head h1 { margin: 0; font-size: 24px; line-height: 1.25; }
  .afp-head p { margin: 9px 0 0; font-size: 13.5px; line-height: 1.55; opacity: 0.93; white-space: pre-wrap; }
  .afp-q { padding: 16px 2px 4px; page-break-inside: avoid; break-inside: avoid; }
  .afp-sec { border-bottom: 1.5px solid #c9ccd4; padding-bottom: 6px; margin-top: 10px; }
  .afp-sec h2 { margin: 0; font-size: 17px; }
  .afp-qtitle { font-size: 14px; font-weight: 600; line-height: 1.45; }
  .afp-num { color: #6b7280; }
  .afp-req { color: #dc2626; margin-left: 3px; }
  .afp-help { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: #6b7280; white-space: pre-wrap; }
  .afp-lines { margin-top: 12px; }
  .afp-lines.afp-short { max-width: 260px; }
  .afp-line { border-bottom: 1px solid #9aa0ab; height: 26px; }
  .afp-hint { font-size: 10.5px; color: #9aa0ab; }
  .afp-opts { margin-top: 10px; }
  .afp-opt { display: flex; align-items: center; gap: 9px; font-size: 13.5px; padding: 4px 0; }
  .afp-box { width: 13px; height: 13px; border: 1.4px solid #6b7280; border-radius: 2px; flex: none; }
  .afp-box.afp-round { border-radius: 50%; }
  .afp-inline { flex: 1; border-bottom: 1px solid #9aa0ab; height: 15px; }
  .afp-scale { display: flex; align-items: center; gap: 14px; margin-top: 12px; }
  .afp-pts { display: flex; gap: 10px; flex: 1; justify-content: center; }
  .afp-pt {
    width: 27px; height: 27px; border: 1.4px solid #6b7280; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px;
  }
  .afp-endlab { font-size: 11.5px; color: #6b7280; max-width: 120px; }
  .afp-foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #dcdfe5; font-size: 10.5px; color: #9aa0ab; }
`

/** The pen-and-paper version, for print and PDF export. No script, no fields —
 *  ruled lines, empty boxes and circled scale points instead. */
export function renderPrintableForm(title: string, content: FormsContent): string {
  const name = title || 'Untitled form'
  const numbers = content.settings?.showQuestionNumbers ? questionNumbers(content.questions) : {}

  const questions = content.questions
    .map((q) => {
      const help = q.help ? `<p class="afp-help">${escapeHtml(q.help)}</p>` : ''
      if (q.kind === 'section')
        return `<section class="afp-q afp-sec"><h2>${escapeHtml(q.title)}</h2>${help}</section>`
      const n: number | undefined = numbers[q.id]
      const num = n === undefined ? '' : `<span class="afp-num">${n}.</span> `
      const req = q.required ? '<span class="afp-req">*</span>' : ''
      return `<section class="afp-q">
    <div class="afp-qtitle">${num}${escapeHtml(q.title)}${req}</div>
    ${help}
    ${printControl(q)}
  </section>`
    })
    .join('')

  const desc = content.description ? `<p>${escapeHtml(content.description)}</p>` : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Anleo Office">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'">
<title>${escapeHtml(name)}</title>
<style>${themeCss(content.theme)}
${PRINTABLE_CSS}</style>
</head>
<body>
<div class="afp-page">
  <header class="afp-head">
    <h1>${escapeHtml(name)}</h1>
    ${desc}
  </header>
  ${questions}
  <p class="afp-foot">${escapeHtml(name)} · made with Anleo Office</p>
</div>
</body>
</html>`
}
