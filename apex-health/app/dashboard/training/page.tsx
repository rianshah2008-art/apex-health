"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import {
  Bike,
  Footprints,
  Heart,
  Mountain,
  Sun,
  Timer,
  Waves,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  ActivityListDrilldown,
  ActivityType,
} from "@/components/ActivityList";
import { MetricCard } from "@/components/MetricCard";
import { EmptyStateBanner } from "@/components/EmptyStateBanner";
import { MetricCardSkeletonGrid } from "@/components/MetricCardSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { SyncGarminButton } from "@/components/SyncGarminButton";
import {
  TrendDrilldown,
  TrendSeriesConfig,
} from "@/components/TrendDrilldown";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatNumber, formatPace } from "@/lib/format";

type TrendDrilldownId =
  | "lactateThresholdHr"
  | "lactateThresholdPaceSec"
  | "cyclingFtp"
  | "heatAcclimationPct"
  | "altitudeAcclimationM";

type ActivityDrilldownId = "run" | "bike" | "swim";

const TREND_DRILLDOWN: Record<
  TrendDrilldownId,
  { title: string; series: TrendSeriesConfig[] }
> = {
  lactateThresholdHr: {
    title: "Lactate Threshold HR",
    series: [
      {
        dataKey: "lactateThresholdHr",
        label: "LT heart rate",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)} bpm`,
      },
    ],
  },
  lactateThresholdPaceSec: {
    title: "Lactate Threshold Pace",
    series: [
      {
        dataKey: "lactateThresholdPaceSec",
        label: "LT pace",
        color: "#38bdf8",
        format: (value) => `${formatPace(value)} /mi`,
      },
    ],
  },
  cyclingFtp: {
    title: "Cycling FTP",
    series: [
      {
        dataKey: "cyclingFtp",
        label: "Functional threshold power",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)} W`,
      },
    ],
  },
  heatAcclimationPct: {
    title: "Heat Acclimation",
    series: [
      {
        dataKey: "heatAcclimationPct",
        label: "Heat adaptation",
        color: "#f59e0b",
        format: (value) => `${formatNumber(value)}%`,
      },
    ],
  },
  altitudeAcclimationM: {
    title: "Altitude Acclimation",
    series: [
      {
        dataKey: "altitudeAcclimationM",
        label: "Adapted elevation",
        color: "#38bdf8",
        format: (value) => `${formatNumber(value)} m`,
      },
    ],
  },
};

const ACTIVITY_DRILLDOWN: Record<
  ActivityDrilldownId,
  { title: string; type: ActivityType }
> = {
  run: { title: "Running Mile Time", type: "run" },
  bike: { title: "Biking Mile Time", type: "bike" },
  swim: { title: "Swimming Pace", type: "swim" },
};

function SectionHeader({ children }: { children: string }) {
  return (
    <h2 className="mt-10 mb-4 text-sm font-semibold tracking-widest text-slate-400 uppercase first:mt-0">
      {children}
    </h2>
  );
}

export default function TrainingPage() {
  const date = todayKey();
  const day = useQuery(api.training.getDay, { date });
  const [trendDrilldown, setTrendDrilldown] =
    useState<TrendDrilldownId | null>(null);
  const [activityDrilldown, setActivityDrilldown] =
    useState<ActivityDrilldownId | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const range = useQuery(
    api.training.getRange,
    trendDrilldown !== null ? { endDate: date, days: trendDays } : "skip",
  );

  const loading = day === undefined;
  const empty = day === null;
  const activeTrend =
    trendDrilldown !== null ? TREND_DRILLDOWN[trendDrilldown] : null;
  const activeActivity =
    activityDrilldown !== null ? ACTIVITY_DRILLDOWN[activityDrilldown] : null;

  function openTrend(id: TrendDrilldownId) {
    setActivityDrilldown(null);
    setTrendDays(7);
    setTrendDrilldown(id);
  }

  function openActivities(id: ActivityDrilldownId) {
    setTrendDrilldown(null);
    setActivityDrilldown(id);
  }

  return (
    <>
      <PageHeader
        title="Training Performance"
        subtitle={`Pace, physiological thresholds & environmental acclimation · ${formatLongDate(date)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/training/plan"
              className="border-apex-border hover:border-apex-cyan/60 rounded-xl border px-3 py-2 text-sm text-slate-300 transition-colors"
            >
              Training plan
            </Link>
            <SyncGarminButton date={date} />
          </div>
        }
      />

      {!loading && empty && (
        <EmptyStateBanner
          message="No training performance data logged for today yet."
          action={{ label: "Enter data manually", href: "/dashboard/manual-entry" }}
        />
      )}

      {loading ? (
        <>
          <SectionHeader>Pace / Time</SectionHeader>
          <MetricCardSkeletonGrid count={3} />
          <SectionHeader>Thresholds</SectionHeader>
          <MetricCardSkeletonGrid count={3} />
          <SectionHeader>Environment</SectionHeader>
          <MetricCardSkeletonGrid count={2} />
        </>
      ) : (
        <>
      <SectionHeader>Pace / Time</SectionHeader>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Running Mile Time"
          value={loading ? "…" : formatPace(day?.runningMileTimeSec)}
          icon={<Footprints className="text-apex-cyan h-5 w-5" />}
          subtext="min / mile"
          empty={!loading && day?.runningMileTimeSec === undefined}
          selected={activityDrilldown === "run"}
          onClick={() => openActivities("run")}
        />

        <MetricCard
          label="Biking Mile Time"
          value={loading ? "…" : formatPace(day?.bikingMileTimeSec)}
          icon={<Bike className="text-apex-cyan h-5 w-5" />}
          subtext="min / mile"
          empty={!loading && day?.bikingMileTimeSec === undefined}
          selected={activityDrilldown === "bike"}
          onClick={() => openActivities("bike")}
        />

        <MetricCard
          label="Swimming Pace"
          value={loading ? "…" : formatPace(day?.swimming100mPaceSec)}
          icon={<Waves className="text-apex-cyan h-5 w-5" />}
          subtext="min / 100m"
          empty={!loading && day?.swimming100mPaceSec === undefined}
          selected={activityDrilldown === "swim"}
          onClick={() => openActivities("swim")}
        />
      </div>

      <SectionHeader>Thresholds</SectionHeader>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Lactate Threshold HR"
          value={loading ? "…" : formatNumber(day?.lactateThresholdHr)}
          unit={
            loading || day?.lactateThresholdHr === undefined ? undefined : "bpm"
          }
          icon={<Heart className="text-apex-cyan h-5 w-5" />}
          subtext="bpm at LT"
          empty={!loading && day?.lactateThresholdHr === undefined}
          selected={trendDrilldown === "lactateThresholdHr"}
          onClick={() => openTrend("lactateThresholdHr")}
        />

        <MetricCard
          label="Lactate Threshold Pace"
          value={loading ? "…" : formatPace(day?.lactateThresholdPaceSec)}
          icon={<Timer className="text-apex-cyan h-5 w-5" />}
          subtext="min / mile at LT"
          empty={!loading && day?.lactateThresholdPaceSec === undefined}
          selected={trendDrilldown === "lactateThresholdPaceSec"}
          onClick={() => openTrend("lactateThresholdPaceSec")}
        />

        <MetricCard
          label="Cycling FTP"
          value={loading ? "…" : formatNumber(day?.cyclingFtp)}
          unit={loading || day?.cyclingFtp === undefined ? undefined : "W"}
          icon={<Zap className="text-apex-cyan h-5 w-5" />}
          subtext="functional threshold power"
          empty={!loading && day?.cyclingFtp === undefined}
          selected={trendDrilldown === "cyclingFtp"}
          onClick={() => openTrend("cyclingFtp")}
        />
      </div>

      <SectionHeader>Environment</SectionHeader>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Heat Acclimation"
          value={loading ? "…" : formatNumber(day?.heatAcclimationPct)}
          unit={loading || day?.heatAcclimationPct === undefined ? undefined : "%"}
          icon={<Sun className="text-apex-amber h-5 w-5" />}
          subtext="adaptation to heat stress"
          progress={
            loading || day?.heatAcclimationPct === undefined
              ? undefined
              : {
                  value: day.heatAcclimationPct,
                  max: 100,
                  color: "#f59e0b",
                }
          }
          empty={!loading && day?.heatAcclimationPct === undefined}
          selected={trendDrilldown === "heatAcclimationPct"}
          onClick={() => openTrend("heatAcclimationPct")}
        />

        <MetricCard
          label="Altitude Acclimation"
          value={loading ? "…" : formatNumber(day?.altitudeAcclimationM)}
          unit={loading || day?.altitudeAcclimationM === undefined ? undefined : "m"}
          icon={<Mountain className="text-apex-cyan h-5 w-5" />}
          subtext="adapted elevation"
          empty={!loading && day?.altitudeAcclimationM === undefined}
          selected={trendDrilldown === "altitudeAcclimationM"}
          onClick={() => openTrend("altitudeAcclimationM")}
        />
      </div>
        </>
      )}

      {activeTrend !== null && (
        <TrendDrilldown
          open={trendDrilldown !== null}
          onClose={() => setTrendDrilldown(null)}
          title={activeTrend.title}
          endDate={date}
          series={activeTrend.series}
          range={range}
          days={trendDays}
          onDaysChange={setTrendDays}
        />
      )}

      {activeActivity !== null && (
        <ActivityListDrilldown
          open={activityDrilldown !== null}
          onClose={() => setActivityDrilldown(null)}
          title={activeActivity.title}
          type={activeActivity.type}
        />
      )}
    </>
  );
}
