import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ProductCategoryIcon } from '@/components/ProductCategoryIcon';
import { getProductImage } from '@/utils/productImages';
import { appendStorefrontTenantContext } from '@/lib/storefrontTenantContext';

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  icon_text?: string | null;
  category?: string | null;
  image_url?: string | null;
}

/** One search field for both header modes. It occupies the existing header row;
 * only the result list extends below it. No duplicate mobile search state. */
export function HeaderSearch({ id, open, products, loading, error, selectedIconPackId, onClose }: {
  id: string;
  open: boolean;
  products: SearchProduct[];
  loading: boolean;
  error?: string;
  selectedIconPackId: string;
  onClose: (restoreFocus: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return products.filter(product => {
      const text = `${product.name} ${product.icon_text || ''} ${product.slug} ${product.category || ''}`.toLocaleLowerCase();
      return tokens.every(token => text.includes(token));
    });
  }, [products, query]);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
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
          placeholder="Søg produkter…"
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
      {open && query.trim() && (
        <div ref={resultsRef} id={`${id}-results`} className="storefront-header-search-results" onKeyDown={event => {
          if (event.key === 'ArrowUp' && document.activeElement === resultsRef.current?.querySelector('a')) {
            event.preventDefault(); inputRef.current?.focus();
          }
        }}>
          <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
            {error || (loading ? 'Indlæser produkter…' : matches.length ? `${matches.length} produkt${matches.length !== 1 ? 'er' : ''} fundet` : `Ingen produkter fundet for “${query}”`)}
          </p>
          {!loading && !error && matches.map(product => (
            <Link key={product.id} to={appendStorefrontTenantContext(`/produkt/${product.slug}`)} onClick={() => onClose(false)} className="flex min-h-11 items-center gap-3 rounded-md p-3 hover:bg-muted focus-visible:bg-muted">
              {product.image_url ? <img src={getProductImage(product.slug, product.image_url)} alt="" className="h-10 w-10 shrink-0 rounded object-contain" style={{ filter: 'var(--product-filter)' }} /> : <ProductCategoryIcon slug={product.slug} category={product.category} packId={selectedIconPackId} className="h-5 w-5 shrink-0" />}
              <span className="min-w-0 break-words text-sm font-medium">{product.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
