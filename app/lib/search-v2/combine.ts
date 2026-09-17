/**
 * Combine V2 — single CombineIntent source.
 * LLM may only suggest color/style prefs; queries are deterministic templates.
 */

import type { PriceMode, UserGender } from "@/lib/preferences";
import type { AnalysisContext, CombineOutfitSlot } from "@/lib/combine-rules";
import { CONTEXT_TO_OCCASION } from "@/lib/combine-rules";
import { TRUSTED_SEARCH_STORES } from "@/constants/brandPool";
import type { ProductCandidate, VerifiedCandidate } from "./schema";
import { searchGoogleShopping } from "./providers/google-shopping";
import { hardVerify } from "./verify";
import { rerankCandidates } from "./rank";
import { ensureSession, pickPage } from "./paginate";
import { dbg } from "./debug-log";
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
  const byContext: Record<AnalysisContext, Record<CombineOutfitSlot, string>> = {
    sport: {
      top: "teknik tişört",
      bottom: "tayt",
      shoes: "spor ayakkabı",
      outerwear: "hoodie",
      accessory: "spor çanta",
    },
    home: {
      top: "oversize tişört",
      bottom: "eşofman alt",
      shoes: "ev terliği",
      outerwear: "hırka",
      accessory: "çorap",
    },
    work: {
      top: "gömlek",
      bottom: "kumaş pantolon",
      shoes: "loafer",
      outerwear: "blazer",
      accessory: "kemer",
    },
    casual: {
      top: "tişört",
      bottom: "jean",
      shoes: "sneaker",
      outerwear: "hoodie",
      accessory: "kemer",
    },
    evening: {
      top: "saten bluz",
      bottom: "kumaş pantolon",
      shoes: "klasik ayakkabı",
      outerwear: "blazer",
      accessory: "şık çanta",
    },
    beach: {
      top: "kaftan",
      bottom: "şort",
      shoes: "sandalet",
      outerwear: "pareo",
      accessory: "hasır şapka",
    },
  };
  let type = byContext[ci.context]?.[ci.slot] || "giyim";
  if (ci.context === "work" && ci.slot === "bottom" && ci.gender === "women") type = "klasik etek";
  if (ci.context === "evening" && ci.slot === "shoes" && ci.gender === "women") type = "topuklu ayakkabı";
  if (ci.context === "sport" && ci.slot === "bottom" && ci.gender === "men") type = "spor şort";
  return type;
}

function slotFamilyFor(ci: CombineIntent): PieceFamily {
  if (ci.context === "sport") {
    if (ci.slot === "top") return "tee";
    if (ci.slot === "bottom") return ci.gender === "men" ? "shorts" : "pants";
    if (ci.slot === "shoes") return "sneakers";
    if (ci.slot === "outerwear") return "hoodie";
    if (ci.slot === "accessory") return "bag";
  }
  if (ci.context === "home") {
    if (ci.slot === "top") return "tee";
    if (ci.slot === "bottom") return "pants";
    if (ci.slot === "shoes") return "shoes";
    if (ci.slot === "outerwear") return "hoodie";
    return "other";
  }
  if (ci.context === "work") {
    if (ci.slot === "top") return "shirt";
    if (ci.slot === "bottom") return ci.gender === "women" ? "skirt" : "pants";
    if (ci.slot === "shoes") return "shoes";
    if (ci.slot === "outerwear") return "blazer";
    return "belt";
  }
  if (ci.context === "casual") {
    if (ci.slot === "top") return "tee";
    if (ci.slot === "bottom") return "jeans";
    if (ci.slot === "shoes") return "sneakers";
    if (ci.slot === "outerwear") return "hoodie";
    return "belt";
  }
  if (ci.context === "evening") {
    if (ci.slot === "top") return "blouse";
    if (ci.slot === "bottom") return "pants";
    if (ci.slot === "shoes") return "shoes";
    if (ci.slot === "outerwear") return "blazer";
    if (ci.slot === "accessory") return "bag";
  }
  if (ci.context === "beach") {
    if (ci.slot === "top") return "dress";
    if (ci.slot === "bottom") return "shorts";
    if (ci.slot === "shoes") return "shoes";
    if (ci.slot === "outerwear") return "other";
    if (ci.slot === "accessory") return "hat";
  }
  return SLOT_FAMILY[ci.slot];
}
function slotToIntent(ci: CombineIntent): ProductIntent {
  return {
    id: `combine-${ci.slot}`,
    label_tr: SLOT_CATEGORY_TR[ci.slot],
    family: ci.family,
    subtype: slotTypeToken(ci),
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

/** Color + type first. Trusted stores on later pages — luxury brand queries often return zero. */
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
  const store = TRUSTED_SEARCH_STORES[(page - 2) % TRUSTED_SEARCH_STORES.length];
  return [[g, color, type, store].filter(Boolean).join(" ")];
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
  const pieceIntent = slotToIntent(opts.intent);
  const occasion = CONTEXT_TO_OCCASION[opts.intent.context];
  const hash = createHash("sha1")
    .update(JSON.stringify(opts.intent))
    .digest("hex")
    .slice(0, 16);
  const session = ensureSession({
    sessionId: opts.sessionId,
    intentHash: hash,
    pieceKey: `combine:${opts.intent.slot}`,
  });

  const tried: string[] = [];
  let merged: ProductCandidate[] = [];
  let pageResult = {
    products: [] as VerifiedCandidate[],
    exhausted: true,
    page: session.page,
    session_id: session.id,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const queries = buildCombineQueries(opts.intent, page + attempt);
    const q = queries[0];
    if (!q || tried.includes(q)) continue;
    tried.push(q);
    const batch = await searchGoogleShopping({
      apiKey: opts.serpApiKey,
      query: q,
      num: 40,
    });
    merged = [...merged, ...batch];
    const { kept, stats } = hardVerify(merged, pieceIntent, {
      priceMode: opts.intent.price_mode,
      gender: opts.intent.gender,
      sizes: opts.intent.sizes,
      occasion,
      relaxLevel: 1,
      brandGate: "known",
    });
    const ranked = await rerankCandidates({
      intent: pieceIntent,
      candidates: kept,
      limit: 12,
      timeoutMs: 0,
    });
    if (ranked.length === 0) continue;
    pageResult = pickPage(ranked, session, 3);
    // #region agent log
    dbg("H3", "combine.ts:slot", "combine slot attempt", {
      slot: opts.intent.slot,
      context: opts.intent.context,
      query: q,
      batch: batch.length,
      kept: kept.length,
      picked: pageResult.products.length,
      occasionRejects: stats.rejects.occasion_conflict || 0,
      titles: pageResult.products.map((p) => p.title.slice(0, 80)),
    });
    // #endregion
    if (pageResult.products.length > 0) break;
  }

  return {
    products: pageResult.products,
    exhausted: pageResult.products.length === 0,
    session_id: session.id,
    queries: tried,
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
