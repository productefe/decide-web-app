import { NextRequest, NextResponse } from "next/server";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import { trackAnalyticsEvent } from "@/lib/api-security";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set([
  "combine_requested",
  "combine_result_viewed",
  "combine_product_clicked",
  "combine_show_more",
]);

export async function POST(req: NextRequest) {
  try {
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
    const eventName = typeof body?.event === "string" ? body.event : "";
    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ error: "Geçersiz olay." }, { status: 400 });
    }

    const props =
      body?.props && typeof body.props === "object" && !Array.isArray(body.props)
        ? (body.props as Record<string, unknown>)
        : {};

    await trackAnalyticsEvent(supabase, user.id, eventName, props);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
