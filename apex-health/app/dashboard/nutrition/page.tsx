"use client";

import { ReactNode, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Droplets, Flame, Loader2, Scale, UtensilsCrossed } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyStateBanner } from "@/components/EmptyStateBanner";
import { MealScannerDropzone } from "@/components/MealScannerDropzone";
import { MetricCard } from "@/components/MetricCard";
import { MetricCardSkeleton } from "@/components/MetricCardSkeleton";
import { NutritionWeekChart } from "@/components/NutritionWeekChart";
import { PageHeader } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { SyncGarminButton } from "@/components/SyncGarminButton";
import { useToast } from "@/components/Toast";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

function NutritionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-apex-border bg-apex-card rounded-2xl border p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="border-apex-border flex h-9 w-9 items-center justify-center rounded-lg border bg-[#0a0e1a]">
          {icon}
        </span>
        <h3 className="text-xs tracking-wide text-slate-400 uppercase">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export default function NutritionPage() {
  const date = todayKey();
  const day = useQuery(api.nutrition.getDay, { date });
  const week = useQuery(api.nutrition.getWeek, { endDate: date });
  const user = useQuery(api.users.currentUser);
  const logWeight = useMutation(api.nutrition.logWeight);
  const addWater = useMutation(api.nutrition.addWater);
  const setTakingCreatine = useMutation(api.nutrition.setTakingCreatine);
  const toast = useToast();

  const [weightInput, setWeightInput] = useState<string | null>(null);
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [addingWater, setAddingWater] = useState<number | null>(null);
  const [togglingCreatine, setTogglingCreatine] = useState(false);

  const loading = day === undefined;
  const needsWeight = !loading && day === null;
  const takingCreatine = user?.takingCreatine ?? false;

  const displayWeight =
    weightInput ??
    (day?.weightLbsAtLog !== undefined
      ? String(day.weightLbsAtLog)
      : user?.weightLbs !== undefined
        ? String(user.weightLbs)
        : "");

  const remainingMl =
    day === null || day === undefined
      ? 0
      : Math.max(0, day.hydrationTargetMl - day.waterConsumedMl);

  async function handleLogWeight() {
    const weight = Number(displayWeight);
    if (!Number.isFinite(weight) || weight <= 0) {
      toast({
        tone: "error",
        title: "Invalid weight",
        body: "Enter a positive number in pounds.",
      });
      return;
    }

    setLoggingWeight(true);
    try {
      await logWeight({ date, weightLbs: weight });
      setWeightInput(null);
      toast({
        tone: "success",
        title: "Weight logged",
        body: "Today's hydration and nutrition targets were recalculated.",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "Could not log weight",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setLoggingWeight(false);
    }
  }

  async function handleAddWater(amountMl: number) {
    setAddingWater(amountMl);
    try {
      await addWater({ date, amountMl });
    } catch (error) {
      toast({
        tone: "error",
        title: "Could not add water",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setAddingWater(null);
    }
  }

  async function handleCreatineToggle(enabled: boolean) {
    setTogglingCreatine(true);
    try {
      await setTakingCreatine({ date, takingCreatine: enabled });
      toast({
        tone: "success",
        title: enabled ? "Creatine adjustment on" : "Creatine adjustment off",
        body: "Today's hydration target was recalculated.",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "Could not update creatine setting",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setTogglingCreatine(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Weight, Hydration & Nutrition"
        subtitle={`Lean bulk tracking · ${formatLongDate(date)}`}
        action={<SyncGarminButton date={date} />}
      />

      {!loading && needsWeight && (
        <EmptyStateBanner message="Log your weight below to unlock hydration and nutrition targets for today." />
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <NutritionCard
          title="Weight Logger"
          icon={<Scale className="text-apex-cyan h-5 w-5" />}
        >
          <label className="text-sm text-slate-400">
            Body weight
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min={1}
                step={0.1}
                value={displayWeight}
                onChange={(event) => setWeightInput(event.target.value)}
                placeholder="lbs"
                className="border-apex-border bg-apex-bg w-full rounded-lg border px-3 py-2 text-lg font-semibold text-slate-100"
              />
              <span className="shrink-0 text-sm text-slate-500">lbs</span>
            </div>
          </label>
          <button
            type="button"
            disabled={loggingWeight}
            onClick={() => void handleLogWeight()}
            className="bg-apex-cyan hover:bg-apex-cyan-bright mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[#04121f] disabled:opacity-60"
          >
            {loggingWeight && <Loader2 className="h-4 w-4 animate-spin" />}
            Log Weight
          </button>

          <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-apex-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Taking creatine</p>
              <p className="text-xs text-slate-500">
                Adds +750 mL to your daily hydration target
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={takingCreatine}
              disabled={togglingCreatine}
              onClick={() => void handleCreatineToggle(!takingCreatine)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                takingCreatine ? "bg-apex-cyan" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                  takingCreatine ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </NutritionCard>

        <NutritionCard
          title="Dynamic Hydration"
          icon={<Droplets className="text-apex-cyan h-5 w-5" />}
        >
          {loading || day === null ? (
            <p className="text-sm text-slate-500">
              {loading ? "Loading…" : "Log weight to see your hydration formula."}
            </p>
          ) : (
            <>
              <div className="space-y-1 text-sm text-slate-400">
                <p>
                  Base: {formatNumber(day.weightLbsAtLog)} lbs × 30 mL ={" "}
                  <span className="text-slate-200">
                    {formatNumber(day.baseHydrationMl)} mL
                  </span>
                </p>
                <p className="text-apex-amber">
                  Workout sweat loss: +{formatNumber(day.sweatLossMl)} mL
                </p>
                {day.creatineBonusMl > 0 && (
                  <p className="text-apex-amber">
                    Creatine adjustment: +{formatNumber(day.creatineBonusMl)} mL
                  </p>
                )}
                <p>
                  Target:{" "}
                  <span className="text-apex-cyan font-semibold">
                    {formatNumber(day.hydrationTargetMl)} mL
                  </span>
                </p>
              </div>

              <div className="mt-4">
                <ProgressBar
                  value={day.waterConsumedMl}
                  max={day.hydrationTargetMl}
                  color="bg-apex-cyan"
                  label={`${formatNumber(day.waterConsumedMl)} / ${formatNumber(day.hydrationTargetMl)} mL`}
                />
              </div>

              <p className="mt-4 text-2xl font-bold text-slate-50">
                {formatNumber(remainingMl)}{" "}
                <span className="text-base font-medium text-slate-500">
                  mL remaining
                </span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[250, 500, 750].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={addingWater !== null}
                    onClick={() => void handleAddWater(amount)}
                    className="border-apex-border hover:border-apex-cyan/50 rounded-full border px-3 py-1.5 text-sm font-medium text-slate-300 disabled:opacity-60"
                  >
                    {addingWater === amount ? "Adding…" : `+${amount} mL`}
                  </button>
                ))}
              </div>
            </>
          )}
        </NutritionCard>

        <NutritionCard
          title="Lean Bulk Targets"
          icon={<Flame className="text-apex-amber h-5 w-5" />}
        >
          {loading || day === null ? (
            <p className="text-sm text-slate-500">
              {loading ? "Loading…" : "Log weight to see calorie and protein targets."}
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm text-slate-400">
                  Calories: {formatNumber(day.caloriesConsumed)} /{" "}
                  {formatNumber(day.calorieTarget)}
                </p>
                <ProgressBar
                  value={day.caloriesConsumed}
                  max={day.calorieTarget}
                  color="bg-apex-amber"
                />
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-400">
                  Protein: {formatNumber(day.proteinConsumedG)}g /{" "}
                  {formatNumber(day.proteinTargetG)}g
                </p>
                <ProgressBar
                  value={day.proteinConsumedG}
                  max={day.proteinTargetG}
                  color="bg-apex-green"
                />
              </div>
            </div>
          )}
        </NutritionCard>

        <MealScannerDropzone date={date} disabled={needsWeight} />
      </div>
      )}

      {!loading && day !== null && (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              label="Today's Calories"
              value={`${formatNumber(day.caloriesConsumed)} / ${formatNumber(day.calorieTarget)}`}
              icon={<Flame className="text-apex-amber h-5 w-5" />}
              subtext="consumed / target"
            />
            <MetricCard
              label="Today's Protein"
              value={`${formatNumber(day.proteinConsumedG)}g / ${formatNumber(day.proteinTargetG)}g`}
              icon={<UtensilsCrossed className="text-apex-green h-5 w-5" />}
              subtext="consumed / target"
            />
            <MetricCard
              label="Water Consumed"
              value={`${formatNumber(day.waterConsumedMl)} / ${formatNumber(day.hydrationTargetMl)}`}
              unit="mL"
              icon={<Droplets className="text-apex-cyan h-5 w-5" />}
              subtext="consumed / target"
            />
          </div>

          <div className="border-apex-border bg-apex-card mt-8 rounded-2xl border p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-slate-400 uppercase">
              7-Day Calorie Intake vs. Water Consumed
            </h2>
            <NutritionWeekChart data={week} />
          </div>
        </>
      )}

      {!loading && day === null && (
        <p className="mt-6 text-sm text-slate-500">
          Sync Garmin active calories after logging weight to refine sweat-loss
          hydration targets.
        </p>
      )}
    </>
  );
}
