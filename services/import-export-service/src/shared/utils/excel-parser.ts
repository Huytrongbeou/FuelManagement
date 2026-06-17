import type { Cell } from 'exceljs'

export type ParsedNumber =
  | { type: 'blank' }
  | { type: 'valid'; value: number }
  | { type: 'invalid'; raw: string }

export function parseCellAsNumber(cell: Cell): ParsedNumber {
  const v = cell.value
  if (v === null || v === undefined || v === '') return { type: 'blank' }
  // ExcelJS can return objects for formula results, dates, etc.
  const raw = typeof v === 'object' && 'result' in (v as object)
    ? String((v as { result: unknown }).result)
    : String(v)
  if (raw.trim() === '') return { type: 'blank' }
  const num = Number(raw)
  if (isNaN(num)) return { type: 'invalid', raw }
  return { type: 'valid', value: num }
}

export function parseCellAsString(cell: Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export function parseCellAsDate(cell: Cell): Date | null {
  const v = cell.value
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return v
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}
