import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import ProductGrid from '@/components/ProductGrid';
import type { useStorefrontCatalog } from '@/hooks/useStorefrontCatalog';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import { appendStorefrontTenantContext } from '@/lib/storefrontTenantContext';
import { isCategoryLandingProduct } from '@/lib/catalog/categoryLanding';
import { buildPrintCategoryHref, resolvePrintCatalogView } from '@/lib/storefront/printCatalogNavigation';

type Catalog = ReturnType<typeof useStorefrontCatalog>;

export function PrintCatalogSection({ catalog, search, branding }: { catalog: Catalog; search: string; branding: BrandingData }) {
  const [, setParams] = useSearchParams();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const publishedProducts = useMemo(() => catalog.products.filter(product => !isCategoryLandingProduct(product)), [catalog.products]);
  const view = useMemo(() => resolvePrintCatalogView(publishedProducts, catalog.categoryRecords, catalog.overviews, params), [publishedProducts, catalog.categoryRecords, catalog.overviews, params]);
  const query = params.get('q') || '';
  const results = useMemo(() => view.products.filter(product => `${product.name} ${product.categoryLabel}`.toLocaleLowerCase('da').includes(query.trim().toLocaleLowerCase('da'))), [view.products, query]);
  const rootCategories = catalog.categoryRecords.filter(category => !category.parent_category_id && resolvePrintCatalogView(publishedProducts, catalog.categoryRecords, catalog.overviews, new URLSearchParams({ category: category.slug })).products.length > 0);
  const childCategories = catalog.categoryRecords.filter(category => category.parent_category_id && category.parent_category_id === view.category?.id);
  const link = appendStorefrontTenantContext;

  return <section className="print-catalog print-container" id="produkter" aria-labelledby="print-catalog-title">
    <Helmet><title>{view.title} | {branding.header.logoText || 'Webprinter'}</title></Helmet>
    <nav className="print-catalog-breadcrumbs" aria-label="Brødkrummer">
      <Link to={link('/')}><ArrowLeft size={14} />Forside</Link><ChevronRight size={13} />
      {view.category || view.overview ? <><Link to={link('/produkter')}>Alle produkter</Link><ChevronRight size={13} /><span aria-current="page">{view.title}</span></> : <span aria-current="page">Alle produkter</span>}
    </nav>
    <header className="print-catalog-heading"><div><h1 id="print-catalog-title">{view.title}</h1><p>Vælg et produkt, og beregn din pris.</p></div>
      <label className="print-search"><Search size={20} /><span className="sr-only">Søg i produkterne</span><input type="search" placeholder="Søg i produkterne" value={query} onChange={event => {
        const value = event.target.value;
        setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set('q', value); else next.delete('q'); return next; }, { replace: true });
      }} /></label>
    </header>
    <nav className="print-catalog-filters" aria-label="Vælg produktkategori">
      <Link to={link('/produkter')} aria-current={!view.category && !view.overview ? 'page' : undefined}>Alle produkter</Link>
      {rootCategories.map(category => <Link key={category.id || category.slug} to={link(buildPrintCategoryHref(category, catalog.overviews))} aria-current={view.category?.id === category.id ? 'page' : undefined}>{category.name}</Link>)}
    </nav>
    {childCategories.length > 0 && view.category && <nav className="print-catalog-filters print-catalog-subcategories" aria-label="Vælg underkategori">
      <Link to={link(buildPrintCategoryHref(view.category, catalog.overviews))} aria-current={!view.subcategory ? 'page' : undefined}>Alle {view.category.name.toLocaleLowerCase('da')}</Link>
      {childCategories.map(category => <Link key={category.id || category.slug} to={link(buildPrintCategoryHref(category, catalog.overviews, view.category))} aria-current={view.subcategory?.id === category.id ? 'page' : undefined}>{category.name}</Link>)}
    </nav>}
    {catalog.loading ? <div className="print-loading" role="status">Indlæser produkter…</div>
      : catalog.errorMessage ? <p role="alert">{catalog.errorMessage}</p>
      : <>
        <p className="print-catalog-count" role="status">{results.length} {results.length === 1 ? 'produkt' : 'produkter'}{query && ` matcher “${query}”`}</p>
        {results.length ? <ProductGrid category="__all__" products={results} loadingOverride={false} columns={3} buttonConfig={branding.forside.productsSection.button} layoutStyle="cards" />
          : <div className="print-catalog-empty"><h2>{view.notFound ? 'Dette link matcher ingen kategori' : 'Ingen produkter fundet'}</h2><p>{query ? 'Prøv et andet søgeord, eller vælg en anden kategori.' : 'Se hele vores udvalg, eller vælg en kategori ovenfor.'}</p><Link to={link('/produkter')} className="print-primary">Se alle produkter <ChevronRight size={16} /></Link></div>}
        {catalog.warningMessage && <p className="print-catalog-count">{catalog.warningMessage}</p>}
      </>}
  </section>;
}
