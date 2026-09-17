import { createHash } from "crypto";
import type { PriceMode, UserGender } from "@/lib/preferences";
import type { PieceResult, Results } from "@/components/analyze/types";
import {
  normalizeOutfitIntent,
  orchestratePiece,
  type ProductIntent,
} from "@/lib/search-v2";

function collectTitles(results: Results): string[] {
  return [results.recommended?.title, results.cheaper?.title, results.style?.title].filter(
    (t): t is string => Boolean(t)
  );
}

function findIntent(rawVision: string, pieceLabel: string): ProductIntent | null {
  try {
    const intent = normalizeOutfitIntent(JSON.parse(rawVision));
    return (
      intent.pieces.find(
        (p) => p.label_tr === pieceLabel || p.category_tr === pieceLabel || p.id === pieceLabel
      ) || intent.pieces[0] || null
    );
  } catch {
    return null;
  }
}

/**
 * Show-more V2: advances per-piece session cursor; does not relax the same batch.
 * Returns 200 + exhausted:true when no unique candidates remain (never 404).
 */
export async function runMoreV2(opts: {
  openAiKey: string;
  serpApiKey: string;
  photoUrl: string;
  visionContent: string;
  pieceLabel: string;
  sessionId?: string | null;
  page?: number;
  priceMode: PriceMode;
  gender: UserGender | null;
  sizes: string[];
  existingResults?: Results | null;
}): Promise<{
  piece: PieceResult;
  exhausted: boolean;
  session_id: string;
  exclude_titles: string[];
}> {
  const intent = findIntent(opts.visionContent, opts.pieceLabel);
  if (!intent) {
    return {
      piece: {
        label: opts.pieceLabel,
        category_tr: opts.pieceLabel,
        results: opts.existingResults || { recommended: null, cheaper: null, style: null },
      },
      exhausted: true,
      session_id: opts.sessionId || createHash("sha1").update(opts.pieceLabel).digest("hex").slice(0, 8),
      exclude_titles: opts.existingResults ? collectTitles(opts.existingResults) : [],
    };
  }

  const page = opts.page ?? 1;
  const result = await orchestratePiece({
    intent,
    photoUrl: opts.photoUrl,
    serpApiKey: opts.serpApiKey,
    openAiKey: opts.openAiKey,
    priceMode: opts.priceMode,
    gender: opts.gender,
    sizes: opts.sizes,
    sessionId: opts.sessionId,
    page,
  });

  // Merge: append new cards onto existing when partial; never wipe old on failure
  const merged: Results = { ...(opts.existingResults || { recommended: null, cheaper: null, style: null }) };
  if (result.results.recommended) {
    // Rotate: new products become the three slots
    merged.recommended = result.results.recommended;
    merged.cheaper = result.results.cheaper;
    merged.style = result.results.style;
  }

  const piece: PieceResult = {
    label: result.label,
    results: merged,
    ...result.attrs,
    category_tr: result.category_tr,
  };

  return {
    piece,
    exhausted: result.exhausted,
    session_id: result.session_id,
    exclude_titles: collectTitles(merged),
  };
}
