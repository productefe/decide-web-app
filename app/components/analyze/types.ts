export type Stage = "idle" | "loading" | "result" | "error";

export interface Product {
  title: string;
  price: string;
  source: string;
  image: string;
  link: string;
  store: string;
  reason: string;
  label: string;
}

export interface Results {
  recommended: Product | null;
  cheaper: Product | null;
  style: Product | null;
}

export const SLOT_LABELS: Record<string, string> = {
  recommended: "ÖNERİLEN",
  cheaper: "DAHA UYGUN",
  style: "SANA ÖZEL",
};

export function cleanStoreName(source: string): string {
  if (!source) return "Mağaza";
  const first = source.split(/[-–]/)[0].trim();
  return first.length > 20 ? first.slice(0, 20) + "…" : first;
}