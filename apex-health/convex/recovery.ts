import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { upsertRecoveryReadiness } from "./lib/records";
import { assertDateKey, dateKeyRange } from "./lib/dateKeys";

export const recoveryFields = {
  trainingReadiness: v.optional(v.number()),
  trainingStatus: v.optional(v.string()),
  bodyBatteryTimeline: v.optional(v.array(v.number())),
  bodyBatteryCurrent: v.optional(v.number()),
  hrvStatus: v.optional(v.string()),
  hrvMsAvg: v.optional(v.number()),
  sleepScore: v.optional(v.number()),
  sleepDurationMin: v.optional(v.number()),
  sleepDeepMin: v.optional(v.number()),
  sleepRemMin: v.optional(v.number()),
  sleepLightMin: v.optional(v.number()),
  recoveryTimeHours: v.optional(v.number()),
  acuteLoad: v.optional(v.number()),
  chronicLoad: v.optional(v.number()),
  loadRatio: v.optional(v.number()),
};

export const getDay = query({
  args: { date: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      date: v.string(),
      source: v.union(v.literal("garmin"), v.literal("manual")),
      ...recoveryFields,
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("recoveryReadiness")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date),
      )
      .unique();
    if (row === null) {
      return null;
    }
    const { _id, _creationTime, userId, ...rest } = row;
    void _id;
    void _creationTime;
    void userId;
    return rest;
  },
});

const rangePointValidator = v.object({
  date: v.string(),
  trainingReadiness: v.union(v.number(), v.null()),
  bodyBatteryCurrent: v.union(v.number(), v.null()),
  hrvMsAvg: v.union(v.number(), v.null()),
  sleepScore: v.union(v.number(), v.null()),
  recoveryTimeHours: v.union(v.number(), v.null()),
  acuteLoad: v.union(v.number(), v.null()),
  chronicLoad: v.union(v.number(), v.null()),
  loadRatio: v.union(v.number(), v.null()),
});

/** Ascending daily points for recovery trend charts. */
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
      .query("recoveryReadiness")
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
        trainingReadiness: row?.trainingReadiness ?? null,
        bodyBatteryCurrent: row?.bodyBatteryCurrent ?? null,
        hrvMsAvg: row?.hrvMsAvg ?? null,
        sleepScore: row?.sleepScore ?? null,
        recoveryTimeHours: row?.recoveryTimeHours ?? null,
        acuteLoad: row?.acuteLoad ?? null,
        chronicLoad: row?.chronicLoad ?? null,
        loadRatio: row?.loadRatio ?? null,
      };
    });
  },
});

export const saveManual = mutation({
  args: { date: v.string(), ...recoveryFields },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { date, ...fields } = args;
    assertDateKey(date);

    // Keep the derived ratio consistent when both loads are supplied by hand.
    const derived = { ...fields };
    if (
      derived.loadRatio === undefined &&
      derived.acuteLoad !== undefined &&
      derived.chronicLoad !== undefined &&
      derived.chronicLoad > 0
    ) {
      derived.loadRatio =
        Math.round((derived.acuteLoad / derived.chronicLoad) * 100) / 100;
    }

    await upsertRecoveryReadiness(ctx, user._id, date, "manual", derived);
    return null;
  },
});
