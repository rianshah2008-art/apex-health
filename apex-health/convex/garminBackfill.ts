"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { shiftDateKey, todayKey } from "./lib/dateKeys";

const backfillResultValidator = v.object({
  date: v.string(),
  status: v.string(),
  activitiesAdded: v.number(),
});

/**
 * One-time historical sync loop. Run from the CLI — does not touch the UI sync
 * status badge so a failed past day cannot mark today's sync as errored.
 *
 *   npx convex run garminBackfill:backfillHistory '{"days": 30}'
 */
export const backfillHistory = internalAction({
  args: { days: v.optional(v.number()) },
  returns: v.array(backfillResultValidator),
  handler: async (ctx, args) => {
    const numDays = Math.min(Math.max(args.days ?? 30, 1), 60);
    const userIds = await ctx.runQuery(
      internal.garminStore.listSyncableUsers,
      {},
    );
    const results: Array<{
      date: string;
      status: string;
      activitiesAdded: number;
    }> = [];
    const today = todayKey();

    for (let offset = 1; offset <= numDays; offset++) {
      const dateStr = shiftDateKey(today, -offset);
      let dayStatus = "ok";
      let activitiesAdded = 0;
      const errors: string[] = [];

      for (const userId of userIds) {
        const result = await ctx.runAction(internal.garmin.syncUserDate, {
          userId,
          date: dateStr,
          updateSyncStatus: false,
        });
        if (!result.ok) {
          errors.push(result.error ?? "unknown error");
        } else {
          activitiesAdded += result.activitiesAdded;
        }
      }

      if (errors.length > 0) {
        dayStatus = `error: ${errors[0]}`;
      }

      results.push({ date: dateStr, status: dayStatus, activitiesAdded });

      // Avoid hammering Garmin in a tight loop.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return results;
  },
});
