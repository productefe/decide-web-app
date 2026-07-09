const HTTPS_URL = /^https:\/\//i;

/** Allow only https URLs for external links and product images. */
export function safeHttpsUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!HTTPS_URL.test(trimmed)) return null;
  return trimmed;
}
