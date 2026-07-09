export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export type UserSize = (typeof SIZE_OPTIONS)[number];

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

export type UserPreferencesRow = {
  id: string;
  sizes: string[] | null;
  gender: UserGender | null;
  preferences: string[] | null;
};

export function isPreferencesComplete(prefs: UserPreferencesRow | null | undefined): boolean {
  if (!prefs) return false;
  const style = prefs.preferences?.[0];
  return Boolean(prefs.sizes?.length && prefs.gender && style);
}

export function parseSizes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string" && SIZE_OPTIONS.includes(s as UserSize));
}
