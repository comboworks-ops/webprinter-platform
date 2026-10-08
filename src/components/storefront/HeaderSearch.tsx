import { StorefrontImage } from '@/components/storefront/StorefrontImage';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ProductCategoryIcon } from '@/components/ProductCategoryIcon';
import { getProductImage } from '@/utils/productImages';
import { appendStorefrontTenantContext } from '@/lib/storefrontTenantContext';
import { DEFAULT_DROPDOWN_PRESET, type HeaderDropdownPreset } from '@/lib/branding/dropdownPresets';
import { resolveSearchPresentation, type MenuEntrance, type SearchPresentation } from '@/lib/branding/headerMenuSettings';
import '@/styles/headerUtilityMenus.css';
import '@/styles/headerMenuMotion.css';

import { filterHeaderProducts, type HeaderSearchProduct } from '@/lib/storefront/headerSearch';

/** One search field for both header modes. It occupies the existing header row;
 * only the result list extends below it. No duplicate mobile search state. */
export function HeaderSearch({ id, open, products, loading, error, selectedIconPackId, onClose, onOpen, preset = DEFAULT_DROPDOWN_PRESET, style, presentation, entrance }: {
  entrance?: MenuEntrance;
  presentation?: SearchPresentation;
  onOpen?: () => void;
  preset?: HeaderDropdownPreset;
  style?: CSSProperties;
  id: string;
  open: boolean;
  products: HeaderSearchProduct[];
  loading: boolean;
  error?: string;
  selectedIconPackId: string;
  onClose: (restoreFocus: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const mode = resolveSearchPresentation(preset, presentation);
  const categories = useMemo(() => [...new Set(products.map(product => product.category).filter((value): value is string => Boolean(value)))].sort((a,b) => a.localeCompare(b, 'da')), [products]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => filterHeaderProducts(products, query, category), [products, query, category]);
  const hasQuery = Boolean(query.trim());
  const visibleProducts = hasQuery || category ? matches : mode === 'compact' || mode === 'command' ? [] : matches.slice(0, 6);

  useEffect(() => { setCategory(''); }, [mode, preset]);
  useEffect(() => {
    if (mode !== 'command' || !onOpen) return;
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !target.matches('input,textarea,[contenteditable="true"]')) {
        event.preventDefault(); onOpen();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [mode, onOpen]);

  useEffect(() => {
    if (!open) { setQuery(''); setCategory(''); return; }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onClose(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside); };
  }, [open, onClose]);

  return (
    <div
      ref={containerRef}
      id={id}
      className="storefront-header-search"
      data-utility-preset={preset}
      data-search-presentation={mode}
      style={style}
      data-open={open || undefined}
      aria-hidden={!open}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true); }
      }}
      onBlur={event => {
        if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) onClose(false);
      }}
    >
      <form role="search" aria-label="Produktsøgning" className="storefront-header-search-field" onSubmit={event => {
        event.preventDefault();
        resultsRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
      }}>
        <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Søg produkter"
          aria-controls={`${id}-results`}
          placeholder={mode === 'command' ? 'Søg produkt eller kategori…' : mode === 'compact' ? 'Skriv et produktnavn…' : 'Søg produkter…'}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); resultsRef.current?.querySelector<HTMLAnchorElement>('a')?.focus(); }
          }}
          tabIndex={open ? 0 : -1}
          autoComplete="off"
        />
        <button type="button" aria-label="Luk søgning" tabIndex={open ? 0 : -1} onClick={() => onClose(true)}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
      {open && (
        <div ref={resultsRef} id={`${id}-results`} className="storefront-header-search-results header-utility-panel" data-utility-preset={preset} data-search-presentation={mode} data-menu-entrance={entrance} data-state="open" data-query-active={Boolean(hasQuery || category) || undefined} onKeyDown={event => {
          if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && document.activeElement?.tagName === 'A') {
            const links = [...(resultsRef.current?.querySelectorAll<HTMLAnchorElement>('a') || [])];
            const index = links.indexOf(document.activeElement as HTMLAnchorElement);
            event.preventDefault();
            if (event.key === 'ArrowUp' && index === 0) inputRef.current?.focus();
            else links[Math.max(0, Math.min(links.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
          }
        }}>
          <div className="header-utility-heading"><strong>{mode === 'visual' ? 'Find dit næste tryk' : mode === 'categories' ? 'Find produkt i en kategori' : mode === 'compact' ? 'Hurtig søgning' : 'Søg produkter'}</strong><small>{mode === 'command' ? 'Ctrl / ⌘ K · Åbn søgning' : 'Søg efter navn, kategori eller format'}</small></div>
          {(mode === 'categories' || mode === 'command') && categories.length > 0 && <div className="header-search-categories" role="group" aria-label="Filtrér søgning efter kategori">
            <button type="button" aria-pressed={!category} onClick={() => setCategory('')}>Alle</button>
            {categories.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}
          </div>}
          <p role="status" className="header-search-status">
            {error || (loading ? 'Indlæser produkter…' : !hasQuery && !category ? mode === 'compact' ? 'Skriv for at se resultater' : mode === 'command' ? 'Skriv et navn, eller vælg en kategori' : 'Gå på opdagelse i sortimentet' : matches.length ? `${matches.length} produkt${matches.length !== 1 ? 'er' : ''} fundet` : `Ingen produkter fundet for “${query}”`)}
          </p>
          <div className="header-search-results-list">
          {!loading && !error && visibleProducts.map(product => (
            <Link key={product.id} to={appendStorefrontTenantContext(`/produkt/${product.slug}`)} onClick={() => onClose(false)} className="header-utility-item">
              {product.image_url && mode !== 'compact' ? <StorefrontImage variant="thumbnail" sizes="48px" src={getProductImage(product.slug, product.image_url)} alt="" style={{ filter: 'var(--product-filter)' }} /> : <ProductCategoryIcon slug={product.slug} category={product.category} packId={selectedIconPackId} className="header-search-product-icon h-5 w-5 shrink-0" />}
              <span className="min-w-0 break-words font-medium">{product.name}{mode === 'command' && product.category && <small className="header-search-product-category">{product.category}</small>}</span>
            </Link>
          ))}
          </div>
          {mode === 'command' && <p className="header-search-keyboard-hint"><kbd>↑</kbd><kbd>↓</kbd> Vælg resultat <kbd>Enter</kbd> Åbn <kbd>Esc</kbd> Luk</p>}
          <Link className="header-utility-item header-search-browse" to={appendStorefrontTenantContext('/produkter')} onClick={() => onClose(false)}>Se alle produkter</Link>
        </div>
      )}
    </div>
  );
}
