import { createHash } from "crypto";
import { EXTRACTOR_VERSION, PRODUCT_INTENT_JSON_SCHEMA, type OutfitIntent, type PieceFamily } from "./schema";
import { normalizeOutfitIntent, parseOutfitIntentJson } from "./normalize-intent";
import { fetchWithTimeout } from "./providers/http";
import { getPersistentVision, setPersistentVision } from "./cache";
import { dbg } from "./debug-log";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const VISION_MODEL = process.env.SEARCH_V2_VISION_MODEL || "gpt-4o";
const VISION_BUDGET_MS = Number(process.env.SEARCH_V2_VISION_BUDGET_MS || 16000);
const VISION_TIMEOUT_MS = Number(process.env.SEARCH_V2_VISION_TIMEOUT_MS || 12000);
const FALLBACK_VISION_MODEL =
  process.env.SEARCH_V2_VISION_FALLBACK_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `Sen DECIDE Search V2 vision extractor'sın.
Görseldeki HER görünür giysi ve takı parçasını ayrı listele. Eksik parça bırakma.
Kurallar:
- Kombin / tam boy fotoğrafta asla tek parça dönme. Üst, alt, ayakkabı, dış giyim ve görünür takı ayrı items olsun (hedef ≥3).
- Kalın kumaş, ribana yen, crewneck, polar, kazak veya sweatshirt görüntüsü → family=sweatshirt (asla tee/tişört değil). Kapüşon varsa hoodie.
- Sweatshirt / hoodie / kazak BARİZ ise atlama, tişört yazma, low_confidence yapma.
- Üstte hem sweatshirt/hoodie/ceket HEM gömlek/tişört görünüyorsa İKİSİ de ayrı parça.
- Forma / futbol forması / basketbol forması → family=jersey (asla tee değil). Okul üniforması jersey değil.
- Sweatshirt ≠ tişört ≠ gömlek ≠ blazer ≠ hoodie; her biri kendi family
- Üst katman (blazer/ceket/mont/sweatshirt/hoodie) ile altındaki tişört/gömlek ayrı parçalar
- Kolye, küpe, bileklik, yüzük, saat görünürse jewelry layer ile ekle
- Ayakkabı alt tipi subtype'a yaz: terlik / sneaker / bot / sandalet / loafer
- Görünür özelleştirme distinctive_details'e yaz: fermuar, kapüşon, taş cinsi (inci/altın/gümüş), yaka
- body_color ana gövde rengi; motifler ayrı
- bounding_box 0-1 normalize; emin değilsen null
- low_confidence YALNIZ tamamen bulanık veya kadraj dışı kesik parçalar. Kombin içindeki net giysi asla low_confidence=true olmasın.
- Türkçe label_tr / category_tr kullan
JSON şemasına birebir uy.`;

export function imageHashFromDataUrl(dataUrl: string): string {
  const payload = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return createHash("sha256").update(payload.slice(0, 200_000)).digest("hex").slice(0, 32);
}

function needsRepair(intent: OutfitIntent): boolean {
  const pieces = intent.pieces;
  if (pieces.length < 2) return true;
  const families = new Set(pieces.map((p) => p.family));
  const has = (...keys: PieceFamily[]) => keys.some((k) => families.has(k));
  const hasBottom = has("pants", "jeans", "skirt", "shorts");
  const hasShoes = has("shoes", "sneakers", "boots");
  const hasKnitOrOuter = has("sweatshirt", "hoodie", "jacket", "blazer", "coat");
  const hasThinTop = has("tee", "shirt", "blouse");
  const outfitLike = hasBottom || hasShoes || pieces.length >= 2;
  if (outfitLike && pieces.length < 3) return true;
  if (outfitLike && hasThinTop && !hasKnitOrOuter) return true;
  return false;
}

function imageDetail(imageDataUrl: string): "low" | "high" {
  const payload = imageDataUrl.includes(",") ? imageDataUrl.split(",")[1] : imageDataUrl;
  // Only the huge phone dumps go low — detail=low was missing sweatshirts on normal shots.
  return payload.length > 1_800_000 ? "low" : "high";
}

async function callResponsesApi(
  apiKey: string,
  imageDataUrl: string,
  timeoutMs: number,
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

  const res = await fetchWithTimeout(
    RESPONSES_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  const data = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
    error?: { message?: string };
  };

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Vision Responses ${res.status}`);
  }

  if (data.output_text) return data.output_text;
  const texts: string[] = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (c.type === "output_text" && c.text) texts.push(c.text);
    }
  }
  if (texts.length) return texts.join("\n");
  throw new Error("Vision Responses boş yanıt");
}

async function callChatFallback(
  apiKey: string,
  imageDataUrl: string,
  timeoutMs: number,
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
    timeoutMs
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
  const remaining = () => Math.max(0, VISION_BUDGET_MS - (Date.now() - t0));
  const payloadLen = (opts.imageDataUrl.split(",")[1] || opts.imageDataUrl).length;
  const large = payloadLen > 800_000;
  try {
  let raw: string | null = null;
  let intent: OutfitIntent | null = null;

  try {
    raw = await callResponsesApi(
      opts.apiKey,
      opts.imageDataUrl,
      Math.min(VISION_TIMEOUT_MS, remaining() || VISION_TIMEOUT_MS)
    );
    intent = parseOutfitIntentJson(raw);
  } catch (error) {
    console.warn(
      "[search-v2] Responses vision unavailable; using chat fallback",
      error instanceof Error ? error.message : String(error)
    );
    raw = null;
    intent = null;
  }

  if (!intent && remaining() >= 2500) {
    raw = await callChatFallback(opts.apiKey, opts.imageDataUrl, remaining());
    intent = parseOutfitIntentJson(raw);
  }

  if (!intent) {
    throw new Error("Vision V2 boş yanıt");
  }

  const firstFamilies = intent.pieces.map((p) => p.family);
  const willRepair = needsRepair(intent) && remaining() >= 3000;
  // #region agent log
  dbg("H-layer", "vision.ts:pre-repair", "first extract layer check", {
    willRepair,
    needsRepair: needsRepair(intent),
    remainingMs: remaining(),
    families: firstFamilies,
    labels: intent.pieces.map((p) => p.label_tr.slice(0, 40)),
    layers: intent.pieces.map((p) => p.layer),
    lowConfidence: intent.pieces.map((p) => p.low_confidence),
  });
  // #endregion

  if (willRepair) {
    try {
      raw = await callChatFallback(
        opts.apiKey,
        opts.imageDataUrl,
        remaining(),
        "Görünür sweatshirt/kazak/polar/hoodie varsa family=sweatshirt veya hoodie ekle; tişört olarak bırakma. Doğru parçaları koru. Tam boy kombinse üst+alt+ayakkabı."
      );
      intent = parseOutfitIntentJson(raw);
      // #region agent log
      dbg("H-repair", "vision.ts:post-repair", "repair extract layer check", {
        families: intent.pieces.map((p) => p.family),
        labels: intent.pieces.map((p) => p.label_tr.slice(0, 40)),
        layers: intent.pieces.map((p) => p.layer),
      });
      // #endregion
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
    stillNeedsRepair: needsRepair(intent),
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
