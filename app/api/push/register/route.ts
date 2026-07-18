import { NextRequest, NextResponse } from "next/server";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import { isPermanentUser } from "@/lib/auth-user";

const TOKEN_RE = /^[a-f0-9]{32,}$/i;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient(req);
    const bearerToken = getBearerToken(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError) console.error("/api/push/register auth error:", authError.message);

    if (!user || !isPermanentUser(user)) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "ios";

    if (!TOKEN_RE.test(token)) {
      return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
    }

    if (platform !== "ios") {
      return NextResponse.json({ error: "Desteklenmeyen platform." }, { status: 400 });
    }

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );

    if (error) {
      console.error("push register error:", error.message);
      return NextResponse.json({ error: "Kayıt başarısız." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push register:", err);
    return NextResponse.json({ error: "İstek işlenemedi." }, { status: 500 });
  }
}
