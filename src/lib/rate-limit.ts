// Daily per-identifier rate limiting with optional Redis, fallback to in-memory
// Identifier should be user id if available; otherwise IP.

import type { Redis } from "ioredis";

let redis: Redis | null = null;
async function getRedis(): Promise<Redis | null> {
  try {
    if (redis) return redis;
    const url = process.env.REDIS_URL;
    if (!url) return null;
    const { default: IORedis } = await import("ioredis");
    // @ts-ignore
    redis = new IORedis(url);
    return redis;
  } catch {
    return null;
  }
}

const IN_MEMORY = new Map<string, { count: number; resetAt: number }>();

const DAILY_LIMIT = Number(process.env.DAILY_REQUEST_LIMIT || 200);

function todayKey() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

export async function checkRateLimit(identifier: string): Promise<RateResult> {
  const dateKey = todayKey();
  const key = `rate:${identifier}:${dateKey}`;

  // Try Redis first
  const r = await getRedis();
  if (r) {
    const count = await r.incr(key);
    if (count === 1) {
      // Set TTL until end of day UTC
      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const ttl = Math.ceil((end.getTime() - now.getTime()) / 1000);
      await r.expire(key, ttl);
    }
    if (count > DAILY_LIMIT) {
      const ttl = await r.ttl(key);
      return { ok: false, remaining: 0, retryAfter: Math.max(0, ttl) };
    }
    return { ok: true, remaining: Math.max(0, DAILY_LIMIT - count), retryAfter: 0 };
  }

  // Fallback: in-memory fixed window for the day
  const nowMs = Date.now();
  const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)).getTime();
  const entry = IN_MEMORY.get(key);
  if (!entry || nowMs > entry.resetAt) {
    IN_MEMORY.set(key, { count: 1, resetAt: end });
    return { ok: true, remaining: DAILY_LIMIT - 1, retryAfter: 0 };
  }
  if (entry.count >= DAILY_LIMIT) {
    return { ok: false, remaining: 0, retryAfter: Math.max(0, entry.resetAt - nowMs) / 1000 };
  }
  entry.count += 1;
  return { ok: true, remaining: Math.max(0, DAILY_LIMIT - entry.count), retryAfter: 0 };
}

export function getIdentifier(req: Request) {
  // Prefer explicit user id header if present
  const user = req.headers.get("x-user-id");
  if (user) return user;
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0] || "anonymous";
  return ip;
}