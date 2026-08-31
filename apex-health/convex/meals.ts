"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const analyzeSuccessValidator = v.object({
  ok: v.literal(true),
  description: v.string(),
  calories: v.number(),
  proteinG: v.number(),
});

const analyzeFailureValidator = v.object({
  ok: v.literal(false),
  rawText: v.string(),
});

/** Ollama Cloud vision models (local-only names like llama3.2-vision 404 here). */
const OLLAMA_MODELS = ["gemma4:31b"] as const;

const MEAL_PROMPT =
  'Identify the food in this image and estimate total calories and grams of protein for the full portion shown. Respond with ONLY strict JSON, no other text: {"description": string, "calories": number, "proteinG": number}';

function parseMealJson(content: string): {
  description: string;
  calories: number;
  proteinG: number;
} | null {
  const trimmed = content.replace(/```json|```/g, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "description" in parsed &&
      "calories" in parsed &&
      "proteinG" in parsed &&
      typeof parsed.description === "string" &&
      typeof parsed.calories === "number" &&
      typeof parsed.proteinG === "number" &&
      Number.isFinite(parsed.calories) &&
      Number.isFinite(parsed.proteinG)
    ) {
      return {
        description: parsed.description,
        calories: Math.round(parsed.calories),
        proteinG: Math.round(parsed.proteinG),
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function callOllamaVision(
  apiKey: string,
  model: string,
  base64Image: string,
): Promise<string> {
  const response = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: MEAL_PROMPT,
          images: [base64Image],
        },
      ],
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

/** Sends a stored meal photo to Ollama Cloud for macro estimation. */
export const analyzeMealPhoto = action({
  args: { storageId: v.id("_storage") },
  returns: v.union(analyzeSuccessValidator, analyzeFailureValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OLLAMA_API_KEY is not configured on the Convex deployment",
      );
    }

    const blob = await ctx.storage.get(args.storageId);
    if (blob === null) {
      throw new Error("Photo not found");
    }

    const base64Image = Buffer.from(await blob.arrayBuffer()).toString(
      "base64",
    );

    let lastRaw = "";
    for (const model of OLLAMA_MODELS) {
      try {
        lastRaw = await callOllamaVision(apiKey, model, base64Image);
        const parsed = parseMealJson(lastRaw);
        if (parsed !== null) {
          return { ok: true as const, ...parsed };
        }
      } catch (error) {
        lastRaw =
          error instanceof Error ? error.message : "Vision model request failed";
      }
    }

    return {
      ok: false as const,
      rawText: lastRaw || "Could not parse a meal estimate from the photo",
    };
  },
});
