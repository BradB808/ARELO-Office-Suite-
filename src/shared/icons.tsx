// Common SVG icons (17x17 default via .iconbtn). App-specific editors keep
// their own icon files; these are the shared shell/hub set.

export function IcHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M3.5 8.5L10 3l6.5 5.5V16a1 1 0 0 1-1 1h-3.7v-4.4H8.2V17H4.5a1 1 0 0 1-1-1V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function IcDocs({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" width={size} height={size}>
      <path d="M5 2.75h7.2L16 6.55V16.2a1.05 1.05 0 0 1-1.05 1.05H5A1.05 1.05 0 0 1 3.95 16.2V3.8A1.05 1.05 0 0 1 5 2.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.8 10.2h6.4M6.8 12.8h6.4M6.8 15.4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IcSheets({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" width={size} height={size}>
      <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 8h13M3.5 12.5h13M8.5 3.5v13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function IcSlides({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" width={size} height={size}>
      <rect x="2.75" y="4.25" width="14.5" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.6 7.4l3.6 2.1-3.6 2.1V7.4Z" fill="currentColor" />
      <path d="M7 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcPlus() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IcFolder() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2h5.6A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function IcSave() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h8.2L17 6.3v9.2a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 15.5v-11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 3v4.2h5.5V3M6.7 16.5v-5h6.6v5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function IcExport() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M10 12.5V3.5M10 3.5L6.5 7M10 3.5L13.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12v3.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcTrash() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M4 5.5h12M8 5V3.8A.8.8 0 0 1 8.8 3h2.4a.8.8 0 0 1 .8.8V5M6.5 5.5l.6 10a1.2 1.2 0 0 0 1.2 1.1h3.4a1.2 1.2 0 0 0 1.2-1.1l.6-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.4 8.5v5M11.6 8.5v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IcSettings() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.8l1.1 1.9 2.2-.4 1 2 2.1.6-.4 2.2 1.5 1.6-1.5 1.6.4 2.2-2.1.6-1 2-2.2-.4-1.1 1.9-1.1-1.9-2.2.4-1-2-2.1-.6.4-2.2L2.5 10 4 8.4l-.4-2.2 2.1-.6 1-2 2.2.4L10 2.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function IcSun() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcMoon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function IcSearch() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <circle cx="9" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcClose() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IcMore() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <circle cx="4.5" cy="10" r="1.4" fill="currentColor" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function IcChevronL() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IcCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Filled, colorful app tiles used in the rail, hub, and dock. */
export function AppGlyph({ kind, size = 30 }: { kind: 'docs' | 'sheets' | 'slides'; size?: number }) {
  if (kind === 'docs') {
    return (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <rect x="2" y="2" width="36" height="36" rx="9.5" fill="#2563eb" />
        <rect x="2" y="2" width="36" height="36" rx="9.5" fill="url(#agd)" />
        <defs>
          <linearGradient id="agd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M13 11.6a1.6 1.6 0 0 1 1.6-1.6h7.6l4.8 4.8v13.6a1.6 1.6 0 0 1-1.6 1.6H14.6a1.6 1.6 0 0 1-1.6-1.6V11.6Z" fill="#fff" fillOpacity="0.95" />
        <path d="M22 10.3v4.5h4.6" fill="#bfdbfe" />
        <path d="M16 19h8M16 22.4h8M16 25.8h5.2" stroke="#2563eb" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'sheets') {
    return (
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <rect x="2" y="2" width="36" height="36" rx="9.5" fill="#059669" />
        <rect x="2" y="2" width="36" height="36" rx="9.5" fill="url(#ags)" />
        <defs>
          <linearGradient id="ags" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="10.5" y="10.5" width="19" height="19" rx="2.2" fill="#fff" fillOpacity="0.95" />
        <path d="M10.5 16.8h19M10.5 23.2h19M17 10.5v19" stroke="#059669" strokeWidth="1.7" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="2" y="2" width="36" height="36" rx="9.5" fill="#ea580c" />
      <rect x="2" y="2" width="36" height="36" rx="9.5" fill="url(#agp)" />
      <defs>
        <linearGradient id="agp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="9.5" y="12" width="21" height="13.5" rx="2.2" fill="#fff" fillOpacity="0.95" />
      <path d="M17.8 15.4l5.8 3.35-5.8 3.35v-6.7Z" fill="#ea580c" />
      <path d="M16 29h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
