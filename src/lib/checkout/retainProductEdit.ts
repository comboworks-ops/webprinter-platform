import type { SiteCheckoutState } from './siteCheckoutSession';

export function retainProductEditDraft(previous: SiteCheckoutState | null, next: {
  productId?: string | null; width?: number | null; height?: number | null;
  bleed?: number | null; templateUrl?: string | null; designerMode?: string | null;
  brochurePageCount?: number | null;
}, editing: boolean): Partial<SiteCheckoutState> {
  if (!editing || !next.productId || previous?.productId !== next.productId) return {};
  const sameArtwork = previous.designWidthMm === next.width && previous.designHeightMm === next.height
    && previous.designBleedMm === next.bleed
    && (previous.templatePdfUrl || null) === (next.templateUrl || null)
    && (previous.designerMode || null) === (next.designerMode || null)
    && (next.designerMode !== 'brochure' || previous.brochurePageCount === next.brochurePageCount);
  return {
    siteUpload: previous.siteUpload,
    checkoutCustomer: previous.checkoutCustomer,
    // Preserve multi-file exports when only paper/quantity changed. A changed
    // print area returns the uploaded artwork for review instead of claiming it fits.
    designerExport: sameArtwork ? previous.designerExport : null,
    proofApprovalRequired: true,
  };
}
