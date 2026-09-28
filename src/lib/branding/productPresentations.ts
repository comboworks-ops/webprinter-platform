/** Numbers match the five images displayed on 21 September; proposal 2 was not selected. */
export const PRODUCT_PRESENTATIONS = [
  { id: 'precision-catalogue', number: 1, name: 'Præcist katalog', description: 'Kategorier i siden og store, ensartede produktbilleder.', title: 'Find dit næste tryk.', image: '/product-presentations/01-precision-catalogue.png' },
  { id: 'focus-browser', number: 3, name: 'Produkt i fokus', description: 'Vælg i listen, og se produktet i et stort billedfelt.', title: 'Hvad vil du sætte på tryk?', image: '/product-presentations/03-focus-browser.png' },
  { id: 'collection-shelves', number: 4, name: 'Visuelle kategorier', description: 'Mørke produktgallerier med en tydelig markering ved valg.', title: 'Hele dit brand. På tryk.', image: '/product-presentations/04-collection-shelves.png' },
  { id: 'print-studio', number: 5, name: 'Printstudio', description: 'Produkter på et fælles bord med klikbare navne og et billedindeks.', title: 'Dit næste projekt starter her.', image: '/product-presentations/05-print-studio.png' },
] as const;

export type ProductPresentationId = 'standard' | typeof PRODUCT_PRESENTATIONS[number]['id'];
export type ProductPresentationSettings = {
  presentation?: ProductPresentationId;
  presentationMotion?: boolean;
  presentationTitle?: string;
  presentationSubtitle?: string;
};

export function resolveProductPresentation(value: unknown): ProductPresentationId {
  return PRODUCT_PRESENTATIONS.some(item => item.id === value) ? value as ProductPresentationId : 'standard';
}

/** Add a presentation without changing commercial settings, other layouts or tenant identity. */
export function applyProductPresentation<T extends { forside: { productsSection: ProductPresentationSettings; layout: { sectionOrder: string[] } } }>(branding: T, value: unknown) {
  const presentation = resolveProductPresentation(value);
  return {
    ...branding,
    forside: {
      ...branding.forside,
      productsSection: { ...branding.forside.productsSection, presentation },
      layout: {
        ...branding.forside.layout,
        sectionOrder: presentation === 'standard' ? branding.forside.layout.sectionOrder
          : ['products', ...branding.forside.layout.sectionOrder.filter(section => section !== 'products')],
      },
    },
  };
}
