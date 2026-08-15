import React from 'react'
import type { CellStyle } from '../../shared/types'
import { SYSTEM_FONTS } from '../../shared/fonts'
import { IconBtn, ToolbarDivider, Select, MenuButton, ColorPickerButton, Spacer } from '../../shared/ui'
import { IcFolder, IcCheck } from '../../shared/icons'
import { AiButton } from '../../shared/AiButton'
import FontFamilyMenu from './FontFamilyMenu'
import { TABLE_PRESETS } from './tableStyle'
import {
  IcUndo,
  IcRedo,
  IcBold,
  IcItalic,
  IcUnderline,
  IcStrike,
  IcAlignLeft,
  IcAlignCenter,
  IcAlignRight,
  IcValignTop,
  IcValignMiddle,
  IcValignBottom,
  IcWrap,
  IcBorders,
  IcSort,
  IcInsertRowCol,
  IcChart,
  IcTextColor,
  IcFillColor,
  IcDecimalMore,
  IcDecimalLess,
  IcMerge,
  IcFreeze,
  IcFunnel,
  IcCondFormat,
  IcDropdownList,
  IcPaintbrush,
  IcSigma,
  IcCurrency,
  IcPercent,
  IcComma,
  IcEraser,
  IcTable,
  IcLink,
} from './icons'

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

const FORMAT_OPTIONS: { value: NonNullable<CellStyle['format']>; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'number', label: 'Number' },
  { value: 'percent', label: 'Percent' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'text', label: 'Plain text' },
]

export type BorderKind = 'all' | 'outer' | 'top' | 'bottom' | 'left' | 'right' | 'clear'
export type AutosumOp = 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN'
export type PaintMode = 'off' | 'once' | 'sticky'

export default function Toolbar({
  style,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onToggle,
  onFontSize,
  onFontFamily,
  onColor,
  onFill,
  onAlign,
  onValign,
  onWrap,
  onBorders,
  onFormat,
  onDecimals,
  onQuickFormat,
  onInsertRow,
  onInsertCol,
  onSort,
  onInsertChart,
  onExport,
  onImport,
  mergeDisabled,
  unmergeDisabled,
  onMergeCenter,
  onMergePlain,
  onUnmerge,
  freeze,
  onFreeze,
  onOpenCondFormat,
  filterActive,
  onToggleFilter,
  onOpenValidation,
  onOpenPivot,
  onRefreshPivots,
  paintMode,
  onPaintOnce,
  onPaintSticky,
  onAutosum,
  onClearContents,
  onClearFormats,
  onClearAll,
  onFormatAsTable,
  onRemoveTableStyle,
  aiOpen,
  onOpenAi,
  onCopyLiveLink,
}: {
  style: CellStyle | undefined
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onToggle: (key: 'bold' | 'italic' | 'underline' | 'strike') => void
  onFontSize: (size: number) => void
  onFontFamily: (family: string) => void
  onColor: (color: string) => void
  onFill: (color: string) => void
  onAlign: (align: 'left' | 'center' | 'right') => void
  onValign: (valign: 'top' | 'middle' | 'bottom') => void
  onWrap: () => void
  onBorders: (kind: BorderKind) => void
  onFormat: (format: NonNullable<CellStyle['format']>) => void
  onDecimals: (delta: 1 | -1) => void
  onQuickFormat: (kind: 'currency' | 'percent' | 'comma') => void
  onInsertRow: (before: boolean) => void
  onInsertCol: (before: boolean) => void
  onSort: (asc: boolean) => void
  onInsertChart: () => void
  onExport: (kind: 'asheet' | 'xlsx' | 'csv' | 'living') => void
  onImport: (kind: 'xlsx' | 'csv') => void
  mergeDisabled: boolean
  unmergeDisabled: boolean
  onMergeCenter: () => void
  onMergePlain: () => void
  onUnmerge: () => void
  freeze: { rows: number; cols: number } | undefined
  onFreeze: (freeze: { rows: number; cols: number } | undefined) => void
  onOpenCondFormat: () => void
  filterActive: boolean
  onToggleFilter: () => void
  onOpenValidation: () => void
  onOpenPivot: () => void
  onRefreshPivots: () => void
  paintMode: PaintMode
  onPaintOnce: () => void
  onPaintSticky: () => void
  onAutosum: (op: AutosumOp) => void
  onClearContents: () => void
  onClearFormats: () => void
  onClearAll: () => void
  onFormatAsTable: (presetId: string) => void
  onRemoveTableStyle: () => void
  aiOpen: boolean
  onOpenAi: () => void
  onCopyLiveLink: () => void
}) {
  const fontSize = style?.fontSize ?? 11
  const align = style?.align ?? 'left'
  const valign = style?.valign ?? 'middle'

  return (
    <div className="toolbar">
      <IconBtn label="Undo" disabled={!canUndo} onClick={onUndo}>
        <IcUndo />
      </IconBtn>
      <IconBtn label="Redo" disabled={!canRedo} onClick={onRedo}>
        <IcRedo />
      </IconBtn>
      <ToolbarDivider />

      <FontFamilyMenu value={style?.fontFamily ?? SYSTEM_FONTS[0]} onChange={onFontFamily} />
      <Select
        value={String(fontSize)}
        onChange={(v) => onFontSize(Number(v))}
        width={62}
        compact
        options={FONT_SIZES.map((s) => ({ value: String(s), label: String(s) }))}
      />
      <ToolbarDivider />

      <IconBtn label="Bold" active={!!style?.bold} onClick={() => onToggle('bold')}>
        <IcBold />
      </IconBtn>
      <IconBtn label="Italic" active={!!style?.italic} onClick={() => onToggle('italic')}>
        <IcItalic />
      </IconBtn>
      <IconBtn label="Underline" active={!!style?.underline} onClick={() => onToggle('underline')}>
        <IcUnderline />
      </IconBtn>
      <IconBtn label="Strikethrough" active={!!style?.strike} onClick={() => onToggle('strike')}>
        <IcStrike />
      </IconBtn>
      <ToolbarDivider />

      <IconBtn
        label={paintMode === 'off' ? 'Format painter (double-click to keep it on)' : 'Format painter — click a cell to apply, Esc to cancel'}
        active={paintMode !== 'off'}
        onClick={onPaintOnce}
        onDoubleClick={onPaintSticky}
      >
        <IcPaintbrush />
      </IconBtn>
      <ToolbarDivider />

      <ColorPickerButton label="Text color" icon={<IcTextColor />} value={style?.color} onPick={onColor} allowNone />
      <ColorPickerButton label="Fill color" icon={<IcFillColor />} value={style?.fill} onPick={onFill} allowNone />
      <ToolbarDivider />

      <MenuButton
        label="Borders"
        trigger={<IcBorders />}
        items={[
          { label: 'All borders', onClick: () => onBorders('all') },
          { label: 'Outer border', onClick: () => onBorders('outer') },
          { label: 'Top border', onClick: () => onBorders('top') },
          { label: 'Bottom border', onClick: () => onBorders('bottom') },
          { label: 'Left border', onClick: () => onBorders('left') },
          { label: 'Right border', onClick: () => onBorders('right') },
          'sep',
          { label: 'Clear borders', onClick: () => onBorders('clear') },
        ]}
      />
      <ToolbarDivider />

      <IconBtn label="Align left" active={align === 'left'} onClick={() => onAlign('left')}>
        <IcAlignLeft />
      </IconBtn>
      <IconBtn label="Align center" active={align === 'center'} onClick={() => onAlign('center')}>
        <IcAlignCenter />
      </IconBtn>
      <IconBtn label="Align right" active={align === 'right'} onClick={() => onAlign('right')}>
        <IcAlignRight />
      </IconBtn>
      <IconBtn label="Align top" active={valign === 'top'} onClick={() => onValign('top')}>
        <IcValignTop />
      </IconBtn>
      <IconBtn label="Align middle" active={valign === 'middle'} onClick={() => onValign('middle')}>
        <IcValignMiddle />
      </IconBtn>
      <IconBtn label="Align bottom" active={valign === 'bottom'} onClick={() => onValign('bottom')}>
        <IcValignBottom />
      </IconBtn>
      <IconBtn label="Wrap text" active={!!style?.wrap} onClick={onWrap}>
        <IcWrap />
      </IconBtn>
      <MenuButton
        label="Merge cells"
        trigger={<IcMerge />}
        items={[
          { label: 'Merge & center', disabled: mergeDisabled, onClick: onMergeCenter },
          { label: 'Merge cells', disabled: mergeDisabled, onClick: onMergePlain },
          { label: 'Unmerge', disabled: unmergeDisabled, onClick: onUnmerge },
        ]}
      />
      <ToolbarDivider />

      <Select
        value={style?.format ?? 'auto'}
        onChange={(v) => onFormat(v as NonNullable<CellStyle['format']>)}
        width={118}
        compact
        options={FORMAT_OPTIONS}
      />
      <IconBtn label="Currency format" onClick={() => onQuickFormat('currency')}>
        <IcCurrency />
      </IconBtn>
      <IconBtn label="Percent format" onClick={() => onQuickFormat('percent')}>
        <IcPercent />
      </IconBtn>
      <IconBtn label="Comma style (thousands separator)" onClick={() => onQuickFormat('comma')}>
        <IcComma />
      </IconBtn>
      <IconBtn label="Decrease decimals" onClick={() => onDecimals(-1)}>
        <IcDecimalLess />
      </IconBtn>
      <IconBtn label="Increase decimals" onClick={() => onDecimals(1)}>
        <IcDecimalMore />
      </IconBtn>
      <ToolbarDivider />

      <MenuButton
        label="AutoSum"
        trigger={<IcSigma />}
        items={[
          { label: 'Sum', onClick: () => onAutosum('SUM') },
          { label: 'Average', onClick: () => onAutosum('AVERAGE') },
          { label: 'Count', onClick: () => onAutosum('COUNT') },
          { label: 'Max', onClick: () => onAutosum('MAX') },
          { label: 'Min', onClick: () => onAutosum('MIN') },
        ]}
      />
      <MenuButton
        label="Insert row or column"
        trigger={<IcInsertRowCol />}
        items={[
          { label: 'Insert row above', onClick: () => onInsertRow(true) },
          { label: 'Insert row below', onClick: () => onInsertRow(false) },
          'sep',
          { label: 'Insert column left', onClick: () => onInsertCol(true) },
          { label: 'Insert column right', onClick: () => onInsertCol(false) },
        ]}
      />
      <MenuButton
        label="Sort"
        trigger={<IcSort />}
        items={[
          { label: 'Sort sheet A → Z by this column', onClick: () => onSort(true) },
          { label: 'Sort sheet Z → A by this column', onClick: () => onSort(false) },
        ]}
      />
      <IconBtn label="Insert chart" onClick={onInsertChart}>
        <IcChart />
      </IconBtn>
      <MenuButton
        label="Freeze panes"
        trigger={<IcFreeze />}
        items={[
          { label: 'No freeze', icon: !freeze || (!freeze.rows && !freeze.cols) ? <IcCheck /> : undefined, onClick: () => onFreeze(undefined) },
          { label: '1 row', icon: freeze?.rows === 1 && !freeze.cols ? <IcCheck /> : undefined, onClick: () => onFreeze({ rows: 1, cols: 0 }) },
          { label: '2 rows', icon: freeze?.rows === 2 && !freeze.cols ? <IcCheck /> : undefined, onClick: () => onFreeze({ rows: 2, cols: 0 }) },
          { label: '1 column', icon: freeze?.cols === 1 && !freeze.rows ? <IcCheck /> : undefined, onClick: () => onFreeze({ rows: 0, cols: 1 }) },
          { label: '1 row + 1 column', icon: freeze?.rows === 1 && freeze.cols === 1 ? <IcCheck /> : undefined, onClick: () => onFreeze({ rows: 1, cols: 1 }) },
        ]}
      />
      <ToolbarDivider />

      <MenuButton
        label="Format"
        trigger={<IcCondFormat />}
        items={[{ label: 'Conditional formatting…', onClick: onOpenCondFormat }]}
      />
      <MenuButton
        label="Format as table"
        trigger={<IcTable />}
        items={[
          ...TABLE_PRESETS.map((p) => ({
            label: p.label,
            icon: <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color, display: 'inline-block', flexShrink: 0 }} />,
            onClick: () => onFormatAsTable(p.id),
          })),
          'sep' as const,
          { label: 'Remove table style', onClick: onRemoveTableStyle },
        ]}
      />
      <MenuButton
        label="Clear"
        trigger={<IcEraser />}
        items={[
          { label: 'Clear contents', onClick: onClearContents },
          { label: 'Clear formats', onClick: onClearFormats },
          { label: 'Clear all', onClick: onClearAll },
        ]}
      />
      <IconBtn label={filterActive ? 'Remove filter' : 'Create filter'} active={filterActive} onClick={onToggleFilter}>
        <IcFunnel />
      </IconBtn>
      <MenuButton
        label="Data"
        trigger={<IcDropdownList />}
        items={[
          { label: 'Pivot table…', onClick: onOpenPivot },
          { label: 'Refresh pivot tables', onClick: onRefreshPivots },
          'sep',
          { label: 'Dropdown list…', onClick: onOpenValidation },
        ]}
      />

      <Spacer />

      <IconBtn label="Copy as live link" onClick={onCopyLiveLink}>
        <IcLink />
      </IconBtn>
      <ToolbarDivider />

      <MenuButton
        label="Import"
        trigger={<IcFolder />}
        align="right"
        items={[
          { label: 'Import .xlsx…', onClick: () => onImport('xlsx') },
          { label: 'Import .csv…', onClick: () => onImport('csv') },
        ]}
      />
      <AiButton active={aiOpen} label="AI assistant" onClick={onOpenAi} />
      <MenuButton
        label="Export"
        trigger={<span style={{ fontSize: 12.5, fontWeight: 500, padding: '0 2px' }}>Export</span>}
        align="right"
        items={[
          { label: 'Save as .asheet', onClick: () => onExport('asheet') },
          { label: 'Export as .xlsx', onClick: () => onExport('xlsx') },
          { label: 'Export as .csv (active sheet)', onClick: () => onExport('csv') },
          'sep',
          { label: 'Share as web page (.html)', onClick: () => onExport('living') },
        ]}
      />
    </div>
  )
}
