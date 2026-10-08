import type { RollLabelReviewFamily } from '../src/lib/products/rollLabelReview';
import type { RollLabelPricePreview } from '../src/lib/products/rollLabelPricePreview';
import { readRollLabelPriceMatrixContract } from '../src/lib/products/rollLabelPriceMatrix';
import { buildRollLabelGenericMatrix } from './roll-label-generic-matrix';

/** Assemble the ordinary product JSON for local integration review. No writes. */
export function buildRollLabelSystemProduct(family: RollLabelReviewFamily, prices: RollLabelPricePreview, slug: string) {
  const configuration = { version: 1 as const, productId: family.productId, familyId: family.familyId,
    sections: family.sections, profiles: family.profiles, orderReady: false as const };
  if (!slug || !readRollLabelPriceMatrixContract(prices, configuration)) throw Error('Invalid source-bound product draft');
  const matrix = buildRollLabelGenericMatrix(family, prices);
  return { familyId: family.familyId, localOnly: true as const, remoteWrites: false as const,
    sourceGroups: [...family.sourceGroups, matrix.contextGroup], genericPriceRows: matrix.rows,
    product: { id: family.productId, slug, tenant_id: '00000000-0000-0000-0000-000000000000',
      name: family.name, description: family.description,
      image_url: family.familyId === '20649' ? '/design-presets/category-stickers.webp' : null, category: 'klistermrker',
      pricing_type: 'matrix', is_published: false, template_files: [],
      technical_specs: { local_roll_label_preview: family.familyId },
      pricing_structure: { ...family.pricingStructure, rollLabelConfiguration: configuration, rollLabelPricing: matrix.packet } } };
}
