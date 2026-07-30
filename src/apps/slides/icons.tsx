// Slides-specific toolbar icons. 17px stroke SVGs, strokeWidth 1.5, round caps —
// matches src/shared/icons.tsx style.

import React from 'react'

const base = { width: 17, height: 17, viewBox: '0 0 20 20', fill: 'none' as const }

export function IcTextBox() {
  return (
    <svg {...base}>
      <rect x="3" y="4.5" width="14" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 8h6M7 10.4h6M7 12.8h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IcShape() {
  return (
    <svg {...base}>
      <circle cx="7.2" cy="12.5" r="3.7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.2 4.2h4.3l-4.3 8.6H8.9l4.3-8.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function IcImageAdd() {
  return (
    <svg {...base}>
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="8" r="1.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.5 14.8l4-4.3 2.6 2.7 2.9-3.6 3.5 5.2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function IcBackground() {
  return (
    <svg {...base}>
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 13.5 7.8 8l3 3.2L13.5 8l3.5 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function IcNotes() {
  return (
    <svg {...base}>
      <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.3 12.3h7.4M6.3 14.8h4.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.3 5.4h7.4v4.4H6.3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export function IcPresent() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <path d="M4.5 4.5l11 5.5-11 5.5v-11Z" fill="currentColor" />
    </svg>
  )
}

export function IcLayers() {
  return (
    <svg {...base}>
      <path d="M10 3.2 17 7l-7 3.8L3 7l7-3.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M3 10.6l7 3.8 7-3.8" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M3 14l7 3.8 7-3.8" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function IcTransition() {
  return (
    <svg {...base}>
      <rect x="2.5" y="5" width="7.5" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.5" y="5" width="7" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.4 2.2" />
      <path d="M9 10h2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 8.6l1.6 1.4-1.6 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcAlignL() {
  return (
    <svg {...base}>
      <path d="M4 5h12M4 9h8M4 13h11M4 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export function IcAlignC() {
  return (
    <svg {...base}>
      <path d="M4 5h12M6 9h8M4.5 13h11M7 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export function IcAlignR() {
  return (
    <svg {...base}>
      <path d="M4 5h12M8 9h8M5 13h11M8 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcValignTop() {
  return (
    <svg {...base}>
      <path d="M3 4h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 7.5h6M7 10.5h6M7 13.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
export function IcValignMid() {
  return (
    <svg {...base}>
      <path d="M3 10h2M15 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 6.5h6M7 9.5h6M7 12.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
export function IcValignBot() {
  return (
    <svg {...base}>
      <path d="M3 16h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 6.5h6M7 9.5h6M7 12.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IcBold() {
  return (
    <svg {...base}>
      <path d="M6.2 4.3h4.6a2.9 2.9 0 0 1 0 5.8H6.2V4.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.2 10.1h5.2a3.1 3.1 0 1 1 0 6.2H6.2v-6.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
export function IcItalic() {
  return (
    <svg {...base}>
      <path d="M12 4.5H8.5M7 15.5h3.5M11 4.5 9 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export function IcUnderline() {
  return (
    <svg {...base}>
      <path d="M5.5 4v6a4.5 4.5 0 0 0 9 0V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 16.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export function IcBullets() {
  return (
    <svg {...base}>
      <circle cx="4.3" cy="6" r="1.1" fill="currentColor" />
      <circle cx="4.3" cy="10" r="1.1" fill="currentColor" />
      <circle cx="4.3" cy="14" r="1.1" fill="currentColor" />
      <path d="M8 6h8.5M8 10h8.5M8 14h8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
export function IcNumbered() {
  return (
    <svg {...base}>
      <path d="M8 6h8.5M8 10h8.5M8 14h8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <text x="1.4" y="7.1" fontSize="4.4" fontWeight="700" fill="currentColor" stroke="none">
        1
      </text>
      <text x="1.4" y="11.1" fontSize="4.4" fontWeight="700" fill="currentColor" stroke="none">
        2
      </text>
      <text x="1.4" y="15.1" fontSize="4.4" fontWeight="700" fill="currentColor" stroke="none">
        3
      </text>
    </svg>
  )
}

export function IcClearFormat() {
  return (
    <svg {...base}>
      <path d="M5.6 15.3 9.4 4.6h1.2l3.8 10.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.3 11.3h5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.2 16.6 16.8 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IcQuickStyles() {
  return (
    <svg {...base}>
      <rect x="2.8" y="2.8" width="6.2" height="6.2" rx="1.3" fill="currentColor" opacity="0.85" />
      <rect x="11" y="2.8" width="6.2" height="6.2" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.8" y="11" width="6.2" height="6.2" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="11" width="6.2" height="6.2" rx="1.3" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

export function IcLineHeight() {
  return (
    <svg {...base}>
      <path d="M4 4.5v11M2.3 6.2 4 4.5l1.7 1.7M2.3 13.8 4 15.5l1.7-1.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 6h8M8.5 10h8M8.5 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IcOpacity() {
  return (
    <svg {...base}>
      <circle cx="10" cy="10" r="6.7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 3.3A6.7 6.7 0 0 1 10 16.7Z" fill="currentColor" fillOpacity="0.35" />
    </svg>
  )
}
export function IcCornerRadius() {
  return (
    <svg {...base}>
      <path d="M4 12V8a4 4 0 0 1 4-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 12v3.5A1.5 1.5 0 0 0 5.5 17H14a1.5 1.5 0 0 0 1.5-1.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export function IcReplace() {
  return (
    <svg {...base}>
      <path d="M4 10a6 6 0 0 1 10-4.5l1.5 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 3.3v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10a6 6 0 0 1-10 4.5L4.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 16.7v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcBringFront() {
  return (
    <svg {...base}>
      <rect x="3" y="3" width="9" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
      <rect x="8" y="8" width="9" height="9" rx="1.3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
export function IcSendBack() {
  return (
    <svg {...base}>
      <rect x="8" y="8" width="9" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
      <rect x="3" y="3" width="9" height="9" rx="1.3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
export function IcForward() {
  return (
    <svg {...base}>
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
      <rect x="7.5" y="7.5" width="8" height="8" rx="1.2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 5v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function IcBackward() {
  return (
    <svg {...base}>
      <rect x="7.5" y="4.5" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
      <rect x="4.5" y="7.5" width="8" height="8" rx="1.2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcDuplicate() {
  return (
    <svg {...base}>
      <rect x="6.5" y="6.5" width="9.5" height="9.5" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 12.5v-7A1.5 1.5 0 0 1 5.5 4h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IcRotate() {
  return (
    <svg {...base}>
      <path d="M15.8 10A5.8 5.8 0 1 1 12.4 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 3l1 2.2-2.3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcFullscreen() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 8V5a1 1 0 0 0-1-1h-3M4 12v3a1 1 0 0 0 1 1h3M16 12v3a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcAlignObjects() {
  return (
    <svg {...base}>
      <path d="M3 17V3M17 17V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="6" y="7" width="3.4" height="7" rx="0.8" fill="currentColor" />
      <rect x="10.6" y="4" width="3.4" height="10" rx="0.8" fill="currentColor" />
    </svg>
  )
}

export function IcDistribute() {
  return (
    <svg {...base}>
      <rect x="2.5" y="8.5" width="3.4" height="3.4" rx="0.7" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.3" y="8.5" width="3.4" height="3.4" rx="0.7" stroke="currentColor" strokeWidth="1.3" />
      <rect x="14.1" y="8.5" width="3.4" height="3.4" rx="0.7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function IcSlideNumber() {
  return (
    <svg {...base}>
      <path d="M7.3 3.5 5.6 16.5M14.4 3.5l-1.7 13M3.6 8h13M2.9 12.5h13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IcArrowStart() {
  return (
    <svg {...base}>
      <path d="M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 10l5-4M4 10l5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcArrowEnd() {
  return (
    <svg {...base}>
      <path d="M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 10l-5-4M16 10l-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcSparkle() {
  return (
    <svg {...base}>
      <path
        d="M6.4 3.2 7.5 6l2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8L2.5 7.1l2.8-1.1 1.1-2.8Z"
        fill="currentColor"
      />
      <path
        d="M13.8 9 14.9 11.6 17.5 12.7 14.9 13.8 13.8 16.4 12.7 13.8 10.1 12.7 12.7 11.6 13.8 9Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IcRefresh() {
  return (
    <svg {...base}>
      <path
        d="M4.2 10a5.8 5.8 0 0 1 9.9-4.1l1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M15.5 3.6v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M15.8 10a5.8 5.8 0 0 1-9.9 4.1l-1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M4.5 16.4v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcTable() {
  return (
    <svg {...base}>
      <rect x="2.8" y="4" width="14.4" height="12" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 8.4h14.4M8 4v12M12.4 4v12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export function IcHeaderRow() {
  return (
    <svg {...base}>
      <rect x="2.8" y="4" width="14.4" height="12" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 8h14.4" stroke="currentColor" strokeWidth="1.2" />
      <rect x="3.6" y="4.8" width="12.8" height="3.2" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

export function IcArrowLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function IcArrowRight() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
      <path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
