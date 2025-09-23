import { LRUCache } from "lru-cache";

// Simple HF client with caching + retries. Uses single API key.
// Cache key: method|model|hash(payload)

const apiKey = process.env.HUGGING_FACE_API_KEY;
if (!apiKey) {
  // Do not throw here in module scope to avoid build failures; check at call time instead.
}

const ttlMs = 1000 * 60 * 60 * 6; // 6h
const maxEntries = 500;

const cache = new LRUCache<string, any>({ max: maxEntries, ttl: ttlMs });

function stableHash(input: unknown) {
  const s = typeof input === "string" ? input : JSON.stringify(input);
  let h = 0, i = 0, len = s.length;
  while (i < len) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return h.toString(16);
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export type HFOptions = {
  model: string;
  accept?: string;
  payload: any;
  signal?: AbortSignal;
};

export async function hfFetch<T = any>({ model, payload, accept, signal }: HFOptions): Promise<T> {
  if (!process.env.HUGGING_FACE_API_KEY) throw new Error("Missing HUGGING_FACE_API_KEY");

  const key = `POST|${model}|${stableHash(payload)}|${accept ?? ""}`;
  if (cache.has(key)) return cache.get(key);

  const url = `https://api-inference.huggingface.co/models/${model}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (accept) headers["Accept"] = accept;

  let attempt = 0;
  let lastError: any;
  while (attempt < 3) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      });

      if (res.status === 429 || res.status >= 500) {
        attempt++;
        const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HF error ${res.status}: ${text}`);
      }

      // If accepting audio, return ArrayBuffer; else JSON.
      if (accept && accept.startsWith("audio/")) {
        const buf = await res.arrayBuffer();
        // @ts-ignore Node Buffer available in Node runtime
        const base64 = Buffer.from(buf).toString("base64");
        const value: any = { base64, contentType: res.headers.get("content-type") || accept };
        cache.set(key, value);
        return value as T;
      }

      const json = (await res.json()) as T;
      cache.set(key, json);
      return json;
    } catch (e) {
      lastError = e;
      attempt++;
      if (attempt >= 3) break;
      await sleep(200 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("HF request failed");
}