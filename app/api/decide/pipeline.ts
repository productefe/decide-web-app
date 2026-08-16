import { Product, Results } from "@/components/analyze/types";
import type { Occasion, PriceMode } from "@/lib/preferences";
import {
  pickDecidePoolBrands,
  resolvePoolCategories,
  textHasIconicPoolBrand,
  textHasPoolBrand,
} from "@/constants/brandPool";
import { failsQualityFilter } from "@/lib/qualityFilter";

export interface RequestContext {
  photo_url: string;
  user_id: string;
  user_profile: UserProfile;
}

export interface UserProfile {
  budget_min?: number;
  budget_max?: number;
  preferences?: string[];
  sizes?: string[];
  price_mode?: PriceMode;
  occasion?: Occasion | null;
  gender?: string | null;
  [key: string]: unknown;
}

export interface VisionPattern {
  type: string;
  colors: string[];
  placement: string;
}

export interface ProductProfile extends RequestContext {
  category: string;
  category_tr: string;
  subcategory: string;
  subcategory_tr: string;
  color_tr: string;
  colors: string[];
  secondary_colors: string[];
  fit: string;
  fit_tr: string;
  length: string;
  length_tr: string;
  collar: string;
  collar_tr: string;
  neckline: string;
  sleeve_or_strap: string;
  sleeve_or_strap_tr: string;
  pattern: string;
  pattern_tr: string;
  patterns: VisionPattern[];
  material_impression: string;
  material_tr: string;
  distinctive_details: string[];
  has_logo: boolean;
  style_tags: string[];
  gender: string;
  gender_tr: string;
  search_query: string;
  fallback_query: string;
  core_query: string;
  low_confidence: boolean;
}

export interface MatchSignals {
  category: boolean;
  color: boolean;
  fit: boolean;
  cheaper: boolean;
}

export interface ScoredProduct {
  title: string;
  price: string;
  priceValue: number;
  source: string;
  image: string;
  product_id: string | null;
  serpapi_immersive_product_api: string | null;
  link: string;
  store: string;
  matchScore: number;
  forYouScore: number;
  trustScore: number;
  recommendationScore: number;
  signals: MatchSignals;
}

export interface ScoringResult {
  user_id: string;
  photo_url: string;
  recommended: ScoredProduct | null;
  cheaper: ScoredProduct | null;
  style: ScoredProduct | null;
  pool: ScoredProduct[];
  error?: string;
}

interface SerpShoppingItem {
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  thumbnail?: string;
  product_id?: string;
  serpapi_immersive_product_api?: string;
  product_link?: string;
}

// ---------------------------------------------------------------------------
// Occasion + price mode
// ---------------------------------------------------------------------------

const OCCASION_KEYWORDS: Record<Occasion, string> = {
  spor: "spor athleisure",
  gundelik: "günlük casual",
  aksam: "akşam davet şık",
};

/** @deprecated Prefer getOccasionKeyword. Kept for older callers. */
const STYLE_KEYWORDS: Record<string, string> = {
  "Rahatlık & Konfor": "rahat oversize",
  "Minimalist & Sade": "minimal sade",
  "Gösterişli & İddialı": "iddialı şık",
  "Teknoloji Tutkunu": "modern",
  "Spor & Egzersiz": "spor",
  "Maceracı & Doğa": "outdoor",
  "Lüks & Kalite": "premium",
  "Trend & Moda": "trend",
};

export function getOccasionKeyword(occasion: Occasion | null | undefined): string {
  if (!occasion) return "";
  return OCCASION_KEYWORDS[occasion] || "";
}

export function getStyleKeyword(preferences: string[] | undefined): string {
  if (!preferences?.length) return "";
  return STYLE_KEYWORDS[preferences[0]] || "";
}

const BUDGET_STORES = [
  "lc waikiki",
  "lcw",
  "lc waikiki.com",
  "mavi",
  "defacto",
  "koton",
  "english home",
  "gratis",
  "flo",
  "flo.com",
  "lumberjack",
  "colin's",
  "colins",
  "louis cardin",
  "koton.com",
  "defacto.com",
];

/** Fast fashion + mass marketplaces — blocked in lüks mode. */
const LUKS_BLOCKED_STORES = [
  ...BUDGET_STORES,
  "trendyol",
  "trendyolmilla",
  "trendyol milla",
  "hepsiburada",
  "amazon",
  "amazon.com.tr",
  "n11",
  "n11.com",
  "h&m",
  "hm.com",
  "bershka",
  "pull&bear",
  "pull and bear",
  "stradivarius",
  "zara",
  "mango",
  "gap",
  "uniqlo",
  "decathlon",
  "puma",
  "adidas",
  "nike",
  "newyorker",
  "new yorker",
  "sinsay",
  "reserved",
  "cropp",
];

/** Mid-fashion (not luxury) — boosted in uygunluk, blocked in lüks. */
const MID_FASHION_STORES = [
  "trendyolmilla",
  "trendyol milla",
  "koton",
  "mavi",
  "defacto",
];

const LUXURY_STORES = [
  // TR luxury / premium retailers
  "beymen",
  "beymen.com",
  "beymen club",
  "beymen business",
  "vakko",
  "vakko.com",
  "vakkorama",
  "les benjamins",
  "lesbenjamins",
  "communite",
  "network",
  "network.com.tr",
  "twist",
  "twist.com.tr",
  "matmazel",
  "i pezzi dipinti",
  "ipezzidipinti",
  "derimod",
  "kemal tanca",
  "hotiç",
  "hotic",
  "desa",
  "machka",
  "perspective",
  "yargıcı",
  "yargici",
  "barcin",
  "barçın",
  "boyner",
  "beymen.com.tr",
  // International premium commonly sold in TR
  "massimo dutti",
  "lacoste",
  "tommy hilfiger",
  "hugo boss",
  "sandro",
  "maje",
  "ralph lauren",
  "polo ralph lauren",
  "calvin klein",
  "guess",
  "michael kors",
  "armani",
  "emporio armani",
  "giorgio armani",
  "diesel",
  "liu jo",
  "pinko",
  "coach",
  "karl lagerfeld",
  "ted baker",
  "allsaints",
  "all saints",
  "the kooples",
  "thekooples",
  "isabel marant",
  "acne studios",
  "ami paris",
  "stone island",
  "moncler",
  "canada goose",
  "burberry",
  "gucci",
  "prada",
  "balenciaga",
  "saint laurent",
  "valentino",
  "versace",
  "dolce & gabbana",
  "dolce gabbana",
  "fendi",
  "givenchy",
  "balmain",
  "off-white",
  "off white",
  "alexander mcqueen",
  "bottega veneta",
  "loewe",
  "celine",
  "dior",
  "chanel",
  "hermès",
  "hermes",
  "max mara",
  "brunello cucinelli",
  "loro piana",
  "& other stories",
  "other stories",
  "arket",
  "paul smith",
  "hackett",
  "canali",
  "ermenegildo zegna",
  "zegna",
  "salvatore ferragamo",
  "ferragamo",
  "jimmy choo",
  "manolo blahnik",
  "stuart weitzman",
  "common projects",
  "golden goose",
  "axel arigato",
  // Niche / category specialists also recognized for trust
  "casio",
  "seiko",
  "tissot",
  "swatch",
  "fossil",
  "daniel wellington",
  "garmin",
  "ray-ban",
  "rayban",
  "oakley",
  "new era",
  "new balance",
  "converse",
  "vans",
  "dr. martens",
  "dr martens",
  "birkenstock",
  "veja",
  "eastpak",
  "kipling",
  "ipekyol",
];

/** Stores we explicitly query for in lüks mode (Serp shopping). */
export const LUXURY_SEARCH_STORES = [
  "beymen",
  "vakko",
  "vakkorama",
  "les benjamins",
  "communite",
  "network",
  "twist",
  "machka",
  "yargıcı",
  "boyner",
];

const MASS_MARKET_STORES = [
  "trendyol",
  "trendyolmilla",
  "trendyol milla",
  "hepsiburada",
  "amazon",
  "boyner",
  "zara",
  "mango",
  "h&m",
  "bershka",
  "pull&bear",
  "stradivarius",
  "gap",
  "next",
  "n11",
  "flo",
  "nike",
  "adidas",
  "decathlon",
  "puma",
  "uniqlo",
  "reserved",
  "sinsay",
  "colin's",
  "colins",
  "under armour",
  "new balance",
  "converse",
  "vans",
  "skechers",
  "jack & jones",
  "only",
  "vero moda",
  "ipekyol",
  "oysho",
];

function normalizeStore(source?: string): string {
  return (source || "").toLowerCase().trim();
}

function storeMatches(source: string | undefined, names: string[]): boolean {
  const s = normalizeStore(source);
  if (!s) return false;
  return names.some((raw) => {
    const name = normalizeStore(raw);
    if (!name) return false;

    // "trendyol" must not match "TrendyolMilla"
    if (name === "trendyol" && /trendyol\s*milla|trendyolmilla/.test(s)) {
      return false;
    }

    if (name.length <= 3) {
      const re = new RegExp(
        `(?:^|[^a-z0-9çğıöşü])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9çğıöşü]|$)`,
        "i"
      );
      return re.test(s);
    }

    // Prefer boundary / prefix / domain matches — avoid naive includes("trendyol").
    if (
      s === name ||
      s.startsWith(name + " ") ||
      s.startsWith(name + ".") ||
      s.includes(name + ".com") ||
      s.includes(name + ".com.tr")
    ) {
      return true;
    }

    const re = new RegExp(
      `(^|[^a-z0-9çğıöşü])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9çğıöşü]|$)`,
      "i"
    );
    return re.test(s);
  });
}

export function isBudgetStore(source?: string): boolean {
  return storeMatches(source, BUDGET_STORES);
}

export function isMidFashionStore(source?: string, title?: string): boolean {
  return storeMatches(source, MID_FASHION_STORES) || storeMatches(title, MID_FASHION_STORES);
}

export function isLuxuryStore(source?: string): boolean {
  return storeMatches(source, LUXURY_STORES);
}

export function isLuxuryHit(source?: string, title?: string): boolean {
  return isLuxuryStore(source) || storeMatches(title, LUXURY_STORES);
}

function isLuksBlockedStore(source?: string): boolean {
  return storeMatches(source, LUKS_BLOCKED_STORES);
}

export function allowedByPriceMode(
  source: string | undefined,
  priceMode: PriceMode | undefined,
  title?: string
): boolean {
  const mode = priceMode || "karma";
  if (mode === "luks") {
    // Never show budget / fast-fashion / mass marketplaces in lüks (source or title).
    if (isLuksBlockedStore(source) || storeMatches(title, LUKS_BLOCKED_STORES)) return false;
    return true;
  }
  if (mode === "uygunluk") return !isLuxuryHit(source, title);
  return true;
}

const FIT_TR: Record<string, string> = {
  slim: "slim fit",
  regular: "",
  "regular fit": "",
  oversized: "oversize",
  oversize: "oversize",
  loose: "bol kesim",
  bodycon: "bodycon",
  cropped: "crop",
  crop: "crop",
  "crop top": "crop",
};

function fitToken(fit: string | undefined): string {
  const raw = (fit || "").toLowerCase().trim();
  if (!raw || raw === "none") return "";
  if (raw in FIT_TR) return FIT_TR[raw];
  return raw;
}

function profileTypeBlob(profile: ProductProfile): string {
  return [
    profile.subcategory,
    profile.subcategory_tr,
    profile.category,
    profile.category_tr,
    profile.length,
    profile.length_tr,
    profile.sleeve_or_strap,
    profile.sleeve_or_strap_tr,
    profile.fit,
    profile.fit_tr,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Never relaxed — even when requireType is false.
 * Subcategory empty → apply at category-family level (top must not match dress).
 */
export function contradictsAbsoluteType(title: string, profile: ProductProfile): boolean {
  const t = title.toLowerCase();
  const blob = profileTypeBlob(profile);
  const family = (profile.category || "").toLowerCase();
  const familyTr = (profile.category_tr || "").toLowerCase();

  const isTopFamily =
    family === "top" ||
    familyTr === "üst" ||
    /\b(tişört|t-shirt|tshirt|tee|crop|bluz|blouse|askılı|askili|atlet|tank|gömlek|hoodie|sweatshirt|polo)\b/.test(
      blob
    );
  const isCrop = /\bcrop\b/.test(blob);
  const isAskiliTop =
    isTopFamily && /\b(askılı|askili|spaghetti|thin-strap|ince askı|cami)\b/.test(blob);
  const isDressFamily = family === "dress" || /elbise|dress|jumpsuit|tulum/.test(blob);

  if ((isCrop || isAskiliTop || isTopFamily) && !isDressFamily) {
    if (/\b(elbise|dress|tulum|jumpsuit)\b/.test(t)) return true;
  }

  const length = (profile.length || profile.length_tr || "").toLowerCase();
  if (length === "crop" || isCrop) {
    if (/\b(midi|maxi)\b/.test(t)) return true;
    if (/\b(uzun boy|maxi boy|midi boy|uzun üst|uzun bluz|uzun elbise)\b/.test(t)) return true;
  }
  if (length === "maxi") {
    if (/\b(crop|mini)\b/.test(t) && !/\bmaxi\b/.test(t)) return true;
  }

  return false;
}

/** Hard filter titles that contradict the vision category/fit. */
export function contradictsCategoryFit(
  title: string,
  profile: ProductProfile,
  opts: { requireType?: boolean } = { requireType: true }
): boolean {
  const t = title.toLowerCase();
  const cat = (profile.category || "").toLowerCase();
  const catTr = (profile.category_tr || "").toLowerCase();
  const sub = `${profile.subcategory || ""} ${profile.subcategory_tr || ""}`.toLowerCase();
  const fit = (profile.fit || "").toLowerCase();
  const blob = `${cat} ${catTr} ${sub}`;
  const requireType = opts.requireType !== false;

  const isCrop =
    fit.includes("crop") ||
    cat.includes("crop") ||
    catTr.includes("crop") ||
    sub.includes("crop") ||
    (profile.length || "").toLowerCase() === "crop" ||
    (profile.length_tr || "").toLowerCase() === "crop";

  const isOversize = /\b(oversize|oversized)\b/.test(fit) || /\b(oversize|oversized|bol kesim)\b/.test(blob);

  // --- Eyewear (glasses photo must not become t-shirts) ---
  if (/gözlük|glasses|sunglasses|eyewear|optik/.test(blob)) {
    const isSun = /güneş|sunglass/.test(blob);
    if (requireType) {
      if (isSun && !/\b(güneş gözlüğü|sunglasses?|sun\s*glasses)\b/.test(t) && !/\bgözlük\b/.test(t)) {
        return true;
      }
      if (!/\b(gözlük|güneş gözlüğü|sunglasses?|glasses|eyewear|optik)\b/.test(t)) return true;
    }
    if (
      /\b(tişört|t-?shirt|tshirt|tee|gömlek|pantolon|elbise|sweatshirt|hoodie|ceket|etek|şort|ayakkabı|sneaker|kazak|crop)\b/.test(
        t
      )
    ) {
      return true;
    }
    return false;
  }

  // --- Crop top: only crop ---
  if (isCrop) {
    if (requireType && !/\bcrop\b/.test(t)) return true;
    if (/\b(oversize|oversized|bol kesim|boyfriend)\b/.test(t) && !/\bcrop\b/.test(t)) return true;
    if (/\b(pantolon|etek|elbise|ayakkabı|gözlük|bot|çanta|jean|kot pantolon)\b/.test(t)) return true;
  }

  // --- Oversize fit: only oversize / bol ---
  if (isOversize && !isCrop) {
    const hasOversizeWord =
      /\b(oversize|oversized|bol kesim|boxy|boyfriend|rahat kesim)\b/.test(t) || /\bbol\b/.test(t);
    if (requireType && !hasOversizeWord) {
      return true;
    }
    if (/\b(crop|cropped|slim fit|dar kesim|skinny)\b/.test(t) && !/\b(oversize|oversized)\b/.test(t)) {
      return true;
    }
  }

  // --- Category family rejects ---
  if (/tişört|t-shirt|tshirt|\btee\b/.test(blob) && !isCrop) {
    const wantsAtlet = /\b(atlet|tank\s*top|undershirt)\b/.test(`${fit} ${blob} ${profile.search_query || ""}`);
    const wantsAskili = /\b(askılı|askili|spaghetti|strap)\b/.test(`${fit} ${blob} ${profile.search_query || ""}`);

    if (requireType && !/\b(tişört|t-?shirt|tshirt|tee|t şört|atlet|tank)\b/.test(t)) {
      if (/\b(gömlek|hoodie|sweatshirt|kazak|elbise|pantolon|etek|gözlük|ayakkabı|crop top|polo|yelek)\b/.test(t)) {
        return true;
      }
      if (requireType) return true;
    }
    if (/\b(gözlük|pantolon|etek|elbise|ayakkabı|bot|çanta|hoodie|sweatshirt|gömlek|kazak|yelek|ceket)\b/.test(t)) {
      return true;
    }
    // Atlet / askılı / regular tee mutual exclusion when profile is specific
    if (wantsAtlet && requireType && !/\b(atlet|tank\s*top|undershirt)\b/.test(t)) return true;
    if (wantsAskili && requireType && !/\b(askılı|askili|spaghetti|strap|ip askı)\b/.test(t)) return true;
    if (!wantsAtlet && !wantsAskili && /\b(atlet|tank\s*top)\b/.test(t) && !/\b(tişört|t-?shirt)\b/.test(t)) {
      if (requireType) return true;
    }
  }

  if (/gömlek|shirt/.test(blob) && !/t-shirt|tişört|sweatshirt|polo/.test(blob)) {
    if (requireType && !/\b(gömlek|shirt)\b/.test(t)) return true;
    if (/\b(tişört|t-?shirt|gözlük|pantolon|ayakkabı|hoodie|atlet)\b/.test(t)) return true;
  }

  if (/hoodie|kapüşonlu|sweatshirt/.test(blob)) {
    if (requireType && !/\b(hoodie|sweatshirt|kapüşonlu|sweat)\b/.test(t)) return true;
    if (/\b(gözlük|pantolon|etek|ayakkabı|elbise)\b/.test(t)) return true;
  }

  if ((cat.includes("skirt") || catTr.includes("etek")) && /\b(pantolon|jeans|eşofman|tişört|gözlük)\b/.test(t)) {
    return true;
  }
  if ((cat.includes("jeans") || catTr.includes("kot pantolon")) && /\b(etek|skirt|elbise|tişört|gözlük|ayakkabı)\b/.test(t)) {
    return true;
  }

  // Pants subtypes: chino / jogger / eşofman / wide / skinny
  if (/pantolon|trousers|chino|jogger|eşofman|şort|shorts|tayt|leggings/.test(blob)) {
    if (/\b(etek|elbise|tişört|gözlük|ayakkabı|crop|gömlek)\b/.test(t) && !/şort|shorts/.test(blob)) {
      return true;
    }
    const wantsChino = /chino/.test(blob);
    const wantsJogger = /jogger|eşofman/.test(blob);
    const wantsJeans = /kot|jeans|denim/.test(blob);
    const wantsWide = /\b(wide|bol paça|wide[- ]?leg|palazzo)\b/.test(`${fit} ${blob} ${profile.search_query || ""}`);
    const wantsSkinny = /\b(skinny|dar paça|slim)\b/.test(`${fit} ${blob} ${profile.search_query || ""}`);
    if (wantsChino && requireType && !/\b(chino|gabardin)\b/.test(t) && /\b(jogger|eşofman|kot|jean)\b/.test(t)) {
      return true;
    }
    if (wantsJogger && requireType && !/\b(jogger|eşofman|sweatpants)\b/.test(t) && /\b(chino|kot|jean|klasik pantolon)\b/.test(t)) {
      return true;
    }
    if (wantsJeans && requireType && !/\b(kot|jean|denim)\b/.test(t) && /\b(chino|jogger|eşofman)\b/.test(t)) {
      return true;
    }
    if (wantsWide && wantsSkinny === false && /\b(skinny|dar paça|dar kesim)\b/.test(t) && !/\b(wide|bol paça|wide[- ]?leg)\b/.test(t)) {
      return true;
    }
    if (wantsSkinny && !wantsWide && /\b(wide|bol paça|wide[- ]?leg|palazzo)\b/.test(t) && !/\b(skinny|dar)\b/.test(t)) {
      return true;
    }
  }

  if ((cat.includes("sneaker") || catTr.includes("spor ayakkabı") || /ayakkabı|boot|sandal|loafer/.test(blob))) {
    if (/\b(tişört|pantolon|gözlük|elbise|etek|gömlek)\b/.test(t)) return true;
    if (requireType && /sneaker|spor ayakkabı/.test(blob) && !/\b(spor ayakkabı|sneaker|sneakers|koşu)\b/.test(t)) {
      return true;
    }
  }
  if (/çanta|bag|handbag|backpack/.test(blob)) {
    if (requireType && !/\b(çanta|bag|handbag|backpack|sırt çantası|clutch|tote)\b/.test(t)) return true;
    if (
      /\b(tişört|t-?shirt|gömlek|pantolon|gözlük|ayakkabı|elbise|etek|hoodie|sweatshirt|kazak|şort|ceket|crop)\b/.test(
        t
      )
    ) {
      return true;
    }
    return false;
  }

  if (/şapka|hat|cap|beanie|bere/.test(blob)) {
    if (requireType && !/\b(şapka|hat|cap|beanie|bere|bucket)\b/.test(t)) return true;
    if (
      /\b(tişört|t-?shirt|gömlek|pantolon|gözlük|ayakkabı|elbise|etek|hoodie|sweatshirt|çanta|kemer)\b/.test(
        t
      )
    ) {
      return true;
    }
    return false;
  }

  if (/kemer|belt/.test(blob)) {
    if (requireType && !/\b(kemer|belt)\b/.test(t)) return true;
    if (
      /\b(tişört|t-?shirt|gömlek|pantolon|gözlük|ayakkabı|elbise|hoodie|çanta|şapka)\b/.test(t)
    ) {
      return true;
    }
    return false;
  }

  if (/saat|watch|wrist/.test(blob)) {
    // Cufflinks / "saat desenli kol düğmesi" must never pass as watches
    if (
      /\b(kol\s*düğme|kol dugme|cuff\s*link|cufflink|düğme|dugme|button\s*cover|kolon\s*düğme)\b/.test(t)
    ) {
      return true;
    }
    if (/\b(saat\s*desen|watch\s*print|watch\s*pattern)\b/.test(t) && !/\b(kol\s*saati|wristwatch|wrist\s*watch)\b/.test(t)) {
      return true;
    }
    if (requireType && !/\b(saat|watch|wristwatch|kol saati|akıllı saat|smartwatch)\b/.test(t)) return true;
    // Must look like a wearable timepiece, not jewelry-adjacent noise without watch cue
    if (
      /\b(tişört|t-?shirt|gömlek|pantolon|gözlük|ayakkabı|elbise|hoodie|çanta|şapka|kemer|yelek|ceket)\b/.test(
        t
      )
    ) {
      return true;
    }
    return false;
  }

  if (/elbise|dress/.test(blob)) {
    if (requireType && !/\b(elbise|dress)\b/.test(t)) return true;
    if (/\b(tişört|pantolon|gözlük|erkek pantolon)\b/.test(t)) return true;
  }

  return false;
}

/** Hard filter opposite-gender products (Turkish-safe; avoid JS \\b with ı/ğ/ü…). */
const WOMEN_GENDER_TOKENS = [
  "kadın",
  "kadin",
  "bayan",
  "women",
  "woman",
  "women's",
  "womens",
  "ladies",
  "kız",
  "kiz",
  "hanım",
  "hanim",
  "female",
];

const MEN_GENDER_TOKENS = [
  "erkek",
  "men",
  "man's",
  "mens",
  "men's",
  "male",
  "oğlan",
  "oglan",
];

function normalizeTr(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match whole tokens without relying on \\b (broken for Turkish letters). */
function titleHasGenderToken(title: string, tokens: string[]): boolean {
  const t = normalizeTr(title);
  return tokens.some((raw) => {
    const tok = normalizeTr(raw);
    if (!tok) return false;
    // Always use letter-boundaries — never plain includes("men's") which matches inside "women's".
    if (tok.includes(" ")) return t.includes(tok);
    const re = new RegExp(`(^|[^a-z0-9çğıöşü])${escapeRegExp(tok)}([^a-z0-9çğıöşü]|$)`, "i");
    return re.test(t);
  });
}

export function parseUserGender(raw: unknown): "men" | "women" | null {
  if (raw === "men" || raw === "women") return raw;
  if (typeof raw !== "string") return null;
  const v = normalizeTr(raw.trim());
  if (v === "erkek" || v === "male" || v === "man") return "men";
  if (v === "kadın" || v === "kadin" || v === "female" || v === "woman") return "women";
  return null;
}

export function profileGenderSide(profile: ProductProfile): "men" | "women" | null {
  const fromProfile = parseUserGender(profile.gender) || parseUserGender(profile.gender_tr);
  if (fromProfile) return fromProfile;
  const fromPrefs = parseUserGender(profile.user_profile?.gender as string | undefined);
  return fromPrefs;
}

export function contradictsGender(title: string, profile: ProductProfile): boolean {
  const side = profileGenderSide(profile);
  if (!side) return false;

  if (side === "men") {
    // Explicit women marking → reject (even if "erkek" somehow also present)
    if (titleHasGenderToken(title, WOMEN_GENDER_TOKENS)) return true;
    return false;
  }

  // women: reject explicit men marking unless also clearly women
  if (titleHasGenderToken(title, MEN_GENDER_TOKENS) && !titleHasGenderToken(title, WOMEN_GENDER_TOKENS)) {
    return true;
  }
  return false;
}

export function titleMatchesUserGender(title: string, profile: ProductProfile): boolean {
  const side = profileGenderSide(profile);
  if (!side) return false;
  return side === "men"
    ? titleHasGenderToken(title, MEN_GENDER_TOKENS)
    : titleHasGenderToken(title, WOMEN_GENDER_TOKENS);
}

/** Hard-exclude kids / baby products from adult fashion results. */
const KIDS_TOKENS = [
  "çocuk",
  "cocuk",
  "kids",
  "kid",
  "kid's",
  "kids'",
  "bebek",
  "baby",
  "junior",
  "toddler",
  "infant",
  "okul öncesi",
  "okuloncesi",
  "yenidoğan",
  "yenidogan",
  "kız çocuk",
  "kiz cocuk",
  "erkek çocuk",
  "erkek cocuk",
  "çocuklar",
  "cocuklar",
  "0-1 yaş",
  "1-2 yaş",
  "2-3 yaş",
  "3-4 yaş",
  "4-5 yaş",
  "5-6 yaş",
  "6-7 yaş",
  "7-8 yaş",
  "8-9 yaş",
  "9-10 yaş",
  "10-11 yaş",
  "11-12 yaş",
  "12-13 yaş",
  "13-14 yaş",
];

export function isKidsProduct(title: string | undefined): boolean {
  if (!title) return false;
  const t = normalizeTr(title);
  if (titleHasGenderToken(title, KIDS_TOKENS)) return true;
  // Age ranges like "2-3 Yaş" / "2-3 yas"
  if (/\b\d{1,2}\s*[-–]\s*\d{1,2}\s*ya[sş]\b/i.test(t)) return true;
  if (/\b(yaş|yas)\s*\d{1,2}\b/i.test(t) && /\b(çocuk|cocuk|bebek|kids|junior)\b/i.test(t)) return true;
  return false;
}

export function titleMatchesCategory(title: string, profile: ProductProfile): boolean {
  const t = normalizeTr(title);
  const catTr = normalizeTr(profile.category_tr || "");
  const cat = normalizeTr(profile.category || "");
  const subTr = normalizeTr(profile.subcategory_tr || "");
  const sub = normalizeTr(profile.subcategory || "");
  if (subTr && t.includes(subTr)) return true;
  if (catTr && t.includes(catTr)) return true;

  const aliases: string[] = [];
  const blob = `${cat} ${catTr} ${sub} ${subTr}`;
  if (/gözlük|glasses|sunglasses|eyewear/.test(blob)) {
    aliases.push("gözlük", "güneş gözlüğü", "sunglasses", "glasses", "eyewear");
  } else if (/kolye|necklace|pendant/.test(blob)) {
    aliases.push("kolye", "necklace", "pendant");
  } else if (/küpe|kupe|earring/.test(blob)) {
    aliases.push("küpe", "earring");
  } else if (/bileklik|bracelet/.test(blob)) {
    aliases.push("bileklik", "bracelet");
  } else if (/kemer|belt/.test(blob)) {
    aliases.push("kemer", "belt");
  } else if (/çanta|bag|clutch|backpack|tote/.test(blob)) {
    aliases.push("çanta", "bag", "clutch", "sırt çantası", "backpack", "tote");
  } else if (/saat|watch/.test(blob)) {
    aliases.push("saat", "watch");
  } else if (/şapka|hat|bere|beanie|cap/.test(blob)) {
    aliases.push("şapka", "hat", "bere", "beanie", "cap");
  } else if (/atkı|scarf/.test(blob)) {
    aliases.push("atkı", "scarf");
  } else if (/crop/.test(blob)) {
    aliases.push("crop top", "crop");
  } else if (/bluz|blouse/.test(blob)) {
    aliases.push("bluz", "blouse");
  } else if (/askılı|askili|cami|spaghetti/.test(blob)) {
    aliases.push("askılı", "askılı üst", "crop top");
  } else if (/tişört|t-shirt|tshirt|tee/.test(blob)) {
    aliases.push("tişört", "t-shirt", "tshirt", "tee");
  } else if (/gömlek/.test(blob) || (cat === "shirt" && !/t-shirt/.test(cat))) {
    aliases.push("gömlek", "shirt");
  } else if (/hoodie|sweatshirt|kapüşonlu/.test(blob)) {
    aliases.push("hoodie", "sweatshirt", "kapüşonlu");
  } else if (/kot pantolon|jeans/.test(blob)) {
    aliases.push("kot", "jean", "denim");
  } else if (/spor ayakkabı|sneaker/.test(blob)) {
    aliases.push("spor ayakkabı", "sneaker", "sneakers");
  }
  return aliases.some((a) => t.includes(normalizeTr(a)));
}

export function buildShortReason(
  signals: MatchSignals,
  slot: "recommended" | "cheaper" | "style",
  profile?: ProductProfile
): string {
  const color = (profile?.color_tr || "").trim();
  const fit = (profile?.fit_tr || "").trim();
  const category = (profile?.category_tr || "").trim();
  const gender = (profile?.gender_tr || "").trim();

  const lookParts = [color, fit, category].filter(Boolean);
  const look = lookParts.join(" ");

  if (slot === "cheaper" || signals.cheaper) {
    if (look) return `Daha uygun fiyat · ${look}`;
    return "Daha uygun fiyat";
  }

  if (look && gender) return `${look} · ${gender}`;
  if (look && signals.fit) return `${look} · benzer kesim`;
  if (look && signals.color) return `${look} · benzer renk`;
  if (look) return look;
  if (signals.fit) return "Benzer kesim";
  if (signals.color) return "Benzer renk";
  if (signals.category && category) return category;
  if (signals.category) return "Aynı tür";
  return gender ? `Benzer stil · ${gender}` : "Benzer stil";
}

/** Type token: subcategory if present, else category. Empty → low confidence. */
export function typeTokenTr(profile: Pick<ProductProfile, "subcategory_tr" | "category_tr">): string {
  return (profile.subcategory_tr || profile.category_tr || "").trim();
}

function uniqueJoin(parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const token = (raw || "").trim();
    if (!token) continue;
    const key = token.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function strapInCore(strapTr: string): string {
  if (!strapTr) return "";
  if (/askı|straplez|kolsuz|halter/.test(strapTr.toLowerCase())) return strapTr;
  return "";
}

function patternQueryTokens(profile: ProductProfile): string[] {
  const tokens: string[] = [];
  for (const p of profile.patterns || []) {
    const typeTr = translatePattern(p.type);
    if (!typeTr) continue;
    const placeTr = translatePlacement(p.placement);
    tokens.push(placeTr ? `${placeTr} ${typeTr}` : typeTr);
    if (tokens.length >= 2) break;
  }
  if (!tokens.length && profile.pattern_tr) tokens.push(profile.pattern_tr);
  return tokens;
}

function detailQueryTokens(details: string[]): string[] {
  return details
    .slice(0, 2)
    .map((d) =>
      d
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .join(" ")
    )
    .filter((d) => d.length >= 4);
}

export function rebuildProfileQueries(profile: ProductProfile): ProductProfile {
  const type = typeTokenTr(profile);
  const low_confidence = !type;
  if (low_confidence) {
    return {
      ...profile,
      low_confidence: true,
      core_query: "",
      search_query: "",
      fallback_query: "",
    };
  }

  const lengthTr =
    profile.length_tr && !type.toLowerCase().includes(profile.length_tr.toLowerCase())
      ? profile.length_tr
      : "";
  const core = uniqueJoin([
    profile.gender_tr,
    strapInCore(profile.sleeve_or_strap_tr),
    lengthTr,
    profile.fit_tr,
    type,
  ]);
  const strong = uniqueJoin([
    core,
    profile.color_tr,
    profile.collar_tr,
    profile.sleeve_or_strap_tr && !strapInCore(profile.sleeve_or_strap_tr)
      ? profile.sleeve_or_strap_tr
      : "",
    ...patternQueryTokens(profile),
  ]);
  const soft = uniqueJoin([
    strong,
    profile.material_tr,
    profile.secondary_colors[0] || "",
    ...detailQueryTokens(profile.distinctive_details),
  ]);

  return {
    ...profile,
    low_confidence: false,
    core_query: core,
    search_query: soft,
    fallback_query: core,
  };
}

/** Override vision gender with user-stated gender and rebuild search queries. */
export function applyUserGender(
  profile: ProductProfile,
  gender: string | null | undefined
): ProductProfile {
  const parsed = parseUserGender(gender);
  if (!parsed) return profile;

  const gender_tr = parsed === "women" ? "kadın" : "erkek";
  return rebuildProfileQueries({
    ...profile,
    gender: parsed,
    gender_tr,
    user_profile: {
      ...profile.user_profile,
      gender: parsed,
    },
  });
}

/** Check if product title mentions one of the user's preferred sizes (soft match). */
export function titleMatchesUserSize(title: string, sizes: string[]): boolean {
  if (!sizes.length) return false;
  const ordered = [...sizes].sort((a, b) => b.length - a.length);
  for (const size of ordered) {
    const escaped = size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = size.length <= 2
      ? new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i")
      : new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)|${escaped}`, "i");
    if (pattern.test(title)) return true;
  }
  return false;
}

export function getSizeMatchBoost(title: string, sizes: string[] | undefined): number {
  if (!sizes?.length) return 0;
  return titleMatchesUserSize(title, sizes) ? 15 : 0;
}

// ---------------------------------------------------------------------------
// Parse Vision (v2 schema; v1 colors/pattern/collar/gender still accepted)
// ---------------------------------------------------------------------------

const FAMILY_TR: Record<string, string> = {
  top: "üst",
  bottom: "alt",
  dress: "elbise",
  outerwear: "dış giyim",
  shoes: "ayakkabı",
  bag: "çanta",
  hat: "şapka",
  eyewear: "gözlük",
  accessory: "aksesuar",
};

const FAMILIES = new Set(Object.keys(FAMILY_TR));

const colorTR: Record<string, string> = {
  red: "kırmızı", blue: "mavi", black: "siyah", white: "beyaz",
  green: "yeşil", yellow: "sarı", pink: "pembe", orange: "turuncu",
  purple: "mor", brown: "kahverengi", grey: "gri", gray: "gri",
  navy: "lacivert", beige: "bej", burgundy: "bordo", cream: "krem",
  gold: "altın", silver: "gümüş", turquoise: "turkuaz",
  teal: "yeşil", olive: "haki", khaki: "haki", indigo: "lacivert",
  coral: "mercan", mint: "mint", lavender: "lavanta",
  maroon: "bordo", cyan: "turkuaz", lime: "yeşil",
  magenta: "fuşya", violet: "mor", rose: "pembe",
  tan: "bej", camel: "camel", mustard: "hardal", rust: "kiremit",
  kırmızı: "kırmızı", mavi: "mavi", siyah: "siyah", beyaz: "beyaz",
  yeşil: "yeşil", sarı: "sarı", pembe: "pembe", turuncu: "turuncu",
  mor: "mor", kahverengi: "kahverengi", gri: "gri",
};

const categoryTR: Record<string, string> = {
  "t-shirt": "tişört", tshirt: "tişört", tee: "tişört",
  "crop top": "crop top", croptop: "crop top", crop: "crop top",
  shirt: "gömlek", polo: "polo tişört", "polo shirt": "polo tişört",
  hoodie: "kapüşonlu sweatshirt", sweatshirt: "sweatshirt",
  jacket: "ceket", "bomber jacket": "bomber ceket", "denim jacket": "kot ceket",
  "trench coat": "trençkot", coat: "kaban", blazer: "blazer", vest: "yelek",
  cardigan: "hırka", sweater: "kazak", knitwear: "triko",
  dress: "elbise", skirt: "etek", jumpsuit: "tulum",
  pants: "pantolon", trousers: "pantolon", chinos: "chino pantolon",
  chino: "chino pantolon", jeans: "kot pantolon", denim: "kot pantolon",
  shorts: "şort", "cargo pants": "kargo pantolon", joggers: "jogger pantolon",
  sweatpants: "eşofman altı", leggings: "tayt", tracksuit: "eşofman",
  sneaker: "spor ayakkabı", sneakers: "spor ayakkabı", "running shoe": "koşu ayakkabısı",
  boot: "bot", sandal: "sandalet", loafer: "loafer",
  "high heel": "topuklu ayakkabı", oxford: "oxford ayakkabı",
  bag: "çanta", handbag: "el çantası", backpack: "sırt çantası",
  hat: "şapka", cap: "şapka", beanie: "bere",
  scarf: "atkı", belt: "kemer", wallet: "cüzdan",
  glasses: "gözlük", sunglasses: "güneş gözlüğü", eyewear: "gözlük",
  "sun glasses": "güneş gözlüğü", "güneş gözlüğü": "güneş gözlüğü",
  gözlük: "gözlük", watch: "saat", "wrist watch": "saat",
  top: "üst", bottom: "alt", outerwear: "dış giyim", shoes: "ayakkabı",
  accessory: "aksesuar",
};

const subcategoryTR: Record<string, string> = {
  "t-shirt": "tişört",
  tshirt: "tişört",
  tee: "tişört",
  tişört: "tişört",
  "crop-top": "crop top",
  "crop top": "crop top",
  croptop: "crop top",
  crop: "crop top",
  blouse: "bluz",
  bluz: "bluz",
  "askili-ust": "askılı üst",
  "askılı üst": "askılı üst",
  "askılı": "askılı üst",
  cami: "askılı üst",
  "cami top": "askılı üst",
  "spaghetti strap": "askılı üst",
  "tank-top": "atlet",
  "tank top": "atlet",
  tank: "atlet",
  atlet: "atlet",
  polo: "polo tişört",
  "polo shirt": "polo tişört",
  shirt: "gömlek",
  gömlek: "gömlek",
  hoodie: "kapüşonlu sweatshirt",
  sweatshirt: "sweatshirt",
  sweater: "kazak",
  cardigan: "hırka",
  jacket: "ceket",
  coat: "kaban",
  blazer: "blazer",
  jeans: "kot pantolon",
  trousers: "pantolon",
  pants: "pantolon",
  shorts: "şort",
  skirt: "etek",
  dress: "elbise",
  elbise: "elbise",
  jumpsuit: "tulum",
  sneaker: "spor ayakkabı",
  sneakers: "spor ayakkabı",
  boot: "bot",
  sandal: "sandalet",
  bag: "çanta",
  hat: "şapka",
  glasses: "gözlük",
  sunglasses: "güneş gözlüğü",
  watch: "saat",
  belt: "kemer",
  scarf: "atkı",
};

const SUBCATEGORY_TO_FAMILY: Record<string, string> = {
  "t-shirt": "top",
  "crop-top": "top",
  blouse: "top",
  "askili-ust": "top",
  "tank-top": "top",
  polo: "top",
  shirt: "top",
  hoodie: "top",
  sweatshirt: "top",
  sweater: "top",
  cardigan: "top",
  jacket: "outerwear",
  coat: "outerwear",
  blazer: "outerwear",
  jeans: "bottom",
  trousers: "bottom",
  pants: "bottom",
  shorts: "bottom",
  skirt: "bottom",
  dress: "dress",
  jumpsuit: "dress",
  sneaker: "shoes",
  sneakers: "shoes",
  boot: "shoes",
  sandal: "shoes",
  bag: "bag",
  hat: "hat",
  glasses: "eyewear",
  sunglasses: "eyewear",
  watch: "accessory",
  belt: "accessory",
  scarf: "accessory",
};

const lengthTR: Record<string, string> = {
  crop: "crop",
  cropped: "crop",
  normal: "",
  regular: "",
  uzun: "uzun",
  long: "uzun",
  midi: "midi",
  maxi: "maxi",
  mini: "mini",
  none: "",
};

const necklineTR: Record<string, string> = {
  "v-neck": "v yaka",
  "v neck": "v yaka",
  "crew-neck": "bisiklet yaka",
  "crew neck": "bisiklet yaka",
  crewneck: "bisiklet yaka",
  "round neck": "bisiklet yaka",
  polo: "polo yaka",
  "polo collar": "polo yaka",
  turtleneck: "boğazlı",
  "mock neck": "yarım boğazlı",
  halter: "halter yaka",
  square: "kare yaka",
  strapless: "straplez",
  collar: "yakalı",
  "button down": "düğmeli yaka",
  none: "",
};

const strapTR: Record<string, string> = {
  "short-sleeve": "kısa kol",
  "short sleeve": "kısa kol",
  "long-sleeve": "uzun kol",
  "long sleeve": "uzun kol",
  sleeveless: "kolsuz",
  "thin-strap": "ince askılı",
  "thin strap": "ince askılı",
  spaghetti: "ince askılı",
  "thick-strap": "kalın askılı",
  "thick strap": "kalın askılı",
  strapless: "straplez",
  none: "",
};

const patternTR: Record<string, string> = {
  striped: "çizgili",
  stripes: "çizgili",
  floral: "çiçekli",
  checkered: "ekoseli",
  plaid: "ekoseli",
  graphic: "baskılı",
  print: "baskılı",
  printed: "baskılı",
  logo: "logolu",
  batik: "batik",
  plain: "",
  none: "",
};

const placementTR: Record<string, string> = {
  chest: "göğüs",
  göğüs: "göğüs",
  shoulder: "omuz",
  omuz: "omuz",
  sleeve: "kol",
  kol: "kol",
  hem: "paça",
  "all-over": "",
  allover: "",
  genel: "",
  none: "",
};

const materialTR: Record<string, string> = {
  cotton: "pamuklu",
  pamuklu: "pamuklu",
  knit: "triko",
  triko: "triko",
  denim: "denim",
  satin: "saten",
  saten: "saten",
  "leather-look": "deri görünümlü",
  leather: "deri",
  linen: "keten",
  keten: "keten",
  none: "",
};

const genderTR: Record<string, string> = { men: "erkek", women: "kadın", unisex: "" };

const collarTR = necklineTR;

function canonKey(raw: string | undefined): string {
  return (raw || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");
}

function lookupTr(map: Record<string, string>, raw: string | undefined): string {
  const key = canonKey(raw);
  if (!key || key === "none") return "";
  if (key in map) return map[key];
  const dashed = key.replace(/ /g, "-");
  if (dashed in map) return map[dashed];
  const spaced = key.replace(/-/g, " ");
  if (spaced in map) return map[spaced];
  return "";
}

function translateColor(raw: string | undefined): string {
  const key = canonKey(raw);
  if (!key) return "";
  return colorTR[key] || raw!.trim();
}

function translatePattern(raw: string | undefined): string {
  return lookupTr(patternTR, raw);
}

function translatePlacement(raw: string | undefined): string {
  return lookupTr(placementTR, raw);
}

function canonicalSubcategory(raw: string): string {
  const key = canonKey(raw);
  if (!key) return "";
  if (key === "crop" || key === "crop top" || key === "croptop") return "crop-top";
  if (key === "tshirt" || key === "tee" || key === "tişört" || key === "t-shirt") return "t-shirt";
  if (key === "bluz") return "blouse";
  if (key.includes("askı") || key === "cami" || key === "cami top" || key.includes("spaghetti")) {
    return "askili-ust";
  }
  if (key === "tank" || key === "tank top" || key === "atlet") return "tank-top";
  if (SUBCATEGORY_TO_FAMILY[key]) return key;
  if (SUBCATEGORY_TO_FAMILY[key.replace(/ /g, "-")]) return key.replace(/ /g, "-");
  return key;
}

function inferFamily(sub: string, cat: string): string {
  if (FAMILIES.has(cat)) return cat;
  if (SUBCATEGORY_TO_FAMILY[sub]) return SUBCATEGORY_TO_FAMILY[sub];
  const blob = `${sub} ${cat}`.toLowerCase();
  if (/elbise|dress|jumpsuit|tulum/.test(blob)) return "dress";
  if (/crop|tişört|t-shirt|bluz|askı|gömlek|hoodie|sweat|polo|tank/.test(blob)) return "top";
  if (/pantolon|jean|etek|şort|short|tayt/.test(blob)) return "bottom";
  if (/ayakkabı|sneaker|bot|sandal/.test(blob)) return "shoes";
  if (/çanta|bag/.test(blob)) return "bag";
  if (/gözlük|glasses/.test(blob)) return "eyewear";
  if (/şapka|hat|bere/.test(blob)) return "hat";
  if (/ceket|jacket|kaban|coat|blazer/.test(blob)) return "outerwear";
  return cat;
}

function splitCategoryFields(
  rawCategory: string,
  rawSubcategory: string
): { category: string; subcategory: string } {
  const subCanon = canonicalSubcategory(rawSubcategory);
  const catCanon = canonKey(rawCategory);

  if (subCanon) {
    const family = inferFamily(subCanon, FAMILIES.has(catCanon) ? catCanon : "");
    return { category: family, subcategory: subCanon };
  }

  if (FAMILIES.has(catCanon)) {
    return { category: catCanon, subcategory: "" };
  }

  if (catCanon) {
    const asSub = canonicalSubcategory(catCanon);
    const family = inferFamily(asSub, "");
    return { category: family || catCanon, subcategory: asSub };
  }

  return { category: "", subcategory: "" };
}

interface VisionProduct {
  label?: string;
  category?: string;
  subcategory?: string;
  colors?: string[];
  primary_color?: string;
  secondary_colors?: string[];
  fit?: string;
  silhouette_fit?: string;
  length?: string;
  collar?: string;
  neckline?: string;
  sleeve_or_strap?: string;
  pattern?: string;
  patterns?: VisionPattern[];
  material_impression?: string;
  gender_presentation?: string;
  distinctive_details?: string[];
  has_logo?: boolean;
  style_tags?: string[];
  gender?: string;
}

function normalizePatterns(product: VisionProduct, hasLogo: boolean): VisionPattern[] {
  if (Array.isArray(product.patterns) && product.patterns.length > 0) {
    return product.patterns
      .map((p) => ({
        type: canonKey(p?.type),
        colors: Array.isArray(p?.colors) ? p.colors.filter(Boolean) : [],
        placement: canonKey(p?.placement),
      }))
      .filter((p) => p.type && p.type !== "plain" && p.type !== "none");
  }
  const single = canonKey(product.pattern);
  const out: VisionPattern[] = [];
  if (single && single !== "plain" && single !== "none") {
    out.push({ type: single, colors: [], placement: "all-over" });
  }
  if (hasLogo && !out.some((p) => p.type === "logo")) {
    out.push({ type: "logo", colors: [], placement: "chest" });
  }
  return out;
}

function visionProductToProfile(product: VisionProduct, ctx: RequestContext): ProductProfile {
  const { category: family, subcategory } = splitCategoryFields(
    product.category || "",
    product.subcategory || ""
  );

  const primaryRaw = product.primary_color || (product.colors || [])[0] || "";
  const secondaryRaw = (
    product.secondary_colors?.length
      ? product.secondary_colors
      : (product.colors || []).slice(1)
  ).filter(Boolean);

  const hasLogo = product.has_logo === true;
  const patterns = normalizePatterns(product, hasLogo);
  const silhouette = product.silhouette_fit || product.fit || "";
  const neckline = product.neckline || product.collar || "";
  const genderRaw = product.gender_presentation || product.gender || "";

  const color = translateColor(primaryRaw);
  const secondary_colors = secondaryRaw.map(translateColor).filter(Boolean);
  const subcategory_tr = lookupTr(subcategoryTR, subcategory) || subcategoryTR[subcategory] || "";
  const category_tr =
    FAMILY_TR[family] ||
    lookupTr(categoryTR, family) ||
    lookupTr(categoryTR, product.category) ||
    "";
  // If we only have a family name like "üst", prefer a more specific leftover category_tr from v1 maps
  const typeTr = subcategory_tr || lookupTr(categoryTR, product.category) || category_tr;

  const fitWord = fitToken(silhouette);
  const length_tr = lookupTr(lengthTR, product.length);
  const collarWord = lookupTr(necklineTR, neckline);
  const sleeve_or_strap_tr = lookupTr(strapTR, product.sleeve_or_strap);
  const material_tr = lookupTr(materialTR, product.material_impression);
  const gender = genderTR[canonKey(genderRaw)] ?? "";
  const patternWord = patterns[0]
    ? translatePattern(patterns[0].type)
    : hasLogo
      ? "logolu"
      : "";

  const distinctive_details = (product.distinctive_details || [])
    .map((d) => (typeof d === "string" ? d.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);

  const profile: ProductProfile = {
    photo_url: ctx.photo_url,
    user_id: ctx.user_id,
    user_profile: ctx.user_profile || {},
    category: family || product.category || "",
    category_tr: typeTr,
    subcategory,
    subcategory_tr,
    color_tr: color,
    colors: [primaryRaw, ...secondaryRaw].filter(Boolean),
    secondary_colors,
    fit: silhouette,
    fit_tr: fitWord,
    length: canonKey(product.length),
    length_tr,
    collar: neckline,
    collar_tr: collarWord,
    neckline,
    sleeve_or_strap: canonKey(product.sleeve_or_strap),
    sleeve_or_strap_tr,
    pattern: patterns[0]?.type || product.pattern || "",
    pattern_tr: patternWord,
    patterns,
    material_impression: canonKey(product.material_impression),
    material_tr,
    distinctive_details,
    has_logo: hasLogo || patterns.some((p) => p.type === "logo"),
    style_tags: product.style_tags || [],
    gender: canonKey(genderRaw),
    gender_tr: gender,
    search_query: "",
    fallback_query: "",
    core_query: "",
    low_confidence: false,
  };

  return rebuildProfileQueries(profile);
}

export interface VisionPiece {
  label: string;
  profile: ProductProfile;
}

const MAX_OUTFIT_PIECES = 5;

function pieceFamilyKey(category: string, categoryTr: string, subcategory = ""): string {
  const blob = `${category} ${categoryTr} ${subcategory}`.toLowerCase();
  if (/gözlük|glasses|sunglasses|eyewear/.test(blob)) return "eyewear";
  if (/crop/.test(blob)) return "crop";
  if (/tişört|t-shirt|tshirt|tee|polo/.test(blob)) return "tee";
  if (/gömlek|shirt/.test(blob) && !/t-shirt|sweatshirt/.test(blob)) return "shirt";
  if (/hoodie|sweatshirt|kapüşonlu|kazak|sweater|cardigan|hırka/.test(blob)) return "knit";
  if (/ceket|jacket|blazer|kaban|coat|trenç/.test(blob)) return "outer";
  if (/etek|skirt/.test(blob)) return "skirt";
  if (/elbise|dress|jumpsuit|tulum/.test(blob)) return "dress";
  if (/pantolon|jeans|chino|jogger|eşofman|şort|shorts|tayt|leggings/.test(blob)) return "bottom";
  if (/ayakkabı|sneaker|bot|sandal|loafer|heel/.test(blob)) return "shoes";
  if (/çanta|bag|backpack/.test(blob)) return "bag";
  if (/şapka|hat|bere|beanie|cap/.test(blob)) return "hat";
  if (/saat|watch/.test(blob)) return "watch";
  if (/kemer|belt|atkı|scarf/.test(blob)) return "accessory";
  return blob.trim() || "other";
}

export function parseVisionOutfit(visionContent: string, ctx: RequestContext): VisionPiece[] {
  const clean = visionContent.replace(/```json|```/g, "").trim();
  let parsed: { items?: VisionProduct[] } & VisionProduct;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Fotoğrafı okuyamadık. Net, iyi aydınlatılmış bir kıyafet fotoğrafı dene.");
  }

  let items: VisionProduct[];
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    items = parsed.items.slice(0, MAX_OUTFIT_PIECES);
  } else if (parsed.category || parsed.subcategory) {
    items = [parsed];
  } else {
    throw new Error("Fotoğrafı okuyamadık. Net, iyi aydınlatılmış bir kıyafet fotoğrafı dene.");
  }

  const pieces = items.map((item) => {
    const profile = visionProductToProfile(item, ctx);
    const label =
      item.label?.trim() ||
      profile.subcategory_tr ||
      profile.category_tr ||
      item.category ||
      "Parça";
    return { label, profile };
  });

  const seen = new Set<string>();
  const deduped: VisionPiece[] = [];
  for (const piece of pieces) {
    const key = pieceFamilyKey(
      piece.profile.category,
      piece.profile.category_tr,
      piece.profile.subcategory
    );
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(piece);
  }
  return deduped.slice(0, MAX_OUTFIT_PIECES);
}

export function parseVision(visionContent: string, ctx: RequestContext): ProductProfile {
  return parseVisionOutfit(visionContent, ctx)[0].profile;
}

export function pieceAttrsFromProfile(profile: ProductProfile) {
  return {
    category: profile.category,
    category_tr: profile.category_tr,
    subcategory: profile.subcategory || undefined,
    color_tr: profile.color_tr,
    fit: profile.fit,
    gender: profile.gender,
    style_tags: profile.style_tags,
    length: profile.length || undefined,
    neckline: profile.neckline || undefined,
    sleeve_or_strap: profile.sleeve_or_strap || undefined,
    secondary_colors: profile.secondary_colors.length ? profile.secondary_colors : undefined,
    patterns: profile.patterns.length ? profile.patterns : undefined,
    material_impression: profile.material_impression || undefined,
    distinctive_details: profile.distinctive_details.length
      ? profile.distinctive_details
      : undefined,
    low_confidence: profile.low_confidence || undefined,
  };
}

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

const tier1 = [
  ...new Set([
    ...MASS_MARKET_STORES,
    ...LUXURY_STORES,
    "koton",
    "lc waikiki",
    "lcw",
    "mavi",
    "defacto",
  ]),
];

function getTrust(source?: string, priceMode?: PriceMode, title?: string): number {
  const s = normalizeStore(source);
  let trust = 70;
  if (tier1.some((name) => s === name || s.startsWith(name + " ") || s.startsWith(name + ".") || s.includes(name + ".com") || s.includes(name))) {
    trust = 92;
  }
  if (isLuxuryHit(source, title)) trust = Math.max(trust, 96);
  if (priceMode === "luks" && isLuxuryHit(source, title)) trust = 100;
  if (priceMode === "uygunluk" && isBudgetStore(source)) trust += 4;
  if (priceMode === "uygunluk" && isMidFashionStore(source, title)) trust += 6;
  if (priceMode === "karma" && isLuxuryStore(source)) trust += 3;
  if (priceMode === "karma" && isMidFashionStore(source, title)) trust += 2;
  return Math.min(trust, 100);
}

function getPrice(item: SerpShoppingItem): number {
  if (typeof item.extracted_price === "number") return item.extracted_price;
  const cleaned = (item.price || "").replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export function isValidShoppingItem(item: SerpShoppingItem): boolean {
  if (getPrice(item) <= 0) return false;
  const priceStr = item.price || "";
  if (priceStr.includes("₺") || /\bTL\b/i.test(priceStr) || /\bTRY\b/i.test(priceStr)) return true;
  return typeof item.extracted_price === "number" && item.extracted_price > 0;
}

/** Most specific → broadest; core type token never dropped. Empty if low_confidence. */
export function buildSearchQueries(productProfile: ProductProfile): string[] {
  if (productProfile.low_confidence) return [];

  const rebuilt = productProfile.core_query
    ? productProfile
    : rebuildProfileQueries(productProfile);
  if (rebuilt.low_confidence || !rebuilt.core_query) return [];

  const sizes = rebuilt.user_profile?.sizes || [];
  const firstSize = sizes[0];
  const priceMode = (rebuilt.user_profile?.price_mode as PriceMode | undefined) || "karma";

  const core = rebuilt.core_query;
  const strong = uniqueJoin([
    core,
    rebuilt.color_tr,
    rebuilt.collar_tr,
    rebuilt.sleeve_or_strap_tr && !strapInCore(rebuilt.sleeve_or_strap_tr)
      ? rebuilt.sleeve_or_strap_tr
      : "",
    ...patternQueryTokens(rebuilt),
  ]);
  const full = uniqueJoin([
    strong,
    rebuilt.material_tr,
    rebuilt.secondary_colors[0] || "",
    ...detailQueryTokens(rebuilt.distinctive_details),
  ]);
  const colorCore = uniqueJoin([core, rebuilt.color_tr]);

  const sizeQuery = firstSize ? uniqueJoin([full || strong, firstSize]) : "";

  const base = [sizeQuery, full, strong, colorCore, core];

  const primary = (strong || core).trim();
  const brandSuffixes = pickDecidePoolBrands(
    {
      category: rebuilt.category,
      category_tr: rebuilt.category_tr,
      subcategory: rebuilt.subcategory,
      subcategory_tr: rebuilt.subcategory_tr,
      price_mode: priceMode,
    },
    3,
    primary
  );
  const brandQueries = primary ? brandSuffixes.map((brand) => `${primary} ${brand}`) : [];

  const luxuryQueries: string[] = [];
  if (priceMode === "luks" && primary) {
    // Beymen + Les Benjamins are always queried; the other two slots rotate
    // per item (deterministic hash of the query) so luxury results vary.
    const fixedStores = ["beymen", "les benjamins"];
    const rotating = LUXURY_SEARCH_STORES.filter((s) => !fixedStores.includes(s));
    let seed = 0;
    for (let i = 0; i < primary.length; i++) {
      seed = (seed * 31 + primary.charCodeAt(i)) >>> 0;
    }
    const first = seed % rotating.length;
    const second = (first + 1 + (seed % (rotating.length - 1))) % rotating.length;
    for (const store of [...fixedStores, rotating[first], rotating[second]]) {
      luxuryQueries.push(`${primary} ${store}`);
    }
  }

  // In lüks mode brand queries (Sandro, Maje, Pinko, …) come right after the
  // store queries so the first search batch already carries brand diversity.
  const candidates =
    priceMode === "luks"
      ? [...luxuryQueries, ...brandQueries, ...base]
      : [...base, ...brandQueries];
  const typeLc = typeTokenTr(rebuilt).toLocaleLowerCase("tr-TR");
  const seen = new Set<string>();
  return candidates
    .map((q) => q.trim().replace(/\s+/g, " "))
    .filter((q) => {
      if (!q || seen.has(q)) return false;
      if (typeLc && !q.toLocaleLowerCase("tr-TR").includes(typeLc)) return false;
      seen.add(q);
      return true;
    });
}

function preferLuxuryScored(scored: ScoredProduct[], priceMode: PriceMode): ScoredProduct[] {
  if (priceMode !== "luks") return scored;
  const luxury = scored.filter((p) => isLuxuryHit(p.source, p.title));
  if (luxury.length >= 3) return luxury;
  if (luxury.length >= 1) {
    const rest = scored.filter((p) => !isLuxuryHit(p.source, p.title));
    return [...luxury, ...rest];
  }
  return scored;
}

function scoreShoppingItems(
  shoppingResults: SerpShoppingItem[],
  productProfile: ProductProfile,
  styleKeyword = ""
): ScoredProduct[] {
  const userProfile = productProfile.user_profile || {};
  const priceMode = (userProfile.price_mode as PriceMode | undefined) || "karma";
  const styleWords = styleKeyword.toLowerCase().split(/\s+/).filter(Boolean);
  const fitWord = (productProfile.fit_tr || fitToken(productProfile.fit)).toLowerCase();

  let validResults = (shoppingResults || [])
    .filter(isValidShoppingItem)
    .filter((item) => !isKidsProduct(item.title))
    .filter((item) => allowedByPriceMode(item.source, priceMode, item.title))
    .filter((item) => !contradictsGender(item.title || "", productProfile))
    .filter((item) => !contradictsAbsoluteType(item.title || "", productProfile))
    .filter((item) => !contradictsCategoryFit(item.title || "", productProfile, { requireType: true }))
    .filter(
      (item) =>
        !failsQualityFilter({
          title: item.title || "",
          source: item.source,
          priceValue: getPrice(item),
          priceMode,
          poolFamily: resolvePoolCategories(productProfile)[0],
        })
    );

  // If strict type-require emptied the pool, keep family rejects but drop require.
  // Absolute denylist (crop/askılı → never dress) still applies.
  if (validResults.length < 3) {
    const relaxed = (shoppingResults || [])
      .filter(isValidShoppingItem)
      .filter((item) => !isKidsProduct(item.title))
      .filter((item) => allowedByPriceMode(item.source, priceMode, item.title))
      .filter((item) => !contradictsGender(item.title || "", productProfile))
      .filter((item) => !contradictsAbsoluteType(item.title || "", productProfile))
      .filter((item) => !contradictsCategoryFit(item.title || "", productProfile, { requireType: false }))
      .filter(
        (item) =>
          !failsQualityFilter({
            title: item.title || "",
            source: item.source,
            priceValue: getPrice(item),
            priceMode,
            poolFamily: resolvePoolCategories(productProfile)[0],
          })
      );
    if (relaxed.length > validResults.length) validResults = relaxed;
  }

  const brandedOnly = validResults.filter((item) =>
    textHasPoolBrand(`${item.title || ""} ${item.source || ""}`)
  );
  if (brandedOnly.length > 0) validResults = brandedOnly;

  // Prefer titles that explicitly mark the user's gender (erkek/kadın) when enough exist.
  if (profileGenderSide(productProfile)) {
    const gendered = validResults.filter((item) => titleMatchesUserGender(item.title || "", productProfile));
    if (gendered.length >= 3) {
      validResults = gendered;
    } else if (gendered.length > 0) {
      const rest = validResults.filter((item) => !titleMatchesUserGender(item.title || "", productProfile));
      validResults = [...gendered, ...rest];
    }
  }

  // In lüks mode, prefer luxury hits before scoring pool is capped.
  if (priceMode === "luks") {
    const luxuryOnly = validResults.filter((item) => isLuxuryHit(item.source, item.title));
    if (luxuryOnly.length >= 3) {
      validResults = luxuryOnly;
    } else if (luxuryOnly.length > 0) {
      const rest = validResults.filter((item) => !isLuxuryHit(item.source, item.title));
      validResults = [...luxuryOnly, ...rest];
    }
  }

  const scored = validResults.slice(0, 40).map((item) => {
    const title = (item.title || "").toLowerCase();
    const price = getPrice(item);
    const luxury = isLuxuryHit(item.source, item.title);
    const trustScore = getTrust(item.source, priceMode, item.title);
    const hay = `${item.title || ""} ${item.source || ""}`;
    const poolBrandHit = textHasPoolBrand(hay);
    const iconicBrandHit = textHasIconicPoolBrand(hay, productProfile);

    const categoryHit = titleMatchesCategory(item.title || "", productProfile);
    const subTr = (productProfile.subcategory_tr || "").toLowerCase();
    const subcategoryHit = Boolean(
      subTr &&
        subTr !== (productProfile.category_tr || "").toLowerCase() &&
        title.includes(subTr)
    );
    const lengthTr = (productProfile.length_tr || "").toLowerCase();
    const lengthHit = Boolean(lengthTr && title.includes(lengthTr));
    const patternPlacementHit = (productProfile.patterns || []).some((p) => {
      const typeTr = translatePattern(p.type);
      const placeTr = translatePlacement(p.placement);
      if (!typeTr || !placeTr) return false;
      return title.includes(typeTr) && title.includes(placeTr);
    });
    const colorHit = Boolean(
      productProfile.color_tr && title.includes(productProfile.color_tr.toLowerCase())
    );
    const fitHit = Boolean(fitWord && title.includes(fitWord.split(" ")[0]));
    const genderHit = titleMatchesUserGender(item.title || "", productProfile);

    // Layered attribute hits from collar / pattern / extra tokens in search_query
    const collarHit = Boolean(
      productProfile.collar_tr && title.includes(productProfile.collar_tr.toLowerCase())
    );
    const patternHit = Boolean(
      productProfile.pattern_tr && title.includes(productProfile.pattern_tr.toLowerCase())
    );
    const queryTokens = (productProfile.search_query || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["erkek", "kadın", "kadin", "için"].includes(w));
    const layeredTokenHits = queryTokens.filter((w) => title.includes(w)).length;

    let matchScore = 0;
    if (categoryHit) matchScore += 55;
    if (subcategoryHit) matchScore += 25;
    if (lengthHit) matchScore += 15;
    if (patternPlacementHit) matchScore += 8;
    if (colorHit) matchScore += 25;
    if (fitHit) matchScore += 20;
    if (genderHit) matchScore += 22;
    if (collarHit) matchScore += 14;
    if (patternHit) matchScore += 12;
    if (layeredTokenHits >= 2) matchScore += 10;
    else if (layeredTokenHits === 1) matchScore += 5;
    if (poolBrandHit) matchScore += 15;
    if (iconicBrandHit) matchScore += 8;
    if (styleWords.some((w) => title.includes(w))) matchScore += 12;
    matchScore += getSizeMatchBoost(item.title || "", userProfile.sizes as string[] | undefined);
    if (priceMode === "luks" && luxury) matchScore += 18;
    matchScore = Math.min(matchScore, 100);

    // Require category fidelity when we know the category
    if (productProfile.category_tr && !categoryHit) {
      matchScore = Math.min(matchScore, 35);
    }
    // Soft penalty when gender is known but title has no gender cue
    if (profileGenderSide(productProfile) && !genderHit) {
      matchScore = Math.max(0, matchScore - 10);
    }

    let forYouScore = 0;
    if (userProfile.budget_min && userProfile.budget_max) {
      if (price >= userProfile.budget_min && price <= userProfile.budget_max) forYouScore += 40;
      else if (price < userProfile.budget_min) forYouScore += 20;
    } else {
      forYouScore += 30;
    }
    // In lüks mode, do not reward "cheap" — prefer higher-end pricing signals lightly.
    if (priceMode === "luks" && price > 0) {
      if (price >= 2500) forYouScore += 20;
      else if (price >= 1200) forYouScore += 10;
      else forYouScore -= 15;
    }
    forYouScore = Math.max(0, Math.min(forYouScore, 100));

    let recommendationScore = Math.round(
      0.5 * matchScore + 0.15 * forYouScore + 0.35 * trustScore
    );
    if (priceMode === "luks" && luxury) recommendationScore += 25;
    if (priceMode === "luks" && !luxury) recommendationScore -= 20;
    recommendationScore = Math.max(0, Math.min(recommendationScore, 100));

    return {
      title: item.title || "",
      price: item.price || "",
      priceValue: price,
      source: item.source || "",
      image: item.thumbnail || "",
      product_id: item.product_id || null,
      serpapi_immersive_product_api: item.serpapi_immersive_product_api || null,
      link: item.product_link || "",
      store: (item.source || "").toLowerCase(),
      matchScore,
      forYouScore,
      trustScore,
      recommendationScore,
      signals: {
        category: categoryHit,
        color: colorHit,
        fit: fitHit,
        cheaper: false,
      },
    };
  });

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  return preferLuxuryScored(scored, priceMode);
}

function pickCheaperProduct(
  pool: ScoredProduct[],
  recommended: ScoredProduct,
  style: ScoredProduct | null
): ScoredProduct | null {
  const otherPrices = [recommended.priceValue, style?.priceValue].filter(
    (price): price is number => typeof price === "number" && price > 0
  );
  if (otherPrices.length === 0) return null;

  return (
    pool
      .filter(
        (p) =>
          p.priceValue > 0 &&
          p.title !== recommended.title &&
          p.title !== style?.title &&
          otherPrices.every((price) => p.priceValue <= price)
      )
      .sort((a, b) => a.priceValue - b.priceValue)[0] || null
  );
}

export function scoreProducts(shoppingResults: SerpShoppingItem[], productProfile: ProductProfile): ScoringResult {
  const scoredProducts = scoreShoppingItems(shoppingResults, productProfile);

  if (scoredProducts.length === 0) {
    return {
      user_id: productProfile.user_id,
      photo_url: productProfile.photo_url,
      recommended: null,
      cheaper: null,
      style: null,
      pool: [],
      error: "Bu ürün için sonuç bulunamadı.",
    };
  }

  const usedStores = new Set<string>();
  const usedTitles = new Set<string>();
  const topPool: ScoredProduct[] = [];
  for (const p of scoredProducts) {
    if (topPool.length >= 3) break;
    if (!usedStores.has(p.store) && !usedTitles.has(p.title)) {
      topPool.push(p);
      usedStores.add(p.store);
      usedTitles.add(p.title);
    }
  }
  for (const p of scoredProducts) {
    if (topPool.length >= 3) break;
    if (!usedTitles.has(p.title)) {
      topPool.push(p);
      usedTitles.add(p.title);
    }
  }

  const recommended = topPool[0] || null;
  const cheaper = recommended ? pickCheaperProduct(scoredProducts, recommended, null) : null;

  return {
    user_id: productProfile.user_id,
    photo_url: productProfile.photo_url,
    recommended,
    cheaper,
    style: null,
    pool: scoredProducts,
  };
}

export function pickStyleProduct(
  styleSearchResults: SerpShoppingItem[],
  productProfile: ProductProfile,
  excludeTitles: Set<string>,
  styleKeyword: string
): ScoredProduct | null {
  const scored = scoreShoppingItems(styleSearchResults, productProfile, styleKeyword);
  return scored.find((p) => !excludeTitles.has(p.title)) || null;
}

export function pickTrustedFallback(
  pool: ScoredProduct[],
  excludeTitles: Set<string>
): ScoredProduct | null {
  return (
    pool.find((p) => p.trustScore >= 90 && !excludeTitles.has(p.title)) ||
    pool.find((p) => !excludeTitles.has(p.title)) ||
    null
  );
}

// ---------------------------------------------------------------------------
// Merge Links
// ---------------------------------------------------------------------------

interface ImmersiveSeller {
  name?: string;
  direct_link?: string;
  link?: string;
  in_stock?: boolean;
  available?: boolean;
}

interface ImmersiveResponse {
  product_results?: {
    stores?: ImmersiveSeller[];
    sellers?: ImmersiveSeller[];
    out_of_stock?: boolean;
    availability?: string;
  };
  stores?: ImmersiveSeller[];
  sellers_results?: { online_sellers?: ImmersiveSeller[] };
  search_information?: { shopping_results_state?: string };
}

function findSellers(resp: ImmersiveResponse | null | undefined): ImmersiveSeller[] {
  return (
    resp?.product_results?.stores ||
    resp?.stores ||
    resp?.sellers_results?.online_sellers ||
    resp?.product_results?.sellers ||
    []
  );
}

/** True only when immersive payload clearly says out of stock. */
export function isClearlyOutOfStock(resp: ImmersiveResponse | null | undefined): boolean {
  if (!resp) return false;
  const pr = resp.product_results;
  if (pr?.out_of_stock === true) return true;
  const availability = (pr?.availability || "").toLowerCase();
  if (availability.includes("out of stock") || availability.includes("stokta yok")) return true;

  const sellers = findSellers(resp);
  if (sellers.length === 0) return false;
  const flagged = sellers.filter((s) => s.in_stock === false || s.available === false);
  return flagged.length > 0 && flagged.length === sellers.length;
}

export function pickLink(
  resp: ImmersiveResponse | null | undefined,
  originalSource: string,
  fallbackLink: string,
  affiliateTag: string
): { link: string; enriched: boolean } {
  const sellers = findSellers(resp);
  if (!sellers.length) return { link: fallbackLink, enriched: false };

  const src = (originalSource || "").toLowerCase().split(/[ .]/)[0];
  const sameStore = sellers.find((s) => (s.name || "").toLowerCase().includes(src));
  const seller = sameStore || sellers[0];

  let link = seller.direct_link || seller.link || fallbackLink;
  if (link.includes("amazon.com.tr") && !link.includes("tag=")) {
    link += (link.includes("?") ? "&" : "?") + `tag=${affiliateTag}`;
  }
  return { link, enriched: true };
}

export type EnrichedProduct = Product & {
  priceValue?: number;
  product_id?: string | null;
  serpapi_immersive_product_api?: string | null;
  isDirect: boolean;
  hasAffiliate: boolean;
};

export interface MergedResult {
  user_id: string;
  photo_url: string;
  recommended: EnrichedProduct | null;
  cheaper: EnrichedProduct | null;
  style: EnrichedProduct | null;
  top3: EnrichedProduct[];
}

const SLOTS = ["recommended", "cheaper", "style"] as const;
export type Slot = (typeof SLOTS)[number];

export function getSlots(scoring: ScoringResult): { slot: Slot; product: ScoredProduct }[] {
  const recommended = scoring.recommended;
  const validated =
    recommended
      ? { ...scoring, cheaper: pickCheaperProduct(scoring.pool, recommended, scoring.style) }
      : scoring;

  return SLOTS.map((slot) => ({ slot, product: validated[slot] }))
    .filter((s): s is { slot: Slot; product: ScoredProduct } => Boolean(s.product));
}

/**
 * Replace clearly OOS slot products with the next pool candidate.
 * Returns updated slots + immersive list (null for replacements until re-fetched by caller).
 */
export function replaceOutOfStockSlots(
  scoring: ScoringResult,
  slots: { slot: Slot; product: ScoredProduct }[],
  immersiveResponses: (ImmersiveResponse | null)[]
): { slot: Slot; product: ScoredProduct }[] {
  const used = new Set(slots.map((s) => s.product.title));
  return slots.map((entry, i) => {
    if (!isClearlyOutOfStock(immersiveResponses[i])) return entry;
    const replacement = scoring.pool.find((p) => !used.has(p.title));
    if (!replacement) return entry;
    used.add(replacement.title);
    used.delete(entry.product.title);
    return { slot: entry.slot, product: replacement };
  });
}

export function mergeLinks(
  scoring: ScoringResult,
  slots: { slot: Slot; product: ScoredProduct }[],
  immersiveResponses: (ImmersiveResponse | null)[],
  affiliateTag: string,
  profile?: ProductProfile
): MergedResult {
  const result: MergedResult = {
    user_id: scoring.user_id,
    photo_url: scoring.photo_url,
    recommended: null,
    cheaper: null,
    style: null,
    top3: [],
  };

  for (let i = 0; i < slots.length; i++) {
    const { slot, product: scored } = slots[i];
    const { link, enriched } = pickLink(
      immersiveResponses[i],
      scored.source,
      scored.link,
      affiliateTag
    );

    const signals: MatchSignals = {
      ...scored.signals,
      cheaper: slot === "cheaper",
    };

    const product: EnrichedProduct = {
      title: scored.title,
      price: scored.price,
      priceValue: scored.priceValue,
      product_id: scored.product_id,
      serpapi_immersive_product_api: scored.serpapi_immersive_product_api,
      source: scored.source,
      image: scored.image,
      store: scored.store,
      link,
      reason: buildShortReason(signals, slot, profile),
      label: "",
      isDirect: enriched,
      hasAffiliate: link.includes(`tag=${affiliateTag}`),
    };

    result[slot] = product;
    result.top3.push(product);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Final Output
// ---------------------------------------------------------------------------

export interface Reasons {
  recommended_reason?: string;
  cheaper_reason?: string;
  style_reason?: string;
}

export function buildResults(merged: MergedResult, reasons: Reasons = {}): Results {
  return {
    recommended: merged.recommended
      ? {
          ...merged.recommended,
          reason: reasons.recommended_reason || merged.recommended.reason || "",
          label: "Recommended",
        }
      : null,
    cheaper: merged.cheaper
      ? {
          ...merged.cheaper,
          reason: reasons.cheaper_reason || merged.cheaper.reason || "",
          label: "Cheaper Option",
        }
      : null,
    style: merged.style
      ? {
          ...merged.style,
          reason: reasons.style_reason || merged.style.reason || "",
          label: "Tarzına Uygun",
        }
      : null,
  };
}
