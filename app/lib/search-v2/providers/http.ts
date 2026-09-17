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

/** Resolve with fallback if `promise` does not settle in `ms`. Does not cancel the promise. */
export function raceTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  if (ms <= 0) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

/** Hard cap on in-flight SerpAPI calls so a 4-piece outfit cannot stampede. */
const SERP_CONCURRENCY = 5;
let serpActive = 0;
const serpWaiters: Array<() => void> = [];

export async function withSerpSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (serpActive >= SERP_CONCURRENCY) {
    await new Promise<void>((resolve) => serpWaiters.push(resolve));
  }
  serpActive++;
  try {
    return await fn();
  } finally {
    serpActive--;
    serpWaiters.shift()?.();
  }
}
