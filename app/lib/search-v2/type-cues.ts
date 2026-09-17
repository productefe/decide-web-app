import type { PieceFamily, ProductIntent } from "./schema";
import { familyTitleTokens } from "./normalize-intent";

export interface TypeSpec {
  /** Shopping query type token (may include a detail prefix like "fermuarlı sweatshirt"). */
  queryType: string;
  /** Hard: title must contain at least one of these. */
  requiredAny: string[];
  /** Hard: title matching this is the wrong subtype. */
  rejectIf: RegExp | null;
  /** Soft: boost titles that contain these, then fill with others. */
  prefer: string[];
}

function lower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

function blobOf(intent: ProductIntent): string {
  return lower(
    [intent.subtype, intent.category_tr, intent.label_tr, intent.family, ...intent.distinctive_details].join(" ")
  );
}

const FOOTWEAR_GATES: {
  match: RegExp;
  queryType: string;
  requiredAny: string[];
  rejectIf: RegExp;
}[] = [
  {
    match: /terlik|slipper|ev ayakkab/,
    queryType: "terlik",
    requiredAny: ["terlik", "slipper", "ev ayakkab"],
    rejectIf: /sneaker|oxford|loafer|topuk|stiletto|bot|klasik ayakkabı|deri ayakkabı|mokasen|spor ayakkab/,
  },
  {
    match: /sandalet|sandal/,
    queryType: "sandalet",
    requiredAny: ["sandal", "sandalet"],
    rejectIf: /sneaker|terlik|oxford|bot|loafer/,
  },
  {
    match: /sneaker|spor ayakkab|koşu|kosu/,
    queryType: "sneaker",
    requiredAny: ["sneaker", "spor ayakkab", "koşu"],
    rejectIf: /terlik|slipper|topuk|oxford|loafer|klasik ayakkabı/,
  },
  {
    match: /\bbot\b|chelsea|combat|boot/,
    queryType: "bot",
    requiredAny: ["bot", "boot"],
    rejectIf: /sneaker|terlik|sandalet|topuklu/,
  },
  {
    match: /loafer|mokasen|oxford/,
    queryType: "loafer",
    requiredAny: ["loafer", "mokasen", "oxford"],
    rejectIf: /sneaker|terlik|topuklu|sandalet/,
  },
];

const PREFER_CUES: { re: RegExp; token: string; families?: PieceFamily[] }[] = [
  { re: /fermuar|zipper|\bzip\b/, token: "fermuarlı" },
  { re: /kapüşon|kapuson/, token: "kapüşonlu", families: ["hoodie", "sweatshirt", "jacket"] },
  { re: /inci|pearl/, token: "inci", families: ["necklace", "earrings", "bracelet", "ring"] },
  { re: /altın|gold/, token: "altın", families: ["necklace", "earrings", "bracelet", "ring", "watch"] },
  { re: /gümüş|silver/, token: "gümüş", families: ["necklace", "earrings", "bracelet", "ring", "watch"] },
  { re: /kadife|velvet/, token: "kadife" },
  { re: /oversize|oversized/, token: "oversize" },
  { re: /crop/, token: "crop", families: ["tee", "blouse", "shirt"] },
];

function familyQueryType(intent: ProductIntent): string {
  const tokens = familyTitleTokens(intent.family);
  if (intent.family === "jersey") {
    const club = intent.jersey_signals?.club;
    return club ? `${club} forma` : "futbol forması";
  }
  return tokens[0] || intent.category_tr || intent.subtype || "giyim";
}

export function typeSpec(intent: ProductIntent): TypeSpec {
  const blob = blobOf(intent);
  const prefer: string[] = [];
  for (const cue of PREFER_CUES) {
    if (cue.families && !cue.families.includes(intent.family)) continue;
    if (cue.re.test(blob) && !prefer.includes(cue.token)) prefer.push(cue.token);
  }

  const isFootwear =
    intent.layer === "footwear" ||
    intent.family === "shoes" ||
    intent.family === "sneakers" ||
    intent.family === "boots";

  if (isFootwear) {
    for (const gate of FOOTWEAR_GATES) {
      if (gate.match.test(blob)) {
        return {
          queryType: gate.queryType,
          requiredAny: gate.requiredAny,
          rejectIf: gate.rejectIf,
          prefer,
        };
      }
    }
    return {
      queryType: familyQueryType(intent),
      requiredAny: [],
      rejectIf: /terlik|slipper|ev ayakkabısı/,
      prefer,
    };
  }

  const base = familyQueryType(intent);
  const queryType = prefer[0] ? `${prefer[0]} ${base}` : base;
  return {
    queryType,
    requiredAny: [],
    rejectIf: null,
    prefer,
  };
}

export function subtypeConflict(title: string, spec: TypeSpec): boolean {
  const t = lower(title);
  if (spec.rejectIf && spec.rejectIf.test(t)) return true;
  if (spec.requiredAny.length === 0) return false;
  return !spec.requiredAny.some((tok) => t.includes(lower(tok)));
}

export function preferScore(title: string, spec: TypeSpec): number {
  if (!spec.prefer.length) return 0;
  const t = lower(title);
  let s = 0;
  for (const tok of spec.prefer) {
    if (t.includes(lower(tok))) s += 6;
  }
  return s;
}

export function canonicalTitle(title: string): string {
  return lower(title)
    .replace(/\b(beden|size)\s*[:.]?\s*[a-z0-9]+\b/g, " ")
    .replace(/\b(xxxl|xxl|xl|xs|s|m|l)\b/g, " ")
    .replace(/\b([2-5]xl)\b/g, " ")
    .replace(/\b(3[5-9]|4[0-7])\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
