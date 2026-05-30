/**
 * In-memory sliding window rate limiter.
 * Per-isolate (not globally exact) — acceptable for DoS protection at current scale.
 * Upgrade to KV counters when global precision is needed.
 */

/** Shared store: key → array of request timestamps (ms) */
const store = new Map<string, number[]>();

export class SlidingWindowLimiter {
  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /**
   * Returns true if the request is allowed, false if rate-limited.
   * Evicts stale timestamps on every call to bound memory growth.
   */
  check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let timestamps = store.get(key) ?? [];
    // Evict entries outside the current window
    timestamps = timestamps.filter((t) => t > cutoff);
    if (timestamps.length >= this.limit) {
      store.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    store.set(key, timestamps);
    return true;
  }
}

/** 60 req/min per IP — for unauthenticated routes */
export const ipLimiter = new SlidingWindowLimiter(60, 60_000);

/** 120 req/min per user-id — for authenticated routes */
export const userLimiter = new SlidingWindowLimiter(120, 60_000);

/** Returns a 429 Response with Retry-After header */
export function rateLimitResponse(origin: string): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "60",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
