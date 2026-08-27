/**
 * Monthly capacity, mirroring the `utilization_monthly` view (SRS SF-1.1):
 *
 *   capacity_hours = weekdays(Mon–Fri) in the month × 8
 *
 * The view only emits rows for people who have timesheet entries, so a squad
 * denominator taken from it would silently exclude everyone who filed nothing
 * — inflating the squad's utilisation exactly when it should fall. Computing
 * capacity here lets the client use the full active roster as the denominator.
 *
 * National holidays are not excluded (BRD decision D3, still open).
 */
export const HOURS_PER_DAY = 8;

/** `monthKey` is `YYYY-MM-01`. */
export function workingDays(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow >= 1 && dow <= 5) n++;
  }
  return n;
}

export function capacityHours(monthKey: string): number {
  return workingDays(monthKey) * HOURS_PER_DAY;
}

/** The last `count` months ending at `endMonthKey`, oldest first. */
export function recentMonths(endMonthKey: string, count: number): string[] {
  const [y, m] = endMonthKey.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-01`);
  }
  return out;
}

const monthShort = new Intl.DateTimeFormat("id-ID", { month: "short" });
export function monthShortLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return monthShort.format(new Date(y, m - 1, 1));
}
