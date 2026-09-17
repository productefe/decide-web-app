/**
 * Strict ProductIntent schema for Search V2.
 * Separate from V1 ProductProfile — maps to V1 response contract at the edge.
 */

export const EXTRACTOR_VERSION = "search-v2-vision-1";

export type PieceFamily =
  | "jersey"
  | "sweatshirt"
  | "hoodie"
  | "tee"
  | "shirt"
  | "blouse"
  | "blazer"
  | "jacket"
  | "coat"
  | "pants"
  | "jeans"
  | "skirt"
  | "dress"
  | "shorts"
  | "shoes"
  | "sneakers"
  | "boots"
  | "bag"
  | "watch"
  | "necklace"
  | "bracelet"
  | "earrings"
  | "ring"
  | "sunglasses"
  | "belt"
  | "hat"
  | "scarf"
  | "other";

export type LayerRole = "outer" | "mid" | "inner" | "bottom" | "footwear" | "accessory" | "jewelry";
export type Visibility = "full" | "partial" | "edge";
export type SizeStatus = "verified" | "likely" | "unknown" | "unavailable";

export interface BoundingBox {
  /** Normalized 0–1 relative to full image */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MotifSpec {
  type: string;
  colors: string[];
  placement: string;
  text?: string;
}

export interface ProductIntent {
  id: string;
  label_tr: string;
  family: PieceFamily;
  subtype: string;
  category_tr: string;
  layer: LayerRole;
  visibility: Visibility;
  bounding_box: BoundingBox | null;
  body_color: string;
  secondary_colors: string[];
  motifs: MotifSpec[];
  fit: string;
  material: string;
  gender: "men" | "women" | "unisex" | "";
  distinctive_details: string[];
  low_confidence: boolean;
  /** Club / number / logo signals for jerseys */
  jersey_signals?: {
    club?: string;
    number?: string;
    sport?: string;
  };
}

export interface OutfitIntent {
  extractor_version: string;
  pieces: ProductIntent[];
  occasion_hint?: string;
  notes?: string;
}

/** OpenAI Responses / structured output JSON Schema (strict). */
export const PRODUCT_INTENT_JSON_SCHEMA = {
  name: "outfit_intent_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["pieces", "occasion_hint", "notes"],
    properties: {
      occasion_hint: { type: "string" },
      notes: { type: "string" },
      pieces: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "label_tr",
            "family",
            "subtype",
            "category_tr",
            "layer",
            "visibility",
            "bounding_box",
            "body_color",
            "secondary_colors",
            "motifs",
            "fit",
            "material",
            "gender",
            "distinctive_details",
            "low_confidence",
            "jersey_signals",
          ],
          properties: {
            label_tr: { type: "string" },
            family: {
              type: "string",
              enum: [
                "jersey",
                "sweatshirt",
                "hoodie",
                "tee",
                "shirt",
                "blouse",
                "blazer",
                "jacket",
                "coat",
                "pants",
                "jeans",
                "skirt",
                "dress",
                "shorts",
                "shoes",
                "sneakers",
                "boots",
                "bag",
                "watch",
                "necklace",
                "bracelet",
                "earrings",
                "ring",
                "sunglasses",
                "belt",
                "hat",
                "scarf",
                "other",
              ],
            },
            subtype: { type: "string" },
            category_tr: { type: "string" },
            layer: {
              type: "string",
              enum: ["outer", "mid", "inner", "bottom", "footwear", "accessory", "jewelry"],
            },
            visibility: { type: "string", enum: ["full", "partial", "edge"] },
            bounding_box: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["x", "y", "w", "h"],
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    w: { type: "number" },
                    h: { type: "number" },
                  },
                },
                { type: "null" },
              ],
            },
            body_color: { type: "string" },
            secondary_colors: { type: "array", items: { type: "string" } },
            motifs: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["type", "colors", "placement", "text"],
                properties: {
                  type: { type: "string" },
                  colors: { type: "array", items: { type: "string" } },
                  placement: { type: "string" },
                  text: { type: "string" },
                },
              },
            },
            fit: { type: "string" },
            material: { type: "string" },
            gender: { type: "string", enum: ["men", "women", "unisex", ""] },
            distinctive_details: { type: "array", items: { type: "string" } },
            low_confidence: { type: "boolean" },
            jersey_signals: {
              type: "object",
              additionalProperties: false,
              required: ["club", "number", "sport"],
              properties: {
                club: { type: "string" },
                number: { type: "string" },
                sport: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export interface ProductCandidate {
  id: string;
  title: string;
  price: string;
  priceValue: number | null;
  source: string;
  store: string;
  image: string;
  link: string;
  product_id: string | null;
  serpapi_immersive_product_api: string | null;
  provider: "lens" | "shopping" | "combine";
  query?: string;
  thumbnail?: string;
}

export interface VerifiedCandidate extends ProductCandidate {
  reject_reason?: string;
  size_status: SizeStatus;
  visual_score: number;
  meta_score: number;
  score: number;
}

export interface PiecePage {
  products: VerifiedCandidate[];
  exhausted: boolean;
  page: number;
  session_id: string;
}
