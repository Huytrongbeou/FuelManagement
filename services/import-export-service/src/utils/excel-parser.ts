import type { Cell } from 'exceljs'

export type ParsedNumber =
  | { type: 'blank' }
  | { type: 'valid'; value: number }
  | { type: 'invalid'; raw: string }

// Normalizes a numeric string written with locale separators before Number() sees it.
// Real Excel stores numbers as numeric cells (locale only affects display), so this only
// matters for text-formatted / pasted cells — where a Vietnamese user's "51,5" would
// otherwise become NaN. Handled conservatively so we never turn a currently-valid number
// into a DIFFERENT number, and never guess on genuinely ambiguous input (those stay invalid
// = a loud error, never silent corruption):
//   - both separators present  → the last-occurring one is the decimal (VN "1.234,5" and
//     US "1,234.5" both → 1234.5)
//   - only a comma, appearing once, with a non-3-digit fraction → decimal comma ("51,5"→51.5)
//   - only commas, appearing multiple times → thousands separators ("1,234,567"→1234567)
//   - a single comma followed by exactly 3 digits ("1,234") is ambiguous → left as-is (invalid)
//   - period-only strings are untouched (period is JS's native decimal; "1.234" thousands is
//     too ambiguous to guess and is a pre-existing, documented gap)
function normalizeNumericString(raw: string): string {
  const s = raw.trim()
  if (!/^[+-]?[\d.,]+$/.test(s)) return s
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    return s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  }
  if (hasComma && !hasDot) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length !== 3) return s.replace(',', '.')
    if (parts.length > 2) return s.replace(/,/g, '')
    return s
  }
  return s
}

export function parseCellAsNumber(cell: Cell): ParsedNumber {
  const v = cell.value
  if (v === null || v === undefined || v === '') return { type: 'blank' }
  // ExcelJS can return objects for formula results, dates, etc.
  const raw = typeof v === 'object' && 'result' in (v as object)
    ? String((v as { result: unknown }).result)
    : String(v)
  if (raw.trim() === '') return { type: 'blank' }
  const num = Number(normalizeNumericString(raw))
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
