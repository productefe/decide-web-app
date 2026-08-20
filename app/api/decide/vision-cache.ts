/**
 * In-memory cache for raw GPT-4o vision JSON, keyed by user + photo + occasion.
 * Best-effort on serverless (survives while the lambda stays warm) — repeated
 * "3 alternatif daha" clicks skip the ~4-8s vision round-trip entirely.
 * Persistent reuse across cold starts comes from search_history.vision_content.
 */

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 100;

const cache = new Map<string, { content: string; expires: number }>();

export function visionCacheKey(userId: string, storagePath: string, occasion: string): string {
  return `${userId}:${storagePath}:${occasion}`;
}

export function getCachedVision(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.content;
}

export function setCachedVision(key: string, content: string): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { content, expires: Date.now() + TTL_MS });
}
