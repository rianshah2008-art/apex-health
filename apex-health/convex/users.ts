import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Every domain query/mutation funnels through this so a `userId` is never
 * accepted as a client-supplied argument.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get("users", userId);
  if (user === null) {
    throw new Error("Authenticated user no longer exists");
  }
  return user;
}

export const currentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      weightLbs: v.optional(v.number()),
      heightIn: v.optional(v.number()),
      takingCreatine: v.optional(v.boolean()),
      garminUsername: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (user === null) {
      return null;
    }
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      weightLbs: user.weightLbs,
      heightIn: user.heightIn,
      takingCreatine: user.takingCreatine,
      garminUsername: user.garminUsername,
    };
  },
});
