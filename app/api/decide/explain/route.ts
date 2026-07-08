import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  generateReasons,
  generateReasonsForPieces,
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    if (isPiecesRequest(body)) {
      const pieceReasons = await generateReasonsForPieces(body, OPENAI_API_KEY);
      return NextResponse.json({ pieces: pieceReasons });
    }

    const reasons = await generateReasons(body as ExplainRequest, OPENAI_API_KEY);
    return NextResponse.json({ reasons });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    console.error("/api/decide/explain error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
