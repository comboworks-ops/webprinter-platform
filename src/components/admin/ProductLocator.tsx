import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ImageIcon, Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { buildLocatorItems, filterLocatorItems, locatorUrl, type LocatorAttributeGroup, type LocatorProduct } from '@/lib/products/productLocator';
import '@/styles/productLocator.css';

// These existing tables are not yet represented in the generated Database type.
const metadataClient = supabase as unknown as SupabaseClient;

export function ProductLocator({ products, tenantId, loading, error, retry, canImport, onTogglePublish, onSendToTenants, sendingDisabled }: {
  products: LocatorProduct[]; tenantId: string | null; loading: boolean; error: string;
  retry: () => void; canImport: boolean;
  onTogglePublish: (id: string) => void; onSendToTenants: (id: string) => void; sendingDisabled: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [groups, setGroups] = useState<LocatorAttributeGroup[]>([]);
  const [attributeState, setAttributeState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [retryIndex, setRetryIndex] = useState(0);
  const productIds = useMemo(() => products.map(product => product.id), [products]);
  const wideProductIds = useMemo(() => products.filter(product => product.pricing_type === 'STORFORMAT').map(product => product.id), [products]);
  useEffect(() => {
    let active = true;
    setGroups([]);
    if (!tenantId || loading) return () => { active = false; };
    if (!productIds.length) { setAttributeState('ready'); return () => { active = false; }; }
    setAttributeState('loading');
    (async () => {
      const collected: LocatorAttributeGroup[] = [];
      try {
        for (let index = 0; index < productIds.length; index += 100) {
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await metadataClient.from('product_attribute_groups')
              .select('product_id, kind, enabled, values:product_attribute_values(name, enabled)')
              .eq('tenant_id', tenantId).in('product_id', productIds.slice(index, index + 100))
              .order('id').range(offset, offset + 499);
            if (error) throw error;
            if (!active) return;
            collected.push(...(data || []) as unknown as LocatorAttributeGroup[]);
            if ((data || []).length < 500) break;
          }
        }
        for (let index = 0; index < wideProductIds.length; index += 100) {
          const batch = wideProductIds.slice(index, index + 100);
          collected.push(...batch.map(product_id => ({ product_id, kind: 'format', values: [{ name: 'Eget format' }] })));
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await metadataClient.from('storformat_materials')
              .select('id, product_id, name').eq('tenant_id', tenantId).in('product_id', batch)
              .order('id').range(offset, offset + 499);
            if (error) throw error;
            if (!active) return;
            collected.push(...((data || []) as { product_id: string; name: string }[]).map(row => ({ product_id: row.product_id, kind: 'material', values: [{ name: row.name }] })));
            if ((data || []).length < 500) break;
          }
        }
        if (active) { setGroups(collected); setAttributeState('ready'); }
      } catch { if (active) setAttributeState('error'); }
    })();
    return () => { active = false; };
  }, [tenantId, productIds, wideProductIds, loading, retryIndex]);
  const items = useMemo(() => buildLocatorItems(products, groups), [products, groups]);
  const filters = { query: params.get('findQuery') || '', category: params.get('findCategory') || '', format: params.get('findFormat') || '', material: params.get('findMaterial') || '', status: params.get('findStatus') || '' };
  const results = filterLocatorItems(items, filters);
  const selected = results.find(item => item.id === params.get('findSelected')) || results[0];
  const change = (patch: Record<string, string>) => navigate(locatorUrl('/admin/products', location.search, patch), { replace: true });
  const clear = () => change({ findQuery: '', findCategory: '', findFormat: '', findMaterial: '', findStatus: '', findSelected: '' });
  const facets = [
    { key: 'findCategory', title: 'Produkttype', value: filters.category, options: [...new Set(items.map(item => item.category || 'Uden kategori'))].sort((a, b) => a.localeCompare(b, 'da')) },
    { key: 'findFormat', title: 'Format', value: filters.format, options: [...new Set(items.flatMap(item => item.formats))].sort((a, b) => a.localeCompare(b, 'da')) },
    { key: 'findMaterial', title: 'Papir og materiale', value: filters.material, options: [...new Set(items.flatMap(item => item.materials))].sort((a, b) => a.localeCompare(b, 'da')) },
  ];
  const activeFilters = [{ key: 'findQuery', label: filters.query }, ...facets.map(facet => ({ key: facet.key, label: facet.value })), { key: 'findStatus', label: filters.status === 'published' ? 'Publiceret' : filters.status ? 'Kladde' : '' }].filter(item => item.label);
  const productUrl = (id: string, slug: string) => locatorUrl(`/admin/product/${slug}`, location.search, { findSelected: id, view: '' });
  return <section className="product-locator" aria-label="Find produkter">
    <header className="pl-heading"><div><p className="pl-breadcrumb">Produkter <span>/</span> Find produkt</p><h1>Hvad leder du efter?</h1><p>Find dit produkt, og tilpas kundens bestillingsform.</p></div><div className="pl-actions"><Button variant="outline" asChild><Link to={locatorUrl('/admin/products', location.search, { view: 'manage' })}>Administrer produkter</Link></Button>{canImport && <Button asChild><Link to={locatorUrl('/admin/pod2-katalog', location.search)}>Importér produkt</Link></Button>}<Button variant="outline" asChild><Link to={locatorUrl('/admin/create-product', location.search)}>Opret selv</Link></Button></div></header>
    <div className="pl-search" role="search"><Search size={21} aria-hidden="true"/><input aria-label="Søg produkter" placeholder="Søg efter produkt, format, papir eller materiale…" value={filters.query} onChange={event => change({ findQuery: event.target.value })}/>{filters.query && <button type="button" aria-label="Ryd søgning" onClick={() => change({ findQuery: '' })}><X size={18}/></button>}</div>
    <div className="pl-search-meta"><div className="pl-chips">{activeFilters.map(item => <button key={item.key} type="button" aria-label={`Fjern filter ${item.label}`} onClick={() => change({ [item.key]: '' })}>{item.label}<X size={12}/></button>)}{activeFilters.length > 0 && <button type="button" className="pl-clear" onClick={clear}>Ryd alle filtre</button>}</div><span aria-live="polite">{loading ? 'Henter produkter…' : `${results.length} af ${items.length} produkter`}</span></div>
    <button type="button" className="pl-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17}/>Filtre</button>
    <div className="pl-layout"><aside className={`pl-filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Produktfiltre">
      {facets.filter(facet => facet.options.length || facet.value).map(facet => <fieldset key={facet.key}><legend>{facet.title}</legend>{[...new Set([...facet.options, ...(facet.value ? [facet.value] : [])])].map(option => <label key={option}><input type="checkbox" checked={facet.value === option} onChange={() => change({ [facet.key]: facet.value === option ? '' : option })}/><span>{option}</span></label>)}</fieldset>)}
      <fieldset><legend>Status</legend>{[['published', 'Publiceret'], ['draft', 'Kladde']].map(([value, label]) => <label key={value}><input type="checkbox" checked={filters.status === value} onChange={() => change({ findStatus: filters.status === value ? '' : value })}/><span>{label}</span></label>)}</fieldset>
      {attributeState === 'loading' && !loading && <small>Henter formater og materialer…</small>}{attributeState === 'error' && <p className="pl-hint">Formater og materialer kunne ikke hentes. Du kan stadig søge på produktnavn.<button type="button" onClick={() => setRetryIndex(index => index + 1)}>Prøv igen</button></p>}

    </aside><div className="pl-results">
      {error ? <div className="pl-empty" role="alert"><h2>Produkterne kunne ikke hentes</h2><p>{error}</p><Button variant="outline" onClick={retry}>Prøv igen</Button></div> : loading ? <div className="pl-empty" role="status">Henter dit sortiment…</div> : !results.length ? <div className="pl-empty"><Search size={28}/><h2>{items.length ? 'Ingen produkter matcher' : 'Dine produkter starter her'}</h2><p>{items.length ? 'Prøv et andet søgeord, eller fjern et filter.' : 'Opret dit første produkt for at bygge bestillingsformen.'}</p>{items.length ? <Button variant="outline" onClick={clear}>Ryd søgning og filtre</Button> : <Button asChild><Link to={locatorUrl('/admin/create-product', location.search)}>Opret produkt</Link></Button>}</div> : <>
        <div className="pl-column-headings" aria-hidden="true"><span>Produkt</span><span>Format</span><span>Papir / materiale</span><span>Status</span></div>
        <div className="pl-product-list" aria-label="Fundne produkter">{results.map(item => <article key={item.id} className={`pl-row ${item.id === selected?.id ? 'is-selected' : ''}`}>
          <div className="pl-product"><button className="pl-image-button" type="button" aria-label={`Forhåndsvis ${item.name}`} aria-pressed={selected?.id === item.id} onClick={() => change({ findSelected: item.id })}>{item.id === selected?.id ? <Check size={17}/> : <span className="pl-unselected"/>}{item.image_url ? <img src={item.image_url} alt="" loading="lazy"/> : <ImageIcon className="pl-missing-image" aria-label="Intet produktbillede"/>}</button><div><Link className="pl-product-title" to={productUrl(item.id, item.slug)}>{item.name}</Link><p>{item.description || item.category || 'Tilpas produktets bestillingsform'}</p></div></div>
          <div className="pl-values"><span className="pl-mobile-label">Format</span>{item.formats.slice(0, 3).join(', ') || 'Se produkt'}{item.formats.length > 3 && ` + ${item.formats.length - 3}`}</div>
          <div className="pl-values"><span className="pl-mobile-label">Papir / materiale</span>{item.materials.slice(0, 2).join(', ') || 'Se produkt'}{item.materials.length > 2 && ` + ${item.materials.length - 2}`}</div>
          <div className="pl-row-status"><span className={`pl-status ${item.is_published ? 'published' : ''}`}>{item.is_published ? 'Publiceret' : 'Kladde'}</span><button type="button" className="pl-product-action" onClick={() => onTogglePublish(item.id)} aria-label={`${item.is_published ? 'Skjul' : 'Publicer'} ${item.name} på siden`}>{item.is_published ? 'Skjul på siden' : 'Publicer på siden'}</button>{canImport && <button type="button" className="pl-product-action" disabled={sendingDisabled} onClick={() => onSendToTenants(item.id)} aria-label={`Send ${item.name} til lejere`}>Send til lejere</button>}<Link to={productUrl(item.id, item.slug)}>Åbn produkt<ArrowRight size={14}/></Link></div>
        </article>)}</div>
        {selected && <section className="pl-selection" aria-label={`Valgt produkt: ${selected.name}`}><div className="pl-selection-image">{selected.image_url ? <img src={selected.image_url} alt={selected.name}/> : <ImageIcon size={48}/>}</div><div className="pl-selection-copy"><p className="pl-eyebrow">DIT PRODUKT</p><h2>{selected.name}</h2><p>{selected.description}</p><div className="pl-selection-tags">{[...selected.formats.slice(0, 3), ...selected.materials.slice(0, 2)].map(value => <span key={value}>{value}</span>)}</div></div><div className="pl-selection-action"><span className={`pl-status ${selected.is_published ? 'published' : ''}`}>{selected.is_published ? 'Allerede i din shop' : 'Gemt som kladde'}</span><p>Tilpas valg, billeder og bestillingsform med kundens side ved siden af.</p><Button asChild><Link to={productUrl(selected.id, selected.slug)}>Åbn produkt<ArrowRight size={16}/></Link></Button></div></section>}
      </>}
    </div></div>
  </section>;
}
