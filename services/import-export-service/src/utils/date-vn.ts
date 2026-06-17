const VN_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7

/** Date → YYYY-MM-DD theo UTC+7 */
export function formatBusinessDateVN(date: Date): string {
  const local = new Date(date.getTime() + VN_OFFSET_MS)
  return local.toISOString().split('T')[0]
}

/** YYYY-MM-DD → { gte: startOfDay, lt: nextDayStart } theo UTC+7 (half-open) */
export function toBusinessDateRangeVN(dateStr: string): { gte: Date; lt: Date } {
  const gte = new Date(`${dateStr}T00:00:00+07:00`)
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000)
  return { gte, lt }
}

/** Ngày hôm nay tính theo VN (bắt đầu ngày, 00:00:00 +07:00) */
export function todayVN(): Date {
  return new Date(formatBusinessDateVN(new Date()) + 'T00:00:00+07:00')
}
