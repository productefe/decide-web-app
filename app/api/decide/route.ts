import { NextRequest, NextResponse } from "next/server";
import { parseOccasion, parsePriceMode, parseSizes, type Occasion, type PriceMode } from "@/lib/preferences";
import { isAnonymousUser } from "@/lib/auth-user";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import {
  parseVisionOutfit,
  getOccasionKeyword,
  applyUserGender,
  type RequestContext,
  type UserProfile,
} from "./pipeline";
import { processPiece } from "./run-piece";
import { getVisionImageDataUrl } from "./vision-image";
import type { PieceResult, Results, StoredResults } from "@/components/analyze/types";
import {
  ApiSecurityError,
  assertOwnStoragePath,
  enforceGuestAnalysisCap,
  enforceRateLimit,
} from "@/lib/api-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const VISION_OUTFIT_PROMPT =
  'Analyze this fashion image. Identify the main fashion product(s) — clothing AND accessories. If the photo focuses on a single product (e.g. glasses, sunglasses, bag, watch, belt, hat, shoes), return THAT item — do NOT invent a t-shirt or other garment. Max 4 items. Be precise about TYPE and FIT — e.g. crop top vs oversized t-shirt vs slim tee; skinny jeans vs wide-leg; glasses vs sunglasses. Return ONLY valid JSON, no markdown:\n{"items":[{"label":"Gözlük","category":"exact type like glasses/sunglasses/crop top/t-shirt/jeans/sneaker/hoodie/jacket/bag/watch/hat","colors":["primary color"],"fit":"slim/regular/oversized/loose/cropped/none","collar":"crew neck/v-neck/polo/turtleneck/none","pattern":"plain/striped/floral/graphic/logo/checkered/none","has_logo":false,"style_tags":["casual"],"gender":"men/women/unisex"}]}\nThe "label" value must be ONLY the item name in Turkish (e.g. Gözlük, Crop Top, Tişört, Pantolon, Ayakkabı, Ceket, Çanta) — no English words, no explanations.\nIf only one item is visible, return one item in the array.';

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

function toUserFacingError(message: string): string {
  if (/JSON|Unexpected token|SyntaxError|parse/i.test(message)) {
    return "Fotoğrafı okuyamadık. Net, iyi aydınlatılmış bir kıyafet fotoğrafı dene.";
  }
  return message;
}

function collectTitles(results: Results): string[] {
  return [results.recommended?.title, results.cheaper?.title, results.style?.title].filter(
    (t): t is string => Boolean(t)
  );
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

    const supabase = await createClient(req);
    const bearerToken = getBearerToken(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      if (authError) console.error("/api/decide auth error:", authError.message);
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const photo_url: string | undefined = body?.photo_url;
    const storage_path: string | undefined = body?.storage_path;
    const occasion: Occasion | null = parseOccasion(body?.occasion);
    if (!photo_url) {
      return NextResponse.json(
        { error: "Fotoğraf bulunamadı." },
        { status: 400 }
      );
    }
    if (!occasion) {
      return NextResponse.json(
        { error: "Giyim amacı seçmelisin." },
        { status: 400 }
      );
    }

    try {
      assertOwnStoragePath(user.id, storage_path);
    } catch (err) {
      if (err instanceof ApiSecurityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const anonymous = isAnonymousUser(user);
    try {
      await enforceGuestAnalysisCap(supabase, anonymous);
      await enforceRateLimit(supabase, "decide", anonymous ? 2 : 10);
    } catch (err) {
      if (err instanceof ApiSecurityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const { data: userPrefs } = await supabase
      .from("user_preferences")
      .select("preferences, gender, sizes, price_mode")
      .eq("id", user.id)
      .single();

    const sizes = parseSizes(userPrefs?.sizes);
    const price_mode: PriceMode = parsePriceMode(userPrefs?.price_mode) || "karma";

    const user_profile: UserProfile = {
      preferences: userPrefs?.preferences || [],
      sizes,
      price_mode,
      occasion,
    };
    const occasionKeyword = getOccasionKeyword(occasion);
    const ctx: RequestContext = { photo_url, user_id: user.id, user_profile };

    const visionImageUrl = await getVisionImageDataUrl(supabase, storage_path!);

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
          processPiece(profile, occasionKeyword, SERPAPI_KEY, AFFILIATE_TAG).then((piece) =>
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

    if (!isAnonymousUser(user)) {
      const { error: insertError } = await supabase.from("search_history").insert({
        user_id: user.id,
        photo_url,
        results: stored,
      });
      if (insertError) console.error("search_history insert:", insertError.message);
    }

    return NextResponse.json({
      user_id: user.id,
      photo_url,
      pieces: pieceResults,
      results: firstResults,
      exclude_titles: pieceResults.flatMap((p) => collectTitles(p.results)),
      occasion,
      price_mode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    console.error("/api/decide:", message);
    return NextResponse.json({ error: toUserFacingError(message) }, { status: 500 });
  }
}
