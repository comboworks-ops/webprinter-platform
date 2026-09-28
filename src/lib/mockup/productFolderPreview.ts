import { A4_FOLDER, A4_FOLDER_OUTSIDE_HASH, type FolderDefinition } from './folderDefinition.ts';

export type FolderPrintMode = '4+0' | '4+4';
export interface ProductFolderPreview {
  definition: FolderDefinition;
  print: FolderPrintMode;
}
export const A4_FOLDER_BOTH_SIDES_HASH = '323b466a1f2eb269d3804dc1ae8a074d992be5d2ce463299e2087984a168bb17';
const outside: ProductFolderPreview = { definition: A4_FOLDER, print: '4+0' };
const both: ProductFolderPreview = { definition: A4_FOLDER, print: '4+4' };
// This is an unprinted product illustration, independent of customer-file eligibility.
// The reviewed 4+4 PDF has the same cut outline and creases as the 4+0 construction.
const bindings = new Map<string, ProductFolderPreview>([
  [A4_FOLDER_OUTSIDE_HASH, outside],
  ['300a54250aea3b6e554a0e9723f2a2ef1e79e2f4ff3dd8649b9582bd7f45633e', outside],
  [A4_FOLDER_BOTH_SIDES_HASH, both],
]);
export interface FolderProductSelection {
  templateFiles?: unknown;
  workspaceContent?: unknown;
  selectedSectionValues?: Record<string, string | null> | null;
}
/** Presentation-only configuration under pricing_structure.workspaceContent.
 * Existing product import remaps both section/value IDs in this JSON subtree.
 * A rule enables an illustration, not customer-artwork eligibility. */
export interface ProductPreview3dConfig {
  version: 1;
  variants: { templateHash: string; conditions: { sectionId: string; valueId: string }[] }[];
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function templateHashes(files: unknown): string[] {
  return Array.isArray(files) ? files.flatMap(file => record(file) && typeof file.templatePdfSha256 === 'string'
    ? [file.templatePdfSha256.trim().toLowerCase()] : []) : [];
}
// Compatibility recipe for the reviewed supplier template/original option
// schema, irrespective of shop or product ID. New master assignments use
// workspaceContent.preview3d, whose condition IDs are remapped on import.
const reviewedVariants: ProductPreview3dConfig['variants'] = ['4+0', '4+4'].map(print => ({
  templateHash: print === '4+0' ? A4_FOLDER_OUTSIDE_HASH : A4_FOLDER_BOTH_SIDES_HASH,
  conditions: [
    { sectionId: 'format-section', valueId: '3adc1463-2954-4029-8f6f-f1d0226b0727' },
    { sectionId: 'section-1775868111673', valueId: 'f4670208-0ecc-4bb7-a7d7-8d59a64a0dda' },
    { sectionId: 'print-mode-section', valueId: print === '4+0' ? '6ee575df-a3ab-46fd-911f-f73b3a8b3e92' : '743f9d6c-2d65-4aa3-ad63-c26cd56726e3' },
  ],
}));
function configuredVariants(selection?: FolderProductSelection): ProductPreview3dConfig['variants'] | undefined {
  const content = selection?.workspaceContent;
  if (record(content) && Object.prototype.hasOwnProperty.call(content, 'preview3d')) {
    const config = content.preview3d;
    // Explicit invalid/disabled settings must not fall back to another model.
    if (!record(config) || config.version !== 1 || !Array.isArray(config.variants)) return [];
    const variants: ProductPreview3dConfig['variants'] = [];
    for (const variant of config.variants) {
      if (!record(variant) || typeof variant.templateHash !== 'string' || !Array.isArray(variant.conditions)
        || variant.conditions.some(condition => !record(condition)
          || typeof condition.sectionId !== 'string' || !condition.sectionId
          || typeof condition.valueId !== 'string' || !condition.valueId)) return [];
      const templateHash = variant.templateHash.trim().toLowerCase();
      if (!bindings.has(templateHash)) return [];
      variants.push({ templateHash, conditions: variant.conditions as ProductPreview3dConfig['variants'][number]['conditions'] });
    }
    return variants;
  }
  if (templateHashes(selection?.templateFiles).includes(A4_FOLDER_OUTSIDE_HASH)
    && reviewedVariants[0].conditions.every(({ sectionId }) => Object.prototype.hasOwnProperty.call(selection?.selectedSectionValues || {}, sectionId))) return reviewedVariants;
  return undefined;
}
export function hasProductFolderPreview(hash?: string | null, selection?: FolderProductSelection): boolean {
  const variants = configuredVariants(selection);
  if (variants) return variants.length > 0;
  return !!bindings.get(hash?.trim().toLowerCase() || '') || templateHashes(selection?.templateFiles).some(hash => bindings.has(hash));
}
export function resolveProductFolderPreview(hash?: string | null, selection?: FolderProductSelection): ProductFolderPreview | null {
  const variants = configuredVariants(selection);
  if (variants) {
    const matching = variants.filter(variant => variant.conditions
      .every(({ sectionId, valueId }) => selection?.selectedSectionValues?.[sectionId] === valueId));
    const hashes = new Set(matching.map(variant => variant.templateHash));
    // Ambiguous or unsupported selections never borrow a stale template.
    return hashes.size === 1 ? bindings.get(matching[0].templateHash)! : null;
  }
  return bindings.get(hash?.trim().toLowerCase() || '') ?? null;
}
export function folderPreviewColor(primary?: string | null): string {
  return /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(primary || '') ? primary! : '#0EA5E9';
}
export function folderPrintLabel(print: FolderPrintMode) {
  return print === '4+4' ? 'Tryk på yder- og inderside (4+4)' : 'Tryk på ydersiden (4+0)';
}
