import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { recalcNutritionTargets } from "./lib/records";
import { assertDateKey, dateKeyRange } from "./lib/dateKeys";
import { nutritionTargets } from "./lib/formulas";
import { readTunables } from "./settings";

const dayValidator = v.object({
  date: v.string(),
  weightLbsAtLog: v.number(),
  baseHydrationMl: v.number(),
  sweatLossMl: v.number(),
  creatineBonusMl: v.number(),
  hydrationTargetMl: v.number(),
  waterConsumedMl: v.number(),
  calorieTarget: v.number(),
  proteinTargetG: v.number(),
  caloriesConsumed: v.number(),
  proteinConsumedG: v.number(),
  /** False when targets are computed on the fly but not yet saved. */
  persisted: v.boolean(),
});

export const getDay = query({
  args: { date: v.string() },
  returns: v.union(v.null(), dayValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.date);

    const row = await ctx.db
      .query("nutritionLog")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date),
      )
      .unique();

    if (row !== null) {
      const {
        _id,
        _creationTime,
        userId,
        date,
        creatineBonusMl,
        ...rest
      } = row;
      void _id;
      void _creationTime;
      void userId;
      return {
        date,
        ...rest,
        creatineBonusMl: creatineBonusMl ?? 0,
        persisted: true,
      };
    }

    const weightLbs = user.weightLbs;
    if (weightLbs === undefined) {
      return null;
    }

    const tunables = await readTunables(ctx, user._id);
    const vitals = await ctx.db
      .query("dailyVitals")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date),
      )
      .unique();
    const targets = nutritionTargets(
      weightLbs,
      vitals?.activeCalories ?? 0,
      tunables,
      user.takingCreatine ?? false,
    );

    return {
      date: args.date,
      ...targets,
      waterConsumedMl: 0,
      caloriesConsumed: 0,
      proteinConsumedG: 0,
      persisted: false,
    };
  },
});

const weekPointValidator = v.object({
  date: v.string(),
  caloriesConsumed: v.union(v.number(), v.null()),
  waterConsumedMl: v.union(v.number(), v.null()),
  calorieTarget: v.union(v.number(), v.null()),
  hydrationTargetMl: v.union(v.number(), v.null()),
});

/** Last 7 days of intake for the combo chart. */
export const getWeek = query({
  args: { endDate: v.string() },
  returns: v.array(weekPointValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.endDate);
    const keys = dateKeyRange(args.endDate, 7);
    const startDate = keys[0];

    const rows = await ctx.db
      .query("nutritionLog")
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
        caloriesConsumed: row?.caloriesConsumed ?? null,
        waterConsumedMl: row?.waterConsumedMl ?? null,
        calorieTarget: row?.calorieTarget ?? null,
        hydrationTargetMl: row?.hydrationTargetMl ?? null,
      };
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Writes weight for the day, updates the user profile, and recomputes targets. */
export const logWeight = mutation({
  args: { date: v.string(), weightLbs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.date);
    if (args.weightLbs <= 0) {
      throw new Error("Weight must be greater than zero");
    }

    await ctx.db.patch("users", user._id, { weightLbs: args.weightLbs });

    const existingLog = await ctx.db
      .query("weightLog")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date),
      )
      .unique();

    if (existingLog === null) {
      await ctx.db.insert("weightLog", {
        userId: user._id,
        date: args.date,
        weightLbs: args.weightLbs,
      });
    } else {
      await ctx.db.patch("weightLog", existingLog._id, {
        weightLbs: args.weightLbs,
      });
    }

    await recalcNutritionTargets(ctx, user._id, args.date, {
      weightLbs: args.weightLbs,
    });
    return null;
  },
});

export const addWater = mutation({
  args: { date: v.string(), amountMl: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.date);
    if (args.amountMl <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    const row = await recalcNutritionTargets(ctx, user._id, args.date);
    if (row === null) {
      throw new Error("Log your weight first to set hydration targets");
    }

    await ctx.db.patch("nutritionLog", row._id, {
      waterConsumedMl: row.waterConsumedMl + args.amountMl,
    });
    return null;
  },
});

/** Updates creatine supplement status and recomputes today's hydration target. */
export const setTakingCreatine = mutation({
  args: { date: v.string(), takingCreatine: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.date);
    await ctx.db.patch("users", user._id, {
      takingCreatine: args.takingCreatine,
    });
    await recalcNutritionTargets(ctx, user._id, args.date);
    return null;
  },
});

/** Commits a meal after the user confirms or overrides the AI estimate. */
export const logMeal = mutation({
  args: {
    date: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
    description: v.optional(v.string()),
    calories: v.number(),
    proteinG: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.date);
    if (args.calories < 0 || args.proteinG < 0) {
      throw new Error("Calories and protein cannot be negative");
    }

    const row = await recalcNutritionTargets(ctx, user._id, args.date);
    if (row === null) {
      throw new Error("Log your weight first to track nutrition");
    }

    await ctx.db.insert("meals", {
      userId: user._id,
      date: args.date,
      photoStorageId: args.photoStorageId,
      aiEstimatedCalories: args.calories,
      aiEstimatedProteinG: args.proteinG,
      aiDescription: args.description,
      loggedAt: Date.now(),
    });

    await ctx.db.patch("nutritionLog", row._id, {
      caloriesConsumed: row.caloriesConsumed + args.calories,
      proteinConsumedG: row.proteinConsumedG + args.proteinG,
    });
    return null;
  },
});
