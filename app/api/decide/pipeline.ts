import { Product, Results } from "@/components/analyze/types";
import type { Occasion, PriceMode } from "@/lib/preferences";

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

export interface ProductProfile extends RequestContext {
  category: string;
  category_tr: string;
  color_tr: string;
  colors: string[];
  fit: string;
  fit_tr: string;
  collar: string;
  collar_tr: string;
  pattern: string;
  pattern_tr: string;
  has_logo: boolean;
  style_tags: string[];
  gender: string;
  gender_tr: string;
  search_query: string;
  fallback_query: string;
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
  regular: "regular fit",
  oversized: "oversize",
  oversize: "oversize",
  loose: "bol kesim",
  cropped: "crop",
  crop: "crop",
  "crop top": "crop",
};

function fitToken(fit: string | undefined): string {
  const raw = (fit || "").toLowerCase().trim();
  if (!raw) return "";
  return FIT_TR[raw] || raw;
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
  const fit = (profile.fit || "").toLowerCase();
  const blob = `${cat} ${catTr}`;
  const requireType = opts.requireType !== false;

  const isCrop =
    fit.includes("crop") ||
    cat.includes("crop") ||
    catTr.includes("crop");

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
    if (requireType && !/\b(tişört|t-?shirt|tshirt|tee|t şört)\b/.test(t)) {
      // Allow if clearly a tee synonym without wrong family
      if (/\b(gömlek|hoodie|sweatshirt|kazak|elbise|pantolon|etek|gözlük|ayakkabı|crop top|polo)\b/.test(t)) {
        return true;
      }
      if (requireType) return true;
    }
    if (/\b(gözlük|pantolon|etek|elbise|ayakkabı|bot|çanta|hoodie|sweatshirt|gömlek|kazak)\b/.test(t)) {
      return true;
    }
  }

  if (/gömlek|shirt/.test(blob) && !/t-shirt|tişört|sweatshirt|polo/.test(blob)) {
    if (requireType && !/\b(gömlek|shirt)\b/.test(t)) return true;
    if (/\b(tişört|t-?shirt|gözlük|pantolon|ayakkabı|hoodie)\b/.test(t)) return true;
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
  if (/pantolon|trousers|chino|jogger|eşofman/.test(blob) && !/kot pantolon|jeans/.test(blob)) {
    if (/\b(etek|elbise|tişört|gözlük|ayakkabı|crop)\b/.test(t)) return true;
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
    if (requireType && !/\b(saat|watch|wristwatch|kol saati)\b/.test(t)) return true;
    if (
      /\b(tişört|t-?shirt|gömlek|pantolon|gözlük|ayakkabı|elbise|hoodie|çanta|şapka|kemer)\b/.test(
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
  if (catTr && t.includes(catTr)) return true;

  const aliases: string[] = [];
  const blob = `${cat} ${catTr}`;
  if (/gözlük|glasses|sunglasses|eyewear/.test(blob)) {
    aliases.push("gözlük", "güneş gözlüğü", "sunglasses", "glasses", "eyewear");
  } else if (/crop/.test(blob)) {
    aliases.push("crop top", "crop");
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

/** Override vision gender with user-stated gender and rebuild search queries. */
export function applyUserGender(
  profile: ProductProfile,
  gender: string | null | undefined
): ProductProfile {
  const parsed = parseUserGender(gender);
  if (!parsed) return profile;

  const gender_tr = parsed === "women" ? "kadın" : "erkek";

  const search_query = [gender_tr, profile.color_tr, profile.fit_tr, profile.collar_tr, profile.pattern_tr, profile.category_tr]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

  const fallback_query = [gender_tr, profile.color_tr, profile.fit_tr, profile.category_tr]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

  return {
    ...profile,
    gender: parsed,
    gender_tr,
    search_query,
    fallback_query,
    user_profile: {
      ...profile.user_profile,
      gender: parsed,
    },
  };
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
// Parse Vision1 (n8n "Code" node)
// ---------------------------------------------------------------------------

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
};

const collarTR: Record<string, string> = {
  "v-neck": "v yaka", "v neck": "v yaka",
  "crew neck": "bisiklet yaka", crewneck: "bisiklet yaka", "round neck": "bisiklet yaka",
  polo: "polo yaka", "polo collar": "polo yaka",
  turtleneck: "boğazlı", "mock neck": "yarım boğazlı",
  collar: "yakalı", "button down": "düğmeli yaka",
  none: "",
};

const patternTR: Record<string, string> = {
  striped: "çizgili", stripes: "çizgili",
  floral: "çiçekli", checkered: "ekoseli", plaid: "ekoseli",
  graphic: "baskılı", print: "baskılı", printed: "baskılı",
  plain: "", none: "",
};

const genderTR: Record<string, string> = { men: "erkek", women: "kadın", unisex: "" };

const collarCategories = ["t-shirt", "tshirt", "shirt", "polo", "hoodie", "sweatshirt", "sweater", "dress", "cardigan", "knitwear"];
const detailCategories = ["t-shirt", "tshirt", "shirt", "hoodie", "sweatshirt", "jacket", "bomber jacket", "sweater"];

interface VisionProduct {
  label?: string;
  category?: string;
  colors?: string[];
  fit?: string;
  collar?: string;
  pattern?: string;
  has_logo?: boolean;
  style_tags?: string[];
  gender?: string;
}

function visionProductToProfile(product: VisionProduct, ctx: RequestContext): ProductProfile {
  const rawColor = (product.colors || [])[0] || "";
  const rawCategory = (product.category || "").toLowerCase();
  const rawCollar = (product.collar || "").toLowerCase();
  const rawPattern = (product.pattern || "").toLowerCase();
  const rawGender = (product.gender || "").toLowerCase();
  const hasLogo = product.has_logo === true;

  const color = colorTR[rawColor.toLowerCase()] || rawColor;
  const category = categoryTR[rawCategory] || rawCategory;
  const gender = genderTR[rawGender] || "";
  const fitWord = fitToken(product.fit);

  const collarWord = collarCategories.some((c) => rawCategory.includes(c))
    ? collarTR[rawCollar] || ""
    : "";

  const patternWord = detailCategories.some((c) => rawCategory.includes(c))
    ? hasLogo
      ? "logolu"
      : patternTR[rawPattern] || ""
    : "";

  const search_query = [gender, color, fitWord, collarWord, patternWord, category]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

  const fallback_query = [gender, color, fitWord, category]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

  return {
    photo_url: ctx.photo_url,
    user_id: ctx.user_id,
    user_profile: ctx.user_profile || {},
    category: product.category || "",
    category_tr: category,
    color_tr: color,
    colors: product.colors || [],
    fit: product.fit || "",
    fit_tr: fitWord,
    collar: product.collar || "",
    collar_tr: collarWord,
    pattern: product.pattern || "",
    pattern_tr: patternWord,
    has_logo: !!product.has_logo,
    style_tags: product.style_tags || [],
    gender: product.gender || "",
    gender_tr: gender,
    search_query,
    fallback_query,
  };
}

export interface VisionPiece {
  label: string;
  profile: ProductProfile;
}

const MAX_OUTFIT_PIECES = 4;

function pieceFamilyKey(category: string, categoryTr: string): string {
  const blob = `${category} ${categoryTr}`.toLowerCase();
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
  if (/kemer|belt|saat|watch|atkı|scarf/.test(blob)) return "accessory";
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
  } else if (parsed.category) {
    items = [parsed];
  } else {
    throw new Error("Fotoğrafı okuyamadık. Net, iyi aydınlatılmış bir kıyafet fotoğrafı dene.");
  }

  const pieces = items.map((item) => {
    const profile = visionProductToProfile(item, ctx);
    const label =
      item.label?.trim() ||
      profile.category_tr ||
      item.category ||
      "Parça";
    return { label, profile };
  });

  // Keep one item per garment family so outfit slots stay distinct (top/bottom/shoes…).
  const seen = new Set<string>();
  const deduped: VisionPiece[] = [];
  for (const piece of pieces) {
    const key = pieceFamilyKey(piece.profile.category, piece.profile.category_tr);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(piece);
  }
  return deduped.slice(0, MAX_OUTFIT_PIECES);
}

export function parseVision(visionContent: string, ctx: RequestContext): ProductProfile {
  return parseVisionOutfit(visionContent, ctx)[0].profile;
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

/** Most specific → broadest; deduplicated. Optional size prepended as extra candidate only. */
export function buildSearchQueries(productProfile: ProductProfile): string[] {
  const { gender_tr, category_tr, fit_tr, search_query, fallback_query } = productProfile;
  const sizes = productProfile.user_profile?.sizes || [];
  const firstSize = sizes[0];
  const priceMode = (productProfile.user_profile?.price_mode as PriceMode | undefined) || "karma";

  const sizeQuery = firstSize
    ? [search_query, firstSize].filter(Boolean).join(" ").trim()
    : "";

  // Keep base short — fewer sequential Serp round-trips.
  const base = [
    sizeQuery,
    search_query,
    fallback_query,
    [gender_tr, fit_tr, category_tr].filter(Boolean).join(" "),
    [gender_tr, category_tr].filter(Boolean).join(" "),
  ];

  const primary = (search_query || fallback_query || [gender_tr, category_tr].filter(Boolean).join(" ")).trim();
  const luxuryQueries: string[] = [];
  if (priceMode === "luks" && primary) {
    // Top stores only — parallelized in run-piece (quality kept, latency cut).
    for (const store of LUXURY_SEARCH_STORES.slice(0, 4)) {
      luxuryQueries.push(`${primary} ${store}`);
    }
  }

  const candidates = [...luxuryQueries, ...base];
  const seen = new Set<string>();
  return candidates
    .map((q) => q.trim().replace(/\s+/g, " "))
    .filter((q) => {
      if (!q || seen.has(q)) return false;
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
    .filter((item) => !contradictsCategoryFit(item.title || "", productProfile, { requireType: true }));

  // If strict type-require emptied the pool, keep family rejects but drop require.
  if (validResults.length < 3) {
    const relaxed = (shoppingResults || [])
      .filter(isValidShoppingItem)
      .filter((item) => !isKidsProduct(item.title))
      .filter((item) => allowedByPriceMode(item.source, priceMode, item.title))
      .filter((item) => !contradictsGender(item.title || "", productProfile))
      .filter((item) => !contradictsCategoryFit(item.title || "", productProfile, { requireType: false }));
    if (relaxed.length > validResults.length) validResults = relaxed;
  }

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

    const categoryHit = titleMatchesCategory(item.title || "", productProfile);
    const colorHit = Boolean(
      productProfile.color_tr && title.includes(productProfile.color_tr.toLowerCase())
    );
    const fitHit = Boolean(fitWord && title.includes(fitWord.split(" ")[0]));
    const genderHit = titleMatchesUserGender(item.title || "", productProfile);

    let matchScore = 0;
    if (categoryHit) matchScore += 55;
    if (colorHit) matchScore += 25;
    if (fitHit) matchScore += 20;
    if (genderHit) matchScore += 22;
    if (productProfile.collar_tr && title.includes(productProfile.collar_tr.toLowerCase())) matchScore += 12;
    if (productProfile.pattern_tr && title.includes(productProfile.pattern_tr.toLowerCase())) matchScore += 10;
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
