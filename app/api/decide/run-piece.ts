import {
  scoreProducts,
  buildSearchQueries,
  pickStyleProduct,
  pickTrustedFallback,
  getSlots,
  mergeLinks,
  buildResults,
  replaceOutOfStockSlots,
  isLuxuryHit,
  type ProductProfile,
  type ScoringResult,
} from "./pipeline";
import type { PieceResult } from "@/components/analyze/types";
import type { PriceMode } from "@/lib/preferences";

const SERPAPI_URL = "https://serpapi.com/search";

interface SerpShoppingItem {
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  thumbnail?: string;
  product_id?: string;
  serpapi_immersive_product_api?: string;
  product_link?: string;
}

function itemKey(item: SerpShoppingItem): string {
  return item.product_id || item.product_link || item.title || "";
}

function dedupeItems(items: SerpShoppingItem[]): SerpShoppingItem[] {
  const seen = new Set<string>();
  const out: SerpShoppingItem[] = [];
  for (const item of items) {
    const key = itemKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function serpShoppingSearch(
  query: string,
  apiKey: string
): Promise<SerpShoppingItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const serpParams = new URLSearchParams({
    engine: "google_shopping",
    q: trimmed,
    api_key: apiKey,
    num: "20",
    gl: "tr",
    hl: "tr",
  });
  const serpRes = await fetch(`${SERPAPI_URL}?${serpParams.toString()}`);
  const serpData = await serpRes.json();

  if (serpData?.error) {
    console.warn("SerpAPI:", trimmed, "→", serpData.error);
    return [];
  }

  return serpData?.shopping_results || [];
}

async function searchWithFallback(
  productProfile: ProductProfile,
  apiKey: string
): Promise<{ scoring: ScoringResult; queryUsed: string }> {
  const queries = buildSearchQueries(productProfile);
  const priceMode = (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";

  if (priceMode === "luks") {
    // Parallel store queries (was sequential ×8) — keeps luxury quality, cuts latency.
    const luxuryQs = queries.slice(0, 4);
    const batches = await Promise.all(luxuryQs.map((q) => serpShoppingSearch(q, apiKey)));
    const merged = dedupeItems(batches.flat());
    let scoring = scoreProducts(merged, productProfile);
    let luxuryCount = scoring.pool.filter((p) => isLuxuryHit(p.source, p.title)).length;

    if (scoring.error || luxuryCount < 3) {
      const extraQs = queries.slice(4, 6);
      if (extraQs.length) {
        const extra = await Promise.all(extraQs.map((q) => serpShoppingSearch(q, apiKey)));
        const merged2 = dedupeItems([...merged, ...extra.flat()]);
        scoring = scoreProducts(merged2, productProfile);
        luxuryCount = scoring.pool.filter((p) => isLuxuryHit(p.source, p.title)).length;
      }
    }

    console.log(
      "SerpAPI luxury parallel:",
      luxuryQs[0],
      `(pool=${scoring.pool.length}, luxury=${luxuryCount})`
    );
    return { scoring, queryUsed: luxuryQs[0] || queries[0] || "" };
  }

  // Non-luks: try primary, then up to 2 fallbacks (max 3 round-trips).
  let lastResults: SerpShoppingItem[] = [];
  for (const query of queries.slice(0, 3)) {
    const results = await serpShoppingSearch(query, apiKey);
    if (results.length === 0) continue;
    lastResults = results;
    const scoring = scoreProducts(results, productProfile);
    if (!scoring.error) {
      console.log("SerpAPI matched:", query, `(${results.length} results)`);
      return { scoring, queryUsed: query };
    }
  }

  return {
    scoring: scoreProducts(lastResults, productProfile),
    queryUsed: queries[0] || "",
  };
}

async function fetchImmersive(url: string | null | undefined, serpKey: string) {
  if (!url) return null;
  try {
    const res = await fetch(`${url}&api_key=${serpKey}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function processPiece(
  productProfile: ProductProfile,
  occasionKeyword: string,
  serpKey: string,
  affiliateTag: string,
  excludeTitles: Set<string> = new Set()
): Promise<PieceResult | null> {
  const { scoring, queryUsed } = await searchWithFallback(productProfile, serpKey);
  if (scoring.error) return null;

  if (excludeTitles.size) {
    scoring.pool = scoring.pool.filter((p) => !excludeTitles.has(p.title));
    if (scoring.recommended && excludeTitles.has(scoring.recommended.title)) {
      scoring.recommended = scoring.pool[0] || null;
    }
    if (scoring.cheaper && excludeTitles.has(scoring.cheaper.title)) {
      scoring.cheaper = null;
    }
    if (!scoring.recommended) return null;
  }

  const usedTitles = new Set(
    [scoring.recommended?.title, scoring.cheaper?.title].filter(Boolean) as string[]
  );
  for (const t of excludeTitles) usedTitles.add(t);

  // Prefer pool for style slot (skip extra Serp round-trip when possible).
  let styleProduct = pickTrustedFallback(scoring.pool, usedTitles);
  if (occasionKeyword && scoring.pool.length < 4) {
    const styleQuery = `${queryUsed} ${occasionKeyword}`.trim();
    const styleResults = await serpShoppingSearch(styleQuery, serpKey);
    styleProduct =
      pickStyleProduct(styleResults, productProfile, usedTitles, occasionKeyword) || styleProduct;
  }

  const finalScoring: ScoringResult = { ...scoring, style: styleProduct };
  let slots = getSlots(finalScoring);
  let immersiveResponses = await Promise.all(
    slots.map(({ product }) => fetchImmersive(product.serpapi_immersive_product_api, serpKey))
  );

  const replaced = replaceOutOfStockSlots(finalScoring, slots, immersiveResponses);
  const needsRefetch = replaced.some((s, i) => s.product.title !== slots[i]?.product.title);
  if (needsRefetch) {
    slots = replaced;
    immersiveResponses = await Promise.all(
      slots.map(({ product }) => fetchImmersive(product.serpapi_immersive_product_api, serpKey))
    );
  }

  const merged = mergeLinks(finalScoring, slots, immersiveResponses, affiliateTag);
  return {
    label: productProfile.category_tr || productProfile.category || "Parça",
    category_tr: productProfile.category_tr,
    results: buildResults(merged),
  };
}
