type Key = string;

const BUCKET = new Map<Key, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 60s
const MAX_REQUESTS = 20; // per window per ip+route

export function checkRateLimit(ip: string, route: string) {
  const now = Date.now();
  const key = `${ip}:${route}` as Key;
  const entry = BUCKET.get(key);

  if (!entry || now > entry.resetAt) {
    BUCKET.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1, retryAfter: 0 };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { ok: false, remaining: 0, retryAfter: Math.max(0, entry.resetAt - now) };
  }

  entry.count += 1;
  return { ok: true, remaining: Math.max(0, MAX_REQUESTS - entry.count), retryAfter: 0 };
}