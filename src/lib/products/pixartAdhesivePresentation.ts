import type { TooltipConfig } from '../../components/ProductTooltipIcon';
import { materialTooltipAnchor, type MaterialSource } from './materialPresentation.ts';

export const PIXART_ADHESIVE_SOURCE = 'https://www.pixartprinting.eu/wide-format/printing-self-adhesive-pvc/flat-surface-adhesive/';
// Public option-help reviewed 7 October 2026. These are presentation identities,
// never replacements for supplier option IDs or pricing keys.
const materials: Record<string, [string, string, string]> = {
  'Matt Monomeric Self-Adhesive Vinyl': ['Mat monomerfolie', '100 µm folie til plane flader. Laminering anbefales ved slid.', '100 µm film for flat surfaces. Laminate where abrasion is expected.'],
  'Gloss Monomeric Self-Adhesive Vinyl': ['Blank monomerfolie', 'Blank 100 µm folie til plane flader. Laminering anbefales ved slid.', 'Gloss 100 µm film for flat surfaces. Laminate where abrasion is expected.'],
  'Matt Monomeric Self-Adhesive Vinyl with Grey Back': ['Mat monomerfolie, grå bagside', 'Mat folie med dækkende grå bagside til farvede underlag.', 'Matt film with an opaque grey backing for coloured surfaces.'],
  'Gloss Polymeric Self-Adhesive Vinyl with grey back': ['Blank polymerfolie, grå bagside', 'Fleksibel folie til glatte flader med dækkende grå bagside.', 'Flexible film for smooth surfaces with an opaque grey backing.'],
  'Transparent Self-Adhesive Vinyl': ['Transparent klæbefolie', 'Gennemsigtig monomerfolie til plane, glatte flader og glas.', 'Transparent monomeric film for flat, smooth surfaces and glass.'],
  'Matt PVC-Free Film with Grey Back': ['Mat PVC-fri folie, grå bagside', 'Mat polypropylenfolie med grå bagside, til indendørs og udendørs brug.', 'Matt polypropylene film with grey backing for indoor and outdoor use.'],
  'White PVC-Free EasyWall': ['Hvid PVC-fri EasyWall', 'Hvid folie med mikrosug, som kan flyttes på glas og vægge.', 'White micro-suction film that can be repositioned on glass and walls.'],
};
const finishes: Record<string, [string, string, string, string]> = {
  'standard matt': ['Standard mat', 'Standard matt', 'Mat beskyttelsesfilm uden UV-filter.', 'Matt protective film without a UV filter.'],
  'standard gloss': ['Standard blank', 'Standard gloss', 'Blank beskyttelsesfilm uden UV-filter.', 'Gloss protective film without a UV filter.'],
  'uv matt': ['UV mat', 'UV matt', 'Mat 70 µm laminering med UV 5-filter mod falmning.', 'Matt 70 µm lamination with a UV 5 filter against fading.'],
  'uv gloss': ['UV blank', 'UV gloss', 'Blank 70 µm laminering med UV 5-filter mod falmning.', 'Gloss 70 µm lamination with a UV 5 filter against fading.'],
};
const finishKey = (name: string) => name.trim().toLowerCase().replace('matte', 'matt').replace('uv filter 5', 'uv');
export const isPixartAdhesiveMaterials = (values: {name: string}[]) => values.length > 0 && values.every(value => Boolean(materials[value.name.trim()]));
export const productionKind = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return normalized === 'standard delivery' ? 'normal' : normalized === 'fast delivery' ? 'fast' : null;
};
export function adhesiveOptionLabel(type: string, name: string, language: 'da' | 'en') {
  if (type === 'materials') return language === 'da' ? materials[name.trim()]?.[0] || name : name;
  if (type === 'finishes') return finishes[finishKey(name)]?.[language === 'da' ? 0 : 1] || name;
  const kind = productionKind(name);
  return kind ? (language === 'da' ? (kind === 'fast' ? 'Hurtig' : 'Normal') : (kind === 'fast' ? 'Fast' : 'Normal')) : name;
}
export function adhesiveTooltipDefault(type: string, source: MaterialSource, sectionId: string, valueId: string): TooltipConfig | undefined {
  const name = source.sourceName || source.name;
  const material = type === 'materials' ? materials[name.trim()] : undefined;
  const finish = type === 'finishes' ? finishes[finishKey(name)] : undefined;
  const kind = type === 'products' ? productionKind(name) : null;
  if (!material && !finish && !kind) return undefined;
  const title = adhesiveOptionLabel(type, name, 'da');
  const titleEn = adhesiveOptionLabel(type, name, 'en');
  const text = material?.[1] || finish?.[2] || (kind === 'fast'
    ? 'Prioriteret produktion. Den viste levering er et estimat; transporttid og bestillingsfrist gælder stadig.'
    : 'Normal produktion. Leveringsestimatet inkluderer produktion og transport efter bestillingsfristen.');
  const textEn = material?.[2] || finish?.[3] || (kind === 'fast'
    ? 'Priority production. Delivery is an estimate; transit time and the order deadline still apply.'
    : 'Normal production. The delivery estimate includes production and transit after the order deadline.');
  return {
    anchor: type === 'materials' ? materialTooltipAnchor(sectionId, valueId) : `${type === 'finishes' ? 'finish' : 'production'}:${sectionId}:${valueId}`,
    title, text, translations: {en: {title: titleEn, text: textEn}},
    icon: 'question', color: '#64748b', animation: 'fade',
  };
}
export function adhesiveProductionOffset(names: string[], configuredOffset: unknown = 2) {
  if (!names.some(name => productionKind(name) === 'fast')) return 0;
  const offset = typeof configuredOffset === 'number' && Number.isFinite(configuredOffset) ? configuredOffset : 2;
  return Math.max(0, Math.floor(offset));
}
