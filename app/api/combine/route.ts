import { NextRequest, NextResponse } from "next/server";
import { parseGender, parsePriceMode, parseSizes, type PriceMode } from "@/lib/preferences";
import { isAnonymousUser } from "@/lib/auth-user";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import {
  ApiSecurityError,
  enforceRateLimit,
  enforceIpRateLimit,
  trackAnalyticsEvent,
} from "@/lib/api-security";
import {
  COMBINE_OUTFIT_SLOTS,
  CONTEXT_TO_OCCASION,
  parseAnalysisContext,
  resolveCombinePieceCategory,
  type AnalysisContext,
  type CombineOutfitSlot,
} from "@/lib/combine-rules";
import {
  combineOutfit,
  type CombinePieceAttributes,
  type CombineSlotSuggestion,
} from "@/lib/combine-outfit";
import type { PieceResult, Results, StoredResults } from "@/components/analyze/types";
import type { UserProfile } from "@/api/decide/pipeline";
import { RequestTimer } from "@/lib/timing";

export const runtime = "nodejs";
export const maxDuration = 60;

type PieceAttrsStored = PieceResult & {
  category?: string;
  color_tr?: string;
  fit?: string;
  gender?: string;
  style_tags?: string[];
};

function collectTitles(results: Results): string[] {
  return [results.recommended?.title, results.cheaper?.title, results.style?.title].filter(
    (t): t is string => Boolean(t)
  );
}

function findPiece(
  stored: StoredResults | null,
  pieceLabel: string
): PieceAttrsStored | null {
  if (!stored || typeof stored !== "object") return null;
  if ("pieces" in stored && Array.isArray(stored.pieces)) {
    const hit = stored.pieces.find(
      (p) => p.label === pieceLabel || p.category_tr === pieceLabel
    );
    return (hit as PieceAttrsStored | undefined) || null;
  }
  if (pieceLabel === "Parça") {
    return { label: "Parça", category_tr: "", results: stored as Results };
  }
  return null;
}

function attributesFromPiece(
  piece: PieceAttrsStored,
  bodyAttrs: Partial<CombinePieceAttributes> | undefined
): CombinePieceAttributes {
  return {
    category: bodyAttrs?.category || piece.category || piece.category_tr || "",
    category_tr: bodyAttrs?.category_tr || piece.category_tr || piece.label || "",
    label: bodyAttrs?.label || piece.label || piece.category_tr || "Parça",
    color_tr: bodyAttrs?.color_tr || piece.color_tr || "",
    fit: bodyAttrs?.fit || piece.fit || "",
    gender: bodyAttrs?.gender || piece.gender || "",
    style_tags: bodyAttrs?.style_tags || piece.style_tags || [],
  };
}

function parseOutfitSlot(raw: unknown): CombineOutfitSlot | null {
  if (typeof raw !== "string") return null;
  return (COMBINE_OUTFIT_SLOTS as readonly string[]).includes(raw)
    ? (raw as CombineOutfitSlot)
    : null;
}

function parseReuseSuggestion(raw: unknown): CombineSlotSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const slot = parseOutfitSlot(obj.slot);
  if (!slot) return null;
  if (typeof obj.searchQuery !== "string" || !obj.searchQuery.trim()) return null;
  return {
    slot,
    color: typeof obj.color === "string" ? obj.color : "",
    styleDescriptor: typeof obj.styleDescriptor === "string" ? obj.styleDescriptor : "",
    searchQuery: obj.searchQuery.trim(),
    accessoryType:
      typeof obj.accessoryType === "string" && obj.accessoryType.trim()
        ? obj.accessoryType.trim()
        : undefined,
  };
}

export async function POST(req: NextRequest) {
  const timer = new RequestTimer();
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

    if (isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "Kombinlemek için kayıt olman gerekiyor." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const historyId: string | undefined =
      typeof body?.history_id === "string" ? body.history_id : undefined;
    const pieceLabel: string | undefined =
      typeof body?.piece_label === "string" ? body.piece_label : undefined;
    const saveContext =
      parseAnalysisContext(body?.context) || parseAnalysisContext(body?.occasion);
    const onlySlot = parseOutfitSlot(body?.outfit_slot);
    const reuseSuggestion = parseReuseSuggestion(body?.suggestion);
    const isShowMore = Boolean(onlySlot && reuseSuggestion);

    if (!pieceLabel) {
      return NextResponse.json({ error: "Parça seçilmedi." }, { status: 400 });
    }

    const prefsPromise = supabase
      .from("user_preferences")
      .select("preferences, gender, sizes, price_mode")
      .eq("id", user.id)
      .single();

    const rateLimitPromise = isShowMore
      ? Promise.all([
          enforceRateLimit(supabase, "combine_more", 100),
          enforceIpRateLimit(req, "combine_more", 20),
        ])
      : // Soft hourly cap only — daily combines_used quota is off until product gates it.
        Promise.all([
          enforceRateLimit(supabase, "combine", 100),
          enforceIpRateLimit(req, "combine", 20),
        ]);

    let photoUrl = typeof body?.photo_url === "string" ? body.photo_url : "";
    let context: AnalysisContext | null = saveContext;
    let piece: PieceAttrsStored | null = null;

    const historyPromise = historyId
      ? supabase
          .from("search_history")
          .select("id, user_id, photo_url, results, context")
          .eq("id", historyId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    try {
      const [, historyRes] = await Promise.all([rateLimitPromise, historyPromise]);

      if (historyId) {
        const { data: row, error: histError } = historyRes;
        if (!histError && row) {
          photoUrl = row.photo_url || photoUrl;
          piece = findPiece(row.results as StoredResults, pieceLabel);

          if (!context) {
            context = parseAnalysisContext(row.context);
          }

          // Legacy rows: require context chip selection, then persist
          if (!context) {
            return NextResponse.json(
              { error: "context_required", message: "Önce nerede giyeceğini seçmelisin." },
              { status: 400 }
            );
          }

          if (saveContext && row.context !== saveContext) {
            void supabase
              .from("search_history")
              .update({ context: saveContext })
              .eq("id", historyId)
              .eq("user_id", user.id)
              .then(({ error: updErr }) => {
                if (updErr) console.error("search_history context update:", updErr.message);
              });
          }
        }
      }

      if (!piece) {
        // Live results, or history_id returned before the row was visible.
        if (!context) {
          return NextResponse.json(
            { error: "context_required", message: "Önce nerede giyeceğini seçmelisin." },
            { status: 400 }
          );
        }
        if (!photoUrl) {
          return NextResponse.json(
            { error: historyId ? "Analiz bulunamadı." : "Fotoğraf bulunamadı." },
            { status: 404 }
          );
        }
        piece = {
          label: pieceLabel,
          category_tr: typeof body?.category_tr === "string" ? body.category_tr : pieceLabel,
          results: { recommended: null, cheaper: null, style: null },
          category: typeof body?.category === "string" ? body.category : undefined,
          color_tr: typeof body?.color_tr === "string" ? body.color_tr : undefined,
          fit: typeof body?.fit === "string" ? body.fit : undefined,
          gender:
            typeof body?.piece_gender === "string"
              ? body.piece_gender
              : typeof body?.attributes?.gender === "string"
                ? body.attributes.gender
                : undefined,
          style_tags: Array.isArray(body?.style_tags)
            ? body.style_tags.filter((t: unknown): t is string => typeof t === "string")
            : undefined,
        };
      }
    } catch (err) {
      if (err instanceof ApiSecurityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    if (!piece) {
      return NextResponse.json({ error: "Parça bulunamadı." }, { status: 404 });
    }

    const bodyAttrs: Partial<CombinePieceAttributes> | undefined = body?.attributes;
    const attributes = attributesFromPiece(piece, bodyAttrs);

    const pieceCategory = resolveCombinePieceCategory(
      attributes.category,
      attributes.category_tr,
      attributes.label
    );
    if (!pieceCategory) {
      return NextResponse.json(
        { error: "Bu parça için kombin kuralı bulunamadı." },
        { status: 400 }
      );
    }

    if (!context) {
      return NextResponse.json(
        { error: "context_required", message: "Önce nerede giyeceğini seçmelisin." },
        { status: 400 }
      );
    }

    const { data: userPrefs } = await prefsPromise;

    const bodySizes = parseSizes(body?.sizes);
    const bodyGender = parseGender(body?.gender);
    const bodyPriceMode = parsePriceMode(body?.price_mode);

    const sizes = bodySizes.length ? bodySizes : parseSizes(userPrefs?.sizes);
    const price_mode: PriceMode =
      bodyPriceMode || parsePriceMode(userPrefs?.price_mode) || "karma";
    const userGender = bodyGender || parseGender(userPrefs?.gender);

    if (userGender) {
      attributes.gender = userGender;
    }

    const user_profile: UserProfile = {
      preferences: userPrefs?.preferences || [],
      sizes,
      price_mode,
      occasion: CONTEXT_TO_OCCASION[context],
      gender: userGender,
    };

    const excludeRaw: unknown[] = Array.isArray(body?.exclude_titles) ? body.exclude_titles : [];
    const excludeTitles = new Set<string>(
      excludeRaw.filter((t): t is string => typeof t === "string" && t.length > 0)
    );

    if (!isShowMore) {
      void trackAnalyticsEvent(supabase, user.id, "combine_requested", {
        piece_category: pieceCategory,
        context,
        piece_label: pieceLabel,
      });
    } else {
      void trackAnalyticsEvent(supabase, user.id, "combine_show_more", {
        piece_category: pieceCategory,
        context,
        outfit_slot: onlySlot,
      });
    }

    const result = await timer.span("combine", () =>
      combineOutfit({
        pieceCategory,
        attributes,
        context,
        userProfile: user_profile,
        photoUrl,
        userId: user.id,
        openaiKey: OPENAI_API_KEY,
        serpKey: SERPAPI_KEY,
        affiliateTag: AFFILIATE_TAG,
        onlySlot: onlySlot || undefined,
        reuseSuggestion: reuseSuggestion || undefined,
        excludeTitles,
      })
    );

    if (result.timing) {
      timer.set("llm", result.timing.llm_ms);
      timer.set("serp", result.timing.serp_ms);
    }

    if (!isShowMore) {
      void trackAnalyticsEvent(supabase, user.id, "combine_result_viewed", {
        piece_category: pieceCategory,
        context,
        slot_count: result.slots.length,
      });
    }

    const exclude_titles = [
      ...excludeTitles,
      ...result.slots.flatMap((s) => collectTitles(s.piece.results)),
    ];

    const snap = timer.snapshot({
      route: "/api/combine",
      slots: result.slots.length,
      context,
      show_more: isShowMore,
      reused_suggestion: result.timing?.reused_suggestion ?? false,
    });
    return timer.json(
      {
        history_id: historyId || null,
        context,
        piece_label: pieceLabel,
        piece_category: pieceCategory,
        source: {
          label: attributes.label,
          category_tr: attributes.category_tr,
          color_tr: attributes.color_tr || null,
          photo_url: photoUrl,
        },
        slots: result.slots,
        exclude_titles,
      },
      snap
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    console.error("/api/combine:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
