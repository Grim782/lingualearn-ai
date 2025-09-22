import { NextResponse } from "next/server";
import { checkRateLimit, getIdentifier } from "@/lib/rate-limit";
import { hfFetch } from "@/lib/hf";

const HF_MODEL = "google/flan-t5-large";

function buildPrompt(text: string, lang: string) {
  return (
    `You are an education assistant. Based on the following study material, generate a quiz as a JSON array of EXACTLY 4 items. ` +
    `Each item must be an object: {"question":"...","options":["A","B","C","D"],"answer":"A"}. ` +
    `The JSON must be valid and concise with NO extra commentary. Use the target language: ${lang}.\n` +
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

    if (!text || !targetLang)
      return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });

    if (!process.env.HUGGING_FACE_API_KEY)
      return NextResponse.json({ error: "Missing HUGGING_FACE_API_KEY" }, { status: 500 });

    const prompt = buildPrompt(text, targetLang) + (difficulty ? `\nDifficulty: ${difficulty}` : "");

    const payload = {
      inputs: prompt,
      parameters: { max_new_tokens: 256, temperature: 0.3 },
      options: { wait_for_model: true },
    };

    const data = await hfFetch<any>({ model: HF_MODEL, payload });
    const raw = Array.isArray(data) ? data[0]?.generated_text ?? "" : data?.generated_text ?? "";

    let questions = extractJsonArray(raw);
    if (!questions.length) {
      // Fallback minimal 4 questions
      questions = [1, 2, 3, 4].map((i) => ({
        question: `Key idea ${i}?`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
      }));
    }

    // Backward-compatible shape expected by UI: { quiz: { mcq: [...], short: [...] } }
    const mcq = questions.filter((q: any) => Array.isArray(q.options) && q.options.length >= 2);
    const short = questions
      .filter((q: any) => !Array.isArray(q.options) || q.options.length < 2)
      .map((q: any) => ({ question: q.question, answer: q.answer || "" }));

    const quiz = { mcq, short };

    return NextResponse.json({ questions, quiz });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}