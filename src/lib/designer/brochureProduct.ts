import { validBrochurePageCount, type BrochureDocument } from './brochureDocument.ts';
import type { SiteCheckoutState } from '../checkout/siteCheckoutSession';

export function resolveBrochurePageCount(mode: string | null | undefined, selections: Record<string, string | null>, values: Record<string, { brochurePageCount?: number }>): number | null {
  if (mode !== 'brochure') return null;
  const counts = [...new Set(Object.values(selections).flatMap(id => id && validBrochurePageCount(values[id]?.brochurePageCount ?? 0) ? [values[id].brochurePageCount!] : []))];
  return counts.length === 1 ? counts[0] : null;
}
export function applyBrochureDocumentParams(params: URLSearchParams, mode: string | null | undefined, count: number | null | undefined): void {
  if (mode !== 'brochure') return;
  if (!validBrochurePageCount(count ?? 0)) throw new Error('Vælg brochurens sidetal før du åbner sidedesigneren.');
  params.set('brochurePages', String(count));
}
export function assertBrochureCheckoutDocument(state: SiteCheckoutState | null, productId: string | null, document: BrochureDocument): asserts state is SiteCheckoutState {
  if (!state || !productId || state.productId !== productId || state.designerMode !== 'brochure'
      || state.brochurePageCount !== document.pageCount || state.designWidthMm !== document.widthMm
      || state.designHeightMm !== document.heightMm || state.designBleedMm !== document.bleedMm) {
    throw new Error('Brochuren matcher ikke den aktuelle bestilling. Vend tilbage til produktet og vælg format og sidetal igen.');
  }
}
