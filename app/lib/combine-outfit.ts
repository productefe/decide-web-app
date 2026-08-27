import {
  COMBINE_SLOT_CATEGORY_TR,
  COMBINE_SLOT_LABEL_TR,
  CONTEXT_LABEL_TR,
  CONTEXT_TO_OCCASION,
  resolveCombineSlots,
  type AnalysisContext,
  type CombineOutfitSlot,
  type CombinePieceCategory,
} from "@/lib/combine-rules";
import { truncateForPrompt } from "@/lib/api-security";
import { asLower, asStringList } from "@/lib/text";
import type { PriceMode } from "@/lib/preferences";
import {
  getOccasionGuide,
  getOccasionKeyword,
  withOccasionSearchPhrase,
} from "@/lib/occasion-guide";
import {
  detectAccessoryKind,
  defaultAccessoryKind,
  sanitizeAccessoryQuery,
  titleLooksLikeGarment,
  titleContradictsEyewearKind,
  type ProductProfile,
  type UserProfile,
} from "@/api/decide/pipeline";
import { processPiece } from "@/api/decide/run-piece";
import type { PieceResult } from "@/components/analyze/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Concrete accessory kinds — never vague "aksesuar". */
const ACCESSORY_KINDS: { type: string; re: RegExp }[] = [
  { type: "kolye", re: /kolye|necklace|pendant/i },
  { type: "küpe", re: /küpe|kupe|earring/i },
  { type: "bileklik", re: /bileklik|bracelet/i },
  { type: "yüzük", re: /yüzük|yuzuk|ring\b/i },
  { type: "kemer", re: /kemer|belt/i },
  { type: "çanta", re: /çanta|canta|bag|clutch|tote|backpack|sırt/i },
  { type: "saat", re: /saat|watch/i },
  { type: "güneş gözlüğü", re: /güneş gözlüğü|güneş gozluk|sunglasses?|sun\s*glasses/i },
  { type: "gözlük", re: /gözlük|gozluk|glasses|eyewear/i },
  { type: "şapka", re: /şapka|sapka|hat|bere|beanie|cap\b/i },
  { type: "atkı", re: /atkı|atki|scarf/i },
];

/** Extra deny when searching watches specifically. */
const WATCH_DENY_TITLE_RE =
  /kol\s*düğme|kol\s*dugme|cuff\s*link|cufflink|düğme\s*kapağı|button\s*cover|saat\s*desenli\s*kol|watch\s*print\s*cuff/i;

export type CombinePieceAttributes = {
  category: string;
  category_tr: string;
  label: string;
  color_tr?: string;
  fit?: string;
  gender?: string;
  style_tags?: string[];
};

export type CombineSlotSuggestion = {
  slot: CombineOutfitSlot;
  color: string;
  styleDescriptor: string;
  searchQuery: string;
  /** Concrete accessory type when slot === accessory (e.g. kemer, kolye). */
  accessoryType?: string;
};

export type CombineSlotResult = {
  slot: CombineOutfitSlot;
  label_tr: string;
  suggestion: CombineSlotSuggestion;
  piece: PieceResult;
};

export type CombineOutfitInput = {
  pieceCategory: CombinePieceCategory;
  attributes: CombinePieceAttributes;
  context: AnalysisContext;
  userProfile: UserProfile;
  photoUrl: string;
  userId: string;
  openaiKey: string;
  serpKey: string;
  affiliateTag: string;
  /** When set, only re-search this slot (show-more). */
  onlySlot?: CombineOutfitSlot;
  /** Prior LLM suggestion to reuse on show-more (skip LLM). */
  reuseSuggestion?: CombineSlotSuggestion;
  excludeTitles?: Set<string>;
};

export type CombineOutfitResult = {
  slots: CombineSlotResult[];
  suggestions: CombineSlotSuggestion[];
  /** Wall-clock ms for LLM suggestion vs shopping search stages. */
  timing?: { llm_ms: number; serp_ms: number; reused_suggestion: boolean };
};

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

type LlmSlotPayload = {
  color?: unknown;
  styleDescriptor?: unknown;
  searchQuery?: unknown;
  accessoryType?: unknown;
};

function detectAccessoryType(text: string): string | null {
  return detectAccessoryKind(text);
}

async function openAIContent(apiKey: string, body: unknown): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as OpenAIChatResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "OpenAI isteği başarısız oldu.");
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI boş yanıt döndürdü.");
  return content;
}

function buildCombinePrompt(
  slots: readonly CombineOutfitSlot[],
  attributes: CombinePieceAttributes,
  context: AnalysisContext,
  genderWord: string
): string {
  const slotList = slots.join(", ");
  const contextTr = CONTEXT_LABEL_TR[context];
  const color = truncateForPrompt(attributes.color_tr || "", 40);
  const fit = truncateForPrompt(attributes.fit || "", 40);
  const gender = genderWord || truncateForPrompt(attributes.gender || "", 20);
  const tags = asStringList(attributes.style_tags).slice(0, 6).map((t) => truncateForPrompt(t, 30));
  const pieceLabel = truncateForPrompt(attributes.label || attributes.category_tr, 60);
  const pieceCat = truncateForPrompt(attributes.category || attributes.category_tr, 60);
  const accessoryKinds = ACCESSORY_KINDS.map((k) => k.type).join("|");

  const occasion = CONTEXT_TO_OCCASION[context];
  const guide = getOccasionGuide(occasion);
  const occasionBrief = guide?.combineNote || `Keep suggestions consistent with ${contextTr}.`;

  const accessoryField = slots.includes("accessory")
    ? `,"accessoryType":"one of: ${accessoryKinds}"`
    : "";

  return `You are a fashion stylist for a Turkish shopping app. Suggest complementary outfit pieces for shopping search.

SOURCE PIECE:
- label: ${pieceLabel}
- category: ${pieceCat}
- color: ${color || "unknown"}
- fit/style: ${fit || "unknown"}
- gender: ${gender || "unisex"}
- style_tags: ${tags.length ? tags.join(", ") : "none"}

GENDER LOCK — wearer's gender is mandatory:
${
  genderWord === "erkek"
    ? `- EVERY searchQuery MUST include "erkek". Never suggest kadın/bayan products.
- shoes: ONLY sneaker, bot, loafer, oxford, derby — NEVER topuklu, stiletto, pump.
- Never suggest elbise, etek, crop top, bralet, küpe, kolye.
- accessory: saat, kemer, gözlük, şapka — not küpe/kolye.`
    : genderWord === "kadın"
      ? `- EVERY searchQuery MUST include "kadın". Never suggest erkek-only products.
- shoes may be topuklu / sneaker / bot / loafer as the occasion requires.`
      : `- Gender unknown: prefer unisex types (sneaker, loafer, tişört). Never default to topuklu.`
}

CONTEXT (occasion) is the PRIMARY constraint — not optional flavor:
${occasionBrief}

Fill ONLY these outfit slots: [${slotList}]
Return ONLY valid JSON (no markdown) with exactly these keys under "slots":
{"slots":{${slots
    .map(
      (s) =>
        s === "accessory"
          ? `"accessory":{"color":"...","styleDescriptor":"...","searchQuery":"...","accessoryType":"..."}`
          : `"${s}":{"color":"...","styleDescriptor":"...","searchQuery":"..."}`
    )
    .join(",")}}}

Rules:
- Only fill the given slots — never add other slots.
- Never invent product names, brands, or store names.
- searchQuery must be Turkish shopping keywords, 4–10 words, MUST fit ${contextTr}, and MUST encode layered product attributes when relevant:
  - tops: yaka (bisiklet/v yaka/polo), kesim (slim/oversize/regular), tip (tişört/atlet/askılı/baskılı)
  - bottoms: tür (chino/kot/jogger/eşofman/şort), paça (skinny/regular/wide)
- shoes: tip + renk — NEVER write generic "ayakkabı" alone. For erkek: sneaker/bot/loafer/oxford/sandalet only. For kadın: sneaker/bot/loafer/topuklu/sandalet as occasion allows.
- accessory: concrete type only (kemer/çanta/saat/gözlük/şapka/kolye/küpe…)
  - NEVER write generic "aksesuar"
  - NEVER write garment words (elbise, tişört, pantolon, gömlek, yelek, ayakkabı, abiye)
  - saat: include kayış (deri/metal/silikon) + renk
  - gözlük: include çerçeve şekli (yuvarlak/kare/aviator) + renk
- Color may complement the source piece, but garment TYPE must follow the occasion rules above.
- Prefer safe, widely-wearable combinations over adventurous color theory.
- styleDescriptor: short Turkish phrase describing THE SAME item as searchQuery (include the same cut/collar/type words).
- For non-accessory slots: never suggest jewelry, bags, belts, watches, hats — only that garment/shoe type.
- For accessory slot (if present):
  - Pick ONE type from: ${accessoryKinds}
  - accessoryType, styleDescriptor, and searchQuery MUST all refer to that SAME type.
  - Never suggest clothing (yelek, ceket, tişört, pantolon, elbise, ayakkabı) as accessory.
  - For saat: only wristwatches / kol saati / akıllı saat — NEVER kol düğmesi, cufflink, or "saat desenli" buttons. Always mention strap (deri kayış / metal kordon / silikon kayış).
  - For güneş gözlüğü: ONLY wearable sunglasses. NEVER gözlük kutusu, kılıf, okuma gözlüğü, optik, numaralı, or generic "gözlük".
  - For gözlük: prescription / optical frames only — NEVER güneş gözlüğü and NEVER a case.
  - Always mention frame shape (yuvarlak/kare/aviator) and frame color for eyewear.
  - Match metal/color to the source piece when suggesting jewelry.${accessoryField}`;
}

function normalizeAccessorySuggestion(
  raw: CombineSlotSuggestion,
  context: AnalysisContext,
  genderWord = ""
): CombineSlotSuggestion | null {
  if (raw.slot !== "accessory") return raw;

  const fallbackType = defaultAccessoryKind(context, genderWord || undefined);
  const blob = `${raw.accessoryType || ""} ${raw.styleDescriptor} ${raw.searchQuery}`;
  const clothingLeak = titleLooksLikeGarment(blob) && !detectAccessoryType(blob);

  let type =
    (typeof raw.accessoryType === "string" && detectAccessoryType(raw.accessoryType)) ||
    detectAccessoryType(raw.searchQuery) ||
    detectAccessoryType(raw.styleDescriptor) ||
    fallbackType;

  if (genderWord === "erkek" && /küpe|kolye|bileklik|yüzük/.test(asLower(type))) {
    type = fallbackType;
  }
  if (context === "beach" && type === "gözlük") {
    type = "güneş gözlüğü";
  }

  let styleDescriptor = raw.styleDescriptor;
  let searchQuery = raw.searchQuery;
  if (clothingLeak || !detectAccessoryType(styleDescriptor)) {
    styleDescriptor = `${raw.color || ""} ${type}`.trim();
  }
  if (clothingLeak || !detectAccessoryType(searchQuery)) {
    searchQuery = `${raw.color || ""} ${type}`.trim();
  }
  searchQuery = sanitizeAccessoryQuery(searchQuery, type);
  if (!detectAccessoryType(styleDescriptor)) {
    styleDescriptor = `${raw.color || ""} ${type}`.trim();
  }
  // Reject if descriptor names a different accessory than query
  const typeFromDesc = detectAccessoryType(styleDescriptor);
  const typeFromQuery = detectAccessoryType(searchQuery);
  if (typeFromDesc && typeFromQuery && typeFromDesc !== typeFromQuery) {
    styleDescriptor = searchQuery;
  }

  return {
    ...raw,
    accessoryType: type,
    styleDescriptor: truncateForPrompt(styleDescriptor, 80),
    searchQuery: truncateForPrompt(searchQuery, 120),
  };
}

function parseCombineSuggestions(
  content: string,
  expectedSlots: readonly CombineOutfitSlot[],
  context: AnalysisContext,
  genderWord = ""
): CombineSlotSuggestion[] | null {
  let parsed: { slots?: Record<string, LlmSlotPayload> };
  try {
    parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as {
      slots?: Record<string, LlmSlotPayload>;
    };
  } catch {
    return null;
  }

  if (!parsed.slots || typeof parsed.slots !== "object") return null;

  const out: CombineSlotSuggestion[] = [];
  for (const slot of expectedSlots) {
    const raw = parsed.slots[slot];
    if (!raw || typeof raw !== "object") return null;
    const color = typeof raw.color === "string" ? raw.color.trim() : "";
    const styleDescriptor =
      typeof raw.styleDescriptor === "string" ? raw.styleDescriptor.trim() : "";
    const searchQuery = typeof raw.searchQuery === "string" ? raw.searchQuery.trim() : "";
    const accessoryType =
      typeof raw.accessoryType === "string" ? raw.accessoryType.trim() : undefined;
    if (!searchQuery || searchQuery.length < 3) return null;

    const suggestion = sanitizeSlotForGender(
      normalizeAccessorySuggestion(
        {
          slot,
          color: truncateForPrompt(color, 40),
          styleDescriptor: truncateForPrompt(styleDescriptor, 80),
          searchQuery: truncateForPrompt(searchQuery, 120),
          accessoryType,
        },
        context,
        genderWord
      ),
      context,
      genderWord
    );
    if (!suggestion) return null;
    out.push(suggestion);
  }
  return out;
}

async function generateSlotSuggestions(
  openaiKey: string,
  slots: readonly CombineOutfitSlot[],
  attributes: CombinePieceAttributes,
  context: AnalysisContext,
  genderWord: string
): Promise<CombineSlotSuggestion[]> {
  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: buildCombinePrompt(slots, attributes, context, genderWord),
      },
    ],
    max_tokens: 350,
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const first = await openAIContent(openaiKey, body);
  const parsed = parseCombineSuggestions(first, slots, context, genderWord);
  if (parsed) return parsed;

  // Skip a second LLM round-trip — heuristic queries keep combine fast.
  return heuristicSlotSuggestions(slots, attributes, context, genderWord);
}

function heuristicSlotSuggestions(
  slots: readonly CombineOutfitSlot[],
  attributes: CombinePieceAttributes,
  context: AnalysisContext,
  genderWord = ""
): CombineSlotSuggestion[] {
  const occasion = CONTEXT_TO_OCCASION[context];
  const guide = getOccasionGuide(occasion);
  const occasionWords = (guide?.searchPhrase || CONTEXT_LABEL_TR[context] || "").split(" ")[0] || "";
  const gender = genderWord || genderTr(attributes.gender);
  const color = (attributes.color_tr || "").trim();

  return slots.map((slot) => {
    if (slot === "accessory") {
      const type = defaultAccessoryKind(context, gender);
      const searchQuery = [gender, color, type, occasionWords].filter(Boolean).join(" ");
      return sanitizeSlotForGender(
        {
          slot,
          color,
          styleDescriptor: `${color} ${type}`.trim(),
          searchQuery: sanitizeAccessoryQuery(searchQuery, type),
          accessoryType: type,
        },
        context,
        gender
      )!;
    }
    const type =
      slot === "shoes"
        ? inferShoeSubcategory("", context, gender).subcategory_tr
        : COMBINE_SLOT_CATEGORY_TR[slot];
    const searchQuery = withOccasionSearchPhrase(
      [gender, color, type].filter(Boolean).join(" "),
      occasion,
      {
        forAccessory: false,
        category: slot === "shoes" ? "shoes" : slot,
        category_tr: type,
      }
    );
    return sanitizeSlotForGender(
      {
        slot,
        color,
        styleDescriptor: `${color} ${type}`.trim(),
        searchQuery: searchQuery || [gender, type].filter(Boolean).join(" "),
      },
      context,
      gender
    )!;
  });
}

function genderTr(gender: string | null | undefined): string {
  const g = asLower(gender);
  if (g === "men" || g === "erkek" || g === "male") return "erkek";
  if (g === "women" || g === "kadın" || g === "kadin" || g === "female") return "kadın";
  return "";
}

function inferShoeSubcategory(
  blob: string,
  context: AnalysisContext,
  genderWord = ""
): {
  subcategory: string;
  subcategory_tr: string;
} {
  const t = asLower(blob);
  const men = genderWord === "erkek";
  if (!men && /\b(topuk|stiletto|heel|pump)\b/.test(t)) {
    return { subcategory: "heel", subcategory_tr: "topuklu ayakkabı" };
  }
  if (/\b(bot|boot|chelsea)\b/.test(t)) return { subcategory: "boot", subcategory_tr: "bot" };
  if (!men && /\b(sandal|sandalet)\b/.test(t)) return { subcategory: "sandal", subcategory_tr: "sandalet" };
  if (/\b(loafer|mokasen|oxford|derby)\b/.test(t)) return { subcategory: "loafer", subcategory_tr: "loafer" };
  if (/\b(sneaker|spor ayakkabı|koşu)\b/.test(t) || context === "sport" || context === "home") {
    return { subcategory: "sneaker", subcategory_tr: "spor ayakkabı" };
  }
  if (context === "beach") {
    return { subcategory: "sandal", subcategory_tr: "sandalet" };
  }
  if (context === "evening") {
    return genderWord === "kadın"
      ? { subcategory: "heel", subcategory_tr: "topuklu ayakkabı" }
      : { subcategory: "loafer", subcategory_tr: "loafer" };
  }
  if (context === "work") return { subcategory: "loafer", subcategory_tr: "loafer" };
  return { subcategory: "sneaker", subcategory_tr: "spor ayakkabı" };
}

function ensureGenderInQuery(query: string, genderWord: string): string {
  if (!genderWord) return query;
  const q = asLower(query);
  if (q.includes(genderWord) || (genderWord === "kadın" && q.includes("kadin"))) return query;
  const stripped = query.replace(/\b(erkek|kadın|kadin|bayan)\b/gi, " ").replace(/\s+/g, " ").trim();
  return `${genderWord} ${stripped}`.trim();
}

function sanitizeSlotForGender(
  raw: CombineSlotSuggestion | null,
  context: AnalysisContext,
  genderWord: string
): CombineSlotSuggestion | null {
  if (!raw) return null;
  const next: CombineSlotSuggestion = { ...raw };
  if (genderWord === "erkek") {
    next.searchQuery = next.searchQuery
      .replace(/\b(bikini|bralet|crop\s*top)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    next.styleDescriptor = next.styleDescriptor
      .replace(/\b(bikini|bralet|crop\s*top)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (next.slot === "bottom" && context === "beach" && !/\b(şort|short|mayo)\b/i.test(next.searchQuery)) {
      next.searchQuery = `${next.searchQuery} deniz şortu`.trim();
    }
    if (next.slot === "shoes") {
      next.searchQuery = next.searchQuery
        .replace(/topuklu|stiletto|\bpump\b|kitten/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      next.styleDescriptor = next.styleDescriptor
        .replace(/topuklu|stiletto|\bpump\b|kitten/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const shoe = inferShoeSubcategory(
        `${next.searchQuery} ${next.styleDescriptor}`,
        context,
        genderWord
      );
      if (!/\b(sneaker|bot|loafer|oxford|derby|sandal|sandalet|ayakkabı)\b/i.test(next.searchQuery)) {
        next.searchQuery = `${next.searchQuery} ${shoe.subcategory_tr}`.trim();
      }
      if (!next.styleDescriptor) next.styleDescriptor = shoe.subcategory_tr;
    }
    next.searchQuery = next.searchQuery.replace(/\b(kadın|kadin|bayan)\b/gi, " ").replace(/\s+/g, " ").trim();
  }
  next.searchQuery = ensureGenderInQuery(next.searchQuery, genderWord);
  return next;
}

function accessoryDetailsFromText(text: string, accessoryType?: string): string[] {
  const t = asLower(text);
  const out: string[] = [];
  if (accessoryType === "saat" || /saat|watch/.test(t)) {
    if (/\b(deri|leather|nato)\b/.test(t)) out.push("deri kayış");
    else if (/\b(silikon|silicone|kauçuk)\b/.test(t)) out.push("silikon kayış");
    else if (/\b(metal|çelik|hasır)\b/.test(t)) out.push("metal kordon");
  }
  if (accessoryType === "gözlük" || accessoryType === "güneş gözlüğü" || /gözlük|glasses|sunglasses/.test(t)) {
    if (/\b(yuvarlak|round|oval)\b/.test(t)) out.push("yuvarlak çerçeve");
    else if (/\b(kare|square|dikdörtgen)\b/.test(t)) out.push("kare çerçeve");
    else if (/\b(aviator|damla|pilot)\b/.test(t)) out.push("aviator çerçeve");
    else if (/\b(kedi|cat[- ]?eye)\b/.test(t)) out.push("kedi gözü çerçeve");
  }
  return out;
}

function buildSlotProductProfile(
  input: CombineOutfitInput,
  suggestion: CombineSlotSuggestion
): ProductProfile {
  const isAccessory = suggestion.slot === "accessory";
  const genderFromUser = input.userProfile.gender || null;
  const genderFromPiece = input.attributes.gender || "";
  const gTr = genderTr(genderFromUser || genderFromPiece);
  const shoe =
    suggestion.slot === "shoes"
      ? inferShoeSubcategory(
          `${suggestion.searchQuery} ${suggestion.styleDescriptor}`,
          input.context,
          gTr
        )
      : { subcategory: "", subcategory_tr: "" };
  const accessoryType =
    suggestion.accessoryType ||
    detectAccessoryType(suggestion.searchQuery) ||
    defaultAccessoryKind(input.context, gTr);
  const categoryTr = isAccessory
    ? accessoryType
    : shoe.subcategory_tr || COMBINE_SLOT_CATEGORY_TR[suggestion.slot];
  const color = suggestion.color || input.attributes.color_tr || "";
  // Keep fit_tr short — full styleDescriptor polluted accessory searches (kolye → yelek).
  const fitTr = isAccessory ? "" : truncateForPrompt(suggestion.styleDescriptor, 40);

  const search_query = ensureGenderInQuery(
    withOccasionSearchPhrase(
      isAccessory
        ? sanitizeAccessoryQuery(suggestion.searchQuery, accessoryType)
        : suggestion.searchQuery,
      CONTEXT_TO_OCCASION[input.context],
      {
        forAccessory: isAccessory,
        category: isAccessory ? "accessory" : suggestion.slot === "shoes" ? "shoes" : suggestion.slot,
        category_tr: categoryTr,
        subcategory: isAccessory ? accessoryType : shoe.subcategory,
      }
    ),
    gTr
  );
  const fallback_query = isAccessory
    ? [gTr, color, accessoryType].filter(Boolean).join(" ").trim()
    : [gTr, color, categoryTr].filter(Boolean).join(" ").trim();
  const distinctive_details = isAccessory
    ? accessoryDetailsFromText(`${suggestion.searchQuery} ${suggestion.styleDescriptor}`, accessoryType)
    : [];

  return {
    photo_url: input.photoUrl,
    user_id: input.userId,
    user_profile: input.userProfile,
    category: isAccessory ? "accessory" : suggestion.slot === "shoes" ? "shoes" : suggestion.slot,
    category_tr: categoryTr,
    color_tr: color,
    colors: color ? [color] : [],
    fit: fitTr,
    fit_tr: fitTr,
    collar: "",
    collar_tr: "",
    pattern: "",
    pattern_tr: "",
    has_logo: false,
    style_tags: input.attributes.style_tags || [],
    gender: genderFromUser || genderFromPiece || "",
    gender_tr: gTr,
    search_query,
    fallback_query,
    subcategory: isAccessory ? accessoryType : shoe.subcategory,
    subcategory_tr: isAccessory ? accessoryType : shoe.subcategory_tr,
    secondary_colors: [],
    length: "",
    length_tr: "",
    neckline: "",
    sleeve_or_strap: "",
    sleeve_or_strap_tr: "",
    patterns: [],
    material_impression: "",
    material_tr: "",
    distinctive_details,
    core_query: search_query || fallback_query,
    low_confidence: !categoryTr,
  };
}

/**
 * One structured LLM call (unless reuseSuggestion), then existing processPiece
 * search pipeline per outfit slot from COMBINE_RULES.
 *
 * Full combine overlaps LLM with heuristic Serp so wall-clock ≈ max(LLM, Serp)
 * instead of LLM + Serp. Product cards come from the heuristic search; LLM only
 * refreshes slot labels / accessoryType (no second Serp round).
 */
export async function combineOutfit(input: CombineOutfitInput): Promise<CombineOutfitResult> {
  const allSlots = resolveCombineSlots(input.pieceCategory);
  const slots =
    input.onlySlot && allSlots.includes(input.onlySlot) ? [input.onlySlot] : allSlots;

  const genderWord =
    genderTr(input.userProfile.gender) || genderTr(input.attributes.gender);

  const occasion = CONTEXT_TO_OCCASION[input.context];
  const occasionKeyword = getOccasionKeyword(occasion);
  const exclude = input.excludeTitles || new Set<string>();

  async function searchSlot(suggestion: CombineSlotSuggestion): Promise<CombineSlotResult> {
    const profile = buildSlotProductProfile(input, suggestion);
    if (!profile.user_profile.price_mode) {
      profile.user_profile.price_mode = "karma" as PriceMode;
    }

    const isWatchSlot =
      suggestion.accessoryType === "saat" ||
      /saat|watch/i.test(suggestion.searchQuery) ||
      /saat|watch/i.test(profile.category_tr);
    const eyewearKind = asLower(
      `${suggestion.accessoryType || ""} ${suggestion.searchQuery} ${profile.category_tr} ${profile.subcategory_tr}`
    );
    const isEyewearSlot = /gözlük|glasses|sunglasses|eyewear/.test(eyewearKind);
    const wantsSunglasses = /güneş|sunglass/.test(eyewearKind);

    const piece = await processPiece(
      profile,
      occasionKeyword,
      input.serpKey,
      input.affiliateTag,
      exclude,
      {
        immersiveMode: "recommended",
        searchMode: "compact",
        mustFind: true,
        denyTitle: isWatchSlot
          ? (title) => titleLooksLikeGarment(title) || WATCH_DENY_TITLE_RE.test(title)
          : isEyewearSlot
            ? (title) =>
                titleLooksLikeGarment(title) || titleContradictsEyewearKind(title, wantsSunglasses)
            : suggestion.slot === "accessory"
              ? titleLooksLikeGarment
              : undefined,
      }
    );

    const accessoryLabel = suggestion.accessoryType || profile.subcategory_tr;
    const labelTr =
      suggestion.slot === "accessory" && accessoryLabel
        ? accessoryLabel.charAt(0).toUpperCase() + accessoryLabel.slice(1)
        : COMBINE_SLOT_LABEL_TR[suggestion.slot];

    return {
      slot: suggestion.slot,
      label_tr: labelTr,
      suggestion,
      piece: piece || {
        label: labelTr,
        category_tr: profile.category_tr,
        results: { recommended: null, cheaper: null, style: null },
      },
    } satisfies CombineSlotResult;
  }

  if (input.reuseSuggestion && input.onlySlot) {
    const normalized = sanitizeSlotForGender(
      normalizeAccessorySuggestion(input.reuseSuggestion, input.context, genderWord),
      input.context,
      genderWord
    );
    const suggestion = normalized || input.reuseSuggestion;
    const serpStart = Date.now();
    const result = await searchSlot(suggestion);
    return {
      slots: [result],
      suggestions: [suggestion],
      timing: { llm_ms: 0, serp_ms: Date.now() - serpStart, reused_suggestion: true },
    };
  }

  const heuristic = heuristicSlotSuggestions(slots, input.attributes, input.context, genderWord);

  let llmMs = 0;
  let serpMs = 0;
  const llmPromise = (async () => {
    const t0 = Date.now();
    try {
      return await generateSlotSuggestions(
        input.openaiKey,
        slots,
        input.attributes,
        input.context,
        genderWord
      );
    } finally {
      llmMs = Date.now() - t0;
    }
  })();
  const serpPromise = (async () => {
    const t0 = Date.now();
    try {
      return await Promise.all(heuristic.map((suggestion) => searchSlot(suggestion)));
    } finally {
      serpMs = Date.now() - t0;
    }
  })();

  const [llmSuggestions, serpResults] = await Promise.all([llmPromise, serpPromise]);

  // Prefer LLM labels/accessoryType for display; keep heuristic Serp product cards.
  const llmBySlot = new Map(llmSuggestions.map((s) => [s.slot, s]));
  const results = serpResults.map((row) => {
    const llm = llmBySlot.get(row.slot);
    if (!llm) return row;
    const accessoryLabel = llm.accessoryType || row.suggestion.accessoryType;
    const labelTr =
      row.slot === "accessory" && accessoryLabel
        ? accessoryLabel.charAt(0).toUpperCase() + accessoryLabel.slice(1)
        : COMBINE_SLOT_LABEL_TR[row.slot];
    return {
      ...row,
      label_tr: labelTr,
      suggestion: llm,
    } satisfies CombineSlotResult;
  });

  return {
    slots: results,
    suggestions: llmSuggestions,
    timing: { llm_ms: llmMs, serp_ms: serpMs, reused_suggestion: false },
  };
}
