import type { PriceMode } from "@/lib/preferences";
import {
  AFFORDABLE_POOL_BRANDS,
  APPROVED_AFFORDABLE_BRANDS,
  LUXURY_POOL_BRANDS,
  normalizeBrandName,
  textHasPoolBrand,
} from "@/constants/brandPool";

/** Configurable quality-filter constants (docs/decide-brand-pool.md § kalite filtresi). */
export const QUALITY_CONFIG = {
  supermarketStores: ["migros", "a101", "bim", "şok", "sok market", "sok.com"],
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
  /** TRY floors — unnamed sellers only; catalog brands are exempt. */
  minPriceByFamily: {
    tops: 99,
    crop: 99,
    bottoms: 199,
    dress: 199,
    outerwear: 399,
    sneakers: 399,
    shoes_classic: 299,
    bag: 199,
    watch: 299,
    sunglasses: 199,
    activewear: 149,
    accessory: 79,
  } as Record<string, number>,
  luxuryChannels: ["beymen", "vakko", "vakkorama", "network", "twist"],
};

const GARMENT_FILLER_RE = new RegExp(
  `\\b(${QUALITY_CONFIG.fillerKeywords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi"
);

function hay(title: string, source: string): string {
  return `${title || ""} ${source || ""}`.toLocaleLowerCase("tr-TR");
}

function isApprovedCatalogBrand(text: string): boolean {
  const t = text.toLocaleLowerCase("tr-TR");
  return APPROVED_AFFORDABLE_BRANDS.some((b) => t.includes(b));
}

function looksRandomSeller(source: string): boolean {
  const s = (source || "").trim();
  if (!s) return false;
  if (/^[A-Z0-9][A-Z0-9 _-]{12,}$/.test(s) && s === s.toUpperCase()) return true;
  if (/^[a-z]{1,4}\d{3,}$/i.test(s.replace(/\s/g, ""))) return true;
  return false;
}

function keywordPileCount(title: string): number {
  const t = title.toLocaleLowerCase("tr-TR");
  const hits = t.match(GARMENT_FILLER_RE) || [];
  return new Set(hits.map((h) => h.toLocaleLowerCase("tr-TR"))).size;
}

function categoryNameCount(title: string): number {
  const t = title.toLocaleLowerCase("tr-TR");
  return QUALITY_CONFIG.categoryNameTokens.filter((tok) => t.includes(tok)).length;
}

function hasReplica(title: string): boolean {
  const t = title.toLocaleLowerCase("tr-TR");
  return QUALITY_CONFIG.replicaTokens.some((tok) => t.includes(tok));
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
 * Approved catalog brands (Koton/LCW/DeFacto/…) skip title-pile / random-seller / price-floor —
 * replica + supermarket + luxury-tier lock still apply.
 */
export function failsQualityFilter(input: QualityFilterInput): boolean {
  const title = input.title || "";
  const source = input.source || "";
  const blob = hay(title, source);
  const catalog = isApprovedCatalogBrand(blob) || textHasPoolBrand(blob);

  if (hasReplica(title)) return true;
  if (isSupermarket(source, title)) return true;

  if (input.priceMode === "luks") {
    const luxuryBrand = textHasPoolBrand(blob, LUXURY_POOL_BRANDS);
    if (!luxuryBrand && !isLuxuryChannel(source, title)) return true;
    if (textHasPoolBrand(blob, AFFORDABLE_POOL_BRANDS) && !luxuryBrand && !isLuxuryChannel(source, title)) {
      return true;
    }
  }

  if (catalog) return false;

  if (looksRandomSeller(source)) return true;
  if (title.length > 24 && title === title.toUpperCase() && /[A-ZÇĞİÖŞÜ]/.test(title)) return true;
  if (keywordPileCount(title) >= QUALITY_CONFIG.maxKeywordPile) return true;
  if (categoryNameCount(title) >= 3) return true;

  const floor = priceFloorFor(input.poolFamily);
  if (floor > 0 && typeof input.priceValue === "number" && input.priceValue > 0 && input.priceValue < floor) {
    return true;
  }

  return false;
}

export { normalizeBrandName };
