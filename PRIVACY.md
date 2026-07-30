# Privacy and threat model

Anleo Office is built to be useful to people whose work makes them a target —
journalists, researchers, lawyers, anyone handling material that others would
like to read. This document says exactly what the app does, and, just as
importantly, **what it does not protect you from**. Please read the limits
section before you rely on it for anything that matters.

Nothing here is a promise about your safety. It is a description of a program.

---

## What the app does

### It makes no network requests

Anleo has no server, no account, no sync, no telemetry, no crash reporting, no
usage analytics and no update check. There is nothing to opt out of, because
there is nothing to opt into.

This is enforced, not merely intended. Every network request from the app
passes through a **deny-by-default filter in the main process**
([`electron/security.cjs`](electron/security.cjs)). Anything that is not a
local file is cancelled before it leaves. Because this sits below the renderer,
it holds even if a bug in the user interface let hostile content run.

The renderer also carries a strict Content-Security-Policy, so there are two
independent layers. The test suite proves the main-process layer works on its
own, from a page with no CSP at all.

The single exception is described under [AI](#the-one-exception-ai).

### A document you open cannot tell anyone you opened it

The oldest trick against a source or a reporter is a document containing a
remote image — a one-pixel GIF on someone's web server. Open the file and the
sender learns your IP address, your rough location, and the moment you read it.
Microsoft Word and most PDF readers will do this by default.

Anleo strips it. Every imported `.docx`, `.md`, `.html` and pasted fragment
goes through an allowlist sanitizer
([`src/shared/sanitizeHtml.ts`](src/shared/sanitizeHtml.ts)) that keeps only
known-safe elements, attributes and URL schemes. Images must be embedded in the
file itself; anything hosted on a website is removed. Scripts, iframes, embedded
objects, remote stylesheets, form submissions, `javascript:` links and every
event handler are removed. The app tells you when it removed something rather
than doing it quietly.

Even if one slipped through, the network gate would refuse to fetch it.

### Links do not open silently

Clicking a link in a document shows you the real destination and asks first.
Anleo never loads it itself. Only `http` and `https` are offered at all —
`file:`, `smb:` and custom schemes are refused outright.

### Your API key is encrypted at rest

If you use the optional AI features, the key is sealed with
[`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage), which
is backed by the macOS Keychain. It is tied to your login account, so a copy of
the application-support folder, a Time Machine snapshot or a cloud backup does
not reveal it. It is never written in clear text, and a store file left over
from an older build is migrated and scrubbed on first launch.

### Exported web pages are inert

"Share as a web page" produces a single self-contained `.html` file with its own
restrictive policy embedded. It cannot load or contact anything. Whoever you
send it to can open it without their browser reporting that to anyone —
including to us.

### PDF export leaves nothing behind

Rendering a PDF needs a scratch file. It is written into a private `0700`
directory under a random name with `0600` permissions, overwritten with random
bytes, then deleted. The renderer used for it has its own session that is
allowed to reach nothing at all.

---

## The one exception: AI

Anleo has optional AI writing tools. They are **off** until you paste in your
own [OpenRouter](https://openrouter.ai) key, and there is no bundled key.

When AI is on, and only when you actively run an AI action:

- the text you selected is sent to OpenRouter, which routes it to the model you
  chose;
- OpenRouter sees that request and your IP address;
- what they and the model provider retain is governed by **their** policies,
  not by anything Anleo can enforce.

Turning it on opens exactly one host in the network gate — `openrouter.ai` —
and nothing else. Removing your key closes it again immediately. Settings →
Privacy shows the current state at any time.

**If you are working on something sensitive, leave AI off.** The rest of the
app is fully functional without it, and with no key stored the app cannot reach
the internet at all.

---

## What this does **not** protect you from

Please take this section seriously.

**Your documents are not encrypted on disk.** They live in
`~/Library/Application Support/Anleo Office/anleo-store.json`, readable by
anything running as you. The file is `0600`, so other user accounts on the Mac
cannot read it, but that is all. **Turn on FileVault** — that is what protects
your files at rest, and it is not something an app can do for you.

**A compromised Mac defeats all of this.** Malware, a keylogger, a malicious
browser extension, screen-recording software or anyone with your login password
can read what you type and what you have saved. Anleo makes no attempt to
defend against an attacker already inside your machine, and no application
realistically can.

**Anleo does not make you anonymous.** It is not Tor, it is not a VPN, and it
does not hide who or where you are. If you turn AI on, OpenRouter sees your IP
address like any other website would.

**macOS itself sees your files.** Spotlight may index them, Time Machine backs
them up, and files you save into a synced folder (iCloud Drive, Dropbox) are
uploaded by that service, not by Anleo. Where you save things is your decision
and it matters.

**Exported files carry ordinary metadata.** A `.docx` or `.pdf` you create
contains timestamps and similar routine fields. Strip metadata separately if
that matters to you.

**There is no automatic update.** That is a deliberate consequence of making no
network requests, and it cuts both ways: nothing phones home, but **security
fixes will not reach you on their own.** Watch the repository and update
manually. This is a real trade-off, not a free win.

**This code has not been independently audited.** It is a young project. It is
open source specifically so you do not have to take anyone's word for it — the
security layer is about 250 lines and worth reading before you trust it. If your
safety depends on the answer, have someone you trust review it.

**Builds you did not make yourself are only as trustworthy as whoever made
them.** Build from source if it matters. See
[SECURITY.md](SECURITY.md#verifying-a-build).

---

## Checking these claims yourself

None of the above needs to be taken on faith.

```bash
npm run verify:security
```

Runs 34 checks inside a real Electron process: it attempts genuine connections
to outside hosts and asserts they are refused, confirms the gate blocks a page
that has no CSP at all, verifies the shipped policy dropped its development
allowances, checks that the key encrypts and round-trips, and confirms scratch
file permissions and cleanup.

The import sanitizer has its own corpus of 35 real attack payloads — tracking
pixels, `@import` beacons, `javascript:` URLs, unquoted event handlers, nested
tag smuggling:

```bash
npm run dev
```

then open <http://localhost:5173/security-test.html>.

To watch the app's network behaviour from outside, run any packet capture
(Little Snitch, `tcpdump`, Wireshark) and use Anleo normally with no API key
stored. You should see nothing.

---

## Reporting a problem

See [SECURITY.md](SECURITY.md). If you find a way to make this app contact the
network without the user asking, that is the highest-severity bug the project
can have, and it will be treated that way.
