import type { StoredResults, PieceResult } from "@/components/analyze/types";
import { normalizeToPieces, isOutfitResults } from "@/components/analyze/types";
import { SLOT_LABELS } from "@/components/analyze/types";

export type SearchHistoryRow = {
  id: string;
  photo_url: string;
  results: string | StoredResults | null;
  created_at: string;
};

export function parseHistoryResults(raw: string | StoredResults | null): StoredResults | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as StoredResults;
    } catch {
      return null;
    }
  }
  return raw;
}

export function getHistoryPieces(raw: string | StoredResults | null): PieceResult[] {
  return normalizeToPieces(parseHistoryResults(raw));
}

export function formatHistoryDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export { SLOT_LABELS, isOutfitResults };
