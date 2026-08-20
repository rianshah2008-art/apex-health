import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { upsertTrainingPerformance } from "./lib/records";
import { assertDateKey, dateKeyRange } from "./lib/dateKeys";

export const performanceFields = {
  runningMileTimeSec: v.optional(v.number()),
  bikingMileTimeSec: v.optional(v.number()),
  swimming100mPaceSec: v.optional(v.number()),
  lactateThresholdHr: v.optional(v.number()),
  lactateThresholdPaceSec: v.optional(v.number()),
  cyclingFtp: v.optional(v.number()),
  heatAcclimationPct: v.optional(v.number()),
  altitudeAcclimationM: v.optional(v.number()),
};

export const getDay = query({
  args: { date: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      date: v.string(),
      source: v.union(v.literal("garmin"), v.literal("manual")),
      ...performanceFields,
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("trainingPerformance")
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
  lactateThresholdHr: v.union(v.number(), v.null()),
  lactateThresholdPaceSec: v.union(v.number(), v.null()),
  cyclingFtp: v.union(v.number(), v.null()),
  heatAcclimationPct: v.union(v.number(), v.null()),
  altitudeAcclimationM: v.union(v.number(), v.null()),
});

/** Ascending daily points for threshold and acclimation trend charts. */
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
      .query("trainingPerformance")
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
        lactateThresholdHr: row?.lactateThresholdHr ?? null,
        lactateThresholdPaceSec: row?.lactateThresholdPaceSec ?? null,
        cyclingFtp: row?.cyclingFtp ?? null,
        heatAcclimationPct: row?.heatAcclimationPct ?? null,
        altitudeAcclimationM: row?.altitudeAcclimationM ?? null,
      };
    });
  },
});

export const saveManual = mutation({
  args: { date: v.string(), ...performanceFields },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { date, ...fields } = args;
    assertDateKey(date);
    await upsertTrainingPerformance(ctx, user._id, date, "manual", fields);
    return null;
  },
});
