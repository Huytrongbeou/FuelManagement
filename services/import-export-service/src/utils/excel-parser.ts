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

export type ParsedDate =
  | { type: 'blank' }
  | { type: 'valid'; value: Date }
  | { type: 'invalid'; raw: string }

// Builds a UTC-midnight Date for a given calendar day. UTC midnight is what the ISO string
// path (`new Date("2026-07-09")`) already produces and what the rest of the pipeline expects
// (formatBusinessDateVN shifts +7h then takes the date part; a `date` DB column then keeps the
// intended day whether Postgres runs in UTC or +07). Rejects calendar rollover (e.g. 31/02).
function buildUtcDate(day: number, month: number, year: number, raw: string): ParsedDate {
  if (month < 1 || month > 12 || day < 1 || day > 31) return { type: 'invalid', raw }
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return { type: 'invalid', raw }
  }
  return { type: 'valid', value: d }
}

export function parseCellAsDate(cell: Cell): ParsedDate {
  const v = cell.value
  if (v === null || v === undefined || v === '') return { type: 'blank' }
  if (v instanceof Date) return { type: 'valid', value: v }
  // Formula/rich-text cells wrap the real value in an object with `.result`
  const source = typeof v === 'object' && 'result' in (v as object)
    ? (v as { result: unknown }).result
    : v
  if (source instanceof Date) return { type: 'valid', value: source }
  const raw = String(source).trim()
  if (raw === '') return { type: 'blank' }

  // ISO year-first: YYYY-MM-DD or YYYY/MM/DD (unambiguous)
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw)
  if (m) return buildUtcDate(Number(m[3]), Number(m[2]), Number(m[1]), raw)

  // Vietnamese day-first: DD/MM/YYYY (also - or . separators). This is the format the app's
  // own error message promises ("DD/MM/YYYY") — plain `new Date(raw)` misreads it as MM/DD/YYYY,
  // silently committing the wrong month for days 1-12 and erroring for days 13-31.
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(raw)
  if (m) return buildUtcDate(Number(m[1]), Number(m[2]), Number(m[3]), raw)

  return { type: 'invalid', raw }
}
