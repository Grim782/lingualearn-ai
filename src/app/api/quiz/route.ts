import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const HF_MODEL = "google/flan-t5-large";

function buildPrompt(text: string, lang: string) {
  return `You are an education assistant. Based on the following study material, generate a small quiz in JSON with two sections: \n` +
    `{"mcq":[{"question":"...","options":["A","B","C","D"],"answer":"A"}],"short":[{"question":"...","answer":"..."}]}\n` +
    `The JSON must be valid and concise. Use the target language: ${lang}.\n` +
    `Study Material:\n${text}`;
}

export async function POST(req: Request) {
  try {
    const { text, targetLang } = await req.json();
    if (!text || !targetLang)
      return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || "anonymous";
    const rl = checkRateLimit(ip, "quiz");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

    const apiKey = process.env.HUGGING_FACE_API_KEY;
    if (!apiKey)
      return NextResponse.json({ error: "Missing HUGGING_FACE_API_KEY" }, { status: 500 });

    const payload = {
      inputs: buildPrompt(text, targetLang),
      parameters: { max_new_tokens: 256, temperature: 0.3 },
      options: { wait_for_model: true },
    };

    const r = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}` , {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `HF error: ${t}` }, { status: 500 });
    }

    const data = await r.json();
    const raw = Array.isArray(data) ? data[0]?.generated_text ?? "" : data?.generated_text ?? "";

    let quiz;
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const jsonStr = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
      quiz = JSON.parse(jsonStr);
    } catch {
      // Fallback minimal quiz if parsing fails
      quiz = {
        mcq: [
          {
            question: "What is a key idea from the material?",
            options: ["Option A", "Option B", "Option C", "Option D"],
            answer: "Option A",
          },
        ],
        short: [
          { question: "Summarize the main point in one sentence.", answer: "Sample answer." },
        ],
      };
    }

    return NextResponse.json({ quiz });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}