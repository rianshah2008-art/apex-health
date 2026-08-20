"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  Activity,
  Flame,
  Footprints,
  Heart,
  Wind,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyStateBanner } from "@/components/EmptyStateBanner";
import { MetricCard } from "@/components/MetricCard";
import { MetricCardSkeletonGrid } from "@/components/MetricCardSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { SyncGarminButton } from "@/components/SyncGarminButton";
import {
  TrendDrilldown,
  TrendSeriesConfig,
} from "@/components/TrendDrilldown";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

type DrilldownId =
  | "steps"
  | "restingHeartRate"
  | "calories"
  | "pulseOxOvernight"
  | "respirationRate"
  | "stressLevelAvg";

const DRILLDOWN: Record<
  DrilldownId,
  { title: string; series: TrendSeriesConfig[] }
> = {
  steps: {
    title: "Daily Steps",
    series: [{ dataKey: "steps", label: "Steps", color: "#38bdf8" }],
  },
  restingHeartRate: {
    title: "Resting Heart Rate",
    series: [
      {
        dataKey: "restingHeartRate",
        label: "Resting HR",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)} bpm`,
      },
    ],
  },
  calories: {
    title: "Active & Total Calories",
    series: [
      {
        dataKey: "activeCalories",
        label: "Active kcal",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)} kcal`,
      },
      {
        dataKey: "totalCalories",
        label: "Total kcal",
        color: "#f59e0b",
        format: (value) => `${formatNumber(value)} kcal`,
      },
    ],
  },
  pulseOxOvernight: {
    title: "Pulse Ox (SpO2)",
    series: [
      {
        dataKey: "pulseOxOvernight",
        label: "Overnight SpO2",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)}%`,
      },
    ],
  },
  respirationRate: {
    title: "Respiration Rate",
    series: [
      {
        dataKey: "respirationRate",
        label: "Breaths/min",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value, 1)} bpm`,
        decimalPlaces: 1,
      },
    ],
  },
  stressLevelAvg: {
    title: "Stress Level",
    series: [
      {
        dataKey: "stressLevelAvg",
        label: "Daily average",
        color: "#f59e0b",
        format: (value) => `${formatNumber(value)} / 100`,
      },
    ],
  },
};

function stepProgressLabel(steps: number | undefined, goal: number): string {
  if (steps === undefined) {
    return `${formatNumber(goal)} step goal`;
  }
  const pct = Math.round((steps / goal) * 100);
  return `${pct}% of ${formatNumber(goal)} goal`;
}

export default function VitalsPage() {
  const date = todayKey();
  const day = useQuery(api.vitals.getDay, { date });
  const [drilldown, setDrilldown] = useState<DrilldownId | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const range = useQuery(
    api.vitals.getRange,
    drilldown !== null ? { endDate: date, days: trendDays } : "skip",
  );

  const loading = day === undefined;
  const empty = day === null;
  const stepGoal = day?.stepGoal ?? 10_000;
  const activeDrilldown = drilldown !== null ? DRILLDOWN[drilldown] : null;

  function openDrilldown(id: DrilldownId) {
    setTrendDays(7);
    setDrilldown(id);
  }

  return (
    <>
      <PageHeader
        title="Apex Connect: Daily Vitals"
        subtitle={formatLongDate(date)}
        action={<SyncGarminButton date={date} />}
      />

      {!loading && empty && (
        <EmptyStateBanner
          message="No vitals logged for today yet."
          action={{ label: "Enter data manually", href: "/dashboard/manual-entry" }}
        />
      )}

      {loading ? (
        <MetricCardSkeletonGrid count={6} />
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Daily Steps"
          value={formatNumber(day?.steps)}
          icon={<Footprints className="text-apex-cyan h-5 w-5" />}
          subtext={stepProgressLabel(day?.steps, stepGoal)}
          progress={
            day?.steps === undefined
              ? undefined
              : {
                  value: day.steps,
                  max: stepGoal,
                  color: "#38bdf8",
                }
          }
          empty={day?.steps === undefined}
          selected={drilldown === "steps"}
          onClick={() => openDrilldown("steps")}
        />

        <MetricCard
          label="Resting Heart Rate"
          value={formatNumber(day?.restingHeartRate)}
          unit={day?.restingHeartRate === undefined ? undefined : "bpm"}
          icon={<Heart className="text-apex-cyan h-5 w-5" />}
          subtext="bpm · 24hr trend"
          sparkline={day?.hrTrend}
          empty={day?.restingHeartRate === undefined}
          selected={drilldown === "restingHeartRate"}
          onClick={() => openDrilldown("restingHeartRate")}
        />

        <MetricCard
          label="Active & Total Calories"
          value={
            day?.activeCalories !== undefined ||
            day?.totalCalories !== undefined
              ? `${formatNumber(day?.activeCalories)} / ${formatNumber(day?.totalCalories)}`
              : "—"
          }
          icon={<Flame className="text-apex-amber h-5 w-5" />}
          subtext="active / total kcal"
          empty={
            day?.activeCalories === undefined &&
            day?.totalCalories === undefined
          }
          selected={drilldown === "calories"}
          onClick={() => openDrilldown("calories")}
        />

        <MetricCard
          label="Pulse Ox (SpO2)"
          value={formatNumber(day?.pulseOxOvernight)}
          unit={day?.pulseOxOvernight === undefined ? undefined : "%"}
          icon={<Activity className="text-apex-cyan h-5 w-5" />}
          subtext="overnight average"
          empty={day?.pulseOxOvernight === undefined}
          selected={drilldown === "pulseOxOvernight"}
          onClick={() => openDrilldown("pulseOxOvernight")}
        />

        <MetricCard
          label="Respiration Rate"
          value={formatNumber(day?.respirationRate, 1)}
          icon={<Wind className="text-apex-cyan h-5 w-5" />}
          subtext="breaths per minute"
          empty={day?.respirationRate === undefined}
          selected={drilldown === "respirationRate"}
          onClick={() => openDrilldown("respirationRate")}
        />

        <MetricCard
          label="Stress Level"
          value={formatNumber(day?.stressLevelAvg)}
          icon={<Zap className="text-apex-amber h-5 w-5" />}
          subtext="daily average (0-100)"
          progress={
            day?.stressLevelAvg === undefined
              ? undefined
              : {
                  value: day.stressLevelAvg,
                  max: 100,
                  color: "#f59e0b",
                }
          }
          empty={day?.stressLevelAvg === undefined}
          selected={drilldown === "stressLevelAvg"}
          onClick={() => openDrilldown("stressLevelAvg")}
        />
      </div>
      )}

      {activeDrilldown !== null && (
        <TrendDrilldown
          open={drilldown !== null}
          onClose={() => setDrilldown(null)}
          title={activeDrilldown.title}
          endDate={date}
          series={activeDrilldown.series}
          range={range}
          days={trendDays}
          onDaysChange={setTrendDays}
        />
      )}
    </>
  );
}
