import { Product, Results } from "@/components/analyze/types";

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
  [key: string]: unknown;
}

export interface ProductProfile extends RequestContext {
  category: string;
  category_tr: string;
  color_tr: string;
  colors: string[];
  fit: string;
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
// Style preferences -> search keywords
// ---------------------------------------------------------------------------

const STYLE_KEYWORDS: Record<string, string> = {
  "Rahatlık & Konfor": "rahat oversize",
  "Minimalist & Sade": "minimal sade",
  "Gösterişli & İddialı": "iddialı şık",
  "Teknoloji Tutkunu": "modern",
  "Spor & Egzersiz": "spor",
  "Evcimen": "rahat günlük",
  "Maceracı & Doğa": "outdoor",
  "Lüks & Kalite": "premium",
  "Trend & Moda": "trend",
};

export function getStyleKeyword(preferences: string[] | undefined): string {
  if (!preferences?.length) return "";
  return STYLE_KEYWORDS[preferences[0]] || "";
}

/** Override vision gender with user-stated gender and rebuild search queries. */
export function applyUserGender(
  profile: ProductProfile,
  gender: string | null | undefined
): ProductProfile {
  if (gender !== "men" && gender !== "women") return profile;

  const gender_tr = gender === "women" ? "kadın" : "erkek";

  const search_query = [gender_tr, profile.color_tr, profile.collar_tr, profile.pattern_tr, profile.category_tr]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

  const fallback_query = [gender_tr, profile.color_tr, profile.category_tr]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

  return {
    ...profile,
    gender,
    gender_tr,
    search_query,
    fallback_query,
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
  sneaker: "spor ayakkabı", "running shoe": "koşu ayakkabısı",
  boot: "bot", sandal: "sandalet", loafer: "loafer",
  "high heel": "topuklu ayakkabı", oxford: "oxford ayakkabı",
  bag: "çanta", handbag: "el çantası", backpack: "sırt çantası",
  hat: "şapka", cap: "şapka", beanie: "bere",
  scarf: "atkı", belt: "kemer", wallet: "cüzdan",
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

  const collarWord = collarCategories.some((c) => rawCategory.includes(c))
    ? collarTR[rawCollar] || ""
    : "";

  const patternWord = detailCategories.some((c) => rawCategory.includes(c))
    ? hasLogo
      ? "logolu"
      : patternTR[rawPattern] || ""
    : "";

  const search_query = [gender, color, collarWord, patternWord, category]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

  const fallback_query = [gender, color, category]
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

  return items.map((item) => {
    const profile = visionProductToProfile(item, ctx);
    const label =
      item.label?.trim() ||
      profile.category_tr ||
      item.category ||
      "Parça";
    return { label, profile };
  });
}

export function parseVision(visionContent: string, ctx: RequestContext): ProductProfile {
  return parseVisionOutfit(visionContent, ctx)[0].profile;
}

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

const tier1 = ["trendyol", "hepsiburada", "amazon", "boyner", "zara", "mango",
  "koton", "lc waikiki", "lcw", "mavi", "defacto", "beymen", "decathlon",
  "n11", "flo", "nike", "adidas", "gap", "h&m", "bershka", "vakkorama", "next"];

function getTrust(source?: string): number {
  const s = (source || "").toLowerCase();
  if (tier1.some((name) => s === name || s.startsWith(name + " ") || s.startsWith(name + ".") || s.includes(name + ".com"))) return 92;
  return 70;
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
  const { gender_tr, color_tr, category_tr, search_query, fallback_query } = productProfile;
  const sizes = productProfile.user_profile?.sizes || [];
  const firstSize = sizes[0];

  const sizeQuery = firstSize
    ? [search_query, firstSize].filter(Boolean).join(" ").trim()
    : "";

  const candidates = [
    sizeQuery,
    search_query,
    fallback_query,
    [gender_tr, category_tr].filter(Boolean).join(" "),
    [color_tr, category_tr].filter(Boolean).join(" "),
    category_tr,
  ];
  const seen = new Set<string>();
  return candidates
    .map((q) => q.trim().replace(/\s+/g, " "))
    .filter((q) => {
      if (!q || seen.has(q)) return false;
      seen.add(q);
      return true;
    });
}

function scoreShoppingItems(
  shoppingResults: SerpShoppingItem[],
  productProfile: ProductProfile,
  styleKeyword = ""
): ScoredProduct[] {
  const userProfile = productProfile.user_profile || {};
  const styleWords = styleKeyword.toLowerCase().split(/\s+/).filter(Boolean);

  const validResults = (shoppingResults || []).filter(isValidShoppingItem);

  const scored = validResults.slice(0, 20).map((item) => {
    const title = (item.title || "").toLowerCase();
    const price = getPrice(item);
    const trustScore = getTrust(item.source);

    let matchScore = 0;
    if (productProfile.category_tr && title.includes(productProfile.category_tr.toLowerCase())) matchScore += 40;
    if (productProfile.color_tr && title.includes(productProfile.color_tr.toLowerCase())) matchScore += 25;
    if (productProfile.collar_tr && title.includes(productProfile.collar_tr.toLowerCase())) matchScore += 15;
    if (productProfile.pattern_tr && title.includes(productProfile.pattern_tr.toLowerCase())) matchScore += 10;
    if (productProfile.gender_tr && title.includes(productProfile.gender_tr.toLowerCase())) matchScore += 10;
    if (styleWords.some((w) => title.includes(w))) matchScore += 15;
    matchScore += getSizeMatchBoost(item.title || "", userProfile.sizes as string[] | undefined);
    matchScore = Math.min(matchScore, 100);

    let forYouScore = 0;
    if (userProfile.budget_min && userProfile.budget_max) {
      if (price >= userProfile.budget_min && price <= userProfile.budget_max) forYouScore += 40;
      else if (price < userProfile.budget_min) forYouScore += 20;
    } else {
      forYouScore += 30;
    }
    forYouScore = Math.min(forYouScore, 100);

    const recommendationScore = Math.round(
      0.5 * matchScore + 0.25 * forYouScore + 0.25 * trustScore
    );

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
    };
  });

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  return scored;
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

  const topPrice = topPool[0]?.priceValue || 0;
  const cheaper = topPool.find((p, i) => i > 0 && p.priceValue > 0 && p.priceValue < topPrice) || topPool[1] || null;

  return {
    user_id: productProfile.user_id,
    photo_url: productProfile.photo_url,
    recommended: topPool[0] || null,
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
}

interface ImmersiveResponse {
  product_results?: { stores?: ImmersiveSeller[]; sellers?: ImmersiveSeller[] };
  stores?: ImmersiveSeller[];
  sellers_results?: { online_sellers?: ImmersiveSeller[] };
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
  return SLOTS.map((slot) => ({ slot, product: scoring[slot] }))
    .filter((s): s is { slot: Slot; product: ScoredProduct } => Boolean(s.product));
}

export function mergeLinks(
  scoring: ScoringResult,
  slots: { slot: Slot; product: ScoredProduct }[],
  immersiveResponses: (ImmersiveResponse | null)[],
  affiliateTag: string
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

    const product: EnrichedProduct = {
      title: scored.title,
      price: scored.price,
      priceValue: scored.priceValue,
      source: scored.source,
      image: scored.image,
      store: scored.store,
      link,
      reason: "",
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

export function buildResults(merged: MergedResult, reasons: Reasons): Results {
  return {
    recommended: merged.recommended
      ? { ...merged.recommended, reason: reasons.recommended_reason || "", label: "Recommended" }
      : null,
    cheaper: merged.cheaper
      ? { ...merged.cheaper, reason: reasons.cheaper_reason || "", label: "Cheaper Option" }
      : null,
    style: merged.style
      ? { ...merged.style, reason: reasons.style_reason || "", label: "Tarzına Uygun" }
      : null,
  };
}
