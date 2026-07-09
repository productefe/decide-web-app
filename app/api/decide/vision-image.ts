import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "product-photos";

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const type = blob.type || "image/jpeg";
  return `data:${type};base64,${buffer.toString("base64")}`;
}

/** Load photo for OpenAI Vision via Supabase Storage only (no arbitrary URL fetch). */
export async function getVisionImageDataUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    console.warn("Supabase storage download failed:", error?.message);
    throw new Error("Fotoğraf okunamadı. Lütfen tekrar yükleyin.");
  }
  return blobToDataUrl(data);
}
