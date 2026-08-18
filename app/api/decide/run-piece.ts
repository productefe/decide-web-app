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
  type ProductProfile,
  type ScoringResult,
} from "./pipeline";
import type { PieceResult } from "@/components/analyze/types";
import { parseOccasion, type PriceMode } from "@/lib/preferences";
import { occasionTitleFit, pieceBlobForOccasion } from "@/lib/occasion-guide";
import { allPoolBrandNames, normalizeBrandName } from "@/constants/brandPool";

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

const POOL_BRAND_NEEDLES = allPoolBrandNames()
  .map((b) => ({ raw: b.toLowerCase(), key: normalizeBrandName(b) }))
  .filter((b) => b.key.length >= 3);

function distinctPoolBrandCount(pool: ScoringResult["pool"]): number {
  const found = new Set<string>();
  for (const p of pool) {
    const hay = `${p.title || ""} ${p.source || ""}`.toLocaleLowerCase("tr-TR");
    for (const b of POOL_BRAND_NEEDLES) {
      if (hay.includes(b.key) || hay.includes(b.raw)) found.add(b.key);
    }
  }
  return found.size;
}

/**
 * Stop after the first query only when the filtered pool is deep *and* not a
 * single-brand dump (8 Bershka listings from 3 marketplaces still expands).
 */
function poolIsRichEnough(scoring: ScoringResult): boolean {
  if (scoring.error || !scoring.recommended) return false;
  if (scoring.pool.length < 8) return false;
  return distinctPoolBrandCount(scoring.pool) >= 2;
}

async function searchQueries(
  queries: string[],
  productProfile: ProductProfile,
  apiKey: string
): Promise<{ scoring: ScoringResult; queryUsed: string; items: SerpShoppingItem[] }> {
  const ordered = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  if (ordered.length === 0) {
    return { scoring: emptyScoring(productProfile), queryUsed: "", items: [] };
  }

  const firstItems = await serpShoppingSearch(ordered[0], apiKey);
  let merged = dedupeItems(firstItems);
  let scoring = scoreProducts(merged, productProfile);

  if (poolIsRichEnough(scoring)) {
    console.log(
      "SerpAPI adaptive stop@1:",
      ordered[0],
      `(pool=${scoring.pool.length}, brands=${distinctPoolBrandCount(scoring.pool)})`
    );
    return { scoring, queryUsed: ordered[0], items: merged };
  }

  const rest = ordered.slice(1);
  if (rest.length) {
    const extra = await Promise.all(rest.map((q) => serpShoppingSearch(q, apiKey)));
    merged = dedupeItems([...merged, ...extra.flat()]);
    scoring = scoreProducts(merged, productProfile);
    console.log(
      "SerpAPI adaptive expand:",
      [ordered[0], ...rest].join(" | "),
      `(pool=${scoring.pool.length})`
    );
  }

  return { scoring, queryUsed: ordered[0], items: merged };
}

async function searchWithFallback(
  productProfile: ProductProfile,
  apiKey: string
): Promise<{ scoring: ScoringResult; queryUsed: string }> {
  const { queries, brandQueries } = buildSearchPlan(productProfile);
  const priceMode = (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";

  if (queries.length === 0) {
    return { scoring: emptyScoring(productProfile), queryUsed: "" };
  }

  if (priceMode === "luks") {
    const result = await searchQueries(queries.slice(0, 4), productProfile, apiKey);
    return { scoring: result.scoring, queryUsed: result.queryUsed };
  }

  const brandQs = brandQueries.slice(0, 2);
  const genericQs = queries.filter((q) => !brandQueries.includes(q));
  const primary = genericQs[0] || queries[0];
  const uniqueParallel = [...new Set([...brandQs, primary].filter(Boolean))];

  const firstPass = await searchQueries(uniqueParallel, productProfile, apiKey);
  if (!firstPass.scoring.error) return { scoring: firstPass.scoring, queryUsed: firstPass.queryUsed };

  const fallbackQs = genericQs.filter((q) => !uniqueParallel.includes(q)).slice(0, 2);
  if (fallbackQs.length === 0) return { scoring: firstPass.scoring, queryUsed: firstPass.queryUsed };

  const fallbackBatches = await Promise.all(fallbackQs.map((q) => serpShoppingSearch(q, apiKey)));
  const scoring = scoreProducts(
    dedupeItems([...firstPass.items, ...fallbackBatches.flat()]),
    productProfile
  );
  console.log("SerpAPI fallback parallel:", fallbackQs.join(" | "), `(pool=${scoring.pool.length})`);
  return { scoring, queryUsed: firstPass.queryUsed || fallbackQs[0] || "" };
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
  let { scoring } = await searchWithFallback(productProfile, serpKey);
  scoring = applyPoolFilters(
    scoring,
    excludeTitles,
    options.denyTitlePattern,
    options.denyTitle
  );

  if ((!scoring.recommended || scoring.pool.length < 3) && options.mustFind) {
    const accessoryType = isAccessoryProfile(productProfile)
      ? typeTokenTr(productProfile)
      : "";
    const broaden = [
      productProfile.search_query,
      productProfile.fallback_query,
      [productProfile.gender_tr, accessoryType || productProfile.subcategory_tr || productProfile.category_tr]
        .filter(Boolean)
        .join(" "),
    ]
      .map((q) => (q || "").trim().replace(/\s+/g, " "))
      .map((q) => (accessoryType ? sanitizeAccessoryQuery(q, accessoryType) : q))
      .filter(Boolean);
    const extraQs = [...new Set(broaden)].slice(0, 2);
    if (extraQs.length) {
      const extra = await Promise.all(extraQs.map((q) => serpShoppingSearch(q, serpKey)));
      const extraScoring = scoreProducts(dedupeItems(extra.flat()), productProfile);
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
  const occasionWords = occasionKeyword
    .toLowerCase()
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
            isFreeStyle(p) && occasionWords.some((w) => p.title.toLowerCase().includes(w))
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
