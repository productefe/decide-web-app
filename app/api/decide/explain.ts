import type { Reasons } from "./pipeline";
import { truncateForPrompt } from "@/lib/api-security";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_PIECES = 4;

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

function sanitizeProduct(product: ExplainProductInput | null | undefined): ExplainProductInput | null {
  if (!product) return null;
  return {
    title: truncateForPrompt(product.title, 200),
    price: truncateForPrompt(product.price, 80),
    source: truncateForPrompt(product.source, 200),
  };
}

function sanitizeExplainRequest(request: ExplainRequest): ExplainRequest {
  return {
    recommended: sanitizeProduct(request.recommended),
    cheaper: sanitizeProduct(request.cheaper),
    style: sanitizeProduct(request.style),
  };
}

export function sanitizeExplainPiecesRequest(request: ExplainPiecesRequest): ExplainPiecesRequest {
  if (request.pieces.length > MAX_PIECES) {
    throw new Error("En fazla 4 parça için açıklama üretilebilir.");
  }
  return {
    pieces: request.pieces.map((piece) => ({
      label: truncateForPrompt(piece.label, 80),
      ...sanitizeExplainRequest(piece),
    })),
  };
}

export function sanitizeExplainRequestBody(body: ExplainRequest): ExplainRequest {
  return sanitizeExplainRequest(body);
}

function parseReasonsJson(content: string): Reasons {
  try {
    return JSON.parse(content.replace(/```json|```/g, "").trim()) as Reasons;
  } catch {
    console.error("explain JSON parse failed");
    return {};
  }
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
  const sanitized = sanitizeExplainRequest(products);
  const explanationText = `Sen bir moda danışmanısın. Aşağıdaki her ürün için, etiketine neden uygun olduğunu açıklayan TÜRKÇE, samimi, 1 cümlelik açıklama yaz. Ürün adını ve fiyatını cümlede kullan. SADECE geçerli JSON döndür, markdown yok:
{"recommended_reason": "", "cheaper_reason": "", "style_reason": ""}

Recommended (en iyi eşleşme): ${sanitized.recommended?.title ?? "-"}, ${sanitized.recommended?.price ?? "-"} (${sanitized.recommended?.source ?? "-"})
Cheaper (daha uygun fiyat): ${sanitized.cheaper?.title ?? "-"}, ${sanitized.cheaper?.price ?? "-"} (${sanitized.cheaper?.source ?? "-"})
Sana Özel (tarzına uygun): ${sanitized.style?.title ?? "-"}, ${sanitized.style?.price ?? "-"} (${sanitized.style?.source ?? "-"})`;

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

  return parseReasonsJson(content);
}

export async function generateReasonsForPieces(
  request: ExplainPiecesRequest,
  apiKey: string
): Promise<Reasons[]> {
  const sanitized = sanitizeExplainPiecesRequest(request);
  if (sanitized.pieces.length === 0) return [];
  if (sanitized.pieces.length === 1) {
    const reasons = await generateReasons(sanitized.pieces[0], apiKey);
    return [reasons];
  }

  const blocks = sanitized.pieces.map((p) => formatPieceBlock(p.label, p)).join("\n\n");
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
      max_tokens: 200 * sanitized.pieces.length,
    }),
  });

  const data = (await res.json()) as OpenAIChatResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "Açıklama üretilemedi.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) return sanitized.pieces.map(() => ({}));

  try {
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as {
      pieces?: Reasons[];
    };
    return parsed.pieces || sanitized.pieces.map(() => ({}));
  } catch {
    console.error("explain pieces JSON parse failed");
    return sanitized.pieces.map(() => ({}));
  }
}
