// Runtime value model for the formula engine: FValue, error wrapper, coercions,
// comparisons and criteria (COUNTIF/SUMIF-style) matching. Pure, no DOM.

export class FErr {
  code: string
  constructor(code: string) {
    this.code = code
  }
}

export type FValue = number | string | boolean | FErr

export function isErr(v: FValue): v is FErr {
  return v instanceof FErr
}

export function toNumber(v: FValue): number | FErr {
  if (v instanceof FErr) return v
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const s = v.trim()
  if (s === '') return 0
  if (/^-?\d+(\.\d+)?%$/.test(s)) return parseFloat(s) / 100
  const cleaned = s.replace(/^\$/, '').replace(/,/g, '')
  const n = Number(cleaned)
  if (Number.isNaN(n)) return new FErr('#VALUE!')
  return n
}

/** Like toNumber but collapses errors to NaN instead of propagating — for filters/matchers. */
export function toNumberLoose(v: FValue): number {
  const n = toNumber(v)
  return n instanceof FErr ? NaN : n
}

export function toBoolean(v: FValue): boolean | FErr {
  if (v instanceof FErr) return v
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = v.trim().toUpperCase()
  if (s === 'TRUE') return true
  if (s === 'FALSE') return false
  if (s === '') return false
  return new FErr('#VALUE!')
}

function formatPlainNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? 'Infinity' : n < 0 ? '-Infinity' : 'NaN'
  if (Number.isInteger(n)) return String(n)
  const r = Math.round(n * 1e10) / 1e10
  return String(r)
}

export function toDisplayString(v: FValue): string {
  if (v instanceof FErr) return v.code
  if (typeof v === 'number') return formatPlainNumber(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return v
}

function typeRank(v: FValue): number {
  if (typeof v === 'number') return 0
  if (typeof v === 'string') return 1
  if (typeof v === 'boolean') return 2
  return 3
}

/** -1 / 0 / 1, Excel-style: numbers < text < booleans when types differ. */
export function compareValues(a: FValue, b: FValue): number {
  if (typeof a === typeof b) {
    if (typeof a === 'number' && typeof b === 'number') return a === b ? 0 : a < b ? -1 : 1
    if (typeof a === 'string' && typeof b === 'string') {
      const la = a.toLowerCase()
      const lb = b.toLowerCase()
      return la === lb ? 0 : la < lb ? -1 : 1
    }
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1
  }
  const ra = typeRank(a)
  const rb = typeRank(b)
  return ra === rb ? 0 : ra < rb ? -1 : 1
}

export function valuesEqual(a: FValue, b: FValue): boolean {
  return compareValues(a, b) === 0
}

export function wildcardToRegExp(pattern: string): RegExp {
  let re = ''
  for (const ch of pattern) {
    if (ch === '*') re += '.*'
    else if (ch === '?') re += '.'
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + re + '$', 'i')
}

/** Builds a predicate from a COUNTIF/SUMIF/AVERAGEIF-style criteria value. */
export function buildCriteriaMatcher(critRaw: FValue): (v: FValue) => boolean {
  if (critRaw instanceof FErr) return () => false
  if (typeof critRaw === 'number') {
    return (v) => {
      const n = toNumber(v)
      return !(n instanceof FErr) && n === critRaw
    }
  }
  if (typeof critRaw === 'boolean') {
    return (v) => {
      const b = toBoolean(v)
      return !(b instanceof FErr) && b === critRaw
    }
  }
  const s = critRaw
  const m = /^(<=|>=|<>|<|>|=)([\s\S]*)$/.exec(s)
  const op = m ? m[1] : '='
  const rest = m ? m[2] : s
  const numRest = rest.trim() !== '' ? Number(rest) : NaN
  const isNumeric = rest.trim() !== '' && !Number.isNaN(numRest)

  if (op === '<' || op === '>' || op === '<=' || op === '>=') {
    return (v) => {
      const n = toNumberLoose(v)
      if (Number.isNaN(n) || !isNumeric) return false
      switch (op) {
        case '<':
          return n < numRest
        case '>':
          return n > numRest
        case '<=':
          return n <= numRest
        default:
          return n >= numRest
      }
    }
  }

  if (isNumeric) {
    return (v) => {
      const n = toNumberLoose(v)
      const eq = !Number.isNaN(n) && n === numRest
      return op === '<>' ? !eq : eq
    }
  }

  if (rest.trim() === '') {
    // Blank criteria matches blank cells.
    return (v) => {
      const eq = v === ''
      return op === '<>' ? !eq : eq
    }
  }

  const re = wildcardToRegExp(rest)
  return (v) => {
    const vs = toDisplayString(v)
    const eq = re.test(vs)
    return op === '<>' ? !eq : eq
  }
}
