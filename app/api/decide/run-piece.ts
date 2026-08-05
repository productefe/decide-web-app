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
    num: "30",
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
  let lastResults: SerpShoppingItem[] = [];
  const merged: SerpShoppingItem[] = [];
  const seen = new Set<string>();

  const mergeIn = (results: SerpShoppingItem[]) => {
    for (const item of results) {
      const key = itemKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  };

  // Lüks: first store-targeted queries — merge them to build a luxury pool.
  const queryBudget = priceMode === "luks" ? Math.min(queries.length, 8) : queries.length;

  for (let i = 0; i < queryBudget; i++) {
    const query = queries[i];
    const results = await serpShoppingSearch(query, apiKey);
    if (results.length === 0) continue;

    lastResults = results;
    mergeIn(results);

    const pool = priceMode === "luks" ? merged : results;
    const scoring = scoreProducts(pool, productProfile);
    if (scoring.error) continue;

    if (priceMode === "luks") {
      const luxuryCount = scoring.pool.filter((p) => isLuxuryHit(p.source, p.title)).length;
      // Keep searching until we have enough luxury hits or queries run out.
      if (luxuryCount >= 3) {
        console.log("SerpAPI luxury matched:", query, `(pool=${pool.length}, luxury=${luxuryCount})`);
        return { scoring, queryUsed: query };
      }
      continue;
    }

    console.log("SerpAPI matched:", query, `(${results.length} results)`);
    return { scoring, queryUsed: query };
  }

  const fallbackPool = priceMode === "luks" && merged.length ? merged : lastResults;
  return {
    scoring: scoreProducts(fallbackPool, productProfile),
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

  let styleProduct = null;
  const priceMode = (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";
  if (occasionKeyword) {
    const styleBase =
      priceMode === "luks"
        ? `${queryUsed} ${occasionKeyword} beymen`
        : `${queryUsed} ${occasionKeyword}`;
    const styleResults = await serpShoppingSearch(styleBase.trim(), serpKey);
    styleProduct = pickStyleProduct(styleResults, productProfile, usedTitles, occasionKeyword);
  }
  if (!styleProduct) {
    styleProduct = pickTrustedFallback(scoring.pool, usedTitles);
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
