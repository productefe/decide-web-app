import { randomUUID } from "crypto";
import type { VerifiedCandidate } from "./schema";
import { imageFingerprint } from "./rank";

export interface SearchSession {
  id: string;
  intent_hash: string;
  piece_key: string;
  page: number;
  seen_product_ids: Set<string>;
  seen_image_hashes: Set<string>;
  seen_urls: Set<string>;
  provider_cursors: Record<string, number>;
  created_at: number;
}

const store = new Map<string, SearchSession>();
const TTL_MS = 1000 * 60 * 60 * 6;

function sweep() {
  const now = Date.now();
  for (const [id, s] of store) {
    if (now - s.created_at > TTL_MS) store.delete(id);
  }
}

export function createSession(intentHash: string, pieceKey: string): SearchSession {
  sweep();
  const s: SearchSession = {
    id: randomUUID(),
    intent_hash: intentHash,
    piece_key: pieceKey,
    page: 0,
    seen_product_ids: new Set(),
    seen_image_hashes: new Set(),
    seen_urls: new Set(),
    provider_cursors: {},
    created_at: Date.now(),
  };
  store.set(s.id, s);
  return s;
}

export function getSession(id: string): SearchSession | null {
  sweep();
  return store.get(id) || null;
}

export function markSeen(session: SearchSession, products: VerifiedCandidate[]): void {
  for (const p of products) {
    session.seen_product_ids.add(p.id);
    if (p.product_id) session.seen_product_ids.add(p.product_id);
    if (p.image) session.seen_image_hashes.add(imageFingerprint(p.image));
    const canon = (p.link || "").split("?")[0];
    if (canon) session.seen_urls.add(canon);
  }
  store.set(session.id, session);
}

export function serializeSession(session: SearchSession) {
  return {
    id: session.id,
    intent_hash: session.intent_hash,
    piece_key: session.piece_key,
    page: session.page,
    seen_product_ids: Array.from(session.seen_product_ids),
    seen_image_hashes: Array.from(session.seen_image_hashes),
    seen_urls: Array.from(session.seen_urls),
    provider_cursors: session.provider_cursors,
  };
}
