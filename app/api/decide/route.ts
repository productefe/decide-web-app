import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  parseVision,
  scoreProducts,
  getStyleKeyword,
  pickStyleProduct,
  pickTrustedFallback,
  getSlots,
  mergeLinks,
  buildResults,
  type RequestContext,
  type UserProfile,
  type Reasons,
  type ScoringResult,
} from "./pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const SERPAPI_URL = "https://serpapi.com/search";

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
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

async function serpShoppingSearch(query: string, apiKey: string) {
  const serpParams = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    api_key: apiKey,
    num: "30",
    gl: "tr",
    hl: "tr",
  });
  const serpRes = await fetch(`${SERPAPI_URL}?${serpParams.toString()}`);
  const serpData = await serpRes.json();
  return serpData?.shopping_results || [];
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
    if (!photo_url) {
      return NextResponse.json(
        { error: "Fotoğraf bulunamadı." },
        { status: 400 }
      );
    }

    const { data: userPrefs } = await supabase
      .from("user_preferences")
      .select("preferences, height, weight")
      .eq("id", user.id)
      .single();

    const user_profile: UserProfile = {
      preferences: userPrefs?.preferences || [],
    };
    const styleKeyword = getStyleKeyword(userPrefs?.preferences);
    const ctx: RequestContext = { photo_url, user_id: user.id, user_profile };

    // 1) OpenAI Vision (gpt-4o)
    const visionContent = await openAIContent(OPENAI_API_KEY, {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: photo_url } },
            {
              type: "text",
              text:
                'Analyze this fashion product image. Return ONLY valid JSON, no markdown, no explanation:\n{"category": "exact product type like t-shirt/chinos/running shoe/hoodie/dress/jeans/sneaker", "colors": ["primary color"], "fit": "slim/regular/oversized/loose", "collar": "crew neck/v-neck/polo/turtleneck/none", "pattern": "plain/striped/floral/graphic/logo/checkered/none", "has_logo": false, "style_tags": ["casual"], "gender": "men/women/unisex"}',
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    // 2) Parse Vision
    const productProfile = parseVision(visionContent, ctx);

    // 3) SerpAPI google_shopping (ana arama)
    const mainResults = await serpShoppingSearch(productProfile.search_query, SERPAPI_KEY);

    // 4) Scoring Engine
    const scoring = scoreProducts(mainResults, productProfile);

    // 5) Hata Var mı? -> erken dön
    if (scoring.error) {
      return NextResponse.json({
        user_id: scoring.user_id,
        photo_url: scoring.photo_url,
        recommended: null,
        cheaper: null,
        style: null,
        top3: [],
        error: scoring.error,
      });
    }

    // 6) Stil araması + Sana Özel slot
    const excludeTitles = new Set(
      [scoring.recommended?.title, scoring.cheaper?.title].filter(Boolean) as string[]
    );

    let styleProduct = null;
    if (styleKeyword) {
      const styleQuery = `${productProfile.search_query} ${styleKeyword}`.trim();
      const styleResults = await serpShoppingSearch(styleQuery, SERPAPI_KEY);
      styleProduct = pickStyleProduct(styleResults, productProfile, excludeTitles, styleKeyword);
    }
    if (!styleProduct) {
      styleProduct = pickTrustedFallback(scoring.pool, excludeTitles);
    }

    const finalScoring: ScoringResult = { ...scoring, style: styleProduct };

    // 7) Split slots + SerpAPI Product (immersive)
    const slots = getSlots(finalScoring);
    const immersiveResponses = await Promise.all(
      slots.map(async ({ product }) => {
        if (!product.serpapi_immersive_product_api) return null;
        try {
          const url = `${product.serpapi_immersive_product_api}&api_key=${SERPAPI_KEY}`;
          const res = await fetch(url);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      })
    );

    // 8) Merge Links
    const merged = mergeLinks(finalScoring, slots, immersiveResponses, AFFILIATE_TAG);

    // 9) OpenAI Explanation (gpt-4o-mini)
    const explanationText = `Sen bir moda danışmanısın. Aşağıdaki her ürün için, etiketine neden uygun olduğunu açıklayan TÜRKÇE, samimi, 1 cümlelik açıklama yaz. Ürün adını ve fiyatını cümlede kullan. SADECE geçerli JSON döndür, markdown yok:\n{"recommended_reason": "", "cheaper_reason": "", "style_reason": ""}\n\nRecommended (en iyi eşleşme): ${merged.recommended?.title} — ${merged.recommended?.price} (${merged.recommended?.source})\nCheaper (daha uygun fiyat): ${merged.cheaper?.title} — ${merged.cheaper?.price} (${merged.cheaper?.source})\nSana Özel (tarzına uygun): ${merged.style?.title} — ${merged.style?.price} (${merged.style?.source})`;

    let reasons: Reasons = {};
    try {
      const explanationContent = await openAIContent(OPENAI_API_KEY, {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: explanationText }],
        max_tokens: 300,
      });
      reasons = JSON.parse(explanationContent.replace(/```json|```/g, "").trim());
    } catch {
      reasons = {};
    }

    // 10) Final Output
    const results = buildResults(merged, reasons);

    // 11) Supabase search_history insert (hata cevabı bloklamaz)
    const { error: insertError } = await supabase.from("search_history").insert({
      user_id: user.id,
      photo_url,
      results: JSON.stringify(results),
    });
    if (insertError) {
      console.error("search_history insert error:", insertError.message);
    }

    // 12) Respond
    return NextResponse.json({ user_id: user.id, photo_url, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    console.error("/api/decide error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
