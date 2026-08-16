export type Stage = "idle" | "loading" | "result" | "error";

export interface Product {
  title: string;
  price: string;
  source: string;
  image: string;
  link: string;
  store: string;
  reason: string;
  label: string;
  priceValue?: number;
  product_id?: string | null;
  serpapi_immersive_product_api?: string | null;
}

export interface Results {
  recommended: Product | null;
  cheaper: Product | null;
  style: Product | null;
}

export interface PieceResult {
  label: string;
  category_tr: string;
  results: Results;
  /** Vision attributes persisted for Combine (optional on legacy rows). */
  category?: string;
  color_tr?: string;
  fit?: string;
  gender?: string;
  style_tags?: string[];
  subcategory?: string;
  length?: string;
  neckline?: string;
  sleeve_or_strap?: string;
  secondary_colors?: string[];
  patterns?: { type: string; colors: string[]; placement: string }[];
  material_impression?: string;
  distinctive_details?: string[];
  low_confidence?: boolean;
}

/** Stored in search_history — supports legacy flat Results or outfit pieces. */
export type StoredResults = Results | { pieces: PieceResult[] };

export const SLOT_LABELS: Record<string, string> = {
  recommended: "Önerilen",
  cheaper: "Daha uygun",
  style: "Sana özel",
};

export function cleanStoreName(source: string): string {
  if (!source) return "Mağaza";
  const first = source.split(/[-–]/)[0].trim();
  return first.length > 20 ? first.slice(0, 20) + "…" : first;
}

export function isOutfitResults(stored: StoredResults | null): stored is { pieces: PieceResult[] } {
  return Boolean(stored && "pieces" in stored && Array.isArray(stored.pieces));
}

export function normalizeToPieces(stored: StoredResults | null): PieceResult[] {
  if (!stored) return [];
  if (isOutfitResults(stored)) return stored.pieces;
  return [{ label: "Parça", category_tr: "", results: stored }];
}
