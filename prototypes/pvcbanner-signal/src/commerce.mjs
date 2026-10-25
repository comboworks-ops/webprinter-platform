import { products } from './catalogue.mjs';
import { accountLinks } from './accounts.mjs';

// Presentation only. Product identity, availability and prices belong to Webprinter.
const presentationAliases = { 'standard-rollup': 'roll-up', 'flyer-demand': 'flyers', plastic: 'skilte' };

export function commerceLinks(location, developmentOrigin) {
  const accounts = accountLinks(location, developmentOrigin);
  if (!accounts) return null;
  const base = new URL(accounts.login);
  const link = path => {
    const url = new URL(path, base.origin);
    url.search = base.search;
    return url.href;
  };
  return { ...accounts, order: link('/checkout/konfigurer'), product: slug => link(`/produkt/${encodeURIComponent(slug)}`) };
}

export function connectedCatalogue(rows, links) {
  if (!links) return [];
  return rows.map(row => {
    if (!row.id || !row.name || !/^[a-z0-9][a-z0-9_-]*$/i.test(row.slug)) throw new Error('Ugyldigt produktlink i kataloget.');
    const presentation = products.find(p => p.id === (presentationAliases[row.slug] || row.slug));
    return {
      id: row.slug, productId: row.id, title: row.name,
      group: presentation?.group || 'Alle produkter',
      image: presentation?.image || 'signal-banner-detail.png',
      tag: 'Vælg format, se pris og design online.',
      href: links.product(row.slug),
    };
  });
}

export const plannedCatalogue = products.map(p => ({ ...p, tag: 'Under klargøring — bestilling åbner snart.' }));
