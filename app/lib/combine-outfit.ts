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
import type { PriceMode } from "@/lib/preferences";
import {
  getOccasionKeyword,
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
  { type: "gözlük", re: /gözlük|gozluk|glasses|sunglasses|eyewear/i },
  { type: "şapka", re: /şapka|sapka|hat|bere|beanie|cap\b/i },
  { type: "atkı", re: /atkı|atki|scarf/i },
];

/** Garments / shoes / cufflink noise that must never fill an accessory result. */
const NON_ACCESSORY_TITLE_RE =
  /yelek|vest|ceket|jacket|blazer|kaban|coat|trenç|trench|tişört|t[- ]?shirt|gömlek|hoodie|sweatshirt|kazak|sweater|hırka|cardigan|pantolon|jeans|chino|şort|shorts|etek|skirt|elbise|dress|ayakkabı|sneaker|bot|loafer|sandal|kol\s*düğme|kol\s*dugme|cuff\s*link|cufflink/i;

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
  for (const kind of ACCESSORY_KINDS) {
    if (kind.re.test(text)) return kind.type;
  }
  return null;
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
  context: AnalysisContext
): string {
  const slotList = slots.join(", ");
  const contextTr = CONTEXT_LABEL_TR[context];
  const color = truncateForPrompt(attributes.color_tr || "", 40);
  const fit = truncateForPrompt(attributes.fit || "", 40);
  const gender = truncateForPrompt(attributes.gender || "", 20);
  const tags = (attributes.style_tags || []).slice(0, 6).map((t) => truncateForPrompt(t, 30));
  const pieceLabel = truncateForPrompt(attributes.label || attributes.category_tr, 60);
  const pieceCat = truncateForPrompt(attributes.category || attributes.category_tr, 60);
  const accessoryKinds = ACCESSORY_KINDS.map((k) => k.type).join("|");

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

CONTEXT (occasion): ${context} (${contextTr})

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
- searchQuery must be Turkish shopping keywords, 4–10 words, and MUST encode layered product attributes when relevant:
  - tops: yaka (bisiklet/v yaka/polo), kesim (slim/oversize/regular), tip (tişört/atlet/askılı/baskılı)
  - bottoms: tür (chino/kot/jogger/eşofman/şort), paça (skinny/regular/wide)
  - shoes: tip (sneaker/bot/loafer) + renk
  - accessory: concrete type only (kemer/çanta/saat/gözlük/şapka…)
- Keep suggestions consistent with the context (${contextTr}) and the source piece color.
- Prefer safe, widely-wearable combinations over adventurous color theory.
- styleDescriptor: short Turkish phrase describing THE SAME item as searchQuery (include the same cut/collar/type words).
- For non-accessory slots: never suggest jewelry, bags, belts, watches, hats — only that garment/shoe type.
- For accessory slot (if present):
  - Pick ONE type from: ${accessoryKinds}
  - accessoryType, styleDescriptor, and searchQuery MUST all refer to that SAME type.
  - Never suggest clothing (yelek, ceket, tişört, pantolon, elbise, ayakkabı) as accessory.
  - For saat: only wristwatches / kol saati / akıllı saat — NEVER kol düğmesi, cufflink, or "saat desenli" buttons.
  - Match metal/color to the source piece when suggesting jewelry; otherwise prefer bag/belt/watch/glasses for casual sport looks.${accessoryField}`;
}

function normalizeAccessorySuggestion(raw: CombineSlotSuggestion): CombineSlotSuggestion | null {
  if (raw.slot !== "accessory") return raw;

  const blob = `${raw.accessoryType || ""} ${raw.styleDescriptor} ${raw.searchQuery}`;
  if (NON_ACCESSORY_TITLE_RE.test(blob) && !detectAccessoryType(blob)) {
    return null;
  }

  const type =
    (typeof raw.accessoryType === "string" && detectAccessoryType(raw.accessoryType)) ||
    detectAccessoryType(raw.searchQuery) ||
    detectAccessoryType(raw.styleDescriptor);

  if (!type) return null;

  // Force descriptor + query to stay on the same accessory type
  let styleDescriptor = raw.styleDescriptor;
  let searchQuery = raw.searchQuery;
  if (!detectAccessoryType(styleDescriptor)) {
    styleDescriptor = `${raw.color || ""} ${type}`.trim();
  }
  if (!detectAccessoryType(searchQuery)) {
    searchQuery = `${raw.color || ""} ${type}`.trim();
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
  expectedSlots: readonly CombineOutfitSlot[]
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

    const suggestion = normalizeAccessorySuggestion({
      slot,
      color: truncateForPrompt(color, 40),
      styleDescriptor: truncateForPrompt(styleDescriptor, 80),
      searchQuery: truncateForPrompt(searchQuery, 120),
      accessoryType,
    });
    if (!suggestion) return null;
    out.push(suggestion);
  }
  return out;
}

async function generateSlotSuggestions(
  openaiKey: string,
  slots: readonly CombineOutfitSlot[],
  attributes: CombinePieceAttributes,
  context: AnalysisContext
): Promise<CombineSlotSuggestion[]> {
  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: buildCombinePrompt(slots, attributes, context),
      },
    ],
    max_tokens: 450,
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const first = await openAIContent(openaiKey, body);
  const parsed = parseCombineSuggestions(first, slots);
  if (parsed) return parsed;

  // Reject once and retry
  const second = await openAIContent(openaiKey, body);
  const retried = parseCombineSuggestions(second, slots);
  if (retried) return retried;

  throw new Error("Kombin önerisi oluşturulamadı. Lütfen tekrar dene.");
}

function genderTr(gender: string | null | undefined): string {
  const g = (gender || "").toLowerCase();
  if (g === "men" || g === "erkek" || g === "male") return "erkek";
  if (g === "women" || g === "kadın" || g === "kadin" || g === "female") return "kadın";
  return "";
}

function buildSlotProductProfile(
  input: CombineOutfitInput,
  suggestion: CombineSlotSuggestion
): ProductProfile {
  const isAccessory = suggestion.slot === "accessory";
  const categoryTr = isAccessory
    ? suggestion.accessoryType ||
      detectAccessoryType(suggestion.searchQuery) ||
      COMBINE_SLOT_CATEGORY_TR.accessory
    : COMBINE_SLOT_CATEGORY_TR[suggestion.slot];
  const genderFromUser = input.userProfile.gender || null;
  const genderFromPiece = input.attributes.gender || "";
  const gTr = genderTr(genderFromUser || genderFromPiece);
  const color = suggestion.color || input.attributes.color_tr || "";
  // Keep fit_tr short — full styleDescriptor polluted accessory searches (kolye → yelek).
  const fitTr = isAccessory ? "" : truncateForPrompt(suggestion.styleDescriptor, 40);

  const search_query = suggestion.searchQuery;
  const fallback_query = [gTr, color, categoryTr].filter(Boolean).join(" ").trim();

  return {
    photo_url: input.photoUrl,
    user_id: input.userId,
    user_profile: input.userProfile,
    category: isAccessory ? suggestion.accessoryType || "accessory" : suggestion.slot,
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
    subcategory: "",
    subcategory_tr: "",
    secondary_colors: [],
    length: "",
    length_tr: "",
    neckline: "",
    sleeve_or_strap: "",
    sleeve_or_strap_tr: "",
    patterns: [],
    material_impression: "",
    material_tr: "",
    distinctive_details: [],
    core_query: fallback_query,
    low_confidence: !categoryTr,
  };
}

/**
 * One structured LLM call (unless reuseSuggestion), then existing processPiece
 * search pipeline per outfit slot from COMBINE_RULES.
 */
export async function combineOutfit(input: CombineOutfitInput): Promise<CombineOutfitResult> {
  const allSlots = resolveCombineSlots(input.pieceCategory);
  const slots =
    input.onlySlot && allSlots.includes(input.onlySlot) ? [input.onlySlot] : allSlots;

  let suggestions: CombineSlotSuggestion[];
  if (input.reuseSuggestion && input.onlySlot) {
    const normalized = normalizeAccessorySuggestion(input.reuseSuggestion);
    suggestions = [normalized || input.reuseSuggestion];
  } else {
    suggestions = await generateSlotSuggestions(
      input.openaiKey,
      slots,
      input.attributes,
      input.context
    );
  }

  const occasion = CONTEXT_TO_OCCASION[input.context];
  const occasionKeyword = getOccasionKeyword(occasion);
  const exclude = input.excludeTitles || new Set<string>();

  const results = await Promise.all(
    suggestions.map(async (suggestion) => {
      const profile = buildSlotProductProfile(input, suggestion);
      if (!profile.user_profile.price_mode) {
        profile.user_profile.price_mode = "karma" as PriceMode;
      }

      const isWatchSlot =
        suggestion.accessoryType === "saat" ||
        /saat|watch/i.test(suggestion.searchQuery) ||
        /saat|watch/i.test(profile.category_tr);

      const piece = await processPiece(
        profile,
        occasionKeyword,
        input.serpKey,
        input.affiliateTag,
        exclude,
        {
          immersiveMode: "recommended",
          denyTitlePattern: isWatchSlot
            ? new RegExp(
                `(?:${NON_ACCESSORY_TITLE_RE.source})|(?:${WATCH_DENY_TITLE_RE.source})`,
                "i"
              )
            : suggestion.slot === "accessory"
              ? NON_ACCESSORY_TITLE_RE
              : undefined,
        }
      );

      const labelTr =
        suggestion.slot === "accessory" && suggestion.accessoryType
          ? suggestion.accessoryType.charAt(0).toUpperCase() + suggestion.accessoryType.slice(1)
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
    })
  );

  return { slots: results, suggestions };
}
