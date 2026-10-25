import { useLocation } from 'react-router-dom';
import { useStorefrontCatalog } from '@/hooks/useStorefrontCatalog';
import { useShopSettings } from '@/hooks/useShopSettings';
import { mergeBrandingWithDefaults, type BrandingData } from '@/hooks/useBrandingDraft';
import { StorefrontThemeFrame } from '@/components/storefront/StorefrontThemeFrame';
import { Home, Catalogue } from './WideFormatHome.jsx';
import { connectedCatalogue } from '../../../prototypes/pvcbanner-signal/src/commerce.mjs';
import { resolveWideFormatEditorBranding, wideFormatSectionIsShared, wideFormatSectionOrder } from '@/lib/branding/wideFormatEditor';
import HeroSlider from '@/components/HeroSlider';
import { Banner2Showcase } from '@/components/Banner2Showcase';
import { ClassicProductsSection } from '@/themes/classic/components/ClassicProductsSection';
import { ConnectedProductPresentation } from '@/components/storefront/ProductPresentation';
import { FeaturedProductConfigurator } from '@/components/FeaturedProductConfigurator';
import { hasFeaturedProducts } from '@/lib/branding/featuredProductPresentation';
import { StorefrontContentBlocks, StorefrontSEOSection, StorefrontUSPSection } from '@/components/storefront/StorefrontHomeContent';
import { LowerInfoRenderer } from '@/components/content/LowerInfoRenderer';
import '@/styles/wideFormatHome.css';
import '@/styles/wideFormatShops.css';
export { PVCBANNER_TENANT_ID } from '@/lib/branding/pvcbannerSettings';

/** All five authored layouts now run inside the same native designer/commerce providers. */
export function PvcbannerStorefront({ branding, previewPath, editMode = false }: {
  branding?: Partial<BrandingData>; previewPath?: string; editMode?: boolean; onNavigate?: (path: string) => void;
}) {
  const location = useLocation();
  const shop = useShopSettings();
  const { products, loading, errorMessage } = useStorefrontCatalog();
  const draft = resolveWideFormatEditorBranding(mergeBrandingWithDefaults(branding || {}), shop.data?.id);
  const path = previewPath || location.pathname + location.search;
  const isCatalog = path.split('?')[0] === '/produkter';
  const catalogue = connectedCatalogue(products.filter(p => p.id && p.name && /^[a-z0-9][a-z0-9_-]*$/i.test(p.slug)), { product: (slug: string) => `/produkt/${encodeURIComponent(slug)}` }).map(p => ({...p, imageUrl: products.find(row => row.slug === p.id)?.image_url || `/site-previews/pvcbanner-signal/assets/${p.image}`}));
  const shared = (section: string) => wideFormatSectionIsShared(draft, section);
  const p = draft.forside.productsSection;
  const features = p.featuredProductConfig;
  const content = draft.forside.contentBlocks.filter(block => block.enabled);
  const seo = draft.seoContent.items.filter(item => item.enabled);
  const usp = draft.uspStrip.items.filter(item => item.enabled);
  const overrides: Record<string, React.ReactNode> = {};
  if (shared('banner')) overrides.hero = draft.forside.showBanner ? <div data-signal-section="banner"><HeroSlider heroSettings={draft.hero}/></div> : null;
  if (shared('showcase')) overrides.banner2 = <div data-signal-section="showcase"><Banner2Showcase banner2={draft.forside.banner2}/></div>;
  const sharedProducts = p.presentation && p.presentation !== 'standard'
    ? <ConnectedProductPresentation branding={draft} layout={p.presentation}/>
    : <ClassicProductsSection tenantName={draft.shop_name} branding={draft} showProducts={isCatalog || p.enabled} showStorformatTab={p.showStorformatTab} productColumns={p.columns} productButtonConfig={p.button} productBackgroundConfig={p.background} productLayoutStyle={p.layoutStyle} featuredProductConfig={features}/>;
  if (shared('products')) overrides.products = <div data-signal-section="products">{sharedProducts}</div>;
  if (shared('content')) overrides.content = <StorefrontContentBlocks blocks={content}/>;
  if (shared('usp-strip')) overrides.usp = draft.uspStrip.enabled ? <div data-signal-section="usp-strip"><StorefrontUSPSection settings={draft.uspStrip} items={usp}/></div> : null;
  overrides.seo = <>{!shared('products') && features && hasFeaturedProducts(features) && <div className="container py-12" data-signal-section="featured-products"><FeaturedProductConfigurator branding={draft} config={features}/></div>}{!shared('content') && <div data-signal-section="extra-content"><StorefrontContentBlocks blocks={content}/></div>}<div data-signal-section="lower-info"><LowerInfoRenderer lowerInfo={draft.forside.lowerInfo}/></div>{draft.seoContent.enabled && <div data-signal-section="seo-content"><StorefrontSEOSection settings={draft.seoContent} items={seo}/></div>}</>;
  return <StorefrontThemeFrame branding={draft} isPreviewMode={previewPath !== undefined}>
    <div className="wide-format-home" data-site-design-edit-mode={editMode || undefined}>
      {loading && <p className="section-wrap" role="status">Henter produkter…</p>}
      {errorMessage && <p className="section-wrap" role="status">Sortimentet kunne ikke hentes. Prøv igen senere.</p>}
      {isCatalog ? (shared('products') ? sharedProducts : <Catalogue route={path} catalogue={catalogue}/>) : <Home catalogue={catalogue} overrides={overrides} sectionOrder={wideFormatSectionOrder(draft)}/>}
    </div>
  </StorefrontThemeFrame>;
}
