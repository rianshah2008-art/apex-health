"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Calendar, Target } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PlanPhaseBadge } from "@/components/PlanPhaseBadge";
import { currentPlanWeek, daysUntilEvent } from "@/lib/trainingPlan";
import { todayKey } from "@/lib/dates";

export function TrainingPlanHomeCard() {
  const event = useQuery(api.trainingPlanStore.getActiveEvent);
  const plan = useQuery(api.trainingPlanStore.getActivePlan);
  const loading = event === undefined || plan === undefined;

  const today = todayKey();
  const currentWeek =
    plan !== null && plan !== undefined
      ? currentPlanWeek(plan.weeks, today)
      : null;
  const daysLeft =
    event !== null && event !== undefined
      ? daysUntilEvent(event.eventDate, today)
      : null;

  return (
    <Link
      href="/dashboard/training/plan"
      className="border-apex-border bg-apex-card hover:border-apex-cyan/60 rounded-2xl border p-6 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-100">Training Plan</h2>
          {loading ? (
            <p className="mt-1 text-sm text-slate-500">Loading…</p>
          ) : event === null ? (
            <p className="mt-1 text-sm text-slate-500">
              Set a target race and generate a periodized plan from your Garmin
              fitness data.
            </p>
          ) : plan === null ? (
            <>
              <p className="mt-1 truncate text-sm text-slate-400">
                {event.name}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Plan not generated yet — tap to build one.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 truncate text-sm text-slate-400">
                {event.name}
              </p>
              <p className="text-apex-cyan mt-2 text-base font-semibold">
                {daysLeft !== null && daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} until race`
                  : daysLeft === 0
                    ? "Race day!"
                    : "Event date passed"}
              </p>
              {currentWeek !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Current phase</span>
                  <PlanPhaseBadge phase={currentWeek.phase} />
                </div>
              )}
            </>
          )}
        </div>
        <span className="border-apex-border flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-[#0a0e1a]">
          {event !== null && event !== undefined && !loading ? (
            <Calendar className="text-apex-red h-4 w-4" />
          ) : (
            <Target className="text-apex-red h-4 w-4" />
          )}
        </span>
      </div>
    </Link>
  );
}
