import {
  scoreProducts,
  buildSearchPlan,
  pickTrustedFallback,
  getSlots,
  sanitizeSlots,
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
  keepLookFaithful,
  lookRelaxLevel,
  type ProductProfile,
  type ScoringResult,
  type ScoredProduct,
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

/** Cap hung Serp calls. Fan-out wall-clock ≈ one timeout (~4.2s). */
const SERP_TIMEOUT_MS = 4_200;

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

/** Only Google Shopping URLs need immersive to resolve a merchant page. */
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

/**
 * Fire every query in parallel and wait for all — no early-exit.
 * Wall-clock is one Serp timeout regardless of query count.
 */
async function fanOutQueries(
  queries: string[],
  productProfile: ProductProfile,
  apiKey: string,
  num = 12,
  shownCount = 0
): Promise<{ scoring: ScoringResult; queryUsed: string; items: SerpShoppingItem[] }> {
  const ordered = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  if (ordered.length === 0) {
    return { scoring: emptyScoring(productProfile), queryUsed: "", items: [] };
  }

  const settled = await Promise.allSettled(
    ordered.map((q) => serpShoppingSearch(q, apiKey, num))
  );
  const collected: SerpShoppingItem[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") collected.push(...result.value);
  }
  const items = dedupeItems(collected);
  const scoring = scoreProducts(items, productProfile, shownCount);
  console.log(
    "SerpAPI fan-out:",
    ordered.join(" | "),
    `(pool=${scoring.pool.length}, raw=${items.length})`
  );
  return { scoring, queryUsed: ordered[0], items };
}

function typeBitFor(productProfile: ProductProfile): string {
  if (isAccessoryProfile(productProfile)) {
    return typeTokenTr(productProfile) || productProfile.category_tr || "";
  }
  return productProfile.subcategory_tr || productProfile.category_tr || "";
}

function sanitizeQuery(q: string, productProfile: ProductProfile): string {
  const cleaned = q.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  if (isAccessoryProfile(productProfile)) {
    const accessoryType = typeTokenTr(productProfile);
    return accessoryType ? sanitizeAccessoryQuery(cleaned, accessoryType) : cleaned;
  }
  return cleaned;
}

/**
 * Build 5–6 diverse queries and run them in a single parallel round.
 * Compact (combine) uses 3. Raw-empty → one type-only rescue (no fill ladder).
 */
async function gatherCandidates(
  productProfile: ProductProfile,
  apiKey: string,
  rotation = 0,
  searchMode: "full" | "compact" = "full",
  excludeTitles: Set<string> = new Set()
): Promise<{ scoring: ScoringResult; queryUsed: string; items: SerpShoppingItem[] }> {
  const { queries, brandQueries, luxuryQueries } = buildSearchPlan(productProfile, rotation);
  const priceMode = (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";
  const compact = searchMode === "compact";
  const serpNum = excludeTitles.size ? 8 : 6;
  const shown = excludeTitles.size;

  if (queries.length === 0) {
    return { scoring: emptyScoring(productProfile), queryUsed: "", items: [] };
  }

  const typeBit = typeBitFor(productProfile);
  const colorTypeQuery = sanitizeQuery(
    [productProfile.gender_tr, productProfile.color_tr, productProfile.pattern_tr, typeBit]
      .filter(Boolean)
      .join(" "),
    productProfile
  );
  const fallbackWithColor = sanitizeQuery(
    [productProfile.fallback_query, productProfile.color_tr].filter(Boolean).join(" "),
    productProfile
  );
  const primary =
    sanitizeQuery(productProfile.search_query || queries[0] || "", productProfile) ||
    queries[0];

  const fanOut: string[] = [];
  const push = (q: string | undefined) => {
    const cleaned = (q || "").trim();
    if (!cleaned || fanOut.includes(cleaned)) return;
    fanOut.push(cleaned);
  };

  if (compact) {
    push(primary);
    push(colorTypeQuery || fallbackWithColor);
    if (priceMode === "luks") {
      push(luxuryQueries[0] || (primary ? `${primary} ${LUXURY_SEARCH_STORES[0]}` : ""));
    } else {
      push(brandQueries[0] || luxuryQueries[0]);
    }
  } else if (priceMode === "luks") {
    for (const q of luxuryQueries.slice(0, 3)) push(q);
    push(primary);
    push(colorTypeQuery);
    push(fallbackWithColor);
  } else {
    push(primary);
    push(colorTypeQuery);
    push(fallbackWithColor);

    const seed = primary || colorTypeQuery || fallbackWithColor;
    const brands = pickDecidePoolBrands(
      {
        category: productProfile.category,
        category_tr: productProfile.category_tr,
        subcategory: productProfile.subcategory,
        subcategory_tr: productProfile.subcategory_tr,
        price_mode: priceMode,
        gender: `${productProfile.gender} ${productProfile.gender_tr} ${productProfile.user_profile?.gender || ""}`,
      },
      2,
      seed,
      rotation
    );
    for (const brand of brands) {
      if (seed) push(`${seed} ${brand}`);
    }
    // From buildSearchPlan brand list when pool picker returned nothing useful.
    for (const q of brandQueries.slice(0, 2)) {
      if (fanOut.length >= 5) break;
      push(q);
    }

    // Karma: always include one luxury-channel query for quality brands.
    if (priceMode === "karma") {
      push(luxuryQueries[0] || (primary ? `${primary} beymen` : ""));
    }
  }

  // Cap full fan-out at 6; compact already ≤ 3.
  const querySet = fanOut.slice(0, compact ? 3 : 6);
  let result = await fanOutQueries(querySet, productProfile, apiKey, serpNum, shown);

  // Serp outage / total miss: one type-only rescue, then stop.
  if (result.items.length === 0) {
    const typeOnly = sanitizeQuery(
      [productProfile.gender_tr, typeBit].filter(Boolean).join(" "),
      productProfile
    );
    const rescue =
      typeOnly ||
      sanitizeQuery(productProfile.fallback_query || productProfile.search_query || "", productProfile);
    if (rescue && !querySet.includes(rescue)) {
      const extra = await fanOutQueries([rescue], productProfile, apiKey, serpNum, Math.max(shown, 9));
      result = {
        scoring: extra.scoring,
        queryUsed: result.queryUsed || extra.queryUsed,
        items: extra.items,
      };
      console.log("SerpAPI rescue:", rescue, `(raw=${extra.items.length})`);
    }
  }

  return result;
}

/**
 * Re-score the same raw items at a higher look-relax without another Serp RTT.
 * shownOverride maps through lookRelaxLevel: 1→relax1, 9→relax2.
 */
function rescoreAtRelax(
  items: SerpShoppingItem[],
  productProfile: ProductProfile,
  shownOverride: number
): ScoringResult {
  if (!items.length) return emptyScoring(productProfile);
  return scoreProducts(items, productProfile, shownOverride);
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
   * full: 5–6 query fan-out (analysis).
   * compact: 3 shopping queries (combine).
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
  productProfile: ProductProfile,
  denyTitlePattern?: RegExp,
  denyTitle?: (title: string) => boolean,
  relaxOverride?: 0 | 1 | 2
): ScoringResult {
  let pool = scoring.pool;
  if (denyTitlePattern) {
    pool = pool.filter((p) => !denyTitlePattern.test(p.title));
  }
  if (denyTitle) {
    pool = pool.filter((p) => !denyTitle(p.title));
  }
  if (excludeTitles.size) {
    const familyMatch = (relaxOverride ?? lookRelaxLevel(excludeTitles.size)) === 0;
    pool = pool.filter((p) => !titleIsExcluded(p.title, excludeTitles, { familyMatch }));
  }
  const shown = excludeTitles.size;
  let relax = relaxOverride ?? lookRelaxLevel(shown);
  pool = keepLookFaithful(pool, productProfile, relax);
  // If filters left fewer than 2 cards, step relax up once so "3 daha" still works.
  if (pool.length < 2 && relax < 2) {
    relax = (relax + 1) as 0 | 1 | 2;
    const familyMatch = false;
    const base = excludeTitles.size
      ? scoring.pool.filter((p) => !titleIsExcluded(p.title, excludeTitles, { familyMatch }))
      : scoring.pool;
    const widened = keepLookFaithful(base, productProfile, relax);
    if (widened.length > pool.length) pool = widened;
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
    ) ||
    unique[1] ||
    null;
  return {
    ...scoring,
    pool: unique,
    recommended,
    cheaper,
    style: scoring.style && unique.some((p) => p.title === scoring.style?.title) ? scoring.style : null,
    error: unique.length ? undefined : scoring.error || "Bu ürün için sonuç bulunamadı.",
  };
}

/**
 * Guarantee ≥2 cards from the gathered pool by relaxing quality/look filters
 * in-memory (no extra Serp RTT). Steps: current → relax1 → relax2.
 */
function guaranteeCardsFromPool(
  items: SerpShoppingItem[],
  scoring: ScoringResult,
  excludeTitles: Set<string>,
  productProfile: ProductProfile,
  denyTitlePattern?: RegExp,
  denyTitle?: (title: string) => boolean
): ScoringResult {
  let next = applyPoolFilters(
    scoring,
    excludeTitles,
    productProfile,
    denyTitlePattern,
    denyTitle
  );
  if (next.pool.length >= 2 || items.length === 0) return next;

  // Force quality-filter relax 1 (shownCount 1..8 → lookRelaxLevel 1).
  const at1 = rescoreAtRelax(items, productProfile, Math.max(excludeTitles.size, 1));
  next = applyPoolFilters(at1, excludeTitles, productProfile, denyTitlePattern, denyTitle, 1);
  if (next.pool.length >= 2) return next;

  // Force relax 2 (shownCount ≥ 9).
  const at2 = rescoreAtRelax(items, productProfile, Math.max(excludeTitles.size, 9));
  next = applyPoolFilters(at2, excludeTitles, productProfile, denyTitlePattern, denyTitle, 2);
  return next;
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
  // Rotate brand/luxury slots on every "3 alternatif daha" tap.
  const rotation = excludeTitles.size;
  const gathered = await gatherCandidates(
    productProfile,
    serpKey,
    rotation,
    searchMode,
    excludeTitles
  );
  let scoring = guaranteeCardsFromPool(
    gathered.items,
    gathered.scoring,
    excludeTitles,
    productProfile,
    options.denyTitlePattern,
    options.denyTitle
  );

  // mustFind: if still empty after in-pool relax, one final type-only rescue.
  if (!scoring.recommended && options.mustFind && gathered.items.length === 0) {
    const typeBit = typeBitFor(productProfile);
    const typeOnly = sanitizeQuery(
      [productProfile.gender_tr, typeBit].filter(Boolean).join(" "),
      productProfile
    );
    const seed =
      typeOnly ||
      sanitizeQuery(productProfile.fallback_query || productProfile.search_query || "", productProfile);
    if (seed) {
      const last = await fanOutQueries(
        [seed],
        productProfile,
        serpKey,
        8,
        Math.max(excludeTitles.size, 9)
      );
      scoring = guaranteeCardsFromPool(
        last.items,
        last.scoring,
        excludeTitles,
        productProfile,
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
  const isFreeStyle = (p: ScoredProduct) =>
    !titleIsExcluded(p.title, usedTitles, {
      familyMatch: lookRelaxLevel(excludeTitles.size) === 0,
    }) && !hasProductOverlap(p, blockedStyle);
  const avoidForStyle = [scoring.recommended, scoring.cheaper].filter(
    (p): p is ScoredProduct => Boolean(p)
  );
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
    pickTrustedFallback(scoring.pool, usedTitles, avoidForStyle);

  const finalScoring: ScoringResult = { ...scoring, style: styleProduct };
  let slots = getSlots(finalScoring);
  slots = sanitizeSlots(slots, scoring.pool, productProfile);
  const slotByKey = Object.fromEntries(slots.map((s) => [s.slot, s.product])) as Partial<
    Record<"recommended" | "cheaper" | "style", ScoredProduct>
  >;
  const sanitizedScoring: ScoringResult = {
    ...finalScoring,
    recommended: slotByKey.recommended || null,
    cheaper: slotByKey.cheaper || null,
    style: slotByKey.style || null,
  };

  if (immersiveMode === "none" || slots.length === 0) {
    const merged = mergeLinks(
      sanitizedScoring,
      slots,
      slots.map(() => null),
      affiliateTag,
      productProfile
    );
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

  const merged = mergeLinks(
    sanitizedScoring,
    slots,
    immersiveResponses,
    affiliateTag,
    productProfile
  );
  return {
    label: productProfile.category_tr || productProfile.category || "Parça",
    category_tr: productProfile.category_tr,
    results: buildResults(merged),
  };
}
