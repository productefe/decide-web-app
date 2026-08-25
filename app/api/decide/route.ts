import { NextRequest, NextResponse } from "next/server";
import { parseGender, parseOccasion, parsePriceMode, parseSizes, type Occasion, type PriceMode } from "@/lib/preferences";
import { isAnonymousUser } from "@/lib/auth-user";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import { visionPromptForOccasion } from "./vision-prompt";
import {
  parseVisionOutfit,
  getOccasionKeyword,
  applyUserGender,
  pieceAttrsFromProfile,
  type RequestContext,
  type UserProfile,
} from "./pipeline";
import { processPiece } from "./run-piece";
import { getVisionImageDataUrl } from "./vision-image";
import { setCachedVision, visionCacheKey } from "./vision-cache";
import type { PieceResult, Results, StoredResults } from "@/components/analyze/types";
import {
  ApiSecurityError,
  assertOwnStoragePath,
  enforceGuestAnalysisCap,
  enforceRateLimit,
} from "@/lib/api-security";
import { OCCASION_TO_CONTEXT } from "@/lib/combine-rules";
import { resolveDecideOccasion } from "@/lib/occasion-guide";
import { RequestTimer } from "@/lib/timing";

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
  const timer = new RequestTimer();
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
    const requestedOccasion: Occasion | null =
      parseOccasion(body?.occasion) || parseOccasion(body?.context);
    if (!photo_url) {
      return NextResponse.json(
        { error: "Fotoğraf bulunamadı." },
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
    await timer.span("auth_gates", async () => {
      await enforceGuestAnalysisCap(supabase, anonymous);
      await enforceRateLimit(supabase, "decide", anonymous ? 10 : 100);
    });

    // Preferences read and storage image download are independent — overlap them.
    const [{ data: userPrefs }, visionImageUrl] = await timer.span("prefs_image", () =>
      Promise.all([
        supabase
          .from("user_preferences")
          .select("preferences, gender, sizes, price_mode")
          .eq("id", user.id)
          .single(),
        getVisionImageDataUrl(supabase, storage_path!),
      ])
    );

    // Body prefs win when present — avoids stale DB reads right after profile save.
    const bodySizes = parseSizes(body?.sizes);
    const bodyGender = parseGender(body?.gender);
    const bodyPriceMode = parsePriceMode(body?.price_mode);

    const sizes = bodySizes.length ? bodySizes : parseSizes(userPrefs?.sizes);
    const price_mode: PriceMode =
      bodyPriceMode || parsePriceMode(userPrefs?.price_mode) || "karma";
    const userGender = bodyGender || parseGender(userPrefs?.gender);

    const user_profile: UserProfile = {
      preferences: userPrefs?.preferences || [],
      sizes,
      price_mode,
      occasion: requestedOccasion,
      gender: userGender,
    };
    const ctx: RequestContext = { photo_url, user_id: user.id, user_profile };

    const visionContent = await timer.span("vision", () =>
      openAIContent(OPENAI_API_KEY, {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: visionImageUrl } },
              { type: "text", text: visionPromptForOccasion(requestedOccasion) },
            ],
          },
        ],
        max_tokens: 2000,
      })
    );

    const occasion = resolveDecideOccasion(requestedOccasion, visionContent);
    user_profile.occasion = occasion;
    const occasionKeyword = getOccasionKeyword(occasion);

    const visionPieces = parseVisionOutfit(visionContent, ctx);
    const profiles = visionPieces.map(({ label, profile }) => {
      const p = applyUserGender(profile, userGender);
      return { label, profile: p };
    });

    const rawPieces = await timer.span("search", () =>
      Promise.all(
        profiles.map(({ label, profile }) => {
          if (profile.low_confidence) return Promise.resolve(null);
          return processPiece(profile, occasionKeyword, SERPAPI_KEY, AFFILIATE_TAG, new Set(), {
            mustFind: true,
          }).then((piece) =>
            piece
              ? ({
                  ...piece,
                  label,
                  ...pieceAttrsFromProfile(profile),
                } satisfies PieceResult)
              : null
          );
        })
      )
    );
    const pieceResults: PieceResult[] = [];
    for (const p of rawPieces) {
      if (p) pieceResults.push(p);
    }

    if (pieceResults.length === 0) {
      const snap = timer.snapshot({
        route: "/api/decide",
        pieces: 0,
        occasion,
      });
      timer.log("/api/decide", snap);
      return NextResponse.json({
        user_id: user.id,
        photo_url,
        pieces: [],
        results: null,
        error: "Bu fotoğraf için sonuç bulunamadı.",
        _timing: snap,
      });
    }

    // Persist + memory-cache the raw vision JSON so "3 alternatif daha" can
    // reuse it instead of re-running GPT-4o on the same photo.
    setCachedVision(visionCacheKey(user.id, storage_path!, occasion), visionContent);
    const stored: StoredResults = { pieces: pieceResults, vision_content: visionContent };
    const firstResults = pieceResults[0].results;
    const context = OCCASION_TO_CONTEXT[occasion];
    let history_id: string | null = null;

    if (!isAnonymousUser(user)) {
      await timer.span("history", async () => {
        const { data: inserted, error: insertError } = await supabase
          .from("search_history")
          .insert({
            user_id: user.id,
            photo_url,
            results: stored,
            context,
          })
          .select("id")
          .single();
        if (insertError) console.error("search_history insert:", insertError.message);
        else history_id = inserted?.id ?? null;
      });
    }

    const snap = timer.snapshot({
      route: "/api/decide",
      pieces: pieceResults.length,
      occasion,
      price_mode,
    });
    return timer.json(
      {
        user_id: user.id,
        photo_url,
        pieces: pieceResults,
        results: firstResults,
        exclude_titles: pieceResults.flatMap((p) => collectTitles(p.results)),
        occasion,
        context,
        history_id,
        price_mode,
      },
      snap
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    console.error("/api/decide:", message);
    return NextResponse.json({ error: toUserFacingError(message) }, { status: 500 });
  }
}
