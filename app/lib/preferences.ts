export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export type UserSize = (typeof SIZE_OPTIONS)[number];

/** @deprecated Kept for legacy rows; no longer used in search. */
export const PREFERENCE_OPTIONS = [
  "Rahatlık & Konfor",
  "Minimalist & Sade",
  "Gösterişli & İddialı",
  "Teknoloji Tutkunu",
  "Spor & Egzersiz",
  "Maceracı & Doğa",
  "Lüks & Kalite",
  "Trend & Moda",
] as const;

export const GENDER_OPTIONS = [
  { value: "men", label: "Erkek" },
  { value: "women", label: "Kadın" },
] as const;

export type UserGender = (typeof GENDER_OPTIONS)[number]["value"];

export const PRICE_MODE_OPTIONS = [
  {
    value: "luks",
    label: "Lüks",
    desc: "Premium ve lüks mağazalara odaklan; uygun-ucuz markaları ele.",
  },
  {
    value: "uygunluk",
    label: "Uygun bütçeli",
    desc: "Bütçe dostu seçenekler; pahalı ve lüks markalardan kaçın.",
  },
  {
    value: "karma",
    label: "Karışık dağılım",
    desc: "Hem uygun hem premium alternatifleri karışık getir.",
  },
] as const;

export type PriceMode = (typeof PRICE_MODE_OPTIONS)[number]["value"];

export const OCCASION_OPTIONS = [
  { value: "spor", label: "Spor" },
  { value: "gundelik", label: "Gündelik" },
  { value: "aksam", label: "Akşam çıkmalık" },
] as const;

export type Occasion = (typeof OCCASION_OPTIONS)[number]["value"];

export type UserPreferencesRow = {
  id: string;
  sizes: string[] | null;
  gender: UserGender | null;
  preferences: string[] | null;
  price_mode: PriceMode | null;
};

export function isPreferencesComplete(prefs: UserPreferencesRow | null | undefined): boolean {
  if (!prefs) return false;
  return Boolean(prefs.sizes?.length && prefs.gender && prefs.price_mode);
}

export function parseSizes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string" && SIZE_OPTIONS.includes(s as UserSize));
}

export function parseGender(raw: unknown): UserGender | null {
  if (raw === "men" || raw === "women") return raw;
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "erkek" || v === "male" || v === "man") return "men";
  if (v === "kadın" || v === "kadin" || v === "female" || v === "woman") return "women";
  return null;
}

export function parsePriceMode(raw: unknown): PriceMode | null {
  if (raw === "luks" || raw === "uygunluk" || raw === "karma") return raw;
  return null;
}

export function parseOccasion(raw: unknown): Occasion | null {
  if (raw === "spor" || raw === "gundelik" || raw === "aksam") return raw;
  return null;
}
