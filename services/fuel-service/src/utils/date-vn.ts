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

/**
 * YYYY-MM-DD → Date tại UTC-midnight.
 *
 * Dùng khi so sánh với cột `recorded_date` (@db.Date): Prisma đọc/ghi cột date ở UTC-midnight,
 * nên KHÔNG được lọc bằng toBusinessDateRangeVN — mốc +07:00 của nó rơi vào 17:00 UTC ngày hôm
 * trước và sẽ lệch nguyên một ngày.
 */
export function toDateOnlyUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export type StatsPeriod = 'today' | 'week' | 'month' | 'year'

export const STATS_PERIODS: readonly StatsPeriod[] = ['today', 'week', 'month', 'year']

/**
 * Khoảng ngày nghiệp vụ của một kỳ thống kê, tính theo lịch VN (UTC+7) và luôn kết thúc ở hôm nay:
 * tuần = từ thứ Hai tuần này, tháng = từ mùng 1 tháng này, năm = từ 01/01 năm nay.
 * `to` là ngày cuối (bao gồm) để hiển thị; dùng `toDateOnlyUTC(toExclusive)` khi truy vấn.
 */
export function toPeriodDateRangeVN(
  period: StatsPeriod,
  now: Date = new Date()
): { from: string; to: string; toExclusive: string } {
  const today = formatBusinessDateVN(now)
  const start = toDateOnlyUTC(today)

  if (period === 'week') {
    // getUTCDay(): 0 = Chủ nhật → lùi 6 ngày mới về thứ Hai
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  } else if (period === 'month') {
    start.setUTCDate(1)
  } else if (period === 'year') {
    start.setUTCMonth(0, 1)
  }

  const end = toDateOnlyUTC(today)
  end.setUTCDate(end.getUTCDate() + 1)

  return {
    from: start.toISOString().split('T')[0],
    to: today,
    toExclusive: end.toISOString().split('T')[0],
  }
}
