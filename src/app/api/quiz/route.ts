import { NextResponse } from "next/server";
import { checkRateLimit, getIdentifier } from "@/lib/rate-limit";
import { hfFetch } from "@/lib/hf";

const HF_MODEL = "google/flan-t5-large";
const FALLBACK_MODELS = [
  "google/flan-t5-large",
  "google/flan-t5-base",
  "google/flan-t5-small",
];

function buildPrompt(text: string, lang: string, count: number, difficulty?: string) {
  return (
    `You are an expert education assistant. Based on the following study material, generate a quiz as a JSON array of EXACTLY ${count} items. ` +
    `Each item MUST be an object with ONLY these fields: {"question":"...","answer":"..."}. NO multiple choice options and NO extra commentary. ` +
    `Questions and answers must be written in the target language: ${lang}. ` +
    (difficulty ? `Make the difficulty level ${difficulty} (adjust question complexity accordingly). ` : "") +
    `Ensure answers are concise, factual, and directly checkable from the material.\n` +
    `Study Material:\n${text}`
  );
}

function extractJsonArray(raw: string): any[] {
  // Find the first [...] block
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  const jsonStr = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed;
    // If object with questions field
    if (Array.isArray((parsed as any)?.questions)) return (parsed as any).questions;
  } catch {}
  return [];
}

export async function POST(req: Request) {
  try {
    const id = getIdentifier(req);
    const rl = await checkRateLimit(id);
    if (!rl.ok)
      return NextResponse.json({ error: "Daily request limit reached. Try again tomorrow." }, { status: 429 });

    const body = await req.json().catch(() => ({} as any));
    const text: string = body?.text || "";
    const targetLang: string = body?.targetLang || body?.target || body?.lang || "";
    const difficulty: string | undefined = body?.difficulty;
    const requestedCount: number = Math.max(10, Math.min(20, Number(body?.count) || 10));

    if (!text || !targetLang)
      return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });

    if (!process.env.HUGGING_FACE_API_KEY)
      return NextResponse.json({ error: "Missing HUGGING_FACE_API_KEY" }, { status: 500 });

    const prompt = buildPrompt(text, targetLang, requestedCount, difficulty);

    const payload = {
      inputs: prompt,
      parameters: { max_new_tokens: 512, temperature: 0.3 },
      options: { wait_for_model: true },
    };

    let raw = "";
    let lastErr: any = null;
    for (const model of FALLBACK_MODELS) {
      try {
        const data = await hfFetch<any>({ model, payload });
        raw = Array.isArray(data) ? data[0]?.generated_text ?? "" : data?.generated_text ?? "";
        if (raw && typeof raw === "string" && raw.trim().length > 0) {
          break;
        }
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    let items = extractJsonArray(raw);

    // Normalize to short-answer format { question, answer }
    let short = Array.isArray(items)
      ? items.map((q: any, i: number) => ({
          question: String(q?.question ?? q?.q ?? `Question ${i + 1}`),
          answer: String(q?.answer ?? q?.a ?? ""),
        }))
      : [];

    // Pad if the model returned fewer than requestedCount
    if (short.length < requestedCount) {
      const start = short.length;
      for (let i = start; i < requestedCount; i++) {
        short.push({ question: `Key idea ${i + 1}?`, answer: "" });
      }
    }

    // Trim to exactly requestedCount
    short = short.slice(0, requestedCount);

    // Backward-compatible shape expected by UI: { quiz: { mcq: [], short: [...] } }
    const quiz = { mcq: [] as any[], short };

    return NextResponse.json({ questions: short, quiz });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}