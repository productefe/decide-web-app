import type { Occasion } from "@/lib/preferences";
import { getOccasionGuide } from "@/lib/occasion-guide";

/**
 * Shared GPT-4o outfit extraction prompt (POST /api/decide and /api/decide/more).
 * Empty string / empty array = not sure. Never invent attributes.
 */
export const VISION_OUTFIT_PROMPT = `Analyze this fashion image for a FULL OUTFIT when a person is wearing multiple garments. Return EACH visible piece separately (up to 8): every clothing LAYER, shoes, and accessories.

HARD RULES:
- If a person (or mannequin) is wearing clothes, list every distinct layer: inner t-shirt/shirt AND outer sweatshirt/hoodie/jacket/blazer when both are visible. Never keep only the outer layer.
- A blazer, ceket, or gömlek showing under/over a sweatshirt is its OWN item (blazer = outerwear / blazer; gömlek = top / shirt; tişört = top / t-shirt; sweatshirt = top / sweatshirt).
- ALWAYS include jewelry and accessories when visible even partially: necklace, earrings, watch, bracelet, ring, belt, bag, hat, glasses/sunglasses. Each is its own item — never drop them to save slots.
- Shoes are their own item. Do NOT collapse a whole look into a single item.
- Only return ONE item if the photo is clearly a product close-up of a single piece with no other garments in frame.

Be precise about TYPE vs LENGTH vs STRAPS:
- hoodie: visible hood / kapüşon. NEVER t-shirt.
- sweatshirt: thick fleece / şardonlu, rib cuffs+hem, NO hood. NEVER t-shirt.
- t-shirt: thin jersey. A t-shirt UNDER a sweatshirt is still a t-shirt — list both.
- shirt / gömlek: collar + placket. Distinct from t-shirt and from sweatshirt.
- blazer: tailored jacket, not a sweatshirt, not a gömlek.
- crop top, t-shirt, blouse, spaghetti-strap top, and dress are DISTINCT. A crop top is NEVER a dress.
- length is HEM length (crop / normal / midi / maxi / uzun), NOT sleeve length.
- sleeve_or_strap is separate: short-sleeve / long-sleeve / sleeveless / thin-strap / thick-strap / strapless.
- POLO: fold-over collar → subcategory polo, never t-shirt.
- STRAPLESS: no straps at all → sleeve_or_strap strapless AND neckline strapless.
- GARMENT BODY vs PRINT: primary_color is the FABRIC color, never the print.
- Patterns and motifs are CRITICAL — never omit them. Local stripe on the shoulder is placement shoulder, NOT an all-over striped garment.
- Shoes: sneaker, boot, sandal, loafer, heel, slipper are DISTINCT.
- Watch: distinctive_details MUST include strap kind + color when visible.
- Glasses vs sunglasses depend on LENS OPACITY (koyu cam vs saydam cam).
- Accessories are NEVER garments. belt ≠ tie.
- If you are not sure about a field, leave it "" or []. Never guess.

category: top | bottom | dress | outerwear | shoes | bag | hat | eyewear | accessory
subcategory: t-shirt | crop-top | blouse | askili-ust | tank-top | polo | shirt | hoodie | sweatshirt | sweater | cardigan | jacket | coat | blazer | jeans | trousers | shorts | skirt | dress | jumpsuit | bikini | mayo | sneaker | boot | sandal | loafer | heel | slipper | bag | hat | glasses | sunglasses | watch | belt | tie | scarf | necklace | earring | bracelet | ring
silhouette_fit: oversize | regular | slim | bodycon | loose | ""
length: crop | normal | uzun | midi | maxi | mini | ""
neckline: crew-neck | v-neck | polo | turtleneck | halter | square | scoop | off-shoulder | strapless | ""
sleeve_or_strap: short-sleeve | long-sleeve | sleeveless | thin-strap | thick-strap | strapless | ""
pattern.type: plain | striped | floral | graphic | logo | checkered | batik | ""
pattern.placement: chest | shoulder | sleeve | all-over | hem | ""
gender_presentation: men | women | unisex | ""
material_impression: cotton | knit | denim | satin | leather-look | linen | ""

label must be ONLY the Turkish item name (Tişört, Sweatshirt, Gömlek, Blazer, Kolye, Küpe, Saat, …).

Return ONLY valid JSON, no markdown:
{"items":[{"label":"Sweatshirt","category":"top","subcategory":"sweatshirt","silhouette_fit":"regular","length":"normal","neckline":"crew-neck","sleeve_or_strap":"long-sleeve","primary_color":"grey","secondary_colors":[],"patterns":[],"material_impression":"cotton","gender_presentation":"unisex","distinctive_details":[],"style_tags":["casual"],"has_logo":false},{"label":"Tişört","category":"top","subcategory":"t-shirt","silhouette_fit":"regular","length":"normal","neckline":"crew-neck","sleeve_or_strap":"short-sleeve","primary_color":"white","secondary_colors":[],"patterns":[],"material_impression":"cotton","gender_presentation":"unisex","distinctive_details":[],"style_tags":["casual"],"has_logo":false},{"label":"Blazer","category":"outerwear","subcategory":"blazer","silhouette_fit":"regular","length":"normal","primary_color":"black","secondary_colors":[],"patterns":[],"material_impression":"","gender_presentation":"unisex","distinctive_details":[],"style_tags":["casual"],"has_logo":false},{"label":"Kolye","category":"accessory","subcategory":"necklace","primary_color":"gold","secondary_colors":[],"patterns":[],"distinctive_details":[],"style_tags":["casual"],"has_logo":false}]}

Order: inner tops → outer tops/blazer → bottom → shoes → accessories.`;

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
