import { currentRollLabelSelection, rollLabelPdfHash } from '../designer/rollLabelGeneratedTemplate';
import { buildEllipseOffsetGeometry, type EllipseOffsetGeometry } from '../designer/ellipseOffsetGeometry';
import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelOvalRestriction = 'customer_cutline' | 'supplier_creates_cutline' | 'variable_data_files'
  | 'multiple_motif_pages' | 'corner_rounding_rule';
export type RollLabelOvalProposal = {
  version: 1; status: 'source_semantics_proposed_unaccepted'; model: 'mathematical_ellipse_true_normal_offsets';
  productId: string; familyId: string; profileKey: string; articleId: string; materialId: string;
  currentProfileSha256: string; sourceEvidenceSha256: string; sha256: string;
  bleedMm: number; safeMm: number;
  sourceDocuments: Array<{ role: 'guide' | 'template'; sha256: string; textSha256: string; pageCount: 1 }>;
  sourceRestrictions: RollLabelOvalRestriction[];
  supplierEllipseIdentityProved: false; sourceGeometryAccepted: false; onlineDesignerVerified: false; orderReady: false;
};
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const kinds: RollLabelOvalRestriction[] = ['customer_cutline','supplier_creates_cutline','variable_data_files','multiple_motif_pages','corner_rounding_rule'];
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
export const rollLabelOvalProposalHash = (value: unknown) => rollLabelPdfHash(new TextEncoder().encode(canonical(value)));
export const rollLabelOvalCurrentProfileHash = (productId: string, familyId: string, sections: unknown, profile: RollLabelReviewProfile) =>
  rollLabelOvalProposalHash({ productId, familyId, sections, profile });

/** An offline reviewed proposal is not source acceptance. This resolver is
 * intentionally absent from ordinary template/Designer/order entry points.
 * A query or saved geometry cannot grant access even when a proposal is valid. */
export async function reviewCurrentRollLabelOvalProposal(selection: unknown, productId: string,
  productContract: unknown, candidate: unknown) {
  const current = currentRollLabelSelection(selection, productId, productContract);
  if (!current || !candidate || typeof candidate !== 'object') return null;
  const c = candidate as RollLabelOvalProposal, { profile: p, contract, selection: s } = current;
  if (c.version !== 1 || c.status !== 'source_semantics_proposed_unaccepted' || c.model !== 'mathematical_ellipse_true_normal_offsets'
    || c.productId !== productId || c.familyId !== contract.familyId || c.profileKey !== p.key
    || c.articleId !== p.articleId || c.materialId !== p.sourceMaterialId || p.key !== `${p.articleId}:${p.sourceMaterialId}`
    || p.format.shape !== 'oval' || !p.format.customSize || p.key === '63738:1269564' || contract.familyId === '31957'
    || !hash(c.sourceEvidenceSha256) || c.sourceEvidenceSha256 !== p.artworkInstructions?.sourceEvidenceSha256
    || !hash(c.sha256) || !hash(c.currentProfileSha256)
    || ![c.bleedMm,c.safeMm].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)
    || c.supplierEllipseIdentityProved !== false || c.sourceGeometryAccepted !== false || c.onlineDesignerVerified !== false || c.orderReady !== false
    || !Array.isArray(c.sourceDocuments) || c.sourceDocuments.length !== 2
    || ['guide','template'].some(role => c.sourceDocuments.filter(d => d && d.role === role && d.pageCount === 1 && hash(d.sha256) && hash(d.textSha256)).length !== 1)
    || !Array.isArray(c.sourceRestrictions) || new Set(c.sourceRestrictions).size !== c.sourceRestrictions.length
    || c.sourceRestrictions.some(k => !kinds.includes(k))) return null;
  const { sha256: expected, ...payload } = c;
  if (await rollLabelOvalProposalHash(payload) !== expected
    || await rollLabelOvalCurrentProfileHash(productId, contract.familyId, contract.sections, p) !== c.currentProfileSha256) return null;
  const blockers = ['supplier_ellipse_semantics_unaccepted'];
  const art = p.artworkInstructions;
  if (art?.documentationStatus !== 'no_selective_mask_required_by_signals' || !Array.isArray(art.requirements) || art.requirements.length !== 0) blockers.push('selective_material_rules_require_review');
  if (p.format.motifCount !== 1 || (p.format.pageCount !== null && p.format.pageCount !== 1)) blockers.push('multiple_motifs_or_pages_unimplemented');
  if (c.sourceRestrictions.includes('customer_cutline')) blockers.push('customer_cutline_contract_unproved');
  if (c.sourceRestrictions.includes('variable_data_files')) blockers.push('variable_data_companion_files_unimplemented');
  if (c.sourceRestrictions.includes('customer_cutline') && c.sourceRestrictions.includes('supplier_creates_cutline')) blockers.push('conflicting_cutline_instructions');
  let geometry: EllipseOffsetGeometry | null = null, geometryError: string | null = null;
  try { geometry = buildEllipseOffsetGeometry(s.widthMm!, s.heightMm!, c.bleedMm, c.safeMm); }
  catch (error) { geometryError = error instanceof Error ? error.message : 'Uafklaret ovalgeometri.'; blockers.push('physical_offset_geometry_refused'); }
  return { proposal: c, selection: s, geometry, geometryError, blockers,
    productionCutlinePolicy: c.sourceRestrictions.includes('supplier_creates_cutline') ? 'supplier_creates_cutline' as const : 'unproved' as const,
    sourceGeometryAccepted: false as const, designerAllowed: false as const, orderReady: false as const };
}
