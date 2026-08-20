"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import {
  formatDistance,
  formatDuration,
  formatNumber,
  formatPace,
  parsePaceToSeconds,
} from "@/lib/format";

const METERS_PER_MILE = 1609.344;

type ActivityType = "run" | "bike" | "swim";

const TYPES: Array<{ value: ActivityType; label: string }> = [
  { value: "run", label: "Run" },
  { value: "bike", label: "Bike" },
  { value: "swim", label: "Swim" },
];

const inputClass =
  "border-apex-border focus:border-apex-cyan mt-2 w-full rounded-lg border bg-[#0a0e1a] px-3 py-2 text-slate-100 outline-none";
const labelClass = "text-xs tracking-wide text-slate-400 uppercase";

export function ActivityEntryForm({ date }: { date: string }) {
  const toast = useToast();
  const logManual = useMutation(api.activities.logManual);
  const removeActivity = useMutation(api.activities.remove);

  const [type, setType] = useState<ActivityType>("run");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [calories, setCalories] = useState("");
  const [saving, setSaving] = useState(false);

  const recent = useQuery(api.activities.recentByType, { type, limit: 7 });

  // Swims are recorded in meters, runs and rides in miles.
  const distanceUnit = type === "swim" ? "meters" : "miles";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const durationSec = parsePaceToSeconds(duration);
    if (durationSec === undefined || durationSec <= 0) {
      toast({
        tone: "error",
        title: "Invalid duration",
        body: "Enter duration as M:SS or H:MM:SS.",
      });
      return;
    }

    const distanceValue = Number(distance);
    if (!Number.isFinite(distanceValue) || distanceValue < 0) {
      toast({ tone: "error", title: "Invalid distance" });
      return;
    }
    const distanceMeters =
      type === "swim" ? distanceValue : distanceValue * METERS_PER_MILE;

    setSaving(true);
    try {
      await logManual({
        type,
        date,
        durationSec,
        distanceMeters,
        avgHr: avgHr.trim() === "" ? undefined : Number(avgHr),
        calories: calories.trim() === "" ? undefined : Number(calories),
      });
      toast({ tone: "success", title: "Workout logged" });
      setDuration("");
      setDistance("");
      setAvgHr("");
      setCalories("");
    } catch (error) {
      toast({
        tone: "error",
        title: "Could not log workout",
        body: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-apex-border bg-apex-card rounded-2xl border p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-100">Workout</h2>
        <p className="mt-1 text-sm text-slate-500">
          Log a run, ride or swim by hand. Pace is calculated for you — per mile
          for runs and rides, per 100m for swims.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ActivityType)}
              className={inputClass}
            >
              {TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>
              Duration <span className="normal-case text-slate-500">(H:MM:SS)</span>
            </span>
            <input
              type="text"
              value={duration}
              placeholder="22:54"
              onChange={(event) => setDuration(event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>
              Distance{" "}
              <span className="normal-case text-slate-500">({distanceUnit})</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>
              Avg HR <span className="normal-case text-slate-500">(bpm)</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={avgHr}
              onChange={(event) => setAvgHr(event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>
              Calories <span className="normal-case text-slate-500">(kcal)</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-apex-cyan hover:bg-apex-cyan-bright mt-5 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[#04121f] transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Log workout
        </button>
      </form>

      <div className="border-apex-border mt-6 border-t pt-5">
        <h3 className="text-xs tracking-wide text-slate-400 uppercase">
          Last 7 {TYPES.find((option) => option.value === type)?.label.toLowerCase()}s
        </h3>
        {recent === undefined ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No activities of this type yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {recent.map((activity) => (
              <li
                key={activity._id}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="w-24 shrink-0 text-slate-400">
                  {activity.date}
                </span>
                <span className="flex-1 text-slate-300">
                  {formatDistance(activity.distanceMeters, activity.type)} ·{" "}
                  {formatDuration(activity.durationSec)} ·{" "}
                  {formatPace(activity.avgPaceSec)}
                  {activity.type === "swim" ? "/100m" : "/mi"}
                </span>
                <span className="hidden w-28 shrink-0 text-slate-500 sm:block">
                  {activity.avgHr === undefined
                    ? "—"
                    : `${formatNumber(activity.avgHr)} bpm`}
                </span>
                <button
                  type="button"
                  aria-label={`Delete activity on ${activity.date}`}
                  onClick={async () => {
                    try {
                      await removeActivity({
                        activityId: activity._id as Id<"activities">,
                      });
                    } catch {
                      toast({ tone: "error", title: "Could not delete activity" });
                    }
                  }}
                  className="shrink-0 text-slate-600 hover:text-apex-red"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
