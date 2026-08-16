import {
  scoreProducts,
  buildSearchPlan,
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
    num: "40",
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
  const { queries, brandQueries } = buildSearchPlan(productProfile);
  const priceMode = (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";

  if (queries.length === 0) {
    return {
      scoring: {
        user_id: productProfile.user_id,
        photo_url: productProfile.photo_url,
        recommended: null,
        cheaper: null,
        style: null,
        pool: [],
        error: "Bu ürün için sonuç bulunamadı.",
      },
      queryUsed: "",
    };
  }

  if (priceMode === "luks") {
    // One parallel batch: 2 fixed stores (Beymen, Les Benjamins) + 2 rotating
    // stores + 2 luxury pool-brand queries. Single RTT instead of the old
    // conditional two-step, and more brand variety in the pool.
    const luxuryQs = queries.slice(0, 6);
    const batches = await Promise.all(luxuryQs.map((q) => serpShoppingSearch(q, apiKey)));
    const merged = dedupeItems(batches.flat());
    const scoring = scoreProducts(merged, productProfile);

    console.log(
      "SerpAPI luxury parallel:",
      luxuryQs[0],
      `(pool=${scoring.pool.length}, luxury=${scoring.pool.filter((p) => isLuxuryHit(p.source, p.title)).length})`
    );
    return { scoring, queryUsed: luxuryQs[0] || queries[0] || "" };
  }

  // Happy path: brand-suffixed queries first (Bershka / Pull&Bear / …), then one generic core.
  // The plan marks brand queries explicitly — no fragile re-derivation.
  const brandQs = brandQueries.slice(0, 3);
  const genericQs = queries.filter((q) => !brandQueries.includes(q));
  const primary = genericQs[0] || queries[0];
  const parallelQs = [...brandQs, primary].filter(Boolean);
  const uniqueParallel = [...new Set(parallelQs)];

  const batches = await Promise.all(uniqueParallel.map((q) => serpShoppingSearch(q, apiKey)));
  const mergedPrimary = dedupeItems(batches.flat());

  if (mergedPrimary.length) {
    const scoring = scoreProducts(mergedPrimary, productProfile);
    if (!scoring.error) {
      console.log(
        "SerpAPI matched+brands:",
        uniqueParallel.join(" | "),
        `(${mergedPrimary.length} results)`
      );
      return { scoring, queryUsed: brandQs[0] || primary || uniqueParallel[0] || "" };
    }
  }

  const fallbackQs = genericQs.filter((q) => !uniqueParallel.includes(q)).slice(0, 2);
  if (fallbackQs.length === 0) {
    return {
      scoring: scoreProducts(mergedPrimary, productProfile),
      queryUsed: primary || "",
    };
  }

  const fallbackBatches = await Promise.all(
    fallbackQs.map((q) => serpShoppingSearch(q, apiKey))
  );
  const merged = dedupeItems([...mergedPrimary, ...fallbackBatches.flat()]);
  console.log(
    "SerpAPI fallback parallel:",
    fallbackQs.join(" | "),
    `(merged=${merged.length})`
  );
  return {
    scoring: scoreProducts(merged, productProfile),
    queryUsed: primary || fallbackQs[0] || "",
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

export type ProcessPieceOptions = {
  /**
   * Immersive product lookups (extra Serp RTTs).
   * - all: every slot (default, analysis path)
   * - recommended: only the primary pick (faster; combine)
   * - none: skip (fastest; product_link only)
   */
  immersiveMode?: "all" | "recommended" | "none";
  /** Drop shopping titles matching this pattern before scoring slots. */
  denyTitlePattern?: RegExp;
};

export async function processPiece(
  productProfile: ProductProfile,
  occasionKeyword: string,
  serpKey: string,
  affiliateTag: string,
  excludeTitles: Set<string> = new Set(),
  options: ProcessPieceOptions = {}
): Promise<PieceResult | null> {
  if (productProfile.low_confidence) return null;
  const immersiveMode = options.immersiveMode ?? "all";
  const { scoring } = await searchWithFallback(productProfile, serpKey);
  if (scoring.error) return null;

  if (options.denyTitlePattern) {
    const deny = options.denyTitlePattern;
    scoring.pool = scoring.pool.filter((p) => !deny.test(p.title));
    if (scoring.recommended && deny.test(scoring.recommended.title)) {
      scoring.recommended = scoring.pool[0] || null;
    }
    if (scoring.cheaper && deny.test(scoring.cheaper.title)) {
      scoring.cheaper = null;
    }
    if (scoring.style && deny.test(scoring.style.title)) {
      scoring.style = null;
    }
    if (!scoring.recommended) return null;
  }

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

  // Style slot from the same scored pool — no extra Serp round-trip (options unchanged).
  const occasionWords = occasionKeyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const styleProduct =
    (occasionWords.length
      ? scoring.pool.find(
          (p) =>
            !usedTitles.has(p.title) &&
            occasionWords.some((w) => p.title.toLowerCase().includes(w))
        )
      : null) || pickTrustedFallback(scoring.pool, usedTitles);

  const finalScoring: ScoringResult = { ...scoring, style: styleProduct };
  let slots = getSlots(finalScoring);

  if (immersiveMode === "none") {
    const merged = mergeLinks(finalScoring, slots, slots.map(() => null), affiliateTag, productProfile);
    return {
      label: productProfile.category_tr || productProfile.category || "Parça",
      category_tr: productProfile.category_tr,
      results: buildResults(merged),
    };
  }

  const immersiveTargets =
    immersiveMode === "recommended" ? slots.slice(0, 1) : slots;
  let immersiveResponses = await Promise.all(
    immersiveTargets.map(({ product }) =>
      fetchImmersive(product.serpapi_immersive_product_api, serpKey)
    )
  );
  // Pad so mergeLinks index aligns when only recommended was fetched.
  while (immersiveResponses.length < slots.length) immersiveResponses.push(null);

  if (immersiveMode === "all") {
    const previousSlots = slots;
    const replaced = replaceOutOfStockSlots(finalScoring, slots, immersiveResponses);
    const changed = replaced.map((s, i) => s.product.title !== previousSlots[i]?.product.title);
    if (changed.some(Boolean)) {
      slots = replaced;
      immersiveResponses = await Promise.all(
        slots.map(({ product }, i) =>
          changed[i]
            ? fetchImmersive(product.serpapi_immersive_product_api, serpKey)
            : Promise.resolve(immersiveResponses[i])
        )
      );
    }
  }

  const merged = mergeLinks(finalScoring, slots, immersiveResponses, affiliateTag, productProfile);
  return {
    label: productProfile.category_tr || productProfile.category || "Parça",
    category_tr: productProfile.category_tr,
    results: buildResults(merged),
  };
}
