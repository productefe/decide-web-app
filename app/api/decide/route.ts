import { randomUUID } from "crypto";
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
  enforceIpRateLimit,
} from "@/lib/api-security";
import { OCCASION_TO_CONTEXT } from "@/lib/combine-rules";
import { resolveDecideOccasion } from "@/lib/occasion-guide";
import { RequestTimer } from "@/lib/timing";
import { isSearchV2Enabled, isSearchV2Shadow } from "@/lib/search-v2/flag";
import { runSearchV2 } from "./run-v2";

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
  if (
    !message ||
    /Bir hata oluştu|Internal Server|FUNCTION_INVOCATION|timed out|timeout|ECONNRESET/i.test(
      message
    )
  ) {
    return "Analiz tamamlanamadı. Lütfen tekrar dene.";
  }
  return message;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index], index);
      }
    }
  );
  await Promise.all(workers);
  return out;
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
    await timer.span("auth_gates", () =>
      Promise.all([
        enforceGuestAnalysisCap(supabase, anonymous),
        enforceRateLimit(supabase, "decide", anonymous ? 10 : 100),
        enforceIpRateLimit(req, "decide", 20),
      ])
    );

    // Preferences only — OpenAI cannot reliably fetch private/storage public URLs,
    // so we download via Supabase and send a data URL.
    const [{ data: userPrefs }, visionImageUrl] = await timer.span("prefs_image", () =>
      Promise.all([
        supabase
          .from("user_preferences")
          .select("preferences, gender, sizes, price_mode")
          .eq("id", user.id)
          .single()
          .then((res) => res),
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

    const useV2 = isSearchV2Enabled(user.id);
    const shadow = isSearchV2Shadow();

    if (useV2 && !shadow) {
      try {
        const v2 = await timer.span("search_v2", () =>
          runSearchV2({
            openAiKey: OPENAI_API_KEY,
            serpApiKey: SERPAPI_KEY,
            affiliateTag: AFFILIATE_TAG,
            userId: user.id,
            photoUrl: photo_url,
            visionImageUrl,
            sizes,
            priceMode: price_mode,
            gender: userGender,
            requestedOccasion,
            anonymous,
            persistHistory: async (row) => {
              const { error: insertError } = await supabase.from("search_history").insert(row);
              if (insertError) console.error("search_history insert:", insertError.message);
            },
          })
        );

        if (v2.ok) {
          if (storage_path && v2.intent_raw) {
            setCachedVision(visionCacheKey(user.id, storage_path, v2.occasion), v2.intent_raw);
          }

          const snap = timer.snapshot({
            route: "/api/decide",
            pieces: v2.pieces.length,
            occasion: v2.occasion,
            price_mode,
            search_version: "v2",
          });
          return timer.json(
            {
              user_id: v2.user_id,
              photo_url: v2.photo_url,
              pieces: v2.pieces,
              results: v2.results,
              exclude_titles: v2.exclude_titles,
              occasion: v2.occasion,
              context: v2.context,
              history_id: v2.history_id,
              price_mode: v2.price_mode,
              search_version: v2.search_version,
              extractor_version: v2.extractor_version,
              piece_sessions: v2.piece_sessions,
            },
            snap
          );
        }

        console.warn("[search-v2] empty result; falling back to V1", {
          user_id: user.id,
          image_hash: v2.image_hash,
        });
      } catch (v2Error) {
        console.error("[search-v2] failed; falling back to V1", {
          user_id: user.id,
          error: v2Error instanceof Error ? v2Error.message : String(v2Error),
        });
      }
    }

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
        max_tokens: 4000,
        response_format: { type: "json_object" },
      })
    );

    // Shadow mode: fire-and-forget V2 for metrics without affecting response
    if (shadow) {
      void runSearchV2({
        openAiKey: OPENAI_API_KEY,
        serpApiKey: SERPAPI_KEY,
        affiliateTag: AFFILIATE_TAG,
        userId: user.id,
        photoUrl: photo_url,
        visionImageUrl,
        sizes,
        priceMode: price_mode,
        gender: userGender,
        requestedOccasion,
        anonymous: true,
      }).then((r) => {
        if (r.metrics) {
          r.metrics.shadow = true;
          console.log("[search-v2-shadow]", r.ok ? "ok" : "empty", r.pieces?.length || 0);
        }
      }).catch((err) => console.warn("[search-v2-shadow]", err));
    }

    const occasion = resolveDecideOccasion(requestedOccasion, visionContent);
    user_profile.occasion = occasion;
    const occasionKeyword = getOccasionKeyword(occasion);

    const visionPieces = parseVisionOutfit(visionContent, ctx);
    const profiles = visionPieces.map(({ label, profile }) => {
      const p = applyUserGender(profile, userGender);
      return { label, profile: p };
    });
    console.log(
      "/api/decide vision",
      profiles.map((p) => `${p.label}:${p.profile.subcategory_tr || p.profile.category_tr}`).join(" | ")
    );

    const toPiece = (
      label: string,
      profile: (typeof profiles)[number]["profile"],
      piece: PieceResult | null
    ): PieceResult | null =>
      piece
        ? ({
            ...piece,
            label,
            ...pieceAttrsFromProfile(profile),
          } satisfies PieceResult)
        : null;

    const rawPieces = await timer.span("search", () =>
      mapLimit(profiles, 3, async ({ label, profile }) => {
        if (profile.low_confidence) return null;
        return processPiece(profile, occasionKeyword, SERPAPI_KEY, AFFILIATE_TAG, new Set(), {
          mustFind: true,
          immersiveMode: "recommended",
        }).then((piece) => toPiece(label, profile, piece));
      })
    );

    const pieceResults: PieceResult[] = [];
    for (let i = 0; i < profiles.length; i++) {
      let piece = rawPieces[i];
      if (!piece && !profiles[i].profile.low_confidence) {
        console.warn("/api/decide retry", profiles[i].label);
        piece = toPiece(
          profiles[i].label,
          profiles[i].profile,
          await processPiece(
            profiles[i].profile,
            occasionKeyword,
            SERPAPI_KEY,
            AFFILIATE_TAG,
            new Set(),
            { mustFind: true, searchMode: "compact", immersiveMode: "recommended" }
          )
        );
      }
      if (piece) pieceResults.push(piece);
    }
    console.log(
      "/api/decide pieces",
      `${pieceResults.length}/${profiles.length}`,
      pieceResults.map((p) => p.label).join(" | ")
    );

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
    if (storage_path) {
      setCachedVision(visionCacheKey(user.id, storage_path, occasion), visionContent);
      if (requestedOccasion && requestedOccasion !== occasion) {
        setCachedVision(visionCacheKey(user.id, storage_path, requestedOccasion), visionContent);
      }
    }
    const stored: StoredResults = { pieces: pieceResults, vision_content: visionContent };
    const firstResults = pieceResults[0].results;
    const context = OCCASION_TO_CONTEXT[occasion];
    const history_id = !isAnonymousUser(user) ? randomUUID() : null;

    if (history_id) {
      const { error: insertError } = await supabase.from("search_history").insert({
        id: history_id,
        user_id: user.id,
        photo_url,
        results: stored,
        context,
      });
      if (insertError) console.error("search_history insert:", insertError.message);
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
