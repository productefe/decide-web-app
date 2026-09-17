/**
 * Persistent vision cache — Supabase table when available, else process memory.
 * Table (optional): search_v2_vision_cache(image_hash, extractor_version, payload, created_at)
 */

type CacheRow = { payload: string; at: number };

const memory = new Map<string, CacheRow>();
const TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function key(imageHash: string, version: string) {
  return `${version}:${imageHash}`;
}

export async function getPersistentVision(
  imageHash: string,
  extractorVersion: string
): Promise<string | null> {
  const k = key(imageHash, extractorVersion);
  const mem = memory.get(k);
  if (mem && Date.now() - mem.at < TTL_MS) return mem.payload;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return mem?.payload || null;

    const res = await fetch(
      `${url}/rest/v1/search_v2_vision_cache?image_hash=eq.${encodeURIComponent(imageHash)}&extractor_version=eq.${encodeURIComponent(extractorVersion)}&select=payload&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        signal: AbortSignal.timeout(2000),
      }
    );
    if (!res.ok) return mem?.payload || null;
    const rows = (await res.json()) as { payload?: string }[];
    const payload = rows[0]?.payload;
    if (payload) {
      memory.set(k, { payload, at: Date.now() });
      return payload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function setPersistentVision(
  imageHash: string,
  extractorVersion: string,
  payload: string
): Promise<void> {
  const k = key(imageHash, extractorVersion);
  memory.set(k, { payload, at: Date.now() });

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return;

    await fetch(`${url}/rest/v1/search_v2_vision_cache`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        image_hash: imageHash,
        extractor_version: extractorVersion,
        payload,
        created_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* ignore */
  }
}

/** Short-TTL query/provider result cache (memory). */
const queryCache = new Map<string, { payload: unknown; at: number }>();
const QUERY_TTL_MS = 1000 * 60 * 20;

export function getQueryCache<T>(cacheKey: string): T | null {
  const hit = queryCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() - hit.at > QUERY_TTL_MS) {
    queryCache.delete(cacheKey);
    return null;
  }
  return hit.payload as T;
}

export function setQueryCache(cacheKey: string, payload: unknown): void {
  queryCache.set(cacheKey, { payload, at: Date.now() });
}
