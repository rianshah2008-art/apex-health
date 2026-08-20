import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { assertDateKey } from "./lib/dateKeys";

const METERS_PER_MILE = 1609.344;

const activityTypeValidator = v.union(
  v.literal("run"),
  v.literal("bike"),
  v.literal("swim"),
);

const activityValidator = v.object({
  _id: v.id("activities"),
  type: activityTypeValidator,
  date: v.string(),
  durationSec: v.number(),
  distanceMeters: v.number(),
  avgPaceSec: v.optional(v.number()),
  avgHr: v.optional(v.number()),
  calories: v.optional(v.number()),
  garminActivityId: v.optional(v.string()),
});

/** Section 7: the pace cards drill down into the last N efforts of that type. */
export const recentByType = query({
  args: { type: activityTypeValidator, limit: v.optional(v.number()) },
  returns: v.array(activityValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_user_type_date", (q) =>
        q.eq("userId", user._id).eq("type", args.type),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 7, 50));
    return rows.map(({ _id, type, date, durationSec, distanceMeters, avgPaceSec, avgHr, calories, garminActivityId }) => ({
      _id,
      type,
      date,
      durationSec,
      distanceMeters,
      avgPaceSec,
      avgHr,
      calories,
      garminActivityId,
    }));
  },
});

/**
 * Manual workout entry. Pace is derived rather than asked for — per mile for
 * runs and rides, per 100m for swims, matching the Section 7 cards.
 */
export const logManual = mutation({
  args: {
    type: activityTypeValidator,
    date: v.string(),
    durationSec: v.number(),
    distanceMeters: v.number(),
    avgHr: v.optional(v.number()),
    calories: v.optional(v.number()),
  },
  returns: v.id("activities"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertDateKey(args.date);
    if (args.durationSec <= 0) {
      throw new Error("Duration must be greater than zero");
    }
    if (args.distanceMeters < 0) {
      throw new Error("Distance cannot be negative");
    }

    const avgPaceSec =
      args.distanceMeters <= 0
        ? undefined
        : args.type === "swim"
          ? Math.round(args.durationSec / (args.distanceMeters / 100))
          : Math.round(args.durationSec / (args.distanceMeters / METERS_PER_MILE));

    return await ctx.db.insert("activities", {
      userId: user._id,
      type: args.type,
      date: args.date,
      durationSec: args.durationSec,
      distanceMeters: args.distanceMeters,
      avgPaceSec,
      avgHr: args.avgHr,
      calories: args.calories,
    });
  },
});

export const remove = mutation({
  args: { activityId: v.id("activities") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const activity = await ctx.db.get("activities", args.activityId);
    if (activity === null || activity.userId !== user._id) {
      throw new Error("Activity not found");
    }
    await ctx.db.delete("activities", args.activityId);
    return null;
  },
});
