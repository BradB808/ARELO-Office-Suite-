// Pure cell-reference math: column<->letters, A1 parsing, ranges, ref shifting.
// No DOM, no dependencies on the rest of the engine.

export interface RefParts {
  col: number // 0-based
  row: number // 0-based
  colAbs: boolean
  rowAbs: boolean
}

export function colToLetters(col: number): string {
  let n = col + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function lettersToCol(letters: string): number {
  let n = 0
  const up = letters.toUpperCase()
  for (let i = 0; i < up.length; i++) n = n * 26 + (up.charCodeAt(i) - 64)
  return n - 1
}

const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/

export function parseCellRef(s: string): RefParts | null {
  const m = REF_RE.exec(s.trim())
  if (!m) return null
  const [, ca, letters, ra, digits] = m
  const row = parseInt(digits, 10) - 1
  if (row < 0) return null
  return { col: lettersToCol(letters), row, colAbs: ca === '$', rowAbs: ra === '$' }
}

export function refToString(col: number, row: number, colAbs = false, rowAbs = false): string {
  const c = Math.max(0, col)
  const r = Math.max(0, row)
  return `${colAbs ? '$' : ''}${colToLetters(c)}${rowAbs ? '$' : ''}${r + 1}`
}

/** Canonical "A1" form (no absolute markers) — used as the sheet.cells / memo key. */
export function normalizeRef(s: string): string | null {
  const p = parseCellRef(s)
  if (!p) return null
  return refToString(p.col, p.row)
}

export function parseRangeStr(s: string): { c1: RefParts; c2: RefParts } | null {
  const parts = s.split(':')
  if (parts.length !== 2) return null
  const a = parseCellRef(parts[0])
  const b = parseCellRef(parts[1])
  if (!a || !b) return null
  return { c1: a, c2: b }
}

export function rangeBounds(a: RefParts, b: RefParts) {
  return {
    col1: Math.min(a.col, b.col),
    col2: Math.max(a.col, b.col),
    row1: Math.min(a.row, b.row),
    row2: Math.max(a.row, b.row),
  }
}

/** All refs in a rectangular range, row-major, canonical "A1" form. */
export function rangeRefList(rangeStr: string): string[] | null {
  const r = parseRangeStr(rangeStr)
  if (!r) return null
  const { col1, col2, row1, row2 } = rangeBounds(r.c1, r.c2)
  const out: string[] = []
  for (let row = row1; row <= row2; row++) {
    for (let col = col1; col <= col2; col++) out.push(refToString(col, row))
  }
  return out
}

export function shiftRefParts(p: RefParts, dCol: number, dRow: number): RefParts {
  return {
    col: p.colAbs ? p.col : Math.max(0, p.col + dCol),
    row: p.rowAbs ? p.row : Math.max(0, p.row + dRow),
    colAbs: p.colAbs,
    rowAbs: p.rowAbs,
  }
}

export function colLettersValid(letters: string): boolean {
  return /^[A-Za-z]{1,3}$/.test(letters)
}
