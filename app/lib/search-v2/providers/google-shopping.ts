import { createHash } from "crypto";
import type { ProductCandidate } from "../schema";
import { getQueryCache, setQueryCache } from "../cache";
import { fetchWithTimeout, withRateLimit } from "./http";

const SERP_TIMEOUT_MS = Number(process.env.SEARCH_V2_SERP_TIMEOUT_MS || 6500);

function candidateId(title: string, link: string, productId: string | null): string {
  return createHash("sha1")
    .update(`${productId || ""}|${link}|${title}`)
    .digest("hex")
    .slice(0, 16);
}

function parsePrice(raw: unknown): { price: string; priceValue: number | null } {
  const price = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  const digits = price.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  return { price, priceValue: Number.isFinite(n) && n > 0 ? n : null };
}

function mapShoppingItem(item: Record<string, unknown>, query: string): ProductCandidate | null {
  const title = typeof item.title === "string" ? item.title : "";
  if (!title) return null;
  const link =
    (typeof item.product_link === "string" && item.product_link) ||
    (typeof item.link === "string" && item.link) ||
    "";
  const source = typeof item.source === "string" ? item.source : "";
  const image =
    (typeof item.thumbnail === "string" && item.thumbnail) ||
    (typeof item.image === "string" && item.image) ||
    "";
  const product_id = typeof item.product_id === "string" ? item.product_id : null;
  const immersive =
    typeof item.serpapi_immersive_product_api === "string"
      ? item.serpapi_immersive_product_api
      : null;
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
    serpapi_immersive_product_api: immersive,
    provider: "shopping",
    query,
    thumbnail: image,
  };
}

export async function searchGoogleShopping(opts: {
  apiKey: string;
  query: string;
  num?: number;
}): Promise<ProductCandidate[]> {
  const cacheKey = `shop:${opts.query}:${opts.num || 20}`;
  const cached = getQueryCache<ProductCandidate[]>(cacheKey);
  if (cached) return cached;

  return withRateLimit("serpapi", 8, async () => {
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: opts.query,
      api_key: opts.apiKey,
      hl: "tr",
      gl: "tr",
      num: String(opts.num || 20),
    });
    try {
      const res = await fetchWithTimeout(
        `https://serpapi.com/search.json?${params}`,
        {},
        SERP_TIMEOUT_MS
      );
      const data = (await res.json()) as {
        shopping_results?: Record<string, unknown>[];
        error?: string;
      };
      if (!res.ok || data.error) {
        console.warn("[search-v2] shopping error", data.error || res.status);
        return [];
      }
      const out = (data.shopping_results || [])
        .map((item) => mapShoppingItem(item, opts.query))
        .filter((x): x is ProductCandidate => Boolean(x));
      setQueryCache(cacheKey, out);
      return out;
    } catch (err) {
      console.warn("[search-v2] shopping fail", err instanceof Error ? err.message : err);
      return [];
    }
  });
}
