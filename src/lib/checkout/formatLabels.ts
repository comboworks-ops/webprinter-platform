import type { ProductTemplateFile } from '../designer/productTemplateLinks';

const isFormatId = (value: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

/** Attribute IDs may contain A1/A4/etc. Those bytes are not format labels. */
export function normalizeCheckoutFormatKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isFormatId(trimmed)) return null;
  const compact = trimmed.toUpperCase().replace(/\s+/g, '');
  if (compact.includes('DINLANG') || compact.includes('M65')) return 'M65';
  if (compact.includes('85X55')) return '85x55';
  const aFormat = compact.match(/(?:DIN)?A([0-6])/);
  return aFormat ? `A${aFormat[1]}` : trimmed;
}

/** Use the selected, fingerprinted template's actual format for attribute IDs.
 * Require both the PDF identity and selected value; conflicting labels fail closed.
 */
export function checkoutTemplateFormatLabel(
  selectedFormat: unknown,
  templatePdfSha256: string | null | undefined,
  templates: ProductTemplateFile[] | null | undefined,
): string | null {
  if (typeof selectedFormat !== 'string' || !isFormatId(selectedFormat.trim())) return null;
  const hash = templatePdfSha256?.trim().toLowerCase();
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
  const labels = new Set((templates || []).filter(template => {
    const constraints = template.selectionConstraints || template.selection_constraints;
    return template.templatePdfSha256?.trim().toLowerCase() === hash
      && constraints && Object.values(constraints).includes(selectedFormat.trim());
  }).map(template => template.format?.trim()).filter((label): label is string => !!label));
  return labels.size === 1 ? [...labels][0] : null;
}
