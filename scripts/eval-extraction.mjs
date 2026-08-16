#!/usr/bin/env node
/**
 * Extraction (+ optional search) eval.
 *
 *   npm run eval              → extraction for every photo that exists;
 *                               case-01 and case-02 also run SerpAPI title checks
 *   npm run eval -- --search  → SerpAPI checks for every case that has must_not_match_title
 *   npm run eval -- --no-search
 *
 * Writes eval/runs/<iso>.json
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EVAL_DIR = path.join(ROOT, "eval");
const PHOTOS_DIR = path.join(EVAL_DIR, "photos");
const RUNS_DIR = path.join(EVAL_DIR, "runs");
const DEFAULT_SEARCH_IDS = new Set(["case-01", "case-02"]);

function parseArgs(argv) {
  return {
    search: argv.includes("--search"),
    noSearch: argv.includes("--no-search"),
    luks: argv.includes("--luks"),
  };
}

async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function extractPrompt(source) {
  const match = source.match(/export const VISION_OUTFIT_PROMPT = `([\s\S]*?)`;/);
  if (!match) throw new Error("VISION_OUTFIT_PROMPT not found in vision-prompt.ts");
  return match[1];
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");
}

function aliasesHit(value, allowed) {
  if (!allowed || !allowed.length) return true;
  const v = norm(value);
  if (allowed.includes("") && !v) return true;
  return allowed.some((a) => {
    const n = norm(a);
    if (!n) return !v;
    return v === n || v.includes(n) || n.includes(v);
  });
}

async function resolvePhoto(caseId, relative) {
  const specified = path.join(EVAL_DIR, relative);
  if (existsSync(specified)) return specified;
  if (!existsSync(PHOTOS_DIR)) return null;
  const files = await readdir(PHOTOS_DIR);
  const hit = files.find((f) => path.parse(f).name === caseId);
  return hit ? path.join(PHOTOS_DIR, hit) : null;
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function scoreItem(item, expected) {
  const fields = {};
  const keys = [
    "category",
    "subcategory",
    "primary_color",
    "length",
    "sleeve_or_strap",
    "silhouette_fit",
    "neckline",
    "material_impression",
  ];
  for (const key of keys) {
    if (!expected[key]) continue;
    const raw =
      key === "primary_color"
        ? item.primary_color || (item.colors && item.colors[0]) || ""
        : item[key] || "";
    fields[key] = aliasesHit(raw, expected[key]);
  }

  if (expected.secondary_colors) {
    const got = (item.secondary_colors || item.colors || []).map(norm);
    fields.secondary_colors = expected.secondary_colors.some((a) =>
      got.some((g) => g === norm(a) || g.includes(norm(a)))
    );
  }

  if (expected.patterns) {
    const got = Array.isArray(item.patterns) ? item.patterns : [];
    fields.patterns = expected.patterns.every((want) =>
      got.some(
        (p) =>
          aliasesHit(p.type, want.type) &&
          (!want.placement || aliasesHit(p.placement, want.placement))
      )
    );
  }

  if (expected.must_not_subcategory) {
    const sub = norm(item.subcategory || item.category);
    fields.must_not_subcategory = !expected.must_not_subcategory.some((ban) => {
      const n = norm(ban);
      return n && (sub === n || sub.includes(n));
    });
  }

  const values = Object.values(fields);
  const hit = values.filter(Boolean).length;
  return { fields, hit, total: values.length };
}

function typeToken(item) {
  return (item.subcategory || item.category || "").trim();
}

function coreQuery(item) {
  const type = typeToken(item);
  if (!type) return "";
  const g = norm(item.gender_presentation || item.gender);
  const gender = g === "women" || g === "kadın" || g === "kadin" ? "kadın" : g === "men" || g === "erkek" ? "erkek" : "";
  const length = ["crop", "midi", "maxi", "uzun", "mini"].includes(norm(item.length))
    ? item.length
    : "";
  const strapRaw = norm(item.sleeve_or_strap);
  const strap = /strap|askı|sleeveless|kolsuz|halter/.test(strapRaw) ? item.sleeve_or_strap : "";
  const color = item.primary_color || (item.colors && item.colors[0]) || "";
  return [gender, strap, length, color, type].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

async function callOpenAI(apiKey, prompt, dataUrl) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI empty content");
  return content;
}

function parseItems(content) {
  const clean = content.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  if (Array.isArray(parsed.items) && parsed.items.length) return parsed.items;
  if (parsed.category || parsed.subcategory) return [parsed];
  throw new Error("No items in vision JSON");
}

async function searchHits(apiKey, query) {
  if (!query) return [];
  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    api_key: apiKey,
    num: "10",
    gl: "tr",
    hl: "tr",
  });
  const res = await fetch(`https://serpapi.com/search?${params}`);
  const data = await res.json();
  if (data.error) {
    console.warn("SerpAPI:", data.error);
    return [];
  }
  return (data.shopping_results || []).slice(0, 3).map((r) => ({
    title: r.title || "",
    source: r.source || "",
  }));
}

function searchPass(hits, searchSpec, flags) {
  const leaked = [];
  const titles = (hits || []).map((h) => h.title || h);
  const sources = (hits || []).map((h) => (typeof h === "string" ? "" : h.source || ""));

  for (const title of titles) {
    const t = norm(title);
    for (const ban of searchSpec.must_not_match_title || []) {
      if (norm(ban) && t.includes(norm(ban))) leaked.push({ title, ban, kind: "title" });
    }
  }

  const sourceBans = searchSpec.must_not_match_source || [];
  for (let i = 0; i < titles.length; i++) {
    const blob = norm(`${titles[i]} ${sources[i]}`);
    for (const ban of sourceBans) {
      if (norm(ban) && blob.includes(norm(ban))) {
        leaked.push({ title: titles[i], source: sources[i], ban, kind: "supermarket" });
      }
    }
  }

  const checkLuxury =
    searchSpec.luxury_brands_only &&
    (flags.luks || searchSpec.price_mode === "luks") &&
    titles.length > 0;
  if (checkLuxury) {
    const allowed = (searchSpec.luxury_brand_substrings || []).map(norm).filter(Boolean);
    for (let i = 0; i < titles.length; i++) {
      const blob = norm(`${titles[i]} ${sources[i]}`);
      if (allowed.length && !allowed.some((b) => blob.includes(b))) {
        leaked.push({ title: titles[i], source: sources[i], ban: "non-luxury-brand", kind: "luxury" });
      }
    }
  }

  return { ok: leaked.length === 0, leaked, titles, sources };
}

function shouldSearch(caseId, searchSpec, flags) {
  if (flags.noSearch) return false;
  const has =
    Boolean(searchSpec?.must_not_match_title) ||
    Boolean(searchSpec?.must_not_match_source) ||
    Boolean(searchSpec?.luxury_brands_only);
  if (DEFAULT_SEARCH_IDS.has(caseId) && has) return true;
  return Boolean(flags.search && has);
}

async function main() {
  const spec = JSON.parse(await readFile(path.join(EVAL_DIR, "cases.json"), "utf8"));
  const flags = parseArgs(process.argv.slice(2));
  await loadEnvLocal();

  const toRun = [];
  for (const c of spec.cases) {
    const photo = await resolvePhoto(c.id, c.photo);
    if (photo) toRun.push({ c, photo });
    else {
      console.log(`SKIP ${c.id}  (no photo: ${c.photo})`);
    }
  }

  if (toRun.length === 0) {
    console.log("\nNo photos in eval/photos/. Add case-01.jpg and case-02.jpg (and up to case-25) then re-run.");
    process.exit(0);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const serpKey = process.env.SERPAPI_KEY;
  if (!openaiKey) {
    console.error("OPENAI_API_KEY missing (.env.local)");
    process.exit(1);
  }

  const prompt = extractPrompt(
    await readFile(path.join(ROOT, "app/api/decide/vision-prompt.ts"), "utf8")
  );

  const results = [];
  let fieldHit = 0;
  let fieldTotal = 0;
  let searchFail = 0;
  const skipped = spec.cases.length - toRun.length;
  const ran = toRun.length;

  for (const { c, photo } of toRun) {
    const buf = await readFile(photo);
    const dataUrl = `data:${mimeFor(photo)};base64,${buf.toString("base64")}`;
    let items;
    try {
      const content = await callOpenAI(openaiKey, prompt, dataUrl);
      items = parseItems(content);
    } catch (err) {
      console.log(`FAIL ${c.id}  extraction: ${err.message}`);
      results.push({ id: c.id, error: err.message });
      continue;
    }

    const item = items[0] || {};
    const scored = scoreItem(item, c.expected || {});
    fieldHit += scored.hit;
    fieldTotal += scored.total;

    const row = {
      id: c.id,
      label: c.label,
      item,
      fields: scored.fields,
      extraction: `${scored.hit}/${scored.total}`,
    };

    if (shouldSearch(c.id, c.search, flags)) {
      if (!serpKey) {
        row.search = { skipped: true, reason: "no_SERPAPI_KEY" };
      } else {
        const q = coreQuery(item);
        const hits = await searchHits(serpKey, q);
        const check = searchPass(hits, c.search || {}, flags);
        row.search = { query: q, titles: check.titles, sources: check.sources, ok: check.ok, leaked: check.leaked };
        if (!check.ok) searchFail += 1;
      }
    }

    const searchTag = row.search
      ? row.search.ok === false
        ? " SEARCH_LEAK"
        : row.search.ok
          ? " SEARCH_OK"
          : " SEARCH_SKIP"
      : "";
    console.log(`${scored.hit === scored.total ? "OK  " : "MISS"} ${c.id}  ${row.extraction}${searchTag}`);
    for (const [k, v] of Object.entries(scored.fields)) {
      if (!v) console.log(`     - ${k}`);
    }
    if (row.search?.leaked?.length) {
      for (const leak of row.search.leaked) {
        console.log(`     leak "${leak.ban}" in: ${leak.title}`);
      }
    }
    results.push(row);
  }

  await mkdir(RUNS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(RUNS_DIR, `${stamp}.json`);
  const summary = {
    at: new Date().toISOString(),
    ran,
    skipped,
    field_accuracy: fieldTotal ? fieldHit / fieldTotal : null,
    field_hit: fieldHit,
    field_total: fieldTotal,
    search_leaks: searchFail,
    results,
  };
  await writeFile(outPath, JSON.stringify(summary, null, 2));
  console.log(
    `\n${ran} ran, ${skipped} skipped, fields ${fieldHit}/${fieldTotal}` +
      (fieldTotal ? ` (${Math.round((fieldHit / fieldTotal) * 100)}%)` : "") +
      `, search leaks ${searchFail}`
  );
  console.log(`wrote ${path.relative(ROOT, outPath)}`);
  if (searchFail > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
