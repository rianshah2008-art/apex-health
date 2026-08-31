/**
 * One-off: probe Ollama Cloud vision models with a real image.
 * Never logs the API key. Run: node scripts/test-ollama-vision.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadApiKey() {
  const envPath = path.join(root, ".env.local");
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, "utf8").match(/OLLAMA_API_KEY=(.+)/);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return execSync("npx convex env get OLLAMA_API_KEY", {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .trim()
    .split("\n")
    .pop()
    .trim();
}

const MEAL_PROMPT =
  'Identify the food in this image and estimate total calories and grams of protein for the full portion shown. Respond with ONLY strict JSON, no other text: {"description": string, "calories": number, "proteinG": number}';

function loadTestImageB64() {
  const candidates = [
    path.join(root, "scripts/fixtures/meal-test.jpg"),
    "/tmp/meal-test.jpg",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p).toString("base64");
    }
  }
  return TEST_JPEG_B64;
}

/** Fallback tiny JPEG if no fixture on disk. */
const TEST_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQID/8QAFhEBAQEAAAAAAAAAAAAAAAAAAAER/9oADAMBAAIQAxAAAAGoH//EABYQAQEBAAAAAAAAAAAAAAAAAAABAv/aAAgBAQABBQLmP//EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAgBAwEBPwGH/8QAFhEBAQEAAAAAAAAAAAAAAAAAAAER/9oACAECAQE/AYf/xAAZEAACAwEAAAAAAAAAAAAAAAABABEhMUFR/9oACAEBAAY/Apn/2gAMAwEAAgADAAAAEPP/xAAZEAACAwEAAAAAAAAAAAAAAAAAAREhQVH/2gAIAQMBAT8Qh//EABkQAAIDAQAAAAAAAAAAAAAAAAERITFBUf/aAAgBAgEBPxCH/8QAGRAAAgMBAAAAAAAAAAAAAAAAAREhMUFR/9oACAEBAAE/EPP/2Q==";

async function listCloudModels(apiKey) {
  const res = await fetch("https://ollama.com/api/tags", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`tags failed (${res.status})`);
  }
  const data = await res.json();
  return (data.models ?? []).map((m) => m.name);
}

async function testVisionModel(apiKey, model, base64Image) {
  const start = Date.now();
  const res = await fetch("https://ollama.com/api/chat", {
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
  const body = await res.text();
  const ms = Date.now() - start;
  let content = "";
  if (res.ok) {
    try {
      const parsed = JSON.parse(body);
      content = parsed?.message?.content ?? "";
    } catch {
      content = body.slice(0, 200);
    }
  }
  const hasJson =
    content.includes('"calories"') && content.includes('"proteinG"');
  return {
    model,
    status: res.status,
    ms,
    ok: res.ok,
    hasJson,
    preview: res.ok ? content.slice(0, 280) : body.slice(0, 120),
  };
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.error("No OLLAMA_API_KEY in .env.local or Convex deployment");
  process.exit(1);
}

const catalog = await listCloudModels(apiKey);
console.log(`Catalog: ${catalog.length} models`);

const toTest = [...new Set(catalog)];
const testImageB64 = loadTestImageB64();
console.log(`Test image: ${Math.round((testImageB64.length * 3) / 4 / 1024)} KB (base64 decoded est.)`);
console.log(`Testing ${toTest.length} catalog models...\n`);

const results = [];
for (const model of toTest) {
  try {
    const r = await testVisionModel(apiKey, model, testImageB64);
    results.push(r);
    const tag = r.ok && r.hasJson ? "PASS" : r.ok ? "OK(no-json)" : "FAIL";
    console.log(`${tag}  ${model}  ${r.status}  ${r.ms}ms`);
    if (!r.ok || !r.hasJson) {
      console.log(`       ${r.preview.replace(/\n/g, " ")}\n`);
    } else {
      console.log(`       ${r.preview.replace(/\n/g, " ")}\n`);
    }
  } catch (err) {
    console.log(`FAIL  ${model}  ${err instanceof Error ? err.message : err}\n`);
  }
}

const winners = results.filter((r) => r.ok && r.hasJson);
console.log("---");
if (winners.length > 0) {
  console.log("Working models (valid meal JSON):");
  for (const w of winners) {
    console.log(`  ${w.model} (${w.ms}ms)`);
  }
} else {
  console.log("No model returned parseable meal JSON.");
  const okOnly = results.filter((r) => r.ok);
  if (okOnly.length > 0) {
    console.log("Models that responded OK but without JSON:");
    for (const w of okOnly) console.log(`  ${w.model}`);
  }
}
