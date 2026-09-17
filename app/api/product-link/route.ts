import { NextRequest, NextResponse } from "next/server";
import { createClient, getBearerToken } from "@/utils/supabase/server";
import { fetchWithTimeout } from "@/lib/search-v2/providers/http";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Lazy merchant link resolution — called on user click, not during /api/decide.
 * Accepts either a direct product URL or a SerpAPI immersive product API URL.
 */
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
    const link: string = typeof body?.link === "string" ? body.link : "";
    const immersive: string =
      typeof body?.serpapi_immersive_product_api === "string"
        ? body.serpapi_immersive_product_api
        : "";
    const affiliateTag = process.env.AMAZON_AFFILIATE_TAG || "decide07-21";

    if (link && !immersive) {
      // Already direct — optionally tag Amazon
      let out = link;
      if (/amazon\./i.test(out) && !/[?&]tag=/.test(out)) {
        out += (out.includes("?") ? "&" : "?") + `tag=${affiliateTag}`;
      }
      return NextResponse.json({ link: out, resolved: false });
    }

    if (!immersive) {
      return NextResponse.json({ error: "link gerekli" }, { status: 400 });
    }

    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    if (!SERPAPI_KEY) {
      return NextResponse.json({ link: link || immersive, resolved: false });
    }

    const url = immersive.includes("api_key=")
      ? immersive
      : `${immersive}${immersive.includes("?") ? "&" : "?"}api_key=${SERPAPI_KEY}`;

    const res = await fetchWithTimeout(url, {}, 4000);
    const data = (await res.json()) as {
      product_results?: { stores?: { link?: string; name?: string }[] };
      immersive_product_results?: { stores?: { link?: string }[] };
    };
    const stores =
      data.product_results?.stores || data.immersive_product_results?.stores || [];
    const best = stores.find((s) => s.link)?.link || link || immersive;
    let out = best;
    if (/amazon\./i.test(out) && !/[?&]tag=/.test(out)) {
      out += (out.includes("?") ? "&" : "?") + `tag=${affiliateTag}`;
    }
    return NextResponse.json({ link: out, resolved: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "link çözülemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
