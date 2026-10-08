import type { DesignerTemplateLaunch } from '../designer/productTemplateLinks.ts';

export interface BrochureFreeSelection {
  articleId: string; nativePaperId: string; pageCount: number; widthMm: number; heightMm: number;
}
export interface BrochureFreeSizeConfig {
  version: 1; quoteEndpoint: string; formatValueId: string; orientationValueId: string;
  neutralSelectionIds: { cover: string; varnish: string };
  axisSections: Record<string, string>;
  minWidthMm: number; maxWidthMm: number; minHeightMm: number; maxHeightMm: number; stepMm: number;
  requiresExactDimensionQuote: true;
  articles: Array<{ articleId: string; pageCount: number; pageCountValueId: string; sourceUrl: string;
    materials: Array<{ materialValueId: string; nativePaperId: string }> }>;
}
export interface BrochureFreeMatrixMeta {
  variantKey?: string; verticalValueId?: string;
  brochureFree?: BrochureFreeSelection | null;
  brochureTemplate?: DesignerTemplateLaunch | null;
}
export function validBrochureFreeSize(widthMm: number, heightMm: number): boolean {
  return [widthMm, heightMm].every(value => Number.isFinite(value) && value >= 98 && value <= 297
    && Math.abs(value * 10 - Math.round(value * 10)) < .000001);
}
export function readBrochureFreePriceResponse(value: unknown, selection: BrochureFreeSelection): Array<[number, number]> {
  const quote = value as { articleId?: string; substrateId?: string; pageCount?: number; widthMm?: number; heightMm?: number;
    currency?: string; vatState?: string; conversionRuleKey?: string; prices?: Array<[number, number, number, string]> };
  if (!quote || quote.articleId !== selection.articleId || quote.substrateId !== selection.nativePaperId
    || quote.pageCount !== selection.pageCount || quote.widthMm !== selection.widthMm || quote.heightMm !== selection.heightMm
    || quote.currency !== 'DKK' || quote.vatState !== 'excluded' || quote.conversionRuleKey !== 'wmd_tiered_fx_7_5'
    || !Array.isArray(quote.prices) || quote.prices.length === 0) throw Error('Prisen matcher ikke den valgte brochure.');
  const seen = new Set<number>();
  return quote.prices.map(row => {
    if (!Array.isArray(row) || !Number.isSafeInteger(row[0]) || row[0] < 1 || row[0] > 10000 || seen.has(row[0])
      || !Number.isSafeInteger(row[1]) || row[1] <= 0 || !Number.isFinite(row[2]) || row[2] <= 0 || typeof row[3] !== 'string' || !row[3]) {
      throw Error('Leverandørens antal og priser kunne ikke bekræftes.');
    }
    seen.add(row[0]); return [row[0], row[1]];
  });
}
