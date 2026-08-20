"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/PageHeader";
import {
  FieldSpec,
  FieldValues,
  MetricEntryForm,
} from "@/components/manual/MetricEntryForm";
import { ActivityEntryForm } from "@/components/manual/ActivityEntryForm";
import { formatLongDate, todayKey } from "@/lib/dates";

// Defined at module scope so the form's seeding effect is not re-triggered on
// every parent render.
const VITALS_FIELDS: FieldSpec[] = [
  { name: "steps", label: "Daily steps", min: 0 },
  { name: "stepGoal", label: "Step goal", min: 0 },
  { name: "restingHeartRate", label: "Resting HR", unit: "bpm", min: 0, max: 250 },
  { name: "activeCalories", label: "Active calories", unit: "kcal", min: 0 },
  { name: "totalCalories", label: "Total calories", unit: "kcal", min: 0 },
  {
    name: "pulseOxOvernight",
    label: "Pulse Ox",
    unit: "%",
    min: 0,
    max: 100,
    hint: "Overnight average SpO2",
  },
  {
    name: "respirationRate",
    label: "Respiration",
    unit: "brpm",
    min: 0,
    hint: "Breaths per minute",
  },
  {
    name: "stressLevelAvg",
    label: "Stress level",
    min: 0,
    max: 100,
    hint: "Daily average, 0-100",
  },
];

const RECOVERY_FIELDS: FieldSpec[] = [
  { name: "trainingReadiness", label: "Training readiness", min: 0, max: 100 },
  {
    name: "trainingStatus",
    label: "Training status",
    kind: "select",
    options: [
      "Productive",
      "Maintaining",
      "Peaking",
      "Unproductive",
      "Overreaching",
      "Detraining",
      "Recovery",
      "No Status",
    ],
  },
  { name: "bodyBatteryCurrent", label: "Body battery", min: 0, max: 100 },
  {
    name: "hrvStatus",
    label: "HRV status",
    kind: "select",
    options: ["Balanced", "Unbalanced", "Low"],
  },
  { name: "hrvMsAvg", label: "HRV overnight avg", unit: "ms", min: 0 },
  { name: "sleepScore", label: "Sleep score", min: 0, max: 100 },
  { name: "sleepDurationMin", label: "Sleep duration", unit: "min", min: 0 },
  { name: "sleepDeepMin", label: "Deep sleep", unit: "min", min: 0 },
  { name: "sleepRemMin", label: "REM sleep", unit: "min", min: 0 },
  { name: "sleepLightMin", label: "Light sleep", unit: "min", min: 0 },
  { name: "recoveryTimeHours", label: "Recovery time", unit: "hours", min: 0 },
  { name: "acuteLoad", label: "Acute load", min: 0, hint: "7-day training strain" },
  {
    name: "chronicLoad",
    label: "Chronic load",
    min: 0,
    hint: "28-day fitness baseline",
  },
  {
    name: "loadRatio",
    label: "Load ratio",
    min: 0,
    hint: "Left blank, this is derived from acute ÷ chronic",
  },
];

const TRAINING_FIELDS: FieldSpec[] = [
  {
    name: "runningMileTimeSec",
    label: "Running mile time",
    kind: "pace",
    hint: "min / mile",
  },
  {
    name: "bikingMileTimeSec",
    label: "Biking mile time",
    kind: "pace",
    hint: "min / mile",
  },
  {
    name: "swimming100mPaceSec",
    label: "Swimming pace",
    kind: "pace",
    hint: "min / 100m",
  },
  {
    name: "lactateThresholdHr",
    label: "Lactate threshold HR",
    unit: "bpm",
    min: 0,
    max: 250,
  },
  {
    name: "lactateThresholdPaceSec",
    label: "Lactate threshold pace",
    kind: "pace",
    hint: "min / mile at LT — not synced from Garmin",
  },
  { name: "cyclingFtp", label: "Cycling FTP", unit: "watts", min: 0 },
  {
    name: "heatAcclimationPct",
    label: "Heat acclimation",
    unit: "%",
    min: 0,
    max: 100,
  },
  {
    name: "altitudeAcclimationM",
    label: "Altitude acclimation",
    unit: "m",
    min: 0,
  },
];

function FormSkeleton() {
  return (
    <div className="border-apex-border bg-apex-card animate-pulse rounded-2xl border p-6">
      <div className="h-4 w-40 rounded bg-white/5" />
      <div className="mt-3 h-3 w-72 rounded bg-white/5" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 rounded-lg bg-white/5" />
        ))}
      </div>
    </div>
  );
}

export default function ManualEntryPage() {
  const [date, setDate] = useState(todayKey());

  const vitals = useQuery(api.vitals.getDay, { date });
  const recovery = useQuery(api.recovery.getDay, { date });
  const training = useQuery(api.training.getDay, { date });

  const saveVitals = useMutation(api.vitals.saveManual);
  const saveRecovery = useMutation(api.recovery.saveManual);
  const saveTraining = useMutation(api.training.saveManual);

  return (
    <>
      <PageHeader
        title="Manual Entry"
        subtitle={`Fallback for any metric Garmin cannot supply · ${formatLongDate(date)}`}
        action={
          <label className="block">
            <span className="text-xs tracking-wide text-slate-400 uppercase">
              Date
            </span>
            <input
              type="date"
              value={date}
              max={todayKey()}
              onChange={(event) => {
                if (event.target.value !== "") {
                  setDate(event.target.value);
                }
              }}
              className="border-apex-border focus:border-apex-cyan mt-2 w-full rounded-lg border bg-[#0a0e1a] px-3 py-2 text-slate-100 outline-none"
            />
          </label>
        }
      />

      <div className="space-y-5">
        {vitals === undefined ? (
          <FormSkeleton />
        ) : (
          <MetricEntryForm
            key={`vitals-${date}`}
            title="Daily Vitals"
            description="Steps, heart rate, calories, pulse ox, respiration and stress."
            fields={VITALS_FIELDS}
            initialValues={vitals ?? {}}
            onSubmit={(values: FieldValues) => saveVitals({ date, ...values })}
          />
        )}

        {recovery === undefined ? (
          <FormSkeleton />
        ) : (
          <MetricEntryForm
            key={`recovery-${date}`}
            title="Recovery & Readiness"
            description="Readiness, body battery, HRV, sleep architecture and training load."
            fields={RECOVERY_FIELDS}
            initialValues={recovery ?? {}}
            onSubmit={(values: FieldValues) => saveRecovery({ date, ...values })}
          />
        )}

        {training === undefined ? (
          <FormSkeleton />
        ) : (
          <MetricEntryForm
            key={`training-${date}`}
            title="Training Performance"
            description="Pace, physiological thresholds and environmental acclimation."
            fields={TRAINING_FIELDS}
            initialValues={training ?? {}}
            onSubmit={(values: FieldValues) => saveTraining({ date, ...values })}
          />
        )}

        <ActivityEntryForm key={`activity-${date}`} date={date} />
      </div>
    </>
  );
}
