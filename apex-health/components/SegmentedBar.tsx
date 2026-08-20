"use client";

export type Segment = {
  value: number;
  color: string;
  label?: string;
};

/**
 * Two jobs: a 12-cell body-battery timeline (equal width, color by level) and a
 * 3-cell sleep composition bar (width proportional to minutes).
 */
export function SegmentedBar({
  segments,
  proportional = false,
  labels,
}: {
  segments: Segment[];
  /** When true, widths follow `value`; otherwise each cell is equal. */
  proportional?: boolean;
  labels?: string[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="w-full">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        {segments.map((segment, index) => {
          const width = proportional
            ? total <= 0
              ? 0
              : (segment.value / total) * 100
            : 100 / Math.max(segments.length, 1);
          return (
            <div
              key={`${segment.color}-${index}`}
              className="h-full"
              style={{ width: `${width}%`, backgroundColor: segment.color }}
              title={
                segment.label === undefined
                  ? undefined
                  : `${segment.label}: ${segment.value}`
              }
            />
          );
        })}
      </div>
      {labels !== undefined && labels.length > 0 && (
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const BODY_BATTERY_HIGH = "#22d3ee";
const BODY_BATTERY_MID = "#f59e0b";
const BODY_BATTERY_LOW = "#ef4444";

function bodyBatteryColor(level: number): string {
  if (level >= 67) return BODY_BATTERY_HIGH;
  if (level >= 34) return BODY_BATTERY_MID;
  return BODY_BATTERY_LOW;
}

/** 12 two-hour cells from 12am → 10pm, matching Garmin's body-battery card. */
export function BodyBatteryBar({
  timeline,
}: {
  timeline: number[];
}) {
  const cells = timeline.slice(0, 12);
  while (cells.length < 12) {
    cells.push(cells[cells.length - 1] ?? 0);
  }
  return (
    <SegmentedBar
      segments={cells.map((level) => ({
        value: 1,
        color: bodyBatteryColor(level),
        label: `${level}`,
      }))}
      labels={["12am", "6am", "12pm", "6pm"]}
    />
  );
}

const SLEEP_COLORS = {
  deep: "#6366f1",
  rem: "#a78bfa",
  light: "#64748b",
} as const;

export function SleepCompositionBar({
  deepMin,
  remMin,
  lightMin,
}: {
  deepMin: number;
  remMin: number;
  lightMin: number;
}) {
  return (
    <div className="w-full">
      <SegmentedBar
        proportional
        segments={[
          { value: deepMin, color: SLEEP_COLORS.deep, label: "Deep" },
          { value: remMin, color: SLEEP_COLORS.rem, label: "REM" },
          { value: lightMin, color: SLEEP_COLORS.light, label: "Light" },
        ]}
      />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: SLEEP_COLORS.deep }}
          />
          Deep {deepMin}m
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: SLEEP_COLORS.rem }}
          />
          REM {remMin}m
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: SLEEP_COLORS.light }}
          />
          Light {lightMin}m
        </span>
      </div>
    </div>
  );
}
