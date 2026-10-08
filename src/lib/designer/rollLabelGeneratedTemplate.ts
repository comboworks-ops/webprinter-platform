import { readRollLabelProductContract, validateRollLabelConfiguration, type RollLabelSelection } from '../products/rollLabelConfiguration';
import type { RollLabelReviewProfile } from '../products/rollLabelReview';
import { readRollLabelSizeGeometry } from '../products/rollLabelSizeGeometry';
import { rollLabelArtworkForState } from '../products/rollLabelArtworkInstructions';
import { generateRollLabelSizeTemplate } from './generateRollLabelSizeTemplate';

// A source descriptor, never a fetch URL, a blob URL or order authority.
export const ROLL_LABEL_TEMPLATE_PREFIX = 'webprinter-roll-label-template:v1?';
const hashPattern = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const isGeneratedRollLabelTemplate = (value: unknown): value is string => typeof value === 'string' && value.startsWith('webprinter-roll-label-template:');

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export async function rollLabelPdfHash(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer))).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Reject a saved/caller identity unless the current profile reconstructs every
 * field. This check authorizes only document preparation, never a price. */
export function currentRollLabelSelection(value: unknown, productId: string, productContract: unknown) {
  const contract = readRollLabelProductContract(productContract, productId);
  if (!contract || !record(value) || value.version !== 1 || value.productId !== productId || value.familyId !== contract.familyId
    || !record(value.sourceOptions) || !Object.values(value.sourceOptions).every(v => typeof v === 'string')
    || !Array.isArray(value.motifAllocations) || !value.motifAllocations.every(v => Number.isSafeInteger(v) && v > 0)
    || ![value.widthMm, value.heightMm].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) return null;
  const matches = contract.profiles.filter(p => p.key === value.profileKey);
  const profile = matches.length === 1 ? matches[0] : null;
  if (!profile || !profile.customerArtworkRequired) return null;
  const s = value as RollLabelSelection;
  const checked = validateRollLabelConfiguration(profile, { dimensions: { width: String(s.widthMm), height: String(s.heightMm) },
    quantity: String(s.quantity), allocations: s.motifAllocations.map(String), optionStateId: s.optionStateId },
  { productId, familyId: contract.familyId }).selection;
  if (!checked || canonical(checked) !== canonical({ version: s.version, productId: s.productId, familyId: s.familyId,
    profileKey: s.profileKey, articleId: s.articleId, materialId: s.materialId, optionStateId: s.optionStateId, sourceOptions: s.sourceOptions,
    widthMm: s.widthMm, heightMm: s.heightMm, quantity: s.quantity, motifCount: s.motifCount, motifAllocations: s.motifAllocations })) return null;
  return { contract, profile, selection: checked };
}

export function rollLabelGeneratedDesignerAllowed(profile: RollLabelReviewProfile, stateId: string) {
  const art = profile.artworkInstructions;
  return Boolean(readRollLabelSizeGeometry(profile) && profile.format.motifCount === 1
    && art?.version === 1 && art.profileKey === profile.key && hashPattern.test(art.sourceEvidenceSha256)
    && art.documentationStatus === 'no_selective_mask_required_by_signals' && Array.isArray(art.requirements)
    && art.requirements.length === 0 && rollLabelArtworkForState(profile, stateId).length === 0);
}

function materialDocumented(profile: RollLabelReviewProfile, stateId: string) {
  const art = profile.artworkInstructions;
  return Boolean(art?.version === 1 && art.profileKey === profile.key
    && art.sourceEvidenceSha256 === profile.sizeGeometry?.sourceEvidenceSha256
    && Array.isArray(art.requirements) && ['no_selective_mask_required_by_signals','mask_rules_documented'].includes(art.documentationStatus)
    && rollLabelArtworkForState(profile, stateId).every(requirement => requirement.documented));
}

export function readRollLabelGeneratedDescriptor(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith(ROLL_LABEL_TEMPLATE_PREFIX)) return null;
  const params = new URLSearchParams(value.slice(ROLL_LABEL_TEMPLATE_PREFIX.length));
  const keys = ['productId','familyId','profileKey','widthMm','heightMm','profileSha256'];
  if ([...params.keys()].length !== keys.length || keys.some(key => params.getAll(key).length !== 1)
    || ['productId','familyId','profileKey'].some(key => !params.get(key) || !/^[a-zA-Z0-9:-]+$/.test(params.get(key)!))
    || !hashPattern.test(params.get('profileSha256') || '')
    || ['widthMm','heightMm'].some(key => !Number.isFinite(Number(params.get(key))) || Number(params.get(key)) <= 0)) return null;
  return { productId: params.get('productId')!, familyId: params.get('familyId')!, profileKey: params.get('profileKey')!,
    widthMm: Number(params.get('widthMm')), heightMm: Number(params.get('heightMm')), profileSha256: params.get('profileSha256')! };
}

/** Rehash current source data and regenerate physical PDF bytes. A rule hash is
 * intentionally never used as templatePdfSha256. */
export async function prepareRollLabelGeneratedTemplate(selection: unknown, productId: string, productContract: unknown) {
  const current = currentRollLabelSelection(selection, productId, productContract);
  if (!current || !readRollLabelSizeGeometry(current.profile) || !materialDocumented(current.profile, current.selection.optionStateId)) return null;
  const { profile, contract, selection: s } = current;
  const profileSha256 = await rollLabelPdfHash(new TextEncoder().encode(canonical({ familyId: contract.familyId,
    productId, sections: contract.sections, profile })));
  const params = new URLSearchParams({ productId, familyId: contract.familyId, profileKey: profile.key,
    widthMm: String(s.widthMm), heightMm: String(s.heightMm), profileSha256 });
  const descriptor = ROLL_LABEL_TEMPLATE_PREFIX + params;
  const generated = await generateRollLabelSizeTemplate(profile, s.widthMm!, s.heightMm!);
  const sha256 = await rollLabelPdfHash(generated.bytes);
  return { ...generated, descriptor, sha256, profileSha256, selection: s,
    designerAllowed: rollLabelGeneratedDesignerAllowed(profile, s.optionStateId) };
}

export async function verifyRollLabelGeneratedTemplate(descriptor: unknown, expectedPdfSha256: unknown, selection: unknown,
  productId: string, productContract: unknown) {
  const parsed = readRollLabelGeneratedDescriptor(descriptor);
  if (!parsed || typeof expectedPdfSha256 !== 'string' || !hashPattern.test(expectedPdfSha256) || parsed.productId !== productId) return null;
  try {
    const result = await prepareRollLabelGeneratedTemplate(selection, productId, productContract);
    return result && result.descriptor === descriptor && result.sha256 === expectedPdfSha256 ? result : null;
  } catch { return null; }
}
