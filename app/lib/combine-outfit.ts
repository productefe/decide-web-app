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
};

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
{"slots":{${slots.map((s) => `"${s}":{"color":"...","styleDescriptor":"...","searchQuery":"..."}`).join(",")}}}

Rules:
- Only fill the given slots — never add other slots.
- Never invent product names, brands, or store names.
- searchQuery must be Turkish shopping keywords (gender + color + style + garment type), 3–8 words.
- Keep suggestions consistent with the context (${contextTr}) and the source piece color.
- Prefer safe, widely-wearable combinations over adventurous color theory.
- styleDescriptor: short Turkish phrase (e.g. "dar kesim lacivert chino").
- If "accessory" is among the slots: pick ONE concrete accessory type that fits the look and context (e.g. kemer, çanta, saat, gözlük, şapka, atkı) — put that type in searchQuery; do not use the vague word "aksesuar" alone.`;
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
    if (!searchQuery || searchQuery.length < 3) return null;
    out.push({
      slot,
      color: truncateForPrompt(color, 40),
      styleDescriptor: truncateForPrompt(styleDescriptor, 80),
      searchQuery: truncateForPrompt(searchQuery, 120),
    });
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
    max_tokens: 600,
    temperature: 0.4,
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
  const categoryTr = COMBINE_SLOT_CATEGORY_TR[suggestion.slot];
  const genderFromUser = input.userProfile.gender || null;
  const genderFromPiece = input.attributes.gender || "";
  const gTr = genderTr(genderFromUser || genderFromPiece);
  const color = suggestion.color || input.attributes.color_tr || "";
  const fitTr = suggestion.styleDescriptor || "";

  const search_query = suggestion.searchQuery;
  const fallback_query = [gTr, color, categoryTr].filter(Boolean).join(" ").trim();

  return {
    photo_url: input.photoUrl,
    user_id: input.userId,
    user_profile: input.userProfile,
    category: suggestion.slot,
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
    suggestions = [input.reuseSuggestion];
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
      // Ensure price_mode is typed for processPiece scoring
      if (!profile.user_profile.price_mode) {
        profile.user_profile.price_mode = "karma" as PriceMode;
      }
      const piece = await processPiece(
        profile,
        occasionKeyword,
        input.serpKey,
        input.affiliateTag,
        exclude
      );
      const labelTr = COMBINE_SLOT_LABEL_TR[suggestion.slot];
      return {
        slot: suggestion.slot,
        label_tr: labelTr,
        suggestion,
        piece: piece || {
          label: labelTr,
          category_tr: COMBINE_SLOT_CATEGORY_TR[suggestion.slot],
          results: { recommended: null, cheaper: null, style: null },
        },
      } satisfies CombineSlotResult;
    })
  );

  return { slots: results, suggestions };
}
