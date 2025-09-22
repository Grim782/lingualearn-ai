import { NextResponse } from "next/server";
import { checkRateLimit, getIdentifier } from "@/lib/rate-limit";
import { hfFetch } from "@/lib/hf";

const HF_MODEL = "facebook/mms-tts";

export async function POST(req: Request) {
  try {
    const id = getIdentifier(req);
    const rl = await checkRateLimit(id);
    if (!rl.ok)
      return NextResponse.json({ error: "Daily request limit reached. Try again tomorrow." }, { status: 429 });

    const apiKey = process.env.HUGGING_FACE_API_KEY;
    if (!apiKey)
      return NextResponse.json({ error: "Missing HUGGING_FACE_API_KEY" }, { status: 500 });

    // Support both { text, lang } and { text, targetLang }
    const body = await req.json().catch(() => ({} as any));
    const text: string = body?.text || "";
    const lang: string = body?.lang || body?.targetLang || body?.target || "";

    if (!text || !lang)
      return NextResponse.json({ error: "Missing text or lang" }, { status: 400 });

    const payload = {
      inputs: text,
      parameters: { language: lang },
      options: { wait_for_model: true },
    };

    // Request MP3 for better compatibility
    const audio = await hfFetch<{ base64: string; contentType: string }>({
      model: HF_MODEL,
      payload,
      accept: "audio/mpeg",
    });

    return NextResponse.json({
      audio: audio.base64, // new field per spec
      audioBase64: audio.base64, // backward compatible
      mime: audio.contentType || "audio/mpeg",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}