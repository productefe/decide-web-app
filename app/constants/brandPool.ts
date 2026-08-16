/**
 * DECIDE brand pool v1.1 — seed from docs/decide-brand-pool.md
 * tier maps to in-app price_mode: affordable → uygunluk, luxury → luks, karma mixes both.
 * designer is a luxury subset, not a separate tier.
 */

export type BrandTier = "affordable" | "luxury";

export type BrandPoolCategory =
  | "tops"
  | "crop"
  | "bottoms"
  | "dress"
  | "outerwear"
  | "sneakers"
  | "shoes_classic"
  | "bag"
  | "watch"
  | "sunglasses"
  | "activewear"
  | "accessory";

export interface BrandPoolEntry {
  category: BrandPoolCategory;
  tier: BrandTier;
  designer?: boolean;
  brands: string[];
  iconicFor?: string[];
}

export const CROP_SUBCATEGORIES = ["crop-top", "askili-ust", "bralet", "bustiyer", "büstiyer"];

export const BRAND_POOL: BrandPoolEntry[] = [
  // --- 1. ÜST GİYİM ---
  {
    category: "tops",
    tier: "affordable",
    brands: [
      "Koton",
      "LC Waikiki",
      "DeFacto",
      "Colin's",
      "Mavi",
      "Levi's",
      "GAP",
      "Bershka",
      "Pull&Bear",
      "Stradivarius",
      "H&M",
      "Zara",
      "Massimo Dutti",
      "COS",
      "U.S. Polo Assn.",
      "Jack & Jones",
      "Only",
      "Terranova",
      "İpekyol",
      "Twist",
      "Network",
      "Beymen Club",
    ],
  },
  { category: "tops", tier: "affordable", brands: ["Lacoste", "Ralph Lauren"], iconicFor: ["polo yaka"] },
  { category: "tops", tier: "affordable", brands: ["Levi's", "Mavi"], iconicFor: ["denim üst"] },
  { category: "tops", tier: "affordable", brands: ["Koton", "LC Waikiki"], iconicFor: ["basic tişört"] },
  {
    category: "tops",
    tier: "luxury",
    brands: [
      "Ralph Lauren",
      "Lacoste",
      "Hugo Boss",
      "Emporio Armani",
      "Gant",
      "Tommy Hilfiger",
      "Sandro",
      "Maje",
      "Theory",
      "Vilebrequin",
    ],
  },
  {
    category: "tops",
    tier: "luxury",
    designer: true,
    brands: ["Les Benjamins", "Nocturne", "Sudi Etuz", "Mehtap Elaidi"],
  },

  // --- 2. KADIN CASUAL & CROP TOP (alt-havuz) ---
  {
    category: "crop",
    tier: "affordable",
    brands: [
      "Trendyol Milla",
      "Bershka",
      "Stradivarius",
      "Pull&Bear",
      "H&M",
      "Zara",
      "Koton",
      "DeFacto",
      "Addax",
      "Oleg",
      "Setre",
      "Happiness İst.",
      "Dilvin",
      "Reeder",
      "Quzu",
      "TWN",
      "Never More",
      "Cool & Sexy",
    ],
  },
  {
    category: "crop",
    tier: "affordable",
    brands: ["Bershka", "Addax", "Trendyol Milla"],
    iconicFor: ["crop top"],
  },
  { category: "crop", tier: "affordable", brands: ["Stradivarius", "H&M"], iconicFor: ["askılı basic"] },
  {
    category: "crop",
    tier: "luxury",
    brands: [
      "Sandro",
      "Maje",
      "The Kooples",
      "Pinko",
      "Guess",
      "Calvin Klein",
      "Tommy Jeans",
      "Miss Sixty",
      "Elisabetta Franchi",
    ],
  },
  { category: "crop", tier: "luxury", brands: ["Pinko", "Elisabetta Franchi"], iconicFor: ["büstiyer"] },
  {
    category: "crop",
    tier: "luxury",
    designer: true,
    brands: ["Nocturne", "Zeynep Arçay", "Raisa Vanessa"],
  },

  // --- 3. ALT GİYİM ---
  {
    category: "bottoms",
    tier: "affordable",
    brands: [
      "Levi's",
      "Mavi",
      "Colin's",
      "Lee",
      "Wrangler",
      "Dockers",
      "Koton",
      "LC Waikiki",
      "DeFacto",
      "Bershka",
      "Pull&Bear",
      "H&M",
      "Zara",
      "Massimo Dutti",
      "COS",
      "İpekyol",
      "Twist",
      "Addax",
      "Trendyol Milla",
    ],
  },
  { category: "bottoms", tier: "affordable", brands: ["Levi's", "Mavi"], iconicFor: ["jean"] },
  { category: "bottoms", tier: "affordable", brands: ["Dockers"], iconicFor: ["chino"] },
  {
    category: "bottoms",
    tier: "luxury",
    brands: ["Hugo Boss", "Emporio Armani", "7 For All Mankind", "Jacob Cohen", "Sandro", "Maje"],
  },
  { category: "bottoms", tier: "luxury", designer: true, brands: ["Les Benjamins", "Manç"] },

  // --- 4. ELBİSE ---
  {
    category: "dress",
    tier: "affordable",
    brands: [
      "İpekyol",
      "Twist",
      "Machka",
      "adL",
      "Mango",
      "& Other Stories",
      "Massimo Dutti",
      "COS",
      "Koton",
      "DeFacto",
      "LC Waikiki",
      "Trendyol Milla",
      "Bershka",
      "Stradivarius",
      "H&M",
      "Zara",
      "Setre",
      "Happiness İst.",
    ],
  },
  { category: "dress", tier: "affordable", brands: ["İpekyol", "Machka"], iconicFor: ["günlük şık"] },
  {
    category: "dress",
    tier: "luxury",
    brands: ["Self-Portrait", "Sandro", "Maje", "Ted Baker", "Pinko", "Elisabetta Franchi", "Max Mara"],
  },
  {
    category: "dress",
    tier: "luxury",
    brands: ["Raisa Vanessa", "Elisabetta Franchi"],
    iconicFor: ["davet"],
  },
  {
    category: "dress",
    tier: "luxury",
    designer: true,
    brands: ["Raisa Vanessa", "Sudi Etuz", "Zeynep Tosun", "Mehtap Elaidi", "Gülçin Çengel", "Nocturne"],
  },

  // --- 5. DIŞ GİYİM ---
  {
    category: "outerwear",
    tier: "affordable",
    brands: [
      "The North Face",
      "Columbia",
      "Timberland",
      "Superdry",
      "Napapijri",
      "Massimo Dutti",
      "Beymen Club",
      "Network",
      "Koton",
      "DeFacto",
      "LC Waikiki",
      "Colin's",
      "H&M",
      "Zara",
      "Jack & Jones",
    ],
  },
  {
    category: "outerwear",
    tier: "luxury",
    brands: ["Moncler", "Canada Goose", "Burberry", "Woolrich", "Herno", "Mackage", "Hugo Boss"],
  },
  { category: "outerwear", tier: "luxury", brands: ["Moncler"], iconicFor: ["puffer"] },
  { category: "outerwear", tier: "luxury", brands: ["Burberry"], iconicFor: ["trençkot"] },

  // --- 6. SNEAKER ---
  {
    category: "sneakers",
    tier: "affordable",
    brands: [
      "Nike",
      "Adidas",
      "New Balance",
      "Puma",
      "Converse",
      "Vans",
      "Asics",
      "Reebok",
      "Skechers",
      "Salomon",
      "On Running",
      "Kinetix",
      "Lumberjack",
      "Hummel",
      "Slazenger",
      "U.S. Polo Assn.",
    ],
  },
  { category: "sneakers", tier: "affordable", brands: ["Adidas"], iconicFor: ["sneaker"] },
  { category: "sneakers", tier: "affordable", brands: ["Converse"], iconicFor: ["kanvas sneaker"] },
  { category: "sneakers", tier: "affordable", brands: ["Vans"], iconicFor: ["old skool"] },
  {
    category: "sneakers",
    tier: "luxury",
    brands: ["Golden Goose", "Common Projects", "Alexander McQueen", "Balenciaga", "Premiata", "Autry", "Veja"],
  },

  // --- 7. KLASİK / BOT / TOPUKLU ---
  {
    category: "shoes_classic",
    tier: "affordable",
    brands: [
      "İnci",
      "Divarese",
      "Greyder",
      "Hotiç",
      "Kemal Tanca",
      "Cabani",
      "Clarks",
      "Timberland",
      "Dr. Martens",
      "Ecco",
      "Geox",
      "FLO",
      "Polaris",
      "Butigo",
      "Bambi",
    ],
  },
  { category: "shoes_classic", tier: "affordable", brands: ["Timberland"], iconicFor: ["bot"] },
  { category: "shoes_classic", tier: "affordable", brands: ["Dr. Martens"], iconicFor: ["1460"] },
  {
    category: "shoes_classic",
    tier: "luxury",
    brands: ["Christian Louboutin", "Jimmy Choo", "Manolo Blahnik", "Santoni", "Church's", "Tod's", "Gianvito Rossi"],
  },
  { category: "shoes_classic", tier: "luxury", brands: ["Christian Louboutin"], iconicFor: ["kırmızı taban"] },
  { category: "shoes_classic", tier: "luxury", brands: ["Tod's"], iconicFor: ["loafer"] },

  // --- 8. ÇANTA ---
  {
    category: "bag",
    tier: "affordable",
    brands: [
      "Guess",
      "DKNY",
      "Calvin Klein",
      "Tommy Hilfiger",
      "Lacoste",
      "Derimod",
      "Matmazel",
      "Housebags",
      "Koton",
      "Stradivarius",
      "LC Waikiki",
    ],
  },
  {
    category: "bag",
    tier: "luxury",
    brands: [
      "Louis Vuitton",
      "Gucci",
      "Prada",
      "Saint Laurent",
      "Celine",
      "Loewe",
      "Bottega Veneta",
      "Coach",
      "Michael Kors",
      "Furla",
      "Longchamp",
      "Marc Jacobs",
    ],
  },
  { category: "bag", tier: "luxury", brands: ["Longchamp"], iconicFor: ["le pliage"] },
  { category: "bag", tier: "luxury", brands: ["Marc Jacobs"], iconicFor: ["tote"] },
  {
    category: "bag",
    tier: "luxury",
    designer: true,
    brands: ["Manu Atelier", "Mlouye", "Misela"],
    iconicFor: ["çanta"],
  },

  // --- 9. SAAT ---
  {
    category: "watch",
    tier: "affordable",
    brands: [
      "Casio",
      "Swatch",
      "Timex",
      "Fossil",
      "Daniel Wellington",
      "Guess",
      "Tommy Hilfiger",
      "Ferro",
      "Seiko",
      "Orient",
      "Citizen",
      "Tissot",
    ],
  },
  { category: "watch", tier: "affordable", brands: ["Casio"], iconicFor: ["g-shock"] },
  { category: "watch", tier: "affordable", brands: ["Daniel Wellington"], iconicFor: ["minimalist saat"] },
  { category: "watch", tier: "affordable", brands: ["Orient"], iconicFor: ["otomatik saat"] },
  {
    category: "watch",
    tier: "luxury",
    brands: [
      "Rolex",
      "Omega",
      "Cartier",
      "IWC",
      "TAG Heuer",
      "Breitling",
      "Longines",
      "Tudor",
      "Rado",
      "Hamilton",
      "Frederique Constant",
    ],
  },

  // --- 10. GÜNEŞ GÖZLÜĞÜ ---
  {
    category: "sunglasses",
    tier: "affordable",
    brands: ["Ray-Ban", "Oakley", "Polaroid", "Vogue Eyewear", "Police", "Hawkers", "Osse", "Mustang", "Della Spiga"],
  },
  { category: "sunglasses", tier: "affordable", brands: ["Ray-Ban"], iconicFor: ["güneş gözlüğü"] },
  { category: "sunglasses", tier: "affordable", brands: ["Oakley"], iconicFor: ["spor gözlük"] },
  {
    category: "sunglasses",
    tier: "luxury",
    brands: ["Persol", "Oliver Peoples", "Tom Ford", "Cartier", "Gucci", "Prada", "Celine", "Gentle Monster"],
  },

  // --- 11. SPOR / ACTIVEWEAR ---
  {
    category: "activewear",
    tier: "affordable",
    brands: [
      "Nike",
      "Adidas",
      "Puma",
      "Under Armour",
      "New Balance",
      "Asics",
      "Gymshark",
      "Decathlon",
      "LC Waikiki",
      "Koton",
      "Hummel",
      "Kinetix",
    ],
  },
  {
    category: "activewear",
    tier: "luxury",
    brands: ["Lululemon", "Alo Yoga", "On Running"],
  },
  { category: "activewear", tier: "luxury", brands: ["Lululemon"], iconicFor: ["legging"] },

  // --- 12. TAKI / AKSESUAR ---
  {
    category: "accessory",
    tier: "affordable",
    brands: ["Fossil", "Calvin Klein", "New Era", "Kangol", "Koton", "Stradivarius", "So CHIC", "Pandora", "Swarovski"],
  },
  { category: "accessory", tier: "affordable", brands: ["New Era"], iconicFor: ["cap"] },
  { category: "accessory", tier: "affordable", brands: ["Pandora"], iconicFor: ["charm"] },
  {
    category: "accessory",
    tier: "luxury",
    brands: ["Hermès", "Atasay", "Altınbaş", "Swarovski"],
  },
  { category: "accessory", tier: "luxury", brands: ["Hermès"], iconicFor: ["kemer"] },
];

export const APPROVED_AFFORDABLE_BRANDS = [
  "koton",
  "lc waikiki",
  "lcw",
  "defacto",
  "colin's",
  "colins",
  "mavi",
  "levis",
  "levi's",
  "bershka",
  "pull&bear",
  "stradivarius",
  "h&m",
  "zara",
  "addax",
  "trendyol milla",
  "trendyolmilla",
];

export function normalizeBrandName(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/&/g, "and")
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blobOf(profile: {
  category?: string;
  category_tr?: string;
  subcategory?: string;
  subcategory_tr?: string;
}): string {
  return [profile.subcategory, profile.subcategory_tr, profile.category, profile.category_tr]
    .join(" ")
    .toLowerCase();
}

export function isCropCasualSubcategory(profile: {
  subcategory?: string;
  subcategory_tr?: string;
  category_tr?: string;
}): boolean {
  const sub = (profile.subcategory || "").toLowerCase();
  if (CROP_SUBCATEGORIES.includes(sub)) return true;
  const blob = `${profile.subcategory || ""} ${profile.subcategory_tr || ""} ${profile.category_tr || ""}`.toLowerCase();
  return /crop|askılı|askili|bralet|büstiyer|bustiyer/.test(blob);
}

/** Ordered pool categories: crop alt-havuzu always before tops when crop/askılı/bralet. */
export function resolvePoolCategories(profile: {
  category?: string;
  category_tr?: string;
  subcategory?: string;
  subcategory_tr?: string;
}): BrandPoolCategory[] {
  const blob = blobOf(profile);
  const ordered: BrandPoolCategory[] = [];

  if (isCropCasualSubcategory(profile)) ordered.push("crop");

  if (/elbise|dress|jumpsuit|tulum/.test(blob)) ordered.push("dress");
  else if (/gözlük|sunglasses|eyewear|sunglass/.test(blob)) ordered.push("sunglasses");
  else if (/saat|watch|wrist/.test(blob)) ordered.push("watch");
  else if (/çanta|bag|backpack|clutch|tote/.test(blob)) ordered.push("bag");
  else if (/şapka|hat|bere|cap|kemer|belt|takı|kolye|küpe/.test(blob)) ordered.push("accessory");
  else if (/spor ayakkabı|sneaker|koşu/.test(blob)) ordered.push("sneakers");
  else if (/ayakkabı|bot|sandal|loafer|heel|topuk|oxford|shoe/.test(blob)) ordered.push("shoes_classic");
  else if (/ceket|mont|kaban|coat|jacket|trenç|puffer|blazer/.test(blob)) ordered.push("outerwear");
  else if (/pantolon|jean|etek|şort|short|tayt|chino|legging/.test(blob)) ordered.push("bottoms");
  else if (/eşofman|athleisure|activewear|spor giyim/.test(blob)) ordered.push("activewear");
  else if (/tişört|t-shirt|gömlek|sweat|hoodie|kazak|polo|bluz|üst|top/.test(blob)) ordered.push("tops");
  else ordered.push("tops");

  return [...new Set(ordered)];
}

function allowedTiers(priceMode: string | undefined): BrandTier[] {
  if (priceMode === "uygunluk") return ["affordable"];
  if (priceMode === "luks") return ["luxury"];
  return ["affordable", "luxury"];
}

function iconicNeedles(profile: {
  subcategory?: string;
  subcategory_tr?: string;
  category?: string;
  category_tr?: string;
}): string[] {
  const blob = blobOf(profile);
  const out: string[] = [];
  if (/crop/.test(blob)) out.push("crop top");
  if (/askı|bralet|büstiyer/.test(blob)) out.push("askılı basic", "büstiyer");
  if (/polo/.test(blob)) out.push("polo yaka");
  if (/jean|kot/.test(blob)) out.push("jean");
  if (/chino/.test(blob)) out.push("chino");
  if (/elbise|dress/.test(blob)) out.push("davet", "günlük şık");
  if (/trenç/.test(blob)) out.push("trençkot");
  if (/puffer|mont/.test(blob)) out.push("puffer");
  if (/sneaker|kanvas/.test(blob)) out.push("kanvas sneaker", "sneaker", "old skool");
  if (/bot/.test(blob)) out.push("bot", "1460");
  if (/loafer/.test(blob)) out.push("loafer");
  if (/gözlük/.test(blob)) out.push("güneş gözlüğü", "spor gözlük");
  if (/legging/.test(blob)) out.push("legging");
  if (/cap|şapka/.test(blob)) out.push("cap");
  if (/kemer/.test(blob)) out.push("kemer");
  return out;
}

function entryIsIconic(entry: BrandPoolEntry, needles: string[]): boolean {
  if (!entry.iconicFor?.length || !needles.length) return false;
  return entry.iconicFor.some((tag) => needles.some((n) => tag.includes(n) || n.includes(tag)));
}

/**
 * 2–3 brand names for extra Serp queries.
 * Crop/askılı/bralet → crop pool BEFORE tops. Does not touch the query ladder.
 */
export function pickDecidePoolBrands(
  profile: {
    category?: string;
    category_tr?: string;
    subcategory?: string;
    subcategory_tr?: string;
    price_mode?: string;
  },
  count = 3,
  seed = ""
): string[] {
  const tiers = allowedTiers(profile.price_mode);
  const categories = resolvePoolCategories(profile);
  const needles = iconicNeedles(profile);

  const seen = new Set<string>();
  const out: string[] = [];

  for (const category of categories) {
    if (out.length >= count) break;
    const catEntries = BRAND_POOL.filter((e) => e.category === category && tiers.includes(e.tier)).sort((a, b) => {
      const ai = entryIsIconic(a, needles) ? 0 : 1;
      const bi = entryIsIconic(b, needles) ? 0 : 1;
      return ai - bi;
    });
    const catBrands: string[] = [];
    for (const entry of catEntries) {
      for (const brand of entry.brands) {
        const key = normalizeBrandName(brand);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        catBrands.push(brand);
      }
    }
    const iconic = catEntries
      .filter((e) => entryIsIconic(e, needles))
      .flatMap((e) => e.brands)
      .filter((b, i, arr) => arr.findIndex((x) => normalizeBrandName(x) === normalizeBrandName(b)) === i);
    for (const b of iconic) {
      if (out.length >= count) break;
      if (out.some((x) => normalizeBrandName(x) === normalizeBrandName(b))) continue;
      out.push(b);
    }
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
    for (let i = 0; i < catBrands.length && out.length < count; i++) {
      const brand = catBrands[(hash + i * 7) % catBrands.length];
      if (out.some((x) => normalizeBrandName(x) === normalizeBrandName(brand))) continue;
      out.push(brand);
    }
  }
  return out.slice(0, count);
}

export function allPoolBrandNames(opts?: { tier?: BrandTier; includeDesigner?: boolean }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of BRAND_POOL) {
    if (opts?.tier && entry.tier !== opts.tier) continue;
    if (opts?.includeDesigner === false && entry.designer) continue;
    for (const b of entry.brands) {
      const key = normalizeBrandName(b);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(b);
    }
  }
  return out;
}

export function textHasPoolBrand(text: string, brands?: string[]): boolean {
  const t = (text || "").toLocaleLowerCase("tr-TR");
  if (!t) return false;
  const list = brands || allPoolBrandNames();
  return list.some((b) => {
    const name = normalizeBrandName(b);
    if (name.length < 3) return false;
    return t.includes(name) || t.includes(b.toLowerCase());
  });
}

export function textHasIconicPoolBrand(
  text: string,
  profile: {
    category?: string;
    category_tr?: string;
    subcategory?: string;
    subcategory_tr?: string;
  }
): boolean {
  const needles = iconicNeedles(profile);
  const categories = resolvePoolCategories(profile);
  const iconicBrands = BRAND_POOL.filter(
    (e) => categories.includes(e.category) && entryIsIconic(e, needles)
  ).flatMap((e) => e.brands);
  return textHasPoolBrand(text, iconicBrands);
}

export const LUXURY_POOL_BRANDS = allPoolBrandNames({ tier: "luxury" });
export const AFFORDABLE_POOL_BRANDS = allPoolBrandNames({ tier: "affordable" });
