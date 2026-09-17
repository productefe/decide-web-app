import { createHash } from "crypto";
import type { ProductCandidate } from "../schema";
import { getQueryCache, setQueryCache } from "../cache";
import { fetchWithTimeout, withSerpSlot } from "./http";
import { dbg } from "../debug-log";

const SERP_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.SEARCH_V2_SERP_TIMEOUT_MS || 12000) || 12000
);

function lensUrlUsable(url: string): boolean {
  if (!url || url.startsWith("data:")) return false;
  try {
    const host = new URL(url).hostname;
    // SerpAPI must fetch this URL itself; private storage hosts time out.
    if (host.includes("supabase.co") || host.includes("supabase.in")) return false;
    return true;
  } catch {
    return false;
  }
}

function candidateId(title: string, link: string, productId: string | null): string {
  return createHash("sha1")
    .update(`lens|${productId || ""}|${link}|${title}`)
    .digest("hex")
    .slice(0, 16);
}

function parsePrice(raw: unknown): { price: string; priceValue: number | null } {
  const price = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  const digits = price.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  return { price, priceValue: Number.isFinite(n) && n > 0 ? n : null };
}

function mapLensItem(item: Record<string, unknown>, query: string): ProductCandidate | null {
  const title =
    (typeof item.title === "string" && item.title) ||
    (typeof item.source === "string" && item.source) ||
    "";
  if (!title || title.length < 3) return null;
  const link =
    (typeof item.link === "string" && item.link) ||
    (typeof item.product_link === "string" && item.product_link) ||
    "";
  const source =
    (typeof item.source === "string" && item.source) ||
    (typeof item.store === "string" && item.store) ||
    "";
  const image =
    (typeof item.thumbnail === "string" && item.thumbnail) ||
    (typeof item.image === "string" && item.image) ||
    "";
  const product_id =
    (typeof item.product_id === "string" && item.product_id) ||
    (typeof item.token === "string" && item.token) ||
    null;
  const { price, priceValue } = parsePrice(item.price);
  return {
    id: candidateId(title, link, product_id),
    title,
    price,
    priceValue,
    source,
    store: source.split(/[-–]/)[0]?.trim() || source || "Mağaza",
    image,
    link,
    product_id,
    serpapi_immersive_product_api: null,
    provider: "lens",
    query,
    thumbnail: image,
  };
}

/**
 * Google Lens via SerpAPI — prefers products / visual_matches channels.
 * Uses public photo_url when available (Lens needs a fetchable image URL).
 */
export async function searchGoogleLens(opts: {
  apiKey: string;
  imageUrl: string;
  num?: number;
}): Promise<ProductCandidate[]> {
  if (!lensUrlUsable(opts.imageUrl)) {
    // #region agent log
    dbg("E", "google-lens.ts:skip", "lens skipped unusable url", {
      kind: !opts.imageUrl ? "empty" : opts.imageUrl.startsWith("data:") ? "data_url" : "private_host",
    });
    // #endregion
    return [];
  }

  const cacheKey = `lens:${createHash("sha1").update(opts.imageUrl).digest("hex").slice(0, 16)}`;
  const cached = getQueryCache<ProductCandidate[]>(cacheKey);
  if (cached) return cached;

  return withSerpSlot(async () => {
    const params = new URLSearchParams({
      engine: "google_lens",
      url: opts.imageUrl,
      api_key: opts.apiKey,
      hl: "tr",
      country: "tr",
    });
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(
        `https://serpapi.com/search.json?${params}`,
        {},
        SERP_TIMEOUT_MS
      );
      const data = (await res.json()) as {
        visual_matches?: Record<string, unknown>[];
        shopping_results?: Record<string, unknown>[];
        products?: Record<string, unknown>[];
        error?: string;
      };
      if (!res.ok || data.error) {
        // #region agent log
        dbg("E", "google-lens.ts:error", "lens provider error", {
          status: res.status,
          timeoutMs: SERP_TIMEOUT_MS,
          elapsedMs: Date.now() - t0,
          error: data.error || null,
          host: (() => {
            try {
              return new URL(opts.imageUrl).host;
            } catch {
              return "invalid";
            }
          })(),
        });
        // #endregion
        console.warn("[search-v2] lens error", data.error || res.status);
        return [];
      }
      const raw = [
        ...(data.products || []),
        ...(data.shopping_results || []),
        ...(data.visual_matches || []),
      ];
      const seen = new Set<string>();
      const out: ProductCandidate[] = [];
      for (const item of raw) {
        const c = mapLensItem(item, "lens");
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
        if (out.length >= (opts.num || 24)) break;
      }
      // #region agent log
      dbg("E", "google-lens.ts:ok", "lens response", {
        timeoutMs: SERP_TIMEOUT_MS,
        elapsedMs: Date.now() - t0,
        resultCount: out.length,
        rawCount: raw.length,
      });
      // #endregion
      setQueryCache(cacheKey, out);
      return out;
    } catch (err) {
      // #region agent log
      dbg("E", "google-lens.ts:fail", "lens exception", {
        timeoutMs: SERP_TIMEOUT_MS,
        elapsedMs: Date.now() - t0,
        error: err instanceof Error ? err.message.slice(0, 120) : String(err),
      });
      // #endregion
      console.warn("[search-v2] lens fail", err instanceof Error ? err.message : err);
      return [];
    }
  });
}
