import type { Occasion } from "@/lib/preferences";
import { getOccasionGuide } from "@/lib/occasion-guide";

/**
 * Shared GPT-4o outfit extraction prompt (POST /api/decide and /api/decide/more).
 * Empty string / empty array = not sure. Never invent attributes.
 */
export const VISION_OUTFIT_PROMPT = `Analyze this fashion image for a FULL OUTFIT when a person is wearing multiple garments. Return EACH major visible piece separately (up to 5): top, bottom, outerwear, and ALWAYS shoes and accessories when visible. Shoes, watch, bag, sunglasses, hat, and belt are each their OWN item — never skip them and never merge them into a garment. If a watch or sneakers are visible even partially, include them. Do NOT collapse a whole look into a single item. Only return ONE item if the photo is clearly a product close-up of a single piece.

Be precise about TYPE vs LENGTH vs STRAPS:
- crop top, t-shirt, blouse, spaghetti-strap top, and dress are DISTINCT subcategories. A crop top is NEVER a dress. A spaghetti-strap crop top is still a crop top (subcategory crop-top, length crop, sleeve_or_strap thin-strap).
- length is HEM length of the garment (crop / normal / midi / maxi / uzun), NOT sleeve length.
- sleeve_or_strap is separate: short-sleeve / long-sleeve / sleeveless / thin-strap / thick-strap / strapless.
- POLO check comes FIRST for every top: if the tee has a soft fold-over collar (with or without a 2-3 button placket), subcategory MUST be polo and neckline MUST be polo — NEVER t-shirt, NEVER shirt. Only use t-shirt when the neckline is collarless (crew/v-neck).
- STRAPLESS check: if the shoulders are completely bare with NO straps at all (tube top, bandeau, strapless dress), sleeve_or_strap MUST be strapless AND neckline MUST be strapless. "sleeveless" means it still has shoulder coverage or straps — never use it for a strapless piece.
- GARMENT BODY vs PRINT: primary_color is the FABRIC / base color of the garment — never the print. A white t-shirt with a green chest graphic → primary_color "white", secondary_colors ["green"], patterns [{"type":"graphic","colors":["green"],"placement":"chest"}]. Do NOT set primary_color to the print color.
- Style texture for tops/crop/dresses: put visible fabric or construction in distinctive_details when clear — e.g. "dantel", "ribana", "file", "cut-out", "balenli", "bağcıklı". These details are used for search.
- Patterns and motifs are CRITICAL for search — never omit them. Capture EVERY visible pattern separately with placement (chest / shoulder / sleeve / all-over). Example: orange t-shirt with black chest motifs AND white shoulder stripes → two pattern objects plus secondary_colors ["black","white"].
- placement PRECISION: use all-over ONLY when the pattern covers the whole garment. A stripe only on the shoulders or sleeves is placement shoulder/sleeve — the garment is NOT a "striped t-shirt". A mostly plain garment with one local accent stays visually plain; report the accent with its exact placement.
- Shoes: sneaker, boot, sandal, loafer, and heel are DISTINCT. A sneaker is NEVER a heel / topuklu / stiletto. If the photo shows sneakers or trainers, subcategory MUST be sneaker.
- Swimwear: bikini, mayo, and swim shorts are DISTINCT from t-shirt / trousers. If the photo shows a bikini or swimsuit, subcategory MUST be bikini or mayo — never t-shirt, never dress.
- Watch: distinctive_details MUST include strap kind + color when visible (deri kayış, metal kordon, siyah silikon kayış).
- Glasses vs sunglasses are DISTINCT. Sunglasses (güneş gözlüğü) are NEVER optical/reading glasses, and NEVER a glasses case / kutu / kılıf. If the photo shows sunglasses, subcategory MUST be sunglasses. If it shows clear optical frames, subcategory MUST be glasses.
- Accessories (watch, bag, glasses, hat, belt, necklace, earring) are NEVER garments. Do not label a dress, blouse, or pants as accessory. If the photo is a dress, category is dress — not accessory.
- If you are not sure about a field, leave it "" or []. Never guess.

category (family, English): top | bottom | dress | outerwear | shoes | bag | hat | eyewear | accessory
subcategory (specific type, English kebab or common name): t-shirt | crop-top | blouse | askili-ust | tank-top | polo | shirt | hoodie | sweatshirt | sweater | cardigan | jacket | coat | blazer | jeans | trousers | shorts | skirt | dress | jumpsuit | bikini | mayo | sneaker | boot | sandal | loafer | heel | bag | hat | glasses | sunglasses | watch | belt | scarf | necklace | earring | bracelet | ring
silhouette_fit: oversize | regular | slim | bodycon | loose | ""
length: crop | normal | uzun | midi | maxi | mini | ""
neckline: crew-neck | v-neck | polo | turtleneck | halter | square | scoop | off-shoulder | strapless | ""
sleeve_or_strap: short-sleeve | long-sleeve | sleeveless | thin-strap | thick-strap | strapless | ""
pattern.type: plain | striped | floral | graphic | logo | checkered | batik | ""
pattern.placement: chest | shoulder | sleeve | all-over | hem | ""
gender_presentation: men | women | unisex | ""
material_impression: visual guess only (cotton | knit | denim | satin | leather-look | linen | "") — not a claim.

label must be ONLY the Turkish item name (Tişört, Crop Top, Askılı Üst, Bluz, Elbise, Pantolon, …) — no English, no explanations.

Return ONLY valid JSON, no markdown:
{"items":[{"label":"Tişört","category":"top","subcategory":"t-shirt","silhouette_fit":"regular","length":"normal","neckline":"crew-neck","sleeve_or_strap":"short-sleeve","primary_color":"orange","secondary_colors":["black","white"],"patterns":[{"type":"graphic","colors":["black"],"placement":"chest"},{"type":"striped","colors":["white"],"placement":"shoulder"}],"material_impression":"cotton","gender_presentation":"unisex","distinctive_details":["önde siyah motif","omuzlarda beyaz şerit"],"style_tags":["casual"],"has_logo":false}]}

Order items top → bottom → shoes → outerwear → accessories (watch/bag/sunglasses) when possible.`;

export function visionPromptForOccasion(occasion: Occasion | null): string {
  const guide = getOccasionGuide(occasion);
  if (!guide) {
    return `${VISION_OUTFIT_PROMPT}

WEAR CONTEXT is unknown. Infer where this look belongs from garments, fabric, and shoes.
Add a root field "occasion" that MUST be exactly one of: spor | gundelik | aksam | ev | is | sahil
Return JSON like: {"occasion":"gundelik","items":[...]}

Hard pick rules (choose one):
- spor: gym / training / athleisure — jogger, eşofman, tayt, running sneaker, workout sweat. NOT kumaş pantolon, NOT gömlek, NOT heels, NOT bikini.
- is: office / business casual / smart casual — gömlek, blazer, chino, kumaş, loafer, oxford, polo. NOT eşofman, NOT hoodie, NOT running sneaker.
- aksam: evening / davet / abiye — saten, topuklu, şık. NOT gym, NOT hoodie.
- ev: home / lounge / pijama / terlik. NOT office, NOT heels.
- sahil: beach / plaj — şort, bikini, mayo, sandalet, plaj çantası. NOT kumaş pantolon, NOT gömlek, NOT jogger.
- gundelik: street / weekend / jean / tişört — default when none of the above is clear.

style_tags on each item MUST include the chosen occasion word (spor, gündelik, akşam, ev, iş, or sahil).
Never change category or subcategory to force the occasion. Extract the visible garment, then tag it for the inferred place.`;
  }
  return `${VISION_OUTFIT_PROMPT}

OCCASION — the user will wear shopping alternatives for: ${guide.labelTr} (${occasion}).
${guide.visionNote}
style_tags MUST include "${guide.labelTr.toLocaleLowerCase("tr-TR")}" plus 1–3 specific tags that help Turkish shopping search for this occasion.
Never change category or subcategory to force the occasion. Extract the visible garment, then tag the most honest ${guide.labelTr} reading of THAT same piece.`;
}
