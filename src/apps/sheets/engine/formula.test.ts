// Formula engine test suite. Run with:
//   node src/apps/sheets/engine/formula.test.ts
// Node 25 strips TypeScript types natively — relative imports use explicit .ts
// extensions, as required by that mode.

// @ts-ignore (TS5097: extension needed so plain `node` can resolve this graph)
import { computeSheet, shiftFormula, FErr } from './formula.ts'
// @ts-ignore
import type { FValue } from './values.ts'
// @ts-ignore
import type { Sheet, Cell } from '../../../shared/types.ts'

let pass = 0
let fail = 0

function ok(name: string, cond: boolean) {
  if (cond) {
    pass++
  } else {
    fail++
    console.error(`FAIL: ${name}`)
  }
}

function approxEq(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps
}

function eq(name: string, actual: FValue, expected: FValue) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    ok(name, approxEq(actual, expected))
    if (!approxEq(actual, expected)) console.error(`  expected ${expected}, got ${actual}`)
    return
  }
  const same = actual === expected || (actual instanceof FErr && expected instanceof FErr && actual.code === expected.code)
  ok(name, same)
  if (!same) console.error(`  expected ${String(expected)}, got ${String(actual)}`)
}

function isErrCode(name: string, actual: FValue, code: string) {
  const good = actual instanceof FErr && actual.code === code
  ok(name, good)
  if (!good) console.error(`  expected error ${code}, got ${JSON.stringify(actual)}`)
}

/** Builds a Sheet from a plain object of A1 -> raw string (or Cell for styled cells). */
function sheetFrom(cells: Record<string, string | Cell>): Sheet {
  const out: Record<string, Cell> = {}
  for (const [k, v] of Object.entries(cells)) {
    out[k] = typeof v === 'string' ? { v } : v
  }
  return { name: 'Sheet1', cells: out, colWidths: {}, rowHeights: {} }
}

function val(sheet: Sheet, ref: string): FValue {
  return computeSheet(sheet).get(ref)?.value ?? new FErr('#REF!')
}

function disp(sheet: Sheet, ref: string): string {
  return computeSheet(sheet).get(ref)?.display ?? ''
}

// ---------------------------------------------------------------------------
// Precedence & operators
// ---------------------------------------------------------------------------
eq('add/mul precedence', val(sheetFrom({ A1: '=1+2*3' }), 'A1'), 7)
eq('parens override precedence', val(sheetFrom({ A1: '=(1+2)*3' }), 'A1'), 9)
eq('exponent left-assoc', val(sheetFrom({ A1: '=2^3^2' }), 'A1'), 64)
eq('unary minus binds tighter than ^', val(sheetFrom({ A1: '=-2^2' }), 'A1'), 4)
eq('negative exponent', val(sheetFrom({ A1: '=2^-2' }), 'A1'), 0.25)
eq('chained subtraction left-assoc', val(sheetFrom({ A1: '=10-2-3' }), 'A1'), 5)
eq('chained division left-assoc', val(sheetFrom({ A1: '=100/2/5' }), 'A1'), 10)
eq('percent literal', val(sheetFrom({ A1: '=50%' }), 'A1'), 0.5)
eq('percent then add', val(sheetFrom({ A1: '=50%+1' }), 'A1'), 1.5)
eq('string concat', val(sheetFrom({ A1: '="a"&"b"' }), 'A1'), 'ab')
eq('concat number', val(sheetFrom({ A1: '="x="&5' }), 'A1'), 'x=5')
eq('modulo via MOD fn not op', val(sheetFrom({ A1: '=MOD(7,3)' }), 'A1'), 1)
eq('double negative', val(sheetFrom({ A1: '=--5' }), 'A1'), 5)
eq('mixed mul before add', val(sheetFrom({ A1: '=2+3*4-1' }), 'A1'), 13)

// ---------------------------------------------------------------------------
// Comparisons
// ---------------------------------------------------------------------------
eq('equals true', val(sheetFrom({ A1: '=1=1' }), 'A1'), true)
eq('not-equal true', val(sheetFrom({ A1: '=1<>2' }), 'A1'), true)
eq('less than', val(sheetFrom({ A1: '=1<2' }), 'A1'), true)
eq('greater-equal false', val(sheetFrom({ A1: '=1>=2' }), 'A1'), false)
eq('string equality case-insensitive', val(sheetFrom({ A1: '="a"="A"' }), 'A1'), true)
eq('number vs text not equal', val(sheetFrom({ A1: '=1="1"' }), 'A1'), false)

// ---------------------------------------------------------------------------
// Cell refs, ranges, absolute refs
// ---------------------------------------------------------------------------
{
  const s = sheetFrom({ A1: '5', B1: '10', C1: '=A1+B1' })
  eq('simple ref sum', val(s, 'C1'), 15)
}
{
  const s = sheetFrom({ A1: '1', A2: '2', A3: '3', B1: '=SUM(A1:A3)' })
  eq('range sum', val(s, 'B1'), 6)
}
{
  const s = sheetFrom({ A1: '1', B1: '2', A2: '3', B2: '4', C1: '=SUM(A1:B2)' })
  eq('2D range sum', val(s, 'C1'), 10)
}
eq('shift relative ref', shiftFormula('=A1+B2', 1, 1), '=B2+C3')
eq('absolute ref unaffected by shift', shiftFormula('=$A$1+B2', 1, 1), '=$A$1+C3')
eq('mixed abs col shift', shiftFormula('=$A1+B2', 2, 3), '=$A4+D5')
eq('range shift', shiftFormula('=SUM(A1:A3)', 0, 2), '=SUM(A3:A5)')
eq('shift clamps at zero', shiftFormula('=A1', -5, -5), '=A1')

// ---------------------------------------------------------------------------
// Errors & propagation
// ---------------------------------------------------------------------------
isErrCode('div by zero', val(sheetFrom({ A1: '=1/0' }), 'A1'), '#DIV/0!')
isErrCode('unknown function', val(sheetFrom({ A1: '=FOOBAR(1)' }), 'A1'), '#NAME?')
isErrCode('bad ref', val(sheetFrom({ A1: '=ZZZZ1' }), 'A1'), '#NAME?')
isErrCode('malformed formula', val(sheetFrom({ A1: '=1+' }), 'A1'), '#VALUE!')
isErrCode('error propagates through add', val(sheetFrom({ A1: '=1/0', B1: '=A1+1' }), 'B1'), '#DIV/0!')
isErrCode('error propagates through concat', val(sheetFrom({ A1: '=1/0', B1: '=A1&"x"' }), 'B1'), '#DIV/0!')
{
  const s = sheetFrom({ A1: '=B1', B1: '=A1' })
  isErrCode('direct cycle A1', val(s, 'A1'), '#CYCLE!')
  isErrCode('direct cycle B1', val(s, 'B1'), '#CYCLE!')
}
{
  const s = sheetFrom({ A1: '=B1', B1: '=C1', C1: '=A1' })
  isErrCode('three-way cycle', val(s, 'A1'), '#CYCLE!')
}
eq('IFERROR catches div0', val(sheetFrom({ A1: '=IFERROR(1/0,"n/a")' }), 'A1'), 'n/a')
eq('IFERROR passthrough ok value', val(sheetFrom({ A1: '=IFERROR(5,"n/a")' }), 'A1'), 5)

// ---------------------------------------------------------------------------
// Logic functions
// ---------------------------------------------------------------------------
eq('IF true branch', val(sheetFrom({ A1: '=IF(1<2,"yes","no")' }), 'A1'), 'yes')
eq('IF false branch', val(sheetFrom({ A1: '=IF(1>2,"yes","no")' }), 'A1'), 'no')
eq('IFS second condition', val(sheetFrom({ A1: '=IFS(1>2,"a",2>1,"b")' }), 'A1'), 'b')
eq('AND all true', val(sheetFrom({ A1: '=AND(TRUE,1=1,2>1)' }), 'A1'), true)
eq('AND one false', val(sheetFrom({ A1: '=AND(TRUE,1=2)' }), 'A1'), false)
eq('OR one true', val(sheetFrom({ A1: '=OR(1=2,2=2)' }), 'A1'), true)
eq('OR all false', val(sheetFrom({ A1: '=OR(1=2,3=4)' }), 'A1'), false)
eq('NOT', val(sheetFrom({ A1: '=NOT(FALSE)' }), 'A1'), true)
eq('XOR odd true count', val(sheetFrom({ A1: '=XOR(TRUE,FALSE,FALSE)' }), 'A1'), true)
eq('XOR even true count', val(sheetFrom({ A1: '=XOR(TRUE,TRUE)' }), 'A1'), false)
eq('ISBLANK true on empty', val(sheetFrom({ A1: '=ISBLANK(B1)' }), 'A1'), true)
eq('ISBLANK false on value', val(sheetFrom({ A1: '5', B1: '=ISBLANK(A1)' }), 'B1'), false)
eq('ISNUMBER true', val(sheetFrom({ A1: '5', B1: '=ISNUMBER(A1)' }), 'B1'), true)
eq('ISNUMBER false on text', val(sheetFrom({ A1: 'hi', B1: '=ISNUMBER(A1)' }), 'B1'), false)
eq('ISTEXT true', val(sheetFrom({ A1: 'hi', B1: '=ISTEXT(A1)' }), 'B1'), true)

// ---------------------------------------------------------------------------
// Text functions
// ---------------------------------------------------------------------------
eq('LEFT', val(sheetFrom({ A1: '=LEFT("hello",3)' }), 'A1'), 'hel')
eq('RIGHT', val(sheetFrom({ A1: '=RIGHT("hello",3)' }), 'A1'), 'llo')
eq('MID', val(sheetFrom({ A1: '=MID("hello",2,3)' }), 'A1'), 'ell')
eq('LEN', val(sheetFrom({ A1: '=LEN("hello")' }), 'A1'), 5)
eq('LOWER', val(sheetFrom({ A1: '=LOWER("HeLLo")' }), 'A1'), 'hello')
eq('UPPER', val(sheetFrom({ A1: '=UPPER("HeLLo")' }), 'A1'), 'HELLO')
eq('PROPER', val(sheetFrom({ A1: '=PROPER("hello world")' }), 'A1'), 'Hello World')
eq('TRIM', val(sheetFrom({ A1: '=TRIM("  a   b  ")' }), 'A1'), 'a b')
eq('SUBSTITUTE all', val(sheetFrom({ A1: '=SUBSTITUTE("a-b-c","-","/")' }), 'A1'), 'a/b/c')
eq('SUBSTITUTE nth', val(sheetFrom({ A1: '=SUBSTITUTE("a-b-c","-","/",2)' }), 'A1'), 'a-b/c')
eq('REPT', val(sheetFrom({ A1: '=REPT("ab",3)' }), 'A1'), 'ababab')
eq('FIND found', val(sheetFrom({ A1: '=FIND("l","hello")' }), 'A1'), 3)
isErrCode('FIND not found', val(sheetFrom({ A1: '=FIND("z","hello")' }), 'A1'), '#VALUE!')
eq('SEARCH case-insensitive', val(sheetFrom({ A1: '=SEARCH("L","hello")' }), 'A1'), 3)
eq('EXACT true', val(sheetFrom({ A1: '=EXACT("Abc","Abc")' }), 'A1'), true)
eq('EXACT false case', val(sheetFrom({ A1: '=EXACT("Abc","abc")' }), 'A1'), false)
eq('VALUE parses number', val(sheetFrom({ A1: '=VALUE("42.5")' }), 'A1'), 42.5)
eq('CONCAT with range', val(sheetFrom({ A1: 'a', A2: 'b', A3: 'c', B1: '=CONCAT(A1:A3)' }), 'B1'), 'abc')
eq('CONCATENATE scalars', val(sheetFrom({ A1: '=CONCATENATE("x","-","y")' }), 'A1'), 'x-y')
eq(
  'TEXTJOIN ignore empty',
  val(sheetFrom({ A1: 'a', A2: '', A3: 'c', B1: '=TEXTJOIN(",",TRUE,A1:A3)' }), 'B1'),
  'a,c',
)

// ---------------------------------------------------------------------------
// Math functions
// ---------------------------------------------------------------------------
eq('ROUND', val(sheetFrom({ A1: '=ROUND(3.14159,2)' }), 'A1'), 3.14)
eq('ROUND negative', val(sheetFrom({ A1: '=ROUND(-3.14159,2)' }), 'A1'), -3.14)
eq('ROUNDUP', val(sheetFrom({ A1: '=ROUNDUP(3.141,2)' }), 'A1'), 3.15)
eq('ROUNDDOWN', val(sheetFrom({ A1: '=ROUNDDOWN(3.149,2)' }), 'A1'), 3.14)
eq('INT floors', val(sheetFrom({ A1: '=INT(3.9)' }), 'A1'), 3)
eq('INT floors negative', val(sheetFrom({ A1: '=INT(-3.1)' }), 'A1'), -4)
eq('ABS', val(sheetFrom({ A1: '=ABS(-7)' }), 'A1'), 7)
eq('SQRT', val(sheetFrom({ A1: '=SQRT(16)' }), 'A1'), 4)
isErrCode('SQRT negative errors', val(sheetFrom({ A1: '=SQRT(-1)' }), 'A1'), '#VALUE!')
eq('POWER', val(sheetFrom({ A1: '=POWER(2,10)' }), 'A1'), 1024)
eq('MOD positive', val(sheetFrom({ A1: '=MOD(7,3)' }), 'A1'), 1)
isErrCode('MOD by zero', val(sheetFrom({ A1: '=MOD(5,0)' }), 'A1'), '#DIV/0!')
eq('PRODUCT', val(sheetFrom({ A1: '2', A2: '3', A3: '4', B1: '=PRODUCT(A1:A3)' }), 'B1'), 24)
eq('FLOOR', val(sheetFrom({ A1: '=FLOOR(7.8,1)' }), 'A1'), 7)
eq('CEILING', val(sheetFrom({ A1: '=CEILING(7.2,1)' }), 'A1'), 8)
eq('EXP', val(sheetFrom({ A1: '=EXP(0)' }), 'A1'), 1)
eq('LN', val(sheetFrom({ A1: '=LN(1)' }), 'A1'), 0)
eq('LOG base 2', val(sheetFrom({ A1: '=LOG(8,2)' }), 'A1'), 3)
eq('LOG10', val(sheetFrom({ A1: '=LOG10(100)' }), 'A1'), 2)
eq('PI', val(sheetFrom({ A1: '=PI()' }), 'A1'), Math.PI)
eq('SIGN positive', val(sheetFrom({ A1: '=SIGN(5)' }), 'A1'), 1)
eq('SIGN negative', val(sheetFrom({ A1: '=SIGN(-5)' }), 'A1'), -1)
eq('TRUNC', val(sheetFrom({ A1: '=TRUNC(8.9)' }), 'A1'), 8)
{
  const r = val(sheetFrom({ A1: '=RANDBETWEEN(5,5)' }), 'A1')
  eq('RANDBETWEEN fixed range', r, 5)
}
{
  const r = val(sheetFrom({ A1: '=RAND()' }), 'A1')
  ok('RAND in [0,1)', typeof r === 'number' && r >= 0 && r < 1)
}

// ---------------------------------------------------------------------------
// Stats & criteria functions
// ---------------------------------------------------------------------------
eq('MEDIAN odd count', val(sheetFrom({ A1: '1', A2: '2', A3: '3', A4: '4', A5: '5', B1: '=MEDIAN(A1:A5)' }), 'B1'), 3)
eq('MEDIAN even count', val(sheetFrom({ A1: '1', A2: '2', A3: '3', A4: '4', B1: '=MEDIAN(A1:A4)' }), 'B1'), 2.5)
eq('MODE', val(sheetFrom({ A1: '1', A2: '2', A3: '2', A4: '3', B1: '=MODE(A1:A4)' }), 'B1'), 2)
eq(
  'STDEV',
  val(sheetFrom({ A1: '2', A2: '4', A3: '4', A4: '4', A5: '5', A6: '5', A7: '7', A8: '9', B1: '=STDEV(A1:A8)' }), 'B1'),
  Math.sqrt(32 / 7),
)
eq(
  'VAR',
  val(sheetFrom({ A1: '2', A2: '4', A3: '4', A4: '4', A5: '5', A6: '5', A7: '7', A8: '9', B1: '=VAR(A1:A8)' }), 'B1'),
  32 / 7,
)
eq('LARGE 2nd', val(sheetFrom({ A1: '5', A2: '9', A3: '1', A4: '7', B1: '=LARGE(A1:A4,2)' }), 'B1'), 7)
eq('SMALL 2nd', val(sheetFrom({ A1: '5', A2: '9', A3: '1', A4: '7', B1: '=SMALL(A1:A4,2)' }), 'B1'), 5)
eq(
  'COUNTIF numeric >',
  val(sheetFrom({ A1: '1', A2: '5', A3: '10', B1: '=COUNTIF(A1:A3,">3")' }), 'B1'),
  2,
)
eq(
  'COUNTIF wildcard',
  val(sheetFrom({ A1: 'apple', A2: 'banana', A3: 'apricot', B1: '=COUNTIF(A1:A3,"ap*")' }), 'B1'),
  2,
)
eq(
  'SUMIF',
  val(
    sheetFrom({ A1: 'x', A2: 'y', A3: 'x', B1: '10', B2: '20', B3: '30', C1: '=SUMIF(A1:A3,"x",B1:B3)' }),
    'C1',
  ),
  40,
)
eq(
  'AVERAGEIF',
  val(
    sheetFrom({ A1: '1', A2: '2', A3: '3', A4: '4', B1: '=AVERAGEIF(A1:A4,">2")' }),
    'B1',
  ),
  3.5,
)

// ---------------------------------------------------------------------------
// Lookup functions
// ---------------------------------------------------------------------------
{
  const s = sheetFrom({
    A1: '1',
    B1: 'one',
    A2: '2',
    B2: 'two',
    A3: '3',
    B3: 'three',
    C1: '=VLOOKUP(2,A1:B3,2,FALSE)',
    C2: '=VLOOKUP(2,A1:B3,2)',
    C3: '=VLOOKUP(5,A1:B3,2,FALSE)',
  })
  eq('VLOOKUP exact', val(s, 'C1'), 'two')
  eq('VLOOKUP approx', val(s, 'C2'), 'two')
  isErrCode('VLOOKUP not found exact', val(s, 'C3'), '#VALUE!')
}
{
  const s = sheetFrom({
    A1: '1',
    B1: '2',
    C1: '3',
    A2: 'one',
    B2: 'two',
    C2: 'three',
    D1: '=HLOOKUP(2,A1:C2,2,FALSE)',
  })
  eq('HLOOKUP exact', val(s, 'D1'), 'two')
}
{
  const s = sheetFrom({ A1: '10', A2: '20', A3: '30', B1: '=INDEX(A1:A3,2)' })
  eq('INDEX 1D vector', val(s, 'B1'), 20)
}
{
  const s = sheetFrom({ A1: '1', B1: '2', A2: '3', B2: '4', C1: '=INDEX(A1:B2,2,2)' })
  eq('INDEX 2D grid', val(s, 'C1'), 4)
}
{
  const s = sheetFrom({ A1: '10', A2: '20', A3: '30', B1: '=MATCH(20,A1:A3,0)' })
  eq('MATCH exact', val(s, 'B1'), 2)
}
{
  const s = sheetFrom({ A1: '1', A2: '5', A3: '10', B1: '=MATCH(7,A1:A3,1)' })
  eq('MATCH approximate', val(s, 'B1'), 2)
}
eq('CHOOSE', val(sheetFrom({ A1: '=CHOOSE(2,"a","b","c")' }), 'A1'), 'b')

// ---------------------------------------------------------------------------
// Date/time functions
// ---------------------------------------------------------------------------
eq('DATE roundtrip YEAR', val(sheetFrom({ A1: '=YEAR(DATE(2024,3,15))' }), 'A1'), 2024)
eq('DATE roundtrip MONTH', val(sheetFrom({ A1: '=MONTH(DATE(2024,3,15))' }), 'A1'), 3)
eq('DATE roundtrip DAY', val(sheetFrom({ A1: '=DAY(DATE(2024,3,15))' }), 'A1'), 15)
eq('DAYS difference', val(sheetFrom({ A1: '=DAYS(DATE(2024,1,10),DATE(2024,1,1))' }), 'A1'), 9)
eq('WEEKDAY default type', val(sheetFrom({ A1: '=WEEKDAY(DATE(2024,1,7))' }), 'A1'), 1) // 2024-01-07 is a Sunday
{
  const r = val(sheetFrom({ A1: '=TODAY()' }), 'A1')
  ok('TODAY returns integer serial', typeof r === 'number' && Number.isInteger(r) && r > 40000)
}
{
  const r = val(sheetFrom({ A1: '=NOW()' }), 'A1')
  ok('NOW returns serial number', typeof r === 'number' && r > 40000)
}

// ---------------------------------------------------------------------------
// Number formatting / display
// ---------------------------------------------------------------------------
eq('currency display', disp(sheetFrom({ A1: { v: '1234.5', style: { format: 'currency', decimals: 2 } } }), 'A1'), '$1,234.50')
eq('percent display', disp(sheetFrom({ A1: { v: '0.5', style: { format: 'percent', decimals: 0 } } }), 'A1'), '50%')

// ---------------------------------------------------------------------------
// Blank cell coercion
// ---------------------------------------------------------------------------
eq('blank cell in arithmetic is 0', val(sheetFrom({ B1: '=A1+5' }), 'B1'), 5)
eq('blank cell concat is empty', val(sheetFrom({ B1: '=A1&"x"' }), 'B1'), 'x')

// ---------------------------------------------------------------------------
// Multi-criteria: SUMIFS / COUNTIFS / AVERAGEIFS / MAXIFS / MINIFS
// ---------------------------------------------------------------------------
{
  const s = sheetFrom({
    A1: 'apple', B1: 'red', C1: '10',
    A2: 'apple', B2: 'green', C2: '20',
    A3: 'banana', B3: 'red', C3: '30',
    A4: 'apricot', B4: 'red', C4: '40',
    D1: '=SUMIFS(C1:C4,A1:A4,"ap*",B1:B4,"red")',
    D2: '=COUNTIFS(A1:A4,"ap*",B1:B4,"red")',
    D3: '=AVERAGEIFS(C1:C4,A1:A4,"ap*",B1:B4,"red")',
    D4: '=MAXIFS(C1:C4,A1:A4,"ap*")',
    D5: '=MINIFS(C1:C4,A1:A4,"ap*")',
    D6: '=SUMIFS(C1:C4,B1:B4,"blue")',
    D7: '=MAXIFS(C1:C4,B1:B4,"blue")',
  })
  eq('SUMIFS wildcard + equality', val(s, 'D1'), 50)
  eq('COUNTIFS wildcard + equality', val(s, 'D2'), 2)
  eq('AVERAGEIFS multi-criteria', val(s, 'D3'), 25)
  eq('MAXIFS wildcard', val(s, 'D4'), 40)
  eq('MINIFS wildcard', val(s, 'D5'), 10)
  eq('SUMIFS no match is 0', val(s, 'D6'), 0)
  eq('MAXIFS no match is 0', val(s, 'D7'), 0)
}
{
  const s = sheetFrom({
    A1: '1', A2: '5', A3: '10', A4: '15',
    B1: '=SUMIFS(A1:A4,A1:A4,">3",A1:A4,"<=10")',
    B2: '=COUNTIFS(A1:A4,">=5")',
  })
  eq('SUMIFS comparator range', val(s, 'B1'), 15)
  eq('COUNTIFS comparator', val(s, 'B2'), 3)
}

// ---------------------------------------------------------------------------
// XLOOKUP
// ---------------------------------------------------------------------------
{
  const s = sheetFrom({
    A1: '1', B1: 'one',
    A2: '2', B2: 'two',
    A3: '3', B3: 'three',
    C1: '=XLOOKUP(2,A1:A3,B1:B3)',
    C2: '=XLOOKUP(9,A1:A3,B1:B3,"missing")',
    C3: '=XLOOKUP(9,A1:A3,B1:B3)',
  })
  eq('XLOOKUP exact match', val(s, 'C1'), 'two')
  eq('XLOOKUP not found uses fallback', val(s, 'C2'), 'missing')
  isErrCode('XLOOKUP not found no fallback is #N/A', val(s, 'C3'), '#N/A')
}
{
  const s = sheetFrom({
    A1: '1', A2: '5', A3: '10', A4: '20',
    B1: 'a', B2: 'b', B3: 'c', B4: 'd',
    C1: '=XLOOKUP(7,A1:A4,B1:B4,"x",-1)',
    C2: '=XLOOKUP(7,A1:A4,B1:B4,"x",1)',
    C3: '=XLOOKUP(5,A1:A4,B1:B4,"x",-1)',
  })
  eq('XLOOKUP match_mode -1 next smaller', val(s, 'C1'), 'b')
  eq('XLOOKUP match_mode 1 next larger', val(s, 'C2'), 'c')
  eq('XLOOKUP match_mode -1 exact still exact', val(s, 'C3'), 'b')
}

// ---------------------------------------------------------------------------
// ROW / COLUMN / ROWS / COLUMNS
// ---------------------------------------------------------------------------
{
  const s = sheetFrom({ C5: '=ROW()', D5: '=COLUMN()' })
  eq('ROW() current cell', val(s, 'C5'), 5)
  eq('COLUMN() current cell', val(s, 'D5'), 4)
}
{
  const s = sheetFrom({ A1: '=ROW(C5)', B1: '=COLUMN(C5)' })
  eq('ROW(ref)', val(s, 'A1'), 5)
  eq('COLUMN(ref)', val(s, 'B1'), 3)
}
{
  const s = sheetFrom({
    A1: '1', A2: '2', B1: '3', B2: '4',
    C1: '=ROWS(A1:B2)',
    C2: '=COLUMNS(A1:B2)',
    C3: '=ROW(A1:A3)',
  })
  eq('ROWS of range', val(s, 'C1'), 2)
  eq('COLUMNS of range', val(s, 'C2'), 2)
  eq('ROW(range) is top-left row', val(s, 'C3'), 1)
}

// ---------------------------------------------------------------------------
// Math: SUMPRODUCT, SUMSQ, GCD, LCM, COMBIN, PERMUT, FACT, QUOTIENT, MROUND, EVEN, ODD
// ---------------------------------------------------------------------------
{
  const s = sheetFrom({
    A1: '2', A2: '3', A3: '4', B1: '5', B2: '6', B3: '7',
    C1: '=SUMPRODUCT(A1:A3,B1:B3)',
  })
  eq('SUMPRODUCT', val(s, 'C1'), 2 * 5 + 3 * 6 + 4 * 7)
}
eq('SUMSQ', val(sheetFrom({ A1: '3', A2: '4', B1: '=SUMSQ(A1:A2)' }), 'B1'), 25)
eq('GCD', val(sheetFrom({ A1: '=GCD(12,18)' }), 'A1'), 6)
eq('GCD three args', val(sheetFrom({ A1: '=GCD(12,18,30)' }), 'A1'), 6)
eq('LCM', val(sheetFrom({ A1: '=LCM(4,6)' }), 'A1'), 12)
eq('COMBIN', val(sheetFrom({ A1: '=COMBIN(5,2)' }), 'A1'), 10)
eq('PERMUT', val(sheetFrom({ A1: '=PERMUT(5,2)' }), 'A1'), 20)
eq('FACT', val(sheetFrom({ A1: '=FACT(5)' }), 'A1'), 120)
isErrCode('FACT negative errors', val(sheetFrom({ A1: '=FACT(-1)' }), 'A1'), '#NUM!')
eq('QUOTIENT', val(sheetFrom({ A1: '=QUOTIENT(7,2)' }), 'A1'), 3)
eq('QUOTIENT negative truncates toward 0', val(sheetFrom({ A1: '=QUOTIENT(-7,2)' }), 'A1'), -3)
eq('MROUND', val(sheetFrom({ A1: '=MROUND(10,3)' }), 'A1'), 9)
isErrCode('MROUND sign mismatch errors', val(sheetFrom({ A1: '=MROUND(-10,3)' }), 'A1'), '#NUM!')
eq('EVEN rounds up away from zero', val(sheetFrom({ A1: '=EVEN(3)' }), 'A1'), 4)
eq('EVEN already even', val(sheetFrom({ A1: '=EVEN(2)' }), 'A1'), 2)
eq('ODD rounds up away from zero', val(sheetFrom({ A1: '=ODD(2)' }), 'A1'), 3)
eq('ODD already odd', val(sheetFrom({ A1: '=ODD(3)' }), 'A1'), 3)

// ---------------------------------------------------------------------------
// Trig
// ---------------------------------------------------------------------------
eq('RADIANS', val(sheetFrom({ A1: '=RADIANS(180)' }), 'A1'), Math.PI)
eq('DEGREES', val(sheetFrom({ A1: '=DEGREES(PI())' }), 'A1'), 180)
eq('SIN', val(sheetFrom({ A1: '=SIN(0)' }), 'A1'), 0)
eq('COS', val(sheetFrom({ A1: '=COS(0)' }), 'A1'), 1)
eq('TAN', val(sheetFrom({ A1: '=TAN(0)' }), 'A1'), 0)
eq('ASIN', val(sheetFrom({ A1: '=ASIN(1)' }), 'A1'), Math.PI / 2)
eq('ACOS', val(sheetFrom({ A1: '=ACOS(1)' }), 'A1'), 0)
eq('ATAN', val(sheetFrom({ A1: '=ATAN(1)' }), 'A1'), Math.PI / 4)
eq('ATAN2 excel arg order', val(sheetFrom({ A1: '=ATAN2(1,1)' }), 'A1'), Math.PI / 4)
eq('SINH', val(sheetFrom({ A1: '=SINH(0)' }), 'A1'), 0)
eq('COSH', val(sheetFrom({ A1: '=COSH(0)' }), 'A1'), 1)
eq('TANH', val(sheetFrom({ A1: '=TANH(0)' }), 'A1'), 0)

// ---------------------------------------------------------------------------
// Statistics: PERCENTILE, QUARTILE, STDEVP, VARP, GEOMEAN, AVEDEV, CORREL,
// SLOPE, INTERCEPT, RSQ, FORECAST, COUNTUNIQUE
// ---------------------------------------------------------------------------
{
  const s = sheetFrom({ A1: '1', A2: '2', A3: '3', A4: '4', B1: '=PERCENTILE(A1:A4,0.5)' })
  eq('PERCENTILE linear interpolation median', val(s, 'B1'), 2.5)
}
{
  const s = sheetFrom({ A1: '1', A2: '2', A3: '3', A4: '4', B1: '=PERCENTILE(A1:A4,0)', B2: '=PERCENTILE(A1:A4,1)' })
  eq('PERCENTILE 0 is min', val(s, 'B1'), 1)
  eq('PERCENTILE 1 is max', val(s, 'B2'), 4)
}
{
  const s = sheetFrom({ A1: '1', A2: '2', A3: '3', A4: '4', B1: '=QUARTILE(A1:A4,2)' })
  eq('QUARTILE 2 is median', val(s, 'B1'), 2.5)
}
{
  const s = sheetFrom({ A1: '2', A2: '4', A3: '4', A4: '4', A5: '5', A6: '5', A7: '7', A8: '9', B1: '=STDEVP(A1:A8)', B2: '=VARP(A1:A8)' })
  eq('STDEVP', val(s, 'B1'), Math.sqrt(4))
  eq('VARP', val(s, 'B2'), 4)
}
eq('GEOMEAN', val(sheetFrom({ A1: '4', A2: '9', B1: '=GEOMEAN(A1:A2)' }), 'B1'), 6)
eq('AVEDEV', val(sheetFrom({ A1: '1', A2: '2', A3: '3', A4: '4', B1: '=AVEDEV(A1:A4)' }), 'B1'), 1)
{
  const s = sheetFrom({
    A1: '1', A2: '2', A3: '3', A4: '4', A5: '5',
    B1: '2', B2: '4', B3: '6', B4: '8', B5: '10',
    C1: '=CORREL(A1:A5,B1:B5)',
    C2: '=SLOPE(B1:B5,A1:A5)',
    C3: '=INTERCEPT(B1:B5,A1:A5)',
    C4: '=RSQ(A1:A5,B1:B5)',
    C5: '=FORECAST(6,B1:B5,A1:A5)',
  })
  eq('CORREL perfect positive', val(s, 'C1'), 1)
  eq('SLOPE', val(s, 'C2'), 2)
  eq('INTERCEPT', val(s, 'C3'), 0)
  eq('RSQ perfect fit', val(s, 'C4'), 1)
  eq('FORECAST extrapolates', val(s, 'C5'), 12)
}
eq('COUNTUNIQUE', val(sheetFrom({ A1: 'a', A2: 'b', A3: 'a', A4: '1', A5: '1', B1: '=COUNTUNIQUE(A1:A5)' }), 'B1'), 3)

// ---------------------------------------------------------------------------
// Financial: PMT, FV, PV, NPER, RATE, NPV, IRR
// ---------------------------------------------------------------------------
eq('PMT zero-rate trivial case', val(sheetFrom({ A1: '=PMT(0,12,1200)' }), 'A1'), -100)
{
  const s = sheetFrom({
    B1: '=PMT(0.06,10,1000)',
    C1: '=FV(0.06,10,B1,1000)',
    D1: '=PV(0.06,10,B1)',
    E1: '=NPER(0.06,B1,1000)',
    F1: '=RATE(10,B1,1000)',
  })
  const pmt = val(s, 'B1')
  ok('PMT sign negative for positive pv', typeof pmt === 'number' && pmt < 0)
  const fv = val(s, 'C1')
  ok('PMT/FV round-trip is ~0', typeof fv === 'number' && approxEq(fv, 0, 1e-6))
  const pv = val(s, 'D1')
  ok('PMT/PV round-trip recovers pv', typeof pv === 'number' && approxEq(pv, 1000, 1e-6))
  const nper = val(s, 'E1')
  ok('PMT/NPER round-trip recovers nper', typeof nper === 'number' && approxEq(nper, 10, 1e-6))
  const rate = val(s, 'F1')
  ok('PMT/RATE round-trip converges to rate', typeof rate === 'number' && approxEq(rate, 0.06, 1e-6))
}
eq('NPV', val(sheetFrom({ A1: '=NPV(0.1,100,100,100)' }), 'A1'), 100 / 1.1 + 100 / 1.21 + 100 / 1.331)
{
  // Cashflows constructed so IRR is exactly 8%.
  const s = sheetFrom({
    A1: '-1000', A2: '200', A3: '300', A4: '400',
    A5: '=-(A1+NPV(0.08,A2:A4))*1.08^4',
    B1: '=IRR(A1:A5)',
  })
  const irr = val(s, 'B1')
  ok('IRR converges to constructed rate', typeof irr === 'number' && approxEq(irr, 0.08, 1e-5))
}
isErrCode('IRR requires a sign change', val(sheetFrom({ A1: '100', A2: '200', A3: '300', B1: '=IRR(A1:A3)' }), 'B1'), '#NUM!')

// ---------------------------------------------------------------------------
// Dates: EDATE, EOMONTH, WORKDAY, NETWORKDAYS, DATEDIF, DATEVALUE, WEEKNUM
// ---------------------------------------------------------------------------
eq('EDATE forward', val(sheetFrom({ A1: '=YEAR(EDATE(DATE(2024,1,31),1))&"-"&MONTH(EDATE(DATE(2024,1,31),1))&"-"&DAY(EDATE(DATE(2024,1,31),1))' }), 'A1'), '2024-2-29')
eq('EDATE negative months', val(sheetFrom({ A1: '=MONTH(EDATE(DATE(2024,3,15),-2))' }), 'A1'), 1)
eq('EOMONTH same month', val(sheetFrom({ A1: '=DAY(EOMONTH(DATE(2024,2,5),0))' }), 'A1'), 29) // 2024 is a leap year
eq('EOMONTH next month', val(sheetFrom({ A1: '=MONTH(EOMONTH(DATE(2024,1,15),1))' }), 'A1'), 2)
{
  // 2024-01-01 is a Monday; +5 workdays (skipping the weekend) lands on 2024-01-08 (Monday).
  const s = sheetFrom({ A1: '=WORKDAY(DATE(2024,1,1),5)' })
  eq('WORKDAY skips weekend', val(s, 'A1'), val(sheetFrom({ A1: '=DATE(2024,1,8)' }), 'A1'))
}
{
  // 2024-01-01 (Mon) through 2024-01-12 (Fri): 10 weekdays.
  const s = sheetFrom({ A1: '=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,12))' })
  eq('NETWORKDAYS spans two weekends', val(s, 'A1'), 10)
}
{
  const s = sheetFrom({ A1: '=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,12),DATE(2024,1,8))' })
  eq('NETWORKDAYS excludes holiday', val(s, 'A1'), 9)
}
{
  const s = sheetFrom({
    A1: '=DATEDIF(DATE(2020,1,15),DATE(2023,6,10),"Y")',
    A2: '=DATEDIF(DATE(2020,1,15),DATE(2023,6,10),"M")',
    A3: '=DATEDIF(DATE(2020,1,15),DATE(2023,6,10),"D")',
    A4: '=DATEDIF(DATE(2020,1,15),DATE(2023,6,10),"MD")',
    A5: '=DATEDIF(DATE(2020,1,15),DATE(2023,6,10),"YM")',
    A6: '=DATEDIF(DATE(2020,1,15),DATE(2023,6,10),"YD")',
    D1: '=DATE(2023,6,10)-DATE(2020,1,15)',
  })
  eq('DATEDIF Y', val(s, 'A1'), 3)
  eq('DATEDIF M', val(s, 'A2'), 40)
  eq('DATEDIF D matches raw serial difference', val(s, 'A3'), val(s, 'D1'))
  eq('DATEDIF MD', val(s, 'A4'), 26)
  eq('DATEDIF YM', val(s, 'A5'), 4)
  eq('DATEDIF YD', val(s, 'A6'), 146)
}
eq('DATEDIF Y matrix: exact anniversary', val(sheetFrom({ A1: '=DATEDIF(DATE(2001,1,1),DATE(2003,1,1),"Y")' }), 'A1'), 2)
eq('DATEDIF M matrix: mid-month span', val(sheetFrom({ A1: '=DATEDIF(DATE(2001,6,1),DATE(2002,8,15),"M")' }), 'A1'), 14)
eq('DATEVALUE ISO', val(sheetFrom({ A1: '=YEAR(DATEVALUE("2024-03-15"))' }), 'A1'), 2024)
eq('DATEVALUE m/d/yyyy', val(sheetFrom({ A1: '=MONTH(DATEVALUE("3/15/2024"))' }), 'A1'), 3)
eq('WEEKNUM first week', val(sheetFrom({ A1: '=WEEKNUM(DATE(2024,1,1))' }), 'A1'), 1)

// ---------------------------------------------------------------------------
// Logic/info: SWITCH, IFNA, ISERROR, ISERR, ISNA, ISEVEN, ISODD, ISLOGICAL, NA
// ---------------------------------------------------------------------------
eq('SWITCH matches case', val(sheetFrom({ A1: '=SWITCH(2,1,"one",2,"two",3,"three")' }), 'A1'), 'two')
eq('SWITCH default', val(sheetFrom({ A1: '=SWITCH(9,1,"one",2,"two","other")' }), 'A1'), 'other')
isErrCode('SWITCH no match no default', val(sheetFrom({ A1: '=SWITCH(9,1,"one",2,"two")' }), 'A1'), '#N/A')
eq('IFNA catches #N/A', val(sheetFrom({ A1: '=IFNA(NA(),"fallback")' }), 'A1'), 'fallback')
eq('IFNA passthrough non-NA error', val(sheetFrom({ A1: '=IFNA(1/0,"fallback")' }), 'A1'), new FErr('#DIV/0!'))
eq('ISERROR true for any error', val(sheetFrom({ A1: '=ISERROR(1/0)' }), 'A1'), true)
eq('ISERROR false for value', val(sheetFrom({ A1: '=ISERROR(5)' }), 'A1'), false)
eq('ISERR true for non-NA error', val(sheetFrom({ A1: '=ISERR(1/0)' }), 'A1'), true)
eq('ISERR false for #N/A', val(sheetFrom({ A1: '=ISERR(NA())' }), 'A1'), false)
eq('ISNA true for #N/A', val(sheetFrom({ A1: '=ISNA(NA())' }), 'A1'), true)
eq('ISNA false for other error', val(sheetFrom({ A1: '=ISNA(1/0)' }), 'A1'), false)
eq('ISEVEN true', val(sheetFrom({ A1: '=ISEVEN(4)' }), 'A1'), true)
eq('ISEVEN false', val(sheetFrom({ A1: '=ISEVEN(3)' }), 'A1'), false)
eq('ISODD true', val(sheetFrom({ A1: '=ISODD(3)' }), 'A1'), true)
eq('ISLOGICAL true', val(sheetFrom({ A1: '=ISLOGICAL(TRUE)' }), 'A1'), true)
eq('ISLOGICAL false for number', val(sheetFrom({ A1: '=ISLOGICAL(1)' }), 'A1'), false)
isErrCode('NA produces #N/A', val(sheetFrom({ A1: '=NA()' }), 'A1'), '#N/A')

// ---------------------------------------------------------------------------
// Text: CHAR, CODE, CLEAN, UNICHAR, UNICODE, FIXED, NUMBERVALUE
// ---------------------------------------------------------------------------
eq('CHAR', val(sheetFrom({ A1: '=CHAR(65)' }), 'A1'), 'A')
eq('CODE', val(sheetFrom({ A1: '=CODE("A")' }), 'A1'), 65)
eq('CLEAN strips control chars', val(sheetFrom({ A1: '=CLEAN("a"&CHAR(9)&"b")' }), 'A1'), 'ab')
eq('UNICHAR', val(sheetFrom({ A1: '=UNICHAR(9731)' }), 'A1'), '☃')
eq('UNICODE', val(sheetFrom({ A1: '=UNICODE("' + '☃' + '")' }), 'A1'), 9731)
eq('FIXED default 2 decimals with commas', val(sheetFrom({ A1: '=FIXED(1234.5678)' }), 'A1'), '1,234.57')
eq('FIXED no commas', val(sheetFrom({ A1: '=FIXED(1234.5,1,TRUE)' }), 'A1'), '1234.5')
eq('FIXED zero decimals', val(sheetFrom({ A1: '=FIXED(1234.5,0)' }), 'A1'), '1,235')
eq('NUMBERVALUE default separators', val(sheetFrom({ A1: '=NUMBERVALUE("1,234.5")' }), 'A1'), 1234.5)
eq('NUMBERVALUE euro separators', val(sheetFrom({ A1: '=NUMBERVALUE("1.234,5",",",".")' }), 'A1'), 1234.5)

// ---------------------------------------------------------------------------
// Adversarial cases: Excel-parity edge behavior
// ---------------------------------------------------------------------------

// 1. DATEDIF "MD" has a well-documented Excel quirk: when the start day-of-month
// exceeds the days available when borrowing from the end date's previous month,
// the result goes negative. 2026 is not a leap year, so Feb has 28 days:
// (end.day=1) - (start.day=31) + 28 = -2. This engine intentionally reproduces
// that real-Excel behavior rather than "fixing" it.
eq(
  'DATEDIF MD reproduces Excel negative-result quirk',
  val(sheetFrom({ A1: '=DATEDIF(DATE(2026,1,31),DATE(2026,3,1),"MD")' }), 'A1'),
  -2,
)

// 2. ISEVEN is an engineering function, not an information function — a
// non-numeric argument must propagate #VALUE!, not silently collapse to FALSE.
isErrCode('ISEVEN on text errors instead of returning FALSE', val(sheetFrom({ A1: '=ISEVEN("abc")' }), 'A1'), '#VALUE!')

// 3. Likewise ISODD must propagate an upstream error rather than swallowing it.
isErrCode('ISODD propagates upstream error', val(sheetFrom({ A1: '=ISODD(1/0)' }), 'A1'), '#DIV/0!')

// 4. SUMPRODUCT requires all arrays to share dimensions in Excel; mismatched
// sizes are #VALUE!, not silently zero-padded.
isErrCode(
  'SUMPRODUCT mismatched array sizes errors',
  val(sheetFrom({ A1: '1', A2: '2', A3: '3', B1: '10', B2: '20', C1: '=SUMPRODUCT(A1:A3,B1:B2)' }), 'C1'),
  '#VALUE!',
)

// 5. RATE must give up and error rather than loop forever or return a bogus
// value when cashflows are degenerate (here pmt=pv=fv=0 makes NPV(r) ≡ 0 for
// every r, so the Newton-Raphson derivative is always 0).
isErrCode('RATE non-convergence on degenerate cashflow', val(sheetFrom({ A1: '=RATE(10,0,0,0)' }), 'A1'), '#VALUE!')

// 6. NPER must reject parameter combinations where the log argument would be
// non-positive rather than returning NaN/Infinity.
isErrCode('NPER impossible parameters errors', val(sheetFrom({ A1: '=NPER(0.1,100,1000,5000)' }), 'A1'), '#NUM!')

// 7. WORKDAY with a negative day count steps backward over weekends: five
// workdays before Mon 2024-01-08 is Mon 2024-01-01.
eq(
  'WORKDAY negative days steps backward over weekend',
  val(sheetFrom({ A1: '=WORKDAY(DATE(2024,1,8),-5)' }), 'A1'),
  val(sheetFrom({ A1: '=DATE(2024,1,1)' }), 'A1'),
)

// 8. NETWORKDAYS with start after end returns a negative count (matches Excel)
// rather than an absolute value or an error.
eq(
  'NETWORKDAYS reversed start/end is negative',
  val(sheetFrom({ A1: '=NETWORKDAYS(DATE(2024,1,12),DATE(2024,1,1))' }), 'A1'),
  -10,
)

// 9. XLOOKUP only supports match_mode -1/0/1; any other value is #VALUE!.
isErrCode(
  'XLOOKUP invalid match_mode errors',
  val(sheetFrom({ A1: '1', A2: '2', B1: 'a', B2: 'b', C1: '=XLOOKUP(2,A1:A2,B1:B2,"x",2)' }), 'C1'),
  '#VALUE!',
)

// 10. GCD/LCM require non-negative arguments in Excel — a negative argument is
// #NUM!, not silently absolute-valued.
isErrCode('GCD negative argument errors', val(sheetFrom({ A1: '=GCD(-12,18)' }), 'A1'), '#NUM!')
isErrCode('LCM negative argument errors', val(sheetFrom({ A1: '=LCM(-4,6)' }), 'A1'), '#NUM!')

// ---------------------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} assertions)`)
if (fail > 0) process.exitCode = 1
