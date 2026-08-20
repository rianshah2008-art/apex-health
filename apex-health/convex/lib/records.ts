import { MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { readTunables } from "../settings";
import { nutritionTargets } from "./formulas";

type Source = "garmin" | "manual";

/**
 * Strips keys whose value is `undefined` so a patch only touches fields the
 * caller actually has a value for. This is what lets a Garmin sync fill in the
 * metrics it fetched successfully without clobbering metrics the user entered
 * by hand for the same day.
 */
function definedOnly<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

type VitalsFields = Omit<Doc<"dailyVitals">, "_id" | "_creationTime" | "userId" | "date" | "source">;
type RecoveryFields = Omit<Doc<"recoveryReadiness">, "_id" | "_creationTime" | "userId" | "date" | "source">;
type PerformanceFields = Omit<Doc<"trainingPerformance">, "_id" | "_creationTime" | "userId" | "date" | "source">;

export async function upsertDailyVitals(
  ctx: MutationCtx,
  userId: Id<"users">,
  date: string,
  source: Source,
  fields: Partial<VitalsFields>,
): Promise<void> {
  const patch = definedOnly(fields);
  if (Object.keys(patch).length === 0) {
    return;
  }
  const existing = await ctx.db
    .query("dailyVitals")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();
  if (existing === null) {
    await ctx.db.insert("dailyVitals", { userId, date, source, ...patch });
  } else {
    await ctx.db.patch("dailyVitals", existing._id, { ...patch, source });
  }
}

export async function upsertRecoveryReadiness(
  ctx: MutationCtx,
  userId: Id<"users">,
  date: string,
  source: Source,
  fields: Partial<RecoveryFields>,
): Promise<void> {
  const patch = definedOnly(fields);
  if (Object.keys(patch).length === 0) {
    return;
  }
  const existing = await ctx.db
    .query("recoveryReadiness")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();
  if (existing === null) {
    await ctx.db.insert("recoveryReadiness", { userId, date, source, ...patch });
  } else {
    await ctx.db.patch("recoveryReadiness", existing._id, { ...patch, source });
  }
}

export async function upsertTrainingPerformance(
  ctx: MutationCtx,
  userId: Id<"users">,
  date: string,
  source: Source,
  fields: Partial<PerformanceFields>,
): Promise<void> {
  const patch = definedOnly(fields);
  if (Object.keys(patch).length === 0) {
    return;
  }
  const existing = await ctx.db
    .query("trainingPerformance")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();
  if (existing === null) {
    await ctx.db.insert("trainingPerformance", {
      userId,
      date,
      source,
      ...patch,
    });
  } else {
    await ctx.db.patch("trainingPerformance", existing._id, {
      ...patch,
      source,
    });
  }
}

/**
 * Recomputes every derived target on a day's nutrition row. Called whenever the
 * inputs change — a new weight entry, or a sync that brings in active calories —
 * so hydration and calorie targets can never drift from the current weight.
 *
 * Consumption counters (`waterConsumedMl`, `caloriesConsumed`, `proteinConsumedG`)
 * are preserved; only the targets are recalculated.
 */
export async function recalcNutritionTargets(
  ctx: MutationCtx,
  userId: Id<"users">,
  date: string,
  overrides: { weightLbs?: number; activeCalories?: number } = {},
): Promise<Doc<"nutritionLog"> | null> {
  const tunables = await readTunables(ctx, userId);
  const existing = await ctx.db
    .query("nutritionLog")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();

  const weightLbs = overrides.weightLbs ?? existing?.weightLbsAtLog ?? (await ctx.db.get("users", userId))?.weightLbs;
  if (weightLbs === undefined) {
    // No weight on record yet, so there is nothing to base the targets on.
    return existing;
  }

  const user = await ctx.db.get("users", userId);
  const takingCreatine = user?.takingCreatine ?? false;

  const activeCalories =
    overrides.activeCalories ??
    (await ctx.db
      .query("dailyVitals")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique())?.activeCalories ??
    0;

  const targets = nutritionTargets(
    weightLbs,
    activeCalories,
    tunables,
    takingCreatine,
  );

  if (existing === null) {
    const id = await ctx.db.insert("nutritionLog", {
      userId,
      date,
      ...targets,
      waterConsumedMl: 0,
      caloriesConsumed: 0,
      proteinConsumedG: 0,
    });
    return await ctx.db.get("nutritionLog", id);
  }

  await ctx.db.patch("nutritionLog", existing._id, targets);
  return await ctx.db.get("nutritionLog", existing._id);
}
