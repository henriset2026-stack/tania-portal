/**
 * Week and month helpers for the timesheet.
 *
 * `work_date` is a DATE column, so everything here works in LOCAL calendar
 * days and formats as `YYYY-MM-DD` by hand. Using toISOString() would shift
 * the date backwards for anyone east of UTC — Jakarta is UTC+7, so a Monday
 * would be stored as the preceding Sunday.
 */

export interface Weekday {
  /** `YYYY-MM-DD` */
  key: string;
  /** `Sen` */
  short: string;
  /** `24` */
  dayOfMonth: number;
}

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Local `YYYY-MM-DD`, never UTC. */
export function toKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay(): 0 = Sunday. Sunday belongs to the week that started 6 days ago.
  const shift = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - shift);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** Monday–Friday. Capacity is defined on weekdays only (SRS SF-1.1). */
export function weekdays(weekStart: Date): Weekday[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { key: toKey(d), short: DAY_SHORT[d.getDay()], dayOfMonth: d.getDate() };
  });
}

/** `24 – 30 Agu 2026` */
export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const fmtDay = new Intl.DateTimeFormat("id-ID", { day: "numeric" });
  const fmtFull = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return sameMonth
    ? `${fmtDay.format(weekStart)} – ${fmtFull.format(end)}`
    : `${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(weekStart)} – ${fmtFull.format(end)}`;
}

/** First day of the month containing `d`, as `YYYY-MM-01`. */
export function monthKey(d: Date): string {
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
