/**
 * Display formatting, centralised (UIUX.md §6.4, standard S-6).
 * Every screen formats money, dates and percentages through here.
 */

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const idrCompact = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `Rp 100.000.000` */
export function money(value: number | null | undefined): string {
  if (value == null) return "—";
  return `Rp ${idr.format(value)}`;
}

/** `100,0 jt` — for table cells where the full number is too wide. */
export function moneyCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${idrCompact.format(value / 1_000_000)} jt`;
}

/** `71,4%` — one decimal, always. */
export function percent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${idrCompact.format(value)}%`;
}

/** Hours: `6`, `7,5`, and `–` for nothing logged. */
export function hours(value: number | null | undefined): string {
  if (value == null || value === 0) return "–";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** `24 Agu 2026` */
export function date(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

/** `Agustus 2026` */
export function month(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return monthFmt.format(typeof value === "string" ? new Date(value) : value);
}

/** `24 Agu 2026 14.32` */
export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTimeFmt.format(typeof value === "string" ? new Date(value) : value);
}
