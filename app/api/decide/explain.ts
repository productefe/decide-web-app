import type { Reasons } from "./pipeline";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type ExplainProductInput = {
  title: string;
  price: string;
  source: string;
};

export type ExplainRequest = {
  recommended: ExplainProductInput | null;
  cheaper: ExplainProductInput | null;
  style: ExplainProductInput | null;
};

export type ExplainPiecesRequest = {
  pieces: Array<{ label: string } & ExplainRequest>;
};

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

function formatPieceBlock(label: string, products: ExplainRequest): string {
  return `${label}:
  Recommended: ${products.recommended?.title ?? "-"}, ${products.recommended?.price ?? "-"} (${products.recommended?.source ?? "-"})
  Cheaper: ${products.cheaper?.title ?? "-"}, ${products.cheaper?.price ?? "-"} (${products.cheaper?.source ?? "-"})
  Sana Özel: ${products.style?.title ?? "-"}, ${products.style?.price ?? "-"} (${products.style?.source ?? "-"})`;
}

export async function generateReasons(
  products: ExplainRequest,
  apiKey: string
): Promise<Reasons> {
  const explanationText = `Sen bir moda danışmanısın. Aşağıdaki her ürün için, etiketine neden uygun olduğunu açıklayan TÜRKÇE, samimi, 1 cümlelik açıklama yaz. Ürün adını ve fiyatını cümlede kullan. SADECE geçerli JSON döndür, markdown yok:
{"recommended_reason": "", "cheaper_reason": "", "style_reason": ""}

Recommended (en iyi eşleşme): ${products.recommended?.title ?? "-"}, ${products.recommended?.price ?? "-"} (${products.recommended?.source ?? "-"})
Cheaper (daha uygun fiyat): ${products.cheaper?.title ?? "-"}, ${products.cheaper?.price ?? "-"} (${products.cheaper?.source ?? "-"})
Sana Özel (tarzına uygun): ${products.style?.title ?? "-"}, ${products.style?.price ?? "-"} (${products.style?.source ?? "-"})`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: explanationText }],
      max_tokens: 300,
    }),
  });

  const data = (await res.json()) as OpenAIChatResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "Açıklama üretilemedi.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) return {};

  return JSON.parse(content.replace(/```json|```/g, "").trim()) as Reasons;
}

export async function generateReasonsForPieces(
  request: ExplainPiecesRequest,
  apiKey: string
): Promise<Reasons[]> {
  if (request.pieces.length === 0) return [];
  if (request.pieces.length === 1) {
    const reasons = await generateReasons(request.pieces[0], apiKey);
    return [reasons];
  }

  const blocks = request.pieces.map((p) => formatPieceBlock(p.label, p)).join("\n\n");
  const explanationText = `Sen bir moda danışmanısın. Aşağıdaki her kıyafet parçası için 3 ürünün açıklamasını yaz. Her parça için TÜRKÇE, samimi, 1 cümlelik açıklama. SADECE geçerli JSON döndür:
{"pieces":[{"recommended_reason":"","cheaper_reason":"","style_reason":""},...]}

${blocks}`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: explanationText }],
      max_tokens: 200 * request.pieces.length,
    }),
  });

  const data = (await res.json()) as OpenAIChatResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "Açıklama üretilemedi.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) return request.pieces.map(() => ({}));

  const parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as {
    pieces?: Reasons[];
  };
  return parsed.pieces || request.pieces.map(() => ({}));
}
