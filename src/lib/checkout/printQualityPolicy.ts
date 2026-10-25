export interface PrintQualityProduct {
  designerMode?: string | null;
  pricingModel?: string | null;
  pricingType?: string | null;
  category?: string | null;
  widthMm: number;
  heightMm: number;
}

/** Recommendations apply per printed item, never to quantity × area. */
export function recommendedPrintDpi(product: PrintQualityProduct): 100 | 150 | 300 {
  const wide = [product.designerMode, product.pricingModel, product.pricingType, product.category]
    .some(value => ['storformat', 'signage', 'wide_format', 'wide-format'].includes(String(value || '').toLowerCase()));
  if (!wide) return 300;
  return Number.isFinite(product.widthMm) && Number.isFinite(product.heightMm)
    && product.widthMm > 0 && product.heightMm > 0
    && product.widthMm * product.heightMm >= 6_000_000 ? 100 : 150;
}

/** Use source pixels and final physical placement, rather than a metadata DPI tag. */
export function placedImageDpi(input: { widthPx: number; heightPx: number; widthMm: number; heightMm: number; scalePercent: number }): number | null {
  if (![input.widthPx, input.heightPx, input.widthMm, input.heightMm, input.scalePercent]
    .every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = input.scalePercent / 100;
  return Math.floor(Math.min(input.widthPx / (input.widthMm * scale), input.heightPx / (input.heightMm * scale)) * 25.4 + 0.000001);
}

export const PRINT_QUALITY_RESPONSIBILITY = 'Jeg har kontrolleret korrekturen og godkender tryk trods advarslerne. Jeg accepterer risikoen for sløring og pixelering ved lav opløsning og for beskæring ved den viste placering. Jeg vælger at trykke på eget ansvar for disse forhold; trykkeriet kan ikke garantere skarphed i en fil med for lav opløsning.';
export const GENERAL_PROOF_ACKNOWLEDGEMENT = 'Jeg har set previewet og accepterer bemærkningerne.';

export function resolutionWarning(dpi: number | null, recommended: number): string | null {
  return dpi !== null && dpi < recommended
    ? `Lav opløsning: ca. ${dpi} DPI ved den valgte størrelse. Anbefalet til dette produkt: ${recommended} DPI. Trykket kan blive sløret eller pixeleret. Du kan godkende det på eget ansvar.`
    : null;
}

export function printWarningAcceptanceKey(artifactIdentity: string | null, warnings: string[], recommendedDpi: number): string {
  return JSON.stringify([artifactIdentity, warnings, recommendedDpi]);
}

export interface PrintWarningApproval {
  version: 1;
  fileSha256: string;
  approvedAt: string;
  warnings: string[];
  acknowledgement: string;
  recommendedDpi: number;
  effectiveDpi: number | null;
}

/** Customer acknowledgement attached to this exact output file; not a server preflight certificate. */
export function printWarningOrderNote(approval: PrintWarningApproval | null | undefined, fileSha256: string): string | null {
  if (approval?.version !== 1 || !/^[a-f0-9]{64}$/.test(fileSha256) || approval.fileSha256 !== fileSha256
    || !Array.isArray(approval.warnings) || !approval.warnings.length) return null;
  return `[FILADVARSLER GODKENDT ${approval.approvedAt}] ${approval.acknowledgement}\n${approval.warnings.slice(0, 15).map(value => String(value).slice(0, 400)).join('\n')}`;
}
