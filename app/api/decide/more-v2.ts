import { createHash } from "crypto";
import type { PriceMode, UserGender, Occasion } from "@/lib/preferences";
import type { PieceResult, Results } from "@/components/analyze/types";
import {
  normalizeOutfitIntent,
  orchestratePiece,
  type ProductIntent,
} from "@/lib/search-v2";
import { dbg } from "@/lib/search-v2/debug-log";

function collectTitles(results: Results): string[] {
  return [results.recommended?.title, results.cheaper?.title, results.style?.title].filter(
    (t): t is string => Boolean(t)
  );
}

function lower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

/** Match exactly one photographed piece — never fall back to another shirt/gömlek. */
function findIntent(rawVision: string, pieceLabel: string): ProductIntent | null {
  try {
    const intent = normalizeOutfitIntent(JSON.parse(rawVision));
    const pieces = intent.pieces;
    if (pieces.length === 0) return null;
    const needle = (pieceLabel || "").trim().toLocaleLowerCase("tr-TR");
    if (!needle) return pieces.length === 1 ? pieces[0] : null;

    const exact = pieces.filter(
      (p) => lower(p.label_tr) === needle || lower(p.id) === needle
    );
    if (exact.length === 1) return exact[0];

    const scored = pieces
      .map((p) => {
        const color = p.body_color && p.body_color !== "bilinmeyen" ? lower(p.body_color) : "";
        const blob = lower(`${p.label_tr} ${color} ${p.subtype} ${p.category_tr}`);
        let score = 0;
        if (blob === needle) score += 8;
        if (lower(p.label_tr) && needle === lower(p.label_tr)) score += 6;
        if (color && needle.includes(color) && needle.includes(lower(p.label_tr))) score += 5;
        if (color && needle.includes(color) && needle.includes(lower(p.category_tr))) score += 4;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 1) return scored[0].p;
    if (scored.length > 1 && scored[0].score > scored[1].score) return scored[0].p;
    return null;
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
  excludeTitles?: string[];
  occasion?: Occasion | null;
}): Promise<{
  piece: PieceResult;
  exhausted: boolean;
  session_id: string;
  exclude_titles: string[];
}> {
  const intent = findIntent(opts.visionContent, opts.pieceLabel);
  const sameFamily = (() => {
    try {
      const all = normalizeOutfitIntent(JSON.parse(opts.visionContent)).pieces;
      return intent ? all.filter((p) => p.family === intent.family).length : all.length;
    } catch {
      return 0;
    }
  })();
  // #region agent log
  dbg("H13", "more-v2.ts:findIntent", "show-more piece match", {
    pieceLabel: opts.pieceLabel,
    matched: intent ? { id: intent.id, family: intent.family, label: intent.label_tr, color: intent.body_color } : null,
    sameFamilyCount: sameFamily,
  });
  // #endregion
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
    excludeTitles: [
      ...(opts.excludeTitles || []),
      ...(opts.existingResults ? collectTitles(opts.existingResults) : []),
    ],
    occasion: opts.occasion,
    outfitPieceCount: 1,
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
