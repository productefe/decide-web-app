import { createHash } from "crypto";
import { EXTRACTOR_VERSION, PRODUCT_INTENT_JSON_SCHEMA, type OutfitIntent } from "./schema";
import { normalizeOutfitIntent, parseOutfitIntentJson } from "./normalize-intent";
import { fetchWithTimeout } from "./providers/http";
import { getPersistentVision, setPersistentVision } from "./cache";
import { dbg } from "./debug-log";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const VISION_MODEL = process.env.SEARCH_V2_VISION_MODEL || "gpt-4o";
const VISION_TIMEOUT_MS = Number(process.env.SEARCH_V2_VISION_TIMEOUT_MS || 15000);
const FALLBACK_VISION_MODEL =
  process.env.SEARCH_V2_VISION_FALLBACK_MODEL || "gpt-4o-mini";
const FALLBACK_VISION_TIMEOUT_MS = Number(
  process.env.SEARCH_V2_VISION_FALLBACK_TIMEOUT_MS || 15000
);

const SYSTEM_PROMPT = `Sen DECIDE Search V2 vision extractor'sın.
Görseldeki HER görünür giysi ve takı parçasını ayrı listele.
Kurallar:
- Forma / futbol forması / basketbol forması → family=jersey (asla tee değil)
- Sweatshirt ≠ tişört ≠ gömlek ≠ blazer; her biri kendi family
- Üst katman (blazer/ceket/mont) ile altındaki tişört/gömlek ayrı parçalar
- Kolye, küpe, bileklik, yüzük, saat görünürse jewelry layer ile ekle
- Ayakkabı alt tipi subtype'a yaz: terlik / sneaker / bot / sandalet / loafer
- Görünür özelleştirme distinctive_details'e yaz: fermuar, kapüşon, taş cinsi (inci/altın/gümüş), yaka
- body_color ana gövde rengi; motifler ayrı
- bounding_box 0-1 normalize; emin değilsen null
- low_confidence yalnız gerçekten belirsiz parçalar için true
- Türkçe label_tr / category_tr kullan
JSON şemasına birebir uy.`;

export function imageHashFromDataUrl(dataUrl: string): string {
  const payload = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return createHash("sha256").update(payload.slice(0, 200_000)).digest("hex").slice(0, 32);
}

function needsRepair(intent: OutfitIntent): boolean {
  return intent.pieces.length === 0;
}

function imageDetail(imageDataUrl: string): "low" | "high" {
  const payload = imageDataUrl.includes(",") ? imageDataUrl.split(",")[1] : imageDataUrl;
  // Large phone photos time out on detail=high; low is enough for garment type.
  return payload.length > 800_000 ? "low" : "high";
}

async function callResponsesApi(
  apiKey: string,
  imageDataUrl: string,
  repairHint?: string
): Promise<string> {
  const userText = repairHint
    ? `Önceki çıktıda eksik katman/takı vardı. SADECE extraction düzelt. İpucu: ${repairHint}`
    : "Bu kıyafet fotoğrafındaki tüm görünür parçaları çıkar.";

  const body = {
    model: VISION_MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `${SYSTEM_PROMPT}\n\n${userText}` },
          { type: "input_image", image_url: imageDataUrl, detail: imageDetail(imageDataUrl) },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: PRODUCT_INTENT_JSON_SCHEMA.name,
        strict: true,
        schema: PRODUCT_INTENT_JSON_SCHEMA.schema,
      },
    },
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(
      RESPONSES_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      VISION_TIMEOUT_MS
    );
  } catch (error) {
    console.warn(
      "[search-v2] Responses vision unavailable; using chat fallback",
      error instanceof Error ? error.message : String(error)
    );
    return callChatFallback(apiKey, imageDataUrl, repairHint);
  }

  const data = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
    error?: { message?: string };
  };

  if (!res.ok || data.error) {
    // Fallback: chat completions json_object (older key / model path)
    return callChatFallback(apiKey, imageDataUrl, repairHint);
  }

  if (data.output_text) return data.output_text;
  const texts: string[] = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (c.type === "output_text" && c.text) texts.push(c.text);
    }
  }
  if (texts.length) return texts.join("\n");
  return callChatFallback(apiKey, imageDataUrl, repairHint);
}

async function callChatFallback(
  apiKey: string,
  imageDataUrl: string,
  repairHint?: string
): Promise<string> {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: FALLBACK_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${SYSTEM_PROMPT}\n${repairHint || ""}\nYanıtı yalnızca JSON object olarak ver.`,
              },
              { type: "image_url", image_url: { url: imageDataUrl, detail: imageDetail(imageDataUrl) } },
            ],
          },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    },
    FALLBACK_VISION_TIMEOUT_MS
  );
  const data = (await res.json()) as {
    choices?: {
      finish_reason?: string;
      message?: { content?: string; refusal?: string };
    }[];
    error?: { message?: string };
  };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "Vision V2 başarısız");
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const refusal = data.choices?.[0]?.message?.refusal;
    const finish = data.choices?.[0]?.finish_reason;
    throw new Error(
      refusal
        ? `Vision V2 reddedildi: ${refusal}`
        : `Vision V2 boş yanıt${finish ? ` (${finish})` : ""}`
    );
  }
  return content;
}

export async function extractOutfitIntent(opts: {
  apiKey: string;
  imageDataUrl: string;
  userId?: string;
  skipCache?: boolean;
}): Promise<{ intent: OutfitIntent; image_hash: string; cached: boolean; raw: string }> {
  const image_hash = imageHashFromDataUrl(opts.imageDataUrl);
  if (!opts.skipCache) {
    const hit = await getPersistentVision(image_hash, EXTRACTOR_VERSION);
    if (hit) {
      const intent = normalizeOutfitIntent(JSON.parse(hit));
      // #region agent log
      dbg("H6", "vision.ts:cache", "vision cache hit", {
        cached: true,
        pieces: intent.pieces.length,
        families: intent.pieces.map((p) => p.family),
        subtypes: intent.pieces.map((p) => p.subtype),
      });
      // #endregion
      return {
        intent,
        image_hash,
        cached: true,
        raw: hit,
      };
    }
  }

  const t0 = Date.now();
  const payloadLen = (opts.imageDataUrl.split(",")[1] || opts.imageDataUrl).length;
  const large = payloadLen > 800_000;
  try {
  let raw: string;
  try {
    raw = await callResponsesApi(opts.apiKey, opts.imageDataUrl);
  } catch {
    raw = await callChatFallback(opts.apiKey, opts.imageDataUrl);
  }
  let intent: OutfitIntent;
  try {
    intent = parseOutfitIntentJson(raw);
  } catch {
    raw = await callChatFallback(opts.apiKey, opts.imageDataUrl);
    intent = parseOutfitIntentJson(raw);
  }

  if (needsRepair(intent) && Date.now() - t0 < 12_000) {
    try {
      raw = await callChatFallback(
        opts.apiKey,
        opts.imageDataUrl,
        "Eksik üst katman veya takıları ekle; mevcut doğru parçaları koru."
      );
      intent = parseOutfitIntentJson(raw);
    } catch {
      /* keep first */
    }
  }

  const persist = JSON.stringify({
    ...intent,
    extractor_version: EXTRACTOR_VERSION,
  });
  await setPersistentVision(image_hash, EXTRACTOR_VERSION, persist);

  // #region agent log
  dbg("H6", "vision.ts:ok", "vision extract ok", {
    cached: false,
    payloadLen,
    detail: imageDetail(opts.imageDataUrl),
    ms: Date.now() - t0,
    pieces: intent.pieces.length,
    families: intent.pieces.map((p) => p.family),
    subtypes: intent.pieces.map((p) => p.subtype),
    lowConfidence: intent.pieces.filter((p) => p.low_confidence).length,
  });
  // #endregion
  // #region agent log
  dbg("H9", "vision.ts:path", "vision path", {
    large,
    skippedResponses: large,
    ms: Date.now() - t0,
    pieces: intent.pieces.length,
  });
  // #endregion

  return { intent: { ...intent, extractor_version: EXTRACTOR_VERSION }, image_hash, cached: false, raw: persist };
  } catch (err) {
    // #region agent log
    dbg("H6", "vision.ts:fail", "vision extract fail", {
      payloadLen,
      detail: imageDetail(opts.imageDataUrl),
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message.slice(0, 180) : String(err),
    });
    // #endregion
    throw err;
  }
}
