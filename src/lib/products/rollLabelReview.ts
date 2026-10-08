import type { ProductAttributeGroup } from '@/hooks/useProductAttributes';
import type { StorefrontProduct } from '@/hooks/useStorefrontCatalog';
import type { ProductCategoryRecord, ProductOverviewRecord } from '@/utils/productCategories';
import type { ProductFormatGuideData } from '@/components/product-price-page/ProductFormatGuide';
import type { RollLabelArtworkInstructions } from './rollLabelArtworkInstructions';
import type { RollLabelSizeGeometry } from './rollLabelSizeGeometry';

export type RollLabelFormat = {
  shape: string; customSize: boolean; dimensions: { widthMm: number; heightMm: number } | null;
  motifCount: number; pageCount: number | null; rollModel: string | null;
};
export type RollLabelReviewProfile = {
  key: string; articleId: string; sourceMaterialId: string; formatValueId: string; materialValueId: string;
  format: RollLabelFormat; blockers: string[]; sourceQuantities: number[]; customerArtworkRequired: boolean;
  optionFields: Array<{ sourceFieldId: string; labelDa: string; visible: boolean; required: boolean;
    values: Array<{ sourceValueId: string; labelDa: string; rotationDegrees: number | null; selected: boolean }> }>;
  quantityInputs: Array<{ name: string; min?: string; max?: string }>;
  optionDependencyStatus: string; orderReady: false;
  nativeGuide?: ProductFormatGuideData | null;
  sizeGeometry?: RollLabelSizeGeometry | null;
  artworkInstructions?: RollLabelArtworkInstructions | null;
  cutContourContract?: import('./rollLabelCutContourContract').RollLabelCutContourContract;
  sourceEvidenceSha256?: string;
  sourceQuantityBindings?: Array<{quantity:number;sourcePriceScaleId:string}>;
  stockDisplay?: import('./rollLabelStockDisplay').RollLabelStockDisplay;
  stockFormatDisplay?: import('./rollLabelStockFormatDisplay').RollLabelStockFormatDisplay;
  motifDelivery?: import('./rollLabelMotifDelivery').RollLabelMotifDelivery;
  codingDeliveryDisplay?: import('./rollLabelCodingDelivery').RollLabelCodingDelivery;
  optionStates?: RollLabelOptionStates;
  sizeContract: null | { unit: 'mm'; sourceUnit: 'cm'; heightFromWidth: boolean;
    axes: Array<{ axis: 'width' | 'height'; sourceInputName: string; minMm: number; maxMm: number }> };
};
export type RollLabelOptionStates = {
  version: 1; profileKey: string; initialStateId: string | null;
  states: Array<{ id: string; options: Record<string,string>; evidence: Array<{
    signature: string; responseSha256: string; widthMm: number | null; heightMm: number | null; quantity: number;
    sourceReceiptPath?: string; sourceReceiptSha256?: string; qaRequestFingerprint?: string;
  }> }>;
  coverage: 'observed_complete_option_vectors_only'; pricingReady: false; orderReady: false;
  transitions?: Array<{fromStateId:string;fieldId:string;valueId:string;toStateId:string}>;
};
export type RollLabelReviewFamily = {
  familyId: string; productId: string; name: string; description: string; categoryId: string;
  sections: { format: string; material: string }; sourceGroups: ProductAttributeGroup[];
  pricingStructure: Parameters<typeof import('@/components/product-price-page/MatrixLayoutV1Renderer').MatrixLayoutV1Renderer>[0]['pricingStructure'];
  exactSelections: Array<Record<string, string | null>>; initialSelection: Record<string, string | null>;
  profiles: RollLabelReviewProfile[];
  articles: Array<{ articleId: string; name: string; format: RollLabelFormat; blockers: string[] }>;
  existingProductToPreserve: { id: string; slug: string; action: string } | null;
  counts: { articles: number; profiles: number; selectableProfiles: number };
};
export type RollLabelReviewIndex = {
  hierarchy: { overview: ProductOverviewRecord; categories: ProductCategoryRecord[] };
  products: StorefrontProduct[];
  families: Array<{ familyId: string; productId: string; slug: string; name: string; categoryId: string; articleCount: number }>;
  counts: { families: number; articles: number; materialProfiles: number };
};
export function resolveRollLabelReviewProfile(family: RollLabelReviewFamily, selection: Record<string, string | null>) {
  const matches = family.profiles.filter(p => p.blockers.length === 0
    && p.formatValueId === selection[family.sections.format] && p.materialValueId === selection[family.sections.material]);
  return matches.length === 1 ? matches[0] : null;
}
export const rollLabelBlockerText = (reason: string) => ({
  source_article_unavailable: 'Formatet er ikke tilgængeligt hos leverandøren.',
  booklet_geometry_quarantined: 'Bookletens sidetal eller skabelongeometri skal afklares.',
  standard_geometry_quarantined: 'Skabelonens stans eller sikkerhedsafstand skal afklares.',
  wet_glue_geometry_quarantined: 'Vådlimsetikettens beskæringskurve eller mål skal afklares.',
  missing_source_template: 'Der mangler en præcis produktionsskabelon.',
  source_capture_error: 'Kildedata kræver en ny kontrol.',
}[reason] || 'Varianten kræver afklaring.');
