import type { PriceMode, UserGender } from "@/lib/preferences";
import { pickDecidePoolBrands } from "@/constants/brandPool";
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
      6,
      intent.id
    );
  } catch {
    return [];
  }
}

/**
 * Deterministic QueryPlan: Lens + ≤2 text queries for first page.
 * Extra variants reserved for pagination rotation.
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
  const g = genderToken(opts.gender, intent.gender);
  const type = typeToken(intent);
  const color = intent.body_color && intent.body_color !== "bilinmeyen" ? intent.body_color : "";
  const size = opts.sizes[0] || "";
  const motif = motifToken(intent);
  const brands = brandPoolFor(intent, opts.priceMode, opts.gender);

  const variants: QueryVariant[] = [];

  // Brand-first
  if (brands[0]) {
    variants.push({
      id: "brand0",
      kind: "brand",
      q: [brands[0], color, type, g, size].filter(Boolean).join(" "),
    });
  }
  if (brands[1]) {
    variants.push({
      id: "brand1",
      kind: "brand",
      q: [brands[1], color, type, g].filter(Boolean).join(" "),
    });
  }

  // Motif synonym
  if (motif) {
    variants.push({
      id: "motif",
      kind: "motif",
      q: [color, type, motif, g, size].filter(Boolean).join(" "),
    });
  }

  // Type + color (always)
  variants.push({
    id: "type",
    kind: "type",
    q: [color, type, g, size, opts.priceMode === "luks" ? "lüks" : ""].filter(Boolean).join(" "),
  });

  // Color-safe broaden (drop motif/brand)
  variants.push({
    id: "broad",
    kind: "broad",
    q: [type, g, size].filter(Boolean).join(" "),
  });

  // Jersey never uses generic tee wording
  const filtered =
    intent.family === "jersey"
      ? variants.map((v) => ({
          ...v,
          q: v.q.replace(/\b(tişört|tisort|t-shirt|tshirt)\b/gi, "forma"),
        }))
      : variants;

  const byId = new Map(filtered.map((variant) => [variant.id, variant]));
  let text_queries: QueryVariant[];
  if (page === 0) {
    // The first page must never depend on a brand existing for the detected
    // family. A broad type+color query is the primary retrieval channel.
    text_queries = [byId.get("type"), byId.get("brand0")]
      .filter((variant): variant is QueryVariant => Boolean(variant));
  } else if (page === 1) {
    text_queries = [byId.get("motif") || byId.get("brand1"), byId.get("broad")]
      .filter((variant): variant is QueryVariant => Boolean(variant));
  } else {
    // Deterministically rotate remaining brand variants on later pages.
    const brands = filtered.filter((variant) => variant.kind === "brand");
    const start = Math.max(0, (page - 2) * 2);
    text_queries = brands.slice(start, start + 2);
    if (text_queries.length === 0 && byId.get("broad")) {
      text_queries = [byId.get("broad")!];
    }
  }

  return {
    intent_id: intent.id,
    family: intent.family,
    lens: true,
    text_queries,
    sizes: opts.sizes,
  };
}
