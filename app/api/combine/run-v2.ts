import type { PriceMode, UserGender } from "@/lib/preferences";
import type { AnalysisContext, CombineOutfitSlot } from "@/lib/combine-rules";
import { COMBINE_OUTFIT_SLOTS } from "@/lib/combine-rules";
import type { PieceResult, Results, Product } from "@/components/analyze/types";
import {
  makeCombineIntent,
  searchCombineSlot,
  suggestCombinePrefs,
  type CombineIntent,
} from "@/lib/search-v2/combine";
import type { VerifiedCandidate } from "@/lib/search-v2/schema";

function toProduct(c: VerifiedCandidate, label: string, reason: string): Product {
  return {
    title: c.title,
    price: c.price,
    source: c.source,
    image: c.image,
    link: c.link,
    store: c.store,
    reason,
    label,
    priceValue: c.priceValue ?? undefined,
    product_id: c.product_id,
    serpapi_immersive_product_api: c.serpapi_immersive_product_api,
  };
}

function toResults(products: VerifiedCandidate[]): Results {
  return {
    recommended: products[0]
      ? toProduct(products[0], "Recommended", "Kombin için önerilen")
      : null,
    cheaper: products[1] ? toProduct(products[1], "Cheaper", "Daha uygun alternatif") : null,
    style: products[2] ? toProduct(products[2], "Style", "Stil uyumlu") : null,
  };
}

export async function runCombineV2(opts: {
  openAiKey: string;
  serpApiKey: string;
  context: AnalysisContext;
  gender: UserGender | null;
  priceMode: PriceMode;
  sizes: string[];
  pieceSummary: string;
  colorHint?: string;
  onlySlot?: CombineOutfitSlot | null;
  sessionIds?: Partial<Record<CombineOutfitSlot, string>>;
  page?: number;
}): Promise<{
  slots: {
    slot: CombineOutfitSlot;
    suggestion: {
      slot: CombineOutfitSlot;
      color: string;
      styleDescriptor: string;
      searchQuery: string;
    };
    piece: PieceResult;
    exhausted: boolean;
    session_id: string;
  }[];
  intents: CombineIntent[];
}> {
  const prefs = await suggestCombinePrefs({
    apiKey: opts.openAiKey,
    context: opts.context,
    pieceSummary: opts.pieceSummary,
  });
  const color = opts.colorHint || prefs.color_pref;
  const style = prefs.style_pref;

  const slotsToRun: CombineOutfitSlot[] = opts.onlySlot
    ? [opts.onlySlot]
    : // Load core slots first; accessory can follow
      (["top", "bottom", "shoes", "outerwear", "accessory"] as CombineOutfitSlot[]).filter((s) =>
        (COMBINE_OUTFIT_SLOTS as readonly string[]).includes(s)
      );

  const page = opts.page || 0;
  const settled = await Promise.all(
    slotsToRun.map(async (slot) => {
      const intent = makeCombineIntent({
        slot,
        context: opts.context,
        gender: opts.gender,
        priceMode: opts.priceMode,
        sizes: opts.sizes,
        colorPref: color,
        stylePref: style,
      });
      try {
        const found = await searchCombineSlot({
          intent,
          serpApiKey: opts.serpApiKey,
          openAiKey: opts.openAiKey,
          sessionId: opts.sessionIds?.[slot] || null,
          page,
        });
        const results = toResults(found.products);
        const piece: PieceResult = {
          label: intent.category_tr,
          category_tr: intent.category_tr,
          category: intent.family,
          color_tr: color,
          results,
        };
        return {
          slot,
          suggestion: {
            slot,
            color,
            styleDescriptor: style,
            // Deterministic — same intent drives UI label and search
            searchQuery: found.queries[0] || "",
          },
          piece,
          exhausted: found.exhausted,
          session_id: found.session_id,
          intent,
        };
      } catch (err) {
        console.warn("[combine-v2] slot fail", slot, err);
        return {
          slot,
          suggestion: {
            slot,
            color,
            styleDescriptor: style,
            searchQuery: "",
          },
          piece: {
            label: intent.category_tr,
            category_tr: intent.category_tr,
            results: { recommended: null, cheaper: null, style: null },
          },
          exhausted: true,
          session_id: opts.sessionIds?.[slot] || "",
          intent,
        };
      }
    })
  );

  return {
    slots: settled.map(({ intent: _i, ...rest }) => rest),
    intents: settled.map((s) => s.intent),
  };
}
