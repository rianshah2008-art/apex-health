"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  Activity,
  BarChart3,
  Battery,
  Clock,
  Gauge,
  Moon,
  Target,
  TrendingUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyStateBanner } from "@/components/EmptyStateBanner";
import { MetricCard } from "@/components/MetricCard";
import { MetricCardSkeletonGrid } from "@/components/MetricCardSkeleton";
import { PageHeader } from "@/components/PageHeader";
import {
  BodyBatteryBar,
  SleepCompositionBar,
} from "@/components/SegmentedBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SyncGarminButton } from "@/components/SyncGarminButton";
import {
  TrendDrilldown,
  TrendSeriesConfig,
} from "@/components/TrendDrilldown";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatHoursMinutes, formatNumber } from "@/lib/format";

type DrilldownId =
  | "trainingReadiness"
  | "bodyBatteryCurrent"
  | "hrvMsAvg"
  | "sleepScore"
  | "recoveryTimeHours"
  | "acuteLoad"
  | "chronicLoad"
  | "loadRatio";

const DRILLDOWN: Record<
  DrilldownId,
  { title: string; series: TrendSeriesConfig[] }
> = {
  trainingReadiness: {
    title: "Training Readiness",
    series: [
      {
        dataKey: "trainingReadiness",
        label: "Readiness",
        color: "#34d399",
        format: (value) => `${formatNumber(value)} / 100`,
      },
    ],
  },
  bodyBatteryCurrent: {
    title: "Body Battery",
    series: [
      {
        dataKey: "bodyBatteryCurrent",
        label: "Body battery",
        color: "#22d3ee",
        format: (value) => `${formatNumber(value)} / 100`,
      },
    ],
  },
  hrvMsAvg: {
    title: "HRV Overnight Average",
    series: [
      {
        dataKey: "hrvMsAvg",
        label: "HRV",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)} ms`,
      },
    ],
  },
  sleepScore: {
    title: "Sleep Score",
    series: [
      {
        dataKey: "sleepScore",
        label: "Sleep score",
        color: "#a78bfa",
        format: (value) => `${formatNumber(value)} / 100`,
      },
    ],
  },
  recoveryTimeHours: {
    title: "Recovery Time",
    series: [
      {
        dataKey: "recoveryTimeHours",
        label: "Hours to recover",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)} h`,
      },
    ],
  },
  acuteLoad: {
    title: "Acute Load",
    series: [
      {
        dataKey: "acuteLoad",
        label: "7-day strain",
        color: "#38bdf8",
      },
    ],
  },
  chronicLoad: {
    title: "Chronic Load",
    series: [
      {
        dataKey: "chronicLoad",
        label: "28-day baseline",
        color: "#38bdf8",
      },
    ],
  },
  loadRatio: {
    title: "Load Ratio",
    series: [
      {
        dataKey: "loadRatio",
        label: "Acute ÷ chronic",
        color: "#34d399",
        format: (value) => formatNumber(value, 2),
        decimalPlaces: 2,
      },
    ],
  },
};

function loadRatioInRange(ratio: number | undefined): boolean {
  return ratio !== undefined && ratio >= 0.8 && ratio <= 1.3;
}

function sleepValue(
  score: number | undefined,
  durationMin: number | undefined,
): string {
  if (score === undefined && durationMin === undefined) {
    return "—";
  }
  const scorePart = score !== undefined ? formatNumber(score) : "—";
  const durationPart = formatHoursMinutes(durationMin);
  return `${scorePart} · ${durationPart}`;
}

export default function RecoveryPage() {
  const date = todayKey();
  const day = useQuery(api.recovery.getDay, { date });
  const [drilldown, setDrilldown] = useState<DrilldownId | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const range = useQuery(
    api.recovery.getRange,
    drilldown !== null ? { endDate: date, days: trendDays } : "skip",
  );

  const loading = day === undefined;
  const empty = day === null;
  const activeDrilldown = drilldown !== null ? DRILLDOWN[drilldown] : null;

  function openDrilldown(id: DrilldownId) {
    setTrendDays(7);
    setDrilldown(id);
  }

  const hrvWarning =
    day?.hrvStatus !== undefined && day.hrvStatus !== "Balanced";

  return (
    <>
      <PageHeader
        title="Recovery & Readiness"
        subtitle={`Athletic strain, sleep architecture, training load & nervous system recovery · ${formatLongDate(date)}`}
        action={<SyncGarminButton date={date} />}
      />

      {!loading && empty && (
        <EmptyStateBanner
          message="No recovery data logged for today yet."
          action={{ label: "Enter data manually", href: "/dashboard/manual-entry" }}
        />
      )}

      {loading ? (
        <>
          <MetricCardSkeletonGrid count={6} />
          <h2 className="mt-10 mb-4 text-sm font-semibold tracking-widest text-slate-400 uppercase">
            Training Load
          </h2>
          <MetricCardSkeletonGrid count={3} />
        </>
      ) : (
        <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Training Readiness"
          value={formatNumber(day?.trainingReadiness)}
          icon={<Gauge className="text-apex-green h-5 w-5" />}
          subtext="overall readiness (0-100)"
          progress={
            day?.trainingReadiness === undefined
              ? undefined
              : {
                  value: day.trainingReadiness,
                  max: 100,
                  color: "#34d399",
                }
          }
          empty={day?.trainingReadiness === undefined}
          selected={drilldown === "trainingReadiness"}
          onClick={() => openDrilldown("trainingReadiness")}
        />

        <MetricCard
          label="Training Status"
          value={day?.trainingStatus ?? "—"}
          icon={<Target className="text-apex-cyan h-5 w-5" />}
          subtext="current trajectory"
          empty={day?.trainingStatus === undefined}
        >
          {day?.trainingStatus !== undefined && (
            <StatusBadge status={day.trainingStatus} />
          )}
        </MetricCard>

        <MetricCard
          label="Body Battery"
          value={formatNumber(day?.bodyBatteryCurrent)}
          icon={<Battery className="text-apex-cyan h-5 w-5" />}
          subtext="energy fuel gauge"
          empty={day?.bodyBatteryCurrent === undefined}
          selected={drilldown === "bodyBatteryCurrent"}
          onClick={() => openDrilldown("bodyBatteryCurrent")}
        >
          {day?.bodyBatteryTimeline !== undefined && (
            <BodyBatteryBar timeline={day.bodyBatteryTimeline} />
          )}
        </MetricCard>

        <MetricCard
          label="HRV Status"
          value={day?.hrvStatus ?? "—"}
          icon={<Activity className="text-apex-cyan h-5 w-5" />}
          subtext={`${formatNumber(day?.hrvMsAvg)} ms overnight avg`}
          empty={
            day?.hrvStatus === undefined && day?.hrvMsAvg === undefined
          }
          selected={drilldown === "hrvMsAvg"}
          onClick={() => openDrilldown("hrvMsAvg")}
        >
          {day?.hrvStatus !== undefined && (
            <StatusBadge status={day.hrvStatus} warning={hrvWarning} />
          )}
        </MetricCard>

        <MetricCard
          label="Sleep Score & Duration"
          value={sleepValue(day?.sleepScore, day?.sleepDurationMin)}
          icon={<Moon className="text-apex-purple h-5 w-5" />}
          subtext="nightly sleep quality"
          empty={
            day?.sleepScore === undefined &&
            day?.sleepDurationMin === undefined
          }
          selected={drilldown === "sleepScore"}
          onClick={() => openDrilldown("sleepScore")}
        >
          {day?.sleepDeepMin !== undefined &&
            day?.sleepRemMin !== undefined &&
            day?.sleepLightMin !== undefined && (
              <SleepCompositionBar
                deepMin={day.sleepDeepMin}
                remMin={day.sleepRemMin}
                lightMin={day.sleepLightMin}
              />
            )}
        </MetricCard>

        <MetricCard
          label="Recovery Time"
          value={formatNumber(day?.recoveryTimeHours)}
          unit={day?.recoveryTimeHours === undefined ? undefined : "h"}
          icon={<Clock className="text-apex-cyan h-5 w-5" />}
          subtext="hours until full recovery"
          empty={day?.recoveryTimeHours === undefined}
          selected={drilldown === "recoveryTimeHours"}
          onClick={() => openDrilldown("recoveryTimeHours")}
        />
      </div>

      <h2 className="mt-10 mb-4 text-sm font-semibold tracking-widest text-slate-400 uppercase">
        Training Load
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Acute Load"
          value={formatNumber(day?.acuteLoad)}
          icon={<TrendingUp className="text-apex-cyan h-5 w-5" />}
          subtext="7-day training strain"
          empty={day?.acuteLoad === undefined}
          selected={drilldown === "acuteLoad"}
          onClick={() => openDrilldown("acuteLoad")}
        />

        <MetricCard
          label="Chronic Load"
          value={formatNumber(day?.chronicLoad)}
          icon={<BarChart3 className="text-apex-cyan h-5 w-5" />}
          subtext="28-day fitness baseline"
          empty={day?.chronicLoad === undefined}
          selected={drilldown === "chronicLoad"}
          onClick={() => openDrilldown("chronicLoad")}
        />

        <MetricCard
          label="Load Ratio"
          value={
            <span
              className={
                loadRatioInRange(day?.loadRatio)
                  ? "text-apex-green"
                  : day?.loadRatio !== undefined
                    ? "text-apex-amber"
                    : undefined
              }
            >
              {formatNumber(day?.loadRatio, 2)}
            </span>
          }
          icon={<Gauge className="text-apex-cyan h-5 w-5" />}
          subtext="acute ÷ chronic (0.8–1.3 ideal)"
          empty={day?.loadRatio === undefined}
          selected={drilldown === "loadRatio"}
          onClick={() => openDrilldown("loadRatio")}
        />
      </div>
        </>
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
