/**
 * Server-side "YYYY-MM-DD" helpers. Dated rows are keyed by the user's local
 * calendar day, not UTC — a 10pm Central sync must still write to tonight, not
 * tomorrow. Single-user app; override with APEX_TIMEZONE on the deployment if
 * you travel.
 */

function apexTimeZone(): string {
  return process.env.APEX_TIMEZONE ?? "America/Chicago";
}

/** Calendar math on already-parsed date keys. Always UTC so day arithmetic is stable. */
export function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "Today" in the user's timezone, for cron and on-demand sync. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: apexTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function shiftDateKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

/** Ascending list of `days` keys ending at `endKey` inclusive. */
export function dateKeyRange(endKey: string, days: number): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    keys.push(shiftDateKey(endKey, -offset));
  }
  return keys;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateKey(key: string): string {
  if (!DATE_KEY_PATTERN.test(key)) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${key}"`);
  }
  return key;
}
