import type { PriceMode, UserGender } from "@/lib/preferences";
import { LUXURY_POOL_BRANDS, textHasPoolBrand } from "@/constants/brandPool";
import { QUALITY_CONFIG } from "@/lib/qualityFilter";
import {
  FAMILY_CONFLICTS,
  canonColor,
  familyTitleTokens,
} from "./normalize-intent";
import type {
  PieceFamily,
  ProductCandidate,
  ProductIntent,
  SizeStatus,
  VerifiedCandidate,
} from "./schema";

function lower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

const COLOR_CONFLICTS: Record<string, string[]> = {
  siyah: ["beyaz", "sarı", "pembe"],
  beyaz: ["siyah", "lacivert"],
  kırmızı: ["yeşil", "mavi"],
  mavi: ["turuncu", "kırmızı"],
  yeşil: ["kırmızı", "pembe"],
  sarı: ["mor", "lacivert"],
};

const CHILD_TOKENS = ["çocuk", "cocuk", "kids", "bebek", "infant", "junior"];
const MEN_TOKENS = ["erkek", "men", "male", "man "];
const WOMEN_TOKENS = ["kadın", "kadin", "women", "female", "woman", "bayan"];

function titleHasFamily(title: string, family: PieceFamily): boolean {
  const t = lower(title);
  const tokens = familyTitleTokens(family);
  if (tokens.length === 0) return true;
  return tokens.some((tok) => t.includes(lower(tok)));
}

function titleHasConflictFamily(title: string, family: PieceFamily): boolean {
  const conflicts = FAMILY_CONFLICTS[family] || [];
  const t = lower(title);
  for (const c of conflicts) {
    // Only conflict if conflict family tokens present AND target family tokens absent
    const cTokens = familyTitleTokens(c);
    if (cTokens.some((tok) => t.includes(lower(tok))) && !titleHasFamily(title, family)) {
      return true;
    }
  }
  // Jersey hard: tee tokens without forma
  if (family === "jersey") {
    if (/\b(tişört|tisort|t-shirt|tshirt)\b/i.test(title) && !/forma|jersey/i.test(title)) {
      return true;
    }
  }
  return false;
}

function colorConflict(title: string, bodyColor: string): boolean {
  if (!bodyColor || bodyColor === "bilinmeyen") return false;
  const t = lower(title);
  const want = canonColor(bodyColor);
  const conflicts = COLOR_CONFLICTS[want] || [];
  // If title explicitly names a conflicting color and does not name the wanted color → reject
  const hasWant = t.includes(want);
  const hasConflict = conflicts.some((c) => t.includes(c));
  if (hasConflict && !hasWant) return true;
  return false;
}

function genderConflict(
  title: string,
  userGender: UserGender | null,
  intentGender: string
): boolean {
  const t = lower(title);
  if (CHILD_TOKENS.some((c) => t.includes(c))) return true;
  const side =
    userGender ||
    (intentGender === "men" || intentGender === "women" ? intentGender : null);
  if (!side) return false;
  if (side === "men" && WOMEN_TOKENS.some((w) => t.includes(w)) && !MEN_TOKENS.some((m) => t.includes(m))) {
    return true;
  }
  if (side === "women" && MEN_TOKENS.some((m) => t.includes(m)) && !WOMEN_TOKENS.some((w) => t.includes(w))) {
    return true;
  }
  return false;
}

function isReplica(title: string): boolean {
  const t = lower(title);
  return QUALITY_CONFIG.replicaTokens.some((tok) => t.includes(tok));
}

function luxuryOk(title: string, source: string, priceMode: PriceMode): boolean {
  if (priceMode !== "luks") return true;
  const hay = `${title} ${source}`;
  if (textHasPoolBrand(hay, LUXURY_POOL_BRANDS)) return true;
  const t = lower(hay);
  if (QUALITY_CONFIG.luxuryChannels.some((c) => t.includes(c))) return true;
  return LUXURY_POOL_BRANDS.some((b) => t.includes(lower(b)));
}

function inferSizeStatus(title: string, sizes: string[]): SizeStatus {
  if (!sizes.length) return "unknown";
  const t = lower(title);
  // Title mentioning size is only "likely" — never verified without merchant feed
  if (sizes.some((s) => new RegExp(`\\b${s}\\b`, "i").test(t))) return "likely";
  if (/tükendi|stokta yok|out of stock/i.test(t)) return "unavailable";
  return "unknown";
}

export interface VerifyStats {
  total: number;
  kept: number;
  rejects: Record<string, number>;
}

export function hardVerify(
  candidates: ProductCandidate[],
  intent: ProductIntent,
  opts: {
    priceMode: PriceMode;
    gender: UserGender | null;
    sizes: string[];
  }
): { kept: VerifiedCandidate[]; rejected: VerifiedCandidate[]; stats: VerifyStats } {
  const rejects: Record<string, number> = {};
  const kept: VerifiedCandidate[] = [];
  const rejected: VerifiedCandidate[] = [];
  const bump = (reason: string) => {
    rejects[reason] = (rejects[reason] || 0) + 1;
  };

  const seen = new Set<string>();

  for (const c of candidates) {
    const canonUrl = (c.link || "").split("?")[0];
    const dedupeKey = c.product_id || canonUrl || c.id;
    if (seen.has(dedupeKey)) {
      bump("dedupe");
      rejected.push({
        ...c,
        reject_reason: "dedupe",
        size_status: "unknown",
        visual_score: 0,
        meta_score: 0,
        score: 0,
      });
      continue;
    }
    seen.add(dedupeKey);

    let reason: string | null = null;
    if (titleHasConflictFamily(c.title, intent.family)) reason = "family_conflict";
    else if (
      intent.family !== "other" &&
      !titleHasFamily(c.title, intent.family) &&
      c.provider === "shopping"
    ) {
      // Lens can lack type tokens — shopping must match type
      reason = "family_mismatch";
    } else if (colorConflict(c.title, intent.body_color)) reason = "color_conflict";
    else if (genderConflict(c.title, opts.gender, intent.gender)) reason = "gender_conflict";
    else if (isReplica(c.title)) reason = "replica";
    else if (!luxuryOk(c.title, c.source, opts.priceMode)) reason = "luxury_leak";

    if (reason) {
      bump(reason);
      rejected.push({
        ...c,
        reject_reason: reason,
        size_status: "unknown",
        visual_score: 0,
        meta_score: 0,
        score: 0,
      });
      continue;
    }

    kept.push({
      ...c,
      size_status: inferSizeStatus(c.title, opts.sizes),
      visual_score: 0,
      meta_score: 0,
      score: 0,
    });
  }

  return {
    kept,
    rejected,
    stats: { total: candidates.length, kept: kept.length, rejects },
  };
}
