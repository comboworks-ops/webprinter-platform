import { readRollLabelProductContract, validateRollLabelConfiguration, type RollLabelSelection, type RollLabelProductContract } from '../products/rollLabelConfiguration.ts';
import { isGeneratedRollLabelTemplate, verifyRollLabelGeneratedTemplate } from './rollLabelGeneratedTemplate';
import type { ProductFormatGuideData } from '../../components/product-price-page/ProductFormatGuide';

export type RollLabelSavedDocument = { productId: string; tenantId: string; widthMm: number; heightMm: number; bleedMm: number; safeMm: number };
export type RollLabelSavedContext = {
  version: 1; tenantId: string; selection: RollLabelSelection;
  sectionSelections: Record<string, string>;
  template: { url: string; sha256: string; name: string | null; widthMm: number; heightMm: number; bleedMm: number; safeMm: number; pageCount: 1 };
};
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validTemplateUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\s\\]/.test(value)) return false;
  try { const url = new URL(value, 'https://template.local'); return url.protocol === 'https:' && !url.username && !url.password && !url.hash
    || url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password && !url.hash;
  } catch { return false; }
};
const sameOptions = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).length === Object.keys(b).length
  && Object.entries(a).every(([key, value]) => b[key] === value);

/** Saved metadata is selection evidence, never a price, upload or order authority.
 * Recheck against the current product before loading or saving its template. */
function validateSavedRollLabelContext(context: RollLabelSavedContext, contract: RollLabelProductContract, document: RollLabelSavedDocument, generatedGuide?: ProductFormatGuideData): boolean {
  if (contract.productId !== document.productId || contract.familyId !== context.selection.familyId || context.tenantId !== document.tenantId) return false;
  const matches = contract.profiles.filter(p => p.key === context.selection.profileKey);
  const p = matches.length === 1 ? matches[0] : null;
  const guide = generatedGuide || p?.nativeGuide;
  // This saved context describes a single-page template. Multiple-motif artwork
  // requires its own reviewed page binding and cannot borrow this contract.
  if (!p || p.format.motifCount !== 1 || context.selection.motifCount !== 1
    || !p.customerArtworkRequired || !guide || guide.vectorGuide?.templateSha256 !== context.template.sha256) return false;
  const s = context.selection;
  const checked = validateRollLabelConfiguration(p, { dimensions: { width: String(s.widthMm), height: String(s.heightMm) },
    quantity: String(s.quantity), allocations: s.motifAllocations.map(String), optionStateId: s.optionStateId }, { productId: document.productId, familyId: contract.familyId }).selection;
  if (!checked || checked.articleId !== s.articleId || checked.materialId !== s.materialId || checked.profileKey !== s.profileKey
    || checked.widthMm !== s.widthMm || checked.heightMm !== s.heightMm || checked.motifCount !== s.motifCount
    || checked.quantity !== s.quantity || checked.motifAllocations.length !== s.motifAllocations.length
    || !checked.motifAllocations.every((value, index) => value === s.motifAllocations[index])
    || !sameOptions(checked.sourceOptions, s.sourceOptions)) return false;
  if (!sameOptions(context.sectionSelections, { [contract.sections.format]: p.formatValueId, [contract.sections.material]: p.materialValueId })) return false;
  const t = context.template, g = guide;
  return t.widthMm === document.widthMm && t.heightMm === document.heightMm && t.bleedMm === document.bleedMm && t.safeMm === document.safeMm
    && g.finishedWidthMm === t.widthMm && g.finishedHeightMm === t.heightMm && g.bleedMm === t.bleedMm && g.safeAreaMm === t.safeMm;
}

export function readSavedRollLabelContext(snapshot: unknown, document: RollLabelSavedDocument, productContract: unknown): RollLabelSavedContext | null {
  return readContext(snapshot, document, productContract);
}

function readContext(snapshot: unknown, document: RollLabelSavedDocument, productContract: unknown, generatedGuide?: ProductFormatGuideData): RollLabelSavedContext | null {
  if (!isRecord(snapshot) || !isRecord(snapshot.rollLabelContext)) return null;
  const c = snapshot.rollLabelContext;
  if (c.version !== 1 || typeof c.tenantId !== 'string' || !isRecord(c.selection) || !isRecord(c.template) || !isRecord(c.sectionSelections)) return null;
  const s = c.selection, t = c.template;
  if (s.version !== 1 || ['productId','familyId','profileKey','articleId','materialId','optionStateId'].some(key => typeof s[key] !== 'string' || !s[key])
    || !isRecord(s.sourceOptions) || !Object.values(s.sourceOptions).every(v => typeof v === 'string')
    || !Array.isArray(s.motifAllocations) || !s.motifAllocations.every(v => Number.isSafeInteger(v) && v > 0)
    || !Number.isSafeInteger(s.quantity) || Number(s.quantity) <= 0 || !Number.isSafeInteger(s.motifCount) || Number(s.motifCount) <= 0
    || ![s.widthMm,s.heightMm].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)
    || !Object.values(c.sectionSelections).every(v => typeof v === 'string')
    || !(generatedGuide ? isGeneratedRollLabelTemplate(t.url) : validTemplateUrl(t.url)) || typeof t.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(t.sha256)
    || t.pageCount !== 1 || !(t.name === null || typeof t.name === 'string')
    || ![t.widthMm,t.heightMm].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)
    || ![t.bleedMm,t.safeMm].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) return null;
  const context = c as RollLabelSavedContext;
  const contract = readRollLabelProductContract(productContract, document.productId);
  if (!contract || s.productId !== document.productId || !validateSavedRollLabelContext(context, contract, document, generatedGuide)) return null;
  const selection = context.selection, template = context.template;
  return { version: 1, tenantId: context.tenantId,
    selection: { version: 1, productId: selection.productId, familyId: selection.familyId, profileKey: selection.profileKey,
      articleId: selection.articleId, materialId: selection.materialId, optionStateId: selection.optionStateId,
      sourceOptions: { ...selection.sourceOptions }, widthMm: selection.widthMm, heightMm: selection.heightMm,
      quantity: selection.quantity, motifCount: selection.motifCount, motifAllocations: [...selection.motifAllocations] },
    sectionSelections: { ...context.sectionSelections },
    template: { url: template.url, sha256: template.sha256, name: template.name, widthMm: template.widthMm,
      heightMm: template.heightMm, bleedMm: template.bleedMm, safeMm: template.safeMm, pageCount: 1 } };

}

/** Generated contexts must asynchronously regenerate current PDF bytes before
 * accepting either metadata or an overlay. Native bindings keep their old path. */
export async function readVerifiedRollLabelContext(snapshot: unknown, document: RollLabelSavedDocument, productContract: unknown): Promise<RollLabelSavedContext | null> {
  if (!isRecord(snapshot) || !isRecord(snapshot.rollLabelContext)) return null;
  const context = snapshot.rollLabelContext;
  if (!isRecord(context.template) || !isGeneratedRollLabelTemplate(context.template.url)) return readSavedRollLabelContext(snapshot, document, productContract);
  const generated = await verifyRollLabelGeneratedTemplate(context.template.url, context.template.sha256, context.selection, document.productId, productContract);
  if (!generated?.designerAllowed || !generated.guide.vectorGuide) return null;
  return readContext(snapshot, document, productContract, { ...generated.guide,
    vectorGuide: { ...generated.guide.vectorGuide, templateSha256: generated.sha256 } });
}

export async function buildVerifiedRollLabelContext(selection: RollLabelSelection, template: RollLabelSavedContext['template'], document: RollLabelSavedDocument, productContract: unknown) {
  const current = readRollLabelProductContract(productContract, document.productId);
  const profile = current?.profiles.find(p => p.key === selection.profileKey);
  if (!current || !profile) return null;
  return readVerifiedRollLabelContext({ rollLabelContext: { version: 1, tenantId: document.tenantId, selection,
    sectionSelections: { [current.sections.format]: profile.formatValueId, [current.sections.material]: profile.materialValueId }, template } }, document, productContract);
}

export function buildRollLabelSavedContext(selection: RollLabelSelection, template: RollLabelSavedContext['template'], document: RollLabelSavedDocument, productContract: unknown): RollLabelSavedContext | null {
  const contract = readRollLabelProductContract(productContract, document.productId);
  const profile = contract?.profiles.find(p => p.key === selection.profileKey);
  if (!profile || !contract) return null;
  return readSavedRollLabelContext({ rollLabelContext: { version: 1, tenantId: document.tenantId, selection,
    sectionSelections: { [contract.sections.format]: profile.formatValueId, [contract.sections.material]: profile.materialValueId }, template } }, document, productContract);
}
