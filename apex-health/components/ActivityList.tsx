"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { formatShortDate } from "@/lib/dates";
import {
  formatDistance,
  formatDuration,
  formatNumber,
  formatPace,
} from "@/lib/format";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export type ActivityType = "run" | "bike" | "swim";

const PACE_UNIT: Record<ActivityType, string> = {
  run: "/mi",
  bike: "/mi",
  swim: "/100m",
};

/** Last-N activity rows for the pace-card drill-down. */
export function ActivityList({
  type,
  limit = 7,
}: {
  type: ActivityType;
  limit?: number;
}) {
  const activities = useQuery(api.activities.recentByType, { type, limit });

  if (activities === undefined) {
    return <p className="text-sm text-slate-500">Loading activities…</p>;
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        <p>No activities of this type yet.</p>
        <Link
          href="/dashboard/manual-entry"
          className="text-apex-cyan hover:text-apex-cyan-bright mt-2 inline-block"
        >
          Log a workout manually
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-white/5 md:hidden">
        {activities.map((activity) => (
          <li key={activity._id} className="py-3 text-sm">
            <p className="font-medium text-slate-200">
              {formatShortDate(activity.date)}
            </p>
            <p className="mt-1 text-slate-400">
              {formatDistance(activity.distanceMeters, activity.type)} ·{" "}
              {formatDuration(activity.durationSec)} · {formatPace(activity.avgPaceSec)}
              {PACE_UNIT[activity.type]}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {activity.avgHr === undefined
                ? "— bpm"
                : `${formatNumber(activity.avgHr)} bpm`}
              {" · "}
              {activity.calories === undefined
                ? "— kcal"
                : `${formatNumber(activity.calories)} kcal`}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-apex-border border-b text-xs tracking-wide text-slate-500 uppercase">
            <th className="pb-2 pr-4 font-medium">Date</th>
            <th className="pb-2 pr-4 font-medium">Distance</th>
            <th className="pb-2 pr-4 font-medium">Duration</th>
            <th className="pb-2 pr-4 font-medium">Pace</th>
            <th className="pb-2 pr-4 font-medium">Avg HR</th>
            <th className="pb-2 font-medium">Calories</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {activities.map((activity) => (
            <tr key={activity._id} className="text-slate-300">
              <td className="py-2.5 pr-4 text-slate-400">
                {formatShortDate(activity.date)}
              </td>
              <td className="py-2.5 pr-4">
                {formatDistance(activity.distanceMeters, activity.type)}
              </td>
              <td className="py-2.5 pr-4">
                {formatDuration(activity.durationSec)}
              </td>
              <td className="py-2.5 pr-4">
                {formatPace(activity.avgPaceSec)}
                {PACE_UNIT[activity.type]}
              </td>
              <td className="py-2.5 pr-4">
                {activity.avgHr === undefined
                  ? "—"
                  : `${formatNumber(activity.avgHr)} bpm`}
              </td>
              <td className="py-2.5">
                {activity.calories === undefined
                  ? "—"
                  : formatNumber(activity.calories)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export function ActivityListDrilldown({
  open,
  onClose,
  title,
  type,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  type: ActivityType;
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
        className="border-apex-border bg-apex-card w-full max-w-3xl rounded-2xl border p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-list-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="activity-list-title"
              className="text-lg font-semibold tracking-wide text-slate-100 uppercase"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Last 7 activities</p>
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

        <ActivityList type={type} />
      </div>
    </div>
  );
}
