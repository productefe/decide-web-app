const SERPAPI_URL = "https://serpapi.com/search";

export type TrackableProduct = {
  product_id?: string | null;
  serpapi_product_api?: string | null;
  link?: string;
  title?: string;
};

export type PriceQuote = {
  priceValue: number;
  priceText: string;
};

function parsePriceValue(price: string | undefined, extracted?: number): number | null {
  if (typeof extracted === "number" && extracted > 0) return extracted;
  if (!price) return null;

  const normalized = price.replace(/[^\d,.\-]/g, "").trim();
  if (!normalized) return null;

  let numeric = normalized;
  if (numeric.includes(",") && numeric.includes(".")) {
    numeric = numeric.replace(/\./g, "").replace(",", ".");
  } else if (numeric.includes(",")) {
    numeric = numeric.replace(",", ".");
  }

  const value = parseFloat(numeric);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractFromImmersive(data: Record<string, unknown>): PriceQuote | null {
  const productResults = data.product_results as Record<string, unknown> | undefined;
  if (productResults) {
    const fromProduct = parsePriceValue(
      productResults.price as string | undefined,
      productResults.extracted_price as number | undefined
    );
    if (fromProduct) {
      return {
        priceValue: fromProduct,
        priceText: (productResults.price as string) || `₺${fromProduct}`,
      };
    }
  }

  const sellerLists: unknown[] = [
    ...(Array.isArray(productResults?.stores) ? productResults.stores : []),
    ...(Array.isArray(data.stores) ? data.stores : []),
    ...((data.sellers_results as { online_sellers?: unknown[] } | undefined)?.online_sellers ||
      []),
    ...(Array.isArray(productResults?.sellers) ? productResults.sellers : []),
  ];

  for (const entry of sellerLists) {
    const seller = entry as { price?: string; extracted_price?: number; total?: number };
    const value = parsePriceValue(seller.price, seller.extracted_price ?? seller.total);
    if (value) {
      return { priceValue: value, priceText: seller.price || `₺${value}` };
    }
  }

  return null;
}

export async function fetchCurrentProductPrice(
  apiKey: string,
  product: TrackableProduct
): Promise<PriceQuote | null> {
  if (product.serpapi_product_api) {
    try {
      const url = product.serpapi_product_api.includes("api_key=")
        ? product.serpapi_product_api
        : `${product.serpapi_product_api}&api_key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const quote = extractFromImmersive(data);
        if (quote) return quote;
      }
    } catch (err) {
      console.warn("SerpAPI immersive price fetch failed:", err);
    }
  }

  if (product.product_id) {
    try {
      const params = new URLSearchParams({
        engine: "google_product",
        product_id: product.product_id,
        api_key: apiKey,
        gl: "tr",
        hl: "tr",
      });
      const res = await fetch(`${SERPAPI_URL}?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const productResults = data.product_results as Record<string, unknown> | undefined;
        const fromProduct = parsePriceValue(
          productResults?.price as string | undefined,
          productResults?.extracted_price as number | undefined
        );
        if (fromProduct) {
          return {
            priceValue: fromProduct,
            priceText: (productResults?.price as string) || `₺${fromProduct}`,
          };
        }

        const sellers =
          (data.sellers_results as { online_sellers?: unknown[] } | undefined)?.online_sellers ||
          [];
        for (const entry of sellers) {
          const seller = entry as { price?: string; extracted_price?: number; total?: number };
          const value = parsePriceValue(seller.price, seller.extracted_price ?? seller.total);
          if (value) {
            return { priceValue: value, priceText: seller.price || `₺${value}` };
          }
        }
      }
    } catch (err) {
      console.warn("SerpAPI product price fetch failed:", err);
    }
  }

  return null;
}

export function meetsPriceDropThreshold(baseline: number, current: number): boolean {
  if (current >= baseline) return false;
  const drop = baseline - current;
  return drop >= 50 || drop / baseline >= 0.05;
}

export function getPriceBaseline(
  lastNotifiedPrice: number | null | undefined,
  savedPriceValue: number | null | undefined
): number | null {
  if (typeof lastNotifiedPrice === "number" && lastNotifiedPrice > 0) {
    return lastNotifiedPrice;
  }
  if (typeof savedPriceValue === "number" && savedPriceValue > 0) {
    return savedPriceValue;
  }
  return null;
}
