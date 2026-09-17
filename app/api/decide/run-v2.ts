import { randomUUID } from "crypto";
import type { Occasion, PriceMode, UserGender } from "@/lib/preferences";
import type { PieceResult, StoredResults } from "@/components/analyze/types";
import { OCCASION_TO_CONTEXT } from "@/lib/combine-rules";
import { resolveDecideOccasion } from "@/lib/occasion-guide";
import {
  EXTRACTOR_VERSION,
  SEARCH_V2_VERSION,
  extractOutfitIntent,
  orchestrateOutfit,
  logSearchV2Metrics,
  type SearchV2RequestMetrics,
} from "@/lib/search-v2";
import type { Results } from "@/components/analyze/types";

function collectTitles(results: Results): string[] {
  return [results.recommended?.title, results.cheaper?.title, results.style?.title].filter(
    (t): t is string => Boolean(t)
  );
}

export interface RunSearchV2Input {
  openAiKey: string;
  serpApiKey: string;
  affiliateTag: string;
  userId: string;
  photoUrl: string;
  visionImageUrl: string;
  sizes: string[];
  priceMode: PriceMode;
  gender: UserGender | null;
  requestedOccasion: Occasion | null;
  anonymous: boolean;
  /** Optional supabase insert helper */
  persistHistory?: (row: {
    id: string;
    user_id: string;
    photo_url: string;
    results: StoredResults;
    context: string;
  }) => Promise<void>;
}

export async function runSearchV2(input: RunSearchV2Input) {
  const tVision = Date.now();
  const { intent, image_hash, cached, raw } = await extractOutfitIntent({
    apiKey: input.openAiKey,
    imageDataUrl: input.visionImageUrl,
    userId: input.userId,
  });
  const vision_ms = Date.now() - tVision;

  // Map occasion hint through existing resolver when possible
  const occasion =
    resolveDecideOccasion(input.requestedOccasion, JSON.stringify({ occasion_hint: intent.occasion_hint })) ||
    input.requestedOccasion ||
    "gundelik";

  // Apply user gender onto intents
  const gendered = {
    ...intent,
    pieces: intent.pieces.map((p) => ({
      ...p,
      gender: (input.gender || p.gender || "") as typeof p.gender,
    })),
  };

  const { pieces, piece_sessions, metrics, version } = await orchestrateOutfit({
    intent: gendered,
    photoUrl: input.photoUrl,
    serpApiKey: input.serpApiKey,
    openAiKey: input.openAiKey,
    priceMode: input.priceMode,
    gender: input.gender,
    sizes: input.sizes,
    affiliateTag: input.affiliateTag,
    occasion: input.requestedOccasion,
  });

  const empty_piece_rate =
    gendered.pieces.length === 0
      ? 1
      : Math.max(0, gendered.pieces.length - pieces.length) / gendered.pieces.length;

  const serp_ms = metrics.reduce((max, m) => Math.max(max, m.serp_ms || 0), 0);
  const lens_ms = metrics.reduce((max, m) => Math.max(max, m.lens_ms || 0), 0);
  const rerank_ms = metrics.reduce((max, m) => Math.max(max, m.rerank_ms || 0), 0);

  const metricsPayload: SearchV2RequestMetrics = {
    extractor_version: EXTRACTOR_VERSION,
    search_version: version || SEARCH_V2_VERSION,
    vision_ms,
    vision_cached: cached,
    serp_ms,
    lens_ms,
    rerank_ms,
    empty_piece_rate,
    pieces: pieces.map((p, i) => ({
      label: p.label,
      candidates: metrics[i]?.candidates || 0,
      kept: metrics[i]?.kept || 0,
      rejects: metrics[i]?.rejects || {},
      provider_ms: metrics[i]?.provider_ms || 0,
      rerank_ms: metrics[i]?.rerank_ms || 0,
      serp_ms: metrics[i]?.serp_ms || 0,
      lens_ms: metrics[i]?.lens_ms || 0,
      selected_score: undefined,
      size_status: "unknown",
    })),
  };
  logSearchV2Metrics("/api/decide", metricsPayload);

  // #region agent log
  fetch("http://127.0.0.1:7612/ingest/dcbec1f8-f218-4dc2-b274-e76ed38526b3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ea0199",
    },
    body: JSON.stringify({
      sessionId: "ea0199",
      runId: "post-fix",
      hypothesisId: "D",
      location: "run-v2.ts:outcome",
      message: "search v2 outfit outcome",
      data: {
        visionMs: vision_ms,
        visionCached: cached,
        serpMs: serp_ms,
        lensMs: lens_ms,
        rerankMs: rerank_ms,
        priceMode: input.priceMode,
        intentPieces: gendered.pieces.length,
        resultPieces: pieces.length,
        emptyPieceRate: empty_piece_rate,
        families: gendered.pieces.map((p) => p.family),
        metrics: metrics.map((m, i) => ({
          label: pieces[i]?.label || gendered.pieces[i]?.label_tr,
          candidates: m.candidates,
          kept: m.kept,
          rejects: m.rejects,
          providerMs: m.provider_ms,
          serpMs: m.serp_ms,
          lensMs: m.lens_ms,
          rerankMs: m.rerank_ms,
        })),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  console.log(
    "[search-v2-debug]",
    "D",
    "run-v2.ts:outcome",
    JSON.stringify({
      visionMs: vision_ms,
      serpMs: serp_ms,
      lensMs: lens_ms,
      rerankMs: rerank_ms,
      intentPieces: gendered.pieces.length,
      resultPieces: pieces.length,
      emptyPieceRate: empty_piece_rate,
    })
  );

  if (pieces.length === 0) {
    return {
      ok: false as const,
      error: "Bu fotoğraf için sonuç bulunamadı.",
      pieces: [] as PieceResult[],
      metrics: metricsPayload,
      image_hash,
      intent_raw: raw,
      occasion,
    };
  }

  const stored: StoredResults = {
    pieces,
    vision_content: raw,
  };
  const context = OCCASION_TO_CONTEXT[occasion];
  const history_id = !input.anonymous ? randomUUID() : null;
  if (history_id && input.persistHistory) {
    await input.persistHistory({
      id: history_id,
      user_id: input.userId,
      photo_url: input.photoUrl,
      results: stored,
      context,
    });
  }

  return {
    ok: true as const,
    user_id: input.userId,
    photo_url: input.photoUrl,
    pieces,
    results: pieces[0].results,
    exclude_titles: pieces.flatMap((p) => collectTitles(p.results)),
    occasion,
    context,
    history_id,
    price_mode: input.priceMode,
    search_version: SEARCH_V2_VERSION,
    extractor_version: EXTRACTOR_VERSION,
    piece_sessions,
    image_hash,
    intent_raw: raw,
    metrics: metricsPayload,
  };
}
