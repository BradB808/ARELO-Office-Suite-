// "Living document" export: a single self-contained HTML file — print-
// quality typography (reusing the plain HTML export's CSS), clickable
// task-list checkboxes (state kept in-page only; this is a static export, it
// never writes back to the source .adoc), and an automatic "Contents" jump
// list once the document has 3+ headings. Images are already inlined as data
// URLs by the time HTML reaches us, so the file needs no network to open.

import { livingPage } from '../../shared/livingDoc'
import { DOC_TYPOGRAPHY_CSS, replacePageBreaksForExport } from './export'

const LIVING_CSS = `
  .page {
    max-width: 816px; margin: 0 auto; background: var(--surface); color: var(--ink);
    border-radius: 10px; padding: 56px 64px; box-shadow: 0 1px 3px var(--line);
  }
  @media (max-width: 720px) {
    .page { padding: 32px 22px; }
  }
  .page li[data-type="taskItem"] input[type="checkbox"] { cursor: pointer; }
  .page li[data-type="taskItem"][data-checked="true"] > div { color: var(--muted); text-decoration: line-through; }
  .living-toc {
    background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
    padding: 14px 18px; margin: 0 0 26px; font-size: 13px;
  }
  .living-toc h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 8px; }
  .living-toc ul { margin: 0; padding-left: 18px; list-style: disc; }
  .living-toc li { margin: 3px 0; }
  .living-toc a { color: var(--accent); text-decoration: none; }
  .living-toc a:hover { text-decoration: underline; }
${DOC_TYPOGRAPHY_CSS}
`

const LIVING_SCRIPT = `
(function () {
  // Task-list checkboxes stay clickable in this exported copy — toggling one
  // only updates this page's own DOM (data-checked drives the strikethrough
  // style above), nothing writes back to any source document.
  document.querySelectorAll('li[data-type="taskItem"]').forEach(function (li) {
    var box = li.querySelector('input[type="checkbox"]');
    if (!box) return;
    box.addEventListener('change', function () {
      li.setAttribute('data-checked', box.checked ? 'true' : 'false');
    });
  });

  // "Contents" jump list once there's enough structure for it to be useful.
  var headings = Array.prototype.slice.call(document.querySelectorAll('.page h1, .page h2, .page h3'));
  if (headings.length >= 3) {
    var used = Object.create(null);
    var items = headings.map(function (h, i) {
      var base = (h.textContent || 'section').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'section';
      var id = used[base] ? base + '-' + i : base;
      used[base] = true;
      h.id = id;
      var indent = h.tagName === 'H1' ? 0 : h.tagName === 'H2' ? 14 : 28;
      var li = document.createElement('li');
      li.style.marginLeft = indent + 'px';
      var a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = h.textContent;
      li.appendChild(a);
      return li;
    });
    var toc = document.createElement('div');
    toc.className = 'living-toc';
    var heading = document.createElement('h2');
    heading.textContent = 'Contents';
    var list = document.createElement('ul');
    items.forEach(function (li) { list.appendChild(li); });
    toc.appendChild(heading);
    toc.appendChild(list);
    var page = document.querySelector('.page');
    if (page) page.insertBefore(toc, page.firstChild);
  }
})();
`

export function buildLivingDocumentHtml(html: string, title: string): string {
  const body = `<div class="anleo-wrap"><div class="page">${replacePageBreaksForExport(html)}</div></div>`
  return livingPage({
    title: title || 'Untitled document',
    badge: 'Interactive document',
    css: LIVING_CSS,
    body,
    script: LIVING_SCRIPT,
  })
}
