import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/** Every synced table records whether the row came from Garmin or manual entry. */
export const sourceValidator = v.union(
  v.literal("garmin"),
  v.literal("manual"),
);

export const eventTypeValidator = v.union(
  v.literal("ironman"),
  v.literal("half_ironman"),
  v.literal("marathon"),
  v.literal("half_marathon"),
  v.literal("olympic_triathlon"),
  v.literal("sprint_triathlon"),
  v.literal("custom"),
);

export const planPhaseValidator = v.union(
  v.literal("base"),
  v.literal("build"),
  v.literal("peak"),
  v.literal("taper"),
  v.literal("race_week"),
);

export const workoutDisciplineValidator = v.union(
  v.literal("swim"),
  v.literal("bike"),
  v.literal("run"),
  v.literal("strength"),
  v.literal("rest"),
  v.literal("brick"),
);

export const planWorkoutValidator = v.object({
  day: v.string(),
  discipline: workoutDisciplineValidator,
  description: v.string(),
  durationMin: v.optional(v.number()),
});

export const planWeekValidator = v.object({
  weekStartDate: v.string(),
  weekNumber: v.number(),
  phase: planPhaseValidator,
  targetHours: v.number(),
  workouts: v.array(planWorkoutValidator),
  notes: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,

  // Extends the Convex Auth `users` table with app-specific profile fields.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    weightLbs: v.optional(v.number()),
    heightIn: v.optional(v.number()), // inches
    takingCreatine: v.optional(v.boolean()),
    garminUsername: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // Tunable coefficients for the hydration/nutrition formulas, so they can be
  // adjusted against real data without a code change.
  settings: defineTable({
    userId: v.id("users"),
    sweatMultiplier: v.number(), // mL of water per active kcal burned
    activityMultiplier: v.number(), // kcal per lb of bodyweight for TDEE
    calorieSurplus: v.number(), // kcal added to TDEE for a lean bulk
    proteinGramsPerLb: v.number(),
    creatineBonusMl: v.optional(v.number()),
    stepGoal: v.number(),
  }).index("by_user", ["userId"]),

  // Garmin sync bookkeeping. Internal-only: the cached session is a credential
  // and must never be returned from a public query.
  garminSync: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
    ),
    lastSyncedAt: v.optional(v.number()),
    lastAttemptedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    sessionJson: v.optional(v.string()), // cached Garmin OAuth tokens
    sessionUpdatedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // One row per day per user — Daily Vitals section
  dailyVitals: defineTable({
    userId: v.id("users"),
    date: v.string(), // "YYYY-MM-DD"
    steps: v.optional(v.number()),
    stepGoal: v.optional(v.number()),
    restingHeartRate: v.optional(v.number()),
    hrTrend: v.optional(v.array(v.number())), // intraday sparkline points
    activeCalories: v.optional(v.number()),
    totalCalories: v.optional(v.number()),
    pulseOxOvernight: v.optional(v.number()), // SpO2 %
    respirationRate: v.optional(v.number()),
    stressLevelAvg: v.optional(v.number()), // 0-100
    source: sourceValidator,
  }).index("by_user_date", ["userId", "date"]),

  // One row per day — Recovery & Readiness section
  recoveryReadiness: defineTable({
    userId: v.id("users"),
    date: v.string(),
    trainingReadiness: v.optional(v.number()), // 0-100
    trainingStatus: v.optional(v.string()), // "Unproductive" | "Productive" | ...
    bodyBatteryTimeline: v.optional(v.array(v.number())), // 12 values, 12am-6pm
    bodyBatteryCurrent: v.optional(v.number()),
    hrvStatus: v.optional(v.string()), // "Balanced" | "Unbalanced" | "Low"
    hrvMsAvg: v.optional(v.number()),
    sleepScore: v.optional(v.number()),
    sleepDurationMin: v.optional(v.number()),
    sleepDeepMin: v.optional(v.number()),
    sleepRemMin: v.optional(v.number()),
    sleepLightMin: v.optional(v.number()),
    recoveryTimeHours: v.optional(v.number()),
    acuteLoad: v.optional(v.number()), // 7-day
    chronicLoad: v.optional(v.number()), // 28-day
    loadRatio: v.optional(v.number()),
    source: sourceValidator,
  }).index("by_user_date", ["userId", "date"]),

  // One row per day — thresholds and acclimation (slow-moving stats)
  trainingPerformance: defineTable({
    userId: v.id("users"),
    date: v.string(),
    runningMileTimeSec: v.optional(v.number()),
    bikingMileTimeSec: v.optional(v.number()),
    swimming100mPaceSec: v.optional(v.number()),
    lactateThresholdHr: v.optional(v.number()),
    lactateThresholdPaceSec: v.optional(v.number()), // sec per mile
    cyclingFtp: v.optional(v.number()),
    heatAcclimationPct: v.optional(v.number()),
    altitudeAcclimationM: v.optional(v.number()),
    source: sourceValidator,
  }).index("by_user_date", ["userId", "date"]),

  // One row per individual workout — powers the "last 7 runs/rides/swims" lists
  activities: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("run"), v.literal("bike"), v.literal("swim")),
    date: v.string(),
    durationSec: v.number(),
    distanceMeters: v.number(),
    avgPaceSec: v.optional(v.number()), // per mile, or per 100m for swims
    avgHr: v.optional(v.number()),
    calories: v.optional(v.number()),
    garminActivityId: v.optional(v.string()),
  })
    .index("by_user_type_date", ["userId", "type", "date"])
    .index("by_user_date", ["userId", "date"])
    // Lets the sync skip activities it has already imported.
    .index("by_user_garmin_activity", ["userId", "garminActivityId"]),

  // Hydration + nutrition, one row per day
  nutritionLog: defineTable({
    userId: v.id("users"),
    date: v.string(),
    weightLbsAtLog: v.number(),
    baseHydrationMl: v.number(), // weight * 30
    sweatLossMl: v.number(), // from that day's workouts
    creatineBonusMl: v.optional(v.number()), // +750 mL when taking creatine
    hydrationTargetMl: v.number(), // base + sweat + creatine
    waterConsumedMl: v.number(),
    calorieTarget: v.number(),
    proteinTargetG: v.number(),
    caloriesConsumed: v.number(),
    proteinConsumedG: v.number(),
  }).index("by_user_date", ["userId", "date"]),

  weightLog: defineTable({
    userId: v.id("users"),
    date: v.string(),
    weightLbs: v.number(),
  }).index("by_user_date", ["userId", "date"]),

  meals: defineTable({
    userId: v.id("users"),
    date: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
    aiEstimatedCalories: v.number(),
    aiEstimatedProteinG: v.number(),
    aiDescription: v.optional(v.string()),
    loggedAt: v.number(),
  }).index("by_user_date", ["userId", "date"]),

  // Target race — one active event per user at a time.
  events: defineTable({
    userId: v.id("users"),
    name: v.string(),
    eventType: eventTypeValidator,
    eventDate: v.string(), // "YYYY-MM-DD"
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_user_active", ["userId", "isActive"]),

  // AI-generated periodized plan for an event.
  trainingPlan: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
    generatedAt: v.number(),
    weeks: v.array(planWeekValidator),
  }).index("by_user_event", ["userId", "eventId"]),
});
