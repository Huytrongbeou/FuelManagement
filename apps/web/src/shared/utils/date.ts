/**
 * Today's date as YYYY-MM-DD in the *user's local* timezone.
 *
 * Deliberately NOT `new Date().toISOString().slice(0,10)` — that gives the UTC date, so between
 * 00:00 and 07:00 Vietnam time it returns yesterday. Field staff entering data at night or early
 * morning would otherwise get a date defaulted one day back without noticing.
 */
export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
