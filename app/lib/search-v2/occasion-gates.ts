import type { Occasion } from "@/lib/preferences";
import type { PieceFamily } from "./schema";

function lower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

/**
 * Hard "never" lists from the occasion dressing brief.
 * Combine always applies these. Same-item search skips a token when the
 * photographed piece is that forbidden type (so a jean photo on Spor still finds jeans).
 */
const NEVER: Record<Occasion, RegExp> = {
  is: /şort|sort|mayo|bikini|crop\s*top|\bcrop\b|sneaker|spor ayakkab|eşofman|esofman|hoodie|kapüşon|kapuson|terlik|tayt|leggings|pijama|plaj|kaftan|bikini/,
  sahil: /blazer|ceket|mont|kaban|klasik ayakkabı|klasik ayakkabi|oxford|loafer|deri ayakkabı|kapalı ayakkabı|kumaş pantolon|kaşe|yün|trench/,
  ev: /blazer|topuk|stiletto|davet|abiye|smokin|oxford|klasik ayakkabı|klasik ayakkabi|takım elbise/,
  gundelik: /smokin|gece elbisesi|abiye|payet|saten elbise|bikini|mayo|plaj|kaftan|damatlık/,
  aksam: /eşofman|esofman|terlik|pijama|bikini|mayo|plaj|kaftan|jogger|hoodie|kapüşon|spor ayakkab|sneaker/,
  spor: /jean|kot\b|topuk|stiletto|elbise|blazer|gömlek|gomlek|loafer|oxford|klasik ayakkabı|smokin|takım elbise|davet|abiye/,
};

/** Photographed family that should not be wiped by its own occasion never-list. */
const FAMILY_EXEMPT: Partial<Record<Occasion, PieceFamily[]>> = {
  is: ["sneakers", "shorts", "hoodie", "tee", "sweatshirt"],
  sahil: ["jacket", "blazer", "coat", "shoes", "boots"],
  ev: ["blazer", "jacket", "dress", "shoes"],
  gundelik: ["dress", "blazer"],
  aksam: ["hoodie", "sweatshirt", "sneakers", "tee"],
  spor: ["jeans", "dress", "blazer", "shirt", "shoes"],
};

export const OCCASION_QUERY_HINT: Record<Occasion, string> = {
  is: "ofis",
  sahil: "plaj",
  ev: "ev rahat",
  gundelik: "günlük",
  aksam: "şık",
  spor: "spor",
};

export function occasionConflict(
  title: string,
  occasion: Occasion | null | undefined,
  family?: PieceFamily
): boolean {
  if (!occasion) return false;
  const t = lower(title);
  if (!NEVER[occasion].test(t)) return false;
  if (family && (FAMILY_EXEMPT[occasion] || []).includes(family)) {
    return false;
  }
  return true;
}
