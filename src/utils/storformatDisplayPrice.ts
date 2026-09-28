import { tryCalculateStorformatPrice, validateStorformatQuoteModel, type StorformatConfig, type StorformatMaterial, type StorformatProduct } from './storformatPricing.ts';

/** Catalogue previews use a one-square-metre reference and the actual base production option. */
export function calculateStorformatDisplayPrice(config: StorformatConfig, materials: StorformatMaterial[], products: StorformatProduct[]): number | null {
  if (!materials.length) return null;
  let selectedProducts = products.slice(0, 1);
  if (config.area_pricing_basis === 'per_piece_quotes') {
    try {
      const model = validateStorformatQuoteModel(config.source_quote_model);
      const baseProducts = model.base_product_ids.map(id => products.find(product => product.id === id));
      if (baseProducts.some(product => !product)) return null;
      selectedProducts = baseProducts as StorformatProduct[];
    } catch {
      return null;
    }
  }
  return tryCalculateStorformatPrice({
    widthMm: 1000, heightMm: 1000, quantity: config.quantities[0] || 1,
    material: materials[0], products: selectedProducts, config,
  })?.totalPrice ?? null;
}
