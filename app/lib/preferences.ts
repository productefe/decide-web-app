export const PREFERENCE_OPTIONS = [
  "Rahatlık & Konfor",
  "Minimalist & Sade",
  "Gösterişli & İddialı",
  "Teknoloji Tutkunu",
  "Spor & Egzersiz",
  "Evcimen",
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
  height: string | null;
  weight: string | null;
  gender: UserGender | null;
  preferences: string[] | null;
};

export function isPreferencesComplete(prefs: UserPreferencesRow | null | undefined): boolean {
  if (!prefs) return false;
  const style = prefs.preferences?.[0];
  return Boolean(prefs.height && prefs.weight && prefs.gender && style);
}
