// Formula engine: tokenizer -> recursive-descent parser -> AST -> evaluator.
// Pure TypeScript, no DOM. Errors are values (FErr), propagated through
// operators/functions except IFERROR. Cycle detection via an evaluation stack.

// The .ts extensions below are required so this file's dependency graph can
// also be run directly by `node` (see formula.test.ts); @ts-ignore silences
// TS5097, which fires because the project tsconfig doesn't set
// allowImportingTsExtensions.
// @ts-ignore
import type { Sheet, Cell } from '../../../shared/types.ts'
// @ts-ignore
import { parseCellRef, refToString, rangeBounds, shiftRefParts, type RefParts } from './refs.ts'
// @ts-ignore
import { FErr, isErr, toNumber, toDisplayString, compareValues } from './values.ts'
// @ts-ignore
import type { FValue } from './values.ts'
// @ts-ignore
import { FUNCTIONS } from './functions.ts'
// @ts-ignore
import { formatValue } from './format.ts'

// @ts-ignore
export { FErr, isErr } from './values.ts'
// @ts-ignore
export type { FValue } from './values.ts'

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

export type TokenType =
  | 'NUM'
  | 'STR'
  | 'REF'
  | 'IDENT'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'PCT'

export interface Token {
  type: TokenType
  value: string
  start: number
  end: number
}

const OPS2 = ['<=', '>=', '<>']
const OPS1 = ['+', '-', '*', '/', '^', '&', '=', '<', '>']

export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  const n = src.length
  let i = 0
  while (i < n) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }
    if (c === '"') {
      let j = i + 1
      let val = ''
      while (j < n) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            val += '"'
            j += 2
            continue
          }
          break
        }
        val += src[j]
        j++
      }
      tokens.push({ type: 'STR', value: val, start: i, end: j + 1 })
      i = j + 1
      continue
    }
    if (c >= '0' && c <= '9') {
      const m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i))!
      tokens.push({ type: 'NUM', value: m[0], start: i, end: i + m[0].length })
      i += m[0].length
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))![0]
      const end = i + m.length
      let k = end
      while (k < n && /\s/.test(src[k])) k++
      const followedByParen = src[k] === '('
      const looksLikeRef = /^[A-Za-z]{1,3}\d+$/.test(m)
      if (!followedByParen && looksLikeRef) {
        tokens.push({ type: 'REF', value: m, start: i, end })
      } else {
        tokens.push({ type: 'IDENT', value: m, start: i, end })
      }
      i = end
      continue
    }
    if (c === '$') {
      const m = /^\$[A-Za-z]{1,3}\$?\d+/.exec(src.slice(i))
      if (m) {
        tokens.push({ type: 'REF', value: m[0], start: i, end: i + m[0].length })
        i += m[0].length
        continue
      }
      i++
      continue
    }
    if (c === '(') {
      tokens.push({ type: 'LPAREN', value: c, start: i, end: i + 1 })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ type: 'RPAREN', value: c, start: i, end: i + 1 })
      i++
      continue
    }
    if (c === ',') {
      tokens.push({ type: 'COMMA', value: c, start: i, end: i + 1 })
      i++
      continue
    }
    if (c === ':') {
      tokens.push({ type: 'COLON', value: c, start: i, end: i + 1 })
      i++
      continue
    }
    if (c === '%') {
      tokens.push({ type: 'PCT', value: c, start: i, end: i + 1 })
      i++
      continue
    }
    const two = src.slice(i, i + 2)
    if (OPS2.includes(two)) {
      tokens.push({ type: 'OP', value: two, start: i, end: i + 2 })
      i += 2
      continue
    }
    if (OPS1.includes(c)) {
      tokens.push({ type: 'OP', value: c, start: i, end: i + 1 })
      i++
      continue
    }
    // Unknown character — skip it rather than looping forever.
    i++
  }
  return tokens
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type CompareOp = '=' | '<>' | '<' | '>' | '<=' | '>='
export type ArithOp = '+' | '-' | '*' | '/' | '^'

export type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'name'; v: string }
  | { t: 'ref'; ref: string }
  | { t: 'range'; from: string; to: string }
  | { t: 'unary'; a: Node }
  | { t: 'percent'; a: Node }
  | { t: 'binop'; op: ArithOp | '&' | CompareOp; l: Node; r: Node }
  | { t: 'call'; name: string; args: Node[] }

export class ParseError extends Error {}

class Parser {
  tokens: Token[]
  pos = 0
  constructor(tokens: Token[]) {
    this.tokens = tokens
  }
  peek(): Token | undefined {
    return this.tokens[this.pos]
  }
  next(): Token | undefined {
    return this.tokens[this.pos++]
  }
  isOp(v: string): boolean {
    const t = this.peek()
    return !!t && t.type === 'OP' && t.value === v
  }
  expect(type: TokenType): Token {
    const t = this.next()
    if (!t || t.type !== type) throw new ParseError(`Expected ${type}`)
    return t
  }

  parseExpr(): Node {
    return this.parseComparison()
  }

  parseComparison(): Node {
    let left = this.parseConcat()
    while (true) {
      const t = this.peek()
      if (t && t.type === 'OP' && ['=', '<>', '<', '>', '<=', '>='].includes(t.value)) {
        this.next()
        const right = this.parseConcat()
        left = { t: 'binop', op: t.value as CompareOp, l: left, r: right }
      } else break
    }
    return left
  }

  parseConcat(): Node {
    let left = this.parseAdditive()
    while (this.isOp('&')) {
      this.next()
      const right = this.parseAdditive()
      left = { t: 'binop', op: '&', l: left, r: right }
    }
    return left
  }

  parseAdditive(): Node {
    let left = this.parseMultiplicative()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next()!.value as ArithOp
      const right = this.parseMultiplicative()
      left = { t: 'binop', op, l: left, r: right }
    }
    return left
  }

  parseMultiplicative(): Node {
    let left = this.parsePower()
    while (this.isOp('*') || this.isOp('/')) {
      const op = this.next()!.value as ArithOp
      const right = this.parsePower()
      left = { t: 'binop', op, l: left, r: right }
    }
    return left
  }

  parsePower(): Node {
    let left = this.parseUnary()
    while (this.isOp('^')) {
      this.next()
      const right = this.parseUnary()
      left = { t: 'binop', op: '^', l: left, r: right }
    }
    return left
  }

  parseUnary(): Node {
    if (this.isOp('-')) {
      this.next()
      return { t: 'unary', a: this.parseUnary() }
    }
    if (this.isOp('+')) {
      this.next()
      return this.parseUnary()
    }
    return this.parsePostfix()
  }

  parsePostfix(): Node {
    let node = this.parsePrimary()
    while (this.peek()?.type === 'PCT') {
      this.next()
      node = { t: 'percent', a: node }
    }
    return node
  }

  parsePrimary(): Node {
    const t = this.peek()
    if (!t) throw new ParseError('Unexpected end of formula')
    if (t.type === 'NUM') {
      this.next()
      return { t: 'num', v: parseFloat(t.value) }
    }
    if (t.type === 'STR') {
      this.next()
      return { t: 'str', v: t.value }
    }
    if (t.type === 'LPAREN') {
      this.next()
      const e = this.parseExpr()
      this.expect('RPAREN')
      return e
    }
    if (t.type === 'REF') {
      this.next()
      if (this.peek()?.type === 'COLON') {
        this.next()
        const t2 = this.expect('REF')
        return { t: 'range', from: t.value, to: t2.value }
      }
      return { t: 'ref', ref: t.value }
    }
    if (t.type === 'IDENT') {
      this.next()
      const upper = t.value.toUpperCase()
      if (upper === 'TRUE') return { t: 'bool', v: true }
      if (upper === 'FALSE') return { t: 'bool', v: false }
      if (this.peek()?.type === 'LPAREN') {
        this.next()
        const args: Node[] = []
        if (this.peek()?.type !== 'RPAREN') {
          args.push(this.parseExpr())
          while (this.peek()?.type === 'COMMA') {
            this.next()
            args.push(this.parseExpr())
          }
        }
        this.expect('RPAREN')
        return { t: 'call', name: upper, args }
      }
      return { t: 'name', v: t.value }
    }
    throw new ParseError('Unexpected token: ' + t.type)
  }
}

export function parseFormula(body: string): Node {
  const tokens = tokenize(body)
  const p = new Parser(tokens)
  const node = p.parseExpr()
  if (p.pos < tokens.length) throw new ParseError('Trailing tokens')
  return node
}

// ---------------------------------------------------------------------------
// Evaluation context
// ---------------------------------------------------------------------------

export interface EvalCtx {
  now: Date
  getRef(ref: string): FValue
  evalNode(node: Node): FValue
  /** Flat, row-major list of values for a range/ref node; falls back to [evalNode(node)]. */
  rangeValues(node: Node): FValue[]
  /** Flat, row-major list of canonical ref strings for a range/ref node. */
  rangeRefs(node: Node): string[]
  /** 2D grid (rows x cols) for a range/ref node; falls back to [[evalNode(node)]]. */
  rangeGrid(node: Node): FValue[][]
  /** Canonical "A1" key of the cell currently being evaluated — used by ROW()/COLUMN() with no args. */
  currentRef?: string
}

function evalCompare(op: CompareOp, l: FValue, r: FValue): boolean {
  const cmp = compareValues(l, r)
  switch (op) {
    case '=':
      return cmp === 0
    case '<>':
      return cmp !== 0
    case '<':
      return cmp < 0
    case '>':
      return cmp > 0
    case '<=':
      return cmp <= 0
    case '>=':
      return cmp >= 0
  }
}

export function evalNode(node: Node, ctx: EvalCtx): FValue {
  switch (node.t) {
    case 'num':
      return node.v
    case 'str':
      return node.v
    case 'bool':
      return node.v
    case 'name':
      return new FErr('#NAME?')
    case 'ref':
      return ctx.getRef(node.ref)
    case 'range':
      return new FErr('#VALUE!')
    case 'unary': {
      const v = evalNode(node.a, ctx)
      if (isErr(v)) return v
      const n = toNumber(v)
      if (isErr(n)) return n
      return -n
    }
    case 'percent': {
      const v = evalNode(node.a, ctx)
      if (isErr(v)) return v
      const n = toNumber(v)
      if (isErr(n)) return n
      return n / 100
    }
    case 'binop': {
      const l = evalNode(node.l, ctx)
      if (isErr(l)) return l
      const r = evalNode(node.r, ctx)
      if (isErr(r)) return r
      if (node.op === '&') return toDisplayString(l) + toDisplayString(r)
      if (node.op === '+' || node.op === '-' || node.op === '*' || node.op === '/' || node.op === '^') {
        const ln = toNumber(l)
        if (isErr(ln)) return ln
        const rn = toNumber(r)
        if (isErr(rn)) return rn
        switch (node.op) {
          case '+':
            return ln + rn
          case '-':
            return ln - rn
          case '*':
            return ln * rn
          case '/':
            if (rn === 0) return new FErr('#DIV/0!')
            return ln / rn
          case '^':
            return Math.pow(ln, rn)
        }
      }
      return evalCompare(node.op as CompareOp, l, r)
    }
    case 'call': {
      const fn = FUNCTIONS[node.name]
      if (!fn) return new FErr('#NAME?')
      try {
        return fn(node.args, ctx)
      } catch (e) {
        if (e instanceof FErr) return e
        return new FErr('#VALUE!')
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Sheet-level recompute
// ---------------------------------------------------------------------------

export interface ComputedCell {
  value: FValue
  display: string
}

function literalFromRaw(raw: string): FValue {
  const s = raw.trim()
  if (s === '') return ''
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s)
  if (/^TRUE$/i.test(s)) return true
  if (/^FALSE$/i.test(s)) return false
  return raw
}

/** Recomputes every populated cell in a sheet. Cycle-safe, memoized per pass. */
export function computeSheet(sheet: Sheet): Map<string, ComputedCell> {
  const memo = new Map<string, ComputedCell>()
  const evaluating = new Set<string>()
  const now = new Date()

  const ctx: EvalCtx = {
    now,
    getRef,
    evalNode: (n) => evalNode(n, ctx),
    rangeValues,
    rangeRefs,
    rangeGrid,
  }

  function rawCellOf(key: string): Cell | undefined {
    return sheet.cells[key]
  }

  function getRef(rawRef: string): FValue {
    const parts = parseCellRef(rawRef)
    if (!parts) return new FErr('#REF!')
    const key = refToString(parts.col, parts.row)
    const cached = memo.get(key)
    if (cached) return cached.value
    if (evaluating.has(key)) return new FErr('#CYCLE!')
    evaluating.add(key)
    const cell = rawCellOf(key)
    const raw = cell?.v
    let value: FValue
    if (raw === undefined || raw === '') {
      value = ''
    } else if (raw.startsWith('=')) {
      const prevRef = ctx.currentRef
      ctx.currentRef = key
      try {
        const ast = parseFormula(raw.slice(1))
        value = evalNode(ast, ctx)
      } catch {
        value = new FErr('#VALUE!')
      } finally {
        ctx.currentRef = prevRef
      }
    } else {
      value = literalFromRaw(raw)
    }
    evaluating.delete(key)
    const entry: ComputedCell = { value, display: formatValue(value, cell?.style) }
    memo.set(key, entry)
    return value
  }

  function rangeBoundsFor(node: Node): { col1: number; col2: number; row1: number; row2: number } | null {
    if (node.t === 'range') {
      const a = parseCellRef(node.from)
      const b = parseCellRef(node.to)
      if (!a || !b) return null
      return rangeBounds(a, b)
    }
    if (node.t === 'ref') {
      const a = parseCellRef(node.ref)
      if (!a) return null
      return rangeBounds(a, a)
    }
    return null
  }

  function rangeValues(node: Node): FValue[] {
    const b = rangeBoundsFor(node)
    if (!b) return [evalNode(node, ctx)]
    const out: FValue[] = []
    for (let r = b.row1; r <= b.row2; r++) {
      for (let c = b.col1; c <= b.col2; c++) out.push(getRef(refToString(c, r)))
    }
    return out
  }

  function rangeRefs(node: Node): string[] {
    const b = rangeBoundsFor(node)
    if (!b) return []
    const out: string[] = []
    for (let r = b.row1; r <= b.row2; r++) {
      for (let c = b.col1; c <= b.col2; c++) out.push(refToString(c, r))
    }
    return out
  }

  function rangeGrid(node: Node): FValue[][] {
    const b = rangeBoundsFor(node)
    if (!b) return [[evalNode(node, ctx)]]
    const grid: FValue[][] = []
    for (let r = b.row1; r <= b.row2; r++) {
      const row: FValue[] = []
      for (let c = b.col1; c <= b.col2; c++) row.push(getRef(refToString(c, r)))
      grid.push(row)
    }
    return grid
  }

  for (const key of Object.keys(sheet.cells)) {
    const cell = sheet.cells[key]
    if (!cell) continue
    if (cell.v !== undefined && cell.v !== '') {
      getRef(key)
    } else {
      const norm = parseCellRef(key)
      const nk = norm ? refToString(norm.col, norm.row) : key
      memo.set(nk, { value: '', display: '' })
    }
  }

  return memo
}

// ---------------------------------------------------------------------------
// Ref shifting — used by fill-handle / copy-paste to adjust relative refs.
// ---------------------------------------------------------------------------

/** Rewrites every non-absolute ref in a formula by (dCol, dRow), preserving everything else. */
export function shiftFormula(raw: string, dCol: number, dRow: number): string {
  if (!raw.startsWith('=')) return raw
  const body = raw.slice(1)
  const tokens = tokenize(body)
  let out = ''
  let last = 0
  for (const tok of tokens) {
    if (tok.type === 'REF') {
      const parts = parseCellRef(tok.value)
      if (parts) {
        const shifted = shiftRefParts(parts, dCol, dRow)
        out += body.slice(last, tok.start) + refToString(shifted.col, shifted.row, shifted.colAbs, shifted.rowAbs)
        last = tok.end
      }
    }
  }
  out += body.slice(last)
  return '=' + out
}

export function isFormula(raw: string | undefined): raw is string {
  return typeof raw === 'string' && raw.startsWith('=')
}

export type { RefParts }
