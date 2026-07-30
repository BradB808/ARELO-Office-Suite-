# Security

## Reporting a vulnerability

Please open a [security advisory](https://github.com/BradB808/ARELO-Office-Suite-/security/advisories/new)
rather than a public issue, and give us a chance to ship a fix first.

Include what you did, what happened, and what you expected. A proof of concept
helps enormously. There is no bounty — this is a free project — but you will be
credited unless you prefer otherwise.

### What counts as severe here

Ranked by how much it matters for this project's users:

1. **Anything that makes the app contact the network without the user asking.**
   This is the top severity, above memory-safety issues, because the whole
   premise of the app is that it does not.
2. **Anything that gets a remote resource, a script, or an event handler past
   the import sanitizer** — a hostile document is the realistic attack.
3. **Anything that exposes the stored API key** in clear text or to another
   process.
4. **Anything that writes document content somewhere unexpected** — a temp file
   that survives, a log, a crash dump.
5. Ordinary renderer/main-process escapes and dependency vulnerabilities.

## Design

Three independent layers, so no single bug is fatal:

| Layer | Where | What it stops |
|---|---|---|
| Network gate | `electron/security.cjs` (main process) | Every request that is not local, cancelled below the renderer |
| Content-Security-Policy | `index.html`, tightened at build time by `vite.config.ts` | Remote loads, inline scripts, form posts, framing |
| Import sanitizer | `src/shared/sanitizeHtml.ts` (allowlist) | Hostile markup entering a document at all |

Supporting measures: `contextIsolation` and `sandbox` on, `nodeIntegration`
off, `webviewTag` off, all permission requests denied, navigation and redirects
blocked, external links gated behind a dialog showing the real URL, the API key
sealed with `safeStorage`, PDF rendering in an isolated session that can reach
nothing, and scratch files created `0600` in a `0700` directory then overwritten
before deletion.

The renderer's preload exposes a fixed list of IPC calls and nothing else.
`store:set` refuses to persist an API key in clear text even if the renderer
asks it to.

## Running the checks

```bash
npm run verify:security
```

34 assertions in a real Electron process. `npm run dist` will not produce a
build unless they all pass.

The sanitizer's 35-payload corpus needs a browser DOM:

```bash
npm run dev
```

then <http://localhost:5173/security-test.html>.

## Verifying a build

There is no code signing certificate on this project, so a downloaded `.dmg`
is only as trustworthy as wherever you got it. If it matters, build it
yourself:

```bash
git clone https://github.com/BradB808/ARELO-Office-Suite-.git
cd ARELO-Office-Suite-
npm install
npm run dist
```

The result lands in `release/`. Because `npm run dist` runs the security checks
first, a build that produced a DMG is a build that passed them.

## Dependencies

`npm audit` reports advisories in `electron-builder` and its tree. Those are
**build-time** tools — they are not part of the packaged application and never
run on a user's machine. The dependencies that ship are audited clean.

SheetJS is installed from the vendor's own distribution
(`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) rather than from npm,
because the npm copy is frozen at 0.18.5 and carries a prototype-pollution
advisory (CVE-2023-30533). Since the app parses spreadsheets that may have been
sent by someone else, that matters. If your network cannot reach that host, the
install will fail — that is deliberate rather than silently falling back.

## Update policy

The app makes no update check by design, which means updates do not reach you
on their own. Watch this repository for releases. This trade-off is spelled out
in [PRIVACY.md](PRIVACY.md#what-this-does-not-protect-you-from).
