import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUser } from "./users";
import { DEFAULT_SETTINGS } from "./lib/formulas";

export type Tunables = {
  sweatMultiplier: number;
  activityMultiplier: number;
  calorieSurplus: number;
  proteinGramsPerLb: number;
  creatineBonusMl: number;
  stepGoal: number;
};

const settingsFields = {
  sweatMultiplier: v.number(),
  activityMultiplier: v.number(),
  calorieSurplus: v.number(),
  proteinGramsPerLb: v.number(),
  creatineBonusMl: v.number(),
  stepGoal: v.number(),
};

/**
 * Reads without writing, so this is safe to call from queries. A user who has
 * never customised anything simply gets the defaults.
 */
export async function readTunables(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Tunables> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row
    ? {
        ...DEFAULT_SETTINGS,
        ...row,
        creatineBonusMl: row.creatineBonusMl ?? DEFAULT_SETTINGS.creatineBonusMl,
      }
    : { ...DEFAULT_SETTINGS };
}

export const get = query({
  args: {},
  returns: v.object(settingsFields),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return readTunables(ctx, user._id);
  },
});

export const update = mutation({
  args: {
    sweatMultiplier: v.optional(v.number()),
    activityMultiplier: v.optional(v.number()),
    calorieSurplus: v.optional(v.number()),
    proteinGramsPerLb: v.optional(v.number()),
    creatineBonusMl: v.optional(v.number()),
    stepGoal: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const merged: Tunables = {
      sweatMultiplier: args.sweatMultiplier ?? existing?.sweatMultiplier ?? DEFAULT_SETTINGS.sweatMultiplier,
      activityMultiplier: args.activityMultiplier ?? existing?.activityMultiplier ?? DEFAULT_SETTINGS.activityMultiplier,
      calorieSurplus: args.calorieSurplus ?? existing?.calorieSurplus ?? DEFAULT_SETTINGS.calorieSurplus,
      proteinGramsPerLb: args.proteinGramsPerLb ?? existing?.proteinGramsPerLb ?? DEFAULT_SETTINGS.proteinGramsPerLb,
      creatineBonusMl: args.creatineBonusMl ?? existing?.creatineBonusMl ?? DEFAULT_SETTINGS.creatineBonusMl,
      stepGoal: args.stepGoal ?? existing?.stepGoal ?? DEFAULT_SETTINGS.stepGoal,
    };

    if (existing === null) {
      await ctx.db.insert("settings", { userId: user._id, ...merged });
    } else {
      await ctx.db.patch("settings", existing._id, merged);
    }
    return null;
  },
});
