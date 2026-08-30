import { NextRequest, NextResponse } from "next/server";
import { ApiSecurityError, enforceIpRateLimit } from "@/lib/api-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { asText } from "@/lib/text";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    await enforceIpRateLimit(req, "contact", 8, 60);

    const body = await req.json().catch(() => ({}));
    const name = asText(body?.name).trim().slice(0, 80);
    const email = asText(body?.email).trim().toLowerCase().slice(0, 120);
    const message = asText(body?.message).trim().slice(0, 2000);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Lütfen adınızı yazın." }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
    }
    if (!message || message.length < 10) {
      return NextResponse.json(
        { error: "Mesaj en az 10 karakter olmalı." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.from("contact_messages").insert({
      name,
      email,
      message,
    });

    if (error) {
      console.error("contact_messages insert:", error.message);
      return NextResponse.json(
        { error: "Mesaj kaydedilemedi. Lütfen biraz sonra tekrar dene." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof ApiSecurityError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    console.error("/api/contact:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
