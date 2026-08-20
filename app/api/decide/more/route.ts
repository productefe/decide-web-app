import { NextRequest, NextResponse } from "next/server";
import { parseGender, parseOccasion, parsePriceMode, parseSizes, type Occasion, type PriceMode } from "@/lib/preferences";
import { isAnonymousUser } from "@/lib/auth-user";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import { visionPromptForOccasion } from "../vision-prompt";
import {
  parseVisionOutfit,
  getOccasionKeyword,
  applyUserGender,
  pieceAttrsFromProfile,
  type RequestContext,
  type UserProfile,
} from "../pipeline";
import { processPiece } from "../run-piece";
import { getVisionImageDataUrl } from "../vision-image";
import { getCachedVision, setCachedVision, visionCacheKey } from "../vision-cache";
import type { PieceResult, Results } from "@/components/analyze/types";
import {
  ApiSecurityError,
  assertOwnStoragePath,
  enforceRateLimit,
} from "@/lib/api-security";
import { OCCASION_TO_CONTEXT } from "@/lib/combine-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

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

function collectTitles(results: Results): string[] {
  return [results.recommended?.title, results.cheaper?.title, results.style?.title].filter(
    (t): t is string => Boolean(t)
  );
}

/**
 * Re-run search for one piece (or first piece), excluding previously shown titles.
 */
export async function POST(req: NextRequest) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    const AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || "decide07-21";

    if (!OPENAI_API_KEY || !SERPAPI_KEY) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const supabase = await createClient(req);
    const bearerToken = getBearerToken(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const photo_url: string | undefined = body?.photo_url;
    const storage_path: string | undefined = body?.storage_path;
    const occasion: Occasion | null =
      parseOccasion(body?.occasion) || parseOccasion(body?.context);
    const pieceLabel: string | undefined = body?.piece_label;
    const excludeRaw = Array.isArray(body?.exclude_titles) ? body.exclude_titles : [];
    const excludeTitles = new Set<string>(
      excludeRaw.filter((t: unknown): t is string => typeof t === "string" && t.length > 0).slice(0, 40)
    );

    if (!photo_url || !storage_path) {
      return NextResponse.json({ error: "Fotoğraf bulunamadı." }, { status: 400 });
    }
    if (!occasion) {
      return NextResponse.json({ error: "Giyim amacı seçmelisin." }, { status: 400 });
    }

    try {
      assertOwnStoragePath(user.id, storage_path);
      await enforceRateLimit(supabase, "decide_more", isAnonymousUser(user) ? 10 : 100);
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

    const sizesFromBody = parseSizes(body?.sizes);
    const genderFromBody = parseGender(body?.gender);
    const priceFromBody = parsePriceMode(body?.price_mode);

    const sizes = sizesFromBody.length ? sizesFromBody : parseSizes(userPrefs?.sizes);
    const price_mode: PriceMode =
      priceFromBody || parsePriceMode(userPrefs?.price_mode) || "karma";
    const userGender = genderFromBody || parseGender(userPrefs?.gender);

    const user_profile: UserProfile = {
      preferences: userPrefs?.preferences || [],
      sizes,
      price_mode,
      occasion,
      gender: userGender,
    };
    const occasionKeyword = getOccasionKeyword(occasion);
    const ctx: RequestContext = { photo_url, user_id: user.id, user_profile };

    // Reuse the vision analysis from the original /api/decide run when
    // possible — the photo has not changed, so re-running GPT-4o only adds
    // 4-8 seconds to every "3 alternatif daha" click.
    const cacheKey = visionCacheKey(user.id, storage_path, occasion);
    let visionContent = getCachedVision(cacheKey);

    if (!visionContent) {
      const { data: historyRow } = await supabase
        .from("search_history")
        .select("results")
        .eq("user_id", user.id)
        .eq("photo_url", photo_url)
        .eq("context", OCCASION_TO_CONTEXT[occasion])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const storedContent = (historyRow?.results as { vision_content?: unknown } | null)
        ?.vision_content;
      if (typeof storedContent === "string" && storedContent.trim()) {
        visionContent = storedContent;
      }
    }

    if (!visionContent) {
      const visionImageUrl = await getVisionImageDataUrl(supabase, storage_path);
      visionContent = await openAIContent(OPENAI_API_KEY, {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: visionImageUrl } },
              { type: "text", text: visionPromptForOccasion(occasion) },
            ],
          },
        ],
        max_tokens: 2000,
      });
    }
    setCachedVision(cacheKey, visionContent);

    const visionPieces = parseVisionOutfit(visionContent, ctx);
    let target = visionPieces[0];
    if (pieceLabel) {
      const match = visionPieces.find(
        (p) => p.label === pieceLabel || p.profile.category_tr === pieceLabel
      );
      if (match) target = match;
    }

    const profile = applyUserGender(target.profile, userGender);
    if (profile.low_confidence) {
      return NextResponse.json(
        { error: "Bu parçayı yeterince net okuyamadık. Daha net bir fotoğraf dene." },
        { status: 404 }
      );
    }

    const piece = await processPiece(
      profile,
      occasionKeyword,
      SERPAPI_KEY,
      AFFILIATE_TAG,
      excludeTitles,
      { mustFind: true, immersiveMode: "recommended" }
    );

    if (!piece) {
      return NextResponse.json(
        { error: "Yeni alternatif bulunamadı. Farklı bir fotoğraf dene." },
        { status: 404 }
      );
    }

    const labeled: PieceResult = {
      ...piece,
      label: pieceLabel || target.label || piece.label,
      ...pieceAttrsFromProfile(profile),
    };

    return NextResponse.json({
      piece: labeled,
      exclude_titles: [...excludeTitles, ...collectTitles(labeled.results)],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    console.error("/api/decide/more:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
