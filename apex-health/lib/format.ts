/** Pace and duration formatting shared by the metric cards and activity lists. */

/** `499` -> `"8:19"`. Paces and mile times are always shown as M:SS. */
export function formatPace(totalSeconds: number | undefined): string {
  if (totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return "—";
  }
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

/** `4980` -> `"1:23:00"`, `1374` -> `"22:54"`. */
export function formatDuration(totalSeconds: number | undefined): string {
  if (totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return "—";
  }
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** `309` -> `"5h 9m"`, matching the Sleep card's `{score} · {Xh Ym}` format. */
export function formatHoursMinutes(totalMinutes: number | undefined): string {
  if (totalMinutes === undefined || !Number.isFinite(totalMinutes)) {
    return "—";
  }
  const rounded = Math.round(totalMinutes);
  return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

export function formatNumber(value: number | undefined, digits = 0): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function formatDistance(
  meters: number,
  type: "run" | "bike" | "swim",
): string {
  // Swims are logged and read in meters; land sports in miles.
  return type === "swim"
    ? `${formatNumber(meters)} m`
    : `${formatNumber(metersToMiles(meters), 2)} mi`;
}

/** "2 hours ago" / "just now", for the last-synced label. */
export function formatRelativeTime(
  timestampMs: number | null,
  nowMs: number,
): string {
  if (timestampMs === null) {
    return "never";
  }
  const seconds = Math.round((nowMs - timestampMs) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) {
    if (seconds >= unit[1]) {
      chosen = unit;
    }
  }
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

/** Turns `"M:SS"` or a plain seconds string into seconds, for pace inputs. */
export function parsePaceToSeconds(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length > 3) {
      return undefined;
    }
    let total = 0;
    for (const part of parts) {
      const value = Number(part);
      if (!Number.isFinite(value) || value < 0) {
        return undefined;
      }
      total = total * 60 + value;
    }
    return Math.round(total);
  }
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}
