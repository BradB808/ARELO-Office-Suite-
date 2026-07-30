// Built-in spreadsheet functions. Only TYPE imports come from formula.ts (erased
// at compile time), so there is no runtime circular dependency: each function
// receives its evaluation context (ctx.evalNode / ctx.rangeValues / ctx.rangeGrid)
// as an argument instead of importing the evaluator directly.

// The .ts extensions below are required so this file's dependency graph can
// also be run directly by `node` (see formula.test.ts); @ts-ignore silences
// TS5097, which fires because the project tsconfig doesn't set
// allowImportingTsExtensions. The import of `Node`/`EvalCtx` from formula.ts
// is type-only, so it is erased at build/run time — there is no runtime
// circular dependency between functions.ts and formula.ts.
// @ts-ignore
import type { Node, EvalCtx } from './formula.ts'
// @ts-ignore
import { FErr, isErr, toNumber, toNumberLoose, toBoolean, toDisplayString, compareValues, valuesEqual, buildCriteriaMatcher } from './values.ts'
// @ts-ignore
import type { FValue } from './values.ts'
// @ts-ignore
import { dateToSerial, jsDateToSerial, serialParts, serialToDate } from './dates.ts'
// @ts-ignore
import { parseCellRef } from './refs.ts'

export type FnImpl = (args: Node[], ctx: EvalCtx) => FValue

function num(v: FValue): number {
  const n = toNumber(v)
  if (isErr(n)) throw n
  return n
}

function bool(v: FValue): boolean {
  const b = toBoolean(v)
  if (isErr(b)) throw b
  return b
}

function str(v: FValue): string {
  if (isErr(v)) throw v
  return toDisplayString(v)
}

function arg(args: Node[], i: number, ctx: EvalCtx): FValue {
  const n = args[i]
  if (!n) return ''
  const v = ctx.evalNode(n)
  if (isErr(v)) throw v
  return v
}

function argNum(args: Node[], i: number, ctx: EvalCtx, dflt?: number): number {
  if (args[i] === undefined) {
    if (dflt === undefined) throw new FErr('#VALUE!')
    return dflt
  }
  return num(arg(args, i, ctx))
}

function argStr(args: Node[], i: number, ctx: EvalCtx, dflt = ''): string {
  if (args[i] === undefined) return dflt
  return str(arg(args, i, ctx))
}

/** Flattens numeric values out of variadic range/scalar args (skips text & blanks). */
function flattenNumbers(args: Node[], ctx: EvalCtx): number[] {
  const out: number[] = []
  for (const a of args) {
    for (const v of ctx.rangeValues(a)) {
      if (isErr(v)) throw v
      if (typeof v === 'number') out.push(v)
      else if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v)
        if (!Number.isNaN(n)) out.push(n)
      }
    }
  }
  return out
}

function flattenAll(args: Node[], ctx: EvalCtx): FValue[] {
  const out: FValue[] = []
  for (const a of args) for (const v of ctx.rangeValues(a)) out.push(v)
  return out
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.sign(n) * Math.round(Math.abs(n) * f) / f
}
function roundUp(n: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.sign(n) * Math.ceil(Math.abs(n) * f) / f
}
function roundDown(n: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.sign(n) * Math.floor(Math.abs(n) * f) / f
}

function compareLookup(a: FValue, b: FValue): number {
  return compareValues(a, b)
}

function gcd2(a: number, b: number): number {
  a = Math.abs(Math.trunc(a))
  b = Math.abs(Math.trunc(b))
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** Excel PERCENTILE.INC-style linear interpolation, k in [0,1]. */
function percentileOf(ns: number[], k: number): FValue {
  if (ns.length === 0) return new FErr('#NUM!')
  if (k < 0 || k > 1) return new FErr('#NUM!')
  const sorted = ns.slice().sort((x, y) => x - y)
  const idx = k * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const frac = idx - lo
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}

/** Two ranges walked in lockstep; rows where either side isn't numeric are dropped. */
function pairedNumbers(n1: Node, n2: Node, c: EvalCtx): [number[], number[]] {
  const v1 = c.rangeValues(n1)
  const v2 = c.rangeValues(n2)
  const xs: number[] = []
  const ys: number[] = []
  const len = Math.min(v1.length, v2.length)
  for (let i = 0; i < len; i++) {
    const x = toNumber(v1[i])
    const y = toNumber(v2[i])
    if (isErr(x) || isErr(y)) continue
    xs.push(x)
    ys.push(y)
  }
  return [xs, ys]
}

/** Linear regression (least squares) over (xs, ys) — returns {slope, intercept} or an error. */
function linreg(ys: number[], xs: number[]): { slope: number; intercept: number } | FErr {
  if (xs.length < 2) return new FErr('#DIV/0!')
  const mx = xs.reduce((s, n) => s + n, 0) / xs.length
  const my = ys.reduce((s, n) => s + n, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return new FErr('#DIV/0!')
  const slope = num / den
  return { slope, intercept: my - slope * mx }
}

/** Builds per-row match booleans for SUMIFS/COUNTIFS/AVERAGEIFS/MAXIFS/MINIFS-style range/criteria pairs. */
function matchAllCriteria(a: Node[], c: EvalCtx, startIdx: number, len: number): boolean[] {
  const matchers: ((v: FValue) => boolean)[] = []
  const ranges: FValue[][] = []
  for (let i = startIdx; i + 1 < a.length; i += 2) {
    ranges.push(c.rangeValues(a[i]))
    matchers.push(buildCriteriaMatcher(arg(a, i + 1, c)))
  }
  const out: boolean[] = []
  for (let row = 0; row < len; row++) {
    let all = true
    for (let k = 0; k < matchers.length; k++) {
      if (!matchers[k](ranges[k][row])) {
        all = false
        break
      }
    }
    out.push(all)
  }
  return out
}

function isWeekend(dt: Date): boolean {
  const wd = dt.getUTCDay()
  return wd === 0 || wd === 6
}

/** Adds calendar months to a serial date, clamping the day to the target month's length. */
function addMonths(serial: number, months: number): number {
  const dt = serialToDate(serial)
  const y = dt.getUTCFullYear()
  const m = dt.getUTCMonth()
  const d = dt.getUTCDate()
  const total = m + months
  const newY = y + Math.floor(total / 12)
  const newM = ((total % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(newY, newM + 1, 0)).getUTCDate()
  return dateToSerial(newY, newM + 1, Math.min(d, lastDay))
}

export const FUNCTIONS: Record<string, FnImpl> = {
  // ---------- math / stats ----------
  SUM: (a, c) => flattenNumbers(a, c).reduce((s, n) => s + n, 0),
  AVERAGE: (a, c) => {
    const ns = flattenNumbers(a, c)
    if (ns.length === 0) return new FErr('#DIV/0!')
    return ns.reduce((s, n) => s + n, 0) / ns.length
  },
  MIN: (a, c) => {
    const ns = flattenNumbers(a, c)
    return ns.length ? Math.min(...ns) : 0
  },
  MAX: (a, c) => {
    const ns = flattenNumbers(a, c)
    return ns.length ? Math.max(...ns) : 0
  },
  COUNT: (a, c) => {
    let n = 0
    for (const arg of a)
      for (const v of c.rangeValues(arg)) {
        if (isErr(v)) continue
        if (typeof v === 'number') n++
        else if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) n++
      }
    return n
  },
  COUNTA: (a, c) => {
    let n = 0
    for (const arg of a) for (const v of c.rangeValues(arg)) if (v !== '') n++
    return n
  },
  COUNTBLANK: (a, c) => {
    let n = 0
    for (const arg of a) for (const v of c.rangeValues(arg)) if (v === '') n++
    return n
  },
  COUNTIF: (a, c) => {
    const matcher = buildCriteriaMatcher(arg(a, 1, c))
    return c.rangeValues(a[0]).filter(matcher).length
  },
  SUMIF: (a, c) => {
    const matcher = buildCriteriaMatcher(arg(a, 1, c))
    const critVals = c.rangeValues(a[0])
    const sumVals = a[2] ? c.rangeValues(a[2]) : critVals
    let total = 0
    for (let i = 0; i < critVals.length; i++) {
      if (matcher(critVals[i])) {
        const sv = sumVals[i]
        if (sv !== undefined) {
          const n = toNumber(sv)
          if (!isErr(n)) total += n
        }
      }
    }
    return total
  },
  AVERAGEIF: (a, c) => {
    const matcher = buildCriteriaMatcher(arg(a, 1, c))
    const critVals = c.rangeValues(a[0])
    const avgVals = a[2] ? c.rangeValues(a[2]) : critVals
    let total = 0
    let count = 0
    for (let i = 0; i < critVals.length; i++) {
      if (matcher(critVals[i])) {
        const sv = avgVals[i]
        if (sv !== undefined) {
          const n = toNumber(sv)
          if (!isErr(n)) {
            total += n
            count++
          }
        }
      }
    }
    if (count === 0) return new FErr('#DIV/0!')
    return total / count
  },
  PRODUCT: (a, c) => {
    const ns = flattenNumbers(a, c)
    return ns.length ? ns.reduce((s, n) => s * n, 1) : 0
  },
  MEDIAN: (a, c) => {
    const ns = flattenNumbers(a, c).slice().sort((x, y) => x - y)
    if (!ns.length) return new FErr('#DIV/0!')
    const mid = Math.floor(ns.length / 2)
    return ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2
  },
  MODE: (a, c) => {
    const ns = flattenNumbers(a, c)
    const freq = new Map<number, number>()
    for (const n of ns) freq.set(n, (freq.get(n) ?? 0) + 1)
    let best: number | null = null
    let bestCount = 1
    for (const n of ns) {
      const f = freq.get(n)!
      if (f > bestCount) {
        bestCount = f
        best = n
      }
    }
    return best === null ? new FErr('#VALUE!') : best
  },
  STDEV: (a, c) => {
    const ns = flattenNumbers(a, c)
    if (ns.length < 2) return new FErr('#DIV/0!')
    const mean = ns.reduce((s, n) => s + n, 0) / ns.length
    const variance = ns.reduce((s, n) => s + (n - mean) ** 2, 0) / (ns.length - 1)
    return Math.sqrt(variance)
  },
  VAR: (a, c) => {
    const ns = flattenNumbers(a, c)
    if (ns.length < 2) return new FErr('#DIV/0!')
    const mean = ns.reduce((s, n) => s + n, 0) / ns.length
    return ns.reduce((s, n) => s + (n - mean) ** 2, 0) / (ns.length - 1)
  },
  LARGE: (a, c) => {
    const ns = flattenNumbers([a[0]], c).slice().sort((x, y) => y - x)
    const k = Math.round(argNum(a, 1, c))
    if (k < 1 || k > ns.length) return new FErr('#VALUE!')
    return ns[k - 1]
  },
  SMALL: (a, c) => {
    const ns = flattenNumbers([a[0]], c).slice().sort((x, y) => x - y)
    const k = Math.round(argNum(a, 1, c))
    if (k < 1 || k > ns.length) return new FErr('#VALUE!')
    return ns[k - 1]
  },
  ROUND: (a, c) => round(argNum(a, 0, c), Math.round(argNum(a, 1, c, 0))),
  ROUNDUP: (a, c) => roundUp(argNum(a, 0, c), Math.round(argNum(a, 1, c, 0))),
  ROUNDDOWN: (a, c) => roundDown(argNum(a, 0, c), Math.round(argNum(a, 1, c, 0))),
  INT: (a, c) => Math.floor(argNum(a, 0, c)),
  ABS: (a, c) => Math.abs(argNum(a, 0, c)),
  SQRT: (a, c) => {
    const n = argNum(a, 0, c)
    if (n < 0) return new FErr('#VALUE!')
    return Math.sqrt(n)
  },
  POWER: (a, c) => Math.pow(argNum(a, 0, c), argNum(a, 1, c)),
  MOD: (a, c) => {
    const n = argNum(a, 0, c)
    const d = argNum(a, 1, c)
    if (d === 0) return new FErr('#DIV/0!')
    return n - d * Math.floor(n / d)
  },
  FLOOR: (a, c) => {
    const n = argNum(a, 0, c)
    const sig = argNum(a, 1, c, 1)
    if (sig === 0) return new FErr('#DIV/0!')
    return Math.floor(n / sig) * sig
  },
  CEILING: (a, c) => {
    const n = argNum(a, 0, c)
    const sig = argNum(a, 1, c, 1)
    if (sig === 0) return new FErr('#DIV/0!')
    return Math.ceil(n / sig) * sig
  },
  EXP: (a, c) => Math.exp(argNum(a, 0, c)),
  LN: (a, c) => {
    const n = argNum(a, 0, c)
    if (n <= 0) return new FErr('#VALUE!')
    return Math.log(n)
  },
  LOG: (a, c) => {
    const n = argNum(a, 0, c)
    const base = argNum(a, 1, c, 10)
    if (n <= 0 || base <= 0 || base === 1) return new FErr('#VALUE!')
    return Math.log(n) / Math.log(base)
  },
  LOG10: (a, c) => {
    const n = argNum(a, 0, c)
    if (n <= 0) return new FErr('#VALUE!')
    return Math.log10(n)
  },
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (a, c) => {
    const lo = Math.round(argNum(a, 0, c))
    const hi = Math.round(argNum(a, 1, c))
    return Math.floor(Math.random() * (hi - lo + 1)) + lo
  },
  SIGN: (a, c) => Math.sign(argNum(a, 0, c)),
  TRUNC: (a, c) => {
    const n = argNum(a, 0, c)
    const digits = Math.round(argNum(a, 1, c, 0))
    return roundDown(n, digits)
  },

  // ---------- logic ----------
  IF: (a, c) => {
    const cond = bool(arg(a, 0, c))
    if (cond) return a[1] !== undefined ? arg(a, 1, c) : true
    return a[2] !== undefined ? arg(a, 2, c) : false
  },
  IFS: (a, c) => {
    for (let i = 0; i + 1 < a.length; i += 2) {
      if (bool(arg(a, i, c))) return arg(a, i + 1, c)
    }
    return new FErr('#VALUE!')
  },
  AND: (a, c) => {
    for (const n of a)
      for (const v of c.rangeValues(n)) {
        if (v === '') continue
        if (!bool(v)) return false
      }
    return true
  },
  OR: (a, c) => {
    for (const n of a)
      for (const v of c.rangeValues(n)) {
        if (v === '') continue
        if (bool(v)) return true
      }
    return false
  },
  NOT: (a, c) => !bool(arg(a, 0, c)),
  XOR: (a, c) => {
    let count = 0
    for (const n of a)
      for (const v of c.rangeValues(n)) {
        if (v === '') continue
        if (bool(v)) count++
      }
    return count % 2 === 1
  },
  IFERROR: (a, c) => {
    const v = c.evalNode(a[0])
    if (isErr(v)) return c.evalNode(a[1])
    return v
  },
  ISBLANK: (a, c) => c.evalNode(a[0]) === '',
  ISNUMBER: (a, c) => typeof c.evalNode(a[0]) === 'number',
  ISTEXT: (a, c) => {
    const v = c.evalNode(a[0])
    return typeof v === 'string' && v !== ''
  },

  // ---------- text ----------
  CONCAT: (a, c) => flattenAll(a, c).map((v) => str(v)).join(''),
  CONCATENATE: (a, c) => flattenAll(a, c).map((v) => str(v)).join(''),
  TEXTJOIN: (a, c) => {
    const delim = argStr(a, 0, c)
    const ignoreEmpty = bool(arg(a, 1, c))
    const parts: string[] = []
    for (let i = 2; i < a.length; i++)
      for (const v of c.rangeValues(a[i])) {
        const s = str(v)
        if (ignoreEmpty && s === '') continue
        parts.push(s)
      }
    return parts.join(delim)
  },
  LEFT: (a, c) => argStr(a, 0, c).slice(0, Math.max(0, Math.round(argNum(a, 1, c, 1)))),
  RIGHT: (a, c) => {
    const s = argStr(a, 0, c)
    const n = Math.max(0, Math.round(argNum(a, 1, c, 1)))
    return n === 0 ? '' : s.slice(Math.max(0, s.length - n))
  },
  MID: (a, c) => {
    const s = argStr(a, 0, c)
    const start = Math.max(1, Math.round(argNum(a, 1, c)))
    const len = Math.max(0, Math.round(argNum(a, 2, c)))
    return s.slice(start - 1, start - 1 + len)
  },
  LEN: (a, c) => argStr(a, 0, c).length,
  LOWER: (a, c) => argStr(a, 0, c).toLowerCase(),
  UPPER: (a, c) => argStr(a, 0, c).toUpperCase(),
  PROPER: (a, c) =>
    argStr(a, 0, c).replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  TRIM: (a, c) => argStr(a, 0, c).trim().replace(/\s+/g, ' '),
  SUBSTITUTE: (a, c) => {
    const s = argStr(a, 0, c)
    const oldT = argStr(a, 1, c)
    const newT = argStr(a, 2, c)
    if (oldT === '') return s
    if (a[3] !== undefined) {
      const instance = Math.round(argNum(a, 3, c))
      let count = 0
      let idx = -1
      let searchFrom = 0
      while (true) {
        idx = s.indexOf(oldT, searchFrom)
        if (idx === -1) return s
        count++
        if (count === instance) {
          return s.slice(0, idx) + newT + s.slice(idx + oldT.length)
        }
        searchFrom = idx + oldT.length
      }
    }
    return s.split(oldT).join(newT)
  },
  REPT: (a, c) => argStr(a, 0, c).repeat(Math.max(0, Math.round(argNum(a, 1, c)))),
  FIND: (a, c) => {
    const find = argStr(a, 0, c)
    const within = argStr(a, 1, c)
    const start = Math.max(1, Math.round(argNum(a, 2, c, 1)))
    const idx = within.indexOf(find, start - 1)
    if (idx === -1) return new FErr('#VALUE!')
    return idx + 1
  },
  SEARCH: (a, c) => {
    const find = argStr(a, 0, c).toLowerCase()
    const within = argStr(a, 1, c).toLowerCase()
    const start = Math.max(1, Math.round(argNum(a, 2, c, 1)))
    const idx = within.indexOf(find, start - 1)
    if (idx === -1) return new FErr('#VALUE!')
    return idx + 1
  },
  EXACT: (a, c) => argStr(a, 0, c) === argStr(a, 1, c),
  VALUE: (a, c) => {
    const s = argStr(a, 0, c).trim()
    const n = toNumber(s)
    if (isErr(n)) return new FErr('#VALUE!')
    return n
  },

  // ---------- lookup ----------
  VLOOKUP: (a, c) => {
    const lookup = arg(a, 0, c)
    const grid = c.rangeGrid(a[1])
    const colIdx = Math.round(argNum(a, 2, c))
    const approx = a[3] !== undefined ? bool(arg(a, 3, c)) : true
    if (colIdx < 1 || colIdx > (grid[0]?.length ?? 0)) return new FErr('#REF!')
    if (approx) {
      let best = -1
      for (let i = 0; i < grid.length; i++) {
        if (compareLookup(grid[i][0], lookup) <= 0) best = i
        else break
      }
      if (best === -1) return new FErr('#VALUE!')
      return grid[best][colIdx - 1]
    }
    for (const row of grid) if (valuesEqual(row[0], lookup)) return row[colIdx - 1]
    return new FErr('#VALUE!')
  },
  HLOOKUP: (a, c) => {
    const lookup = arg(a, 0, c)
    const grid = c.rangeGrid(a[1])
    const rowIdx = Math.round(argNum(a, 2, c))
    const approx = a[3] !== undefined ? bool(arg(a, 3, c)) : true
    if (rowIdx < 1 || rowIdx > grid.length) return new FErr('#REF!')
    const header = grid[0] ?? []
    if (approx) {
      let best = -1
      for (let i = 0; i < header.length; i++) {
        if (compareLookup(header[i], lookup) <= 0) best = i
        else break
      }
      if (best === -1) return new FErr('#VALUE!')
      return grid[rowIdx - 1][best]
    }
    for (let i = 0; i < header.length; i++) if (valuesEqual(header[i], lookup)) return grid[rowIdx - 1][i]
    return new FErr('#VALUE!')
  },
  INDEX: (a, c) => {
    const grid = c.rangeGrid(a[0])
    const rowN = Math.round(argNum(a, 1, c, 0))
    if (grid.length === 1 && a.length === 2) {
      const idx = rowN
      if (idx < 1 || idx > (grid[0]?.length ?? 0)) return new FErr('#REF!')
      return grid[0][idx - 1]
    }
    if ((grid[0]?.length ?? 0) === 1 && a.length === 2) {
      const idx = rowN
      if (idx < 1 || idx > grid.length) return new FErr('#REF!')
      return grid[idx - 1][0]
    }
    const colN = Math.round(argNum(a, 2, c, 1))
    if (rowN < 1 || rowN > grid.length) return new FErr('#REF!')
    const row = grid[rowN - 1] ?? []
    if (colN < 1 || colN > row.length) return new FErr('#REF!')
    return row[colN - 1]
  },
  MATCH: (a, c) => {
    const lookup = arg(a, 0, c)
    const vals = c.rangeValues(a[1])
    const matchType = a[2] !== undefined ? Math.round(argNum(a, 2, c)) : 1
    if (matchType === 0) {
      for (let i = 0; i < vals.length; i++) if (valuesEqual(vals[i], lookup)) return i + 1
      return new FErr('#VALUE!')
    } else if (matchType > 0) {
      let best = -1
      for (let i = 0; i < vals.length; i++) {
        if (compareLookup(vals[i], lookup) <= 0) best = i
        else break
      }
      if (best === -1) return new FErr('#VALUE!')
      return best + 1
    } else {
      let best = -1
      for (let i = 0; i < vals.length; i++) {
        if (compareLookup(vals[i], lookup) >= 0) best = i
        else break
      }
      if (best === -1) return new FErr('#VALUE!')
      return best + 1
    }
  },
  CHOOSE: (a, c) => {
    const idx = Math.round(argNum(a, 0, c))
    if (idx < 1 || idx >= a.length) return new FErr('#VALUE!')
    return arg(a, idx, c)
  },

  // ---------- date/time ----------
  TODAY: (_a, c) => Math.floor(jsDateToSerial(c.now)),
  NOW: (_a, c) => jsDateToSerial(c.now),
  DATE: (a, c) => dateToSerial(argNum(a, 0, c), argNum(a, 1, c), argNum(a, 2, c)),
  YEAR: (a, c) => serialParts(argNum(a, 0, c)).year,
  MONTH: (a, c) => serialParts(argNum(a, 0, c)).month,
  DAY: (a, c) => serialParts(argNum(a, 0, c)).day,
  HOUR: (a, c) => serialParts(argNum(a, 0, c)).hour,
  MINUTE: (a, c) => serialParts(argNum(a, 0, c)).minute,
  WEEKDAY: (a, c) => {
    const wd = serialParts(argNum(a, 0, c)).weekday // 0=Sun..6=Sat
    const type = a[1] !== undefined ? Math.round(argNum(a, 1, c)) : 1
    if (type === 2) return ((wd + 6) % 7) + 1 // Mon=1..Sun=7
    if (type === 3) return (wd + 6) % 7 // Mon=0..Sun=6
    return wd + 1 // Sun=1..Sat=7
  },
  DAYS: (a, c) => argNum(a, 0, c) - argNum(a, 1, c),

  // ---------- multi-criteria ----------
  SUMIFS: (a, c) => {
    const sumVals = c.rangeValues(a[0])
    const matches = matchAllCriteria(a, c, 1, sumVals.length)
    let total = 0
    for (let i = 0; i < sumVals.length; i++) {
      if (!matches[i]) continue
      const n = toNumber(sumVals[i])
      if (!isErr(n)) total += n
    }
    return total
  },
  COUNTIFS: (a, c) => {
    const len = a[0] ? c.rangeValues(a[0]).length : 0
    const matches = matchAllCriteria(a, c, 0, len)
    return matches.filter(Boolean).length
  },
  AVERAGEIFS: (a, c) => {
    const avgVals = c.rangeValues(a[0])
    const matches = matchAllCriteria(a, c, 1, avgVals.length)
    let total = 0
    let count = 0
    for (let i = 0; i < avgVals.length; i++) {
      if (!matches[i]) continue
      const n = toNumber(avgVals[i])
      if (!isErr(n)) {
        total += n
        count++
      }
    }
    if (count === 0) return new FErr('#DIV/0!')
    return total / count
  },
  MAXIFS: (a, c) => {
    const vals = c.rangeValues(a[0])
    const matches = matchAllCriteria(a, c, 1, vals.length)
    let best: number | null = null
    for (let i = 0; i < vals.length; i++) {
      if (!matches[i]) continue
      const n = toNumber(vals[i])
      if (!isErr(n) && (best === null || n > best)) best = n
    }
    return best ?? 0
  },
  MINIFS: (a, c) => {
    const vals = c.rangeValues(a[0])
    const matches = matchAllCriteria(a, c, 1, vals.length)
    let best: number | null = null
    for (let i = 0; i < vals.length; i++) {
      if (!matches[i]) continue
      const n = toNumber(vals[i])
      if (!isErr(n) && (best === null || n < best)) best = n
    }
    return best ?? 0
  },

  // ---------- lookup / reference ----------
  XLOOKUP: (a, c) => {
    const lookup = arg(a, 0, c)
    const lookupArr = c.rangeValues(a[1])
    const returnArr = c.rangeValues(a[2])
    if (lookupArr.length !== returnArr.length) return new FErr('#VALUE!')
    const matchMode = a[4] !== undefined ? Math.round(argNum(a, 4, c)) : 0
    let foundIdx = -1
    if (matchMode === 0) {
      for (let i = 0; i < lookupArr.length; i++) {
        if (valuesEqual(lookupArr[i], lookup)) {
          foundIdx = i
          break
        }
      }
    } else if (matchMode === -1) {
      // Exact match, else the next-smaller item.
      let bestIdx = -1
      for (let i = 0; i < lookupArr.length; i++) {
        if (valuesEqual(lookupArr[i], lookup)) {
          foundIdx = i
          break
        }
        if (compareLookup(lookupArr[i], lookup) < 0 && (bestIdx === -1 || compareLookup(lookupArr[i], lookupArr[bestIdx]) > 0)) {
          bestIdx = i
        }
      }
      if (foundIdx === -1) foundIdx = bestIdx
    } else if (matchMode === 1) {
      // Exact match, else the next-larger item.
      let bestIdx = -1
      for (let i = 0; i < lookupArr.length; i++) {
        if (valuesEqual(lookupArr[i], lookup)) {
          foundIdx = i
          break
        }
        if (compareLookup(lookupArr[i], lookup) > 0 && (bestIdx === -1 || compareLookup(lookupArr[i], lookupArr[bestIdx]) < 0)) {
          bestIdx = i
        }
      }
      if (foundIdx === -1) foundIdx = bestIdx
    } else {
      return new FErr('#VALUE!')
    }
    if (foundIdx === -1) {
      if (a[3] !== undefined) return arg(a, 3, c)
      return new FErr('#N/A')
    }
    return returnArr[foundIdx]
  },
  ROW: (a, c) => {
    if (a[0] === undefined) {
      if (!c.currentRef) return new FErr('#REF!')
      const p = parseCellRef(c.currentRef)
      return p ? p.row + 1 : new FErr('#REF!')
    }
    const refs = c.rangeRefs(a[0])
    if (!refs.length) return new FErr('#VALUE!')
    const p = parseCellRef(refs[0])
    return p ? p.row + 1 : new FErr('#REF!')
  },
  COLUMN: (a, c) => {
    if (a[0] === undefined) {
      if (!c.currentRef) return new FErr('#REF!')
      const p = parseCellRef(c.currentRef)
      return p ? p.col + 1 : new FErr('#REF!')
    }
    const refs = c.rangeRefs(a[0])
    if (!refs.length) return new FErr('#VALUE!')
    const p = parseCellRef(refs[0])
    return p ? p.col + 1 : new FErr('#REF!')
  },
  ROWS: (a, c) => c.rangeGrid(a[0]).length,
  COLUMNS: (a, c) => c.rangeGrid(a[0])[0]?.length ?? 0,

  // ---------- math ----------
  SUMPRODUCT: (a, c) => {
    if (a.length === 0) return 0
    const grids = a.map((n) => c.rangeValues(n))
    const len = grids[0]?.length ?? 0
    // Excel requires all arrays to have the same dimensions; mismatched sizes
    // are a #VALUE! error rather than silently padding/truncating.
    if (grids.some((g) => g.length !== len)) return new FErr('#VALUE!')
    let total = 0
    for (let i = 0; i < len; i++) {
      let prod = 1
      for (const g of grids) {
        const n = toNumber(g[i] ?? 0)
        if (isErr(n)) throw n
        prod *= n
      }
      total += prod
    }
    return total
  },
  SUMSQ: (a, c) => flattenNumbers(a, c).reduce((s, n) => s + n * n, 0),
  GCD: (a, c) => {
    // Excel requires non-negative arguments for GCD/LCM — negative inputs are
    // #NUM!, not silently absolute-valued.
    const ns = flattenNumbers(a, c).map((n) => Math.trunc(n))
    if (ns.some((n) => n < 0)) return new FErr('#NUM!')
    if (!ns.length) return 0
    return ns.reduce((g, n) => gcd2(g, n))
  },
  LCM: (a, c) => {
    const ns = flattenNumbers(a, c).map((n) => Math.trunc(n))
    if (ns.some((n) => n < 0)) return new FErr('#NUM!')
    if (!ns.length) return 0
    if (ns.some((n) => n === 0)) return 0
    return ns.reduce((l, n) => (l * n) / gcd2(l, n))
  },
  COMBIN: (a, c) => {
    const n = Math.floor(argNum(a, 0, c))
    const k = Math.floor(argNum(a, 1, c))
    if (n < 0 || k < 0 || k > n) return new FErr('#NUM!')
    return Math.round(factorial(n) / (factorial(k) * factorial(n - k)))
  },
  PERMUT: (a, c) => {
    const n = Math.floor(argNum(a, 0, c))
    const k = Math.floor(argNum(a, 1, c))
    if (n < 0 || k < 0 || k > n) return new FErr('#NUM!')
    return Math.round(factorial(n) / factorial(n - k))
  },
  FACT: (a, c) => {
    const n = Math.floor(argNum(a, 0, c))
    if (n < 0) return new FErr('#NUM!')
    return factorial(n)
  },
  QUOTIENT: (a, c) => {
    const n = argNum(a, 0, c)
    const d = argNum(a, 1, c)
    if (d === 0) return new FErr('#DIV/0!')
    return Math.trunc(n / d)
  },
  MROUND: (a, c) => {
    const n = argNum(a, 0, c)
    const mult = argNum(a, 1, c)
    if (mult === 0) return 0
    if ((n < 0 && mult > 0) || (n > 0 && mult < 0)) return new FErr('#NUM!')
    return Math.round(n / mult) * mult
  },
  EVEN: (a, c) => {
    const n = argNum(a, 0, c)
    const sign = n < 0 ? -1 : 1
    return sign * Math.ceil(Math.abs(n) / 2) * 2
  },
  ODD: (a, c) => {
    const n = argNum(a, 0, c)
    const sign = n < 0 ? -1 : 1
    let r = Math.ceil(Math.abs(n))
    if (r % 2 === 0) r += 1
    return sign * r
  },
  RADIANS: (a, c) => (argNum(a, 0, c) * Math.PI) / 180,
  DEGREES: (a, c) => (argNum(a, 0, c) * 180) / Math.PI,
  SIN: (a, c) => Math.sin(argNum(a, 0, c)),
  COS: (a, c) => Math.cos(argNum(a, 0, c)),
  TAN: (a, c) => Math.tan(argNum(a, 0, c)),
  ASIN: (a, c) => {
    const n = argNum(a, 0, c)
    if (n < -1 || n > 1) return new FErr('#NUM!')
    return Math.asin(n)
  },
  ACOS: (a, c) => {
    const n = argNum(a, 0, c)
    if (n < -1 || n > 1) return new FErr('#NUM!')
    return Math.acos(n)
  },
  ATAN: (a, c) => Math.atan(argNum(a, 0, c)),
  // Excel's ATAN2(x_num, y_num) matches Math.atan2(y, x) — args are swapped vs. JS.
  ATAN2: (a, c) => Math.atan2(argNum(a, 1, c), argNum(a, 0, c)),
  SINH: (a, c) => Math.sinh(argNum(a, 0, c)),
  COSH: (a, c) => Math.cosh(argNum(a, 0, c)),
  TANH: (a, c) => Math.tanh(argNum(a, 0, c)),

  // ---------- statistics ----------
  PERCENTILE: (a, c) => percentileOf(flattenNumbers([a[0]], c), argNum(a, 1, c)),
  QUARTILE: (a, c) => {
    const q = Math.round(argNum(a, 1, c))
    if (q < 0 || q > 4) return new FErr('#NUM!')
    return percentileOf(flattenNumbers([a[0]], c), q / 4)
  },
  STDEVP: (a, c) => {
    const ns = flattenNumbers(a, c)
    if (!ns.length) return new FErr('#DIV/0!')
    const mean = ns.reduce((s, n) => s + n, 0) / ns.length
    return Math.sqrt(ns.reduce((s, n) => s + (n - mean) ** 2, 0) / ns.length)
  },
  VARP: (a, c) => {
    const ns = flattenNumbers(a, c)
    if (!ns.length) return new FErr('#DIV/0!')
    const mean = ns.reduce((s, n) => s + n, 0) / ns.length
    return ns.reduce((s, n) => s + (n - mean) ** 2, 0) / ns.length
  },
  GEOMEAN: (a, c) => {
    const ns = flattenNumbers(a, c)
    if (!ns.length) return new FErr('#DIV/0!')
    if (ns.some((n) => n <= 0)) return new FErr('#NUM!')
    return Math.pow(ns.reduce((s, n) => s * n, 1), 1 / ns.length)
  },
  AVEDEV: (a, c) => {
    const ns = flattenNumbers(a, c)
    if (!ns.length) return new FErr('#DIV/0!')
    const mean = ns.reduce((s, n) => s + n, 0) / ns.length
    return ns.reduce((s, n) => s + Math.abs(n - mean), 0) / ns.length
  },
  CORREL: (a, c) => {
    const [xs, ys] = pairedNumbers(a[0], a[1], c)
    if (xs.length < 2) return new FErr('#DIV/0!')
    const mx = xs.reduce((s, n) => s + n, 0) / xs.length
    const my = ys.reduce((s, n) => s + n, 0) / ys.length
    let num = 0
    let dx2 = 0
    let dy2 = 0
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx
      const dy = ys[i] - my
      num += dx * dy
      dx2 += dx * dx
      dy2 += dy * dy
    }
    if (dx2 === 0 || dy2 === 0) return new FErr('#DIV/0!')
    return num / Math.sqrt(dx2 * dy2)
  },
  SLOPE: (a, c) => {
    const [ys, xs] = pairedNumbers(a[0], a[1], c)
    const r = linreg(ys, xs)
    if (r instanceof FErr) return r
    return r.slope
  },
  INTERCEPT: (a, c) => {
    const [ys, xs] = pairedNumbers(a[0], a[1], c)
    const r = linreg(ys, xs)
    if (r instanceof FErr) return r
    return r.intercept
  },
  RSQ: (a, c) => {
    const [xs, ys] = pairedNumbers(a[0], a[1], c)
    if (xs.length < 2) return new FErr('#DIV/0!')
    const mx = xs.reduce((s, n) => s + n, 0) / xs.length
    const my = ys.reduce((s, n) => s + n, 0) / ys.length
    let num = 0
    let dx2 = 0
    let dy2 = 0
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx
      const dy = ys[i] - my
      num += dx * dy
      dx2 += dx * dx
      dy2 += dy * dy
    }
    if (dx2 === 0 || dy2 === 0) return new FErr('#DIV/0!')
    const r = num / Math.sqrt(dx2 * dy2)
    return r * r
  },
  FORECAST: (a, c) => {
    const x = argNum(a, 0, c)
    const [ys, xs] = pairedNumbers(a[1], a[2], c)
    const r = linreg(ys, xs)
    if (r instanceof FErr) return r
    return r.intercept + r.slope * x
  },
  COUNTUNIQUE: (a, c) => {
    const set = new Set<string>()
    for (const n of a)
      for (const v of c.rangeValues(n)) {
        if (v === '') continue
        if (typeof v === 'string') set.add('S:' + v.toLowerCase())
        else if (typeof v === 'number') set.add('N:' + v)
        else if (typeof v === 'boolean') set.add('B:' + v)
        else set.add('E:' + v.code)
      }
    return set.size
  },

  // ---------- financial ----------
  PMT: (a, c) => {
    const rate = argNum(a, 0, c)
    const nper = argNum(a, 1, c)
    const pv = argNum(a, 2, c)
    const fv = argNum(a, 3, c, 0)
    const type = argNum(a, 4, c, 0)
    if (rate === 0) return -(pv + fv) / nper
    const pow = Math.pow(1 + rate, nper)
    return (-(pv * pow + fv) * rate) / ((pow - 1) * (1 + rate * type))
  },
  FV: (a, c) => {
    const rate = argNum(a, 0, c)
    const nper = argNum(a, 1, c)
    const pmt = argNum(a, 2, c)
    const pv = argNum(a, 3, c, 0)
    const type = argNum(a, 4, c, 0)
    if (rate === 0) return -(pv + pmt * nper)
    const pow = Math.pow(1 + rate, nper)
    return -(pv * pow + (pmt * (1 + rate * type) * (pow - 1)) / rate)
  },
  PV: (a, c) => {
    const rate = argNum(a, 0, c)
    const nper = argNum(a, 1, c)
    const pmt = argNum(a, 2, c)
    const fv = argNum(a, 3, c, 0)
    const type = argNum(a, 4, c, 0)
    if (rate === 0) return -(fv + pmt * nper)
    const pow = Math.pow(1 + rate, nper)
    return -(fv + (pmt * (1 + rate * type) * (pow - 1)) / rate) / pow
  },
  NPER: (a, c) => {
    const rate = argNum(a, 0, c)
    const pmt = argNum(a, 1, c)
    const pv = argNum(a, 2, c)
    const fv = argNum(a, 3, c, 0)
    const type = argNum(a, 4, c, 0)
    if (rate === 0) {
      if (pmt === 0) return new FErr('#DIV/0!')
      return -(pv + fv) / pmt
    }
    const num_ = pmt * (1 + rate * type) - fv * rate
    const den = pmt * (1 + rate * type) + pv * rate
    if (den === 0 || num_ / den <= 0) return new FErr('#NUM!')
    return Math.log(num_ / den) / Math.log(1 + rate)
  },
  RATE: (a, c) => {
    const nper = argNum(a, 0, c)
    const pmt = argNum(a, 1, c)
    const pv = argNum(a, 2, c)
    const fv = argNum(a, 3, c, 0)
    const type = argNum(a, 4, c, 0)
    let rate = argNum(a, 5, c, 0.1)
    const f = (r: number) => {
      if (r === 0) return pv + pmt * nper + fv
      const pow = Math.pow(1 + r, nper)
      return pv * pow + (pmt * (1 + r * type) * (pow - 1)) / r + fv
    }
    for (let i = 0; i < 50; i++) {
      const fx = f(rate)
      const h = 1e-6
      const dfx = (f(rate + h) - f(rate - h)) / (2 * h)
      if (dfx === 0 || !Number.isFinite(dfx)) return new FErr('#VALUE!')
      const next = rate - fx / dfx
      if (!Number.isFinite(next) || next <= -1) return new FErr('#VALUE!')
      if (Math.abs(next - rate) < 1e-10) return next
      rate = next
    }
    return new FErr('#VALUE!')
  },
  NPV: (a, c) => {
    const rate = argNum(a, 0, c)
    const vals = flattenNumbers(a.slice(1), c)
    let total = 0
    for (let i = 0; i < vals.length; i++) total += vals[i] / Math.pow(1 + rate, i + 1)
    return total
  },
  IRR: (a, c) => {
    const vals = flattenNumbers([a[0]], c)
    if (vals.length < 2) return new FErr('#NUM!')
    if (!vals.some((v) => v > 0) || !vals.some((v) => v < 0)) return new FErr('#NUM!')
    const guess = a[1] !== undefined ? argNum(a, 1, c) : 0.1
    const npvAt = (r: number) => vals.reduce((s, v, i) => s + v / Math.pow(1 + r, i), 0)
    const npvPrimeAt = (r: number) => vals.reduce((s, v, i) => s - (i * v) / Math.pow(1 + r, i + 1), 0)
    let rate = guess
    let converged = false
    for (let i = 0; i < 50; i++) {
      const fx = npvAt(rate)
      const dfx = npvPrimeAt(rate)
      if (dfx === 0 || !Number.isFinite(dfx)) break
      const next = rate - fx / dfx
      if (!Number.isFinite(next) || next <= -1) break
      if (Math.abs(next - rate) < 1e-9) {
        rate = next
        converged = true
        break
      }
      rate = next
    }
    if (converged) return rate
    // Fallback: bisection over a widening bracket.
    let lo = -0.999999
    let hi = 10
    let flo = npvAt(lo)
    let fhi = npvAt(hi)
    if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) {
      let found = false
      for (let h = 10; h <= 1e6; h *= 10) {
        fhi = npvAt(h)
        if (flo * fhi <= 0) {
          hi = h
          found = true
          break
        }
      }
      if (!found) return new FErr('#NUM!')
    }
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2
      const fmid = npvAt(mid)
      if (Math.abs(fmid) < 1e-9) return mid
      if (flo * fmid < 0) hi = mid
      else {
        lo = mid
        flo = fmid
      }
    }
    return (lo + hi) / 2
  },

  // ---------- dates (extended) ----------
  EDATE: (a, c) => addMonths(argNum(a, 0, c), Math.round(argNum(a, 1, c))),
  EOMONTH: (a, c) => {
    const dt = serialToDate(argNum(a, 0, c))
    const y = dt.getUTCFullYear()
    const m = dt.getUTCMonth()
    const months = Math.round(argNum(a, 1, c))
    const total = m + months
    const targetY = y + Math.floor(total / 12)
    const targetM = ((total % 12) + 12) % 12
    const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate()
    return dateToSerial(targetY, targetM + 1, lastDay)
  },
  WORKDAY: (a, c) => {
    const start = Math.floor(argNum(a, 0, c))
    const days = Math.round(argNum(a, 1, c))
    const holidays = new Set<number>()
    if (a[2] !== undefined) {
      for (const v of c.rangeValues(a[2])) {
        const n = toNumber(v)
        if (!isErr(n)) holidays.add(Math.floor(n))
      }
    }
    const step = days >= 0 ? 1 : -1
    let remaining = Math.abs(days)
    let cur = start
    while (remaining > 0) {
      cur += step
      if (isWeekend(serialToDate(cur))) continue
      if (holidays.has(cur)) continue
      remaining--
    }
    return cur
  },
  NETWORKDAYS: (a, c) => {
    const start = Math.floor(argNum(a, 0, c))
    const end = Math.floor(argNum(a, 1, c))
    const holidays = new Set<number>()
    if (a[2] !== undefined) {
      for (const v of c.rangeValues(a[2])) {
        const n = toNumber(v)
        if (!isErr(n)) holidays.add(Math.floor(n))
      }
    }
    const sign = start <= end ? 1 : -1
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    let count = 0
    for (let d = lo; d <= hi; d++) {
      if (isWeekend(serialToDate(d))) continue
      if (holidays.has(d)) continue
      count++
    }
    return sign * count
  },
  DATEDIF: (a, c) => {
    const startSerial = Math.floor(argNum(a, 0, c))
    const endSerial = Math.floor(argNum(a, 1, c))
    const unit = argStr(a, 2, c).toUpperCase()
    if (startSerial > endSerial) return new FErr('#NUM!')
    const sd = serialToDate(startSerial)
    const ed = serialToDate(endSerial)
    const sy = sd.getUTCFullYear(),
      sm = sd.getUTCMonth(),
      sday = sd.getUTCDate()
    const ey = ed.getUTCFullYear(),
      em = ed.getUTCMonth(),
      eday = ed.getUTCDate()
    switch (unit) {
      case 'Y': {
        let years = ey - sy
        if (em < sm || (em === sm && eday < sday)) years--
        return years
      }
      case 'M': {
        let months = (ey - sy) * 12 + (em - sm)
        if (eday < sday) months--
        return months
      }
      case 'D':
        return endSerial - startSerial
      case 'MD': {
        let d = eday - sday
        if (d < 0) {
          const prevMonthLastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate()
          d += prevMonthLastDay
        }
        return d
      }
      case 'YM': {
        let months = em - sm
        if (eday < sday) months--
        if (months < 0) months += 12
        return months
      }
      case 'YD': {
        let annivSerial = Math.round(jsDateToSerial(new Date(Date.UTC(ey, sm, sday))))
        if (annivSerial > endSerial) annivSerial = Math.round(jsDateToSerial(new Date(Date.UTC(ey - 1, sm, sday))))
        return endSerial - annivSerial
      }
      default:
        return new FErr('#NUM!')
    }
  },
  DATEVALUE: (a, c) => {
    const s = argStr(a, 0, c).trim()
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
    if (m) return dateToSerial(Number(m[1]), Number(m[2]), Number(m[3]))
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
    if (m) return dateToSerial(Number(m[3]), Number(m[1]), Number(m[2]))
    return new FErr('#VALUE!')
  },
  WEEKNUM: (a, c) => {
    const serial = Math.floor(argNum(a, 0, c))
    const y = serialToDate(serial).getUTCFullYear()
    const jan1 = dateToSerial(y, 1, 1)
    const jan1Weekday = serialToDate(jan1).getUTCDay()
    return Math.floor((serial - jan1 + jan1Weekday) / 7) + 1
  },

  // ---------- logic / info (extended) ----------
  SWITCH: (a, c) => {
    const expr = arg(a, 0, c)
    let i = 1
    for (; i + 1 < a.length; i += 2) {
      if (valuesEqual(expr, arg(a, i, c))) return arg(a, i + 1, c)
    }
    if (i < a.length) return arg(a, i, c)
    return new FErr('#N/A')
  },
  IFNA: (a, c) => {
    const v = c.evalNode(a[0])
    if (isErr(v) && v.code === '#N/A') return c.evalNode(a[1])
    return v
  },
  ISERROR: (a, c) => isErr(c.evalNode(a[0])),
  ISERR: (a, c) => {
    const v = c.evalNode(a[0])
    return isErr(v) && v.code !== '#N/A'
  },
  ISNA: (a, c) => {
    const v = c.evalNode(a[0])
    return isErr(v) && v.code === '#N/A'
  },
  // ISEVEN/ISODD are engineering functions, not information functions: unlike
  // ISNUMBER/ISTEXT/ISBLANK they do NOT swallow errors into a boolean — a
  // non-numeric or error argument propagates, matching Excel (e.g.
  // ISEVEN("abc") is #VALUE!, ISEVEN(1/0) is #DIV/0!).
  ISEVEN: (a, c) => {
    const v = c.evalNode(a[0])
    if (isErr(v)) return v
    const n = toNumber(v)
    if (isErr(n)) return n
    return Math.floor(Math.abs(n)) % 2 === 0
  },
  ISODD: (a, c) => {
    const v = c.evalNode(a[0])
    if (isErr(v)) return v
    const n = toNumber(v)
    if (isErr(n)) return n
    return Math.floor(Math.abs(n)) % 2 !== 0
  },
  ISLOGICAL: (a, c) => typeof c.evalNode(a[0]) === 'boolean',
  NA: () => new FErr('#N/A'),

  // ---------- text (extended) ----------
  CHAR: (a, c) => {
    const n = Math.round(argNum(a, 0, c))
    if (n < 1 || n > 255) return new FErr('#VALUE!')
    return String.fromCharCode(n)
  },
  CODE: (a, c) => {
    const s = argStr(a, 0, c)
    if (s.length === 0) return new FErr('#VALUE!')
    return s.charCodeAt(0)
  },
  CLEAN: (a, c) => argStr(a, 0, c).replace(/[\x00-\x1F]/g, ''),
  UNICHAR: (a, c) => {
    const n = Math.round(argNum(a, 0, c))
    if (n < 1) return new FErr('#VALUE!')
    return String.fromCodePoint(n)
  },
  UNICODE: (a, c) => {
    const s = argStr(a, 0, c)
    if (s.length === 0) return new FErr('#VALUE!')
    return s.codePointAt(0)!
  },
  FIXED: (a, c) => {
    const n = argNum(a, 0, c)
    const decimals = a[1] !== undefined ? Math.round(argNum(a, 1, c)) : 2
    const noCommas = a[2] !== undefined ? bool(arg(a, 2, c)) : false
    const d = Math.max(decimals, 0)
    const rounded = round(n, decimals)
    const fixedStr = rounded.toFixed(d)
    const parts = fixedStr.split('.')
    if (!noCommas) {
      const neg = parts[0].startsWith('-')
      const digits = neg ? parts[0].slice(1) : parts[0]
      parts[0] = (neg ? '-' : '') + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }
    return parts.length > 1 ? parts.join('.') : parts[0]
  },
  NUMBERVALUE: (a, c) => {
    const s = argStr(a, 0, c).trim()
    const decSep = argStr(a, 1, c, '.')
    const groupSep = argStr(a, 2, c, ',')
    if (s === '') return new FErr('#VALUE!')
    let cleaned = s.split(groupSep).join('')
    cleaned = cleaned.split(decSep).join('.')
    const n = Number(cleaned)
    if (Number.isNaN(n)) return new FErr('#VALUE!')
    return n
  },
}
