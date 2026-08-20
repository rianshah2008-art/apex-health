import { assertDateKey, parseDateKey, shiftDateKey, todayKey } from "./dateKeys";

/** Monday (UTC calendar) of the week containing `dateKey`. */
export function mondayOfWeek(dateKey: string): string {
  assertDateKey(dateKey);
  const date = parseDateKey(dateKey);
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  return shiftDateKey(dateKey, -daysFromMonday);
}

/** Whole weeks from today through event date, rounded up. */
export function weeksUntilEvent(eventDate: string, fromDate: string = todayKey()): number {
  assertDateKey(eventDate);
  assertDateKey(fromDate);
  const start = parseDateKey(fromDate);
  const end = parseDateKey(eventDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  if (diffDays <= 0) {
    return 0;
  }
  return Math.ceil(diffDays / 7);
}

/** Assign `weekStartDate` to each generated week, working backward from race week. */
export function attachWeekStartDates(
  eventDate: string,
  weeks: Array<{ weekNumber: number }>,
): string[] {
  const raceWeekStart = mondayOfWeek(eventDate);
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const maxWeek = sorted.at(-1)?.weekNumber ?? 0;
  return sorted.map((week) =>
    shiftDateKey(raceWeekStart, (week.weekNumber - maxWeek) * 7),
  );
}
