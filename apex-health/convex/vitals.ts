import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { readTunables } from "./settings";
import { recalcNutritionTargets, upsertDailyVitals } from "./lib/records";
import { assertDateKey, dateKeyRange } from "./lib/dateKeys";

export const vitalsMetricValidator = v.union(
  v.literal("steps"),
  v.literal("restingHeartRate"),
  v.literal("activeCalories"),
  v.literal("totalCalories"),
  v.literal("pulseOxOvernight"),
  v.literal("respirationRate"),
  v.literal("stressLevelAvg"),
);

export type VitalsMetric =
  | "steps"
  | "restingHeartRate"
  | "activeCalories"
  | "totalCalories"
  | "pulseOxOvernight"
  | "respirationRate"
  | "stressLevelAvg";

export const vitalsFields = {
  steps: v.optional(v.number()),
  stepGoal: v.optional(v.number()),
  restingHeartRate: v.optional(v.number()),
  hrTrend: v.optional(v.array(v.number())),
  activeCalories: v.optional(v.number()),
  totalCalories: v.optional(v.number()),
  pulseOxOvernight: v.optional(v.number()),
  respirationRate: v.optional(v.number()),
  stressLevelAvg: v.optional(v.number()),
};

const dayValidator = v.union(
  v.null(),
  v.object({
    date: v.string(),
    source: v.union(v.literal("garmin"), v.literal("manual")),
    ...vitalsFields,
  }),
);

export const getDay = query({
  args: { date: v.string() },
  returns: dayValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("dailyVitals")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date),
      )
      .unique();
    if (row === null) {
      return null;
    }
    const { steps, stepGoal, ...rest } = row;
    const tunables = await readTunables(ctx, user._id);
    return {
      date: row.date,
      source: row.source,
      steps,
      // Fall back to the configured goal when Garmin did not report one.
      stepGoal: stepGoal ?? tunables.stepGoal,
      restingHeartRate: rest.restingHeartRate,
      hrTrend: rest.hrTrend,
      activeCalories: rest.activeCalories,
      totalCalories: rest.totalCalories,
      pulseOxOvernight: rest.pulseOxOvernight,
      respirationRate: rest.respirationRate,
      stressLevelAvg: rest.stressLevelAvg,
    };
  },
});

const rangePointValidator = v.object({
  date: v.string(),
  steps: v.union(v.number(), v.null()),
  restingHeartRate: v.union(v.number(), v.null()),
  activeCalories: v.union(v.number(), v.null()),
  totalCalories: v.union(v.number(), v.null()),
  pulseOxOvernight: v.union(v.number(), v.null()),
  respirationRate: v.union(v.number(), v.null()),
  stressLevelAvg: v.union(v.number(), v.null()),
});

/** Ascending daily points for trend charts — missing days return null values. */
export const getRange = query({
  args: {
    endDate: v.string(),
    days: v.union(v.literal(7), v.literal(30)),
  },
  returns: v.array(rangePointValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.endDate);
    const keys = dateKeyRange(args.endDate, args.days);
    const startDate = keys[0];

    const rows = await ctx.db
      .query("dailyVitals")
      .withIndex("by_user_date", (q) =>
        q
          .eq("userId", user._id)
          .gte("date", startDate)
          .lte("date", args.endDate),
      )
      .collect();

    const byDate = new Map(rows.map((row) => [row.date, row]));

    return keys.map((date) => {
      const row = byDate.get(date);
      return {
        date,
        steps: row?.steps ?? null,
        restingHeartRate: row?.restingHeartRate ?? null,
        activeCalories: row?.activeCalories ?? null,
        totalCalories: row?.totalCalories ?? null,
        pulseOxOvernight: row?.pulseOxOvernight ?? null,
        respirationRate: row?.respirationRate ?? null,
        stressLevelAvg: row?.stressLevelAvg ?? null,
      };
    });
  },
});

/**
 * Manual-entry fallback for every Daily Vitals metric. Omitted fields keep their
 * existing value, so this can be used to correct a single number after a sync.
 */
export const saveManual = mutation({
  args: { date: v.string(), ...vitalsFields },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { date, ...fields } = args;
    assertDateKey(date);
    await upsertDailyVitals(ctx, user._id, date, "manual", fields);

    // Active calories drive the day's sweat-loss and hydration target.
    if (fields.activeCalories !== undefined) {
      await recalcNutritionTargets(ctx, user._id, date, {
        activeCalories: fields.activeCalories,
      });
    }
    return null;
  },
});
