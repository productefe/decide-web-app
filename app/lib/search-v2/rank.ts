import { createHash } from "crypto";
import type { ProductIntent, VerifiedCandidate } from "./schema";
import { canonColor, familyTitleTokens } from "./normalize-intent";
import { preferScore, typeSpec } from "./type-cues";
import { fetchWithTimeout } from "./providers/http";
import { textHasPoolBrand, textHasTrustedStore } from "@/constants/brandPool";

function lower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

function metaScore(c: VerifiedCandidate, intent: ProductIntent): number {
  let s = 0;
  const t = lower(c.title);
  const tokens = familyTitleTokens(intent.family);
  if (tokens.some((tok) => t.includes(lower(tok)))) s += 3;
  const spec = typeSpec(intent);
  s += preferScore(c.title, spec);
  const color = canonColor(intent.body_color);
  if (color && color !== "bilinmeyen") {
    if (t.includes(color)) s += 8;
    else s -= 3;
  }
  for (const m of intent.motifs) {
    if (m.type && t.includes(lower(m.type))) s += 6;
    if (m.text && t.includes(lower(m.text))) s += 6;
  }
  if (textHasPoolBrand(`${c.title} ${c.source}`)) s += 1.5;
  if (textHasTrustedStore(`${c.title} ${c.source} ${c.store || ""}`)) s += 5;
  if (c.provider === "lens") s += 1;
  if (c.size_status === "likely") s += 0.5;
  if (c.priceValue && c.priceValue >= 200) s += 0.3;
  if (c.priceValue && c.priceValue < 250) s -= 4;
  return s;
}

/**
 * Multimodal visual rerank — batch top N against reference description.
 * Falls back to metadata-only when OpenAI unavailable or times out.
 */
export async function rerankCandidates(opts: {
  apiKey?: string;
  intent: ProductIntent;
  candidates: VerifiedCandidate[];
  referenceImageUrl?: string;
  limit?: number;
  timeoutMs?: number;
}): Promise<VerifiedCandidate[]> {
  const limit = opts.limit || 12;
  const scored = opts.candidates.map((c) => {
    const meta = metaScore(c, opts.intent);
    return { ...c, meta_score: meta, visual_score: 0, score: meta };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.min(limit, scored.length));

  if (!opts.apiKey || top.length === 0) return top;

  try {
    const payload = {
      model: process.env.SEARCH_V2_RERANK_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Referans parça: family=${opts.intent.family}, color=${opts.intent.body_color}, motifs=${JSON.stringify(opts.intent.motifs).slice(0, 200)}.
Aşağıdaki ürün başlıklarını 0-10 görsel/uyum skoruyla puanla. JSON: {"scores":[{"id":"...","score":0-10}]}
Ürünler:\n${top.map((c) => `${c.id} :: ${c.title}`).join("\n")}`,
            },
            ...(opts.referenceImageUrl && !opts.referenceImageUrl.startsWith("data:")
              ? [
                  {
                    type: "image_url" as const,
                    image_url: { url: opts.referenceImageUrl, detail: "low" as const },
                  },
                ]
              : []),
          ],
        },
      ],
      max_tokens: 800,
      response_format: { type: "json_object" },
    };

    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(payload),
      },
      opts.timeoutMs || 2000
    );
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return top;
    const parsed = JSON.parse(content) as { scores?: { id: string; score: number }[] };
    const map = new Map((parsed.scores || []).map((s) => [s.id, Number(s.score) || 0]));
    for (const c of top) {
      const v = map.get(c.id) ?? 5;
      c.visual_score = v;
      // Visual must pass — brand cannot override bad visual
      if (v < 4) {
        c.score = 0;
        c.reject_reason = "visual_fail";
      } else {
        c.score = c.meta_score + v;
      }
    }
    return top
      .filter((c) => !c.reject_reason)
      .sort((a, b) => b.score - a.score);
  } catch {
    return top;
  }
}

export function imageFingerprint(url: string): string {
  return createHash("sha1").update(url || "").digest("hex").slice(0, 12);
}
