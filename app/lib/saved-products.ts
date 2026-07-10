export type SavedProductRow = {
  id: string;
  user_id: string;
  title: string;
  price: string;
  source: string;
  image: string;
  link: string;
  store: string | null;
  piece_label: string | null;
  slot: string | null;
  created_at: string;
  price_value?: number | null;
  product_id?: string | null;
  serpapi_product_api?: string | null;
  last_checked_at?: string | null;
  last_notified_price?: number | null;
};

export type SaveProductInput = {
  title: string;
  price: string;
  source: string;
  image: string;
  link: string;
  store?: string;
  piece_label?: string;
  slot?: string;
  price_value?: number | null;
  product_id?: string | null;
  serpapi_immersive_product_api?: string | null;
};

export function formatSavedDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
