/**
 * Normalize về decimal string 2 chữ số — tránh float precision bug với Prisma Decimal.
 * Throws nếu value không parse được thành số hữu hạn (NaN/Infinity guard).
 * Caller phải catch và chuyển thành message tiếng Việt trước khi trả về user.
 */
export function normalizeDecimal2(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) throw new Error(`Invalid decimal value: ${String(value)}`)
  return n.toFixed(2)
}
