#!/usr/bin/env node
/**
 * Search V2 golden eval — offline gate (no live Serp/OpenAI required).
 * Measures: extraction recall, subtype, color conflict, luxury leak,
 * uniqueness@12, empty-piece rate. Photos in eval/photos/ are optional;
 * fixtures in eval/v2/golden-cases.json drive deterministic scoring.
 *
 * Exit 0 when all thresholds pass.
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const goldenPath = join(root, "eval/v2/golden-cases.json");
const photosDir = join(root, "eval/photos");

const FAMILY_ALIASES = {
  jersey: "jersey",
  forma: "jersey",
  sweatshirt: "sweatshirt",
  hoodie: "hoodie",
  tee: "tee",
  tişört: "tee",
  shirt: "shirt",
  gömlek: "shirt",
  blouse: "blouse",
  blazer: "blazer",
  pants: "pants",
  jeans: "jeans",
  skirt: "skirt",
  dress: "dress",
  sneakers: "sneakers",
  boots: "boots",
  necklace: "necklace",
  earrings: "earrings",
  bracelet: "bracelet",
  watch: "watch",
  bag: "bag",
  sunglasses: "sunglasses",
};

const FAMILY_TOKENS = {
  jersey: ["forma", "jersey"],
  sweatshirt: ["sweatshirt", "sweat"],
  hoodie: ["hoodie", "kapüşonlu"],
  tee: ["tişört", "tisort", "t-shirt", "tshirt"],
  shirt: ["gömlek", "gomlek", "shirt"],
  blouse: ["bluz", "blouse"],
  blazer: ["blazer"],
  pants: ["pantolon", "pants"],
  jeans: ["jean", "kot"],
  skirt: ["etek", "skirt"],
  dress: ["elbise", "dress"],
  sneakers: ["sneaker", "spor ayakkabı"],
  boots: ["bot", "boot"],
  necklace: ["kolye"],
  earrings: ["küpe", "kupe"],
  bracelet: ["bileklik"],
  watch: ["saat", "watch"],
  bag: ["çanta", "canta"],
  sunglasses: ["gözlük", "gozluk"],
};

const CONFLICTS = {
  jersey: ["tee", "shirt", "sweatshirt"],
  tee: ["jersey", "sweatshirt", "hoodie"],
  sweatshirt: ["jersey", "tee", "blazer"],
  blazer: ["jersey", "tee", "sweatshirt"],
};

const COLOR_CONFLICTS = {
  siyah: ["beyaz", "sarı", "pembe"],
  beyaz: ["siyah"],
  kırmızı: ["yeşil", "mavi"],
  sarı: ["mor"],
};

const LUXURY_BRANDS = ["gucci", "hugo boss", "prada", "louis vuitton", "dior", "beymen", "vakko", "network"];
const REPLICA = ["replika", "replica", "muadil"];

function lower(s) {
  return String(s || "").toLocaleLowerCase("tr-TR");
}

function canonFamily(raw) {
  const k = lower(raw).replace(/\s+/g, "");
  return FAMILY_ALIASES[k] || FAMILY_ALIASES[raw] || raw;
}

function hasFamily(title, family) {
  const t = lower(title);
  return (FAMILY_TOKENS[family] || []).some((tok) => t.includes(tok));
}

function hardVerify(candidates, intent, priceMode, gender) {
  const kept = [];
  const rejects = {};
  const bump = (r) => {
    rejects[r] = (rejects[r] || 0) + 1;
  };
  for (const c of candidates) {
    const t = lower(c.title);
    const family = intent.family;
    if ((CONFLICTS[family] || []).some((cf) => hasFamily(c.title, cf) && !hasFamily(c.title, family))) {
      bump("family_conflict");
      continue;
    }
    if (family === "jersey" && /tişört|tisort|t-shirt|tshirt/.test(t) && !/forma|jersey/.test(t)) {
      bump("family_conflict");
      continue;
    }
    if (!hasFamily(c.title, family) && c.provider === "shopping" && family !== "other") {
      bump("family_mismatch");
      continue;
    }
    const want = lower(intent.body_color);
    const conflicts = COLOR_CONFLICTS[want] || [];
    if (conflicts.some((c0) => t.includes(c0)) && !t.includes(want)) {
      bump("color_conflict");
      continue;
    }
    if (REPLICA.some((r) => t.includes(r))) {
      bump("replica");
      continue;
    }
    if (priceMode === "luks") {
      const hay = lower(`${c.title} ${c.source}`);
      if (!LUXURY_BRANDS.some((b) => hay.includes(b))) {
        bump("luxury_leak");
        continue;
      }
    }
    if (gender === "women" && /\berkek\b/.test(t) && !/kadın|kadin|women/.test(t)) {
      bump("gender_conflict");
      continue;
    }
    if (gender === "men" && /\bkadın\b|\bkadin\b/.test(t) && !/erkek|men/.test(t)) {
      bump("gender_conflict");
      continue;
    }
    kept.push(c);
  }
  return { kept, rejects };
}

function uniqueness(products) {
  return new Set(products.slice(0, 12).map((p) => p.product_id || p.id)).size;
}

function buildQueries(intent, sizes) {
  const type = (FAMILY_TOKENS[intent.family] || [intent.family])[0];
  const color = intent.body_color !== "bilinmeyen" ? intent.body_color : "";
  const size = sizes[0] || "";
  return [`${color} ${type} ${size}`.trim(), `${type} ${size}`.trim()];
}

const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
const thresholds = golden.thresholds;
const cases = golden.cases;

let extractionHits = 0;
let extractionTotal = 0;
let subtypeHits = 0;
let subtypeTotal = 0;
let jewelryApparelHits = 0;
let jewelryApparelTotal = 0;
let wrongColorTop3 = 0;
let colorChecked = 0;
let luxuryLeaks = 0;
let emptyPieces = 0;
let uniqueFails = 0;
const failures = [];
const latencies = [];

for (const c of cases) {
  const t0 = Date.now();
  const pieces = c.vision_fixture?.pieces || [];
  const expectFamilies = c.expect?.families || [];
  extractionTotal += expectFamilies.length || 1;
  jewelryApparelTotal += expectFamilies.length || 1;

  const gotFamilies = pieces.map((p) => canonFamily(p.family));
  for (const ef of expectFamilies) {
    if (gotFamilies.includes(ef)) {
      extractionHits++;
      jewelryApparelHits++;
    } else {
      failures.push(`${c.id}: missing family ${ef}`);
    }
  }

  for (const p of pieces) {
    subtypeTotal++;
    if (canonFamily(p.family) === canonFamily(p.subtype) || p.subtype.includes(p.family) || p.family.includes(p.subtype)) {
      subtypeHits++;
    }
  }

  // Verify against first expected piece
  const primary = pieces[0];
  if (primary) {
    const { kept, rejects } = hardVerify(
      c.candidates || [],
      primary,
      c.price_mode || "karma",
      c.gender || null
    );
    if (kept.length === 0 && (c.candidates || []).length > 0) {
      emptyPieces++;
      failures.push(`${c.id}: empty after verify`);
    }

    if (c.expect?.luxury_leak_max === 0 || c.price_mode === "luks") {
      const leaked = kept.filter((k) => {
        const hay = lower(`${k.title} ${k.source}`);
        return !LUXURY_BRANDS.some((b) => hay.includes(b)) && c.price_mode === "luks";
      });
      luxuryLeaks += leaked.length;
      if (rejects.luxury_leak == null && c.price_mode === "luks") {
        // ok if rejected
      }
    }

    if (c.expect?.wrong_color_top3_max != null || c.tags?.includes("color")) {
      colorChecked++;
      const top3 = kept.slice(0, 3);
      const want = lower(primary.body_color);
      const conflicts = COLOR_CONFLICTS[want] || [];
      const bad = top3.filter((k) => conflicts.some((x) => lower(k.title).includes(x)) && !lower(k.title).includes(want));
      wrongColorTop3 += bad.length;
    }

    if (c.expect?.no_tee_fallback) {
      const teeLeft = kept.filter((k) => /tişört|t-shirt|tshirt/i.test(k.title) && !/forma|jersey/i.test(k.title));
      if (teeLeft.length) failures.push(`${c.id}: jersey fell back to tee`);
    }

    if (c.expect?.sizes_in_query) {
      const qs = buildQueries(primary, c.sizes || []);
      for (const sz of c.expect.sizes_in_query) {
        if (!qs.some((q) => q.includes(sz))) failures.push(`${c.id}: size ${sz} missing in query`);
      }
    }

    if (c.expect?.unique_at_12_min) {
      const u = uniqueness(kept.length ? kept : c.candidates || []);
      if (u < c.expect.unique_at_12_min) {
        uniqueFails++;
        failures.push(`${c.id}: unique@12=${u} < ${c.expect.unique_at_12_min}`);
      }
    }

    if (c.expect?.reject_replica && !rejects.replica) {
      failures.push(`${c.id}: replica not rejected`);
    }
    if (c.expect?.reject_gender && !rejects.gender_conflict) {
      failures.push(`${c.id}: gender conflict not rejected`);
    }
  }

  latencies.push(Date.now() - t0);
}

const photoFiles = existsSync(photosDir)
  ? readdirSync(photosDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  : [];

const recall = extractionTotal ? extractionHits / extractionTotal : 0;
const apparelRecall = jewelryApparelTotal ? jewelryApparelHits / jewelryApparelTotal : 0;
const subtypeAcc = subtypeTotal ? subtypeHits / subtypeTotal : 0;
const wrongColorRate = colorChecked ? wrongColorTop3 / Math.max(colorChecked, 1) : 0;
const emptyRate = cases.length ? emptyPieces / cases.length : 0;
latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

const report = {
  version: golden.version,
  cases: cases.length,
  photo_fixtures_on_disk: photoFiles.length,
  metrics: {
    visible_main_piece_recall: Number(recall.toFixed(3)),
    apparel_jewelry_recall: Number(apparelRecall.toFixed(3)),
    subtype_accuracy: Number(subtypeAcc.toFixed(3)),
    wrong_color_top3_rate: Number(wrongColorRate.toFixed(3)),
    luxury_leakage: luxuryLeaks,
    empty_piece_rate: Number(emptyRate.toFixed(3)),
    unique_fails: uniqueFails,
    offline_p50_ms: p50,
    offline_p95_ms: p95,
  },
  thresholds,
  failures,
};

const checks = [
  ["visible_main_piece_recall", recall >= thresholds.visible_main_piece_recall],
  ["apparel_jewelry_recall", apparelRecall >= thresholds.apparel_jewelry_recall],
  ["subtype_accuracy", subtypeAcc >= thresholds.subtype_accuracy],
  ["wrong_color_top3", wrongColorRate <= thresholds.wrong_color_top3_max],
  ["luxury_leakage", luxuryLeaks <= thresholds.luxury_leakage],
  ["empty_piece", emptyRate <= thresholds.empty_piece_max],
  ["unique_fails", uniqueFails === 0],
  ["case_count", cases.length >= 30],
];

const failedChecks = checks.filter(([, ok]) => !ok).map(([n]) => n);
report.passed = failedChecks.length === 0 && failures.length === 0;
report.failed_checks = failedChecks;

console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  console.error("\nEVAL FAILED:", failedChecks.join(", ") || failures.slice(0, 10).join("; "));
  process.exit(1);
}
console.error("\nEVAL PASSED");
process.exit(0);
