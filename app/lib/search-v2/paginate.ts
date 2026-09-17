import type { PiecePage, VerifiedCandidate } from "./schema";
import { imageFingerprint } from "./rank";
import {
  createSession,
  getSession,
  markSeen,
  type SearchSession,
} from "./sessions";

export function pickPage(
  ranked: VerifiedCandidate[],
  session: SearchSession,
  pageSize = 3
): PiecePage {
  const out: VerifiedCandidate[] = [];
  for (const c of ranked) {
    if (session.seen_product_ids.has(c.id) || session.seen_product_ids.has(c.product_id || "")) {
      continue;
    }
    const imgHash = imageFingerprint(c.image);
    if (session.seen_image_hashes.has(imgHash)) continue;
    const canon = (c.link || "").split("?")[0];
    if (canon && session.seen_urls.has(canon)) continue;
    out.push(c);
    if (out.length >= pageSize) break;
  }

  markSeen(session, out);
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
