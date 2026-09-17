import type { PiecePage, VerifiedCandidate } from "./schema";
import { imageFingerprint } from "./rank";
import {
  createSession,
  getSession,
  markSeen,
  type SearchSession,
} from "./sessions";
import { canonicalTitle } from "./type-cues";

function normTitle(title: string): string {
  return title.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

export function seedSessionExcludes(session: SearchSession, titles: string[]): void {
  for (const title of titles) {
    if (!title) continue;
    session.seen_titles.add(normTitle(title));
    const canon = canonicalTitle(title);
    if (canon) session.seen_titles.add(canon);
  }
}

function titleAlreadySeen(title: string, session: SearchSession): boolean {
  const n = normTitle(title);
  const canon = canonicalTitle(title);
  if (!n) return false;
  if (session.seen_titles.has(n) || (canon && session.seen_titles.has(canon))) return true;
  for (const seen of session.seen_titles) {
    if (seen.length >= 18 && n.length >= 18 && (n.includes(seen) || seen.includes(n))) {
      return true;
    }
    if (canon && seen.length >= 16 && canon.length >= 16 && (canon === seen || canon.includes(seen) || seen.includes(canon))) {
      return true;
    }
  }
  return false;
}

export function pickPage(
  ranked: VerifiedCandidate[],
  session: SearchSession,
  pageSize = 3
): PiecePage {
  const out: VerifiedCandidate[] = [];
  const pageCanon = new Set<string>();
  for (const c of ranked) {
    if (session.seen_product_ids.has(c.id) || session.seen_product_ids.has(c.product_id || "")) {
      continue;
    }
    if (c.title && titleAlreadySeen(c.title, session)) continue;
    const canon = c.title ? canonicalTitle(c.title) : "";
    if (canon && pageCanon.has(canon)) continue;
    const imgHash = imageFingerprint(c.image);
    if (session.seen_image_hashes.has(imgHash)) continue;
    const url = (c.link || "").split("?")[0];
    if (url && session.seen_urls.has(url)) continue;
    if (typeof c.priceValue === "number" && c.priceValue > 0 && c.priceValue < 200) continue;
    out.push(c);
    if (canon) pageCanon.add(canon);
    if (out.length >= pageSize) break;
  }

  markSeen(session, out);
  for (const p of out) {
    const canon = canonicalTitle(p.title);
    if (canon) session.seen_titles.add(canon);
  }
  session.page += 1;

  return {
    products: out,
    exhausted: out.length === 0,
    page: session.page,
    session_id: session.id,
  };
}

export function ensureSession(opts: {
  sessionId?: string | null;
  intentHash: string;
  pieceKey: string;
}): SearchSession {
  if (opts.sessionId) {
    const existing = getSession(opts.sessionId);
    if (existing && existing.intent_hash === opts.intentHash && existing.piece_key === opts.pieceKey) {
      return existing;
    }
  }
  return createSession(opts.intentHash, opts.pieceKey);
}

/** Uniqueness among up to 12 results across pages. */
export function uniquenessAt12(products: VerifiedCandidate[]): number {
  const ids = new Set(products.slice(0, 12).map((p) => p.product_id || p.id));
  return ids.size;
}
