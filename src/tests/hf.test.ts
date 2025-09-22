import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll set env BEFORE importing the module, then import fresh each time
async function importHF() {
  vi.resetModules();
  process.env.HUGGING_FACE_API_KEY = "test-key";
  const mod = await import("@/lib/hf");
  return mod;
}

describe("hfFetch", () => {
  beforeEach(() => {
    vi.resetModules();
    // @ts-ignore
    global.fetch = vi.fn();
  });

  it("caches JSON responses (second call hits cache)", async () => {
    const jsonResp = [{ generated_text: "hello" }];
    // @ts-ignore
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => jsonResp,
      headers: new Headers({ "content-type": "application/json" }),
    });

    const { hfFetch } = await importHF();

    const payload = { inputs: "hi" };
    const a = await hfFetch({ model: "test/model", payload });
    const b = await hfFetch({ model: "test/model", payload });

    expect(a).toEqual(jsonResp);
    expect(b).toEqual(jsonResp);
    expect(global.fetch).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it("returns base64 when Accept is audio/*", async () => {
    const buf = new TextEncoder().encode("AUDIO").buffer;
    // @ts-ignore
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => buf,
      headers: new Headers({ "content-type": "audio/mpeg" }),
    });

    const { hfFetch } = await importHF();

    const res = await hfFetch<{ base64: string; contentType: string}>({
      model: "facebook/mms-tts",
      payload: { inputs: "hello" },
      accept: "audio/mpeg",
    });

    expect(typeof res.base64).toBe("string");
    expect(res.contentType).toBe("audio/mpeg");
  });

  it("retries on 5xx and then succeeds", async () => {
    // First 2 attempts fail, 3rd succeeds
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "err" })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "err" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }), headers: new Headers({}) });

    const { hfFetch } = await importHF();
    const out = await hfFetch({ model: "x/y", payload: { a: 1 } });
    expect(out).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});