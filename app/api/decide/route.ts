import { NextRequest, NextResponse } from "next/server";
import { parseSizes } from "@/lib/preferences";
import { createClient } from "@/utils/supabase/server";
import {
  parseVisionOutfit,
  scoreProducts,
  buildSearchQueries,
  getStyleKeyword,
  applyUserGender,
  pickStyleProduct,
  pickTrustedFallback,
  getSlots,
  mergeLinks,
  buildResults,
  type RequestContext,
  type UserProfile,
  type ProductProfile,
  type ScoringResult,
} from "./pipeline";
import { getVisionImageDataUrl } from "./vision-image";
import type { PieceResult, StoredResults } from "@/components/analyze/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const SERPAPI_URL = "https://serpapi.com/search";

const VISION_OUTFIT_PROMPT =
  'Analyze this fashion image. Identify distinct clothing items the person is wearing (max 4: top, bottom, shoes, outerwear). Skip small accessories unless prominent. Return ONLY valid JSON, no markdown:\n{"items":[{"label":"Turkish label like Tişört/Pantolon/Ayakkabı/Ceket","category":"exact type like t-shirt/jeans/sneaker/hoodie/jacket","colors":["primary color"],"fit":"slim/regular/oversized/loose","collar":"crew neck/v-neck/polo/turtleneck/none","pattern":"plain/striped/floral/graphic/logo/checkered/none","has_logo":false,"style_tags":["casual"],"gender":"men/women/unisex"}]}\nIf only one item is visible, return one item in the array.';

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

interface SerpShoppingItem {
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  thumbnail?: string;
  product_id?: string;
  serpapi_immersive_product_api?: string;
  product_link?: string;
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

async function serpShoppingSearch(
  query: string,
  apiKey: string
): Promise<SerpShoppingItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const serpParams = new URLSearchParams({
    engine: "google_shopping",
    q: trimmed,
    api_key: apiKey,
    num: "30",
    gl: "tr",
    hl: "tr",
  });
  const serpRes = await fetch(`${SERPAPI_URL}?${serpParams.toString()}`);
  const serpData = await serpRes.json();

  if (serpData?.error) {
    console.warn("SerpAPI:", trimmed, "→", serpData.error);
    return [];
  }

  return serpData?.shopping_results || [];
}

async function searchWithFallback(
  productProfile: ProductProfile,
  apiKey: string
): Promise<{ scoring: ScoringResult; queryUsed: string }> {
  const queries = buildSearchQueries(productProfile);
  let lastResults: SerpShoppingItem[] = [];

  for (const query of queries) {
    const results = await serpShoppingSearch(query, apiKey);
    if (results.length === 0) continue;

    lastResults = results;
    const scoring = scoreProducts(results, productProfile);
    if (!scoring.error) {
      console.log("SerpAPI matched:", query, `(${results.length} results)`);
      return { scoring, queryUsed: query };
    }
  }

  return { scoring: scoreProducts(lastResults, productProfile), queryUsed: queries[0] || "" };
}

async function processPiece(
  productProfile: ProductProfile,
  styleKeyword: string,
  serpKey: string,
  affiliateTag: string
): Promise<PieceResult | null> {
  const { scoring, queryUsed } = await searchWithFallback(productProfile, serpKey);
  if (scoring.error) return null;

  const excludeTitles = new Set(
    [scoring.recommended?.title, scoring.cheaper?.title].filter(Boolean) as string[]
  );

  let styleProduct = null;
  if (styleKeyword) {
    const styleQuery = `${queryUsed} ${styleKeyword}`.trim();
    const styleResults = await serpShoppingSearch(styleQuery, serpKey);
    styleProduct = pickStyleProduct(styleResults, productProfile, excludeTitles, styleKeyword);
  }
  if (!styleProduct) {
    styleProduct = pickTrustedFallback(scoring.pool, excludeTitles);
  }

  const finalScoring: ScoringResult = { ...scoring, style: styleProduct };
  const slots = getSlots(finalScoring);
  const immersiveResponses = await Promise.all(
    slots.map(async ({ product }) => {
      if (!product.serpapi_immersive_product_api) return null;
      try {
        const url = `${product.serpapi_immersive_product_api}&api_key=${serpKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    })
  );

  const merged = mergeLinks(finalScoring, slots, immersiveResponses, affiliateTag);
  const results = buildResults(merged, {});

  return {
    label: productProfile.category_tr || productProfile.category || "Parça",
    category_tr: productProfile.category_tr,
    results,
  };
}

function toUserFacingError(message: string): string {
  if (/JSON|Unexpected token|SyntaxError|parse/i.test(message)) {
    return "Fotoğrafı okuyamadık. Net, iyi aydınlatılmış bir kıyafet fotoğrafı dene.";
  }
  return message;
}

export async function POST(req: NextRequest) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    const AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || "decide07-21";

    if (!OPENAI_API_KEY || !SERPAPI_KEY) {
      return NextResponse.json(
        { error: "Sunucu yapılandırması eksik." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const photo_url: string | undefined = body?.photo_url;
    const storage_path: string | undefined = body?.storage_path;
    if (!photo_url) {
      return NextResponse.json(
        { error: "Fotoğraf bulunamadı." },
        { status: 400 }
      );
    }

    const { data: userPrefs } = await supabase
      .from("user_preferences")
      .select("preferences, gender, sizes")
      .eq("id", user.id)
      .single();

    const sizes = parseSizes(userPrefs?.sizes);

    const user_profile: UserProfile = {
      preferences: userPrefs?.preferences || [],
      sizes,
    };
    const styleKeyword = getStyleKeyword(userPrefs?.preferences);
    const ctx: RequestContext = { photo_url, user_id: user.id, user_profile };

    const visionImageUrl = await getVisionImageDataUrl(photo_url, supabase, storage_path);

    const visionContent = await openAIContent(OPENAI_API_KEY, {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: visionImageUrl } },
            { type: "text", text: VISION_OUTFIT_PROMPT },
          ],
        },
      ],
      max_tokens: 800,
    });

    const visionPieces = parseVisionOutfit(visionContent, ctx);
    const profiles = visionPieces.map(({ label, profile }) => {
      let p = profile;
      if (userPrefs?.gender) {
        p = applyUserGender(p, userPrefs.gender);
      }
      return { label, profile: p };
    });

    const pieceResults = (
      await Promise.all(
        profiles.map(({ label, profile }) =>
          processPiece(profile, styleKeyword, SERPAPI_KEY, AFFILIATE_TAG).then((piece) =>
            piece ? { ...piece, label } : null
          )
        )
      )
    ).filter((p): p is PieceResult => p !== null);

    if (pieceResults.length === 0) {
      return NextResponse.json({
        user_id: user.id,
        photo_url,
        pieces: [],
        results: null,
        error: "Bu fotoğraf için sonuç bulunamadı.",
      });
    }

    const stored: StoredResults = { pieces: pieceResults };
    const firstResults = pieceResults[0].results;

    const { error: insertError } = await supabase.from("search_history").insert({
      user_id: user.id,
      photo_url,
      results: stored,
    });
    if (insertError) {
      console.error("search_history insert error:", insertError.message);
    }

    return NextResponse.json({
      user_id: user.id,
      photo_url,
      pieces: pieceResults,
      results: firstResults,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "Bir hata oluştu";
    const message = toUserFacingError(raw);
    console.error("/api/decide error:", raw);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
