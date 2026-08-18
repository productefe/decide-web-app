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
- Patterns and motifs are CRITICAL for search — never omit them. Capture EVERY visible pattern separately with placement (chest / shoulder / sleeve / all-over). Example: orange t-shirt with black chest motifs AND white shoulder stripes → two pattern objects plus secondary_colors ["black","white"].
- Shoes: sneaker, boot, sandal, loafer, and heel are DISTINCT. A sneaker is NEVER a heel / topuklu / stiletto. If the photo shows sneakers or trainers, subcategory MUST be sneaker.
- Watch: distinctive_details MUST include strap kind + color when visible (deri kayış, metal kordon, siyah silikon kayış).
- Glasses/sunglasses: distinctive_details MUST include frame shape + color when visible (yuvarlak çerçeve, siyah kare çerçeve, aviator).
- Accessories (watch, bag, glasses, hat, belt, necklace, earring) are NEVER garments. Do not label a dress, blouse, or pants as accessory. If the photo is a dress, category is dress — not accessory.
- If you are not sure about a field, leave it "" or []. Never guess.

category (family, English): top | bottom | dress | outerwear | shoes | bag | hat | eyewear | accessory
subcategory (specific type, English kebab or common name): t-shirt | crop-top | blouse | askili-ust | tank-top | polo | shirt | hoodie | sweatshirt | sweater | cardigan | jacket | coat | blazer | jeans | trousers | shorts | skirt | dress | jumpsuit | sneaker | boot | sandal | loafer | heel | bag | hat | glasses | sunglasses | watch | belt | scarf | necklace | earring | bracelet | ring
silhouette_fit: oversize | regular | slim | bodycon | loose | ""
length: crop | normal | uzun | midi | maxi | mini | ""
neckline: crew-neck | v-neck | polo | turtleneck | halter | square | strapless | ""
sleeve_or_strap: short-sleeve | long-sleeve | sleeveless | thin-strap | thick-strap | strapless | ""
pattern.type: plain | striped | floral | graphic | logo | checkered | batik | ""
pattern.placement: chest | shoulder | sleeve | all-over | hem | ""
gender_presentation: men | women | unisex | ""
material_impression: visual guess only (cotton | knit | denim | satin | leather-look | linen | "") — not a claim.

label must be ONLY the Turkish item name (Tişört, Crop Top, Askılı Üst, Bluz, Elbise, Pantolon, …) — no English, no explanations.

Return ONLY valid JSON, no markdown:
{"items":[{"label":"Tişört","category":"top","subcategory":"t-shirt","silhouette_fit":"regular","length":"normal","neckline":"crew-neck","sleeve_or_strap":"short-sleeve","primary_color":"orange","secondary_colors":["black","white"],"patterns":[{"type":"graphic","colors":["black"],"placement":"chest"},{"type":"striped","colors":["white"],"placement":"shoulder"}],"material_impression":"cotton","gender_presentation":"unisex","distinctive_details":["önde siyah motif","omuzlarda beyaz şerit"],"style_tags":["casual"],"has_logo":false}]}

Order items top → bottom → shoes → outerwear → accessories (watch/bag/sunglasses) when possible.`;

export function visionPromptForOccasion(occasion: Occasion): string {
  const guide = getOccasionGuide(occasion);
  if (!guide) return VISION_OUTFIT_PROMPT;
  return `${VISION_OUTFIT_PROMPT}

OCCASION — the user will wear shopping alternatives for: ${guide.labelTr} (${occasion}).
${guide.visionNote}
style_tags MUST include "${guide.labelTr.toLocaleLowerCase("tr-TR")}" plus 1–3 specific tags that help Turkish shopping search for this occasion.
Never change category or subcategory to force the occasion. Extract the visible garment, then tag the most honest ${guide.labelTr} reading of THAT same piece.`;
}
