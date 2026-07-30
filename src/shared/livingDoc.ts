// "Living document" export: one self-contained .html file that anyone can open
// in a browser — no app, no account, no network. Docs keep their formatting and
// working checkboxes, spreadsheets stay interactive (formulas recalculate), and
// decks become a keyboard-navigable presentation.

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Safe to inline inside a <script> block (avoids closing the tag early). */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export const LIVING_BASE_CSS = `
  :root {
    --ink: #171a21; --muted: #5b6270; --line: rgba(15,18,25,0.12);
    --surface: #ffffff; --bg: #f4f5f7; --accent: #2563eb;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .anleo-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 18px; background: var(--surface);
    border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10;
  }
  .anleo-bar h1 { font-size: 14px; font-weight: 650; margin: 0; }
  .anleo-bar .spacer { flex: 1; }
  .anleo-badge {
    font-size: 11px; color: var(--muted); border: 1px solid var(--line);
    padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  }
  .anleo-wrap { max-width: 1100px; margin: 0 auto; padding: 26px 18px 60px; }
`

export interface LivingPageInit {
  title: string
  /** Short right-side note in the top bar, e.g. "Interactive spreadsheet". */
  badge: string
  css: string
  body: string
  script?: string
}

/** Assembles the final standalone document. */
export function livingPage(init: LivingPageInit): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Anleo Office">
<!--
  The page you are reading is entirely self-contained. This policy is what
  enforces that: it permits only inline styles and scripts that shipped inside
  this file, and forbids the page from loading or contacting anything on the
  internet. Whoever you sent it to can open it without their browser telling
  anyone — including us — that they did.
-->
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'">
<title>${escapeHtml(init.title)}</title>
<style>${LIVING_BASE_CSS}
${init.css}</style>
</head>
<body>
<div class="anleo-bar">
  <h1>${escapeHtml(init.title)}</h1>
  <div class="spacer"></div>
  <span class="anleo-badge">${escapeHtml(init.badge)} · made with Anleo Office</span>
</div>
${init.body}
${init.script ? `<script>\n${init.script}\n</script>` : ''}
</body>
</html>`
}
