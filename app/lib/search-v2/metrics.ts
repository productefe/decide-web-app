import type { VerifiedCandidate } from "./schema";

export interface SearchV2RequestMetrics {
  extractor_version: string;
  search_version: string;
  vision_ms?: number;
  vision_cached?: boolean;
  pieces: {
    label: string;
    candidates: number;
    kept: number;
    rejects: Record<string, number>;
    provider_ms: number;
    rerank_ms: number;
    selected_score?: number;
    size_status?: string;
  }[];
  empty_piece_rate?: number;
  shadow?: boolean;
}

/** Safe structured log — never log personal image URLs. */
export function logSearchV2Metrics(route: string, m: SearchV2RequestMetrics): void {
  console.log(
    JSON.stringify({
      tag: "search_v2_metrics",
      route,
      extractor_version: m.extractor_version,
      search_version: m.search_version,
      vision_ms: m.vision_ms,
      vision_cached: m.vision_cached,
      piece_count: m.pieces.length,
      empty_piece_rate: m.empty_piece_rate,
      shadow: m.shadow,
      pieces: m.pieces.map((p) => ({
        label: p.label,
        candidates: p.candidates,
        kept: p.kept,
        rejects: p.rejects,
        provider_ms: p.provider_ms,
        rerank_ms: p.rerank_ms,
        selected_score: p.selected_score,
        size_status: p.size_status,
      })),
    })
  );
}

export function sizeStatusSummary(products: VerifiedCandidate[]): string {
  const first = products[0];
  return first?.size_status || "unknown";
}
