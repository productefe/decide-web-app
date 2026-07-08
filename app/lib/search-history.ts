import type { Results } from "@/components/analyze/types";
import { SLOT_LABELS } from "@/components/analyze/types";

export type SearchHistoryRow = {
  id: string;
  photo_url: string;
  results: string | Results | null;
  created_at: string;
};

export function parseHistoryResults(raw: string | Results | null): Results | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Results;
    } catch {
      return null;
    }
  }
  return raw;
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

export { SLOT_LABELS };
