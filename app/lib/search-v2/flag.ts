/**
 * Search V2 feature flag + rollout helpers.
 * SEARCH_V2_ENABLED=false → always V1
 * SEARCH_V2_ENABLED=true (default) → V2 with optional % rollout
 * SEARCH_V2_SHADOW=true → run V2 for metrics but return V1
 * SEARCH_V2_ROLLOUT_PCT=0..100 → sticky hash by user id
 */

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

/** Stable 0–99 bucket from user id (or anonymous salt). */
export function rolloutBucket(userId: string): number {
  let h = 0;
  const s = userId || "anon";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

export function isSearchV2Enabled(userId?: string | null): boolean {
  if (!envBool("SEARCH_V2_ENABLED", true)) return false;
  const pct = Math.max(0, Math.min(100, envInt("SEARCH_V2_ROLLOUT_PCT", 100)));
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return rolloutBucket(userId || "anon") < pct;
}

export function isSearchV2Shadow(): boolean {
  return envBool("SEARCH_V2_SHADOW", false);
}

export const SEARCH_V2_VERSION = "search-v2.1";
// EXTRACTOR_VERSION lives in schema.ts — single source of truth.
