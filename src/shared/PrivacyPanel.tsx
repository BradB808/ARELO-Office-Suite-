// Live read-out of the app's own network and storage controls.
//
// Claims about privacy are worth very little without a way to check them, so
// this reads the real state from the main process rather than printing a
// reassuring paragraph. If the network gate ever failed to install, this says
// so instead of saying "you're protected".

import React, { useEffect, useState } from 'react'
import { platform, type SecurityStatus } from './platform'
import { subscribeAi } from './ai'

function IcShield({ ok }: { ok: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden>
      <path
        d="M10 2.2 16 4.6v4.9c0 3.6-2.4 6.6-6 7.9-3.6-1.3-6-4.3-6-7.9V4.6L10 2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {ok ? (
        <path d="m7.2 9.9 2 2 3.6-3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M10 6.6v4m0 2.4v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  )
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="privacy-row">
      <span className={ok ? 'privacy-dot on' : 'privacy-dot off'} aria-hidden />
      <div>
        <div className="privacy-row-label">{label}</div>
        <div className="privacy-row-detail">{detail}</div>
      </div>
    </div>
  )
}

export function PrivacyPanel() {
  const [status, setStatus] = useState<SecurityStatus | null>(null)

  const refresh = () => {
    platform.securityStatus().then(setStatus)
  }

  useEffect(refresh, [])
  // Turning AI on or off changes what the gate allows — reflect it immediately.
  useEffect(() => subscribeAi(refresh), [])

  if (!status) return null

  const aiOn = status.aiEnabled

  return (
    <div className="privacy-panel">
      <div className="privacy-head" data-testid="privacy-head">
        <span className={aiOn ? 'privacy-badge partial' : 'privacy-badge full'}>
          <IcShield ok={!aiOn} />
          {aiOn ? 'Offline except AI' : 'Fully offline'}
        </span>
      </div>

      <Row
        ok={status.networkGate}
        label={
          status.networkGate
            ? 'Outbound connections are blocked by default'
            : 'Network gate is not active'
        }
        detail={
          status.networkGate
            ? aiOn
              ? 'openrouter.ai is the only address this app can reach, and only because you added a key.'
              : 'This app cannot reach any address on the internet. Nothing to disable — it is the default.'
            : 'Running outside the desktop app, so the main-process protections are not in force.'
        }
      />

      <Row
        ok
        label="Your documents never leave this Mac"
        detail="No account, no sync, no telemetry, no crash reports, no update check. Files are read and written only when you use Open, Save or Export."
      />

      <Row
        ok
        label="Documents you open cannot call home"
        detail="Imported files are stripped of scripts, embedded frames and images hosted on a website — the usual way a sender learns you opened their file."
      />

      <Row
        ok={!aiOn || status.keyEncrypted}
        label={
          aiOn
            ? status.keyEncrypted
              ? 'Your API key is encrypted in the macOS Keychain'
              : 'Your API key could not be encrypted'
            : 'No API key stored'
        }
        detail={
          aiOn
            ? status.keyEncrypted
              ? 'It is sealed to your login account, so a copy of the app-support folder or a backup does not reveal it.'
              : 'This Mac reported no keychain support. Remove the key if that is unexpected.'
            : 'AI features are off. Remove nothing — there is nothing stored.'
        }
      />

      {aiOn && (
        <div className="privacy-warn">
          AI is on. When you run an AI action, the text you selected is sent to OpenRouter and
          handled under their policies. Everything else stays local. Remove your key above to turn
          this off completely.
        </div>
      )}
    </div>
  )
}
