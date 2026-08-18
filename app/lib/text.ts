/**
 * Coerce LLM / API / client values to a string before trim/toLowerCase.
 * GPT often returns category/fit as an array or `{value: "..."}`.
 */
export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null || typeof value === "boolean") return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const key of ["value", "label", "name", "type", "text", "title"]) {
      const inner = rec[key];
      if (typeof inner === "string" && inner.trim()) return inner;
    }
  }
  return "";
}

export function asLower(value: unknown): string {
  return asText(value).toLocaleLowerCase("tr-TR");
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  const one = asText(value);
  return one ? [one] : [];
}
