/**
 * Fashion + niche brand catalogs for search diversity and trust boosts.
 * Used by pipeline query building / scoring — not a hard allowlist.
 */

export type BrandFamily =
  | "watch"
  | "shoes"
  | "hat"
  | "bag"
  | "eyewear"
  | "jewelry"
  | "fashion";

/** Watch / jewelry specialists (TR + international commonly sold online). */
export const WATCH_BRANDS = [
  "casio",
  "seiko",
  "citizen",
  "orient",
  "tissot",
  "swatch",
  "fossil",
  "daniel wellington",
  "michael kors",
  "tommy hilfiger",
  "guess",
  "emporio armani",
  "armani exchange",
  "hugo boss",
  "calvin klein",
  "diesel",
  "invicta",
  "timex",
  "garmin",
  "apple",
  "samsung",
  "huawei",
  "xiaomi",
  "rolex",
  "omega",
  "tag heuer",
  "longines",
  "hamilton",
  "breitling",
  "cartier",
  "bulova",
  "jacques lemans",
  "police",
  "lacoste",
];

/** Footwear specialists. */
export const SHOE_BRANDS = [
  "nike",
  "adidas",
  "puma",
  "new balance",
  "converse",
  "vans",
  "reebok",
  "asics",
  "skechers",
  "timberland",
  "dr. martens",
  "dr martens",
  "clarks",
  "geox",
  "ecco",
  "birkenstock",
  "crocs",
  "ugg",
  "flo",
  "lumberjack",
  "hotiç",
  "hotic",
  "kemal tanca",
  "derimod",
  "inci",
  "polarıs",
  "polaris",
  "lescon",
  "kinetix",
  "slazenger",
  "superga",
  "goldberg",
  "common projects",
  "golden goose",
  "axel arigato",
  "veja",
  "onitsuka tiger",
  "salomon",
  "merrell",
  "columbia",
  "the north face",
  "jordan",
  "yeezy",
];

/** Hats / headwear. */
export const HAT_BRANDS = [
  "new era",
  "nike",
  "adidas",
  "puma",
  "the north face",
  "columbia",
  "carhartt",
  "brixton",
  "kangol",
  "stetson",
  "goorin",
  "goorin bros",
  "buff",
  "dickies",
  "lacoste",
  "tommy hilfiger",
  "calvin klein",
  "guess",
  "defacto",
  "koton",
  "mavi",
  "pull&bear",
  "bershka",
  "zara",
  "h&m",
];

/** Bags. */
export const BAG_BRANDS = [
  "michael kors",
  "coach",
  "guess",
  "karl lagerfeld",
  "tommy hilfiger",
  "calvin klein",
  "lacoste",
  "desa",
  "derimod",
  "hotiç",
  "hotic",
  "vakko",
  "beymen",
  "machka",
  "twist",
  "network",
  "kipling",
  "eastpak",
  "herschel",
  "fjallraven",
  "samsonite",
  "pierre cardin",
  "steve madden",
  "aldo",
  "charles & keith",
  "charles and keith",
  "mango",
  "zara",
  "bershka",
];

/** Eyewear. */
export const EYEWEAR_BRANDS = [
  "ray-ban",
  "rayban",
  "oakley",
  "persol",
  "carrera",
  "polaroid",
  "vogue",
  "tommy hilfiger",
  "hugo boss",
  "emporio armani",
  "giorgio armani",
  "prada",
  "gucci",
  "dior",
  "chanel",
  "tom ford",
  "michael kors",
  "guess",
  "fossil",
  "swatch",
  "lacoste",
  "nike",
  "adidas",
];

/** Fashion apparel brands (diversity beyond the old short list). */
export const FASHION_BRANDS = [
  "zara",
  "mango",
  "h&m",
  "bershka",
  "pull&bear",
  "stradivarius",
  "massimo dutti",
  "reserved",
  "sinsay",
  "cropp",
  "newyorker",
  "koton",
  "mavi",
  "defacto",
  "lc waikiki",
  "colin's",
  "colins",
  "trendyolmilla",
  "trendyol milla",
  "nike",
  "adidas",
  "puma",
  "under armour",
  "lululemon",
  "gap",
  "uniqlo",
  "cos",
  "arket",
  "& other stories",
  "tommy hilfiger",
  "calvin klein",
  "guess",
  "lacoste",
  "ralph lauren",
  "hugo boss",
  "diesel",
  "levi's",
  "levis",
  "lee",
  "wrangler",
  "only",
  "vero moda",
  "jack & jones",
  "selected",
  "selected homme",
  "peach john",
  "oysho",
  "lefties",
  "boyner",
  "network",
  "twist",
  "machka",
  "yargıcı",
  "vakko",
  "beymen",
  "les benjamins",
  "ipekyol",
  "twist",
  "perspective",
  "barcin",
];

export function resolveBrandFamily(
  category: string,
  categoryTr: string
): BrandFamily {
  const blob = `${category} ${categoryTr}`.toLowerCase();
  if (/saat|watch|wrist/.test(blob)) return "watch";
  if (/gözlük|glasses|sunglasses|eyewear/.test(blob)) return "eyewear";
  if (/ayakkabı|sneaker|bot|sandal|loafer|heel|oxford|shoe|boot/.test(blob)) return "shoes";
  if (/şapka|hat|bere|beanie|cap|bucket/.test(blob)) return "hat";
  if (/çanta|bag|backpack|clutch|tote|handbag/.test(blob)) return "bag";
  if (/kolye|küpe|bileklik|yüzük|necklace|earring|bracelet|ring|takı|jewelry/.test(blob)) {
    return "jewelry";
  }
  return "fashion";
}

export function getNicheBrands(family: BrandFamily): string[] {
  switch (family) {
    case "watch":
    case "jewelry":
      return WATCH_BRANDS;
    case "shoes":
      return SHOE_BRANDS;
    case "hat":
      return HAT_BRANDS;
    case "bag":
      return BAG_BRANDS;
    case "eyewear":
      return EYEWEAR_BRANDS;
    default:
      return FASHION_BRANDS;
  }
}

/** Pick a stable rotating slice of brands for Serp query suffixes. */
export function pickBrandQuerySuffixes(
  family: BrandFamily,
  count = 3,
  seed = ""
): string[] {
  const brands = getNicheBrands(family);
  if (!brands.length || count <= 0) return [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % brands.length;
  const out: string[] = [];
  for (let i = 0; i < Math.min(count, brands.length); i++) {
    out.push(brands[(hash + i * 7) % brands.length]);
  }
  return out;
}

export function titleOrSourceHasBrand(text: string, brands: string[]): boolean {
  const t = (text || "").toLowerCase();
  if (!t) return false;
  return brands.some((b) => {
    const name = b.toLowerCase();
    return name.length >= 3 && t.includes(name);
  });
}
