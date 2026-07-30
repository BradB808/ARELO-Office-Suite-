// Unit tests for the shared contracts added for live links, AI, the command
// palette and living-document export.
// Run: npx vite build --ssr src/shared/shared.test.ts --outDir .tmp-sharedtest \
//        && node .tmp-sharedtest/shared.test.js

import { buildAiRequest, parseSseChunk, stripFence, OPENROUTER_URL } from './ai'
import { parseRange, indexToCol, colToIndex, rangeToA1, readRange, linkLabel } from './livelink'
import { fuzzyScore, searchCommands, registerCommands, getCommands, clearCommands, type Command } from './commands'
import { escapeHtml, jsonForScript, livingPage } from './livingDoc'
import type { Sheet } from './types'

let passed = 0
let failed = 0

function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) passed++
  else {
    failed++
    console.error('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : '')
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
}

// ---------- AI request layer ----------

const req = buildAiRequest({ system: 'sys', prompt: 'hello', apiKey: 'sk-test', model: 'm/x', maxTokens: 99 })
eq('ai: url', req.url, OPENROUTER_URL)
eq('ai: method', req.options.method, 'POST')
const headers = req.options.headers as Record<string, string>
eq('ai: auth header', headers.Authorization, 'Bearer sk-test')
eq('ai: json content type', headers['Content-Type'], 'application/json')
ok('ai: identifies itself', headers['X-Title'] === 'Anleo Office')
const body = JSON.parse(req.options.body as string)
eq('ai: model passed through', body.model, 'm/x')
eq('ai: streaming on', body.stream, true)
eq('ai: max tokens', body.max_tokens, 99)
eq('ai: system message', body.messages[0], { role: 'system', content: 'sys' })
eq('ai: user message', body.messages[1], { role: 'user', content: 'hello' })
ok('ai: key never appears in body', !(req.options.body as string).includes('sk-test'))

// SSE parsing
const chunk = [
  'data: {"choices":[{"delta":{"content":"Hel"}}]}',
  'data: {"choices":[{"delta":{"content":"lo"}}]}',
  'data: [DONE]',
].join('\n')
const parsed = parseSseChunk(chunk)
eq('sse: deltas', parsed.deltas, ['Hel', 'lo'])
eq('sse: done flag', parsed.done, true)
eq('sse: ignores keepalives', parseSseChunk(': ping\n\n').deltas, [])
eq('sse: tolerates partial json', parseSseChunk('data: {"choices":[{"delta"').deltas, [])
eq('sse: empty delta skipped', parseSseChunk('data: {"choices":[{"delta":{}}]}').deltas, [])

eq('stripFence: plain', stripFence('  =SUM(A1:A3)  '), '=SUM(A1:A3)')
eq('stripFence: fenced', stripFence('```excel\n=SUM(A1:A3)\n```'), '=SUM(A1:A3)')
eq('stripFence: bare fence', stripFence('```\n{"a":1}\n```'), '{"a":1}')

// ---------- live links ----------

eq('col: A', colToIndex('A'), 0)
eq('col: Z', colToIndex('Z'), 25)
eq('col: AA', colToIndex('AA'), 26)
eq('col: BC', colToIndex('BC'), 54)
eq('col roundtrip', indexToCol(colToIndex('AB')), 'AB')
eq('range: simple', parseRange('B2:D5'), { r0: 1, c0: 1, r1: 4, c1: 3 })
eq('range: single cell', parseRange('C3'), { r0: 2, c0: 2, r1: 2, c1: 2 })
eq('range: absolute refs', parseRange('$B$2:$D$5'), { r0: 1, c0: 1, r1: 4, c1: 3 })
eq('range: reversed normalised', parseRange('D5:B2'), { r0: 1, c0: 1, r1: 4, c1: 3 })
eq('range: lowercase', parseRange('b2:d5'), { r0: 1, c0: 1, r1: 4, c1: 3 })
eq('range: malformed', parseRange('nonsense'), null)
eq('range: empty', parseRange(''), null)
eq('rangeToA1', rangeToA1(0, 0, 2, 1), 'A1:B3')

const sheet: Sheet = {
  name: 'Data',
  cells: {
    A1: { v: 'Item' },
    B1: { v: 'Qty' },
    A2: { v: 'Bolts' },
    B2: { v: '10' },
    A3: { v: 'Nuts' },
    B3: { v: '32' },
    B4: { v: '=SUM(B2:B3)' },
  },
  colWidths: {},
  rowHeights: {},
}
const rows = readRange(sheet, 'A1:B4')
eq('readRange: shape', rows?.length, 4)
eq('readRange: header row', rows?.[0], ['Item', 'Qty'])
eq('readRange: values', rows?.[1], ['Bolts', '10'])
ok('readRange: formulas computed, not raw', rows?.[3]?.[1] === '42', rows?.[3])
eq('readRange: blank cells are empty strings', rows?.[3]?.[0], '')
eq('readRange: invalid range', readRange(sheet, 'zzz'), null)
eq(
  'linkLabel',
  linkLabel({
    sourceId: 'x',
    sourceTitle: 'Budget',
    sheetName: 'Data',
    range: 'A1:B4',
    snapshot: [],
    refreshedAt: 0,
  }),
  'Budget · Data!A1:B4',
)

// ---------- command palette ----------

ok('fuzzy: exact wins', fuzzyScore('New document', 'New document') > fuzzyScore('New document', 'new'))
ok('fuzzy: prefix beats mid-word', fuzzyScore('New document', 'new') > fuzzyScore('New document', 'doc'))
ok('fuzzy: subsequence matches', fuzzyScore('New spreadsheet', 'nsp') >= 0)
ok('fuzzy: no match returns -1', fuzzyScore('New document', 'zzzz') === -1)
ok('fuzzy: empty query neutral', fuzzyScore('anything', '') === 0)

const cmds: Command[] = [
  { id: 'a', title: 'New document', group: 'Create', run: () => {} },
  { id: 'b', title: 'New spreadsheet', group: 'Create', run: () => {} },
  { id: 'c', title: 'Open settings', group: 'App', keywords: 'openrouter api key', run: () => {} },
]
eq('search: empty returns all', searchCommands(cmds, '').length, 3)
eq('search: nsp finds spreadsheet', searchCommands(cmds, 'nsp')[0].id, 'b')
eq('search: keyword match', searchCommands(cmds, 'openrouter')[0].id, 'c')
eq('search: no match', searchCommands(cmds, 'qqqq').length, 0)

registerCommands('test', cmds)
eq('registry: registered', getCommands().length, 3)
registerCommands('test2', [{ id: 'd', title: 'Extra', group: 'X', run: () => {} }])
eq('registry: merges scopes', getCommands().length, 4)
registerCommands('test', [cmds[0]])
eq('registry: re-register replaces scope', getCommands().length, 2)
clearCommands('test')
eq('registry: clear removes scope', getCommands().length, 1)
clearCommands('test2')
eq('registry: empty after clear', getCommands().length, 0)

// ---------- living document ----------

eq('escapeHtml', escapeHtml('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
ok('jsonForScript: escapes closing tag', !jsonForScript({ s: '</script>' }).includes('</script>'))
ok('jsonForScript: still parses', JSON.parse(jsonForScript({ a: 1 })).a === 1)

const page = livingPage({ title: 'My <doc>', badge: 'Interactive document', css: '.x{}', body: '<p>hi</p>', script: 'var a=1' })
ok('livingPage: doctype', page.startsWith('<!doctype html>'))
ok('livingPage: title escaped', page.includes('<title>My &lt;doc&gt;</title>'))
ok('livingPage: body included', page.includes('<p>hi</p>'))
ok('livingPage: css inlined', page.includes('.x{}'))
ok('livingPage: script inlined', page.includes('var a=1'))
ok('livingPage: self-contained (no external refs)', !/<(script|link)[^>]+src=|href="http/.test(page))
ok('livingPage: attribution', page.includes('Anleo Office'))

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} assertions)`)
if (failed) process.exitCode = 1
else console.log('ALL SHARED TESTS PASSED')
