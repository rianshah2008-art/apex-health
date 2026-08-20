import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireUser } from "./users";
import { vitalsFields } from "./vitals";
import { recoveryFields } from "./recovery";
import { performanceFields } from "./training";
import {
  recalcNutritionTargets,
  upsertDailyVitals,
  upsertRecoveryReadiness,
  upsertTrainingPerformance,
} from "./lib/records";

const syncStatusValidator = v.union(
  v.literal("idle"),
  v.literal("running"),
  v.literal("success"),
  v.literal("error"),
);

/**
 * Public sync status. Deliberately omits `sessionJson` — that field holds live
 * Garmin OAuth tokens and must never leave the backend.
 */
export const syncStatus = query({
  args: {},
  returns: v.object({
    status: syncStatusValidator,
    lastSyncedAt: v.union(v.number(), v.null()),
    lastAttemptedAt: v.union(v.number(), v.null()),
    lastError: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("garminSync")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return {
      status: row?.status ?? ("idle" as const),
      lastSyncedAt: row?.lastSyncedAt ?? null,
      lastAttemptedAt: row?.lastAttemptedAt ?? null,
      lastError: row?.lastError ?? null,
    };
  },
});

/** Internal-only: returns the cached credential for the sync action. */
export const loadSyncState = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    sessionJson: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("garminSync")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    return { sessionJson: row?.sessionJson ?? null };
  },
});

export const markSyncRunning = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("garminSync")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const patch = { status: "running" as const, lastAttemptedAt: Date.now() };
    if (row === null) {
      await ctx.db.insert("garminSync", { userId: args.userId, ...patch });
    } else {
      await ctx.db.patch("garminSync", row._id, patch);
    }
    return null;
  },
});

export const markSyncFailed = internalMutation({
  args: { userId: v.id("users"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("garminSync")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const patch = { status: "error" as const, lastError: args.error };
    if (row === null) {
      await ctx.db.insert("garminSync", {
        userId: args.userId,
        lastAttemptedAt: Date.now(),
        ...patch,
      });
    } else {
      await ctx.db.patch("garminSync", row._id, patch);
    }
    return null;
  },
});

const snapshotValidator = v.object({
  date: v.string(),
  vitals: v.object(vitalsFields),
  recovery: v.object(recoveryFields),
  performance: v.object(performanceFields),
  activities: v.array(
    v.object({
      type: v.union(v.literal("run"), v.literal("bike"), v.literal("swim")),
      date: v.string(),
      durationSec: v.number(),
      distanceMeters: v.number(),
      avgPaceSec: v.optional(v.number()),
      avgHr: v.optional(v.number()),
      calories: v.optional(v.number()),
      garminActivityId: v.string(),
    }),
  ),
  warnings: v.array(v.string()),
});

/**
 * Commits a whole sync in one transaction, so a partial write can never leave
 * one table updated and another stale.
 */
export const applySnapshot = internalMutation({
  args: {
    userId: v.id("users"),
    snapshot: snapshotValidator,
    sessionJson: v.optional(v.string()),
  },
  returns: v.object({ activitiesAdded: v.number() }),
  handler: async (ctx, args) => {
    const { userId, snapshot } = args;

    await upsertDailyVitals(ctx, userId, snapshot.date, "garmin", snapshot.vitals);
    await upsertRecoveryReadiness(
      ctx,
      userId,
      snapshot.date,
      "garmin",
      snapshot.recovery,
    );
    await upsertTrainingPerformance(
      ctx,
      userId,
      snapshot.date,
      "garmin",
      snapshot.performance,
    );

    let activitiesAdded = 0;
    for (const activity of snapshot.activities) {
      const existing = await ctx.db
        .query("activities")
        .withIndex("by_user_garmin_activity", (q) =>
          q.eq("userId", userId).eq("garminActivityId", activity.garminActivityId),
        )
        .unique();
      if (existing === null) {
        await ctx.db.insert("activities", { userId, ...activity });
        activitiesAdded += 1;
      } else {
        await ctx.db.patch("activities", existing._id, activity);
      }
    }

    // Section 9: a sync that brings in active calories re-derives sweat loss and
    // the hydration target for that day.
    if (snapshot.vitals.activeCalories !== undefined) {
      await recalcNutritionTargets(ctx, userId, snapshot.date, {
        activeCalories: snapshot.vitals.activeCalories,
      });
    }

    const syncRow = await ctx.db
      .query("garminSync")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    const patch = {
      status: "success" as const,
      lastSyncedAt: now,
      lastError:
        snapshot.warnings.length === 0
          ? undefined
          : `Partial sync — ${snapshot.warnings.length} metric(s) unavailable: ${snapshot.warnings.join("; ")}`,
      ...(args.sessionJson === undefined
        ? {}
        : { sessionJson: args.sessionJson, sessionUpdatedAt: now }),
    };
    if (syncRow === null) {
      await ctx.db.insert("garminSync", {
        userId,
        lastAttemptedAt: now,
        ...patch,
      });
    } else {
      await ctx.db.patch("garminSync", syncRow._id, patch);
    }

    return { activitiesAdded };
  },
});

/** Users the cron should sync: anyone who has a Garmin sync record or a profile. */
export const listSyncableUsers = internalQuery({
  args: {},
  returns: v.array(v.id("users")),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(50);
    return users.map((user) => user._id);
  },
});
