import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const HF_MODEL = "facebook/mms-tts";

export async function POST(req: Request) {
  try {
    const { text, targetLang } = await req.json();
    if (!text || !targetLang)
      return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || "anonymous";
    const rl = checkRateLimit(ip, "tts");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

    const apiKey = process.env.HUGGING_FACE_API_KEY;
    if (!apiKey)
      return NextResponse.json({ error: "Missing HUGGING_FACE_API_KEY" }, { status: 500 });

    const payload = {
      inputs: text,
      parameters: { language: targetLang },
      options: { wait_for_model: true },
    };

    const r = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}` , {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/wav",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `HF error: ${t}` }, { status: 500 });
    }

    const mime = r.headers.get("content-type") || "audio/wav";
    const arrayBuf = await r.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");

    return NextResponse.json({ audioBase64: base64, mime });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}