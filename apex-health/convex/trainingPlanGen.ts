"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { eventTypeValidator, planWeekValidator } from "./schema";
import { assertDateKey, todayKey } from "./lib/dateKeys";
import {
  attachWeekStartDates,
  weeksUntilEvent,
} from "./lib/trainingPlanDates";
import { Doc, Id } from "./_generated/dataModel";

const OLLAMA_TEXT_MODELS = ["gpt-oss:20b", "gemma4:31b"] as const;

const MIN_WEEKS = 4;
const MAX_WEEKS = 52;

const successValidator = v.object({
  ok: v.literal(true),
  eventId: v.id("events"),
  planId: v.id("trainingPlan"),
});

const failureValidator = v.object({
  ok: v.literal(false),
  error: v.string(),
  rawText: v.optional(v.string()),
});

const generateResultValidator = v.union(successValidator, failureValidator);

const EVENT_LABELS: Record<
  | "ironman"
  | "half_ironman"
  | "marathon"
  | "half_marathon"
  | "olympic_triathlon"
  | "sprint_triathlon"
  | "custom",
  string
> = {
  ironman: "Ironman triathlon",
  half_ironman: "Half Ironman triathlon",
  marathon: "Marathon",
  half_marathon: "Half marathon",
  olympic_triathlon: "Olympic-distance triathlon",
  sprint_triathlon: "Sprint triathlon",
  custom: "Custom endurance event",
};

const VALID_PHASES = new Set([
  "base",
  "build",
  "peak",
  "taper",
  "race_week",
]);

const VALID_DISCIPLINES = new Set([
  "swim",
  "bike",
  "run",
  "strength",
  "rest",
  "brick",
]);

function formatPace(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) {
    return "unknown";
  }
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

function normalizePhase(raw: string): string {
  const phase = raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (phase.startsWith("base")) return "base";
  if (phase.startsWith("build")) return "build";
  if (phase.startsWith("peak")) return "peak";
  if (phase.startsWith("taper")) return "taper";
  if (phase.includes("race")) return "race_week";
  return phase;
}

function normalizeDiscipline(raw: string): string {
  const token = raw.trim().toLowerCase().split(/[\s/-]+/)[0] ?? "";
  if (token === "running") return "run";
  if (token === "cycling" || token === "ride") return "bike";
  if (token === "swimming") return "swim";
  if (token === "weights") return "strength";
  return token;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractWeeksArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "weeks" in parsed &&
    Array.isArray(parsed.weeks)
  ) {
    return parsed.weeks;
  }
  return null;
}

type ParsedWeek = {
  weekNumber: number;
  phase: Doc<"trainingPlan">["weeks"][number]["phase"];
  targetHours: number;
  workouts: Doc<"trainingPlan">["weeks"][number]["workouts"];
  notes?: string;
};

function parsePlanJson(content: string): ParsedWeek[] | null {
  const trimmed = content.replace(/```json|```/g, "").trim();
  const start = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const useArray = arrayStart !== -1 && (start === -1 || arrayStart < start);
  const sliceStart = useArray ? arrayStart : start;
  const sliceEnd = useArray ? trimmed.lastIndexOf("]") : trimmed.lastIndexOf("}");
  if (sliceStart === -1 || sliceEnd === -1 || sliceEnd <= sliceStart) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed.slice(sliceStart, sliceEnd + 1));
    const weekRows = extractWeeksArray(parsed);
    if (weekRows === null) {
      return null;
    }

    const weeks: ParsedWeek[] = [];
    for (const week of weekRows) {
      if (typeof week !== "object" || week === null) {
        return null;
      }
      const weekNumber = asNumber("weekNumber" in week ? week.weekNumber : null);
      const targetHours = asNumber("targetHours" in week ? week.targetHours : null);
      if (
        weekNumber === null ||
        targetHours === null ||
        !("phase" in week) ||
        !("workouts" in week) ||
        typeof week.phase !== "string" ||
        !Array.isArray(week.workouts)
      ) {
        return null;
      }

      const phase = normalizePhase(week.phase);
      if (!VALID_PHASES.has(phase)) {
        return null;
      }

      const workouts: ParsedWeek["workouts"] = [];
      for (const workout of week.workouts) {
        if (
          typeof workout !== "object" ||
          workout === null ||
          !("day" in workout) ||
          !("discipline" in workout) ||
          !("description" in workout) ||
          typeof workout.day !== "string" ||
          typeof workout.discipline !== "string" ||
          typeof workout.description !== "string"
        ) {
          return null;
        }
        const discipline = normalizeDiscipline(workout.discipline);
        if (!VALID_DISCIPLINES.has(discipline)) {
          return null;
        }
        const durationMin = asNumber(
          "durationMin" in workout ? workout.durationMin : null,
        );
        workouts.push({
          day: workout.day,
          discipline: discipline as ParsedWeek["workouts"][number]["discipline"],
          description: workout.description,
          durationMin: durationMin === null ? undefined : Math.round(durationMin),
        });
      }

      weeks.push({
        weekNumber: Math.round(weekNumber),
        phase: phase as ParsedWeek["phase"],
        targetHours,
        workouts,
        notes:
          "notes" in week && typeof week.notes === "string"
            ? week.notes
            : undefined,
      });
    }

    return weeks.length > 0 ? weeks : null;
  } catch {
    return null;
  }
}

function buildPrompt(args: {
  eventType: keyof typeof EVENT_LABELS;
  eventName: string;
  eventDate: string;
  weeksOut: number;
  fitness: {
    weightLbs: number | null;
    heightIn: number | null;
    runningMileTimeSec: number | null;
    bikingMileTimeSec: number | null;
    swimming100mPaceSec: number | null;
    lactateThresholdHr: number | null;
    lactateThresholdPaceSec: number | null;
    cyclingFtp: number | null;
    trainingReadiness: number | null;
    hrvStatus: string | null;
    loadRatio: number | null;
  };
}): string {
  const label = EVENT_LABELS[args.eventType];
  return `Generate a periodized ${label} training plan for an athlete with:
- Event: ${args.eventName}
- Weight: ${args.fitness.weightLbs ?? "unknown"} lbs
- Height: ${args.fitness.heightIn ?? "unknown"} inches
- Current running mile time: ${formatPace(args.fitness.runningMileTimeSec)}
- Current biking mile time: ${formatPace(args.fitness.bikingMileTimeSec)}
- Current swim pace: ${formatPace(args.fitness.swimming100mPaceSec)} per 100m
- Lactate threshold HR: ${args.fitness.lactateThresholdHr ?? "unknown"} bpm
- Lactate threshold pace: ${formatPace(args.fitness.lactateThresholdPaceSec)} /mi
- Cycling FTP: ${args.fitness.cyclingFtp ?? "unknown"} W
- Training readiness: ${args.fitness.trainingReadiness ?? "unknown"}/100
- HRV status: ${args.fitness.hrvStatus ?? "unknown"}
- Acute/chronic load ratio: ${args.fitness.loadRatio ?? "unknown"}
- Weeks until race: ${args.weeksOut}
- Event date: ${args.eventDate}

Structure the plan in standard phases (base, build, peak, taper, race_week) proportional to the weeks available. Week 1 is the furthest from the race; the final week is race_week. Include exactly ${args.weeksOut} weeks.

Each week should list 4-6 key workouts (not every calendar day). Keep workout descriptions under 60 characters. Return compact JSON only — no markdown fences or commentary.

Respond with ONLY strict JSON matching this shape:
{
  "weeks": [
    {
      "weekNumber": number,
      "phase": "base" | "build" | "peak" | "taper" | "race_week",
      "targetHours": number,
      "workouts": [
        {
          "day": "Monday",
          "discipline": "swim" | "bike" | "run" | "strength" | "rest" | "brick",
          "description": string,
          "durationMin": number
        }
      ],
      "notes": string
    }
  ]
}`;
}

async function callOllamaText(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${body}`);
  }

  const data: unknown = await response.json();
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "object" &&
    data.message !== null &&
    "content" in data.message &&
    typeof data.message.content === "string"
  ) {
    return data.message.content;
  }

  throw new Error("Unexpected Ollama response shape");
}

async function generateWeeksFromOllama(
  apiKey: string,
  prompt: string,
): Promise<{ weeks: ParsedWeek[] | null; rawText: string }> {
  let lastRaw = "";
  for (const model of OLLAMA_TEXT_MODELS) {
    try {
      lastRaw = await callOllamaText(apiKey, model, prompt);
      console.log(`[trainingPlanGen] raw Ollama response (${model}):`, lastRaw);
      const parsed = parsePlanJson(lastRaw);
      if (parsed !== null) {
        return { weeks: parsed, rawText: lastRaw };
      }
    } catch (error) {
      lastRaw =
        error instanceof Error ? error.message : "Text model request failed";
      console.log(`[trainingPlanGen] Ollama error (${model}):`, lastRaw);
    }
  }
  return { weeks: null, rawText: lastRaw };
}

function enrichWeeks(
  eventDate: string,
  parsedWeeks: ParsedWeek[],
): Doc<"trainingPlan">["weeks"] {
  const startDates = attachWeekStartDates(
    eventDate,
    parsedWeeks.map((week) => ({ weekNumber: week.weekNumber })),
  );
  const sorted = [...parsedWeeks].sort((a, b) => a.weekNumber - b.weekNumber);
  return sorted.map((week, index) => ({
    weekStartDate: startDates[index] ?? assertDateKey(eventDate),
    weekNumber: week.weekNumber,
    phase: week.phase,
    targetHours: week.targetHours,
    workouts: week.workouts,
    notes: week.notes,
  }));
}

async function runGeneration(
  ctx: ActionCtx,
  userId: Doc<"users">["_id"],
  args: {
    name: string;
    eventType: keyof typeof EVENT_LABELS;
    eventDate: string;
    heightIn?: number;
    existingEventId?: Doc<"events">["_id"];
  },
): Promise<
  | { ok: true; eventId: Doc<"events">["_id"]; planId: Doc<"trainingPlan">["_id"] }
  | { ok: false; error: string; rawText?: string }
> {
  assertDateKey(args.eventDate);
  const today = todayKey();
  const weeksOut = weeksUntilEvent(args.eventDate, today);

  if (weeksOut < MIN_WEEKS) {
    return {
      ok: false,
      error: `Event is only ${weeksOut} week(s) away — need at least ${MIN_WEEKS} weeks for periodization.`,
    };
  }
  if (weeksOut > MAX_WEEKS) {
    return {
      ok: false,
      error: `Event is ${weeksOut} weeks out — generate a plan within ${MAX_WEEKS} weeks of race day.`,
    };
  }

  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "OLLAMA_API_KEY is not configured on the Convex deployment",
    };
  }

  const fitness: {
    weightLbs: number | null;
    heightIn: number | null;
    runningMileTimeSec: number | null;
    bikingMileTimeSec: number | null;
    swimming100mPaceSec: number | null;
    lactateThresholdHr: number | null;
    lactateThresholdPaceSec: number | null;
    cyclingFtp: number | null;
    trainingReadiness: number | null;
    hrvStatus: string | null;
    loadRatio: number | null;
  } = await ctx.runQuery(internal.trainingPlanStore.loadFitnessContext, {
    userId,
  });

  const prompt = buildPrompt({
    eventType: args.eventType,
    eventName: args.name,
    eventDate: args.eventDate,
    weeksOut,
    fitness,
  });

  const { weeks: parsedWeeks, rawText } = await generateWeeksFromOllama(
    apiKey,
    prompt,
  );

  if (parsedWeeks === null) {
    return {
      ok: false,
      error: "Could not parse a training plan from the model response",
      rawText,
    };
  }

  const weeks = enrichWeeks(args.eventDate, parsedWeeks);

  if (args.existingEventId !== undefined) {
    const planId: Doc<"trainingPlan">["_id"] = await ctx.runMutation(
      internal.trainingPlanStore.replacePlanForEvent,
      {
        userId,
        eventId: args.existingEventId,
        weeks,
        heightIn: args.heightIn,
      },
    );
    return { ok: true, eventId: args.existingEventId, planId };
  }

  const saved: { eventId: Doc<"events">["_id"]; planId: Doc<"trainingPlan">["_id"] } =
    await ctx.runMutation(internal.trainingPlanStore.saveGeneratedPlan, {
      userId,
      name: args.name,
      eventType: args.eventType,
      eventDate: args.eventDate,
      heightIn: args.heightIn,
      weeks,
    });

  return { ok: true, ...saved };
}

/** Creates an active event and generates a periodized plan from current fitness data. */
export const generateTrainingPlan = action({
  args: {
    name: v.string(),
    eventType: eventTypeValidator,
    eventDate: v.string(),
    heightIn: v.optional(v.number()),
  },
  returns: generateResultValidator,
  handler: async (ctx, args): Promise<
    | { ok: true; eventId: Id<"events">; planId: Id<"trainingPlan"> }
    | { ok: false; error: string; rawText?: string }
  > => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    return await runGeneration(ctx, userId, args);
  },
});

/** Re-runs plan generation for the current active event using fresh fitness data. */
export const regenerateTrainingPlan = action({
  args: {
    heightIn: v.optional(v.number()),
  },
  returns: generateResultValidator,
  handler: async (ctx, args): Promise<
    | { ok: true; eventId: Id<"events">; planId: Id<"trainingPlan"> }
    | { ok: false; error: string; rawText?: string }
  > => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const active: {
      _id: Id<"events">;
      name: string;
      eventType: keyof typeof EVENT_LABELS;
      eventDate: string;
      isActive: boolean;
      createdAt: number;
    } | null = await ctx.runQuery(
      internal.trainingPlanStore.getActiveEventInternal,
      { userId },
    );
    if (active === null) {
      return { ok: false as const, error: "No active event to regenerate" };
    }

    return await runGeneration(ctx, userId, {
      name: active.name,
      eventType: active.eventType,
      eventDate: active.eventDate,
      heightIn: args.heightIn,
      existingEventId: active._id,
    });
  },
});

/** Isolated Ollama smoke test — logs raw model output without saving a plan. */
export const testOllamaPlanPrompt = action({
  args: {
    eventType: eventTypeValidator,
    eventDate: v.string(),
    weeksOut: v.optional(v.number()),
  },
  returns: v.object({
    prompt: v.string(),
    rawText: v.string(),
    parsed: v.union(v.array(planWeekValidator), v.null()),
  }),
  handler: async (ctx, args): Promise<{
    prompt: string;
    rawText: string;
    parsed: Doc<"trainingPlan">["weeks"] | null;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      throw new Error("OLLAMA_API_KEY is not configured on the Convex deployment");
    }

    const fitness = await ctx.runQuery(internal.trainingPlanStore.loadFitnessContext, {
      userId,
    });
    const weeksOut = args.weeksOut ?? weeksUntilEvent(args.eventDate);
    const prompt = buildPrompt({
      eventType: args.eventType,
      eventName: "Test Event",
      eventDate: args.eventDate,
      weeksOut,
      fitness,
    });

    const { weeks, rawText } = await generateWeeksFromOllama(apiKey, prompt);
    return {
      prompt,
      rawText,
      parsed: weeks === null ? null : enrichWeeks(args.eventDate, weeks),
    };
  },
});
