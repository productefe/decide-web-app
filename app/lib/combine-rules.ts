/**
 * Deterministic outfit-slot rules for Combine.
 * The LLM must ONLY fill slots returned by resolveCombineSlots — never invent slots.
 */

export const COMBINE_OUTFIT_SLOTS = ["top", "bottom", "shoes", "outerwear", "accessory"] as const;
export type CombineOutfitSlot = (typeof COMBINE_OUTFIT_SLOTS)[number];

export const COMBINE_PIECE_CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "shoes",
  "outerwear",
  "accessory",
] as const;
export type CombinePieceCategory = (typeof COMBINE_PIECE_CATEGORIES)[number];

export const COMBINE_RULES: Record<CombinePieceCategory, readonly CombineOutfitSlot[]> = {
  top: ["bottom", "shoes", "accessory"],
  bottom: ["top", "shoes", "accessory"],
  dress: ["shoes", "outerwear", "accessory"],
  shoes: ["top", "bottom", "accessory"],
  outerwear: ["top", "bottom", "shoes", "accessory"],
  // Accessory style drives filters for a full base outfit (no second accessory slot)
  accessory: ["top", "bottom", "shoes"],
};

export const COMBINE_SLOT_LABEL_TR: Record<CombineOutfitSlot, string> = {
  top: "Üst",
  bottom: "Alt",
  shoes: "Ayakkabı",
  outerwear: "Dış giyim",
  accessory: "Aksesuar",
};

export const COMBINE_SLOT_CATEGORY_TR: Record<CombineOutfitSlot, string> = {
  top: "tişört",
  bottom: "pantolon",
  shoes: "ayakkabı",
  outerwear: "ceket",
  accessory: "aksesuar",
};

export type AnalysisContext = "sport" | "casual" | "evening";

export const ANALYSIS_CONTEXT_VALUES = ["sport", "casual", "evening"] as const;

export const CONTEXT_TO_OCCASION: Record<AnalysisContext, "spor" | "gundelik" | "aksam"> = {
  sport: "spor",
  casual: "gundelik",
  evening: "aksam",
};

export const OCCASION_TO_CONTEXT: Record<"spor" | "gundelik" | "aksam", AnalysisContext> = {
  spor: "sport",
  gundelik: "casual",
  aksam: "evening",
};

export const CONTEXT_LABEL_TR: Record<AnalysisContext, string> = {
  sport: "Spor",
  casual: "Gündelik",
  evening: "Akşam çıkmalık",
};

/** Map vision / piece labels to a CombinePieceCategory. */
export function resolveCombinePieceCategory(
  category: string | null | undefined,
  categoryTr: string | null | undefined,
  label?: string | null
): CombinePieceCategory | null {
  const blob = `${category ?? ""} ${categoryTr ?? ""} ${label ?? ""}`.toLowerCase();
  if (!blob.trim()) return null;

  if (/gözlük|glasses|sunglasses|eyewear|saat|watch|şapka|hat|bere|beanie|cap|çanta|bag|backpack|kemer|belt|atkı|scarf|cüzdan|wallet/.test(blob)) {
    return "accessory";
  }
  if (/elbise|dress|jumpsuit|tulum/.test(blob)) return "dress";
  if (/ayakkabı|sneaker|bot|sandal|loafer|heel|oxford|shoe/.test(blob)) return "shoes";
  if (/ceket|jacket|blazer|kaban|coat|trenç|trench|outer|yelek|vest/.test(blob)) {
    return "outerwear";
  }
  if (/etek|skirt|pantolon|pants|trousers|jeans|chino|jogger|eşofman|şort|shorts|tayt|leggings|bottom/.test(blob)) {
    return "bottom";
  }
  if (
    /tişört|t-shirt|tshirt|tee|polo|gömlek|shirt|hoodie|sweatshirt|kazak|sweater|cardigan|hırka|crop|üst|top|bluz|blouse/.test(
      blob
    )
  ) {
    return "top";
  }
  return null;
}

export function resolveCombineSlots(
  category: CombinePieceCategory
): readonly CombineOutfitSlot[] {
  return COMBINE_RULES[category];
}

export function parseAnalysisContext(raw: unknown): AnalysisContext | null {
  if (raw === "sport" || raw === "casual" || raw === "evening") return raw;
  return null;
}
