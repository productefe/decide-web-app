import type { PriceMode } from "@/lib/preferences";
import { asLower, asText } from "@/lib/text";
import {
  APPROVED_AFFORDABLE_BRANDS,
  LUXURY_POOL_BRANDS,
  allPoolBrandNames,
  textHasPoolBrand,
} from "@/constants/brandPool";

/** Configurable quality-filter constants (docs/decide-brand-pool.md § kalite filtresi). */
export const QUALITY_CONFIG = {
  supermarketStores: ["migros", "a101", "bim", "şok", "sok market", "sok.com"],
  /** Sellers that must never appear, even when the title carries a pool-brand word. */
  bannedStores: ["sanal çadır", "sanalcadir", "sanal cadir", "sanalçadır"],
  replicaTokens: ["replika", "replica", "muadil", "benzeri", "a kalite", "a-kalite", "1. kalite"],
  maxKeywordPile: 5,
  fillerKeywords: [
    "kadın",
    "erkek",
    "bayan",
    "günlük",
    "yazlık",
    "kışlık",
    "casual",
    "basic",
    "yeni sezon",
    "indirimli",
    "ucuz",
    "trend",
    "şık",
    "rahat",
  ],
  categoryNameTokens: [
    "tişört",
    "tshirt",
    "pantolon",
    "elbise",
    "etek",
    "ayakkabı",
    "çanta",
    "gözlük",
    "mont",
    "ceket",
    "sweatshirt",
    "gömlek",
  ],
  /** TRY floors — hard minimum 200 for every family. */
  minPriceTry: 200,
  minPriceByFamily: {
    tops: 200,
    crop: 200,
    bottoms: 200,
    dress: 200,
    outerwear: 399,
    sneakers: 399,
    shoes_classic: 299,
    bag: 200,
    watch: 299,
    sunglasses: 200,
    activewear: 200,
    accessory: 200,
  } as Record<string, number>,
  luxuryChannels: ["beymen", "vakko", "vakkorama", "network", "twist"],
};

const GARMENT_FILLER_RE = new RegExp(
  `\\b(${QUALITY_CONFIG.fillerKeywords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi"
);

function hay(title: unknown, source: unknown): string {
  return `${asText(title)} ${asText(source)}`.toLocaleLowerCase("tr-TR");
}

function isApprovedCatalogBrand(text: unknown): boolean {
  const t = asLower(text);
  return APPROVED_AFFORDABLE_BRANDS.some((b) => t.includes(b));
}

function looksRandomSeller(source: unknown): boolean {
  const s = asText(source).trim();
  if (!s) return false;
  if (/^[A-Z0-9][A-Z0-9 _-]{12,}$/.test(s) && s === s.toUpperCase()) return true;
  if (/^[a-z]{1,4}\d{3,}$/i.test(s.replace(/\s/g, ""))) return true;
  return false;
}

function keywordPileCount(title: unknown): number {
  const t = asLower(title);
  const hits = t.match(GARMENT_FILLER_RE) || [];
  return new Set(hits.map((h) => asLower(h))).size;
}

function categoryNameCount(title: unknown): number {
  const t = asLower(title);
  return QUALITY_CONFIG.categoryNameTokens.filter((tok) => t.includes(tok)).length;
}

function hasReplica(title: unknown): boolean {
  const t = asLower(title);
  return QUALITY_CONFIG.replicaTokens.some((tok) => t.includes(tok));
}

const POOL_NAMES_LC = allPoolBrandNames()
  .map((b) => b.toLocaleLowerCase("tr-TR"))
  .filter((b) => b.length >= 3);

/**
 * Knockoff signature: "<brand> model / tarzı / stili" in the title means the
 * item merely imitates the brand ("Weppa Bershka Model Crop") — hard reject.
 */
function isBrandKnockoffTitle(title: unknown): boolean {
  const t = asLower(title);
  return POOL_NAMES_LC.some(
    (b) => t.includes(`${b} model`) || t.includes(`${b} tarz`) || t.includes(`${b} stil`)
  );
}

function isSupermarket(source: string, title: string): boolean {
  const t = hay(title, source);
  return QUALITY_CONFIG.supermarketStores.some((s) => t.includes(s));
}

function isLuxuryChannel(source: string, title: string): boolean {
  const t = hay(title, source);
  return QUALITY_CONFIG.luxuryChannels.some((s) => t.includes(s));
}

function priceFloorFor(family: string | undefined): number {
  if (!family) return 0;
  return QUALITY_CONFIG.minPriceByFamily[family] || 0;
}

export type QualityFilterInput = {
  title: string;
  source?: string;
  priceValue?: number;
  priceMode?: PriceMode;
  poolFamily?: string;
};

/**
 * True when the hit should be dropped.
 * Hard rules for everyone: price ≥ 200 TL, no replica, no supermarket.
 * Unnamed / non-pool sellers are dropped — only catalog pool brands (Bershka, Pull&Bear, …) pass.
 */
export function failsQualityFilter(input: QualityFilterInput): boolean {
  const title = input.title || "";
  const source = input.source || "";
  const blob = hay(title, source);

  // Hard-banned sellers bypass every other rule (a "mavi şapka" title would
  // otherwise count as a Mavi-brand catalog hit and let the seller through).
  if (QUALITY_CONFIG.bannedStores.some((s) => blob.includes(s))) return true;

  const catalog = isApprovedCatalogBrand(blob) || textHasPoolBrand(blob);

  if (typeof input.priceValue === "number" && input.priceValue > 0 && input.priceValue < QUALITY_CONFIG.minPriceTry) {
    return true;
  }

  if (hasReplica(title)) return true;
  if (isBrandKnockoffTitle(title)) return true;
  if (isSupermarket(source, title)) return true;

  if (input.priceMode === "luks") {
    const luxuryBrand = textHasPoolBrand(blob, LUXURY_POOL_BRANDS);
    if (!luxuryBrand && !isLuxuryChannel(source, title)) return true;
  }

  const familyFloor = priceFloorFor(input.poolFamily);
  if (familyFloor > QUALITY_CONFIG.minPriceTry && typeof input.priceValue === "number" && input.priceValue > 0 && input.priceValue < familyFloor) {
    return true;
  }

  if (!catalog && !isLuxuryChannel(source, title)) return true;

  if (catalog) return false;

  if (looksRandomSeller(source)) return true;
  if (title.length > 24 && title === title.toUpperCase() && /[A-ZÇĞİÖŞÜ]/.test(title)) return true;
  if (keywordPileCount(title) >= QUALITY_CONFIG.maxKeywordPile) return true;
  if (categoryNameCount(title) >= 3) return true;

  return false;
}
