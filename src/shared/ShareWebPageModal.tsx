// Plain-English explainer for the "share as a web page" export, so the feature
// is obvious to someone who has never heard the phrase "living document".

import React from 'react'
import type { AppKind } from './types'
import { Modal, Button } from './ui'

const COPY: Record<AppKind, { what: string; keeps: string }> = {
  docs: {
    what: 'a web page version of this document',
    keeps: 'Formatting, images and tables all come along. Checklists stay tickable.',
  },
  sheets: {
    what: 'a web page version of this spreadsheet',
    keeps: 'Formulas keep working — whoever opens it can change numbers and watch the totals update.',
  },
  slides: {
    what: 'a web page version of this presentation',
    keeps: 'It plays like a slideshow — arrow keys to move, F for fullscreen, S for speaker notes.',
  },
}

export function ShareWebPageModal({
  kind,
  onClose,
  onExport,
}: {
  kind: AppKind
  onClose: () => void
  onExport: () => void
}) {
  const copy = COPY[kind]
  return (
    <Modal
      title="Share as a web page"
      subtitle={`Saves ${copy.what} as one file anyone can open.`}
      onClose={onClose}
      width={470}
    >
      <ol className="share-steps">
        <li>
          <strong>You get a single .html file.</strong> Save it wherever you like.
        </li>
        <li>
          <strong>Send it to anyone</strong> — email it, AirDrop it, or put it on a USB stick.
        </li>
        <li>
          <strong>They just double-click it.</strong> It opens in any web browser on Mac, Windows,
          phone or tablet. No app to install, no account, no internet needed.
        </li>
      </ol>

      <div className="share-note">{copy.keeps}</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={onExport}>
          Create web page
        </Button>
      </div>
    </Modal>
  )
}
