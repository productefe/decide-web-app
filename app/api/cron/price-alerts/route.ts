import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApnsAlert, isApnsConfigured } from "@/lib/apns";
import {
  fetchCurrentProductPrice,
  getPriceBaseline,
  meetsPriceDropThreshold,
} from "@/lib/serp-price";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 50;

type SavedRow = {
  id: string;
  user_id: string;
  title: string;
  price: string;
  link: string;
  price_value: number | null;
  product_id: string | null;
  serpapi_product_api: string | null;
  last_notified_price: number | null;
};

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) {
    return NextResponse.json({ error: "SERPAPI_KEY missing" }, { status: 500 });
  }

  const apnsReady = isApnsConfigured();
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("saved_products")
    .select(
      "id, user_id, title, price, link, price_value, product_id, serpapi_product_api, last_notified_price"
    )
    .or("price_value.not.is.null,product_id.not.is.null,serpapi_product_api.not.is.null")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("price-alerts query:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const products = (rows || []) as SavedRow[];
  if (products.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, notified: 0 });
  }

  const userIds = [...new Set(products.map((p) => p.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, price_alerts_enabled")
    .in("id", userIds);

  const alertsEnabled = new Map<string, boolean>();
  for (const profile of profiles || []) {
    alertsEnabled.set(profile.id, profile.price_alerts_enabled !== false);
  }

  const { data: tokens } = await admin
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", userIds);

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokens || []) {
    const list = tokensByUser.get(row.user_id) || [];
    list.push(row.token);
    tokensByUser.set(row.user_id, list);
  }

  let checked = 0;
  let notified = 0;
  const now = new Date().toISOString();

  for (const product of products) {
    checked += 1;

    const baseline = getPriceBaseline(product.last_notified_price, product.price_value);
    if (baseline === null) {
      await admin
        .from("saved_products")
        .update({ last_checked_at: now })
        .eq("id", product.id);
      continue;
    }

    const quote = await fetchCurrentProductPrice(serpKey, {
      product_id: product.product_id,
      serpapi_product_api: product.serpapi_product_api,
      link: product.link,
      title: product.title,
    });

    if (!quote) {
      await admin
        .from("saved_products")
        .update({ last_checked_at: now })
        .eq("id", product.id);
      continue;
    }

    const shouldNotify =
      meetsPriceDropThreshold(baseline, quote.priceValue) &&
      alertsEnabled.get(product.user_id) !== false;

    if (shouldNotify && apnsReady) {
      const userTokens = tokensByUser.get(product.user_id) || [];
      const title = "Fiyat düştü";
      const shortTitle =
        product.title.length > 60 ? `${product.title.slice(0, 57)}…` : product.title;
      const body = `Beğendiğin ürünün fiyatı düştü: ${shortTitle} — ${quote.priceText}`;

      for (const deviceToken of userTokens) {
        const result = await sendApnsAlert(deviceToken, title, body);
        if (result.ok) notified += 1;
        else console.warn("APNs failed:", result.status, result.reason);
      }
    }

    await admin
      .from("saved_products")
      .update({
        last_checked_at: now,
        ...(shouldNotify
          ? {
              last_notified_price: quote.priceValue,
              price: quote.priceText,
              price_value: quote.priceValue,
            }
          : {}),
      })
      .eq("id", product.id);
  }

  return NextResponse.json({
    ok: true,
    checked,
    notified,
    apnsReady,
    batchSize: BATCH_SIZE,
  });
}
