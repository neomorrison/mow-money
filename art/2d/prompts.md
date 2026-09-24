# Mow Money — 2D art generation log

Budget: kie.ai account had 722.06 credits before this run, 533.06 after — **189.00 credits spent**
(cap was 200). 44 generation calls total (43 image generations + 1 background removal), zero
images were discarded; every generation was used (a few had one network-timeout retry on the
polling call, which did not consume an extra credit beyond the successful attempt).

Models used:
- `google/nano-banana` (text-to-image, 4 credits): the one style-anchor portrait and the logo.
- `google/nano-banana-edit` (image-to-image with a reference image, 4 credits): every other
  portrait, staff portrait, the owner portrait, and the two wide key-art backgrounds, all using
  the anchor as `image_urls` so the whole cast shares one illustration style.
- `recraft/remove-background` (1 credit): background removal on the logo only.

## Style anchor

Generated first with `google/nano-banana`, then re-hosted with `kie_upload_file` and reused as
the `image_urls` reference for every `nano-banana-edit` call below. It doubles as `p_retiree_1`.

Prompt:
> stylized 3D cartoon character portrait, soft clay-like shading, warm golden-hour light, friendly
> Pixar-like proportions, head and shoulders, centered, the person standing in the open front
> doorway of their suburban house, door frame and porch visible behind them, shallow depth of
> field, square 1:1. A cheerful elderly white man in his early 70s with neatly combed silver hair
> and round glasses, wearing a cozy cardigan sweater over a collared shirt, warm friendly smile
> with laugh lines, one hand raised in a wave, standing in his front doorway. Clean single
> character, no text, no watermark.

Every edit prompt below opens with the same style-matching clause (paraphrased here as "[style
match]") plus a setting clause, then the per-character description that varies age, gender,
ethnicity, body type and props to match the archetype's flavor text in `src/data/archetypes.ts`.

## Residential / site-contact portraits (`public/img/portraits/*.webp`, 512x512)

| key | subject |
|---|---|
| p_retiree_1 | (style anchor) elderly white man, cardigan, waving |
| p_retiree_2 | elderly Black woman, floral blouse, plate of cookies |
| p_perfectionist_1 | middle-aged Asian man, tucked polo, small ruler |
| p_perfectionist_2 | middle-aged white woman, blazer, magnifying glass |
| p_family_1 | young Hispanic mother, apron, toddler peeking from behind leg |
| p_family_2 | young Black father, toddler on hip, diaper bag |
| p_penny_1 | middle-aged white man, flannel, fistful of coupons |
| p_penny_2 | elderly white woman, patched cardigan, old calculator |
| p_hoa_1 | middle-aged white woman, blazer, clipboard, stern |
| p_hoa_2 | middle-aged Asian man, polo/khakis, clipboard, stern |
| p_techie_1 | young Indian man, headset, hoodie, laptop |
| p_techie_2 | young white woman, headset, blazer over tee, coffee |
| p_gardener_1 | middle-aged Latina woman, sun hat, gloves, trowel |
| p_gardener_2 | older white man, sun hat, gloves, pruning shears |
| p_eco_1 | young Black woman, henley, canvas tote |
| p_eco_2 | middle-aged white man, beard, flannel, rain barrel |
| p_landlord_1 | middle-aged white man, sunglasses, phone, impatient |
| p_landlord_2 | middle-aged woman, sunglasses, phone, impatient |
| p_dude_1 | young white man, shaggy hair, tie-dye, flip-flops |
| p_dude_2 | young Black man, backwards cap, board shorts, flip-flops |
| p_veteran_1 | older white man, buzzcut, veteran cap, firm stance |
| p_veteran_2 | older Black woman, veteran pin, proud stance |
| p_newcouple_1 | couple: Asian woman + white man, moving boxes |
| p_newcouple_2 | couple: Black man + Latina woman, moving boxes |
| p_executive_1 | older white man, tailored blazer, estate doorway with columns |
| p_executive_2 | elegant older woman, pearls, estate doorway with columns |
| p_facilities_1 | man, business casual, clipboard, office-building entrance (setting override) |
| p_parks_1 | woman, park-dept polo, radio, park pavilion shelter (setting override) |
| p_greenskeeper_1 | older man, golf staff polo/cap, golf clubhouse entrance (setting override) |

Full example (family_1):
> [style match, doorway setting] Subject: a busy young Hispanic mother in her early 30s, hair in a
> loose ponytail, casual apron over a t-shirt, warm but tired smile, with a small toddler peeking
> out from behind her leg. Clean composition, no text, no watermark, no extra limbs.

Setting-override example (facilities_1):
> [style match] but the setting is different: the person stands at the glass entrance doors of a
> modest office building, office signage and a lobby visible behind them instead of a house porch.
> Subject: a middle-aged man in his 40s, business-casual button-down shirt, holding a clipboard,
> neutral professional expression.

## Staff portraits (`public/img/staff/*.webp`, 512x512)

Common setting clause: "the person stands outdoors on a sunny mowed lawn with a green company
pickup truck parked behind them instead of a house porch", green company polo + cap on every one.

| key | subject |
|---|---|
| s_1 | young Black man, big grin, rake |
| s_2 | middle-aged white woman, ponytail, confident |
| s_3 | young Hispanic man, sunglasses, arms crossed |
| s_4 | middle-aged Asian woman, clipboard |
| s_5 | young white man, string trimmer |
| s_6 | older Black man, gray beard, rake |
| s_7 | young Latina woman, gloves, big smile |
| s_8 | middle-aged white man, sunglasses, foreman stance |
| s_9 | young Asian man, headphones around neck |
| s_10 | young mixed-race woman, tool belt, determined |

## Key art (`public/img/*.webp`)

**owner** (512x512): style anchor doorway setting, "a young go-getter man in his early 20s, a
backwards ballcap, huge confident grin, holding the handle of a reel push mower that is partially
visible beside him. This is the main character, energetic and likable."

**title_bg** (1920x1080, from 16:9 generation): "change the composition to a wide 16:9 environment
shot ... a sunny suburban street at golden hour, rows of houses with perfectly striped, freshly
mowed lawns on both sides, a teenage boy pushing a reel push mower in the foreground on the left, a
zero-turn riding mower and a pickup truck with a small trailer parked on the right, ... the sky
takes up the top third of the frame and is kept soft and relatively empty/uncluttered there to
leave room for a logo overlay."

**hub_bg** (1920x1080, from 16:9 generation): "a cozy garage workshop headquarters interior, a
couple of lawn mowers parked to the sides, hand tools neatly hanging on a pegboard wall, work
bench, soft warm ambient light streaming in from a garage door opening, low contrast and slightly
blurred/soft background so that UI panels can be legible when placed on top, no people in the
shot."

**logo**: `google/nano-banana` text-to-image (not edit, plain background by design): "A chunky,
playful 3D game logo of the words 'MOW MONEY' in bold rounded letters. The letters are textured
like vivid green grass with tiny grass blade details on top edges, with a shiny gold dollar-coin
accent tucked next to or leaning on one of the letters, and a few loose grass blades scattered near
the base of the letters. Fun bouncy typography, soft rim lighting, subtle drop shadow, centered, on
a plain flat white background." Then `recraft/remove-background` on the result, trimmed to its
bounding box and capped at 1200px wide in `convert.py`.

## Pipeline

1. `mcp__kie__kie_generate` per asset (see `kie_get_model_schema` for each model's inputs).
2. Immediately `curl` each `resultUrls[0]` into `art/raw/<key>.<ext>` (kie's result URLs are
   temp-hosted and can expire, so raw downloads happen right after each batch, never deferred to
   the end).
3. Visual QA: read a representative sample of the raw downloads with the Read tool across every
   category (elderly/young, single/couple, residential/site-contact/staff, key art). Zero images
   needed a regenerate — all matched the anchor's style, had the right archetype vibe, and had no
   extra limbs or garbled faces. Two portraits (`p_landlord_2`, `s_3`) came back as `.png` instead
   of `.jpg`; `art/2d/convert.py`'s `find_raw()` tries both extensions so this needed no rework.
4. `art/2d/convert.py` (Python + Pillow) resizes/crops/re-encodes every raw file into the final
   `public/img/...` paths: 512x512 WebP q82 for portraits/staff/owner, 1920x1080 WebP q80 for the
   two backgrounds (center-cropped to the target aspect ratio first when needed), and an
   alpha-preserving WebP q90 for the logo (bounding-box trimmed, capped at 1200px wide).

Raw downloads are kept in `art/raw/` (gitignored) in case any asset needs a different crop or
re-encode later without spending more credits.
