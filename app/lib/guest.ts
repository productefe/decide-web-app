import type { PieceResult } from "@/components/analyze/types";
import type { UserGender } from "./preferences";

export const GUEST_PREFS_KEY = "decide_guest_prefs";
export const GUEST_ANALYSIS_USED_KEY = "decide_guest_analysis_used";
export const GUEST_LAST_RESULTS_KEY = "decide_guest_last_results";

export type GuestLastResults = {
  photo_url: string;
  pieces: PieceResult[];
};

export type GuestPrefs = {
  sizes: string[];
  gender: UserGender;
  preferences: string[];
};

export function saveGuestPrefsLocal(prefs: GuestPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(prefs));
}

export function readGuestPrefsLocal(): GuestPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestPrefs;
  } catch {
    return null;
  }
}

export function clearGuestPrefsLocal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_PREFS_KEY);
}

export function isGuestAnalysisUsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_ANALYSIS_USED_KEY) === "1";
}

export function markGuestAnalysisUsed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_ANALYSIS_USED_KEY, "1");
}

export function saveGuestResultsLocal(data: GuestLastResults): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_LAST_RESULTS_KEY, JSON.stringify(data));
}

export function readGuestResultsLocal(): GuestLastResults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_LAST_RESULTS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestLastResults;
  } catch {
    return null;
  }
}

export function clearGuestResultsLocal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_LAST_RESULTS_KEY);
}

export async function mergeGuestPrefsToDb(userId: string): Promise<void> {
  const local = readGuestPrefsLocal();
  if (!local) return;

  const { createClient } = await import("@/utils/supabase/client");
  const supabase = createClient();
  await supabase.from("user_preferences").upsert({
    id: userId,
    sizes: local.sizes,
    gender: local.gender,
    preferences: local.preferences,
  });
  clearGuestPrefsLocal();
}

async function mergeGuestProfileToDb(userId: string, fullName: string): Promise<void> {
  const trimmed = fullName.trim();
  if (!trimmed) return;

  const { createClient } = await import("@/utils/supabase/client");
  const supabase = createClient();
  await supabase.from("profiles").upsert({ id: userId, full_name: trimmed });
}

async function mergeGuestResultsToDb(userId: string): Promise<boolean> {
  const local = readGuestResultsLocal();
  if (!local?.pieces?.length) return false;

  const { createClient } = await import("@/utils/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.from("search_history").insert({
    user_id: userId,
    photo_url: local.photo_url,
    results: { pieces: local.pieces },
  });
  if (!error) {
    clearGuestResultsLocal();
    return true;
  }
  console.error("guest search_history merge error:", error.message);
  return false;
}

/** Kayıt sonrası misafir oturumundaki isim, tercihler ve son analizi hesaba taşır. */
export async function mergeGuestSessionToDb(
  userId: string,
  fullName?: string
): Promise<boolean> {
  if (fullName?.trim()) {
    await mergeGuestProfileToDb(userId, fullName);
  }
  await mergeGuestPrefsToDb(userId);
  return mergeGuestResultsToDb(userId);
}
