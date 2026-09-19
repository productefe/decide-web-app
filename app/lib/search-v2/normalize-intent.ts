import {
  EXTRACTOR_VERSION,
  type LayerRole,
  type OutfitIntent,
  type PieceFamily,
  type ProductIntent,
  type Visibility,
} from "./schema";
import { dbg } from "./debug-log";

const FAMILY_ALIASES: Record<string, PieceFamily> = {
  jersey: "jersey",
  "football-jersey": "jersey",
  "futbol forması": "jersey",
  forma: "jersey",
  formasi: "jersey",
  sweatshirt: "sweatshirt",
  sweat: "sweatshirt",
  kazak: "sweatshirt",
  pullover: "sweatshirt",
  jumper: "sweatshirt",
  crewneck: "sweatshirt",
  polar: "sweatshirt",
  fleece: "sweatshirt",
  sweater: "sweatshirt",
  hoodie: "hoodie",
  kapüşonlu: "hoodie",
  tee: "tee",
  tshirt: "tee",
  "t-shirt": "tee",
  tişört: "tee",
  tisort: "tee",
  shirt: "shirt",
  gömlek: "shirt",
  gomlek: "shirt",
  blouse: "blouse",
  bluz: "blouse",
  blazer: "blazer",
  ceket: "jacket",
  jacket: "jacket",
  mont: "coat",
  coat: "coat",
  pantolon: "pants",
  pants: "pants",
  jeans: "jeans",
  kot: "jeans",
  etek: "skirt",
  skirt: "skirt",
  elbise: "dress",
  dress: "dress",
  şort: "shorts",
  short: "shorts",
  shorts: "shorts",
  terlik: "shoes",
  slipper: "shoes",
  slippers: "shoes",
  ayakkabı: "shoes",
  ayakkabi: "shoes",
  shoes: "shoes",
  sneakers: "sneakers",
  sneaker: "sneakers",
  sporayakkabı: "sneakers",
  bot: "boots",
  boots: "boots",
  çanta: "bag",
  canta: "bag",
  bag: "bag",
  saat: "watch",
  watch: "watch",
  kolye: "necklace",
  necklace: "necklace",
  bileklik: "bracelet",
  bracelet: "bracelet",
  küpe: "earrings",
  kupe: "earrings",
  earrings: "earrings",
  yüzük: "ring",
  yuzuk: "ring",
  ring: "ring",
  gözlük: "sunglasses",
  gozluk: "sunglasses",
  sunglasses: "sunglasses",
  kemer: "belt",
  belt: "belt",
  şapka: "hat",
  sapka: "hat",
  hat: "hat",
  atkı: "scarf",
  atki: "scarf",
  scarf: "scarf",
};

const JEWELRY = new Set<PieceFamily>(["necklace", "bracelet", "earrings", "ring", "watch"]);
const ACCESSORY = new Set<PieceFamily>(["bag", "sunglasses", "belt", "hat", "scarf"]);

const COLOR_CANON: Record<string, string> = {
  siyah: "siyah",
  black: "siyah",
  beyaz: "beyaz",
  white: "beyaz",
  kırmızı: "kırmızı",
  kirmizi: "kırmızı",
  red: "kırmızı",
  mavi: "mavi",
  blue: "mavi",
  lacivert: "lacivert",
  navy: "lacivert",
  yeşil: "yeşil",
  yesil: "yeşil",
  green: "yeşil",
  sarı: "sarı",
  sari: "sarı",
  yellow: "sarı",
  turuncu: "turuncu",
  orange: "turuncu",
  pembe: "pembe",
  pink: "pembe",
  mor: "mor",
  purple: "mor",
  gri: "gri",
  gray: "gri",
  grey: "gri",
  kahverengi: "kahverengi",
  brown: "kahverengi",
  bej: "bej",
  beige: "bej",
  krem: "krem",
  cream: "krem",
  bordo: "bordo",
  burgundy: "bordo",
};

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function asLower(v: unknown): string {
  return asText(v).toLocaleLowerCase("tr-TR");
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function canonColor(raw: string): string {
  const k = asLower(raw).replace(/\s+/g, "");
  if (COLOR_CANON[k]) return COLOR_CANON[k];
  const words = asLower(raw).split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    if (COLOR_CANON[words[i]]) return COLOR_CANON[words[i]];
  }
  return asLower(raw);
}

function knitFamilyFromText(text: string, declaredFamily: string): PieceFamily | null {
  const declared = asLower(declaredFamily);
  if (declared && !["tee", "blouse", "shirt", "other"].includes(declared)) return null;
  const t = asLower(text);
  if (/hoodie|kapüşonlu|kapusonlu/.test(t) && !/kazak/.test(t)) return "hoodie";
  if (/sweatshirt|\bsweat\b|kazak|pullover|jumper|crewneck|sweater|polar|fleece|eşofman üst/.test(t)) {
    return "sweatshirt";
  }
  return null;
}

function jewelryFamilyFromText(text: string): PieceFamily | null {
  const t = asLower(text);
  if (/küpe|kupe|earring/.test(t)) return "earrings";
  if (/kolye|necklace/.test(t)) return "necklace";
  if (/bileklik|bracelet/.test(t)) return "bracelet";
  if (/yüzük|yuzuk/.test(t) || /\bring\b/.test(t)) return "ring";
  if (/saat|watch/.test(t)) return "watch";
  return null;
}

export function canonFamily(...parts: string[]): PieceFamily {
  const jewelry = jewelryFamilyFromText(parts.join(" "));
  if (jewelry) return jewelry;
  for (const p of parts) {
    const key = asLower(p).replace(/\s+/g, "");
    if (FAMILY_ALIASES[key]) return FAMILY_ALIASES[key];
    for (const [alias, fam] of Object.entries(FAMILY_ALIASES)) {
      if (alias.length < 3) continue;
      if (key.includes(alias)) return fam;
    }
  }
  return "other";
}

function defaultLayer(family: PieceFamily): LayerRole {
  if (JEWELRY.has(family)) return "jewelry";
  if (ACCESSORY.has(family)) return "accessory";
  if (family === "shoes" || family === "sneakers" || family === "boots") return "footwear";
  if (["pants", "jeans", "skirt", "shorts"].includes(family)) return "bottom";
  if (["blazer", "jacket", "coat"].includes(family)) return "outer";
  if (["tee", "shirt", "blouse"].includes(family)) return "inner";
  if (["sweatshirt", "hoodie", "jersey"].includes(family)) return "mid";
  if (family === "dress") return "mid";
  return "mid";
}

function defaultCategoryTr(family: PieceFamily, subtype: string): string {
  const map: Record<PieceFamily, string> = {
    jersey: "Forma",
    sweatshirt: "Sweatshirt",
    hoodie: "Hoodie",
    tee: "Tişört",
    shirt: "Gömlek",
    blouse: "Bluz",
    blazer: "Blazer",
    jacket: "Ceket",
    coat: "Mont",
    pants: "Pantolon",
    jeans: "Jean",
    skirt: "Etek",
    dress: "Elbise",
    shorts: "Şort",
    shoes: "Ayakkabı",
    sneakers: "Sneaker",
    boots: "Bot",
    bag: "Çanta",
    watch: "Saat",
    necklace: "Kolye",
    bracelet: "Bileklik",
    earrings: "Küpe",
    ring: "Yüzük",
    sunglasses: "Gözlük",
    belt: "Kemer",
    hat: "Şapka",
    scarf: "Atkı",
    other: subtype || "Parça",
  };
  return map[family];
}

function normalizeBox(raw: unknown): ProductIntent["bounding_box"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const w = Number(o.w);
  const h = Number(o.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (w <= 0.02 || h <= 0.02) return null;
  return { x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) };
}

function normalizePiece(raw: Record<string, unknown>, index: number): ProductIntent | null {
  const labelBlob = `${asText(raw.label_tr)} ${asText(raw.category_tr)} ${asText(raw.subtype)}`;
  const declaredFamily = asText(raw.family);
  const knitOverride = knitFamilyFromText(labelBlob, declaredFamily);
  const family =
    jewelryFamilyFromText(labelBlob) ||
    knitOverride ||
    canonFamily(
      declaredFamily,
      asText(raw.subtype),
      asText(raw.category_tr),
      asText(raw.label_tr)
    );
  // #region agent log
  if (knitOverride || ["tee", "blouse", "shirt", "sweatshirt", "hoodie", "jacket", "blazer", "coat"].includes(family)) {
    dbg("H-knit", "normalize-intent.ts:family", "layer family resolve", {
      declared: declaredFamily,
      knitOverride: knitOverride || null,
      final: family,
      label: asText(raw.label_tr).slice(0, 40),
      layerIn: asText(raw.layer),
      visIn: asText(raw.visibility),
    });
  }
  // #endregion
  const subtype = asLower(raw.subtype) || family;
  const body = canonColor(asText(raw.body_color));
  if (!body && family === "other") return null;

  const layerRaw = asLower(raw.layer) as LayerRole;
  const layer: LayerRole = (
    ["outer", "mid", "inner", "bottom", "footwear", "accessory", "jewelry"] as LayerRole[]
  ).includes(layerRaw)
    ? layerRaw
    : defaultLayer(family);

  const visRaw = asLower(raw.visibility) as Visibility;
  const visibility: Visibility = (["full", "partial", "edge"] as Visibility[]).includes(visRaw)
    ? visRaw
    : "full";

  const motifs = Array.isArray(raw.motifs)
    ? raw.motifs
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m) => ({
          type: asText(m.type),
          colors: Array.isArray(m.colors) ? m.colors.map((c) => canonColor(asText(c))) : [],
          placement: asText(m.placement),
          text: asText(m.text) || undefined,
        }))
        .filter((m) => m.type)
    : [];

  const jersey =
    family === "jersey"
      ? {
          club: asText((raw.jersey_signals as Record<string, unknown> | undefined)?.club),
          number: asText((raw.jersey_signals as Record<string, unknown> | undefined)?.number),
          sport: asText((raw.jersey_signals as Record<string, unknown> | undefined)?.sport) || "football",
        }
      : undefined;

  const genderRaw = asLower(raw.gender);
  const gender =
    genderRaw === "men" || genderRaw === "women" || genderRaw === "unisex"
      ? genderRaw
      : ("" as const);

  return {
    id: `piece-${index}`,
    label_tr: asText(raw.label_tr) || defaultCategoryTr(family, subtype),
    family,
    subtype,
    category_tr: asText(raw.category_tr) || defaultCategoryTr(family, subtype),
    layer,
    visibility,
    bounding_box: normalizeBox(raw.bounding_box),
    body_color: body || "bilinmeyen",
    secondary_colors: Array.isArray(raw.secondary_colors)
      ? raw.secondary_colors.map((c) => canonColor(asText(c))).filter(Boolean)
      : [],
    motifs,
    fit: asText(raw.fit),
    material: asText(raw.material),
    gender,
    distinctive_details: Array.isArray(raw.distinctive_details)
      ? raw.distinctive_details.map((d) => asText(d)).filter(Boolean)
      : [],
    low_confidence: Boolean(raw.low_confidence),
    jersey_signals: jersey,
  };
}

function sentenceLabel(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const lower = t.toLocaleLowerCase("tr-TR");
  return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
}

/** Invariants: keep visible outer/mid/jewelry; drop empty garbage. */
export function enforceIntentInvariants(pieces: ProductIntent[]): ProductIntent[] {
  const kept = pieces.filter((p) => !p.low_confidence || p.visibility !== "edge");
  // Prefer outer over duplicate family when both claim same slot AND same bbox bucket.
  const byKey = new Map<string, ProductIntent>();
  for (const p of kept) {
    const box = p.bounding_box;
    const boxKey = box
      ? `${Math.round(box.x * 6)}_${Math.round(box.y * 6)}`
      : asLower(`${p.label_tr}|${p.subtype}`);
    const key = `${p.layer}:${p.family}:${p.body_color}:${boxKey}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, p);
      continue;
    }
    const score = (x: ProductIntent) =>
      (x.visibility === "full" ? 2 : 1) + (x.bounding_box ? 1 : 0) + (x.motifs.length ? 1 : 0);
    if (score(p) > score(prev)) byKey.set(key, p);
  }
  const out = Array.from(byKey.values());
  // Stable order: outer → mid → inner → bottom → footwear → jewelry → accessory
  const order: Record<LayerRole, number> = {
    outer: 0,
    mid: 1,
    inner: 2,
    bottom: 3,
    footwear: 4,
    jewelry: 5,
    accessory: 6,
  };
  out.sort((a, b) => order[a.layer] - order[b.layer]);
  const used = new Set<string>();
  return out.map((p, i) => {
    let label = p.label_tr.trim() || defaultCategoryTr(p.family, p.subtype);
    const color = p.body_color && p.body_color !== "bilinmeyen" ? p.body_color : "";
    if (color && !asLower(label).includes(asLower(color))) {
      const withColor = `${color} ${label}`;
      if (!used.has(asLower(withColor))) label = withColor;
    }
    if (used.has(asLower(label))) {
      let n = 2;
      while (used.has(asLower(`${p.label_tr} ${n}`))) n++;
      label = `${p.label_tr} ${n}`;
    }
    used.add(asLower(label));
    return { ...p, id: `piece-${i}`, label_tr: sentenceLabel(label) };
  });
}

export function normalizeOutfitIntent(raw: unknown): OutfitIntent {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.pieces) ? obj.pieces : Array.isArray(raw) ? raw : [];
  const pieces: ProductIntent[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== "object") continue;
    const n = normalizePiece(item as Record<string, unknown>, i);
    if (n) pieces.push(n);
  }
  return {
    extractor_version: EXTRACTOR_VERSION,
    pieces: enforceIntentInvariants(pieces),
    occasion_hint: asText(obj.occasion_hint) || undefined,
    notes: asText(obj.notes) || undefined,
  };
}

export function parseOutfitIntentJson(content: string): OutfitIntent {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return normalizeOutfitIntent(JSON.parse(cleaned));
}

/** Family hard-gate helpers used by verify. */
export function familyTitleTokens(family: PieceFamily): string[] {
  const map: Record<PieceFamily, string[]> = {
    jersey: ["forma", "jersey", "futbol forması", "maç forması", "halı saha"],
    sweatshirt: ["sweatshirt", "sweat", "kazak", "polar", "pullover", "eşofman üst"],
    hoodie: ["hoodie", "kapüşonlu", "kapusonlu"],
    tee: ["tişört", "tisort", "t-shirt", "tshirt", "tee"],
    shirt: ["gömlek", "gomlek", "shirt"],
    blouse: ["bluz", "blouse"],
    blazer: ["blazer", "ceket", "cekket"],
    jacket: ["ceket", "jacket", "bomber"],
    coat: ["mont", "kaban", "coat", "pardösü"],
    pants: ["pantolon", "pants", "chino"],
    jeans: ["jean", "kot", "denim"],
    skirt: ["etek", "skirt"],
    dress: ["elbise", "dress"],
    shorts: ["şort", "short"],
    shoes: ["ayakkabı", "ayakkabi", "loafer", "topuk", "terlik", "slipper"],
    sneakers: ["sneaker", "spor ayakkabı", "koşu"],
    boots: ["bot", "boot"],
    bag: ["çanta", "canta", "bag"],
    watch: ["saat", "watch"],
    necklace: ["kolye", "necklace"],
    bracelet: ["bileklik", "bilezik", "bracelet"],
    earrings: ["küpe", "kupe", "earring"],
    ring: ["yüzük", "yuzuk", "ring"],
    sunglasses: ["gözlük", "gozluk", "sunglasses"],
    belt: ["kemer", "belt"],
    hat: ["şapka", "sapka", "bere", "hat"],
    scarf: ["atkı", "atki", "eşarp", "scarf"],
    other: [],
  };
  return map[family] || [];
}

/** Conflicting families that must never substitute for each other. */
export const FAMILY_CONFLICTS: Partial<Record<PieceFamily, PieceFamily[]>> = {
  jersey: ["tee", "shirt", "sweatshirt", "hoodie"],
  sweatshirt: ["jersey", "tee", "shirt", "blazer"],
  hoodie: ["jersey", "tee", "blazer"],
  tee: ["jersey", "sweatshirt", "hoodie", "shirt", "blazer"],
  shirt: ["jersey", "tee", "sweatshirt"],
  blazer: ["jersey", "sweatshirt", "hoodie", "tee"],
  watch: ["jersey", "tee", "shirt", "sweatshirt", "hoodie"],
  earrings: ["jersey", "tee", "shirt", "sweatshirt"],
  necklace: ["jersey", "tee", "shirt"],
  bracelet: ["jersey", "tee", "shirt"],
  ring: ["jersey", "tee", "shirt"],
};
