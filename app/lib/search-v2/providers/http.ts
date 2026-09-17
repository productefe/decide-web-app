export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new TimeoutError(`Timeout ${timeoutMs}ms: ${url.slice(0, 80)}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Simple per-process rate limiter for provider hosts. */
const buckets = new Map<string, { tokens: number; at: number }>();

export async function withRateLimit<T>(
  key: string,
  rps: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.at > 1000) {
    b = { tokens: rps, at: now };
    buckets.set(key, b);
  }
  if (b.tokens <= 0) {
    await new Promise((r) => setTimeout(r, 80));
    return withRateLimit(key, rps, fn);
  }
  b.tokens -= 1;
  return fn();
}
