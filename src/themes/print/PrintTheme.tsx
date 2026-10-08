import { StorefrontImage } from '@/components/storefront/StorefrontImage';
import { hasFeaturedProducts } from '@/lib/branding/featuredProductPresentation';
import HeroSlider from '@/components/HeroSlider';
import { resolvePrintHero } from '@/lib/branding/siteDesignControls';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronRight, FileText, Image as ImageIcon, Search, Shirt, Sticker } from 'lucide-react';
import Header from '@/components/Header';
import { FeaturedProductConfigurator } from '@/components/FeaturedProductConfigurator';
import { ClassicProductsSection } from '@/themes/classic/components/ClassicProductsSection';
import { useStorefrontCatalog } from '@/hooks/useStorefrontCatalog';
import { usePreviewBranding } from '@/contexts/PreviewBrandingContext';
import { buildPrintCategoryHref, isPrintCatalogRoute, resolvePrintCatalogView } from '@/lib/storefront/printCatalogNavigation';
import { PrintCatalogSection } from './PrintCatalogSection';
import { appendStorefrontTenantContext } from '@/lib/storefrontTenantContext';
import { getPrintCategoryImage } from '@/lib/storefront/printCategoryImages';
import { getPrintDesignPreset, PRINT_DESIGN_PRESETS } from '@/lib/branding/printDesignPresets';
import type { ProductsSectionProps, ShopLayoutProps, ThemeComponentProps } from '@/lib/themes/types';
import './print.css';
import { PrintCollectionHome } from './PrintCollectionHome';

const linkTo = appendStorefrontTenantContext;
const categoryArt: Record<string, { image: string; icon: typeof FileText }> = {
  tryksager: { image: getPrintCategoryImage('tryksager')!, icon: FileText },
  klistermaerker: { image: getPrintCategoryImage('klistermaerker')!, icon: Sticker },
  'klistermærker': { image: getPrintCategoryImage('klistermærker')!, icon: Sticker },
  plakater: { image: getPrintCategoryImage('plakater')!, icon: ImageIcon },
  tekstiltryk: { image: getPrintCategoryImage('tekstiltryk')!, icon: Shirt },
};

export function PrintShopLayout({ children, cssVariables, branding }: ShopLayoutProps) {
  return <div className="print-shop" data-print-design={branding.themeId} style={{ ...cssVariables, '--print-ink': branding.colors.headingText || '#0B1933', '--print-blue': branding.colors.primary || '#087FC5', '--print-paper': branding.colors.background || '#FFFFFF', '--print-surface': branding.colors.secondary || '#EFF6FC' } as React.CSSProperties}>{children}</div>;
}

export function PrintHeader({ branding }: ThemeComponentProps) {
  return <Header brandingOverride={branding} />;
}

export function PrintHero({ branding }: ThemeComponentProps) {
  const preset = getPrintDesignPreset(branding.themeId) || PRINT_DESIGN_PRESETS[0];
  if (!preset.hero && branding.themeSettings.printHeroEnabled !== true) return null;
  return <HeroSlider heroSettings={resolvePrintHero(branding)} presentation="print" />;
}

export function PrintProductsSection(props: ProductsSectionProps) {
  const { branding, featuredProductConfig, showProducts } = props;
  const location = useLocation();
  const preview = usePreviewBranding();
  const catalogPath = preview.isPreviewMode && preview.previewPath ? preview.previewPath : location.pathname + location.search;
  const isCatalog = isPrintCatalogRoute(catalogPath);
  const catalog = useStorefrontCatalog({ enabled: showProducts || isCatalog });
  const { products, categoryRecords, overviews, loading, errorMessage } = catalog;
  const [query, setQuery] = useState('');
  const preset = getPrintDesignPreset(branding.themeId) || PRINT_DESIGN_PRESETS[0];
  const categories = useMemo(() => categoryRecords
    .filter(c => !c.parent_category_id)
    .filter(c => resolvePrintCatalogView(products, categoryRecords, overviews, new URLSearchParams({ category: c.slug })).products.length > 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [categoryRecords, products, overviews]);
  const searchResults = useMemo(() => products.filter(p => `${p.name} ${p.categoryLabel}`.toLocaleLowerCase('da').includes(query.trim().toLocaleLowerCase('da'))), [products, query]);
  if (isCatalog) return <PrintCatalogSection catalog={catalog} search={new URL(catalogPath, 'http://storefront.local').search} branding={branding} />;
  if (!showProducts) return null;
  const hasFeatured = hasFeaturedProducts(featuredProductConfig);
  const featured = hasFeatured ? <div className="print-featured"><FeaturedProductConfigurator config={featuredProductConfig!} branding={branding} /></div> : null;
  if (preset.number > 5) return <PrintCollectionHome key={preset.id} design={preset.id} catalog={catalog} featured={featured} />;
  // Original designs keep their existing catalogue fallback.
  if (!loading && categories.length === 0 && !errorMessage) return <ClassicProductsSection {...props} />;
  const navigation = <nav className="print-categories" aria-label="Produktkategorier" data-branding-id="forside.products.categories">
    {categories.map(category => {
      const product = products.find(p => p.id === category.frontend_product_id) || products.find(p => p.categoryId === category.id || p.categoryKey === category.slug);
      const art = categoryArt[category.slug] || categoryArt[category.name.toLocaleLowerCase('da')];
      const Icon = art?.icon || FileText;
      const href = buildPrintCategoryHref(category, overviews);
      return <Link key={category.id || category.slug} to={linkTo(href)} className="print-category">
        {preset.id === 'print-precise' ? <Icon size={26} strokeWidth={1.4} aria-hidden="true" /> : (art?.image || product?.image_url) && <StorefrontImage autoSize variant="feature" sizes="(min-width: 1280px) 640px, 50vw" src={art?.image || product?.image_url || ''} alt="" loading="lazy" />}
        <span>{category.name}</span><ChevronRight size={19} aria-hidden="true" />
      </Link>;
    })}
    {preset.id === 'print-precise' && <Link className="print-all" to={linkTo('/produkter')}>Se alle produkter</Link>}
  </nav>;
  return <section id="produkter" className={`print-products print-container ${hasFeatured ? 'has-featured' : ''}`} data-branding-id="forside.products">
    {preset.id === 'print-product' && <div className="print-search-block">
      <h1 data-branding-id="hero.overlay.title">{branding.hero.overlay.title || preset.title}</h1>
      <label className="print-search"><Search size={22} aria-hidden="true" /><span className="sr-only">Søg produkter</span><input type="search" placeholder="Søg efter tryksager, skilte og tekstiltryk" value={query} onChange={e => setQuery(e.target.value)} /></label>
    </div>}
    {loading && !categories.length ? <div className="print-loading" role="status">Indlæser produkter…</div> : errorMessage ? <p role="alert">{errorMessage}</p> : query.trim() ? <div className="print-results" aria-live="polite">
      <p>{searchResults.length} {searchResults.length === 1 ? 'produkt' : 'produkter'} matcher “{query}”</p>
      <div>{searchResults.map(p => <Link to={linkTo(`/produkt/${p.slug}`)} key={p.id}>{p.image_url && <StorefrontImage autoSize variant="thumbnail" src={p.image_url} alt="" />}<span>{p.name}</span><ArrowRight size={18} /></Link>)}</div>
      {!searchResults.length && <p>Prøv et andet produktnavn eller en kategori.</p>}
    </div> : <div className="print-product-layout">{preset.id === 'print-familiar' ? <>{featured}{navigation}</> : <>{navigation}{featured}</>}</div>}
    {preset.id !== 'print-precise' && !query && <Link className="print-browse-all" to={linkTo('/produkter')}>Se alle produkter <ArrowRight size={18} /></Link>}
  </section>;
}
