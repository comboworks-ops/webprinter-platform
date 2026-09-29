import { A7_FLYER_CANDIDATE } from './flatPrintDefinition.ts';
import { DIN_LANG_HALF_FOLD } from './halfFoldDefinition.ts';
import { DIN_LANG_ROLL_FOLD } from './rollFoldDefinition.ts';
import { DIN_LANG_ZIGZAG_FOLD } from './zigzagFoldDefinition.ts';
import { A4_THREE_MM_FOLDER } from './spineFolderDefinition.ts';
import { A4_FIVE_MM_FOLDER } from './fiveMmFolderDefinition.ts';
import { A4_TEN_MM_FOLDER } from './tenMmFolderDefinition.ts';
import { SALES_FOLDER_MODELS } from './salesFolderModels.generated.ts';
import type { DesignerTemplateLaunch } from '../designer/productTemplateLinks.ts';

const storage = 'https://ziattmsmiirfweiuunfo.supabase.co/storage/v1/object/public/product-templates/templates/';
/** Individually approved models and the explicitly authorized sales-folder batch.
 * Exact template measurements and authorization are recorded in docs/3d-review/plan.json.
 * Bind to the template bytes, never a product name or an approximate paper size.
 * Tenant copies using the same approved template inherit the construction. */
export const APPROVED_PRINT_MODELS = [
  { kind: 'flat', definition: A7_FLYER_CANDIDATE, label: 'A7 · 74 × 105 mm · enkeltsidet', pages: 1,
    templateUrl: storage + '8675744a-e5be-40c5-b8d8-1a0b7c214b10/webprinter-din-a7-74x105-enkeltsidet-skabelon.pdf' },
  { kind: 'half', definition: DIN_LANG_HALF_FOLD, label: 'DIN Lang · midterfalset · 4 sider', pages: 2,
    templateUrl: storage + '09e39172-1148-4429-b082-01c0f1232f09-template-DIN%20Lang-1786486563044.pdf' },
  { kind: 'roll', definition: DIN_LANG_ROLL_FOLD, label: 'DIN Lang · rullefalset · 6 sider', pages: 2,
    templateUrl: storage + '09e39172-1148-4429-b082-01c0f1232f09-din-lang-6-sider-rullefalset.pdf?v=90e400cacc56' },
  { kind: 'zigzag', definition: DIN_LANG_ZIGZAG_FOLD, label: 'DIN Lang · zigzagfalset · 6 sider', pages: 2,
    templateUrl: storage + '09e39172-1148-4429-b082-01c0f1232f09-din-lang-6-sider-zigzagfalset.pdf?v=dd83c95a4916' },
  { kind: 'spine', definition: A4_THREE_MM_FOLDER, label: 'A4 salgsmappe · 3 mm ryg · tryk på ydersiden', pages: 1,
    templateUrl: 'https://ziattmsmiirfweiuunfo.supabase.co/storage/v1/object/public/design-library/template-pdfs/00000000-0000-0000-0000-000000000000/supplier-imports/wmd-sales-folders/wmd-sales-folders-20260831-full/125300eebdcbbccae662396dc3860b93bc36542e9be1411a28291f65dc1808ad.pdf' },
  { kind: 'spine', definition: A4_FIVE_MM_FOLDER, label: 'A4 salgsmappe · 5 mm ryg · tryk på ydersiden', pages: 1,
    templateUrl: 'https://ziattmsmiirfweiuunfo.supabase.co/storage/v1/object/public/design-library/template-pdfs/00000000-0000-0000-0000-000000000000/supplier-imports/wmd-sales-folders/wmd-sales-folders-20260831-full/313a54c49ebc2803526ec4c647779bdb40989a25d40e0ba5ba14fcce1ec7a02c.pdf' },
  { kind: 'spine', definition: A4_TEN_MM_FOLDER, label: 'A4 salgsmappe · 10 mm ryg · tryk på ydersiden', pages: 1,
    templateUrl: 'https://ziattmsmiirfweiuunfo.supabase.co/storage/v1/object/public/design-library/template-pdfs/00000000-0000-0000-0000-000000000000/supplier-imports/wmd-sales-folders/wmd-sales-folders-20260831-full/7a660eaeacc2a35a7b3a2cedd65b3d2d580c5df07167a97c0b05d9cc42e4de88.pdf' },
  ...SALES_FOLDER_MODELS.filter(model => model.artworkMode !== 'review_only' && ![A4_THREE_MM_FOLDER.templateHash, A4_FIVE_MM_FOLDER.templateHash, A4_TEN_MM_FOLDER.templateHash].includes(model.definition.templateHash)),
] as const;
export type ApprovedPrintModel = typeof APPROVED_PRINT_MODELS[number];
/** The sales-folder template has a second, non-printing reference spread. */
export function printModelTemplatePageCount(model: ApprovedPrintModel): number {
  return model.kind === 'sales-folder' ? model.templatePageCount : model.kind === 'spine' ? 2 : model.pages;
}
/** Some supplier PDFs include non-printing reference spreads. Export only the
 * approved artwork sides, while ordinary unknown templates retain all pages. */
export function printModelArtworkPageIndices(model: ApprovedPrintModel | null, templatePageCount: number): number[] {
  if (model && templatePageCount !== printModelTemplatePageCount(model)) throw new Error('Skabelonens sider er ikke klar.');
  return Array.from({ length: model?.pages ?? templatePageCount }, (_, index) => index);
}
export interface PrintArtwork { outside: string; inside?: string }
export interface PrintTemplateIdentity { pdfUrl?: string | null; templatePdfSha256?: string | null }

/** Legacy leaflet metadata stores the full PDF sheet; the existing order and
 * designer contract expects trim dimensions plus bleed. Adapt only the exact
 * verified template at handoff, without rewriting catalogue data or drafts. */
export function approvedPrintTemplateLaunch(template: DesignerTemplateLaunch | null, model: ApprovedPrintModel | null): DesignerTemplateLaunch | null {
  if (!template || !model || approvedTemplateCandidate(template) !== model) return template;
  const bleed = template.bleedMm ?? 0;
  if (model.kind !== 'flat' && bleed === model.definition.bleedMm
    && Math.abs((template.widthMm ?? 0) - model.definition.sheetWidthMm) < .15
    && Math.abs((template.heightMm ?? 0) - model.definition.sheetHeightMm) < .15) {
    return { ...template, widthMm: model.definition.sheetWidthMm - 2 * bleed,
      heightMm: model.definition.sheetHeightMm - 2 * bleed, templatePdfSha256: model.definition.templateHash };
  }
  return { ...template, templatePdfSha256: model.definition.templateHash };
}

export function resolveApprovedPrintModel(hash?: string | null, sheetWidthMm?: number, sheetHeightMm?: number): ApprovedPrintModel | null {
  const model = APPROVED_PRINT_MODELS.find(item => item.definition.templateHash === hash?.trim().toLowerCase());
  if (!model) return null;
  if (sheetWidthMm !== undefined || sheetHeightMm !== undefined) {
    if (!Number.isFinite(sheetWidthMm) || !Number.isFinite(sheetHeightMm)
      || Math.abs(sheetWidthMm! - model.definition.sheetWidthMm) > .15
      || Math.abs(sheetHeightMm! - model.definition.sheetHeightMm) > .15) return null;
  }
  return model;
}

/** Candidate only; a URL match still requires a successful SHA-256 readback. */
export function approvedTemplateCandidate(template?: PrintTemplateIdentity | null): ApprovedPrintModel | null {
  if (template?.templatePdfSha256) return resolveApprovedPrintModel(template.templatePdfSha256);
  return APPROVED_PRINT_MODELS.find(model => model.templateUrl === template?.pdfUrl) ?? null;
}

export function isPrintModelEnabled(model: ApprovedPrintModel, workspaceContent?: unknown, selections?: Record<string, string | null>): boolean {
  if (!workspaceContent || typeof workspaceContent !== 'object' || !('preview3d' in workspaceContent)) return true;
  const config = workspaceContent.preview3d;
  if (!config || typeof config !== 'object' || !('version' in config) || config.version !== 1
    || !('variants' in config) || !Array.isArray(config.variants)) return false;
  const matches = new Set<string>();
  for (const variant of config.variants) {
    if (!variant || typeof variant.templateHash !== 'string' || !Array.isArray(variant.conditions)
      || variant.conditions.some((c: { sectionId?: unknown; valueId?: unknown } | null) => !c
        || typeof c.sectionId !== 'string' || !c.sectionId || typeof c.valueId !== 'string' || !c.valueId)) return false;
    if (variant.conditions.every((c: { sectionId: string; valueId: string }) => selections?.[c.sectionId] === c.valueId)) {
      matches.add(variant.templateHash.trim().toLowerCase());
    }
  }
  return matches.size === 1 && matches.has(model.definition.templateHash);
}

export async function verifyPrintTemplate(template: PrintTemplateIdentity, fetcher: typeof fetch = fetch): Promise<ApprovedPrintModel | null> {
  const model = approvedTemplateCandidate(template);
  if (!model) return null;
  // A designer supplies the hash calculated from its loaded PDF. Legacy catalogue
  // entries lack this field: read the exact known public template before enabling.
  if (template.templatePdfSha256) return model;
  const response = await fetcher(model.templateUrl, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) return null;
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  return hash === model.definition.templateHash ? model : null;
}
