// One AI button, identical in Docs, Sheets and Slides — same icon, same label,
// same tooltip, same place in the toolbar, so it is never a guessing game.

import React from 'react'

export function IcSparkle({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" width={size} height={size}>
      <path
        d="M10 2.6l1.5 4.1 4.1 1.5-4.1 1.5L10 13.8 8.5 9.7 4.4 8.2l4.1-1.5L10 2.6Z"
        fill="currentColor"
      />
      <path d="M15.6 12.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" fill="currentColor" opacity="0.75" />
      <path d="M4.7 12.9l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4Z" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

export function AiButton({
  active,
  onClick,
  label = 'AI assistant',
  hint,
}: {
  active?: boolean
  onClick: () => void
  /** Tooltip verb, e.g. "AI writing assistant". */
  label?: string
  /** Optional shortcut shown in the tooltip. */
  hint?: string
}) {
  return (
    <button
      className={'ai-btn' + (active ? ' on' : '')}
      title={hint ? `${label} (${hint})` : label}
      aria-label={label}
      onClick={onClick}
    >
      <IcSparkle />
      <span>AI</span>
    </button>
  )
}
