import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "product-photos";

function storagePathFromPhotoUrl(photoUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const publicIdx = photoUrl.indexOf(marker);
  if (publicIdx !== -1) {
    return decodeURIComponent(photoUrl.slice(publicIdx + marker.length).split("?")[0]);
  }

  const signedMarker = `/object/sign/${BUCKET}/`;
  const signedIdx = photoUrl.indexOf(signedMarker);
  if (signedIdx !== -1) {
    return decodeURIComponent(photoUrl.slice(signedIdx + signedMarker.length).split("?")[0]);
  }

  return null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const type = blob.type || "image/jpeg";
  return `data:${type};base64,${buffer.toString("base64")}`;
}

/** Load photo for OpenAI Vision — avoids OpenAI fetching Supabase URLs directly. */
export async function getVisionImageDataUrl(
  photoUrl: string,
  supabase: SupabaseClient,
  storagePath?: string
): Promise<string> {
  const path = storagePath || storagePathFromPhotoUrl(photoUrl);

  if (path) {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (!error && data) {
      return blobToDataUrl(data);
    }
    console.warn("Supabase storage download failed:", error?.message);
  }

  const res = await fetch(photoUrl);
  if (!res.ok) {
    throw new Error("Fotoğraf okunamadı. Lütfen tekrar yükleyin.");
  }
  return blobToDataUrl(await res.blob());
}
