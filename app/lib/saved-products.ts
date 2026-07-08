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
};

export function formatSavedDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
