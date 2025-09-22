import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll set env BEFORE importing the module, then import fresh each time

async function importWithLimit(limit: string) {
  vi.resetModules();
  process.env.DAILY_REQUEST_LIMIT = limit;
  const mod = await import("@/lib/rate-limit");
  return mod;
}

describe("rate limiter - daily window", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows up to the configured limit then blocks", async () => {
    const { checkRateLimit } = await importWithLimit("2");
    const id = "test-user-rl-1";

    const r1 = await checkRateLimit(id);
    expect(r1.ok).toBe(true);

    const r2 = await checkRateLimit(id);
    expect(r2.ok).toBe(true);

    const r3 = await checkRateLimit(id);
    expect(r3.ok).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("tracks separately per identifier", async () => {
    const { checkRateLimit } = await importWithLimit("1");
    const a = await checkRateLimit("userA");
    const b = await checkRateLimit("userB");
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const a2 = await checkRateLimit("userA");
    expect(a2.ok).toBe(false);
  });
});