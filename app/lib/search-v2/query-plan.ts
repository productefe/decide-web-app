import type { PriceMode, UserGender } from "@/lib/preferences";
import {
  pickDecidePoolBrands,
  TRUSTED_SEARCH_STORES,
  WEAK_SHOPPING_BRANDS,
} from "@/constants/brandPool";
import type { PieceFamily, ProductIntent } from "./schema";
import { familyTitleTokens } from "./normalize-intent";

export interface QueryVariant {
  id: string;
  q: string;
  kind: "brand" | "motif" | "broad" | "type";
}

export interface QueryPlan {
  intent_id: string;
  family: PieceFamily;
  lens: boolean;
  text_queries: QueryVariant[];
  all_variants: QueryVariant[];
  sizes: string[];
}

function genderToken(g: UserGender | null | undefined, intentGender: string): string {
  const side = g || (intentGender === "men" || intentGender === "women" ? intentGender : null);
  if (side === "men") return "erkek";
  if (side === "women") return "kadın";
  return "";
}

function typeToken(intent: ProductIntent): string {
  const tokens = familyTitleTokens(intent.family);
  if (intent.family === "jersey") {
    const club = intent.jersey_signals?.club;
    return club ? `${club} forma` : "futbol forması";
  }
  return tokens[0] || intent.category_tr || intent.subtype || "giyim";
}

function motifToken(intent: ProductIntent): string {
  const m = intent.motifs[0];
  if (!m) return "";
  return [m.type, m.text].filter(Boolean).join(" ").slice(0, 40);
}

function brandPoolFor(intent: ProductIntent, priceMode: PriceMode, gender: UserGender | null): string[] {
  const cat =
    intent.layer === "footwear"
      ? intent.family === "sneakers"
        ? "sneakers"
        : "shoes_classic"
      : intent.family === "bag"
        ? "bag"
        : intent.family === "watch"
          ? "watch"
          : intent.family === "sunglasses"
            ? "sunglasses"
            : intent.layer === "jewelry" || intent.layer === "accessory"
              ? "accessory"
              : intent.family === "dress"
                ? "dress"
                : ["pants", "jeans", "skirt", "shorts"].includes(intent.family)
                  ? "bottoms"
                  : ["blazer", "jacket", "coat"].includes(intent.family)
                    ? "outerwear"
                    : "tops";
  try {
    return pickDecidePoolBrands(
      {
        category: cat,
        category_tr: intent.category_tr,
        subcategory: intent.subtype,
        subcategory_tr: intent.category_tr,
        price_mode: priceMode,
        gender: gender || intent.gender || undefined,
      },
      8,
      intent.id
    );
  } catch {
    return [];
  }
}

function trustedStoresFor(intent: ProductIntent, priceMode: PriceMode): string[] {
  if (priceMode === "luks") return ["Beymen", "Network", "Hugo Boss", "Boyner"];
  if (intent.layer === "footwear") {
    return ["Nike", "Adidas", "Puma", "Skechers", "Zara", "Mavi", "Boyner"];
  }
  if (intent.family === "watch" || intent.layer === "jewelry") {
    return ["Mavi", "H&M", "Zara", "Trendyol", "Boyner"];
  }
  return TRUSTED_SEARCH_STORES;
}

function uniqueVariants(variants: QueryVariant[]): QueryVariant[] {
  const seen = new Set<string>();
  const out: QueryVariant[] = [];
  for (const v of variants) {
    const key = v.q.trim().toLocaleLowerCase("tr-TR");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function jerseySafe(intent: ProductIntent, variants: QueryVariant[]): QueryVariant[] {
  if (intent.family !== "jersey") return variants;
  return variants.map((v) => ({
    ...v,
    q: v.q.replace(/\b(tişört|tisort|t-shirt|tshirt)\b/gi, "forma"),
  }));
}

/**
 * Full rotation: color/type first, then trusted stores, then remaining pool brands.
 * Store names go at the end so Google Shopping TR does not treat them as a failed brand query.
 */
export function buildAllQueryVariants(
  intent: ProductIntent,
  opts: {
    priceMode: PriceMode;
    gender: UserGender | null;
    sizes: string[];
  }
): QueryVariant[] {
  const g = genderToken(opts.gender, intent.gender);
  const type = typeToken(intent);
  const color = intent.body_color && intent.body_color !== "bilinmeyen" ? intent.body_color : "";
  const motif = motifToken(intent);
  const luxury = opts.priceMode === "luks" ? "lüks" : "";
  const weak = new Set(WEAK_SHOPPING_BRANDS.map((b) => b.toLocaleLowerCase("tr-TR")));
  const stores = trustedStoresFor(intent, opts.priceMode);
  const brands = brandPoolFor(intent, opts.priceMode, opts.gender).filter(
    (b) => !weak.has(b.toLocaleLowerCase("tr-TR"))
  );

  const variants: QueryVariant[] = [];
  if (motif) {
    variants.push({
      id: "motif",
      kind: "motif",
      q: [g, color, type, motif].filter(Boolean).join(" "),
    });
  }
  variants.push({
    id: "type",
    kind: "type",
    q: [g, color, type, luxury].filter(Boolean).join(" "),
  });
  for (const store of stores) {
    variants.push({
      id: `store:${store}`,
      kind: "brand",
      q: [g, color, type, store].filter(Boolean).join(" "),
    });
  }
  variants.push({
    id: "broad",
    kind: "broad",
    q: [g, type].filter(Boolean).join(" "),
  });
  const used = new Set(stores.map((s) => s.toLocaleLowerCase("tr-TR")));
  for (const brand of brands) {
    if (used.has(brand.toLocaleLowerCase("tr-TR"))) continue;
    variants.push({
      id: `brand:${brand}`,
      kind: "brand",
      q: [g, color, type, brand].filter(Boolean).join(" "),
    });
  }
  return jerseySafe(intent, uniqueVariants(variants));
}

/**
 * Deterministic QueryPlan: Lens + 1 text query for the requested page.
 * Extra variants are used as in-request fallbacks when Shopping returns 0.
 */
export function buildQueryPlan(
  intent: ProductIntent,
  opts: {
    priceMode: PriceMode;
    gender: UserGender | null;
    sizes: string[];
    page?: number;
  }
): QueryPlan {
  const page = opts.page || 0;
  const all_variants = buildAllQueryVariants(intent, opts);
  const idx = Math.min(Math.max(page, 0), Math.max(all_variants.length - 1, 0));
  const primary = all_variants[idx];
  const text_queries = primary ? [primary] : [];

  return {
    intent_id: intent.id,
    family: intent.family,
    lens: true,
    text_queries,
    all_variants,
    sizes: opts.sizes,
  };
}
