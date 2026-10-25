import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ADMIN_WORKSPACE_EXIT_EVENT } from '@/lib/admin/workspaceExit';

export interface PurchasePriceRow {
  price_key: string;
  variant: string;
  quantity: number;
  price_dkk: number | null;
  revision: number | null;
  is_default: boolean;
}
export interface PurchasePriceApi {
  tenants(): Promise<{ id: string; name: string }[]>;
  products(tenantId: string): Promise<{ id: string; name: string }[]>;
  link(sourceProductId: string, productId: string): Promise<void>;
  load(productId: string, tenantId: string): Promise<{ rows: PurchasePriceRow[]; linked: boolean }>;
  save(productId: string, tenantId: string, rows: { price_key: string; quantity: number; price_dkk: number }[]): Promise<void>;
}
const api: PurchasePriceApi = {
  async products(tenantId) {
    const { data, error } = await supabase.from('products').select('id,name').eq('tenant_id', tenantId).order('name');
    if (error) throw error;
    return data || [];
  },
  async link(sourceProductId, productId) {
    const { error } = await supabase.rpc('link_webprinter_purchase_product' as never,
      { p_source_product_id: sourceProductId, p_product_id: productId } as never);
    if (error) throw error;
  },
  async tenants() {
    const { data, error } = await supabase.from('tenants').select('id,name')
      .neq('id', '00000000-0000-0000-0000-000000000000').order('name');
    if (error) throw error;
    return data || [];
  },
  async load(productId, tenantId) {
    const { data, error } = await supabase.rpc('get_webprinter_purchase_prices' as never,
      { p_product_id: productId, p_tenant_id: tenantId } as never);
    if (error) throw error;
    return data as unknown as { rows: PurchasePriceRow[]; linked: boolean };
  },
  async save(productId, tenantId, rows) {
    const { error } = await supabase.rpc('save_webprinter_purchase_prices' as never,
      { p_product_id: productId, p_tenant_id: tenantId, p_rows: rows } as never);
    if (error) throw error;
  },
};

export function TenantPurchasePrices({ productId, tenantId, canSetPurchasePrices, service = api }: {
  productId: string; tenantId: string; canSetPurchasePrices: boolean; service?: PurchasePriceApi;
}) {
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [linkProduct, setLinkProduct] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(canSetPurchasePrices ? '' : tenantId);
  const [rows, setRows] = useState<PurchasePriceRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [linked, setLinked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const request = useRef(0);
  const keyFor = (row: PurchasePriceRow) => `${row.price_key}:${row.quantity}`;
  const dirty = Object.keys(draft).length > 0;
  useEffect(() => { setSelectedTenant(canSetPurchasePrices ? '' : tenantId); }, [canSetPurchasePrices, tenantId]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const beforeExit = (event: Event) => {
      event.preventDefault(); setStatus('Gem eller fortryd indkøbspriserne, før du forlader siden.');
    };
    const beforeLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('a[href]');
      if (link && link.getAttribute('href') !== location.href) beforeExit(event);
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener(ADMIN_WORKSPACE_EXIT_EVENT, beforeExit);
    document.addEventListener('click', beforeLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener(ADMIN_WORKSPACE_EXIT_EVENT, beforeExit);
      document.removeEventListener('click', beforeLink, true);
    };
  }, [dirty]);
  useEffect(() => {
    if (!canSetPurchasePrices) return;
    let active = true;
    service.tenants().then(data => { if (active) setTenants(data); })
      .catch(() => { if (active) { setStatus('Lejerne kunne ikke hentes. Prøv igen.'); setFailed(true); } });
    return () => { active = false; };
  }, [canSetPurchasePrices, service, reload]);
  useEffect(() => {
    let active = true;
    const id = ++request.current;
    setRows([]); setDraft({}); setStatus(''); setFailed(false); setProducts([]); setLinkProduct('');
    if (!selectedTenant) return;
    setLoading(true);
    Promise.all([service.load(productId, selectedTenant),
      canSetPurchasePrices ? service.products(selectedTenant) : Promise.resolve([])]).then(([data, availableProducts]) => {
      if (!active || id !== request.current) return;
      setRows(data.rows); setLinked(data.linked); setProducts(availableProducts);
    }).catch(() => {
      if (!active || id !== request.current) return;
      setStatus('Indkøbspriserne kunne ikke hentes. Prøv igen.'); setFailed(true);
    }).finally(() => { if (active && id === request.current) setLoading(false); });
    return () => { active = false; };
  }, [productId, selectedTenant, service, reload, canSetPurchasePrices]);
  async function attachExistingProduct() {
    setSaving(true); setFailed(false); setStatus('');
    try {
      await service.link(productId, linkProduct);
      setStatus('Produktet er tilknyttet indkøbspriserne. Lejerens kundepriser er uændrede.');
    } catch { setStatus('Produktet kunne ikke tilknyttes. Kontrollér, at du har valgt den rigtige kopi af produktet.'); setFailed(true); }
    finally { setSaving(false); }
  }
  async function save() {
    const changes = rows.filter(row => keyFor(row) in draft).map(row => ({
      price_key: row.price_key, quantity: row.quantity,
      price_dkk: Number(draft[keyFor(row)].trim().replace(',', '.')),
    }));
    if (!changes.length || changes.some(row => !Number.isFinite(row.price_dkk) || row.price_dkk <= 0)) {
      setStatus('Angiv en indkøbspris over 0 kr. for hvert ændret felt.'); setFailed(true); return;
    }
    setSaving(true); setStatus(''); setFailed(false);
    try {
      await service.save(productId, selectedTenant, changes);
      const result = await service.load(productId, selectedTenant);
      setRows(result.rows); setDraft({});
      setStatus('Indkøbspriserne er gemt. Lejerens kundepriser er uændrede.');
    } catch {
      setStatus('Priserne kunne ikke bekræftes. Genindlæs for at kontrollere, og prøv igen.'); setFailed(true);
    } finally { setSaving(false); }
  }
  return <Card>
    <CardHeader>
      <CardTitle>{canSetPurchasePrices ? 'Indkøbspriser pr. lejer' : 'Din indkøbspris fra Webprinter'}</CardTitle>
      <CardDescription>{canSetPurchasePrices
        ? 'Vælg en lejer og angiv, hvad lejeren betaler Webprinter for produktet. Priserne er i DKK ekskl. moms.'
        : 'Disse priser fastsættes af Webprinter. Du bestemmer selv dine kundepriser i prisværktøjerne nedenfor.'}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {canSetPurchasePrices && <div className="max-w-lg space-y-2">
        <Label htmlFor="purchase-price-tenant">Lejer</Label>
        <Select value={selectedTenant} onValueChange={setSelectedTenant} disabled={saving || dirty}>
          <SelectTrigger id="purchase-price-tenant" className="min-h-11"><SelectValue placeholder="Vælg lejer" /></SelectTrigger>
          <SelectContent>{tenants.map(tenant => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
      {loading && <p role="status">Henter indkøbspriser…</p>}
      {selectedTenant && !loading && !failed && !rows.length && <p className="text-sm text-muted-foreground">{linked
        ? 'Produktet har ingen faste Matrix-priser. Indkøbspriser kræver en prisrække for hver kombination.'
        : 'Dette produkt har endnu ingen tilknyttede indkøbspriser fra Webprinter. Dine kundepriser kan stadig redigeres nedenfor.'}</p>}
      {rows.length > 0 && <div className="max-h-96 overflow-auto rounded-md border">
        <table className="w-full text-sm"><caption className="sr-only">Indkøbspriser i DKK ekskl. moms</caption>
          <thead><tr className="border-b text-left"><th className="p-3">Kombination</th><th className="p-3">Antal</th><th className="p-3">Indkøbspris</th></tr></thead>
          <tbody>{rows.map(row => <tr key={keyFor(row)} className="border-b last:border-0">
            <td className="max-w-64 break-words p-3">{row.variant || 'Standard'}</td><td className="p-3">{row.quantity}</td>
            <td className="p-3">{canSetPurchasePrices ? <Input className="min-w-28" inputMode="decimal"
              aria-label={`Indkøbspris ${row.variant || 'Standard'}, ${row.quantity} stk.`} disabled={saving}
              value={draft[keyFor(row)] ?? (row.price_dkk == null ? '' : String(row.price_dkk))}
              placeholder="Ikke aftalt" onChange={event => setDraft(current => ({ ...current, [keyFor(row)]: event.target.value }))} />
              : row.price_dkk == null ? 'Ikke aftalt' : `${Number(row.price_dkk).toLocaleString('da-DK', { minimumFractionDigits: 2 })} kr.`}
              {row.is_default && row.price_dkk != null && <span className="mt-1 block text-xs text-muted-foreground">Standardpris</span>}
            </td></tr>)}</tbody>
        </table>
      </div>}
      {canSetPurchasePrices && selectedTenant && products.length > 0 && <div className="max-w-lg space-y-2">
        <Label htmlFor="purchase-price-product">Tilknyt en eksisterende kopi hos lejeren</Label>
        <p className="text-sm text-muted-foreground">Vælg lejerens kopi af dette produkt. Nye kopier tilknyttes automatisk ved distribution.</p>
        <Select value={linkProduct} onValueChange={setLinkProduct} disabled={saving || dirty}>
          <SelectTrigger id="purchase-price-product" className="min-h-11"><SelectValue placeholder="Vælg lejerens produkt" /></SelectTrigger>
          <SelectContent>{products.map(product => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" className="min-h-11" disabled={!linkProduct || saving || dirty} onClick={attachExistingProduct}>Tilknyt indkøbspriser</Button>
      </div>}
      {status && <p role={failed ? 'alert' : 'status'} className="text-sm">{status}</p>}
      <div className="flex flex-wrap gap-2">
        {canSetPurchasePrices && rows.length > 0 && <Button onClick={save} disabled={saving || loading || !dirty} className="min-h-11">{saving ? 'Gemmer…' : 'Gem indkøbspriser'}</Button>}
        {dirty && <Button variant="outline" disabled={saving} onClick={() => { setDraft({}); setStatus(''); setFailed(false); }}>Fortryd ændringer</Button>}
        {failed && <Button variant="outline" disabled={saving} onClick={() => setReload(value => value + 1)}>Genindlæs indkøbspriser</Button>}
      </div>
      <p className="text-xs text-muted-foreground">En ændret indkøbspris ændrer ikke lejerens kundepriser eller beløbet på POD-ordrer, hvor indkøbsprisen allerede er fastlagt.</p>
    </CardContent>
  </Card>;
}
