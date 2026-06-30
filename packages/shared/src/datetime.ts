/**
 * Date/time helpers. Store UTC, render in the business timezone.
 * Attendance is timezone-sensitive — always be explicit about which zone
 * a "day" belongs to.
 */

/** YYYY-MM-DD for a Date in a given IANA timezone. */
export function toLocalDateString(date: Date, timeZone: string): string {
  // en-CA gives ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Whole minutes between two instants (b - a), floored. */
export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}

/** "YYYY-MM" period string for a date in a timezone (used by payroll runs). */
export function toMonthPeriod(date: Date, timeZone: string): string {
  return toLocalDateString(date, timeZone).slice(0, 7);
}

/** Validate a YYYY-MM-DD string. */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
