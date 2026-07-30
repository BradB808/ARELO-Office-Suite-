// Pulls chart-ready data out of the sheet: label/series extraction for
// rendering, and a heuristic to prefill the Insert Chart modal from a selection.

import type { ChartSpec, Sheet } from '../../shared/types'
import type { ComputedCell } from './engine/formula'
import { isErr } from './engine/formula'
import { parseCellRef, rangeRefList, refToString } from './engine/refs'
import type { SelRect } from './types'

function refsForRangeStr(s: string): string[] {
  const trimmed = s.trim()
  const list = rangeRefList(trimmed)
  if (list) return list
  const single = parseCellRef(trimmed)
  return single ? [refToString(single.col, single.row)] : []
}

export interface ChartSeries {
  name: string
  values: number[]
}

export interface ChartData {
  labels: string[]
  series: ChartSeries[]
}

export function extractChartData(computed: Map<string, ComputedCell>, spec: Pick<ChartSpec, 'labelRange' | 'dataRanges' | 'seriesNames'>): ChartData {
  const labelRefs = spec.labelRange ? refsForRangeStr(spec.labelRange) : []
  const series = spec.dataRanges.map((rangeStr, si) => {
    const refs = refsForRangeStr(rangeStr)
    const values = refs.map((ref) => {
      const c = computed.get(ref)
      if (!c || isErr(c.value)) return 0
      return typeof c.value === 'number' ? c.value : 0
    })
    return { name: spec.seriesNames?.[si]?.trim() || rangeStr, values }
  })
  const n = series[0]?.values.length ?? 0
  const labels = labelRefs.map((ref) => {
    const c = computed.get(ref)
    return c && !isErr(c.value) ? c.display : ''
  })
  const finalLabels = labels.length === n && n > 0 ? labels : Array.from({ length: n }, (_, i) => String(i + 1))
  return { labels: finalLabels, series }
}

export function guessChartSpecFromSelection(
  sheet: Sheet,
  computed: Map<string, ComputedCell>,
  sel: SelRect,
): { labelRange?: string; dataRanges: string[]; seriesNames?: string[] } {
  const rows: number[] = []
  for (let r = sel.r0; r <= sel.r1; r++) rows.push(r)
  const cols: number[] = []
  for (let c = sel.c0; c <= sel.c1; c++) cols.push(c)
  if (cols.length < 1 || rows.length < 1) return { dataRanges: [] }

  const firstColVals = rows.map((r) => computed.get(refToString(cols[0], r)))
  const firstColNumeric = firstColVals.filter((v) => v && typeof v.value === 'number').length
  const useFirstColAsLabels = cols.length > 1 && firstColNumeric < firstColVals.length / 2

  const dataCols = useFirstColAsLabels ? cols.slice(1) : cols
  const labelCol = useFirstColAsLabels ? cols[0] : null
  if (dataCols.length === 0) return { dataRanges: [] }

  const firstRow = rows[0]
  const firstRowVals = dataCols.map((c) => computed.get(refToString(c, firstRow)))
  const firstRowNumeric = firstRowVals.filter((v) => v && typeof v.value === 'number').length
  const useFirstRowAsHeader = rows.length > 1 && firstRowNumeric === 0

  const dataRowStart = useFirstRowAsHeader ? rows[1] : rows[0]
  const dataRowEnd = rows[rows.length - 1]
  if (dataRowStart === undefined || dataRowStart > dataRowEnd) return { dataRanges: [] }

  const labelRange = labelCol !== null ? `${refToString(labelCol, dataRowStart)}:${refToString(labelCol, dataRowEnd)}` : undefined
  const dataRanges = dataCols.map((c) => `${refToString(c, dataRowStart)}:${refToString(c, dataRowEnd)}`)
  const seriesNames = useFirstRowAsHeader
    ? dataCols.map((c) => computed.get(refToString(c, firstRow))?.display || '')
    : undefined

  return { labelRange, dataRanges, seriesNames }
}
