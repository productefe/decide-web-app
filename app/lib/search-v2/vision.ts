import { createHash } from "crypto";
import { EXTRACTOR_VERSION, PRODUCT_INTENT_JSON_SCHEMA, type OutfitIntent } from "./schema";
import { normalizeOutfitIntent, parseOutfitIntentJson } from "./normalize-intent";
import { fetchWithTimeout } from "./providers/http";
import { getPersistentVision, setPersistentVision } from "./cache";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const VISION_MODEL = process.env.SEARCH_V2_VISION_MODEL || "gpt-4o";
const VISION_TIMEOUT_MS = Number(process.env.SEARCH_V2_VISION_TIMEOUT_MS || 4500);

const SYSTEM_PROMPT = `Sen DECIDE Search V2 vision extractor'sın.
Görseldeki HER görünür giysi ve takı parçasını ayrı listele.
Kurallar:
- Forma / futbol forması / basketbol forması → family=jersey (asla tee değil)
- Sweatshirt ≠ tişört ≠ gömlek ≠ blazer; her biri kendi family
- Üst katman (blazer/ceket/mont) ile altındaki tişört/gömlek ayrı parçalar
- Kolye, küpe, bileklik, yüzük, saat görünürse jewelry layer ile ekle
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
  if (intent.pieces.length === 0) return true;
  const layers = new Set(intent.pieces.map((p) => p.layer));
  // If we only got one mid/inner and no jewelry when notes mention jewelry — soft
  const hasOuterOrMid = intent.pieces.some((p) =>
    ["outer", "mid", "inner"].includes(p.layer)
  );
  return !hasOuterOrMid;
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
          { type: "input_image", image_url: imageDataUrl, detail: "high" },
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
    VISION_TIMEOUT_MS
  );

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
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${SYSTEM_PROMPT}\n${repairHint || ""}\nYanıtı yalnızca JSON object olarak ver.`,
              },
              { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    },
    VISION_TIMEOUT_MS
  );
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "Vision V2 başarısız");
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Vision V2 boş yanıt");
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
      return {
        intent: normalizeOutfitIntent(JSON.parse(hit)),
        image_hash,
        cached: true,
        raw: hit,
      };
    }
  }

  let raw = await callResponsesApi(opts.apiKey, opts.imageDataUrl);
  let intent = parseOutfitIntentJson(raw);

  if (needsRepair(intent)) {
    try {
      raw = await callResponsesApi(
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

  return { intent: { ...intent, extractor_version: EXTRACTOR_VERSION }, image_hash, cached: false, raw: persist };
}
