import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { requireUser } from "./users";
import {
  eventTypeValidator,
  planPhaseValidator,
  planWeekValidator,
  workoutDisciplineValidator,
} from "./schema";

const fitnessContextValidator = v.object({
  weightLbs: v.union(v.number(), v.null()),
  heightIn: v.union(v.number(), v.null()),
  runningMileTimeSec: v.union(v.number(), v.null()),
  bikingMileTimeSec: v.union(v.number(), v.null()),
  swimming100mPaceSec: v.union(v.number(), v.null()),
  lactateThresholdHr: v.union(v.number(), v.null()),
  lactateThresholdPaceSec: v.union(v.number(), v.null()),
  cyclingFtp: v.union(v.number(), v.null()),
  trainingReadiness: v.union(v.number(), v.null()),
  hrvStatus: v.union(v.string(), v.null()),
  loadRatio: v.union(v.number(), v.null()),
});

const eventDocValidator = v.object({
  _id: v.id("events"),
  name: v.string(),
  eventType: eventTypeValidator,
  eventDate: v.string(),
  isActive: v.boolean(),
  createdAt: v.number(),
});

const planDocValidator = v.object({
  _id: v.id("trainingPlan"),
  eventId: v.id("events"),
  generatedAt: v.number(),
  weeks: v.array(planWeekValidator),
});

async function latestTrainingRow(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"trainingPerformance"> | null> {
  return (
    (await ctx.db
      .query("trainingPerformance")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .first()) ?? null
  );
}

async function latestRecoveryRow(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"recoveryReadiness"> | null> {
  return (
    (await ctx.db
      .query("recoveryReadiness")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .first()) ?? null
  );
}

/** Latest Garmin thresholds + recovery for the training-plan prompt. */
export const loadFitnessContext = internalQuery({
  args: { userId: v.id("users") },
  returns: fitnessContextValidator,
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    const training = await latestTrainingRow(ctx, args.userId);
    const recovery = await latestRecoveryRow(ctx, args.userId);

    return {
      weightLbs: user?.weightLbs ?? null,
      heightIn: user?.heightIn ?? null,
      runningMileTimeSec: training?.runningMileTimeSec ?? null,
      bikingMileTimeSec: training?.bikingMileTimeSec ?? null,
      swimming100mPaceSec: training?.swimming100mPaceSec ?? null,
      lactateThresholdHr: training?.lactateThresholdHr ?? null,
      lactateThresholdPaceSec: training?.lactateThresholdPaceSec ?? null,
      cyclingFtp: training?.cyclingFtp ?? null,
      trainingReadiness: recovery?.trainingReadiness ?? null,
      hrvStatus: recovery?.hrvStatus ?? null,
      loadRatio: recovery?.loadRatio ?? null,
    };
  },
});

/** Active event for internal actions (regenerate). */
export const getActiveEventInternal = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), eventDocValidator),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("events")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", args.userId).eq("isActive", true),
      )
      .first();
    if (row === null) {
      return null;
    }
    return {
      _id: row._id,
      name: row.name,
      eventType: row.eventType,
      eventDate: row.eventDate,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  },
});

export const getActiveEvent = query({
  args: {},
  returns: v.union(v.null(), eventDocValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("events")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("isActive", true),
      )
      .first();
    if (row === null) {
      return null;
    }
    return {
      _id: row._id,
      name: row.name,
      eventType: row.eventType,
      eventDate: row.eventDate,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  },
});

export const getActivePlan = query({
  args: {},
  returns: v.union(v.null(), planDocValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const event = await ctx.db
      .query("events")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("isActive", true),
      )
      .first();
    if (event === null) {
      return null;
    }

    const plan = await ctx.db
      .query("trainingPlan")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", user._id).eq("eventId", event._id),
      )
      .order("desc")
      .first();

    if (plan === null) {
      return null;
    }

    return {
      _id: plan._id,
      eventId: plan.eventId,
      generatedAt: plan.generatedAt,
      weeks: plan.weeks,
    };
  },
});

export const saveGeneratedPlan = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    eventType: eventTypeValidator,
    eventDate: v.string(),
    heightIn: v.optional(v.number()),
    weeks: v.array(planWeekValidator),
  },
  returns: v.object({
    eventId: v.id("events"),
    planId: v.id("trainingPlan"),
  }),
  handler: async (ctx, args) => {
    const priorActive = await ctx.db
      .query("events")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", args.userId).eq("isActive", true),
      )
      .collect();
    for (const event of priorActive) {
      await ctx.db.patch("events", event._id, { isActive: false });
    }

    const eventId = await ctx.db.insert("events", {
      userId: args.userId,
      name: args.name,
      eventType: args.eventType,
      eventDate: args.eventDate,
      isActive: true,
      createdAt: Date.now(),
    });

    const planId = await ctx.db.insert("trainingPlan", {
      userId: args.userId,
      eventId,
      generatedAt: Date.now(),
      weeks: args.weeks,
    });

    if (args.heightIn !== undefined) {
      await ctx.db.patch("users", args.userId, { heightIn: args.heightIn });
    }

    return { eventId, planId };
  },
});

export const replacePlanForEvent = internalMutation({
  args: {
    userId: v.id("users"),
    eventId: v.id("events"),
    weeks: v.array(planWeekValidator),
    heightIn: v.optional(v.number()),
  },
  returns: v.id("trainingPlan"),
  handler: async (ctx, args) => {
    const event = await ctx.db.get("events", args.eventId);
    if (event === null || event.userId !== args.userId || !event.isActive) {
      throw new Error("Active event not found");
    }

    const existing = await ctx.db
      .query("trainingPlan")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", args.userId).eq("eventId", args.eventId),
      )
      .collect();
    for (const plan of existing) {
      await ctx.db.delete("trainingPlan", plan._id);
    }

    const planId = await ctx.db.insert("trainingPlan", {
      userId: args.userId,
      eventId: args.eventId,
      generatedAt: Date.now(),
      weeks: args.weeks,
    });

    if (args.heightIn !== undefined) {
      await ctx.db.patch("users", args.userId, { heightIn: args.heightIn });
    }

    return planId;
  },
});

/** Deactivates the current event so a new one can be created. */
export const endActiveEvent = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const active = await ctx.db
      .query("events")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("isActive", true),
      )
      .first();
    if (active !== null) {
      await ctx.db.patch("events", active._id, { isActive: false });
    }
    return null;
  },
});

/** Dev helper: shape check for parsed plan weeks before insert. */
export const planWeekFields = {
  weekStartDate: v.string(),
  weekNumber: v.number(),
  phase: planPhaseValidator,
  targetHours: v.number(),
  workouts: v.array(
    v.object({
      day: v.string(),
      discipline: workoutDisciplineValidator,
      description: v.string(),
      durationMin: v.optional(v.number()),
    }),
  ),
  notes: v.optional(v.string()),
};
