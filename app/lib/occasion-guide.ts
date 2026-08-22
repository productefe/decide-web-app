import { parseOccasion, type Occasion } from "@/lib/preferences";
import { asLower, asText } from "@/lib/text";

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
  /**
   * Always-clash tokens — dropped even if the photo itself matches them
   * (spor never returns kumaş pantolon; iş never returns eşofman).
   */
  hardAvoidTerms?: string[];
  /** Extra GPT-4o extraction guidance — never change visible garment type. */
  visionNote: string;
  /** Stylist rules for complementary Combine slots. */
  combineNote: string;
};

const GUIDES: Record<Occasion, OccasionGuide> = {
  spor: {
    labelTr: "Spor",
    searchPhrase: "spor antrenman eşofman jogger",
    boostTerms: [
      "spor",
      "athleisure",
      "antrenman",
      "fitness",
      "gym",
      "koşu",
      "running",
      "eşofman",
      "esofman",
      "jogger",
      "tayt",
      "leggings",
      "sweatshirt",
      "hoodie",
      "sneaker",
      "spor ayakkabı",
      "antrenman şort",
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
      "kumas pantolon",
      "chino",
      "oxford",
      "loafer",
      "smart casual",
      "business",
      "pileli",
      "palazzo",
      "bikini",
      "mayo",
      "plaj",
    ],
    hardAvoidTerms: [
      "kumaş pantolon",
      "kumas pantolon",
      "chino",
      "oxford",
      "loafer",
      "topuklu",
      "stiletto",
      "blazer",
    ],
    visionNote: `User will shop alternatives for SPORT / training / gym / athleisure.
Extract the visible garments faithfully — do not swap a blouse for a tank or heels for sneakers.
Emphasize sport-relevant attributes in distinctive_details and style_tags: athletic cut, stretch/performance fabric impression, jogger cuff, mesh panels, sneaker type (running vs lifestyle).
style_tags must include "spor" plus 1–2 of: athleisure, antrenman, fitness, jogger.
NEVER tag or describe the piece as ofis / kumaş pantolon / chino / gömlek / loafer.
If the piece is NOT sporty, still extract it as-is and tag the closest wearable sport reading (e.g. cotton tee → antrenman tişört), never invent a different subcategory.`,
    combineNote: `OCCASION = Spor (training / gym / athleisure). HARD RULE: never office or evening garments.
- top: tişört / atlet / sweatshirt / hoodie — no gömlek, no bluz, no blazer, no polo ofis
- bottom: ONLY jogger, eşofman, tayt, spor şort — NEVER chino, NEVER kumaş pantolon, NEVER klasik/ofis pantolon, NEVER pileli
- shoes: ONLY sneaker / spor ayakkabı — never topuklu, loafer, oxford, klasik bot
- accessory: spor çanta, cap, silikon kayışlı saat — no clutch, no inci, no kravat
searchQuery MUST include at least one of: spor, antrenman, jogger, eşofman, sneaker.`,
  },
  gundelik: {
    labelTr: "Gündelik",
    searchPhrase: "günlük casual street",
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
      "eşofman",
      "esofman",
      "jogger",
      "kumaş pantolon",
      "ofis gömleği",
      "smart casual",
      "bikini",
      "mayo",
      "plaj",
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
    searchPhrase: "akşam davet şık abiye cocktail",
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
      "chino",
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
    searchPhrase: "iş ofis smart casual business casual",
    boostTerms: [
      "iş",
      "ofis",
      "gömlek",
      "gomlek",
      "blazer",
      "chino",
      "kumaş pantolon",
      "klasik",
      "smart casual",
      "business casual",
      "oxford",
      "loafer",
      "polo",
      "ofis pantolon",
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
      "leggings",
      "pijama",
      "lounge",
      "spor ayakkabı",
      "sneaker",
      "koşu",
      "running",
      "yırtık",
      "ripped",
      "crop sweat",
      "bel çantası",
      "cap",
      "bikini",
      "mayo",
      "plaj",
    ],
    hardAvoidTerms: [
      "eşofman",
      "esofman",
      "jogger",
      "hoodie",
      "tayt",
      "spor ayakkabı",
      "koşu ayakkabı",
      "yırtık",
    ],
    visionNote: `User will shop alternatives for WORK / office / business casual / smart casual.
Extract the visible garments faithfully — a hoodie stays a hoodie; do not relabel it as a gömlek.
Emphasize work-relevant attributes: collar structure, tailored vs regular, chino vs jean, loafer/oxford vs sneaker, wrinkle-resistant / woven impression.
style_tags must include "iş" or "ofis" plus 1–2 of: smart-casual, business-casual, klasik, ofis.
If the piece is casual, extract it as-is and note the most office-appropriate reading of THAT type (e.g. düz polo), never invent a different subcategory.`,
    combineNote: `OCCASION = İş (office / business casual / smart casual). Polished enough for work; not gym, not lounge, not davet-abiye.
- top: gömlek, polo, bluz, ince triko, blazer — no hoodie, no grafik tişört, no spor atlet, no sweat
- bottom: chino, kumaş pantolon, ofis eteği, koyu düz jean — NEVER jogger, NEVER eşofman, NEVER yırtık jean, NEVER tayt
- shoes: loafer, oxford, sade deri bot — NEVER spor koşu sneaker, NEVER topuklu gece
- accessory: deri kemer, klasik kol saati (deri/metal), sade çanta — no spor cap, no clutch, no bel çantası
searchQuery MUST include at least one of: iş, ofis, smart casual, business casual, gömlek, chino, loafer.`,
  },
  sahil: {
    labelTr: "Sahil",
    searchPhrase: "sahil plaj",
    boostTerms: [
      "sahil",
      "plaj",
      "şort",
      "short",
      "bikini",
      "mayo",
      "swimsuit",
      "pareo",
      "plaj çantası",
      "hasır çanta",
      "sandalet",
      "terlik",
      "güneş gözlüğü",
      "deniz",
    ],
    avoidTerms: [
      "blazer",
      "gömlek",
      "gomlek",
      "kumaş pantolon",
      "kumas pantolon",
      "chino",
      "ofis",
      "klasik",
      "oxford",
      "loafer",
      "topuklu",
      "stiletto",
      "abiye",
      "hoodie",
      "eşofman",
      "esofman",
      "jogger",
      "kaban",
      "trenç",
    ],
    hardAvoidTerms: [
      "kumaş pantolon",
      "kumas pantolon",
      "chino",
      "blazer",
      "oxford",
      "topuklu",
      "eşofman",
      "jogger",
      "hoodie",
    ],
    visionNote: `User will shop alternatives for BEACH / sahil / plaj.
Extract the visible garments faithfully.
Emphasize beach-relevant attributes: şort vs pantolon, bikini/mayo vs tişört, sandalet vs sneaker, plaj çantası vs city bag, hasır/straw, open weave.
style_tags must include "sahil" plus 1–2 of: plaj, bikini, şort, mayo.
If the piece is a regular tee or trousers, extract it as-is and tag the closest beach reading of THAT type (e.g. keten şort, crop), never invent a different subcategory unless the photo clearly shows swimwear.`,
    combineNote: `OCCASION = Sahil (beach / plaj). HARD RULE: resort/beach only — never office, never evening, never gym jogger.
- top: bikini, mayo, crop, atlet, keten gömlek açık — no hoodie, no blazer, no ofis gömleği
- bottom: ONLY şort / deniz şortu / bikini alt — NEVER kumaş pantolon, NEVER chino, NEVER jogger, NEVER eşofman
- shoes: sandalet, plaj terliği — NEVER topuklu, oxford, loafer, koşu sneaker
- accessory: plaj çantası, hasır çanta, güneş gözlüğü, şapka — no clutch, no kravat, no spor bel çantası
For kadın prefer bikini / mayo. For erkek prefer deniz şortu / mayo — NEVER bikini.
searchQuery MUST include at least one of: sahil, plaj, şort, bikini, mayo, plaj çantası, sandalet.`,
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
  is: "ofis smart casual",
  sahil: "plaj çantası hasır",
};

type PieceFamily = "bottom" | "shoes" | "top" | "dress" | "swim" | "other";

function pieceFamily(category: string, subcategory: string, categoryTr = ""): PieceFamily {
  const blob = `${category} ${subcategory} ${categoryTr}`.toLocaleLowerCase("tr-TR");
  if (/bikini|mayo|swimsuit|pareo/.test(blob)) return "swim";
  if (/bottom|pantolon|jean|chino|jogger|eşofman|esofman|şort|short|tayt|legging|etek|skirt/.test(blob)) {
    return "bottom";
  }
  if (/shoe|ayakkabı|ayakkabi|sneaker|loafer|oxford|bot|sandal|heel|topuk/.test(blob)) {
    return "shoes";
  }
  if (/dress|elbise|jumpsuit|tulum/.test(blob)) return "dress";
  if (/top|tişört|tisort|gömlek|gomlek|hoodie|sweat|bluz|polo|shirt|kazak/.test(blob)) {
    return "top";
  }
  return "other";
}

const PIECE_SEARCH_PHRASE: Record<Occasion, Partial<Record<PieceFamily, string>>> = {
  spor: {
    bottom: "jogger eşofman tayt spor şort antrenman",
    shoes: "sneaker spor ayakkabı",
    top: "spor tişört athleisure antrenman",
    dress: "spor athleisure",
  },
  gundelik: {
    bottom: "jean günlük casual",
    shoes: "sneaker loafer bot günlük",
    top: "günlük casual tişört",
  },
  aksam: {
    bottom: "kumaş pantolon şık etek abiye",
    shoes: "topuklu şık loafer",
    top: "saten bluz şık gömlek akşam",
    dress: "abiye davet elbise",
  },
  ev: {
    bottom: "eşofman lounge jogger rahat",
    shoes: "terlik ev ayakkabısı",
    top: "lounge sweatshirt polar rahat",
  },
  is: {
    bottom: "chino kumaş pantolon ofis smart casual",
    shoes: "loafer oxford klasik",
    top: "gömlek polo blazer smart casual ofis",
    dress: "ofis elbise smart casual",
  },
  sahil: {
    bottom: "şort plaj deniz şortu",
    shoes: "sandalet plaj terliği",
    top: "plaj keten atlet",
    dress: "pareo plaj elbisesi",
    swim: "bikini mayo plaj",
  },
};

export function getAccessoryOccasionPhrase(occasion: Occasion | null | undefined): string {
  if (!occasion) return "";
  return ACCESSORY_OCCASION_PHRASE[occasion] || "";
}

export function getOccasionKeywordForPiece(
  occasion: Occasion | null | undefined,
  opts: { forAccessory?: boolean; category?: string; subcategory?: string; category_tr?: string } = {}
): string {
  if (!occasion) return "";
  if (opts.forAccessory) return getAccessoryOccasionPhrase(occasion);
  const family = pieceFamily(
    asText(opts.category),
    asText(opts.subcategory),
    asText(opts.category_tr)
  );
  return PIECE_SEARCH_PHRASE[occasion][family] || getOccasionKeyword(occasion);
}

/** Read inferred wear context from GPT-4o JSON (`occasion` root or style_tags). */
export function parseVisionWearOccasion(visionContent: string): Occasion | null {
  try {
    const clean = visionContent.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as {
      occasion?: unknown;
      wear_context?: unknown;
      context?: unknown;
      items?: Array<{ style_tags?: unknown }>;
    };
    const direct =
      parseOccasion(parsed.occasion) ||
      parseOccasion(parsed.wear_context) ||
      parseOccasion(parsed.context);
    if (direct) return direct;
    const tags = (parsed.items || [])
      .flatMap((item) => (Array.isArray(item.style_tags) ? item.style_tags : []))
      .map((t) => asText(t))
      .join(" ");
    const hits = new Set<Occasion>();
    for (const token of tags.split(/[\s,;/|]+/)) {
      const hit = parseOccasion(token);
      if (hit) hits.add(hit);
    }
    if (hits.size === 0) return null;
    const priority: Occasion[] = ["sahil", "spor", "aksam", "is", "ev", "gundelik"];
    return priority.find((occ) => hits.has(occ)) ?? [...hits][0];
  } catch {
    return null;
  }
}

export function resolveDecideOccasion(
  userOccasion: Occasion | null | undefined,
  visionContent: string
): Occasion {
  return userOccasion || parseVisionWearOccasion(visionContent) || "gundelik";
}

export function pieceBlobForOccasion(profile: {
  category?: string;
  category_tr?: string;
  subcategory?: string;
  subcategory_tr?: string;
  search_query?: string;
}): string {
  return [
    asText(profile.category),
    asText(profile.category_tr),
    asText(profile.subcategory),
    asText(profile.subcategory_tr),
    asText(profile.search_query),
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
export function titleHasTerm(title: unknown, term: unknown): boolean {
  const t = asLower(title);
  const w = asLower(term);
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
  const avoidHit =
    avoidTermsForPiece(guide, pieceBlob).some((w) => titleHasTerm(title, w)) ||
    (guide.hardAvoidTerms || []).some((w) => titleHasTerm(title, w));
  if (avoidHit) return "avoid";
  if (boostHit) return "boost";
  return "neutral";
}

/** Append occasion shopping words that are not already in the query. */
export function withOccasionSearchPhrase(
  query: string,
  occasion: Occasion | null | undefined,
  opts: {
    forAccessory?: boolean;
    category?: string;
    subcategory?: string;
    category_tr?: string;
  } = {}
): string {
  const phrase = getOccasionKeywordForPiece(occasion, opts);
  const raw = asText(query);
  if (!raw.trim()) return phrase;
  if (!phrase) return raw.trim().replace(/\s+/g, " ");
  const q = asLower(raw);
  const extra = phrase
    .split(/\s+/)
    .filter((w) => w && !q.includes(asLower(w)));
  return [raw.trim(), ...extra].join(" ").replace(/\s+/g, " ").trim();
}
