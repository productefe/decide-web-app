/**
 * Combine V2 — single CombineIntent source.
 * LLM may only suggest color/style prefs; queries are deterministic templates.
 */

import type { PriceMode, UserGender } from "@/lib/preferences";
import type { AnalysisContext, CombineOutfitSlot } from "@/lib/combine-rules";
import { pickDecidePoolBrands } from "@/constants/brandPool";
import type { ProductCandidate, VerifiedCandidate } from "./schema";
import { searchGoogleShopping } from "./providers/google-shopping";
import { hardVerify } from "./verify";
import { rerankCandidates } from "./rank";
import { ensureSession, pickPage } from "./paginate";
import { createHash } from "crypto";
import type { ProductIntent, PieceFamily } from "./schema";
import { canonColor } from "./normalize-intent";

export interface CombineIntent {
  slot: CombineOutfitSlot;
  family: PieceFamily;
  category_tr: string;
  color_pref: string;
  style_pref: string;
  context: AnalysisContext;
  gender: UserGender | null;
  price_mode: PriceMode;
  sizes: string[];
}

const SLOT_FAMILY: Record<CombineOutfitSlot, PieceFamily> = {
  top: "shirt",
  bottom: "pants",
  shoes: "shoes",
  outerwear: "blazer",
  accessory: "belt",
};

const SLOT_CATEGORY_TR: Record<CombineOutfitSlot, string> = {
  top: "Üst",
  bottom: "Alt",
  shoes: "Ayakkabı",
  outerwear: "Dış giyim",
  accessory: "Aksesuar",
};

const CONTEXT_STYLE: Record<AnalysisContext, string> = {
  sport: "spor",
  home: "rahat",
  evening: "şık",
  casual: "günlük",
  work: "iş",
  beach: "yazlık",
};

function slotTypeToken(ci: CombineIntent): string {
  if (ci.context === "sport") {
    if (ci.slot === "top") return "tişört";
    if (ci.slot === "bottom") return "eşofman alt";
    if (ci.slot === "shoes") return "sneaker";
    if (ci.slot === "outerwear") return "hoodie";
    return "çanta";
  }
  if (ci.slot === "top") return ci.context === "evening" || ci.context === "work" ? "gömlek" : "gömlek";
  if (ci.slot === "bottom") return "pantolon";
  if (ci.slot === "shoes") return ci.context === "evening" || ci.context === "work" ? "klasik ayakkabı" : "ayakkabı";
  if (ci.slot === "outerwear") return ci.context === "work" ? "blazer" : "ceket";
  return "kemer";
}

function slotFamilyFor(ci: CombineIntent): PieceFamily {
  if (ci.context === "sport") {
    if (ci.slot === "top") return "tee";
    if (ci.slot === "shoes") return "sneakers";
    if (ci.slot === "outerwear") return "hoodie";
    if (ci.slot === "accessory") return "bag";
  }
  return SLOT_FAMILY[ci.slot];
}
function slotToIntent(ci: CombineIntent): ProductIntent {
  return {
    id: `combine-${ci.slot}`,
    label_tr: SLOT_CATEGORY_TR[ci.slot],
    family: ci.family,
    subtype: ci.family,
    category_tr: ci.category_tr,
    layer:
      ci.slot === "shoes"
        ? "footwear"
        : ci.slot === "accessory"
          ? "accessory"
          : ci.slot === "bottom"
            ? "bottom"
            : ci.slot === "outerwear"
              ? "outer"
              : "mid",
    visibility: "full",
    bounding_box: null,
    body_color: ci.color_pref || "bilinmeyen",
    secondary_colors: [],
    motifs: [],
    fit: "",
    material: "",
    gender: ci.gender || "",
    distinctive_details: ci.style_pref ? [ci.style_pref] : [],
    low_confidence: false,
  };
}

/** Color + type first. Brands only on later pages — they often return zero. */
export function buildCombineQueries(ci: CombineIntent, page = 0): string[] {
  const g = ci.gender === "men" ? "erkek" : ci.gender === "women" ? "kadın" : "";
  const type = slotTypeToken(ci);
  const color =
    ci.color_pref && ci.color_pref !== "bilinmeyen" ? canonColor(ci.color_pref) : "";
  if (page === 0) {
    return [[g, color, type].filter(Boolean).join(" ")];
  }
  if (page === 1) {
    return [[g, type].filter(Boolean).join(" ")];
  }
  const brands = pickDecidePoolBrands(
    {
      category:
        ci.slot === "shoes"
          ? ci.context === "sport"
            ? "sneakers"
            : "shoes_classic"
          : ci.slot === "accessory"
            ? "accessory"
            : ci.slot === "bottom"
              ? "bottoms"
              : ci.slot === "outerwear"
                ? "outerwear"
                : "tops",
      category_tr: ci.category_tr,
      price_mode: ci.price_mode,
      gender: ci.gender || undefined,
    },
    4,
    `${ci.slot}-${ci.context}`
  );
  const brand = brands[(page - 2) % Math.max(brands.length, 1)];
  return [[g, brand, type].filter(Boolean).join(" ")];
}

export function makeCombineIntent(opts: {
  slot: CombineOutfitSlot;
  context: AnalysisContext;
  gender: UserGender | null;
  priceMode: PriceMode;
  sizes: string[];
  colorPref?: string;
  stylePref?: string;
  familyOverride?: PieceFamily;
}): CombineIntent {
  const draft = {
    slot: opts.slot,
    family: opts.familyOverride || SLOT_FAMILY[opts.slot],
    category_tr: SLOT_CATEGORY_TR[opts.slot],
    color_pref: opts.colorPref ? canonColor(opts.colorPref) : "",
    style_pref: opts.stylePref || CONTEXT_STYLE[opts.context] || "",
    context: opts.context,
    gender: opts.gender,
    price_mode: opts.priceMode,
    sizes: opts.sizes,
  };
  return {
    ...draft,
    family: opts.familyOverride || slotFamilyFor(draft),
  };
}

export async function searchCombineSlot(opts: {
  intent: CombineIntent;
  serpApiKey: string;
  openAiKey?: string;
  sessionId?: string | null;
  page?: number;
}): Promise<{
  products: VerifiedCandidate[];
  exhausted: boolean;
  session_id: string;
  queries: string[];
}> {
  const page = opts.page || 0;
  const queries = buildCombineQueries(opts.intent, page);
  const batches = await Promise.all(
    queries.map((q) => searchGoogleShopping({ apiKey: opts.serpApiKey, query: q }))
  );
  const merged: ProductCandidate[] = batches.flat().map((c) => ({ ...c, provider: "combine" as const }));
  const pieceIntent = slotToIntent(opts.intent);
  const { kept } = hardVerify(merged, pieceIntent, {
    priceMode: opts.intent.price_mode,
    gender: opts.intent.gender,
    sizes: opts.intent.sizes,
  });
  const ranked = await rerankCandidates({
    intent: pieceIntent,
    candidates: kept,
    limit: 12,
    timeoutMs: 0,
  });

  const hash = createHash("sha1")
    .update(JSON.stringify(opts.intent))
    .digest("hex")
    .slice(0, 16);
  const session = ensureSession({
    sessionId: opts.sessionId,
    intentHash: hash,
    pieceKey: `combine:${opts.intent.slot}`,
  });
  const pageResult = pickPage(ranked, session, 3);
  return {
    products: pageResult.products,
    exhausted: pageResult.exhausted,
    session_id: session.id,
    queries,
  };
}

/** Optional LLM color/style prefs only — never free-form searchQuery. */
export async function suggestCombinePrefs(opts: {
  apiKey: string;
  context: AnalysisContext;
  pieceSummary: string;
}): Promise<{ color_pref: string; style_pref: string }> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Kombin için yalnız renk ve stil tercihi öner. Parça: ${opts.pieceSummary}. Context: ${opts.context}.
JSON: {"color_pref":"türkçe renk","style_pref":"kısa stil"}`,
          },
        ],
        max_tokens: 120,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(2500),
    });
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return { color_pref: "", style_pref: CONTEXT_STYLE[opts.context] };
    const parsed = JSON.parse(raw) as { color_pref?: string; style_pref?: string };
    return {
      color_pref: parsed.color_pref || "",
      style_pref: parsed.style_pref || CONTEXT_STYLE[opts.context],
    };
  } catch {
    return { color_pref: "", style_pref: CONTEXT_STYLE[opts.context] };
  }
}
