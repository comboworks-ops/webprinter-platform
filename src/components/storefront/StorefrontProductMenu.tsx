import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, Search, X } from "lucide-react";
import { Link as RouterLink, type LinkProps } from "react-router-dom";
import { ProductCategoryIcon } from "@/components/ProductCategoryIcon";
import type { ApprovedDropdownPreset } from "@/lib/branding/dropdownPresets";
import { getProductImage } from "@/utils/productImages";
import "@/styles/storefrontProductMenu.css";

// This menu has its own tenant-configurable text and category colors. Use the
// existing global-link opt-out so those controls win over the site's link color.
function Link({ className, ...props }: LinkProps) {
  return <RouterLink {...props} className={`no-link-color${className ? ` ${className}` : ""}`} />;
}

export interface MenuProduct {
  key: string;
  label: string;
  href: string;
  imageUrl: string | null;
  productSlug: string;
  category: string | null;
}

export interface MenuCategory {
  key: string;
  label: string;
  href: string;
  imageUrl: string | null;
  productSlug: string;
  category: string | null;
  products: MenuProduct[];
  children?: { key: string; label: string; href: string }[];
}

interface MenuDataProps {
  preset: ApprovedDropdownPreset;
  categories: MenuCategory[];
  products: MenuProduct[];
  allProductsHref: string;
  label: string;
  style?: CSSProperties;
  selectedIconPackId?: string;
  loading?: boolean;
  error?: string;
}

export interface StorefrontProductMenuProps extends MenuDataProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  onCompactFocus?: () => void;
}

export interface StorefrontProductMenuContentProps extends MenuDataProps {
  onNavigate: () => void;
  compact?: boolean;
}

type MenuDestination = Pick<MenuProduct, "key" | "label" | "href">;
type MenuImageSource = Pick<MenuProduct, "imageUrl" | "productSlug" | "category" | "label">;
type VariantProps = StorefrontProductMenuContentProps;

function getCategoryLinks(category: MenuCategory): MenuDestination[] {
  const seen = new Set<string>();
  return [...(category.children || []), ...category.products].filter((item) => {
    if (seen.has(item.href) || item.href === category.href) return false;
    seen.add(item.href);
    return true;
  });
}

// Accept Danish letters and their common keyboard transliterations, as well as accents.
function searchText(value: string): string {
  return value.toLocaleLowerCase("da-DK").replace(/æ/g, "ae").replace(/ø/g, "o")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function ProductImage({ item, packId, className = "" }: { item: MenuImageSource; packId?: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = getProductImage(item.productSlug, item.imageUrl);
  const localFallback = getProductImage(item.productSlug);
  const imageSource = failedUrl === source ? localFallback : source;
  const [failedFallback, setFailedFallback] = useState<string | null>(null);
  const hasImage = imageSource !== "/placeholder.svg" && imageSource !== failedFallback;

  return (
    <span className={`spm-image ${className}`}>
      {hasImage ? (
        <img
          data-branding-id="header.dropdown.image"
          src={imageSource}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            if (imageSource === source && source !== localFallback) setFailedUrl(source);
            else setFailedFallback(imageSource);
          }}
        />
      ) : (
        <span className="spm-image-fallback" aria-hidden="true">
          <ProductCategoryIcon slug={item.productSlug} category={item.category} packId={packId} />
        </span>
      )}
    </span>
  );
}

function AllProducts({ href, onNavigate }: { href: string; onNavigate: () => void }) {
  return <Link className="spm-all-products" to={href} onClick={onNavigate}>Se alle produkter <ArrowRight aria-hidden="true" /></Link>;
}

function CategoryLinks({ category, onNavigate, limit }: { category: MenuCategory; onNavigate: () => void; limit?: number }) {
  const links = getCategoryLinks(category);
  const visibleLinks = limit === undefined ? links : links.slice(0, limit);
  return (
    <ul className="spm-category-links">
      {visibleLinks.map((item) => <li key={item.href}><Link data-branding-id="header.dropdown.product" to={item.href} onClick={onNavigate}>{item.label}</Link></li>)}
    </ul>
  );
}

function ProductRows({ products, onNavigate, selectedIconPackId }: Pick<VariantProps, "products" | "onNavigate" | "selectedIconPackId">) {
  return (
    <ul className="spm-product-rows">
      {products.map((product) => (
        <li key={product.key}>
          <Link data-branding-id="header.dropdown.product" to={product.href} onClick={onNavigate}>
            <ProductImage item={product} packId={selectedIconPackId} />
            <span className="spm-product-copy"><strong>{product.label}</strong>{product.category && <span data-branding-id="header.dropdown.meta">{product.category}</span>}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SearchAndDiscover({ categories, products, allProductsHref, onNavigate, selectedIconPackId }: VariantProps) {
  const [query, setQuery] = useState("");
  const reducedMotion = useReducedMotion();
  const inputId = useId();
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokens = searchText(query).trim().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    const searchTokens = searchText(query).trim().split(/\s+/).filter(Boolean);
    // Keep the complete catalog available to a search; only the initial suggestions are bounded.
    if (!searchTokens.length) return products.slice(0, 4);
    return products.filter((product) => {
      const searchable = searchText(`${product.label} ${product.category || ""} ${product.productSlug}`);
      return searchTokens.every((token) => searchable.includes(token));
    });
  }, [products, query]);

  return (
    <div className="spm-search-discover">
      <h2>Hvad vil du trykke?</h2>
      <div className="spm-search-field">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor={inputId}>Søg efter et produkt</label>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søg efter et produkt…"
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              resultsRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
            }
          }}
        />
        {query && <button type="button" aria-label="Ryd søgning" onClick={() => { setQuery(""); inputRef.current?.focus(); }}><X aria-hidden="true" /></button>}
      </div>
      <ul className="spm-search-shortcuts">
        {categories.map((category) => <li key={category.key}><Link data-branding-id="header.dropdown.category" to={category.href} onClick={onNavigate}>{category.label}</Link></li>)}
      </ul>
      <p className="spm-results-label" aria-live="polite" aria-atomic="true">
        {tokens.length ? `${results.length} ${results.length === 1 ? "produkt" : "produkter"} fundet` : "Udvalgte produkter"}
      </p>
      <motion.div
        ref={resultsRef}
        className="spm-search-results"
        key={query.trim() ? "filtered" : "suggested"}
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.16 }}
      >
        {results.length ? <ProductRows products={results} onNavigate={onNavigate} selectedIconPackId={selectedIconPackId} /> : (
          <p className="spm-empty-search">Ingen produkter matcher “{query}”. Prøv et andet navn, eller vælg en kategori.</p>
        )}
      </motion.div>
      <AllProducts href={allProductsHref} onNavigate={onNavigate} />
    </div>
  );
}

function TabbedExplorer({ categories, onNavigate, selectedIconPackId, allProductsHref }: VariantProps) {
  const [selectedKey, setSelectedKey] = useState(categories[0]?.key || "");
  const indicatorId = useId();
  const selected = categories.find((category) => category.key === selectedKey) || categories[0];
  const reducedMotion = useReducedMotion();
  if (!selected) return null;
  return (
    <Tabs.Root className="spm-tabbed" value={selected.key} onValueChange={setSelectedKey} activationMode="automatic">
      <Tabs.List className="spm-tab-list" aria-label="Produktkategorier">
        {categories.map((category) => (
          <Tabs.Trigger className="spm-tab" data-branding-id="header.dropdown.category" key={category.key} value={category.key}>
            {category.label}
            {selected.key === category.key && <motion.span className="spm-tab-indicator" layoutId={`spm-tab-${indicatorId}`} transition={{ duration: reducedMotion ? 0 : 0.2 }} />}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {categories.map((category) => (
        <Tabs.Content className="spm-tab-panel" key={category.key} value={category.key}>
          <motion.div className="spm-tab-grid" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
            <Link className="spm-tab-photo" to={category.href} onClick={onNavigate} aria-label={`Se ${category.label}`}>
              <ProductImage item={category} packId={selectedIconPackId} />
            </Link>
            <div className="spm-tab-destinations">
              <CategoryLinks category={category} onNavigate={onNavigate} />
              <Link className="spm-category-cta" to={category.href} onClick={onNavigate}>Se {category.label} <ArrowRight aria-hidden="true" /></Link>
            </div>
          </motion.div>
        </Tabs.Content>
      ))}
      <div className="spm-footer"><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </Tabs.Root>
  );
}

function VisualShowroom({ categories, onNavigate, selectedIconPackId, allProductsHref }: VariantProps) {
  return (
    <div className="spm-showroom">
      <ul className="spm-showroom-grid">
        {categories.map((category) => (
          <li key={category.key}>
            <Link data-branding-id="header.dropdown.category" to={category.href} onClick={onNavigate}>
              <ProductImage item={category} packId={selectedIconPackId} />
              <span className="spm-tile-label">{category.label}<ArrowRight aria-hidden="true" /></span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="spm-footer spm-footer-centered"><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </div>
  );
}

function CategoryStage({ categories, onNavigate, selectedIconPackId, allProductsHref, preset }: VariantProps) {
  const [activeKey, setActiveKey] = useState(categories[0]?.key || "");
  const active = categories.find((category) => category.key === activeKey) || categories[0];
  const reducedMotion = useReducedMotion();
  const curtain = preset === "focus-curtain";
  if (!active) return null;
  return (
    <div className={`spm-stage ${curtain ? "spm-curtain" : "spm-kinetic"}`}>
      {curtain && <div className="spm-curtain-top"><span>Vælg produkt</span><button type="button" onClick={onNavigate} aria-label="Luk produktmenu">Luk <X aria-hidden="true" /></button></div>}
      <div className="spm-stage-grid">
        <ul className="spm-stage-categories">
          {categories.map((category, index) => (
            <motion.li
              key={category.key}
              initial={reducedMotion ? false : { opacity: 0, y: curtain ? 0 : 9 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.24, delay: reducedMotion ? 0 : Math.min(index, 6) * 0.035 }}
            >
              <Link
                data-branding-id="header.dropdown.category"
                to={category.href}
                onClick={onNavigate}
                onPointerEnter={() => setActiveKey(category.key)}
                onFocus={() => setActiveKey(category.key)}
                className={active.key === category.key ? "is-active" : ""}
              >
                <span>{category.label}</span>{curtain && <ArrowRight aria-hidden="true" />}
              </Link>
            </motion.li>
          ))}
        </ul>
        <div className="spm-stage-feature">
          <Link className="spm-stage-photo" to={active.href} onClick={onNavigate} aria-label={`Se ${active.label}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={active.key} className="spm-stage-photo-inner" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: reducedMotion ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.13 }}>
                <ProductImage item={active} packId={selectedIconPackId} />
              </motion.span>
            </AnimatePresence>
          </Link>
          {curtain && <h2>{active.label}</h2>}
          <Link className="spm-category-cta" to={active.href} onClick={onNavigate}>Se {active.label} <ArrowRight aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="spm-footer"><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </div>
  );
}

function QuickList({ categories, onNavigate, selectedIconPackId, allProductsHref }: VariantProps) {
  return (
    <div className="spm-quick-list">
      <ul>
        {categories.map((category) => (
          <li key={category.key}><Link data-branding-id="header.dropdown.category" to={category.href} onClick={onNavigate}><ProductCategoryIcon slug={category.productSlug} category={category.category} packId={selectedIconPackId} className="spm-quick-icon" /><span>{category.label}</span></Link></li>
        ))}
      </ul>
      <div className="spm-footer"><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </div>
  );
}

function PaperFold({ categories, onNavigate, selectedIconPackId, allProductsHref }: VariantProps) {
  return (
    <div className="spm-paper">
      <div className="spm-paper-panels">
        {categories.map((category, index) => (
          <section className="spm-paper-panel" key={category.key} style={{ "--fold-order": Math.min(index, 6) } as CSSProperties}>
            <h2><Link data-branding-id="header.dropdown.category" to={category.href} onClick={onNavigate}>{category.label}</Link></h2>
            <Link className="spm-paper-photo" to={category.href} onClick={onNavigate} aria-label={`Se ${category.label}`}><ProductImage item={category} packId={selectedIconPackId} /></Link>
            <CategoryLinks category={category} onNavigate={onNavigate} limit={3} />
            <Link className="spm-paper-cta" to={category.href} onClick={onNavigate} aria-label={`Se ${category.label}`}><ArrowRight aria-hidden="true" /></Link>
          </section>
        ))}
      </div>
      <div className="spm-footer"><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </div>
  );
}

function OpenDirectory({ categories, onNavigate, allProductsHref }: VariantProps) {
  return (
    <div className="spm-directory">
      <div className="spm-directory-grid">
        {categories.map((category) => <section key={category.key}><h2><Link data-branding-id="header.dropdown.category" to={category.href} onClick={onNavigate}>{category.label}</Link></h2><CategoryLinks category={category} onNavigate={onNavigate} /></section>)}
      </div>
      <div className="spm-footer"><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </div>
  );
}

function ProductFilmstrip({ categories, onNavigate, selectedIconPackId, allProductsHref }: VariantProps) {
  const railRef = useRef<HTMLUListElement>(null);
  const [scrollState, setScrollState] = useState({ canPrevious: false, canNext: false, progress: 0 });
  const reducedMotion = useReducedMotion();
  const updateScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const total = rail.scrollWidth - rail.clientWidth;
    setScrollState({ canPrevious: rail.scrollLeft > 2, canNext: rail.scrollLeft < total - 2, progress: total > 0 ? rail.scrollLeft / total : 1 });
  }, []);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateScroll();
    const observer = new ResizeObserver(updateScroll);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [categories.length, updateScroll]);
  const scroll = (direction: number) => {
    const rail = railRef.current;
    if (rail) rail.scrollBy({ left: direction * rail.clientWidth * 0.7, behavior: reducedMotion ? "instant" : "smooth" });
  };
  return (
    <div className="spm-filmstrip">
      <div className="spm-filmstrip-stage">
        <ul className="spm-filmstrip-rail" ref={railRef} onScroll={updateScroll} aria-label="Produktkategorier">
          {categories.map((category) => (
            <li key={category.key}><Link data-branding-id="header.dropdown.category" to={category.href} onClick={onNavigate}><ProductImage item={category} packId={selectedIconPackId} /><span>{category.label}</span></Link></li>
          ))}
        </ul>
        <button className="spm-rail-arrow spm-rail-previous" type="button" onClick={() => scroll(-1)} disabled={!scrollState.canPrevious} aria-label="Vis forrige kategorier"><ArrowLeft aria-hidden="true" /></button>
        <button className="spm-rail-arrow spm-rail-next" type="button" onClick={() => scroll(1)} disabled={!scrollState.canNext} aria-label="Vis næste kategorier"><ArrowRight aria-hidden="true" /></button>
      </div>
      <div className="spm-filmstrip-footer"><span className="spm-rail-progress" aria-hidden="true"><span style={{ transform: `translateX(${scrollState.progress * 300}%)` }} /></span><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </div>
  );
}

function CompactCategories(props: VariantProps) {
  const { categories, products, onNavigate, selectedIconPackId, allProductsHref } = props;
  const groupedHrefs = new Set(categories.flatMap((category) => getCategoryLinks(category).map((link) => link.href)));
  const remainingProducts = products.filter((product) => !groupedHrefs.has(product.href));
  return (
    <div className="spm-compact-categories">
      {categories.map((category) => {
        const links = getCategoryLinks(category);
        return links.length ? (
          <details className="spm-compact-category" key={category.key}>
            <summary data-branding-id="header.dropdown.category"><ProductCategoryIcon slug={category.productSlug} category={category.category} packId={selectedIconPackId} /><span>{category.label}</span><ChevronDown aria-hidden="true" /></summary>
            <Link className="spm-category-cta" to={category.href} onClick={onNavigate}>Se {category.label} <ArrowRight aria-hidden="true" /></Link>
            <CategoryLinks category={category} onNavigate={onNavigate} />
          </details>
        ) : <Link className="spm-compact-direct" data-branding-id="header.dropdown.category" key={category.key} to={category.href} onClick={onNavigate}><ProductCategoryIcon slug={category.productSlug} category={category.category} packId={selectedIconPackId} /><span>{category.label}</span><ArrowRight aria-hidden="true" /></Link>;
      })}
      {!!remainingProducts.length && <ProductRows products={remainingProducts} onNavigate={onNavigate} selectedIconPackId={selectedIconPackId} />}
      <div className="spm-footer"><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>
    </div>
  );
}

export function StorefrontProductMenuContent(props: StorefrontProductMenuContentProps) {
  const { preset, compact, categories, products, loading, error, allProductsHref, onNavigate, label, style } = props;
  let content: ReactNode;
  if (loading || error || (!categories.length && !products.length)) {
    content = <div className="spm-status"><p role={error ? "alert" : "status"}>{error || (loading ? "Indlæser produkter…" : "Der er ingen produkter at vise endnu.")}</p><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>;
  } else if (preset === "search-and-discover") {
    content = <SearchAndDiscover {...props} />;
  } else if (compact) {
    content = <CompactCategories {...props} />;
  } else if (!categories.length) {
    content = <div className="spm-ungrouped"><ProductRows {...props} /><AllProducts href={allProductsHref} onNavigate={onNavigate} /></div>;
  } else {
    switch (preset) {
      case "tabbed-explorer": content = <TabbedExplorer {...props} />; break;
      case "visual-showroom": content = <VisualShowroom {...props} />; break;
      case "kinetic-type":
      case "focus-curtain": content = <CategoryStage {...props} />; break;
      case "quick-list": content = <QuickList {...props} />; break;
      case "paper-fold": content = <PaperFold {...props} />; break;
      case "open-directory": content = <OpenDirectory {...props} />; break;
      case "product-filmstrip": content = <ProductFilmstrip {...props} />; break;
    }
  }
  return <nav className={`spm-content spm-content--${preset}${compact ? " spm-content--compact" : ""}`} data-product-menu-preset={preset} data-branding-id="header.dropdown.panel" aria-label={label} style={style}>{content}</nav>;
}

/** Accessible product navigation with an ordinary search field, rather than menu typeahead. */
export function StorefrontProductMenu({ open, onOpenChange, trigger, onCompactFocus, ...props }: StorefrontProductMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [contentNode, setContentNode] = useState<HTMLDivElement | null>(null);
  const [alignOffset, setAlignOffset] = useState(0);
  const dimPage = ["kinetic-type", "paper-fold", "focus-curtain"].includes(props.preset);
  const centerInViewport = props.preset !== "quick-list";

  useLayoutEffect(() => {
    if (!open || !centerInViewport || !contentNode) return;
    const updateAlignment = () => {
      const triggerBounds = triggerRef.current?.getBoundingClientRect();
      if (!triggerBounds) return;
      // Radix's alignOffset applies only to start/end alignment. offsetWidth
      // deliberately excludes the entry animation's temporary scale transform.
      const viewportWidth = document.documentElement.clientWidth;
      const nextOffset = (viewportWidth - contentNode.offsetWidth) / 2 - triggerBounds.left;
      setAlignOffset((previous) => Math.abs(previous - nextOffset) < 0.5 ? previous : nextOffset);
    };
    updateAlignment();
    window.addEventListener("resize", updateAlignment);
    return () => window.removeEventListener("resize", updateAlignment);
  }, [open, centerInViewport, contentNode, props.preset, props.style]);

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild ref={triggerRef}>{trigger}</Popover.Trigger>
      {open && dimPage && <Popover.Portal><div className="spm-backdrop" aria-hidden="true" /></Popover.Portal>}
      <Popover.Portal>
        <Popover.Content
          ref={setContentNode}
          className={`spm-popover spm-popover--${props.preset}`}
          aria-label={props.label}
          side="bottom"
          align="start"
          alignOffset={centerInViewport ? alignOffset : 0}
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions
          sticky="always"
          style={props.style}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (onCompactFocus) onCompactFocus();
            else triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <StorefrontProductMenuContent {...props} onNavigate={() => onOpenChange(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
