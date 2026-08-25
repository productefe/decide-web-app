import {
  scoreProducts,
  buildSearchPlan,
  pickTrustedFallback,
  getSlots,
  mergeLinks,
  buildResults,
  titleIsExcluded,
  hasProductOverlap,
  rememberProduct,
  isAccessoryProfile,
  typeTokenTr,
  sanitizeAccessoryQuery,
  productDedupeKeys,
  LUXURY_SEARCH_STORES,
  type ProductProfile,
  type ScoringResult,
} from "./pipeline";
import { pickDecidePoolBrands } from "@/constants/brandPool";
import type { PieceResult } from "@/components/analyze/types";
import { parseOccasion, type PriceMode } from "@/lib/preferences";
import { asLower } from "@/lib/text";
import { occasionTitleFit, pieceBlobForOccasion } from "@/lib/occasion-guide";

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

/**
 * Safety cap for hung Serp calls. Wall-clock is dominated by waiting for the
 * slowest query in a Promise.all — we instead settle as soon as the pool is
 * filled, so this timeout only matters when every query is slow/stuck.
 */
const SERP_TIMEOUT_MS = 8_000;

async function serpShoppingSearch(
  query: string,
  apiKey: string,
  num = 12
): Promise<SerpShoppingItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const serpParams = new URLSearchParams({
    engine: "google_shopping",
    q: trimmed,
    api_key: apiKey,
    num: String(num),
    gl: "tr",
    hl: "tr",
  });
  try {
    const serpRes = await fetch(`${SERPAPI_URL}?${serpParams.toString()}`, {
      signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
    });
    const serpData = await serpRes.json();

    if (serpData?.error) {
      console.warn("SerpAPI:", trimmed, "→", serpData.error);
      return [];
    }

    return serpData?.shopping_results || [];
  } catch (err) {
    const aborted = err instanceof Error && err.name === "TimeoutError";
    console.warn("SerpAPI:", trimmed, "→", aborted ? `timeout ${SERP_TIMEOUT_MS}ms` : String(err));
    return [];
  }
}

function emptyScoring(productProfile: ProductProfile): ScoringResult {
  return {
    user_id: productProfile.user_id,
    photo_url: productProfile.photo_url,
    recommended: null,
    cheaper: null,
    style: null,
    pool: [],
    error: "Bu ürün için sonuç bulunamadı.",
  };
}

/** Shopping results already include a merchant URL — immersive would not change the card. */
export function linkNeedsImmersive(link: string | null | undefined): boolean {
  const raw = (link || "").trim();
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return true;
    if (/(^|\.)google\.(com|com\.tr)$/.test(host)) return true;
    if (host.includes("googleusercontent.com")) return true;
    return false;
  } catch {
    return true;
  }
}

function poolSurvivesExclude(
  scoring: ScoringResult,
  excludeTitles: Set<string>
): number {
  if (!excludeTitles.size) return scoring.pool.length;
  return scoring.pool.filter((p) => !titleIsExcluded(p.title, excludeTitles)).length;
}

/**
 * Fire queries in parallel but do not wait for the slowest. As soon as enough
 * unique products exist (after excludeTitles), return; stragglers are ignored.
 */
async function searchQueries(
  queries: string[],
  productProfile: ProductProfile,
  apiKey: string,
  num = 12,
  minPool = 3,
  excludeTitles: Set<string> = new Set()
): Promise<{ scoring: ScoringResult; queryUsed: string; items: SerpShoppingItem[] }> {
  const ordered = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  if (ordered.length === 0) {
    return { scoring: emptyScoring(productProfile), queryUsed: "", items: [] };
  }

  const collected: SerpShoppingItem[] = [];
  let pending = ordered.length;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (why: string) => {
      if (settled) return;
      settled = true;
      const items = dedupeItems(collected);
      const scoring = scoreProducts(items, productProfile);
      console.log(
        "SerpAPI parallel:",
        ordered.join(" | "),
        `(pool=${scoring.pool.length}, alive=${poolSurvivesExclude(scoring, excludeTitles)}, ${why})`
      );
      resolve({ scoring, queryUsed: ordered[0], items });
    };

    for (const q of ordered) {
      void serpShoppingSearch(q, apiKey, num)
        .then((batch) => {
          if (settled) return;
          collected.push(...batch);
          pending--;
          const scoring = scoreProducts(dedupeItems(collected), productProfile);
          const alive = poolSurvivesExclude(scoring, excludeTitles);
          if (alive >= minPool) finish("early");
          else if (pending <= 0) finish("complete");
        })
        .catch(() => {
          if (settled) return;
          pending--;
          if (pending <= 0) finish("complete");
        });
    }
  });
}

function compactExtraLimit(_searchMode: "full" | "compact"): number {
  return 2;
}

async function searchWithFallback(
  productProfile: ProductProfile,
  apiKey: string,
  rotation = 0,
  searchMode: "full" | "compact" = "full",
  excludeTitles: Set<string> = new Set()
): Promise<{ scoring: ScoringResult; queryUsed: string }> {
  const { queries, brandQueries, luxuryQueries } = buildSearchPlan(productProfile, rotation);
  const priceMode = (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";
  const compact = searchMode === "compact";
  const serpNum = compact ? 8 : 12;
  const minPool = excludeTitles.size ? Math.min(6, excludeTitles.size + 3) : 3;

  if (queries.length === 0) {
    return { scoring: emptyScoring(productProfile), queryUsed: "" };
  }

  if (priceMode === "luks") {
    const genericLuks = queries.filter(
      (q) => !luxuryQueries.includes(q) && !brandQueries.includes(q)
    );
    const firstBatch = compact
      ? [...new Set([luxuryQueries[0], genericLuks[0] || luxuryQueries[1]].filter(Boolean))]
      : [...new Set([...luxuryQueries.slice(0, 2), genericLuks[0]].filter(Boolean))];
    const result = await searchQueries(
      firstBatch,
      productProfile,
      apiKey,
      serpNum,
      minPool,
      excludeTitles
    );
    if (!result.scoring.error && poolSurvivesExclude(result.scoring, excludeTitles) > 0) {
      return { scoring: result.scoring, queryUsed: result.queryUsed };
    }
    if (compact) return { scoring: result.scoring, queryUsed: result.queryUsed };

    const luksFallback = genericLuks.filter((q) => !firstBatch.includes(q)).slice(0, 2);
    if (luksFallback.length === 0) {
      return { scoring: result.scoring, queryUsed: result.queryUsed };
    }
    const extra = await searchQueries(
      luksFallback,
      productProfile,
      apiKey,
      serpNum,
      minPool,
      excludeTitles
    );
    const scoring = scoreProducts(
      dedupeItems([...result.items, ...extra.items]),
      productProfile
    );
    console.log("SerpAPI lüks fallback:", luksFallback.join(" | "), `(pool=${scoring.pool.length})`);
    return { scoring, queryUsed: result.queryUsed || extra.queryUsed || "" };
  }

  // Full karma: 1 brand + 1 primary + 1 luxury (was 3+1+2). Compact stays 1+1.
  const brandQs = brandQueries.slice(0, 1);
  const genericQs = queries.filter(
    (q) => !brandQueries.includes(q) && !luxuryQueries.includes(q)
  );
  const primary = genericQs[0] || queries[0];
  const luxQs = compact ? [] : priceMode === "karma" ? luxuryQueries.slice(0, 1) : [];
  const uniqueParallel = [...new Set([...brandQs, primary, ...luxQs].filter(Boolean))];

  const firstPass = await searchQueries(
    uniqueParallel,
    productProfile,
    apiKey,
    serpNum,
    minPool,
    excludeTitles
  );
  if (poolSurvivesExclude(firstPass.scoring, excludeTitles) > 0 || compact) {
    return { scoring: firstPass.scoring, queryUsed: firstPass.queryUsed };
  }

  const fallbackQs = genericQs.filter((q) => !uniqueParallel.includes(q)).slice(0, 2);
  if (fallbackQs.length === 0) return { scoring: firstPass.scoring, queryUsed: firstPass.queryUsed };

  const extra = await searchQueries(
    fallbackQs,
    productProfile,
    apiKey,
    serpNum,
    minPool,
    excludeTitles
  );
  const scoring = scoreProducts(
    dedupeItems([...firstPass.items, ...extra.items]),
    productProfile
  );
  console.log("SerpAPI fallback parallel:", fallbackQs.join(" | "), `(pool=${scoring.pool.length})`);
  return { scoring, queryUsed: firstPass.queryUsed || extra.queryUsed || "" };
}

async function fetchImmersive(url: string | null | undefined, serpKey: string) {
  if (!url) return null;
  try {
    const res = await fetch(`${url}&api_key=${serpKey}`, {
      signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
    });
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
  /**
   * full: brand + luxury ladder (analysis).
   * compact: 2 shopping queries, no extra round unless the pool is empty (combine).
   */
  searchMode?: "full" | "compact";
  /** Drop shopping titles matching this pattern before scoring slots. */
  denyTitlePattern?: RegExp;
  /** Extra title denylist (e.g. garments in an accessory slot). */
  denyTitle?: (title: string) => boolean;
  /** Keep searching with broader queries until at least one unique product remains. */
  mustFind?: boolean;
};

function applyPoolFilters(
  scoring: ScoringResult,
  excludeTitles: Set<string>,
  denyTitlePattern?: RegExp,
  denyTitle?: (title: string) => boolean
): ScoringResult {
  let pool = scoring.pool;
  if (denyTitlePattern) {
    pool = pool.filter((p) => !denyTitlePattern.test(p.title));
  }
  if (denyTitle) {
    pool = pool.filter((p) => !denyTitle(p.title));
  }
  if (excludeTitles.size) {
    pool = pool.filter((p) => !titleIsExcluded(p.title, excludeTitles));
  }
  const used = new Set<string>();
  const unique: typeof pool = [];
  for (const p of pool) {
    if (hasProductOverlap(p, used)) continue;
    rememberProduct(p, used);
    unique.push(p);
  }
  const recommended = unique[0] || null;
  const cheaper =
    unique.find(
      (p) =>
        recommended &&
        !hasProductOverlap(p, new Set(productDedupeKeys(recommended))) &&
        p.priceValue > 0 &&
        p.priceValue <= (recommended.priceValue || Infinity)
    ) || unique[1] || null;
  return {
    ...scoring,
    pool: unique,
    recommended,
    cheaper,
    style: scoring.style && unique.some((p) => p.title === scoring.style?.title) ? scoring.style : null,
    error: unique.length ? undefined : scoring.error || "Bu ürün için sonuç bulunamadı.",
  };
}

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
  const searchMode = options.searchMode ?? "full";
  const rotation = excludeTitles.size;
  let { scoring } = await searchWithFallback(
    productProfile,
    serpKey,
    rotation,
    searchMode,
    excludeTitles
  );
  scoring = applyPoolFilters(
    scoring,
    excludeTitles,
    options.denyTitlePattern,
    options.denyTitle
  );

  // Only broaden when we have no recommended card. Do not re-query just because
  // excludeTitles left fewer than 3 — that added ~4 Serp RTTs on every "more".
  if (!scoring.recommended && options.mustFind) {
    const accessoryType = isAccessoryProfile(productProfile)
      ? typeTokenTr(productProfile)
      : "";
    const priceMode =
      (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";
    const serpNum = searchMode === "compact" ? 8 : 12;
    const broaden = [
      productProfile.search_query,
      productProfile.fallback_query,
      // Keep the color in the broadest query — a broadened "şapka" search must
      // still look for the orange one.
      [
        productProfile.gender_tr,
        productProfile.color_tr,
        accessoryType || productProfile.subcategory_tr || productProfile.category_tr,
      ]
        .filter(Boolean)
        .join(" "),
    ]
      .map((q) => (q || "").trim().replace(/\s+/g, " "))
      .map((q) => (accessoryType ? sanitizeAccessoryQuery(q, accessoryType) : q))
      .filter(Boolean);
    const seedQuery = (
      productProfile.fallback_query ||
      productProfile.search_query ||
      [
        productProfile.gender_tr,
        productProfile.color_tr,
        accessoryType || productProfile.subcategory_tr || productProfile.category_tr,
      ]
        .filter(Boolean)
        .join(" ")
    ).trim();
    if (priceMode === "luks") {
      // Rotate through different luxury stores on each "3 alternatif daha"
      // click (excludeTitles grows every round) so new items keep appearing.
      if (seedQuery) {
        const offset = excludeTitles.size % LUXURY_SEARCH_STORES.length;
        for (let i = 0; i < 2; i++) {
          const store = LUXURY_SEARCH_STORES[(offset + i) % LUXURY_SEARCH_STORES.length];
          broaden.unshift(`${seedQuery} ${store}`);
        }
      }
    } else if (seedQuery) {
      const nextBrands = pickDecidePoolBrands(
        {
          category: productProfile.category,
          category_tr: productProfile.category_tr,
          subcategory: productProfile.subcategory,
          subcategory_tr: productProfile.subcategory_tr,
          price_mode: priceMode,
          gender: `${productProfile.gender} ${productProfile.gender_tr} ${productProfile.user_profile?.gender || ""}`,
        },
        2,
        seedQuery,
        rotation + 5
      );
      for (const brand of nextBrands) broaden.unshift(`${seedQuery} ${brand}`);
    }
    const extraQs = [...new Set(broaden)].slice(0, compactExtraLimit(searchMode));
    if (extraQs.length) {
      const extra = await searchQueries(
        extraQs,
        productProfile,
        serpKey,
        serpNum,
        3,
        excludeTitles
      );
      const extraScoring = scoreProducts(dedupeItems(extra.items), productProfile);
      const seen = new Set<string>();
      for (const p of scoring.pool) rememberProduct(p, seen);
      const mergedPool = [...scoring.pool];
      for (const p of extraScoring.pool) {
        if (hasProductOverlap(p, seen)) continue;
        rememberProduct(p, seen);
        mergedPool.push(p);
      }
      scoring = applyPoolFilters(
        { ...scoring, pool: mergedPool, error: undefined },
        excludeTitles,
        options.denyTitlePattern,
        options.denyTitle
      );
    }
  }

  if (scoring.error || !scoring.recommended) {
    if (!options.mustFind) return null;
    if (!scoring.recommended) return null;
  }

  const usedTitles = new Set<string>(excludeTitles);
  if (scoring.recommended) usedTitles.add(scoring.recommended.title);
  if (scoring.cheaper) usedTitles.add(scoring.cheaper.title);

  const occasion = parseOccasion(productProfile.user_profile?.occasion);
  const pieceBlob = pieceBlobForOccasion(productProfile);
  const occasionWords = asLower(occasionKeyword)
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const blockedStyle = new Set<string>();
  if (scoring.recommended) rememberProduct(scoring.recommended, blockedStyle);
  if (scoring.cheaper) rememberProduct(scoring.cheaper, blockedStyle);
  const isFreeStyle = (p: (typeof scoring.pool)[number]) =>
    !titleIsExcluded(p.title, usedTitles) && !hasProductOverlap(p, blockedStyle);
  const styleProduct =
    (occasion
      ? scoring.pool.find(
          (p) => isFreeStyle(p) && occasionTitleFit(p.title, occasion, pieceBlob) === "boost"
        )
      : null) ||
    (occasionWords.length
      ? scoring.pool.find(
          (p) =>
            isFreeStyle(p) && occasionWords.some((w) => asLower(p.title).includes(w))
        )
      : null) ||
    pickTrustedFallback(scoring.pool, usedTitles);

  const finalScoring: ScoringResult = { ...scoring, style: styleProduct };
  const slots = getSlots(finalScoring);

  if (immersiveMode === "none" || slots.length === 0) {
    const merged = mergeLinks(finalScoring, slots, slots.map(() => null), affiliateTag, productProfile);
    return {
      label: productProfile.category_tr || productProfile.category || "Parça",
      category_tr: productProfile.category_tr,
      results: buildResults(merged),
    };
  }

  const immersiveTargets =
    immersiveMode === "recommended" ? slots.slice(0, 1) : slots;
  const immersiveResponses = await Promise.all(
    immersiveTargets.map(({ product }) =>
      linkNeedsImmersive(product.link)
        ? fetchImmersive(product.serpapi_immersive_product_api, serpKey)
        : Promise.resolve(null)
    )
  );
  while (immersiveResponses.length < slots.length) immersiveResponses.push(null);

  const merged = mergeLinks(finalScoring, slots, immersiveResponses, affiliateTag, productProfile);
  return {
    label: productProfile.category_tr || productProfile.category || "Parça",
    category_tr: productProfile.category_tr,
    results: buildResults(merged),
  };
}
