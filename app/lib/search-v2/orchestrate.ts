import type { Occasion, PriceMode, UserGender } from "@/lib/preferences";
import type { Product, Results, PieceResult } from "@/components/analyze/types";
import { createHash } from "crypto";
import type {
  OutfitIntent,
  ProductCandidate,
  ProductIntent,
  VerifiedCandidate,
} from "./schema";
import { buildQueryPlan } from "./query-plan";
import { searchGoogleShopping } from "./providers/google-shopping";
import { searchGoogleLens } from "./providers/google-lens";
import { raceTimeout } from "./providers/http";
import { hardVerify } from "./verify";
import { rerankCandidates } from "./rank";
import { ensureSession, pickPage, seedSessionExcludes } from "./paginate";
import { typeSpec, canonicalTitle } from "./type-cues";
import { SEARCH_V2_VERSION } from "./flag";
import { dbg } from "./debug-log";

export interface OrchestratePieceInput {
  intent: ProductIntent;
  photoUrl: string;
  serpApiKey: string;
  openAiKey?: string;
  priceMode: PriceMode;
  gender: UserGender | null;
  sizes: string[];
  sessionId?: string | null;
  page?: number;
  affiliateTag?: string;
  excludeTitles?: string[];
  occasion?: Occasion | null;
  outfitPieceCount?: number;
  /** One Lens request is shared by every piece in the same photo. */
  sharedLensPromise?: Promise<ProductCandidate[]>;
}

export interface OrchestratePieceResult {
  label: string;
  category_tr: string;
  results: Results;
  products: VerifiedCandidate[];
  exhausted: boolean;
  session_id: string;
  metrics: {
    candidates: number;
    kept: number;
    rejects: Record<string, number>;
    provider_ms: number;
    rerank_ms: number;
    serp_ms: number;
    lens_ms: number;
  };
  attrs: ReturnType<typeof intentToAttrs>;
}

export function intentHash(intent: ProductIntent): string {
  return createHash("sha1")
    .update(
      JSON.stringify({
        f: intent.family,
        c: intent.body_color,
        m: intent.motifs,
        s: intent.subtype,
      })
    )
    .digest("hex")
    .slice(0, 16);
}

export function intentToAttrs(intent: ProductIntent) {
  return {
    category: intent.family,
    category_tr: intent.category_tr,
    color_tr: intent.body_color,
    fit: intent.fit,
    gender: intent.gender,
    style_tags: intent.distinctive_details.slice(0, 6),
    subcategory: intent.subtype,
    secondary_colors: intent.secondary_colors,
    patterns: intent.motifs.map((m) => ({
      type: m.type,
      colors: m.colors,
      placement: m.placement,
    })),
    material_impression: intent.material,
    distinctive_details: intent.distinctive_details,
    low_confidence: intent.low_confidence,
  };
}

function toProduct(c: VerifiedCandidate, label: string, reason: string): Product {
  return {
    title: c.title,
    price: c.price,
    source: c.source,
    image: c.image,
    link: c.link,
    store: c.store,
    reason,
    label,
    priceValue: c.priceValue ?? undefined,
    product_id: c.product_id,
    serpapi_immersive_product_api: c.serpapi_immersive_product_api,
  };
}

function toResults(products: VerifiedCandidate[]): Results {
  const reasons = [
    "Görsel ve tipe en yakın eşleşme",
    "Daha uygun alternatif",
    "Stil uyumlu alternatif",
  ];
  const labels = ["Recommended", "Cheaper", "Style"];
  return {
    recommended: products[0] ? toProduct(products[0], labels[0], reasons[0]) : null,
    cheaper: products[1] ? toProduct(products[1], labels[1], reasons[1]) : null,
    style: products[2] ? toProduct(products[2], labels[2], reasons[2]) : null,
  };
}

export async function orchestratePiece(
  input: OrchestratePieceInput
): Promise<OrchestratePieceResult> {
  const page = input.page || 0;
  const plan = buildQueryPlan(input.intent, {
    priceMode: input.priceMode,
    gender: input.gender,
    sizes: input.sizes,
    page,
  });

  const session = ensureSession({
    sessionId: input.sessionId,
    intentHash: intentHash(input.intent),
    pieceKey: input.intent.id,
  });
  if (input.excludeTitles?.length) {
    seedSessionExcludes(session, input.excludeTitles);
  }

  const t0 = Date.now();
  const lensCapMs = Number(process.env.SEARCH_V2_LENS_TIMEOUT_MS || 4000) || 4000;
  let lensReady: ProductCandidate[] | undefined;
  const lensPromise = (
    plan.lens && page === 0
      ? input.sharedLensPromise ||
        searchGoogleLens({
          apiKey: input.serpApiKey,
          imageUrl: input.photoUrl,
          timeoutMs: lensCapMs,
        })
      : Promise.resolve([] as ProductCandidate[])
  ).then((rows) => {
    lensReady = rows;
    return rows;
  });

  const maxAttempts = 2;
  const startIdx = plan.all_variants.findIndex((v) => v.q === plan.text_queries[0]?.q);
  const from = startIdx >= 0 ? startIdx : 0;
  const typeVariant = plan.all_variants.find((v) => v.kind === "type");
  const ordered = [
    plan.all_variants[from],
    ...(page > 0 && typeVariant ? [typeVariant] : []),
    ...plan.all_variants.slice(from + 1),
    ...(page === 0 ? plan.all_variants.slice(1) : []),
  ].filter(
    (v, i, arr): v is NonNullable<(typeof arr)[number]> =>
      Boolean(v) && arr.findIndex((x) => x?.q === v.q) === i
  );
  const tried: { id: string; q: string; count: number }[] = [];
  let merged: ProductCandidate[] = [];
  let lens: ProductCandidate[] = [];
  let kept: VerifiedCandidate[] = [];
  let stats = { total: 0, kept: 0, rejects: {} as Record<string, number> };
  let ranked: VerifiedCandidate[] = [];
  let rerank_ms = 0;
  let serp_ms = 0;
  let lens_ms = 0;
  let piecePage = {
    products: [] as VerifiedCandidate[],
    exhausted: true,
    page: session.page,
    session_id: session.id,
  };

  const verifyMerged = (candidates: ProductCandidate[]) => {
    const verifiedKnown = hardVerify(candidates, input.intent, {
      priceMode: input.priceMode,
      gender: input.gender,
      sizes: input.sizes,
      occasion: input.occasion,
      relaxLevel: 1,
      brandGate: "known",
    });
    let verified = verifiedKnown;
    if (verified.kept.length === 0 && candidates.length > 0) {
      verified = hardVerify(candidates, input.intent, {
        priceMode: input.priceMode,
        gender: input.gender,
        sizes: input.sizes,
        occasion: input.occasion,
        relaxLevel: 1,
        brandGate: "off",
      });
      // #region agent log
      dbg("H11", "orchestrate.ts:brand-fallback", "known-brand gate emptied piece; relaxed", {
        label: input.intent.label_tr,
        family: input.intent.family,
        merged: candidates.length,
        knownKept: verifiedKnown.stats.kept,
        unknownSeller: verifiedKnown.stats.rejects.unknown_seller || 0,
        relaxedKept: verified.stats.kept,
      });
      // #endregion
    }
    if (verified.kept.length === 0 && input.priceMode === "luks" && candidates.length > 0) {
      const luxuryFallback = hardVerify(candidates, input.intent, {
        priceMode: input.priceMode,
        gender: input.gender,
        sizes: input.sizes,
        occasion: input.occasion,
        relaxLevel: 1,
        brandGate: "off",
        skipLuxury: true,
      });
      // #region agent log
      dbg("H-luks", "orchestrate.ts:luxury-fallback", "luxury gate emptied piece; price/karma fallback", {
        label: input.intent.label_tr,
        family: input.intent.family,
        merged: candidates.length,
        luxuryLeak: verified.stats.rejects.luxury_leak || 0,
        quality: verified.stats.rejects.quality || 0,
        fallbackKept: luxuryFallback.stats.kept,
      });
      // #endregion
      if (luxuryFallback.kept.length > 0) verified = luxuryFallback;
    }
    return verified;
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const variant = ordered[attempt];
    if (!variant || tried.some((t) => t.q === variant.q)) {
      if (!variant) break;
      continue;
    }

    const tShop = Date.now();
    const textBatch = await searchGoogleShopping({
      apiKey: input.serpApiKey,
      query: variant.q,
      num: 40,
    });
    serp_ms += Date.now() - tShop;
    tried.push({ id: variant.id, q: variant.q, count: textBatch.length });
    merged = [...merged.filter((c) => c.provider !== "lens"), ...textBatch];

    const applyLens = async (waitMs: number) => {
      if (attempt !== 0) return false;
      const before = lens.length;
      const tLens = Date.now();
      if (lensReady) {
        lens = lensReady;
      } else if (waitMs > 0) {
        lens = await raceTimeout(lensPromise, waitMs, [] as ProductCandidate[]);
      }
      lens_ms += Date.now() - tLens;
      if (lens.length) {
        merged = [...lens, ...merged.filter((c) => c.provider !== "lens")];
      }
      return lens.length > before;
    };

    if (attempt === 0 && lensReady) {
      await applyLens(0);
    }

    let verified = verifyMerged(merged);
    kept = verified.kept;
    stats = verified.stats;

    if (attempt === 0 && !lens.length) {
      const remaining = kept.length < 3 ? Math.max(0, lensCapMs - (Date.now() - t0)) : 0;
      const added = await applyLens(remaining);
      if (added) {
        verified = verifyMerged(merged);
        kept = verified.kept;
        stats = verified.stats;
      }
    }

    if (kept.length === 0) continue;

    const tRank = Date.now();
    ranked = await rerankCandidates({
      apiKey: page === 0 && attempt === 0 && (input.outfitPieceCount || 1) < 4 ? input.openAiKey : undefined,
      intent: input.intent,
      candidates: kept,
      referenceImageUrl: input.photoUrl,
      limit: 24,
      timeoutMs: page === 0 && attempt === 0 && (input.outfitPieceCount || 1) < 4 ? 2000 : 0,
    });
    rerank_ms += Date.now() - tRank;
    piecePage = pickPage(ranked, session, 3);
    if (piecePage.products.length > 0) break;
    if (page === 0) break;
  }

  const provider_ms = Date.now() - t0;
  // #region agent log
  dbg("C", "orchestrate.ts:verify", "piece retrieval+verify", {
    label: input.intent.label_tr,
    family: input.intent.family,
    queries: plan.text_queries.map((q) => ({ id: q.id, kind: q.kind, q: q.q.slice(0, 80) })),
    lensCount: lens.length,
    textCounts: tried.map((t) => t.count),
    merged: merged.length,
    kept: stats.kept,
    rejects: stats.rejects,
    providerMs: provider_ms,
    serpMs: serp_ms,
    lensMs: lens_ms,
    rerankMs: rerank_ms,
    timeoutEnv: process.env.SEARCH_V2_SERP_TIMEOUT_MS || "unset",
  });
  // #endregion
  // #region agent log
  dbg("H1", "orchestrate.ts:page", "show-more uniqueness+fallback", {
    page,
    occasion: input.occasion || null,
    excludeCount: input.excludeTitles?.length || 0,
    tried,
    kept: stats.kept,
    picked: piecePage.products.map((p) => p.title.slice(0, 80)),
    pickedStores: piecePage.products.map((p) => p.store || p.source),
    exhausted: piecePage.exhausted,
    occasionRejects: stats.rejects.occasion_conflict || 0,
    trustedPicked: piecePage.products.filter((p) =>
      /zara|mavi|h&m|koton|bershka|trendyol|boyner|nike|adidas/i.test(
        `${p.source} ${p.store || ""} ${p.title}`
      )
    ).length,
  });
  // #endregion
  // #region agent log
  const spec = typeSpec(input.intent);
  dbg("H7", "orchestrate.ts:type", "subtype+price page pick", {
    family: input.intent.family,
    subtype: input.intent.subtype,
    details: input.intent.distinctive_details.slice(0, 4),
    queryType: spec.queryType,
    requiredAny: spec.requiredAny,
    prefer: spec.prefer,
    subtypeRejects: stats.rejects.subtype_conflict || 0,
    cheapRejects: stats.rejects.cheap || 0,
    qualityRejects: stats.rejects.quality || 0,
    pickedCanon: piecePage.products.map((p) => canonicalTitle(p.title).slice(0, 60)),
    pickedPrices: piecePage.products.map((p) => p.priceValue),
  });
  // #endregion
  // #region agent log
  dbg("H10", "orchestrate.ts:quality", "brand+occasion gate", {
    unknownSeller: stats.rejects.unknown_seller || 0,
    junk: stats.rejects.junk || 0,
    luxuryLeak: stats.rejects.luxury_leak || 0,
    schoolUniform: stats.rejects.school_uniform || 0,
    mensBackpack: stats.rejects.mens_backpack || 0,
    cheapRejects: stats.rejects.cheap || 0,
    occasionRejects: stats.rejects.occasion_conflict || 0,
    kept: stats.kept,
    attempts: tried.length,
    providerMs: provider_ms,
  });
  // #endregion

  return {
    label: input.intent.label_tr,
    category_tr: input.intent.category_tr,
    results: toResults(piecePage.products),
    products: piecePage.products,
    exhausted: piecePage.exhausted,
    session_id: session.id,
    metrics: {
      candidates: merged.length,
      kept: stats.kept,
      rejects: stats.rejects,
      provider_ms,
      rerank_ms,
      serp_ms,
      lens_ms,
    },
    attrs: intentToAttrs(input.intent),
  };
}

function isMensBackpackPiece(p: ProductIntent, gender: UserGender | null): boolean {
  if (gender !== "men") return false;
  const blob = `${p.label_tr} ${p.subtype} ${p.category_tr}`.toLocaleLowerCase("tr-TR");
  return p.family === "bag" && /sırt|sirt|backpack|okul çant/.test(blob);
}

export async function orchestrateOutfit(opts: {
  intent: OutfitIntent;
  photoUrl: string;
  serpApiKey: string;
  openAiKey?: string;
  priceMode: PriceMode;
  gender: UserGender | null;
  sizes: string[];
  affiliateTag?: string;
  occasion?: Occasion | null;
}): Promise<{
  pieces: PieceResult[];
  piece_sessions: Record<string, string>;
  metrics: OrchestratePieceResult["metrics"][];
  version: string;
}> {
  const searchable = opts.intent.pieces.filter(
    (p) =>
      (p.visibility !== "edge" || !p.low_confidence) &&
      !isMensBackpackPiece(p, opts.gender)
  );
  const toSearch = searchable.length > 0 ? searchable : opts.intent.pieces.filter(
    (p) => !isMensBackpackPiece(p, opts.gender)
  );
  // #region agent log
  dbg("H14", "orchestrate.ts:backpack", "mens backpack skip", {
    gender: opts.gender,
    skipped: opts.intent.pieces.filter((p) => isMensBackpackPiece(p, opts.gender)).map((p) => p.label_tr),
    searched: toSearch.map((p) => ({ family: p.family, label: p.label_tr })),
  });
  // #endregion
  const sharedLensPromise = searchGoogleLens({
    apiKey: opts.serpApiKey,
    imageUrl: opts.photoUrl,
    timeoutMs: Number(process.env.SEARCH_V2_LENS_TIMEOUT_MS || 4000) || 4000,
  });
  const results = await Promise.all(
    toSearch.map((piece) =>
      orchestratePiece({
        intent: piece,
        photoUrl: opts.photoUrl,
        serpApiKey: opts.serpApiKey,
        openAiKey: opts.openAiKey,
        priceMode: opts.priceMode,
        gender: opts.gender,
        sizes: opts.sizes,
        affiliateTag: opts.affiliateTag,
        occasion: opts.occasion,
        outfitPieceCount: toSearch.length,
        sharedLensPromise,
      }).catch((err) => {
        console.warn("[search-v2] piece fail", piece.label_tr, err);
        return null;
      })
    )
  );

  const pieces: PieceResult[] = [];
  const piece_sessions: Record<string, string> = {};
  const metrics: OrchestratePieceResult["metrics"][] = [];

  for (const r of results) {
    if (!r) continue;
    if (!r.results.recommended && !r.results.cheaper && !r.results.style) continue;
    pieces.push({
      label: r.label,
      results: r.results,
      ...r.attrs,
      category_tr: r.category_tr,
    });
    piece_sessions[r.label] = r.session_id;
    metrics.push(r.metrics);
  }

  // #region agent log
  dbg("H12", "orchestrate.ts:outfit", "multi-piece outcome", {
    intentPieces: opts.intent.pieces.length,
    searched: toSearch.length,
    families: opts.intent.pieces.map((p) => p.family),
    lowConfidence: opts.intent.pieces.filter((p) => p.low_confidence).length,
    returned: pieces.length,
    emptyDropped: results.filter((r) => r && !r.results.recommended).length,
    failed: results.filter((r) => !r).length,
    priceMode: opts.priceMode,
  });
  // #endregion

  return { pieces, piece_sessions, metrics, version: SEARCH_V2_VERSION };
}
