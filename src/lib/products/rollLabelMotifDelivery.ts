import type { RollLabelReviewProfile } from './rollLabelReview';
import type { RollLabelMotifPageDimensions } from './rollLabelMotifPageDimensions';

export type RollLabelMotifDelivery = {
  version: 1; profileKey: string; sourceEvidenceSha256: string; motifCount: number;
  deliveryInstructionDa: string; pdfInstructionDa: string; orderReady: false;
  pageDimensions?: RollLabelMotifPageDimensions;
};

/** Display and page order only; never a roll count or supplier allocation echo. */
export function readRollLabelMotifDelivery(profile: RollLabelReviewProfile): RollLabelMotifDelivery | null {
  const c = profile.motifDelivery;
  if (!c || c.version !== 1 || c.profileKey !== profile.key || c.orderReady !== false
    || profile.key !== `${profile.articleId}:${profile.sourceMaterialId}`
    || profile.orderReady !== false || !profile.customerArtworkRequired
    || !/^[a-f0-9]{64}$/.test(c.sourceEvidenceSha256) || c.sourceEvidenceSha256 !== profile.sourceEvidenceSha256
    || !Number.isSafeInteger(c.motifCount) || c.motifCount < 2 || c.motifCount > 6 || c.motifCount !== profile.format.motifCount
    || c.deliveryInstructionDa !== 'De forskellige motiver leveres på separate ruller.'
    || c.pdfInstructionDa !== 'PDF-side 1 svarer til motiv 1, PDF-side 2 til motiv 2 og så fremdeles.') return null;
  return c;
}
