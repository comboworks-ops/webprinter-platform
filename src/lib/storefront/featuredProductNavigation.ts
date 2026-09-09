export type FeaturedDimensions = { widthCm: number; heightCm: number; quantity: number };

const positiveNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

/** Only carry input choices. The product page always calculates its own price. */
export function buildFeaturedStorformatHref(href: string, selection: FeaturedDimensions): string {
  const url = new URL(href, 'http://storefront.local');
  if (!url.pathname.startsWith('/produkt/')) return href;
  url.searchParams.set('widthCm', String(positiveNumber(selection.widthCm, 100)));
  url.searchParams.set('heightCm', String(positiveNumber(selection.heightCm, 100)));
  url.searchParams.set('qty', String(positiveNumber(selection.quantity, 1)));
  return url.pathname + url.search + url.hash;
}

export function readFeaturedStorformatSelection(params: URLSearchParams): FeaturedDimensions {
  const quantity = positiveNumber(params.get('qty'), 1);
  return {
    widthCm: positiveNumber(params.get('widthCm'), 100),
    heightCm: positiveNumber(params.get('heightCm'), 100),
    quantity: Number.isInteger(quantity) ? quantity : 1,
  };
}

export function resolveFeaturedQuantity(requested: number, available: number[]): number {
  return available.includes(requested) ? requested : available[0] || 1;
}
