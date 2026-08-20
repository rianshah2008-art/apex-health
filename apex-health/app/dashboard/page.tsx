"use client";

import Link from "next/link";
import {
  BatteryCharging,
  Gauge,
  HeartPulse,
  PencilLine,
  UtensilsCrossed,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SyncGarminButton } from "@/components/SyncGarminButton";
import { TrainingPlanHomeCard } from "@/components/TrainingPlanHomeCard";
import { formatLongDate, todayKey } from "@/lib/dates";

const SECTIONS = [
  {
    href: "/dashboard/vitals",
    title: "Daily Vitals",
    blurb: "Steps, resting HR, calories, SpO2, respiration, stress",
    icon: HeartPulse,
    color: "text-apex-cyan",
  },
  {
    href: "/dashboard/recovery",
    title: "Recovery & Readiness",
    blurb: "Readiness, body battery, HRV, sleep, training load",
    icon: BatteryCharging,
    color: "text-apex-green",
  },
  {
    href: "/dashboard/training",
    title: "Training Performance",
    blurb: "Pace, thresholds, heat & altitude acclimation",
    icon: Gauge,
    color: "text-apex-purple",
  },
  {
    href: "/dashboard/nutrition",
    title: "Weight, Hydration & Nutrition",
    blurb: "Weight log, hydration math, lean bulk targets, meal scanner",
    icon: UtensilsCrossed,
    color: "text-apex-amber",
  },
  {
    href: "/dashboard/manual-entry",
    title: "Manual Entry",
    blurb: "Log or correct any metric when Garmin sync is unavailable",
    icon: PencilLine,
    color: "text-slate-300",
  },
];

export default function DashboardPage() {
  const date = todayKey();

  return (
    <>
      <PageHeader
        title="Apex Health"
        subtitle={formatLongDate(date)}
        action={<SyncGarminButton date={date} />}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TrainingPlanHomeCard />
        {SECTIONS.map(({ href, title, blurb, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="border-apex-border bg-apex-card hover:border-apex-cyan/60 rounded-2xl border p-6 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{blurb}</p>
              </div>
              <span className="border-apex-border flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-[#0a0e1a]">
                <Icon className={`h-4 w-4 ${color}`} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
