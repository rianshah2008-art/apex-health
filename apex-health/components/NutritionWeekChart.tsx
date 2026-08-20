"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

export type NutritionWeekPoint = {
  date: string;
  caloriesConsumed: number | null;
  waterConsumedMl: number | null;
  calorieTarget: number | null;
  hydrationTargetMl: number | null;
};

export function NutritionWeekChart({
  data,
}: {
  data: NutritionWeekPoint[] | undefined;
}) {
  if (data === undefined) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading chart…
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    label: formatShortDate(point.date),
    caloriesConsumed: point.caloriesConsumed ?? 0,
    waterConsumedMl: point.waterConsumedMl ?? 0,
  }));

  const hasData = chartData.some(
    (point) => point.caloriesConsumed > 0 || point.waterConsumedMl > 0,
  );

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        No intake logged in the last 7 days yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
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
            yAxisId="calories"
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <YAxis
            yAxisId="water"
            orientation="right"
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(value: number) => formatNumber(value)}
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
              if (name === "Calories") {
                return [`${formatNumber(value)} kcal`, name];
              }
              return [`${formatNumber(value)} mL`, name];
            }}
          />
          <Bar
            yAxisId="calories"
            dataKey="caloriesConsumed"
            name="Calories"
            fill="#38bdf8"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="water"
            type="monotone"
            dataKey="waterConsumedMl"
            name="Water"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 3, fill: "#22d3ee" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
