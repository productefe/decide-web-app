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
    label: "Uygun",
    desc: "Bütçe dostu seçenekler; pahalı ve lüks markalardan kaçın.",
  },
  {
    value: "karma",
    label: "Karma",
    desc: "Hem uygun hem premium alternatifleri karışık getir.",
  },
] as const;

export type PriceMode = (typeof PRICE_MODE_OPTIONS)[number]["value"];

export const OCCASION_OPTIONS = [
  { value: "spor", label: "Spor" },
  { value: "ev", label: "Ev" },
  { value: "aksam", label: "Akşam" },
  { value: "gundelik", label: "Gündelik" },
  { value: "is", label: "İş" },
  { value: "sahil", label: "Sahil" },
] as const;

export type Occasion = (typeof OCCASION_OPTIONS)[number]["value"];

/** Chip layout: top row Spor/Ev/Akşam, bottom row Gündelik/İş. */
export const OCCASION_ROW_VALUES: Occasion[][] = [
  ["spor", "ev", "aksam"],
  ["gundelik", "is", "sahil"],
];

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

const OCCASION_BY_ALIAS: Record<string, Occasion> = {
  spor: "spor",
  sport: "spor",
  gundelik: "gundelik",
  gunluk: "gundelik",
  günlük: "gundelik",
  gündelik: "gundelik",
  casual: "gundelik",
  aksam: "aksam",
  akşam: "aksam",
  evening: "aksam",
  ev: "ev",
  home: "ev",
  lounge: "ev",
  is: "is",
  iş: "is",
  work: "is",
  ofis: "is",
  sahil: "sahil",
  beach: "sahil",
  plaj: "sahil",
};

function occasionToken(raw: unknown): string {
  if (Array.isArray(raw)) return occasionToken(raw[0]);
  if (raw && typeof raw === "object" && "value" in raw) {
    return occasionToken((raw as { value: unknown }).value);
  }
  if (typeof raw !== "string") return "";
  return raw.trim().toLocaleLowerCase("tr-TR");
}

export function parseOccasion(raw: unknown): Occasion | null {
  const v = occasionToken(raw);
  return OCCASION_BY_ALIAS[v] ?? null;
}
