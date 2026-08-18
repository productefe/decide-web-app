import type { Occasion } from "@/lib/preferences";

export type OccasionGuide = {
  labelTr: string;
  /** Short Turkish shopping keywords injected into Serp queries. */
  searchPhrase: string;
  /** Title tokens that mean the listing fits this occasion. */
  boostTerms: string[];
  /**
   * Title tokens that clash with this occasion. Ignored when they already
   * describe the source piece (hoodie photo + iş still finds hoodies).
   */
  avoidTerms: string[];
  /** Extra GPT-4o extraction guidance — never change visible garment type. */
  visionNote: string;
  /** Stylist rules for complementary Combine slots. */
  combineNote: string;
};

const GUIDES: Record<Occasion, OccasionGuide> = {
  spor: {
    labelTr: "Spor",
    searchPhrase: "spor athleisure antrenman",
    boostTerms: [
      "spor",
      "athleisure",
      "antrenman",
      "fitness",
      "gym",
      "koşu",
      "running",
      "eşofman",
      "jogger",
      "tayt",
      "leggings",
      "sweatshirt",
      "hoodie",
      "sneaker",
      "spor ayakkabı",
    ],
    avoidTerms: [
      "blazer",
      "gömlek",
      "gomlek",
      "klasik",
      "ofis",
      "resmi",
      "topuklu",
      "stiletto",
      "abiye",
      "davet",
      "smokin",
      "kumaş pantolon",
      "oxford",
    ],
    visionNote: `User will shop alternatives for SPORT / training / athleisure.
Extract the visible garments faithfully — do not swap a blouse for a tank or heels for sneakers.
Emphasize sport-relevant attributes in distinctive_details and style_tags: athletic cut, stretch/performance fabric impression, jogger cuff, mesh panels, sneaker type (running vs lifestyle).
style_tags must include "spor" plus 1–2 of: athleisure, antrenman, fitness, casual-sport.
If the piece is NOT sporty, still extract it as-is and tag the closest wearable sport reading (e.g. cotton tee → antrenman tişört), never invent a different subcategory.`,
    combineNote: `OCCASION = Spor (training / athleisure). Every complementary piece must look gym-or-street-sport, never office or evening.
- top: tişört / atlet / sweatshirt / hoodie — no gömlek, no bluz, no blazer
- bottom: jogger, eşofman, tayt, spor şort — no chino, no kumaş pantolon, no jean ofis
- shoes: ONLY sneaker / spor ayakkabı — never topuklu, loafer, oxford, bot (unless trail)
- accessory: spor çanta, cap, silikon kayışlı saat — no clutch, no inci, no kravat
searchQuery MUST include at least one of: spor, athleisure, antrenman, jogger, sneaker.`,
  },
  gundelik: {
    labelTr: "Gündelik",
    searchPhrase: "günlük casual rahat",
    boostTerms: [
      "günlük",
      "gunluk",
      "casual",
      "rahat",
      "jean",
      "denim",
      "tişört",
      "tisort",
      "overshirt",
      "sweatshirt",
    ],
    avoidTerms: [
      "abiye",
      "davet",
      "smokin",
      "resmi",
      "ofis gömlek",
      "topuklu",
      "stiletto",
      "pijama",
      "lounge",
      "antrenman",
      "gym",
    ],
    visionNote: `User will shop alternatives for EVERYDAY / casual wear (street, campus, weekend — not gym, not office, not evening).
Extract the visible garments faithfully.
Emphasize everyday attributes: denim wash, casual collar, regular/oversize cut, lifestyle sneaker vs loafer.
style_tags must include "gündelik" or "casual" plus 1–2 of: günlük, rahat, street.
Do not retag a blazer as sport or a gown as casual — keep subcategory honest, tag the everyday reading of that same piece.`,
    combineNote: `OCCASION = Gündelik (everyday casual). Wearable on the street, not gym kit and not evening dress.
- top: tişört, sweatshirt, casual gömlek, overshirt, hırka — not smokin gömlek, not spor atlet
- bottom: jean, chino, casual pantolon, etek — not eşofman, not kumaş resmi, not tayt
- shoes: sneaker, loafer, bot — not topuklu, not ev terliği
- accessory: günlük çanta, kemer, sade saat, güneş gözlüğü — not clutch, not spor bel çantası
searchQuery MUST include at least one of: günlük, casual, rahat.`,
  },
  aksam: {
    labelTr: "Akşam",
    searchPhrase: "akşam davet şık abiye",
    boostTerms: [
      "akşam",
      "aksam",
      "şık",
      "sik",
      "abiye",
      "davet",
      "saten",
      "gece",
      "cocktail",
      "topuklu",
      "klutch",
      "clutch",
    ],
    avoidTerms: [
      "eşofman",
      "esofman",
      "jogger",
      "antrenman",
      "gym",
      "spor",
      "kapüşon",
      "kapuson",
      "hoodie",
      "tayt",
      "pijama",
      "lounge",
      "ev giyim",
    ],
    visionNote: `User will shop alternatives for EVENING / going-out / davet.
Extract the visible garments faithfully — a t-shirt stays a t-shirt; do not relabel it as a dress.
Emphasize evening-relevant attributes: fabric sheen (saten/ipek), drape, neckline, heel vs loafer, jewelry-ready details.
style_tags must include "akşam" plus 1–2 of: şık, davet, abiye, gece.
If the piece is casual, extract it as-is and note the dressiest honest reading of THAT type (e.g. siyah slim tişört), never invent evening-only categories.`,
    combineNote: `OCCASION = Akşam (evening / davet). Dressier than gündelik; not office, not gym.
- top: ipek/saten bluz, şık gömlek, drape top — no hoodie, no spor tişört, no sweatshirt
- bottom: kumaş pantolon, midi etek, şık jean — no jogger, no eşofman, no kargo
- shoes: topuklu, zarif loafer, şık bot — NEVER sneaker / spor ayakkabı
- accessory: clutch, ince kemer, metal/deri kayışlı saat, şık küpe/kolye — no spor çanta, no cap
searchQuery MUST include at least one of: akşam, şık, davet, abiye.`,
  },
  ev: {
    labelTr: "Ev",
    searchPhrase: "ev rahat lounge",
    boostTerms: [
      "ev",
      "rahat",
      "lounge",
      "pijama",
      "ev giyim",
      "polar",
      "yumuşak",
      "terlik",
    ],
    avoidTerms: [
      "blazer",
      "topuklu",
      "stiletto",
      "ofis",
      "resmi",
      "davet",
      "abiye",
      "smokin",
      "oxford",
      "klasik gömlek",
    ],
    visionNote: `User will shop alternatives for HOME / lounge.
Extract the visible garments faithfully.
Emphasize home-relevant attributes: soft knit, relaxed/oversize, lounge vs pijama, indoor slipper vs sneaker.
style_tags must include "ev" plus 1–2 of: rahat, lounge, ev-giyim.
Do not relabel outdoor pieces as pijama — keep subcategory honest, tag the at-home reading of that same piece.`,
    combineNote: `OCCASION = Ev (home / lounge). Soft, relaxed, indoor-first. Not office, not evening, not gym-performance.
- top: soft sweatshirt, oversize tişört, polar, lounge hırka — no blazer, no resmi gömlek
- bottom: jogger, eşofman, rahat pantolon, lounge şort — no kumaş ofis, no skinny resmi
- shoes: terlik, ev ayakkabısı, rahat sneaker — NEVER topuklu / oxford / resmi loafer
- accessory: keep minimal; soft scarf or none-like bag — no clutch, no kravat, no spor bel çantası
searchQuery MUST include at least one of: ev, rahat, lounge.`,
  },
  is: {
    labelTr: "İş",
    searchPhrase: "iş ofis smart casual",
    boostTerms: [
      "iş",
      "ofis",
      "gömlek",
      "gomlek",
      "blazer",
      "chino",
      "kumaş",
      "klasik",
      "smart",
      "oxford",
      "loafer",
    ],
    avoidTerms: [
      "eşofman",
      "esofman",
      "jogger",
      "antrenman",
      "gym",
      "kapüşon",
      "kapuson",
      "hoodie",
      "tayt",
      "pijama",
      "lounge",
      "spor",
      "crop sweat",
    ],
    visionNote: `User will shop alternatives for WORK / office / smart casual.
Extract the visible garments faithfully — a hoodie stays a hoodie; do not relabel it as a gömlek.
Emphasize work-relevant attributes: collar structure, tailored vs regular, chino vs jean, loafer/oxford vs sneaker, wrinkle-resistant / woven impression.
style_tags must include "iş" or "ofis" plus 1–2 of: smart-casual, klasik, ofis.
If the piece is casual, extract it as-is and note the most office-appropriate reading of THAT type (e.g. düz polo), never invent a different subcategory.`,
    combineNote: `OCCASION = İş (office / smart casual). Polished enough for work; not gym, not lounge, not davet-abiye.
- top: gömlek, polo, bluz, ince triko, blazer — no hoodie, no grafik tişört, no spor atlet
- bottom: chino, kumaş pantolon, ofis eteği, koyu düz jean — no jogger, no eşofman, no yırtık jean, no tayt
- shoes: loafer, oxford, sade bot, temiz sneaker only if leather-look — NEVER spor koşu / topuklu gece
- accessory: deri kemer, klasik kol saati (deri/metal), sade çanta — no spor cap, no clutch, no bel çantası
searchQuery MUST include at least one of: iş, ofis, smart casual, gömlek, chino, loafer.`,
  },
};

export function getOccasionGuide(occasion: Occasion | null | undefined): OccasionGuide | null {
  if (!occasion) return null;
  return GUIDES[occasion] ?? null;
}

/** Shopping keywords for Serp queries (legacy name kept for callers). */
export function getOccasionKeyword(occasion: Occasion | null | undefined): string {
  return getOccasionGuide(occasion)?.searchPhrase || "";
}

/**
 * Occasion words that are safe to append to accessory searches.
 * Full phrases include garment types (abiye, gömlek) that pull dresses/shirts.
 */
const ACCESSORY_OCCASION_PHRASE: Record<Occasion, string> = {
  spor: "spor",
  gundelik: "günlük casual",
  aksam: "akşam şık davet",
  ev: "rahat",
  is: "ofis",
};

export function getAccessoryOccasionPhrase(occasion: Occasion | null | undefined): string {
  if (!occasion) return "";
  return ACCESSORY_OCCASION_PHRASE[occasion] || "";
}

export function pieceBlobForOccasion(profile: {
  category?: string;
  category_tr?: string;
  subcategory?: string;
  subcategory_tr?: string;
  search_query?: string;
}): string {
  return [
    profile.category,
    profile.category_tr,
    profile.subcategory,
    profile.subcategory_tr,
    profile.search_query,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function avoidTermsForPiece(guide: OccasionGuide, pieceBlob: string): string[] {
  const blob = pieceBlob.toLocaleLowerCase("tr-TR");
  return guide.avoidTerms.filter((term) => !titleHasTerm(blob, term));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Short tokens like "ev" / "iş" must not match inside "level" / "istanbul". */
export function titleHasTerm(title: string, term: string): boolean {
  const t = title.toLocaleLowerCase("tr-TR");
  const w = term.toLocaleLowerCase("tr-TR");
  if (!t || !w) return false;
  if (w.length <= 3) {
    const re = new RegExp(`(?:^|[^a-z0-9çğıöşü])${escapeRegExp(w)}(?:$|[^a-z0-9çğıöşü])`, "i");
    return re.test(t);
  }
  return t.includes(w);
}

export type OccasionTitleFit = "boost" | "avoid" | "neutral";

export function occasionTitleFit(
  title: string,
  occasion: Occasion | null | undefined,
  pieceBlob = ""
): OccasionTitleFit {
  const guide = getOccasionGuide(occasion);
  if (!guide || !title) return "neutral";
  const boostHit = guide.boostTerms.some((w) => titleHasTerm(title, w));
  const avoidHit = avoidTermsForPiece(guide, pieceBlob).some((w) => titleHasTerm(title, w));
  if (avoidHit) return "avoid";
  if (boostHit) return "boost";
  return "neutral";
}

/** Append occasion shopping words that are not already in the query. */
export function withOccasionSearchPhrase(
  query: string,
  occasion: Occasion | null | undefined,
  opts: { forAccessory?: boolean } = {}
): string {
  const phrase = opts.forAccessory
    ? getAccessoryOccasionPhrase(occasion)
    : getOccasionKeyword(occasion);
  if (!query.trim()) return phrase;
  if (!phrase) return query.trim().replace(/\s+/g, " ");
  const q = query.toLocaleLowerCase("tr-TR");
  const extra = phrase
    .split(/\s+/)
    .filter((w) => w && !q.includes(w.toLocaleLowerCase("tr-TR")));
  return [query.trim(), ...extra].join(" ").replace(/\s+/g, " ").trim();
}
