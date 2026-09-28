import type { OrderFlowPage } from '../branding/orderFlowDesigns';
import { getSiteDesignPreviewPathname } from './siteDesignPreviewNavigation.ts';

/** Virtual paths inside PreviewShop, never payment or order endpoints. */
const paths: Record<Exclude<OrderFlowPage, 'calculator'>, string> = {
  checkout: '/checkout',
  proof: '/checkout/korrektur',
  designer: '/designer',
  payment: '/checkout/betaling',
  confirmation: '/checkout/bekraeftelse',
};

export function getOrderFlowPreviewPath(page: OrderFlowPage, productSlug?: string | null): string {
  return page === 'calculator'
    ? productSlug ? `/produkt/${encodeURIComponent(productSlug)}` : '/produkt'
    : paths[page];
}

export function getOrderFlowPreviewPage(path: string): OrderFlowPage | null {
  const pathname = getSiteDesignPreviewPathname(path);
  if (pathname === '/produkt' || /^\/produkt\/[^/]+$/.test(pathname)) return 'calculator';
  return (Object.entries(paths).find(([, value]) => value === pathname)?.[0] as OrderFlowPage) || null;
}
