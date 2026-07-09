export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function sanitizeUploadFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || "photo.jpg";
  const safe = base.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  return safe || "photo.jpg";
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Lütfen bir fotoğraf dosyası seç (JPEG, PNG vb.).";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Fotoğraf en fazla 10 MB olabilir.";
  }
  return null;
}
