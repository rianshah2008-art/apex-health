/**
 * Narrowing helpers for Garmin's undocumented JSON. Every response field is
 * treated as `unknown` and coerced through these, so a shape change upstream
 * yields a missing metric rather than a crashed sync.
 */

export function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function list(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

/** Walks a path of object keys and array indices, returning `undefined` on any miss. */
export function at(root: unknown, ...path: Array<string | number>): unknown {
  let current = root;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof key === "number") {
      const items = list(current);
      if (items === undefined) {
        return undefined;
      }
      current = items[key];
    } else {
      const obj = record(current);
      if (obj === undefined) {
        return undefined;
      }
      current = obj[key];
    }
  }
  return current;
}

/** Returns the first key in `keys` that resolves to a finite number. */
export function firstNum(
  source: unknown,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = num(at(source, key));
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function firstStr(
  source: unknown,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = str(at(source, key));
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function secondsToMinutes(seconds: number | undefined): number | undefined {
  return seconds === undefined ? undefined : Math.round(seconds / 60);
}

/**
 * Reduces an intraday `[timestampMs, value]` series into `buckets` evenly spaced
 * averages across the calendar day, so the UI always gets a fixed-length array
 * no matter how densely the watch sampled.
 */
export function bucketIntraday(
  samples: Array<[number, number | null]>,
  dayStartMs: number,
  buckets: number,
): number[] | undefined {
  if (samples.length === 0) {
    return undefined;
  }
  const bucketMs = 86_400_000 / buckets;
  const sums = new Array<number>(buckets).fill(0);
  const counts = new Array<number>(buckets).fill(0);

  for (const [timestamp, value] of samples) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }
    const index = Math.floor((timestamp - dayStartMs) / bucketMs);
    if (index < 0 || index >= buckets) {
      continue;
    }
    sums[index] += value;
    counts[index] += 1;
  }

  if (counts.every((count) => count === 0)) {
    return undefined;
  }

  // Carry readings through gaps so the bar/sparkline stays continuous, and
  // back-fill any leading gap with the first real reading rather than zero —
  // an early-morning sync would otherwise draw hours of phantom flatline at 0.
  const averages = counts.map((count, index) =>
    count > 0 ? Math.round(sums[index] / counts[index]) : null,
  );
  const firstReading = averages.find((value) => value !== null)!;

  const result: number[] = [];
  let previous = firstReading;
  for (const average of averages) {
    if (average !== null) {
      previous = average;
    }
    result.push(previous);
  }
  return result;
}

/** Parses Garmin's `[[timestampMs, value], ...]` intraday arrays. */
export function parseSampleSeries(value: unknown): Array<[number, number | null]> {
  const rows = list(value);
  if (rows === undefined) {
    return [];
  }
  const samples: Array<[number, number | null]> = [];
  for (const row of rows) {
    const cells = list(row);
    if (cells === undefined) {
      continue;
    }
    const timestamp = num(cells[0]);
    if (timestamp === undefined) {
      continue;
    }
    // Body battery rows are [timestamp, status, level, version]; HR rows are
    // [timestamp, value]. Take the last numeric cell that is not the timestamp.
    let reading: number | undefined;
    for (let index = cells.length - 1; index >= 1; index--) {
      const candidate = num(cells[index]);
      if (candidate !== undefined) {
        reading = candidate;
        break;
      }
    }
    samples.push([timestamp, reading ?? null]);
  }
  return samples;
}
