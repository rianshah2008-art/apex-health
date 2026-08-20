"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export type TrendPoint = {
  date: string;
  [key: string]: string | number | null;
};

export type TrendSeriesConfig = {
  dataKey: string;
  label: string;
  color: string;
  format?: (value: number) => string;
  decimalPlaces?: number;
};

export function TrendDrilldown({
  open,
  onClose,
  title,
  endDate,
  series,
  range,
  days,
  onDaysChange,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  endDate: string;
  series: TrendSeriesConfig[];
  range: TrendPoint[] | undefined;
  days: 7 | 30;
  onDaysChange: (days: 7 | 30) => void;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const chartData = useMemo(() => {
    if (range === undefined) {
      return [];
    }
    return range.map((point) => ({
      ...point,
      label: formatShortDate(point.date),
    }));
  }, [range]);

  const hasData = useMemo(() => {
    if (range === undefined) {
      return true;
    }
    return range.some((point) =>
      series.some((config) => {
        const value = point[config.dataKey];
        return typeof value === "number";
      }),
    );
  }, [range, series]);

  const defaultDecimals = series[0]?.decimalPlaces ?? 0;

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="border-apex-border bg-apex-card w-full max-w-2xl rounded-2xl border p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trend-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="trend-title"
              className="text-lg font-semibold tracking-wide text-slate-100 uppercase"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Last {days} days ending {formatShortDate(endDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-apex-border rounded-lg border p-2 text-slate-400 transition-colors hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-apex-border mb-6 inline-flex rounded-full border p-1">
          {([7, 30] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onDaysChange(option)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                days === option
                  ? "bg-apex-cyan text-[#04121f]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {option} days
            </button>
          ))}
        </div>

        {series.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-4">
            {series.map((config) => (
              <div
                key={config.dataKey}
                className="flex items-center gap-2 text-sm text-slate-400"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                {config.label}
              </div>
            ))}
          </div>
        )}

        <div className="h-64 w-full">
          {range === undefined ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Loading trend…
            </div>
          ) : !hasData ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <p>No data for this period.</p>
              <Link
                href="/dashboard/manual-entry"
                className="text-apex-cyan hover:text-apex-cyan-bright"
              >
                Enter data manually
              </Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(value: number) =>
                    formatNumber(value, defaultDecimals)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f1420",
                    border: "1px solid #1e293b",
                    borderRadius: "0.75rem",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value, name) => {
                    if (typeof value !== "number") {
                      return ["—", name];
                    }
                    const config = series.find((item) => item.label === name);
                    const formatted = config?.format
                      ? config.format(value)
                      : formatNumber(value, config?.decimalPlaces ?? 0);
                    return [formatted, name];
                  }}
                />
                {series.map((config) => (
                  <Line
                    key={config.dataKey}
                    type="monotone"
                    dataKey={config.dataKey}
                    name={config.label}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: config.color }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
