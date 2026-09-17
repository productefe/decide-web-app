import type { PriceMode, UserGender } from "@/lib/preferences";
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
import { hardVerify } from "./verify";
import { rerankCandidates } from "./rank";
import { ensureSession, pickPage } from "./paginate";
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

  const t0 = Date.now();
  const lensPromise =
    plan.lens && page === 0
      ? input.sharedLensPromise ||
        searchGoogleLens({ apiKey: input.serpApiKey, imageUrl: input.photoUrl })
      : Promise.resolve([]);
  const textPromises = plan.text_queries.map((q) =>
    searchGoogleShopping({ apiKey: input.serpApiKey, query: q.q })
  );

  const [lens, ...texts] = await Promise.all([lensPromise, ...textPromises]);
  let merged = [...lens, ...texts.flat()];
  if (merged.length === 0 && page === 0) {
    const g = input.gender === "men" ? "erkek" : input.gender === "women" ? "kadın" : "";
    const typeTok = input.intent.category_tr || input.intent.family;
    const fallbackQ = [g, typeTok].filter(Boolean).join(" ");
    if (fallbackQ && fallbackQ !== plan.text_queries[0]?.q) {
      const extra = await searchGoogleShopping({
        apiKey: input.serpApiKey,
        query: fallbackQ,
      });
      merged = extra;
    }
  }
  const provider_ms = Date.now() - t0;
  const { kept, stats } = hardVerify(merged, input.intent, {
    priceMode: input.priceMode,
    gender: input.gender,
    sizes: input.sizes,
  });
  // #region agent log
  dbg("C", "orchestrate.ts:verify", "piece retrieval+verify", {
    label: input.intent.label_tr,
    family: input.intent.family,
    queries: plan.text_queries.map((q) => ({ id: q.id, kind: q.kind, q: q.q.slice(0, 80) })),
    lensCount: lens.length,
    textCounts: texts.map((t) => t.length),
    merged: merged.length,
    kept: stats.kept,
    rejects: stats.rejects,
    providerMs: provider_ms,
    timeoutEnv: process.env.SEARCH_V2_SERP_TIMEOUT_MS || "unset",
  });
  // #endregion

  const t1 = Date.now();
  const ranked = await rerankCandidates({
    apiKey: page === 0 ? input.openAiKey : undefined,
    intent: input.intent,
    candidates: kept,
    referenceImageUrl: input.photoUrl,
    limit: 24,
    timeoutMs: page === 0 ? 2000 : 0,
  });
  const rerank_ms = Date.now() - t1;

  const session = ensureSession({
    sessionId: input.sessionId,
    intentHash: intentHash(input.intent),
    pieceKey: input.intent.id,
  });
  // On first page session is fresh; for show-more advance cursor via page
  if (page > 0 && session.page < page) {
    // Skip already-shown by relying on seen sets from client session id
  }

  const piecePage = pickPage(ranked, session, 3);

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
    },
    attrs: intentToAttrs(input.intent),
  };
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
}): Promise<{
  pieces: PieceResult[];
  piece_sessions: Record<string, string>;
  metrics: OrchestratePieceResult["metrics"][];
  version: string;
}> {
  const searchable = opts.intent.pieces.filter((p) => !p.low_confidence);
  const sharedLensPromise = searchGoogleLens({
    apiKey: opts.serpApiKey,
    imageUrl: opts.photoUrl,
  });
  const results = await Promise.all(
    searchable.map((piece) =>
      orchestratePiece({
        intent: piece,
        photoUrl: opts.photoUrl,
        serpApiKey: opts.serpApiKey,
        openAiKey: opts.openAiKey,
        priceMode: opts.priceMode,
        gender: opts.gender,
        sizes: opts.sizes,
        affiliateTag: opts.affiliateTag,
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

  return { pieces, piece_sessions, metrics, version: SEARCH_V2_VERSION };
}
