import type { SupabaseClient } from "@supabase/supabase-js";

export class ApiSecurityError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiSecurityError";
  }
}

export function assertOwnStoragePath(userId: string, storagePath: string | undefined): void {
  if (!storagePath || typeof storagePath !== "string") {
    throw new ApiSecurityError("Fotoğraf bulunamadı.", 400);
  }
  const prefix = `${userId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
    throw new ApiSecurityError("Geçersiz fotoğraf.", 400);
  }
}

export function truncateForPrompt(value: string | undefined, maxLen = 200): string {
  if (!value) return "";
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
}

export async function enforceGuestAnalysisCap(
  supabase: SupabaseClient,
  isAnonymous: boolean
): Promise<void> {
  if (!isAnonymous) return;

  const { data, error } = await supabase.rpc("try_consume_guest_analysis");
  if (error) {
    console.error("try_consume_guest_analysis error:", error.message);
    throw new ApiSecurityError("İstek işlenemedi, lütfen tekrar dene.", 500);
  }
  if (data !== true) {
    throw new ApiSecurityError(
      "Misafir modunda tek analiz hakkın var. Kayıt ol ve sınırsız dene.",
      429
    );
  }
}

export async function enforceRateLimit(
  supabase: SupabaseClient,
  endpoint: string,
  limit: number,
  windowMinutes = 60
): Promise<void> {
  const { data, error } = await supabase.rpc("increment_api_usage", {
    p_endpoint: endpoint,
    p_limit: limit,
    p_window_minutes: windowMinutes,
  });
  if (error) {
    console.error("increment_api_usage error:", error.message);
    throw new ApiSecurityError("İstek işlenemedi, lütfen tekrar dene.", 500);
  }
  if (data !== true) {
    throw new ApiSecurityError(
      "Çok fazla istek gönderdin. Lütfen bir süre sonra tekrar dene.",
      429
    );
  }
}
