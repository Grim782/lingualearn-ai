import { NextResponse } from "next/server";
import { checkRateLimit, getIdentifier } from "@/lib/rate-limit";
import { hfFetch } from "@/lib/hf";
import { splitIntoChunks } from "@/lib/chunk";

const HF_MODEL = "facebook/nllb-200-distilled-600M";

// Map simple BCP-47-ish codes to NLLB language tags (tgt_lang)
const NLLB_TGT_MAP: Record<string, string> = {
  en: "eng_Latn",
  es: "spa_Latn",
  fr: "fra_Latn",
  de: "deu_Latn",
  ar: "arb_Arab",
  hi: "hin_Deva",
  zh: "zho_Hans",
  ja: "jpn_Jpan",
};

// Default source language assumption for NLLB (notes typically in English)
const NLLB_DEFAULT_SRC = "eng_Latn";

async function readTextFromForm(form: FormData): Promise<{ text: string; warnings: string[] }> {
  const warnings: string[] = [];
  const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 5);
  const maxBytes = maxMb * 1024 * 1024;

  const textField = form.get("text");
  if (typeof textField === "string" && textField.trim().length) {
    return { text: textField, warnings };
  }

  const file = form.get("file");
  if (file && file instanceof File) {
    if (file.size > maxBytes) {
      throw new Response(JSON.stringify({ error: `File too large. Max ${maxMb}MB` }), { status: 413 });
    }
    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();
    const ab = await file.arrayBuffer();
    // .docx using mammoth
    if (name.endsWith(".docx") || type.includes("officedocument.wordprocessingml")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: ab as any });
      return { text: result.value || "", warnings };
    }
    // .pdf using pdf-parse
    if (name.endsWith(".pdf") || type.includes("pdf")) {
      const pdfParse: any = (await import("pdf-parse")).default;
      // @ts-ignore Buffer available in Node runtime
      const buf = Buffer.from(ab);
      const result = await pdfParse(buf);
      return { text: String(result.text || ""), warnings };
    }
    // Fallback: treat as text
    const text = new TextDecoder().decode(ab);
    return { text, warnings };
  }

  return { text: "", warnings };
}

function readTextFromJson(body: any): { text: string; warnings: string[] } {
  const text = typeof body?.text === "string" ? body.text : "";
  return { text, warnings: [] };
}

async function readTextFromRequest(req: Request): Promise<{ text: string; warnings: string[] }> {
  const warnings: string[] = [];
  const ctype = req.headers.get("content-type") || "";
  const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 5);
  const maxBytes = maxMb * 1024 * 1024;

  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const textField = form.get("text");
    if (typeof textField === "string" && textField.trim().length) {
      return { text: textField, warnings };
    }
    if (file && file instanceof File) {
      if (file.size > maxBytes) {
        throw new Response(JSON.stringify({ error: `File too large. Max ${maxMb}MB` }), { status: 413 });
      }
      const name = (file.name || "").toLowerCase();
      const type = (file.type || "").toLowerCase();
      const ab = await file.arrayBuffer();
      // .docx using mammoth
      if (name.endsWith(".docx") || type.includes("officedocument.wordprocessingml")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer: ab as any });
        return { text: result.value || "", warnings };
      }
      // .pdf using pdf-parse
      if (name.endsWith(".pdf") || type.includes("pdf")) {
        const pdfParse: any = (await import("pdf-parse")).default;
        // @ts-ignore Buffer available in Node runtime
        const buf = Buffer.from(ab);
        const result = await pdfParse(buf);
        return { text: String(result.text || ""), warnings };
      }
      // Fallback: treat as text
      const text = new TextDecoder().decode(ab);
      return { text, warnings };
    }
    return { text: "", warnings };
  }

  // JSON body fallback
  const { text } = await req.json().catch(() => ({ text: "" }));
  return { text: typeof text === "string" ? text : "", warnings };
}

export async function POST(req: Request) {
  try {
    const id = getIdentifier(req);
    const rl = await checkRateLimit(id);
    if (!rl.ok) return NextResponse.json({ error: "Daily request limit reached. Try again tomorrow." }, { status: 429 });

    const apiKey = process.env.HUGGING_FACE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing HUGGING_FACE_API_KEY" }, { status: 500 });

    // Accept both JSON and multipart; also support "target" | "targetLang"
    const ctype = req.headers.get("content-type") || "";
    let target = "";
    let extractedText = "";
    let w: string[] = [];

    if (ctype.includes("application/json")) {
      const body = await req.json();
      target = body.target || body.targetLang || "";
      const r = readTextFromJson(body);
      extractedText = r.text;
      w = r.warnings;
    } else if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      target = String(form.get("target") || form.get("targetLang") || "");
      const r = await readTextFromForm(form);
      extractedText = r.text;
      w = r.warnings;
    }

    if (!target) return NextResponse.json({ error: "Missing target language" }, { status: 400 });

    const text = extractedText;
    if (!text || !text.trim()) return NextResponse.json({ error: "Missing text" }, { status: 400 });

    const { chunks, warnings } = splitIntoChunks(text);
    const allWarnings = [...w, ...warnings];

    let translatedParts: string[] = [];
    for (const chunk of chunks) {
      // Resolve NLLB target tag
      const tgt = NLLB_TGT_MAP[target.toLowerCase()];
      if (!tgt) {
        return NextResponse.json(
          { error: `Unsupported target language: ${target}. Supported: ${Object.keys(NLLB_TGT_MAP).join(", ")}` },
          { status: 400 }
        );
      }

      // Primary payload for NLLB: requires tgt_lang, src_lang recommended
      const payload = {
        inputs: chunk,
        parameters: { tgt_lang: tgt, src_lang: NLLB_DEFAULT_SRC },
        options: { wait_for_model: true },
      } as const;
      const data = await hfFetch<any>({ model: HF_MODEL, payload });
      const piece = Array.isArray(data)
        ? data[0]?.translation_text ?? data[0]?.generated_text ?? ""
        : data?.generated_text ?? data?.translation_text ?? "";
      translatedParts.push(piece);
    }

    const translation = translatedParts.join("\n\n");

    return NextResponse.json({ translation, translated: translation, warnings: allWarnings, chunks: chunks.length });
  } catch (e: any) {
    if (e instanceof Response) return e; // already formatted (e.g., 413)
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}