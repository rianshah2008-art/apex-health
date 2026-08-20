"use client";

import { ReactNode } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { ProgressBar } from "@/components/ProgressBar";

export type MetricCardProps = {
  label: string;
  value: ReactNode;
  /** Small unit sitting next to the value, e.g. "bpm". */
  unit?: string;
  subtext?: string;
  icon: ReactNode;
  progress?: { value: number; max: number; color?: string; label?: string };
  sparkline?: number[];
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  empty?: boolean;
};

/**
 * One metric, one card. Used on every dashboard section so the grid stays
 * visually consistent even when a card has a sparkline, a progress bar, or
 * a custom footer (sleep legend, body-battery timeline).
 */
export function MetricCard({
  label,
  value,
  unit,
  subtext,
  icon,
  progress,
  sparkline,
  selected = false,
  onClick,
  children,
  empty = false,
}: MetricCardProps) {
  const interactive = onClick !== undefined;

  const body = (
    <>
      <span className="border-apex-border absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg border bg-[#0a0e1a]">
        {icon}
      </span>

      <p className="pr-12 text-xs tracking-wide text-slate-400 uppercase">
        {label}
      </p>

      {empty ? (
        <p className="mt-3 text-2xl font-bold text-slate-600">—</p>
      ) : (
        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          {value}
          {unit !== undefined && (
            <span className="ml-1 text-base font-medium text-slate-500">
              {unit}
            </span>
          )}
        </p>
      )}

      {subtext !== undefined && (
        <p className="mt-1 text-sm text-slate-500">{subtext}</p>
      )}

      {sparkline !== undefined && sparkline.length > 1 && (
        <div className="mt-4 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sparkline.map((y, index) => ({ i: index, y }))}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            >
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line
                type="monotone"
                dataKey="y"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {progress !== undefined && (
        <div className="mt-4">
          <ProgressBar
            value={progress.value}
            max={progress.max}
            color={progress.color}
            label={progress.label}
          />
        </div>
      )}

      {children !== undefined && <div className="mt-4">{children}</div>}
    </>
  );

  const className = `border-apex-border bg-apex-card relative w-full rounded-2xl border p-6 text-left transition-colors ${
    selected
      ? "border-apex-cyan"
      : interactive
        ? "hover:border-apex-cyan/50"
        : ""
  }`;

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
