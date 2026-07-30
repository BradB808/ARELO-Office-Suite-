// Sheets toolbar icons — 17px stroke SVGs matching src/shared/icons.tsx style
// (strokeWidth 1.5, round caps, 20x20 viewBox).

import React from 'react'

const S = { width: 17, height: 17, viewBox: '0 0 20 20', fill: 'none' } as const

export function IcUndo() {
  return (
    <svg {...S}>
      <path d="M5 8.5H12a4 4 0 0 1 0 8H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 5.3L5 8.5l3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcRedo() {
  return (
    <svg {...S}>
      <path d="M15 8.5H8a4 4 0 0 0 0 8h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8 5.3L15 8.5l-3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcBold() {
  return (
    <svg {...S}>
      <path d="M6.3 4.2h4.6a2.9 2.9 0 0 1 0 5.8H6.3zM6.3 10h5a3.1 3.1 0 0 1 0 6.2H6.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function IcItalic() {
  return (
    <svg {...S}>
      <path d="M9 4.5h5.5M5.5 15.5H11M12.2 4.5l-4.4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcUnderline() {
  return (
    <svg {...S}>
      <path d="M5.8 4v5.8a4.2 4.2 0 0 0 8.4 0V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.8 16h10.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IcStrike() {
  return (
    <svg {...S}>
      <path d="M4.5 10h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.5 6.2c0-1.3 1.5-2.4 3.5-2.4s3.5.9 3.5 2.2M6.7 13.6c0 1.4 1.5 2.4 3.4 2.4s3.6-1 3.6-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcAlignLeft() {
  return (
    <svg {...S}>
      <path d="M4.5 5.5h11M4.5 9h7M4.5 12.5h11M4.5 16h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcAlignCenter() {
  return (
    <svg {...S}>
      <path d="M4.5 5.5h11M6.5 9h7M4.5 12.5h11M6.5 16h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcAlignRight() {
  return (
    <svg {...S}>
      <path d="M4.5 5.5h11M8.5 9h7M4.5 12.5h11M8.5 16h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcWrap() {
  return (
    <svg {...S}>
      <path d="M4.5 6h11M4.5 10h7.5a2.3 2.3 0 0 1 0 4.6h-2M11 12.2l1.8 2.4-1.8 2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcBorders() {
  return (
    <svg {...S}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 10h13M10 3.5v13" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
    </svg>
  )
}

export function IcSort() {
  return (
    <svg {...S}>
      <path d="M6.5 4.5v11M4 13l2.5 2.5L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 15.5v-11M16 7l-2.5-2.5L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcInsertRowCol() {
  return (
    <svg {...S}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 8.2h13" stroke="currentColor" strokeWidth="1.1" opacity="0.6" />
      <circle cx="14.2" cy="14.2" r="3.6" fill="var(--surface)" stroke="currentColor" strokeWidth="0" />
      <path d="M14.2 12.4v3.6M12.4 14.2h3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IcChart() {
  return (
    <svg {...S}>
      <path d="M4.5 15.5V8M9 15.5V5M13.5 15.5v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 15.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IcTextColor() {
  return (
    <svg {...S}>
      <path d="M7 13.5L9.7 5h.6l2.7 8.5M7.9 10.7h4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcFillColor() {
  return (
    <svg {...S}>
      <path d="M5 9.5L10.5 4l5.5 5.5-5.5 5.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3.5 10.8c0 1.5 1.2 2.7 2.7 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.5 6.5l6.5 6.5" stroke="currentColor" strokeWidth="1.1" opacity="0.6" />
    </svg>
  )
}

export function IcDecimalMore() {
  return (
    <svg {...S}>
      <path d="M4.5 8h5M4.5 12h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.5 6.5v7M10.3 11.2l2.2 2.3 2.2-2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.6" cy="15.4" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function IcDecimalLess() {
  return (
    <svg {...S}>
      <path d="M4.5 8h5M4.5 12h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.5 13.5v-7M10.3 8.8l2.2-2.3 2.2 2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.6" cy="15.4" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function IcMerge() {
  return (
    <svg {...S}>
      <rect x="3.2" y="4" width="13.6" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.2 10h13.6" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
      <path d="M7.3 7.6L10 10l-2.7 2.4M12.7 7.6L10 10l2.7 2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcFreeze() {
  return (
    <svg {...S}>
      <rect x="3.2" y="3.2" width="13.6" height="13.6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.2 7.6h13.6M7.6 3.2v13.6" stroke="currentColor" strokeWidth="1.6" opacity="0.85" />
      <path d="M11.2 10.4h4M11.2 12.6h4M11.2 8.2h4" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    </svg>
  )
}

export function IcFunnel() {
  return (
    <svg {...S}>
      <path d="M4 4.5h12l-4.4 5.4v4.3l-3.2 1.5v-5.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function IcCondFormat() {
  return (
    <svg {...S}>
      <rect x="3.3" y="3.3" width="13.4" height="13.4" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.2 7.4h4.4M6.2 10h6.6M6.2 12.6h5.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      <circle cx="14.3" cy="7.4" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function IcDropdownList() {
  return (
    <svg {...S}>
      <rect x="3.3" y="4.5" width="13.4" height="11" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 7.7h5.4M5.8 10.9h3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12 9.6l1.7 1.7 1.7-1.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcFunction() {
  return (
    <svg {...S} width="15" height="15">
      <path d="M8.3 16c1.1 0 1.6-.8 1.8-2l.9-7.4c.2-1.7 1-2.6 2.3-2.6.5 0 .9.1 1.2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.3 9h6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IcValignTop() {
  return (
    <svg {...S}>
      <path d="M3.5 4h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.5 7.4h7M6.5 10.3h7M6.5 13.2h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

export function IcValignMiddle() {
  return (
    <svg {...S}>
      <path d="M3.5 10h2.2M14.3 10h2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.5 6.4h7M6.5 10h7M6.5 13.6h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

export function IcValignBottom() {
  return (
    <svg {...S}>
      <path d="M3.5 16h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.5 6.8h7M6.5 9.7h7M6.5 12.6h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

export function IcPaintbrush() {
  return (
    <svg {...S}>
      <path d="M6 12.5L13.5 5a1.6 1.6 0 0 1 2.3 2.3L8 14.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12.5c.9-.3 1.9.1 2.2 1a2 2 0 0 1-.5 2.2c-.9.9-2.4 1-4 1 .6-.8.3-1.4.1-2a2.3 2.3 0 0 1 2.2-2.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function IcSigma() {
  return (
    <svg {...S}>
      <path d="M14.5 4.5H5.5L10 10l-4.5 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcCurrency() {
  return (
    <svg {...S}>
      <path d="M10 3.3v13.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 6.2c-.6-.7-1.7-1.1-2.9-1.1-1.9 0-3.4.9-3.4 2.3 0 3.2 6.8 1.6 6.8 4.8 0 1.4-1.5 2.3-3.4 2.3-1.4 0-2.6-.5-3.3-1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcPercent() {
  return (
    <svg {...S}>
      <circle cx="6.3" cy="6.3" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13.7" cy="13.7" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14.5 4.5L5.5 15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IcComma() {
  return (
    <svg {...S}>
      <path d="M4.3 12h2.2M8.9 12h2.2M13.5 12h2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.9 13.4c.35.55.3 1.35-.55 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IcEraser() {
  return (
    <svg {...S}>
      <path d="M7.5 15.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.6 3.9a1.7 1.7 0 0 1 2.4 0l2.1 2.1a1.7 1.7 0 0 1 0 2.4l-6.4 6.4H6L3.9 12l6.4-6.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.4 6.9l4.7 4.7" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
    </svg>
  )
}

export function IcTable() {
  return (
    <svg {...S}>
      <rect x="3.3" y="4" width="13.4" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.3 7.7h13.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.3 11.2h13.4M3.3 13.9h13.4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

export function IcGripDots() {
  return (
    <svg width="12" height="17" viewBox="0 0 12 17" fill="none">
      <circle cx="3" cy="3" r="1.1" fill="currentColor" />
      <circle cx="9" cy="3" r="1.1" fill="currentColor" />
      <circle cx="3" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="9" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="3" cy="14" r="1.1" fill="currentColor" />
      <circle cx="9" cy="14" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function IcEdit() {
  return (
    <svg {...S}>
      <path d="M12.7 4.3l3 3L6.5 16.5l-3.6.7.7-3.6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function IcZoomOut() {
  return (
    <svg {...S}>
      <circle cx="8.6" cy="8.6" r="5.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 13l3.3 3.3M6.2 8.6h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcZoomIn() {
  return (
    <svg {...S}>
      <circle cx="8.6" cy="8.6" r="5.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 13l3.3 3.3M8.6 6.2v4.8M6.2 8.6h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}


export function IcLink() {
  return (
    <svg {...S}>
      <path
        d="M8.3 11.7a3.2 3.2 0 0 0 4.5.3l.2-.2l2-2a3.2 3.2 0 0 0-4.4-4.6l-.2.2l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.7 8.3a3.2 3.2 0 0 0-4.5-.3l-.2.2l-2 2a3.2 3.2 0 0 0 4.4 4.6l.2-.2l1.1-1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
