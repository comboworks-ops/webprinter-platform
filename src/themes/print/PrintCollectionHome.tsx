import { StorefrontImage } from '@/components/storefront/StorefrontImage';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, FileText, Search } from 'lucide-react';
import type { useStorefrontCatalog, StorefrontProduct } from '@/hooks/useStorefrontCatalog';
import { appendStorefrontTenantContext as linkTo } from '@/lib/storefrontTenantContext';
import { buildPrintCategoryHref, resolvePrintCatalogView } from '@/lib/storefront/printCatalogNavigation';
import { isCategoryLandingProduct } from '@/lib/catalog/categoryLanding';
import type { ProductCategoryRecord } from '@/utils/productCategories';
import './printCollection.css';

type Catalog = ReturnType<typeof useStorefrontCatalog>;
type Props = { design: string; catalog: Catalog; featured: ReactNode };
const headings: Record<string, { eyebrow: string; title: string; copy: string }> = {
  'print-signal': { eyebrow: 'Storformat / Skilte / Display', title: 'Find den rigtige flade.', copy: 'Fra bannere og roll-ups til skilte og folie. Start med produktet, og tilpas derefter mål og materiale.' },
  'print-atelier': { eyebrow: 'Små ting. Stor betydning.', title: 'Gør det personligt.', copy: 'Et yndlingsbillede. En intern joke. Et minde, der fortjener mere end en plads på telefonen.' },
  'print-form': { eyebrow: 'Dit udtryk. Din kollektion.', title: 'Find din næste favorit.', copy: 'Vælg dit produkt, og giv det dit eget udtryk. Fra den første T-shirt til en samlet kollektion.' },
  'print-partner': { eyebrow: 'Virksomhedens tryksager', title: 'Hvad skal du bruge?', copy: 'Find produktet, vælg specifikationer og fortsæt til din bestilling.' },
};

function ProductImage({ product }: { product?: StorefrontProduct }) {
  return product?.image_url ? <StorefrontImage autoSize src={product.image_url} alt="" loading="lazy" /> : <FileText size={48} strokeWidth={1} aria-hidden="true" />;
}

function ProductLink({ product, className = '' }: { product: StorefrontProduct; className?: string }) {
  return <Link to={linkTo(`/produkt/${product.slug}`)} className={`collection-product ${className}`}>
    <span className="collection-product-image"><ProductImage product={product} /></span>
    <span className="collection-product-copy"><span className="collection-product-category">{product.categoryLabel}</span><h3>{product.name}</h3><span className="collection-product-action">Se muligheder <ArrowUpRight size={18} aria-hidden="true" /></span></span>
  </Link>;
}

/** Four layouts, one tenant-scoped catalogue and the existing product ordering routes. */
export function PrintCollectionHome({ design, catalog, featured }: Props) {
  const [query, setQuery] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const products = useMemo(() => catalog.products.filter(product => !isCategoryLandingProduct(product)), [catalog.products]);
  const categories = useMemo(() => catalog.categoryRecords.filter(category => !category.parent_category_id
    && resolvePrintCatalogView(products, catalog.categoryRecords, catalog.overviews, new URLSearchParams({ category: category.slug })).products.length > 0)
    .sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [catalog.categoryRecords, catalog.overviews, products]);
  const results = useMemo(() => resolvePrintCatalogView(products, catalog.categoryRecords, catalog.overviews,
    new URLSearchParams(categorySlug ? { category: categorySlug } : {})).products.filter(product => `${product.name} ${product.categoryLabel}`.toLocaleLowerCase('da').includes(query.trim().toLocaleLowerCase('da'))),
  [products, catalog.categoryRecords, catalog.overviews, categorySlug, query]);
  const heading = headings[design];
  if (!heading) return null;
  const categoryProducts = (category: ProductCategoryRecord) => resolvePrintCatalogView(products, catalog.categoryRecords, catalog.overviews, new URLSearchParams({ category: category.slug })).products;
  const categoryProduct = (category: ProductCategoryRecord) => products.find(product => product.id === category.frontend_product_id) || categoryProducts(category)[0];
  const categoryLink = (category: ProductCategoryRecord) => linkTo(buildPrintCategoryHref(category, catalog.overviews));
  const allLink = <Link className="collection-all" to={linkTo('/produkter')}>Se hele sortimentet <ArrowRight size={18} aria-hidden="true" /></Link>;
  const search = <label className="collection-search"><Search size={20} aria-hidden="true" /><span className="sr-only">Søg i sortimentet</span><input type="search" value={query} placeholder="Søg efter et produkt…" onChange={event => setQuery(event.target.value)} /></label>;
  const filters = <nav className="collection-filters" aria-label="Filtrér produkter"><button type="button" aria-pressed={!categorySlug} onClick={() => setCategorySlug('')}>Alle produkter <span>{products.length}</span></button>{categories.map(category => <button type="button" key={category.id || category.slug} aria-pressed={categorySlug === category.slug} onClick={() => setCategorySlug(category.slug)}>{category.name}<span>{categoryProducts(category).length}</span></button>)}</nav>;

  return <section id="produkter" data-branding-id="forside.products" data-collection-layout={design} className="collection-home print-container">
    <header className="collection-heading"><div><span className="print-eyebrow">{heading.eyebrow}</span><h2>{heading.title}</h2></div><p>{heading.copy}</p></header>
    {catalog.loading ? <p className="print-loading" role="status">Indlæser produkter…</p> : catalog.errorMessage ? <p role="alert">{catalog.errorMessage}</p> : !products.length ? <p className="collection-empty">Der er endnu ingen produkter i sortimentet.</p> : <>
      {design === 'print-signal' && <>
        <nav className="format-solutions" aria-label="Løsninger til storformat">{categories.map((category,index) => <Link to={categoryLink(category)} key={category.id || category.slug}><span className="format-solution-number">{String(index+1).padStart(2,'0')}</span><span className="format-solution-image"><ProductImage product={categoryProduct(category)} /></span><span className="format-solution-label"><strong>{category.name}</strong><span>{categoryProducts(category).length} {categoryProducts(category).length === 1 ? 'produkt' : 'produkter'}</span></span><ArrowUpRight size={24} aria-hidden="true" /></Link>)}</nav>
        <div className="format-product-heading"><h3>Produkter til dit næste projekt</h3>{allLink}</div><div className="format-products">{products.slice(0,6).map(product => <ProductLink key={product.id} product={product} />)}</div>
      </>}
      {design === 'print-atelier' && <>
        <nav className="gift-categories" aria-label="Find en personlig gave">{categories.map(category => <Link to={categoryLink(category)} key={category.id || category.slug}><span><ProductImage product={categoryProduct(category)} /></span><strong>{category.name}</strong></Link>)}</nav>
        <div className="gift-stories">{products.slice(0,5).map(product => <ProductLink key={product.id} product={product} />)}</div>{allLink}
      </>}
      {design === 'print-form' && <>
        <div className="merch-toolbar">{filters}{search}</div><p className="collection-count" role="status">{results.length} {results.length === 1 ? 'produkt' : 'produkter'}{query && ` matcher “${query}”`}</p>
        <div className="merch-products">{results.slice(0,12).map(product => <ProductLink key={product.id} product={product} />)}</div>
        {!results.length && <p className="collection-empty">Ingen produkter matcher. Prøv et andet søgeord eller vælg Alle produkter.</p>}{allLink}
      </>}
      {design === 'print-partner' && <div className="business-directory"><aside><h3>Produktgrupper</h3>{filters}{allLink}</aside><div className="business-products">{search}<p className="collection-count" role="status">{results.length} {results.length === 1 ? 'produkt' : 'produkter'}{query && ` matcher “${query}”`}</p><div className="business-table-heading" aria-hidden="true"><span>Produkt</span><span>Kategori</span><span>Bestilling</span></div>{results.slice(0,20).map(product => <Link className="business-product-row" key={product.id} to={linkTo(`/produkt/${product.slug}`)}><span className="business-product-name"><span className="business-product-image"><ProductImage product={product} /></span><strong>{product.name}</strong></span><span className="business-product-category">{product.categoryLabel}</span><span className="business-product-action">Vælg og beregn <ArrowRight size={17} aria-hidden="true" /></span></Link>)}{!results.length && <p className="collection-empty">Ingen produkter matcher. Prøv et andet søgeord eller vælg Alle produkter.</p>}{results.length>20 && allLink}</div></div>}
      {catalog.warningMessage && <p className="collection-count">{catalog.warningMessage}</p>}
    </>}
    {featured && <div className="collection-configurator"><span className="print-eyebrow">Tilpas din bestilling</span>{featured}</div>}
  </section>;
}
