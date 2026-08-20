/** Local-time "YYYY-MM-DD", the key format used by every dated Convex table. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Ascending list of the last `days` date keys, ending with `endKey`. */
export function dateKeyRange(endKey: string, days: number): string[] {
  const end = parseDateKey(endKey);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(end);
    day.setDate(day.getDate() - offset);
    keys.push(toDateKey(day));
  }
  return keys;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLongDate(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
