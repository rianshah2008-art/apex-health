"use node";

import { v } from "convex/values";
import { ActionCtx, action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import {
  GarminSession,
  fetchGarminSnapshot,
  loginToGarmin,
} from "./lib/garminFetch";
import { todayKey } from "./lib/dateKeys";

const syncResultValidator = v.object({
  ok: v.boolean(),
  date: v.string(),
  activitiesAdded: v.number(),
  /** Endpoints that failed. Empty on a clean sync; the UI shows these as a soft warning. */
  warnings: v.array(v.string()),
  error: v.union(v.string(), v.null()),
});

function credentials(): { username: string; password: string } {
  const username = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Garmin credentials are not configured. Set GARMIN_EMAIL and GARMIN_PASSWORD on the Convex deployment, or enter today's data manually.",
    );
  }
  return { username, password };
}

async function runSync(
  ctx: ActionCtx,
  userId: Id<"users">,
  date: string,
  options: { updateSyncStatus?: boolean } = {},
): Promise<{
  ok: boolean;
  date: string;
  activitiesAdded: number;
  warnings: string[];
  error: string | null;
}> {
  const updateSyncStatus = options.updateSyncStatus ?? true;
  if (updateSyncStatus) {
    await ctx.runMutation(internal.garminStore.markSyncRunning, { userId });
  }

  try {
    const { username, password } = credentials();
    const { sessionJson } = await ctx.runQuery(
      internal.garminStore.loadSyncState,
      { userId },
    );

    let cachedSession: GarminSession | null = null;
    if (sessionJson !== null) {
      try {
        cachedSession = JSON.parse(sessionJson) as GarminSession;
      } catch {
        cachedSession = null;
      }
    }

    const { client, session, reusedSession } = await loginToGarmin(
      username,
      password,
      cachedSession,
    );

    const snapshot = await fetchGarminSnapshot(client, date);

    const { activitiesAdded } = await ctx.runMutation(
      internal.garminStore.applySnapshot,
      {
        userId,
        snapshot,
        sessionJson: reusedSession ? undefined : JSON.stringify(session),
      },
    );

    return {
      ok: true,
      date,
      activitiesAdded,
      warnings: snapshot.warnings,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Garmin sync failure";
    if (updateSyncStatus) {
      await ctx.runMutation(internal.garminStore.markSyncFailed, {
        userId,
        error: message,
      });
    }
    return { ok: false, date, activitiesAdded: 0, warnings: [], error: message };
  }
}

/**
 * Per-user sync for cron, backfill, and scheduled jobs. Keeps `syncNow` as the
 * authenticated entry point for the UI button.
 */
export const syncUserDate = internalAction({
  args: {
    userId: v.id("users"),
    date: v.string(),
    updateSyncStatus: v.optional(v.boolean()),
  },
  returns: syncResultValidator,
  handler: async (ctx, args) => {
    return runSync(ctx, args.userId, args.date, {
      updateSyncStatus: args.updateSyncStatus,
    });
  },
});

/** Triggered by the "Sync Garmin Data" button. */
export const syncNow = action({
  args: { date: v.optional(v.string()) },
  returns: syncResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    return runSync(ctx, userId, args.date ?? todayKey());
  },
});

/**
 * Triggered by the cron in `crons.ts`. `date` exists so a past day can be
 * backfilled from the CLI once the watch has finished uploading it.
 */
export const syncScheduled = internalAction({
  args: { date: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userIds = await ctx.runQuery(
      internal.garminStore.listSyncableUsers,
      {},
    );
    const date = args.date ?? todayKey();
    for (const userId of userIds) {
      const result = await ctx.runAction(internal.garmin.syncUserDate, {
        userId,
        date,
      });
      if (!result.ok) {
        console.error(`Garmin sync failed for ${userId}: ${result.error}`);
      }
    }
    return null;
  },
});
