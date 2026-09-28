import { useSharedButtonStyles } from './SharedButtonContext';
import { ProductBadge } from '@/components/ProductBadge';
import '@/styles/productPresentationEffects.css';
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useStorefrontCatalog, type StorefrontProduct } from '@/hooks/useStorefrontCatalog';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import { usePreviewBranding } from '@/contexts/PreviewBrandingContext';
import { PRODUCT_PRESENTATIONS, type ProductPresentationId } from '@/lib/branding/productPresentations';
import { filterPresentationProducts, groupPresentationProducts } from '@/lib/storefront/productPresentationCatalog';
import { buildPrintCategoryHref, isPrintCatalogRoute, resolvePrintCatalogView } from '@/lib/storefront/printCatalogNavigation';
import { appendStorefrontTenantContext } from '@/lib/storefrontTenantContext';
import { isCategoryLandingProduct } from '@/lib/catalog/categoryLanding';
import { getProductImage } from '@/utils/productImages';
import '@/styles/productPresentations.css';

type Catalog = Pick<ReturnType<typeof useStorefrontCatalog>, 'products' | 'categoryRecords' | 'overviews' | 'loading' | 'errorMessage' | 'warningMessage'>;
type LayoutId = Exclude<ProductPresentationId, 'standard'>;
const productName = (product: StorefrontProduct) => product.icon_text?.trim() || product.name;
const productHref = (product: StorefrontProduct) => appendStorefrontTenantContext(`/produkt/${encodeURIComponent(product.slug)}`);

function ProductImage({ product, eager = false }: { product: StorefrontProduct; eager?: boolean }) {
  const src = getProductImage(product.slug, product.image_url);
  const [failed, setFailed] = useState<string | null>(null);
  const hoverSrc = typeof product.banner_config?.hover_image_url === 'string' ? product.banner_config.hover_image_url : undefined;
  return <div className="pp-image" data-image-hover={product.banner_config?.image_hover_effect || "zoom"} data-branding-id="icons.product-images">
    {failed !== src && src !== '/placeholder.svg' ? <img src={src} alt="" style={{scale:String(Math.max(.6,Math.min(1.4,Number(product.banner_config?.image_scale_pct || 100)/100)))}} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(src)} /> : <span className="pp-no-image">{productName(product)}<small>Billede kommer snart</small></span>}
    {hoverSrc && <img className="pp-hover-image" style={{scale:String(Math.max(.6,Math.min(1.4,Number(product.banner_config?.image_scale_pct || 100)/100)))}} src={hoverSrc} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.style.display = 'none'; }} />}
  </div>;
}

function ProductCardPrice({product}: {product:StorefrontProduct}) {
  const config=product.banner_config || {};
  const promo=Number(config.promo_price),original=Number(config.original_price);
  if(config.promo_price != null && config.original_price != null && original>promo && promo>=0) return <span className="pp-card-price" data-tooltip-anchor="card-price"><del>{original} kr</del> <strong>{promo} kr</strong>{config.show_savings_badge && <small> SPAR {Math.round((1-promo/original)*100)}%</small>}</span>;
  const price=config.price_from ? `Fra ${config.price_from} kr` : product.displayPrice;
  return price ? <span className="pp-card-price" data-tooltip-anchor="card-price">{price}</span> : null;
}

function ProductTile({ product, eager = false }: { product: StorefrontProduct; eager?: boolean }) {
  const sharedCta = useSharedButtonStyles()('cta', 'catalogue');
  return <Link className="pp-tile" data-tooltip-anchor="catalog-card" data-tooltip-product={product.id} data-card-hover={product.banner_config?.card_hover_effect || "none"} to={productHref(product)}>
    <ProductBadge config={product.banner_config?.special_badge} />
    <ProductImage product={product} eager={eager} />
    <span className="pp-tile-title" data-tooltip-anchor="card-title">{productName(product)}<ArrowRight size={19} aria-hidden="true" /></span>
    {product.description && <span className="pp-description" data-tooltip-anchor="card-description">{product.description}</span>}
    <ProductCardPrice product={product}/>
    <span {...sharedCta} className="pp-product-action">Se produkt <ArrowRight size={17} aria-hidden="true" /></span>
  </Link>;
}

function ProductShelf({ group }: { group: ReturnType<typeof groupPresentationProducts<StorefrontProduct>>[number] }) {
  const rail = useRef<HTMLDivElement>(null);
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <section className="pp-shelf" aria-label={group.name}>
    <div className="pp-shelf-heading"><h3>{group.name}</h3>{group.products.length > 3 && <div className="pp-shelf-controls"><button type="button" onClick={() => move(-1)} aria-label={`Forrige produkter i ${group.name}`}><ChevronLeft size={19} /></button><button type="button" onClick={() => move(1)} aria-label={`Næste produkter i ${group.name}`}><ChevronRight size={19} /></button></div>}</div>
    <div className="pp-shelf-rail" ref={rail}>{group.products.map((product, index) => <ProductTile key={product.id} product={product} eager={index < 4} />)}</div>
  </section>;
}

/** Same renderer for published shops, the live branding preview and isolated UI verification. */
export function ProductPresentation({ catalog, branding, layout, path = '/' }: { catalog: Catalog; branding: BrandingData; layout: LayoutId; path?: string }) {
  const getShared = useSharedButtonStyles();
  const sharedCta = getShared('cta', 'catalogue');
  const sharedSelection = getShared('selection', 'catalogue-selection');
  const params = useMemo(() => new URL(path, 'http://storefront.local').searchParams, [path]);
  const [query, setQuery] = useState(params.get('q') || '');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const settings = branding.forside.productsSection;
  const definition = PRODUCT_PRESENTATIONS.find(item => item.id === layout)!;
  const isCatalog = isPrintCatalogRoute(path);
  const published = useMemo(() => catalog.products.filter(product => !isCategoryLandingProduct(product)), [catalog.products]);
  const activeParams = useMemo(() => {
    if (categoryFilter === null) return params;
    return new URLSearchParams(categoryFilter ? { category: categoryFilter } : {});
  }, [params, categoryFilter]);
  const view = useMemo(() => resolvePrintCatalogView(published, catalog.categoryRecords, catalog.overviews, activeParams), [published, catalog.categoryRecords, catalog.overviews, activeParams]);
  const results = useMemo(() => filterPresentationProducts(view.products, query), [view.products, query]);
  const groups = useMemo(() => groupPresentationProducts(results, catalog.categoryRecords, catalog.overviews), [results, catalog.categoryRecords, catalog.overviews]);
  const categories = useMemo(() => groupPresentationProducts(published, catalog.categoryRecords, catalog.overviews).filter(group => group.category), [published, catalog.categoryRecords, catalog.overviews]);
  const focused = results.find(product => product.id === focusedId) || results[0];
  const title = view.category || view.overview || view.notFound ? view.title : settings.presentationTitle?.trim() || definition.title;
  const Heading = isCatalog ? 'h1' : 'h2';
  const style = {
    '--pp-accent': branding.colors.primary || '#087fc5',
    '--pp-button-bg': settings.button.bgColor || branding.colors.primary || '#087fc5',
    '--pp-button-hover': settings.button.hoverBgColor || settings.button.bgColor || branding.colors.primary || '#087fc5',
    '--pp-button-text': settings.button.textColor || '#ffffff',
    '--pp-button-size': settings.button.fontSizePx ? `${settings.button.fontSizePx}px` : undefined,
    '--pp-button-padding': settings.button.paddingYPx ? `${settings.button.paddingYPx}px` : undefined,
    '--pp-button-radius': settings.button.borderRadiusPx !== undefined ? `${settings.button.borderRadiusPx}px` : undefined,
    '--pp-heading': branding.colors.headingText || '#0b1933',
    '--pp-body': branding.colors.bodyText || '#475569',
    '--pp-heading-font': settings.card?.titleFont || branding.fonts.heading || 'Inter',
    '--pp-body-font': settings.card?.bodyFont || branding.fonts.body || 'Inter',
  } as CSSProperties;

  const filters = <nav className="pp-categories" aria-label="Vælg produktkategori">
    <button {...sharedSelection} type="button" aria-pressed={!view.category && !view.overview} onClick={() => setCategoryFilter('')}>Alle produkter</button>
    {categories.map(group => <button {...sharedSelection} type="button" key={group.id} aria-pressed={view.category?.id ? view.category.id === group.category?.id : view.category?.slug === group.category?.slug} onClick={() => setCategoryFilter(group.id)}>{group.name}</button>)}
  </nav>;
  const search = <label className="pp-search"><Search size={20} aria-hidden="true" /><span className="sr-only">Søg i produkterne</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Søg i produkterne…" /></label>;
  const heading = <header className="pp-heading"><div><Heading>{title}</Heading><p>{settings.presentationSubtitle?.trim() || 'Vælg et produkt. Gør det til dit eget.'}</p></div>{search}</header>;
  const status = catalog.loading ? <p className="pp-empty" role="status">Indlæser produkter…</p>
    : catalog.errorMessage ? <p className="pp-empty" role="alert">{catalog.errorMessage}</p>
      : !results.length ? <div className="pp-empty"><h3>{view.notFound ? 'Kategorien blev ikke fundet' : 'Ingen produkter fundet'}</h3><p>Prøv et andet søgeord, eller se hele udvalget.</p><button type="button" onClick={() => { setCategoryFilter(''); setQuery(''); }}>Se alle produkter <ArrowRight size={18} /></button></div> : null;

  return <section id="produkter" className={`product-presentation pp-${layout}`} data-product-presentation={layout} data-motion={settings.presentationMotion !== false} data-branding-id="forside.products" style={style} aria-label="Produkter">
    {isCatalog && <Helmet><title>{view.title} | {branding.header.logoText || branding.shop_name || 'Webprinter'}</title></Helmet>}
    <div className="pp-container">
      {isCatalog && <nav className="pp-breadcrumbs" aria-label="Brødkrummer"><Link to={appendStorefrontTenantContext('/shop')}><ArrowLeft size={14} />Forside</Link><ChevronRight size={14} /><span>{view.category || view.overview ? view.title : 'Alle produkter'}</span></nav>}
      {layout === 'precision-catalogue' ? <div className="pp-catalog-layout"><aside>{filters}</aside><div className="pp-main">{heading}{status || <div className="pp-grid">{results.map((product, index) => <ProductTile key={product.id} product={product} eager={index < 3} />)}</div>}</div></div>
        : layout === 'focus-browser' ? <div className="pp-focus-layout"><div className="pp-focus-directory">{heading}{filters}{status || <div className="pp-focus-list" role="group" aria-label="Vælg produkt til forhåndsvisning">{results.map(product => <button {...sharedSelection} type="button" key={product.id} data-tooltip-anchor="focus-item" data-tooltip-product={product.id} data-card-hover={product.banner_config?.card_hover_effect || "none"} aria-pressed={focused?.id === product.id} onClick={() => setFocusedId(product.id)}><ProductImage product={product} /><span>{productName(product)}</span><ArrowRight size={20} aria-hidden="true" /></button>)}</div>}</div>{!status && focused && <div className="pp-focus-stage" data-tooltip-anchor="focus-stage" data-tooltip-product={focused.id} data-card-hover={focused.banner_config?.card_hover_effect || "none"} aria-live="polite"><ProductBadge config={focused.banner_config?.special_badge} /><ProductImage key={focused.id} product={focused} eager /><div className="pp-focus-copy"><h3>{productName(focused)}</h3>{focused.description && <p>{focused.description}</p>}<ProductCardPrice product={focused}/><Link {...sharedCta} className="pp-cta" to={productHref(focused)}>Se produkt <ArrowRight size={20} aria-hidden="true" /></Link></div></div>}</div>
          : layout === 'collection-shelves' ? <>{heading}{filters}{status || <div className="pp-shelves">{groups.map(group => <ProductShelf key={group.id} group={group} />)}</div>}</>
            : <>{heading}{filters}{status || <><div className="pp-studio-stage">{results.slice(0, 6).map((product, index) => <Link className="pp-studio-object" data-tooltip-anchor="studio-card" data-tooltip-product={product.id} data-card-hover={product.banner_config?.card_hover_effect || "none"} to={productHref(product)} key={product.id} data-position={index}><ProductBadge config={product.banner_config?.special_badge} /><ProductImage product={product} eager /><span>{productName(product)}<ArrowRight size={19} aria-hidden="true" /></span></Link>)}</div><div className="pp-directory"><h3>Alle produkter</h3><div className="pp-directory-grid">{results.map(product => <Link data-tooltip-anchor="directory-card" data-tooltip-product={product.id} data-card-hover={product.banner_config?.card_hover_effect || "none"} to={productHref(product)} key={product.id}><ProductBadge config={product.banner_config?.special_badge} /><ProductImage product={product} /><span>{productName(product)}</span></Link>)}</div></div></>}</>}
      {view.category && <nav className="pp-subcategories" aria-label="Underkategorier">{catalog.categoryRecords.filter(category => category.parent_category_id === view.category?.id).map(category => <Link key={category.id || category.slug} to={appendStorefrontTenantContext(buildPrintCategoryHref(category, catalog.overviews, view.category))}>{category.name}<ArrowRight size={14} /></Link>)}</nav>}
      {!catalog.loading && !catalog.errorMessage && <p className="pp-count" role="status">{results.length} {results.length === 1 ? 'produkt' : 'produkter'}{query.trim() && ` matcher “${query.trim()}”`}</p>}
      {catalog.warningMessage && <p className="pp-count">{catalog.warningMessage}</p>}
    </div>
  </section>;
}

export function ConnectedProductPresentation({ branding, layout }: { branding: BrandingData; layout: LayoutId }) {
  const catalog = useStorefrontCatalog();
  const location = useLocation();
  const preview = usePreviewBranding();
  const path = preview.isPreviewMode && preview.previewPath ? preview.previewPath : location.pathname + location.search;
  return <ProductPresentation key={`${path}:${layout}`} catalog={catalog} branding={branding} layout={layout} path={path} />;
}

/** A single card using the selected catalogue renderer, for the product editor. */
export function ProductPresentationCard({product,branding,layout}: {product:StorefrontProduct;branding:BrandingData;layout:LayoutId}) {
  const sharedCta = useSharedButtonStyles()('cta', 'catalogue');
  return <section className={`product-presentation pp-${layout} pp-single-preview`} data-product-presentation={layout} style={{'--pp-accent':branding.colors.primary,'--pp-heading':branding.colors.headingText || '#0b1933','--pp-body':branding.colors.bodyText || '#475569'} as CSSProperties}>
    {layout==='focus-browser' ? <div className="pp-focus-stage" data-card-hover={product.banner_config?.card_hover_effect || 'none'}><ProductBadge config={product.banner_config?.special_badge}/><ProductImage product={product}/><div className="pp-focus-copy"><h3>{productName(product)}</h3><p>{product.description}</p><ProductCardPrice product={product}/><span {...sharedCta} className="pp-cta">Se produkt</span></div></div> : layout==='print-studio' ? <div className="pp-studio-stage"><Link className="pp-studio-object" data-card-hover={product.banner_config?.card_hover_effect || 'none'} to={productHref(product)} data-position="0"><ProductBadge config={product.banner_config?.special_badge}/><ProductImage product={product}/><span>{productName(product)}</span></Link></div> : <div className={layout==='collection-shelves'?'pp-shelf-rail':'pp-grid'}><ProductTile product={product}/></div>}
  </section>;
}
