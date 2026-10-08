import type { ProductFormatGuideData } from '@/components/product-price-page/ProductFormatGuide';
import type { RollLabelReviewProfile } from './rollLabelReview';
import type { RollLabelSelection } from './rollLabelConfiguration';
import { rollLabelArtworkForState } from './rollLabelArtworkInstructions';
import { readRollLabelCodingDelivery } from './rollLabelCodingDelivery';

export type RollLabelSizeGeometry = {
  version: 1; profileKey: string; shape: 'rectangle' | 'circle'; bleedMm: number; safeMm: number;
  cornerRadiusMm: number | null; sha256: string; sourceEvidenceSha256: string;
  geometryMode: 'regenerate_physical_offsets_from_explicit_rules'; sourcePagesAreExamples: true;
  evidence: Array<{ role: 'guide' | 'template'; sha256: string; textSha256: string }>;
  onlineDesignerVerified: false;
};
const hash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const pt = 72 / 25.4;
const k = 4 * (Math.SQRT2 - 1) / 3;

export function readRollLabelSizeGeometry(profile: RollLabelReviewProfile): RollLabelSizeGeometry | null {
  const rule = profile.sizeGeometry;
  if (!rule || rule.version !== 1 || rule.profileKey !== profile.key || profile.blockers.length
    || !profile.customerArtworkRequired || !profile.format.customSize || rule.shape !== profile.format.shape
    || !['rectangle', 'circle'].includes(rule.shape) || !positive(rule.bleedMm) || !positive(rule.safeMm)
    || rule.geometryMode !== 'regenerate_physical_offsets_from_explicit_rules' || rule.sourcePagesAreExamples !== true
    || !hash(rule.sha256) || !hash(rule.sourceEvidenceSha256) || !profile.sizeContract
    || !Array.isArray(rule.evidence) || rule.evidence.length !== 2
    || ['guide', 'template'].some(role => rule.evidence.filter(e => e.role === role && hash(e.sha256) && hash(e.textSha256)).length !== 1)
    || (rule.shape === 'rectangle' ? !positive(rule.cornerRadiusMm) : rule.cornerRadiusMm !== null)) return null;
  return rule;
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  if (!r) return `M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`;
  return `M ${x+r} ${y} L ${x+w-r} ${y} C ${x+w-r+k*r} ${y} ${x+w} ${y+r-k*r} ${x+w} ${y+r} L ${x+w} ${y+h-r} C ${x+w} ${y+h-r+k*r} ${x+w-r+k*r} ${y+h} ${x+w-r} ${y+h} L ${x+r} ${y+h} C ${x+r-k*r} ${y+h} ${x} ${y+h-r+k*r} ${x} ${y+h-r} L ${x} ${y+r} C ${x} ${y+r-k*r} ${x+r-k*r} ${y} ${x+r} ${y} Z`;
}
function circle(x: number, y: number, d: number) {
  const r = d/2, cx = x+r, cy = y+r;
  return `M ${cx+r} ${cy} C ${cx+r} ${cy+k*r} ${cx+k*r} ${cy+r} ${cx} ${cy+r} C ${cx-k*r} ${cy+r} ${cx-r} ${cy+k*r} ${cx-r} ${cy} C ${cx-r} ${cy-k*r} ${cx-k*r} ${cy-r} ${cx} ${cy-r} C ${cx+k*r} ${cy-r} ${cx+r} ${cy-k*r} ${cx+r} ${cy} Z`;
}

/** Each physical offset is regenerated at the customer's dimensions. Example
 * pages and corner radii are never stretched to fit another size. */
export function rollLabelSizeGuide(profile: RollLabelReviewProfile, widthMm: number | null, heightMm: number | null,
  stateId = profile.optionStates?.initialStateId || ''): ProductFormatGuideData | null {
  const rule = readRollLabelSizeGeometry(profile);
  if (!rule || !positive(widthMm) || !positive(heightMm)
    || !profile.sizeContract!.axes.every(axis => {
      const value = axis.axis === 'width' ? widthMm : heightMm;
      return value >= axis.minMm && value <= axis.maxMm;
    }) || (profile.sizeContract!.heightFromWidth && widthMm !== heightMm)
    || Math.min(widthMm, heightMm) <= 2*rule.safeMm
    || (rule.cornerRadiusMm !== null && 2*rule.cornerRadiusMm > Math.min(widthMm,heightMm))) return null;
  const b = rule.bleedMm, s = rule.safeMm, r = rule.cornerRadiusMm || 0;
  const w = (widthMm+2*b)*pt, h = (heightMm+2*b)*pt;
  const outline = (inset: number) => rule.shape === 'circle'
    ? circle((b+inset)*pt, (b+inset)*pt, (widthMm-2*inset)*pt)
    : roundedRect((b+inset)*pt, (b+inset)*pt, (widthMm-2*inset)*pt, (heightMm-2*inset)*pt, Math.max(0,r-inset)*pt);
  const instructionsDa = [`Lad baggrunde gå ${b} mm ud over stansen.`,
    `Hold tekst og vigtige elementer mindst ${s} mm inden for stansen.`,
    ...(r ? [`Hjørnerne afrundes med ${r} mm radius.`] : []),
    'Lever en PDF med indlejrede skrifter og billeder i mindst 300 dpi.',
    ...rollLabelArtworkForState(profile,stateId).flatMap(requirement=>requirement.instructionsDa),
    ...(readRollLabelCodingDelivery(profile)?.instructionsDa || [])];
  const labelMm = (n:number)=>n.toLocaleString('da-DK',{maximumFractionDigits:6});
  return { productName:'Etiketter på rulle', formatLabel:rule.shape==='circle' ? `Rund · Ø ${labelMm(widthMm)} mm` : `${labelMm(widthMm)} × ${labelMm(heightMm)} mm`,
    finishedWidthMm:widthMm, finishedHeightMm:heightMm, dataWidthMm:widthMm+2*b, dataHeightMm:heightMm+2*b,
    bleedMm:b, safeAreaMm:s, minDpi:300, layoutKind:'flat', instructionsDa, template:null,
    vectorGuide:{version:1,articleId:profile.articleId,templateSha256:null,geometryContractSha256:rule.sha256,
      pages:[{widthPt:w,heightPt:h,label:rule.shape==='circle' ? 'Rund etiket' : 'Rektangulær etiket',labels:[],
        paths:[{role:'data',d:roundedRect(0,0,w,h,0)}, {role:'cut',d:outline(0)}, {role:'safe',d:outline(s)}]}]} };
}

export function rollLabelSelectionGuide(profile: RollLabelReviewProfile | null, selection: RollLabelSelection | null) {
  if (!profile || !selection || selection.profileKey !== profile.key || selection.articleId !== profile.articleId
    || selection.materialId !== profile.sourceMaterialId) return null;
  return rollLabelSizeGuide(profile,selection.widthMm,selection.heightMm,selection.optionStateId);
}
