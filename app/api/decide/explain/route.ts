import { NextRequest, NextResponse } from "next/server";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import { ApiSecurityError, enforceRateLimit } from "@/lib/api-security";
import {
  generateReasons,
  generateReasonsForPieces,
  sanitizeExplainPiecesRequest,
  sanitizeExplainRequestBody,
  type ExplainRequest,
  type ExplainPiecesRequest,
} from "../explain";

export const runtime = "nodejs";
export const maxDuration = 30;

function isPiecesRequest(body: unknown): body is ExplainPiecesRequest {
  return Boolean(
    body &&
      typeof body === "object" &&
      "pieces" in body &&
      Array.isArray((body as ExplainPiecesRequest).pieces)
  );
}

export async function POST(req: NextRequest) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const supabase = await createClient(req);
    const bearerToken = getBearerToken(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      if (authError) console.error("/api/decide/explain auth error:", authError.message);
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }

    try {
      await enforceRateLimit(supabase, "explain", 20);
    } catch (err) {
      if (err instanceof ApiSecurityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const body = await req.json().catch(() => ({}));

    if (isPiecesRequest(body)) {
      if (body.pieces.length > 4) {
        return NextResponse.json(
          { error: "En fazla 4 parça için açıklama üretilebilir." },
          { status: 400 }
        );
      }
      const sanitized = sanitizeExplainPiecesRequest(body);
      const pieceReasons = await generateReasonsForPieces(sanitized, OPENAI_API_KEY);
      return NextResponse.json({ pieces: pieceReasons });
    }

    const reasons = await generateReasons(
      sanitizeExplainRequestBody(body as ExplainRequest),
      OPENAI_API_KEY
    );
    return NextResponse.json({ reasons });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    const status = /En fazla 4 parça/.test(message) ? 400 : 500;
    console.error("/api/decide/explain error:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
