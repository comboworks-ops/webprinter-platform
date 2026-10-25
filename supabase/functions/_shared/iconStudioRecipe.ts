import { ONLINETRYKSAGER_PACK_ID } from './iconStudioOnlinetryksager.ts';
import { ICON_STUDIO_PRODUCT_KEYS, type IconStudioProductKey, type IconStudioStyleKey, type IconStudioVariantKey } from './iconStudioCatalog.ts';

export const STUDIO_VIEWS = [
  { id: 'front', label: 'Forfra', variant: 'front', prompt: 'Straight-on front view, no yaw.' },
  { id: 'left', label: 'Skråt fra venstre', variant: 'angled_front', prompt: 'Three-quarter view from the left, showing the front and left side. Never mirror artwork.' },
  { id: 'right', label: 'Skråt fra højre', variant: 'angled_front', prompt: 'Three-quarter view from the right, showing the front and right side. Never mirror artwork.' },
  { id: 'top', label: 'Ovenfra', variant: 'top_view', prompt: 'Overhead camera looking straight down.' },
  { id: 'isometric', label: 'Isometrisk', variant: 'angled_front', prompt: 'Orthographic isometric view, consistent thirty-degree ground axes.' },
] as const;
export type StudioView = typeof STUDIO_VIEWS[number]['id'];

export const STUDIO_TREATMENTS = [
  { id: 'none', label: 'Rent udtryk', prompt: 'Use the base style without an additional treatment.' },
  { id: 'premium', label: 'Eksklusivt lys', prompt: 'Restrained premium studio lighting, controlled edge highlights, generous negative space; do not invent gold foil.' },
  { id: 'float', label: 'Svævende', prompt: 'The product floats slightly above a soft detached shadow, fully inside the frame.' },
  { id: 'paper', label: 'Papirstruktur', prompt: 'Subtle paper grain in the illustration, without obscuring the silhouette.' },
  { id: 'wash', label: 'Akvarelvask', prompt: 'A restrained translucent watercolour wash inside the drawn outline.' },
  { id: 'ink', label: 'Fin blækkontur', prompt: 'A fine, consistent ink outline around the illustrated product.' },
  { id: 'duotone', label: 'To farver', prompt: 'Limit the illustration to the two specified palette colours and their transparent edges.' },
  { id: 'gloss', label: 'Blød glans', prompt: 'Controlled soft glossy highlights, no distorted reflection or geometry.' },
  { id: 'breakout', label: 'Ud af rammen', prompt: 'Keep a clean isolated product. An inset panel will be composed behind it after generation.' },
] as const;
export type StudioTreatment = typeof STUDIO_TREATMENTS[number]['id'];

export interface StudioStyle {
  id: string; label: string; family: string; description: string; prompt: string;
  legacyStyle: IconStudioStyleKey; treatments: readonly StudioTreatment[]; colour: string;
}
export const STUDIO_STYLES: readonly StudioStyle[] = [
  { id: 'flat', label: 'Ren flade', family: 'Grafisk', description: 'Rene farveflader og en tydelig silhuet.', prompt: 'Flat graphic illustration, solid shapes, crisp edges, no texture or perspective exaggeration.', legacyStyle: 'flat_clean', treatments: ['none','duotone','breakout'], colour: '#628f87' },
  { id: 'silhouette', label: 'Silhuet', family: 'Grafisk', description: 'Én farve med genkendelige udskæringer.', prompt: 'Single-colour silhouette with deliberate negative-space cutouts and a recognisable product outline.', legacyStyle: 'flat_clean', treatments: ['none','breakout'], colour: '#25354a' },
  { id: 'outline', label: 'Fin kontur', family: 'Grafisk', description: 'Præcise streger og et let udtryk.', prompt: 'Fine consistent contour lines, open interiors, simplified technical product illustration.', legacyStyle: 'outline_technical', treatments: ['none','paper','wash'], colour: '#54738c' },
  { id: 'duotone', label: 'Duotone', family: 'Grafisk', description: 'To farver og skarpe former.', prompt: 'Two-colour graphic illustration, clean planes, deliberate contrast, no third accent colour.', legacyStyle: 'flat_clean', treatments: ['none','paper','breakout'], colour: '#bd745b' },
  { id: 'pencil', label: 'Blyant', family: 'Tegnet', description: 'Blyantstreger med let skravering.', prompt: 'Hand-drawn pencil illustration, light hatching, deliberate restrained irregularity; accurate proportions.', legacyStyle: 'outline_technical', treatments: ['none','paper','wash'], colour: '#8a8177' },
  { id: 'ink', label: 'Pen og blæk', family: 'Tegnet', description: 'Sikker streg og sparsom skygge.', prompt: 'Editorial pen-and-ink drawing, confident outlines, sparse hatching, no lettering.', legacyStyle: 'outline_technical', treatments: ['none','paper','wash'], colour: '#384854' },
  { id: 'watercolour', label: 'Akvarel', family: 'Tegnet', description: 'Bløde pigmenter og rolige overgange.', prompt: 'Controlled watercolour illustration, visible pigment variation, soft edges but clear product silhouette.', legacyStyle: 'brand_custom', treatments: ['none','ink','paper'], colour: '#8ca79b' },
  { id: 'screenprint', label: 'Serigrafi', family: 'Tegnet', description: 'Trykte farveflader med fin struktur.', prompt: 'Screen-print illustration, limited spot colours, subtle grain and restrained illustrative misregistration.', legacyStyle: 'flat_clean', treatments: ['none','duotone','paper'], colour: '#c17b48' },
  { id: 'clay', label: 'Blød ler', family: '3D', description: 'Matte flader og bløde skygger.', prompt: 'Soft matte clay-like 3D illustration, gentle edge rounding and diffuse light; preserve the real thinness of paper products.', legacyStyle: 'soft_3d', treatments: ['none','premium','float','breakout'], colour: '#95a6c5' },
  { id: 'animation', label: 'Animationslook', family: '3D', description: 'Legende 3D som et stillbillede.', prompt: 'Stylised animation-film 3D still, smooth shading, playful restrained colour and clear depth, no characters.', legacyStyle: 'soft_3d', treatments: ['none','gloss','float','breakout'], colour: '#a28dcc' },
  { id: 'studio3d', label: 'Studie-render', family: '3D', description: 'Troværdigt materiale og præcist lys.', prompt: 'Realistic studio 3D rendering of print material, believable surface, subtle reflections and accurate construction.', legacyStyle: 'print_material_realistic', treatments: ['none','premium','float','breakout'], colour: '#6e8f9d' },
  { id: 'lowpoly', label: 'Facetteret', family: '3D', description: 'Enkle flader med synlig geometri.', prompt: 'Low-poly product illustration, deliberate facets and planar shading, preserve essential product construction.', legacyStyle: 'soft_3d', treatments: ['none','duotone','float'], colour: '#759b78' },
  { id: 'papercut', label: 'Papirklip', family: 'Materiale', description: 'Papirlag med diskret dybde.', prompt: 'Layered paper-cut illustration with subtle contact shadows. Layers belong to the illustration, not extra product flaps.', legacyStyle: 'soft_3d', treatments: ['none','duotone','breakout'], colour: '#c4a487' },
  { id: 'kraft', label: 'Naturpapir', family: 'Materiale', description: 'Varme fibre og en mat overflade.', prompt: 'Warm natural-paper illustration, visible fine fibres, tactile matte surface and calm soft lighting.', legacyStyle: 'print_material_realistic', treatments: ['none','ink','premium'], colour: '#b39670' },
  { id: 'glass', label: 'Frostet glas', family: 'Materiale', description: 'Gennemsigtig, konceptuel illustration.', prompt: 'Conceptual frosted-glass product icon, restrained translucency and reflections, preserve recognisable silhouette. This is illustration, not a material specification.', legacyStyle: 'soft_3d', treatments: ['none','premium','float'], colour: '#9ebfc5' },
  { id: 'metal', label: 'Børstet metal', family: 'Materiale', description: 'Metallisk struktur og kontrolleret glans.', prompt: 'Conceptual brushed-metal product icon with fine directional grain and controlled highlights, not a claim about actual product material.', legacyStyle: 'soft_3d', treatments: ['none','premium','breakout'], colour: '#8d949e' },
  { id: 'photo', label: 'Rent studie', family: 'Foto og mix', description: 'Fotografisk udtryk med neutralt lys.', prompt: 'Photographic studio appearance, neutral lighting, realistic paper, isolated product and a soft grounded shadow.', legacyStyle: 'print_material_realistic', treatments: ['none','premium','breakout'], colour: '#829788' },
  { id: 'daylight', label: 'Blødt dagslys', family: 'Foto og mix', description: 'Blødt lys og naturlige skygger.', prompt: 'Photographic product appearance, broad soft daylight and gently warm shadows, isolated without a room or table.', legacyStyle: 'print_material_realistic', treatments: ['none','breakout'], colour: '#c2b28e' },
  { id: 'exclusive', label: 'Eksklusiv', family: 'Foto og mix', description: 'Præcist kantlys og rolig kontrast.', prompt: 'Premium photographic product appearance, precise edge lighting, restrained contrast and palette, no invented foil or lettering.', legacyStyle: 'print_material_realistic', treatments: ['none','breakout'], colour: '#646274' },
  { id: 'photo3d', label: 'Foto + 3D', family: 'Foto og mix', description: 'Fotografisk produkt med stiliseret dybde.', prompt: 'Mixed-media image: a photographic-looking print product with one subtle abstract 3D accent behind it. Keep product identity and construction clear; do not place the accent on the printed surface.', legacyStyle: 'brand_custom', treatments: ['none','premium','breakout'], colour: '#b08c9b' },
];
export const STUDIO_FAMILIES = [...new Set(STUDIO_STYLES.map(style => style.family))];
export interface StudioRecipe {
  version: 1; compositionVersion?: 1 | 2; styleId: string; treatmentId: StudioTreatment; viewId: StudioView;
  palette: [string, string]; anchorOutputId: string | null;
  referencePackId?: typeof ONLINETRYKSAGER_PACK_ID; productReferenceId?: string; libraryReferenceId?: string;
}
export interface StudioCollection { id: string; name: string; index: number; total: number }
export const STUDIO_MAX_COLLECTION = 30;
export function isGraphicStudioStyle(styleId?: string) {
  return ['flat', 'silhouette', 'outline', 'duotone'].includes(styleId || '');
}
export const STUDIO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function studioStyle(id: string): StudioStyle {
  const style = STUDIO_STYLES.find(item => item.id === id);
  if (!style) throw new Error('Ukendt billedstil.');
  return style;
}
export function studioViews(styleId: string, productKey: string) {
  const photo = ['photo','daylight','exclusive','photo3d'].includes(styleId);
  const upright = ['rollup_banner','beach_flag'].includes(productKey);
  return STUDIO_VIEWS.filter(view => !(photo && view.id === 'isometric') && !(upright && view.id === 'top'));
}
export function parseStudioRecipe(value: unknown, productKey?: string): StudioRecipe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ugyldig stilopskrift.');
  const r = value as StudioRecipe;
  const style = studioStyle(r.styleId);
  if (r.version !== 1 || !style.treatments.includes(r.treatmentId) || !STUDIO_VIEWS.some(v => v.id === r.viewId)
      || !Array.isArray(r.palette) || r.palette.length !== 2 || !r.palette.every(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
      || (r.anchorOutputId !== null && (typeof r.anchorOutputId !== 'string' || !STUDIO_UUID.test(r.anchorOutputId)))) {
    throw new Error('Stil, kombination, farver eller visning er ugyldig.');
  }
  if (r.compositionVersion !== undefined && r.compositionVersion !== 1 && r.compositionVersion !== 2) throw new Error('Ukendt kompositionsversion.');
  if (r.referencePackId !== undefined && r.referencePackId !== ONLINETRYKSAGER_PACK_ID) throw new Error('Ukendt referencepakke.');
  if (r.productReferenceId !== undefined && (!r.referencePackId || typeof r.productReferenceId !== 'string' || !STUDIO_UUID.test(r.productReferenceId))) throw new Error('Ugyldig produktreference.');
  if (r.libraryReferenceId !== undefined && (typeof r.libraryReferenceId !== 'string' || !STUDIO_UUID.test(r.libraryReferenceId) || r.referencePackId)) throw new Error('Ugyldig biblioteksreference.');
  if (productKey && !studioViews(r.styleId, productKey).some(v => v.id === r.viewId)) throw new Error('Visningen passer ikke til produktet og stilen.');
  return { version: 1, ...(r.compositionVersion ? {compositionVersion:r.compositionVersion} : {}), styleId: r.styleId, treatmentId: r.treatmentId, viewId: r.viewId, palette: [...r.palette], anchorOutputId: r.anchorOutputId, ...(r.referencePackId ? {referencePackId:r.referencePackId} : {}), ...(r.productReferenceId ? {productReferenceId:r.productReferenceId} : {}), ...(r.libraryReferenceId ? {libraryReferenceId:r.libraryReferenceId} : {}) };
}
export function studioVariant(view: StudioView): IconStudioVariantKey {
  const result = STUDIO_VIEWS.find(v => v.id === view);
  if (!result) throw new Error('Ukendt visning.');
  return result.variant;
}
export function studioRecipeSignature(recipe: StudioRecipe) {
  const r = parseStudioRecipe(recipe);
  return JSON.stringify([r.version,r.styleId,r.treatmentId,r.palette,...(r.referencePackId ? [r.referencePackId] : []),...(r.compositionVersion ? [{compositionVersion:r.compositionVersion}] : []),...(r.libraryReferenceId ? [{libraryReferenceId:r.libraryReferenceId}] : [])]);
}
export function planStudioCollection(products: IconStudioProductKey[], views: StudioView[], recipe: StudioRecipe) {
  if (recipe.libraryReferenceId && products.length > 1) throw new Error('En biblioteksreference kan kun bruges til ét produkt ad gangen.');
  if (!products.length || !views.length || new Set(products).size !== products.length || new Set(views).size !== views.length) throw new Error('Vælg produkter og visninger uden gentagelser.');
  const items = products.flatMap(productKey => {
    if (!ICON_STUDIO_PRODUCT_KEYS.includes(productKey)) throw new Error('Ukendt produkt.');
    return views.map(viewId => ({ productKey, recipe: parseStudioRecipe({ ...recipe, viewId }, productKey) }));
  });
  if (items.length > STUDIO_MAX_COLLECTION) throw new Error(`Vælg højst ${STUDIO_MAX_COLLECTION} billeder pr. samling.`);
  return items;
}
export function compileStudioRecipe(recipe: StudioRecipe, folderGuide = false, opaqueBackdrop = false) {
  const r = parseStudioRecipe(recipe);
  if (isGraphicStudioStyle(r.styleId)) {
    const wash = r.styleId === 'outline' && r.treatmentId === 'wash';
    const singleInk = r.styleId === 'silhouette' || (r.styleId === 'outline' && !wash);
    return [
      studioStyle(r.styleId).prompt,
      `Draw a precise flat vector-style graphic. No shadows, lighting, highlights, bevels, photographic material or simulated paper thickness. Perspective describes the shape only, never shading. ${r.treatmentId === 'paper' || wash ? 'Only the explicitly selected paper grain or watercolour treatment may add texture or variation.' : 'No texture or gradients.'}`,
      singleInk ? `Use only ${r.palette[0]} for the artwork. Do not add a second colour, white paper or ivory panels.` : `Use exactly ${r.palette.join(' and ')} as uniform solid colour fills. No additional shades or outline colour.`,
      wash ? `Draw fine consistent contour lines in ${r.palette[0]} with a restrained translucent wash in ${r.palette[1]}. Keep unpainted space transparent.` : r.styleId === 'outline' ? 'Draw only fine, consistent contour strokes and visible fold lines, about 2 pixels wide at 1024px. All panel interiors are unfilled; no fills anywhere. The empty interiors must be transparent, just like the surrounding canvas. Avoid hidden edges through the two flaps.' : r.styleId === 'silhouette' ? 'Fill the whole connected folder silhouette with the single ink colour. Show the centre fold and the two flap boundaries using narrow transparent negative-space seams, not differently coloured panels. All filled regions have alpha 255.' : 'Use clean flat planes with crisp edges. Filled regions, including the light panels, have alpha 255. The centre fold can be a very fine boundary; no drop shadow.',
      STUDIO_TREATMENTS.find(t => t.id === r.treatmentId)!.prompt,
      folderGuide ? 'Use exactly the camera projection and panel layout of the attached single-folder guide. Its role is geometry; the graphic rules here determine all rendering.' : STUDIO_VIEWS.find(v => v.id === r.viewId)!.prompt,
      'Exactly one isolated product specimen. For a presentation folder show one opened folder with two retaining flaps on the right panel and a plain left cover. No second folder, insert, montage or extra viewpoint. Centre the complete silhouette at 76 percent of the square canvas.',
      opaqueBackdrop ? 'Empty canvas and unfilled areas use the specified uniform removable backdrop colour. Never paint a white background or a checkerboard pattern.' : 'Use a real transparent alpha background. Empty canvas, negative-space seams and unfilled interiors have alpha 0. Antialias only the artwork edges. No background tint, white rectangle, checkerboard pattern or haze.',
      'Preserve product proportions and construction. Do not add text, lettering, watermarks or logos. Brand artwork is applied separately.',
      r.anchorOutputId && !folderGuide ? 'The first image is the approved collection style anchor. Match its graphic rendering, stroke weight and scale with the requested product and camera.' : '',
      r.referencePackId ? 'References supply product construction only. Replace their colours with the selected graphic palette and ignore their lighting, photographic materials, logos and wording.' : '',
      'Keep the style and camera locked across all proposals; variation must not change the recipe.',
    ].filter(Boolean).join('\n');
  }
  return [
    studioStyle(r.styleId).prompt,
    STUDIO_TREATMENTS.find(t => t.id === r.treatmentId)!.prompt,
    folderGuide ? 'Use exactly the camera projection in the attached single-folder guide.' : STUDIO_VIEWS.find(v => v.id === r.viewId)!.prompt,
    `Locked palette: ${r.palette.join(' and ')}. Keep neutral material highlights where needed.`,
    'Exactly one isolated product specimen in the requested camera view. Reference images may show several copies or an open/closed comparison; do not reproduce that comparison, montage, second specimen or second viewpoint. For a presentation folder, show only the opened folder with its flaps, never an additional standing closed folder behind it. Centre the single specimen at 76 percent of the square canvas; the whole silhouette and shadow must fit. Upper-left key light unless the selected lighting treatment overrides it.',
    opaqueBackdrop ? 'Render the entire image opaque. All cardstock panels, including white areas, are solid physical surfaces. The solid colour backdrop will be removed separately; never use transparency for paper.' : 'All physical product surfaces must be fully opaque, including every white paper panel, cover, flap and sheet. White paper is a solid object, never a transparent cutout. Render white surfaces as opaque softly shaded ivory-white with clearly visible material and edges; alpha must be 255 across the entire physical surface. Only empty space outside the product silhouette may be transparent. Never erase unprinted white material when removing artwork.',
    'Preserve product proportions and construction. Do not add text, lettering, watermarks or logos. Brand artwork is applied separately.',
    r.anchorOutputId && !folderGuide ? 'The first image is the approved collection style anchor. Match its palette, lighting, scale and rendering language; use the requested product and camera, not the anchor product geometry.' : '',
    folderGuide ? 'Onlinetryksager catalogue finish: thin opaque printed card, crisp edges, restrained commercial 3D presentation, soft neutral studio lighting. Use the locked palette and the supplied pose guide. Brand artwork is applied later.' : r.referencePackId ? 'Onlinetryksager reference pack: clear thin print materials, crisp edges, restrained commercial 3D presentation, soft neutral studio shadow. Use the attached product reference for construction and proportions, but redraw it in the selected style and camera. Replace all source colours with the locked palette; preserve neutral paper highlights. Remove every original logo, OT or WP monogram, wording, label, badge, TOPSELLER sticker and printed design. Use clean unprinted surfaces with restrained solid colour areas. Never imitate a source logo as an abstract shape.' : '',
    'Keep the style and camera locked across all proposals; variation must not change the recipe.',
  ].filter(Boolean).join('\n');
}
