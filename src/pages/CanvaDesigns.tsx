import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CustomerAccountProvider, useCustomerAccount } from '@/components/account/CustomerAccountContext';
import { StorefrontThemeFrame } from '@/components/storefront/StorefrontThemeFrame';
import { consumeSiteCheckoutTransfer, readSiteCheckoutSession, writeSiteCheckoutSession, type SiteCheckoutState } from '@/lib/checkout/siteCheckoutSession';
import { canvaWorkflow, importCanvaPdf, type CanvaDraft } from '@/lib/canva/workflow';
import { CANVA_TEMPLATES, CANVA_FIELDS, CANVA_PHOTO_LIMIT, validateCanvaText, type CanvaText } from '../../shared/canva';

const RETURN_SHOP_KEY = 'wp_canva_return_shop';
const emptyText = () => Object.fromEntries(CANVA_FIELDS.map(field => [field.key, ''])) as CanvaText;

/** Restore shop routing only; neither OAuth nor return query parameters confer ownership. */
export default function CanvaDesignsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const isReturn = params.has('code') || params.has('correlation_jwt') || params.has('error');
  const remembered = isReturn ? sessionStorage.getItem(RETURN_SHOP_KEY) : null;
  const needsRestore = !!remembered && !params.has('tenantId');
  useEffect(() => {
    if (!needsRestore) return;
    const next = new URLSearchParams(location.search);
    for (const [key,value] of new URLSearchParams(remembered!)) if (['tenantId','force_domain','tenant_subdomain'].includes(key)) next.set(key,value);
    navigate(`/canva-designs?${next}`, { replace: true });
  }, [needsRestore, remembered, location.search, navigate]);
  if (needsRestore) return <p className="p-8" role="status">Åbner din shop…</p>;
  return <CustomerAccountProvider><CanvaDesigns /></CustomerAccountProvider>;
}

function CanvaDesigns() {
  const account = useCustomerAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const tenantId = account.shop?.id || '';
  const userId = account.user?.id || '';
  const scopeKey = `wp_canva_draft:${userId}:${tenantId}`;
  const [connected, setConnected] = useState(false);
  const [drafts, setDrafts] = useState<CanvaDraft[]>([]);
  const [draft, setDraft] = useState<CanvaDraft | null>(null);
  const [templateKey, setTemplateKey] = useState<string>('');
  const [templateKeys, setTemplateKeys] = useState<string[]>([]);
  const [text, setText] = useState<CanvaText>(emptyText);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const initialized = useRef('');
  const requestId = useRef(crypto.randomUUID());
  const [checkout, setCheckout] = useState<SiteCheckoutState | null>(() => {
    const params = new URLSearchParams(location.search);
    // Only a deliberate product-page entry consumes the cross-tab transfer.
    return params.has('productId') ? consumeSiteCheckoutTransfer() || readSiteCheckoutSession() : null;
  });
  const entrySearch = useRef(location.search);
  const entryCheckout = useRef(checkout);
  const shopQuery = new URLSearchParams(location.search);
  for (const key of [...shopQuery.keys()]) if (!['tenantId','force_domain','tenant_subdomain'].includes(key)) shopQuery.delete(key);
  if (tenantId) shopQuery.set('tenantId', tenantId);
  const shopSearch = shopQuery.toString();

  useEffect(() => {
    if (!photo) { setPhotoUrl(''); return; }
    const url = URL.createObjectURL(photo); setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (!tenantId || !userId || account.loading || initialized.current === scopeKey) return;
    initialized.current = scopeKey;
    let cancelled = false;
    const run = async () => {
      setBusy('Henter dine designs…'); setError('');
      setDraft(null); setConnected(false); setText(emptyText()); setPhoto(null);
      const params = new URLSearchParams(entrySearch.current);
      const returnShop = new URLSearchParams();
      for (const key of ['force_domain','tenant_subdomain']) if (params.has(key)) returnShop.set(key, params.get(key)!);
      returnShop.set('tenantId', tenantId);
      const shopSearch = returnShop.toString();
      sessionStorage.setItem(RETURN_SHOP_KEY, shopSearch);
      try {
        const savedCheckout = sessionStorage.getItem(`${scopeKey}:checkout`);
        const selectedCheckout = params.has('productId') ? entryCheckout.current : savedCheckout ? JSON.parse(savedCheckout) as SiteCheckoutState : null;
        if (selectedCheckout) {
          setCheckout(selectedCheckout);
          sessionStorage.setItem(`${scopeKey}:checkout`, JSON.stringify(selectedCheckout));
        }
        if (params.has('error')) throw new Error('Canva-forbindelsen blev afbrudt. Du kan prøve igen.');
        if (params.has('code')) await canvaWorkflow(tenantId, { action: 'callback', code: params.get('code'), state: params.get('state') });
        // Deliberately do not decode or trust correlation_jwt. Fetch only this signed-in customer's stored drafts.
        const status = await canvaWorkflow(tenantId, { action: 'status' });
        if (cancelled) return;
        setConnected(!!status.connected); setDrafts(status.drafts || []);
        const current = sessionStorage.getItem(scopeKey);
        if (!params.has('productId') && current) setDraft(status.drafts?.find(item => item.id === current) || null);
        if (selectedCheckout?.productId) {
          const catalog = await canvaWorkflow(tenantId, { action: 'catalog', productId: selectedCheckout.productId, widthMm: selectedCheckout.designWidthMm, heightMm: selectedCheckout.designHeightMm });
          if (cancelled) return;
          setTemplateKeys(catalog.templateKeys || []); setTemplateKey(catalog.templateKeys?.[0] || '');
        }
        if (params.has('correlation_jwt')) setNotice('Velkommen tilbage. Hent dit design for at se den seneste version fra Canva.');
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Dine designs kunne ikke hentes.'); }
      finally {
        if (!cancelled) {
          setBusy('');
          if (params.has('code') || params.has('error') || params.has('correlation_jwt')) navigate(`/canva-designs?${shopSearch}`, { replace: true });
        }
      }
    };
    void run();
    return () => { cancelled = true; initialized.current = ''; };
    // Initialization follows the authenticated customer/shop; query cleanup must not re-exchange a code.
  }, [scopeKey, account.loading, tenantId, userId, navigate]);

  const perform = async (message: string, action: () => Promise<void>) => {
    setBusy(message); setError(''); setNotice('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Handlingen kunne ikke gennemføres.'); }
    finally { setBusy(''); }
  };
  const loadDraft = async (id: string) => {
    const result = await canvaWorkflow(tenantId, { action: 'progress', id });
    const loaded = result as CanvaDraft;
    setDraft(loaded); sessionStorage.setItem(scopeKey, id);
    return loaded;
  };
  // Persisted jobs are polled, never recreated. Stop after a bounded wait; the customer can resume later.
  const waitForDraft = async (id: string) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const result = await loadDraft(id);
      if (result.status === 'failed') throw new Error(result.message || 'Designet kunne ikke oprettes.');
      if (result.status === 'ready') return;
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    setNotice('Canva arbejder stadig. Brug Opdatér status om lidt. Din kopi er gemt.');
  };

  if (account.loading) return <p className="p-8" role="status">Åbner din konto…</p>;
  if (account.error || !account.shop || !account.user) return <div className="p-8"><p role="alert">{account.error || 'Log ind for at fortsætte.'}</p><Button onClick={account.retry}>Prøv igen</Button></div>;
  const available = CANVA_TEMPLATES.filter(template => templateKeys.includes(template.key));
  const ready = draft?.status === 'ready';
  const activeCheckout = draft?.checkout;
  return <StorefrontThemeFrame branding={account.shop.branding} tenantName={String(account.shop.name || 'Din shop')}>
    <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div><h1 className="text-3xl font-semibold">Dit design i Canva</h1><p className="mt-2 text-muted-foreground">Vælg et design · Tilføj din tekst og dit foto · Redigér i Canva · Hent tilbage</p></div>
      {error && <div role="alert" className="rounded-md border border-destructive p-4 text-destructive">{error}</div>}
      {notice && <p role="status" className="rounded-md border p-4">{notice}</p>}
      {busy && <p role="status" aria-live="polite" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}
      {!connected && <Card><CardHeader><CardTitle>Forbind din Canva-konto</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>Du får din egen kopi. Din tekst og dit foto sendes til Canva, når du opretter designet. Autofill kræver en Canva-konto med adgang til funktionen og skabelonen.</p>
        <Button disabled={!!busy} onClick={() => void perform('Åbner Canva…', async () => {
          sessionStorage.setItem(RETURN_SHOP_KEY, shopSearch);
          const result = await canvaWorkflow(tenantId, { action: 'connect' });
          if (result.url) window.location.assign(result.url);
        })}>Forbind Canva</Button>
      </CardContent></Card>}
      {connected && !draft && <>
        <Card><CardHeader><CardTitle>1. Vælg dit design</CardTitle></CardHeader><CardContent>
          {available.length ? <div className="grid gap-4 sm:grid-cols-2">{available.map(template => <button key={template.key} type="button" disabled={!!busy}
            aria-pressed={templateKey === template.key} onClick={() => setTemplateKey(template.key)} className={`rounded-lg border-2 p-4 text-left ${templateKey === template.key ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <img src={template.image} alt={`${template.name} – eksempel på layout`} className="mx-auto h-56 max-w-full object-contain" />
            <span className="mt-3 block font-medium">{template.name}</span><span className="text-sm text-muted-foreground">A5 · 148 × 210 mm · Eksempel</span>
          </button>)}</div> : <p>Vælg et produkt med Canva-designs og formatet A5, stående, for at oprette et nyt design.</p>}
        </CardContent></Card>
        {available.length > 0 && <Card><CardHeader><CardTitle>2. Din tekst og dit foto</CardTitle></CardHeader><CardContent>
          <form className="space-y-5" onSubmit={event => { event.preventDefault(); void perform('Opretter din egen Canva-kopi…', async () => {
            const values = validateCanvaText(text);
            if (!photo || !['image/jpeg','image/png'].includes(photo.type) || photo.size > CANVA_PHOTO_LIMIT) throw new Error('Vælg et JPG- eller PNG-foto på højst 8 MB.');
            const id = requestId.current;
            const result = await canvaWorkflow(tenantId, { action: 'create', id, productId: checkout?.productId, templateKey, text: values, checkout }, photo);
            if (!result.id) throw new Error('Designet kunne ikke oprettes.');
            sessionStorage.setItem(scopeKey, id);
            await waitForDraft(id);
          }); }}>
            <div className="grid gap-4 sm:grid-cols-2">{CANVA_FIELDS.map(field => <div key={field.key} className={field.key === 'supporting_text' ? 'sm:col-span-2' : ''}>
              <Label htmlFor={`canva-${field.key}`}>{field.label}</Label>
              <Textarea id={`canva-${field.key}`} required disabled={!!busy} value={text[field.key]} maxLength={field.max} rows={field.lines}
                onChange={event => setText(previous => ({ ...previous, [field.key]: event.target.value }))} aria-describedby={`count-${field.key}`} />
              <p id={`count-${field.key}`} className="mt-1 text-xs text-muted-foreground">{Array.from(text[field.key]).length}/{field.max} tegn · højst {field.lines} linje(r)</p>
            </div>)}</div>
            <div><Label htmlFor="canva-photo">Dit foto (JPG eller PNG, højst 8 MB)</Label><Input id="canva-photo" type="file" accept="image/jpeg,image/png" required disabled={!!busy} onChange={event => setPhoto(event.target.files?.[0] || null)} /></div>
            {photoUrl && <img src={photoUrl} alt="Dit valgte foto" className="max-h-48 max-w-full rounded-md object-contain" />}
            <p className="text-sm text-muted-foreground">Kontrollér linjeskift, beskæring og læsbarhed i Canva. Tegngrænserne hjælper teksten med at passe.</p>
            <Button type="submit" disabled={!!busy}>Opret min kopi</Button>
          </form>
        </CardContent></Card>}
      </>}
      {draft && <Card><CardHeader><CardTitle>3. Dit gemte design</CardTitle></CardHeader><CardContent className="space-y-4">
        <p>{CANVA_TEMPLATES.find(template => template.key === draft.templateKey)?.name || 'Dit design'} · {ready ? 'Klar til redigering' : draft.status === 'failed' ? 'Kunne ikke oprettes' : 'Under behandling'}</p>
        {draft.message && <p role="alert">{draft.message}</p>}
        <div className="flex flex-wrap gap-3">
          <Button disabled={!!busy || !ready} onClick={() => void perform('Åbner din kopi i Canva…', async () => {
            sessionStorage.setItem(scopeKey, draft.id); sessionStorage.setItem(RETURN_SHOP_KEY, shopSearch);
            const result = await canvaWorkflow(tenantId, { action: 'edit', id: draft.id });
            if (result.url) window.location.assign(result.url);
          })}>Redigér i Canva <ExternalLink className="ml-2 h-4 w-4" /></Button>
          <Button variant="outline" disabled={!!busy} onClick={() => void perform('Henter status…', async () => { await loadDraft(draft.id); })}>Opdatér status</Button>
          <Button disabled={!!busy || !ready} onClick={() => void perform('Henter dit design fra Canva…', async () => {
            const current = await loadDraft(draft.id);
            if (!current.checkout?.productId) throw new Error('Produktvalget mangler. Gå tilbage til produktet.');
            const exportRequestId = crypto.randomUUID();
            await canvaWorkflow(tenantId, { action: 'export_start', id: draft.id, exportRequestId });
            for (let attempt = 0; attempt < 30; attempt++) {
              const result = await canvaWorkflow(tenantId, { action: 'export', id: draft.id, exportRequestId });
              if (result.ready) {
                const next = await importCanvaPdf(tenantId, draft.id, exportRequestId, current.checkout);
                writeSiteCheckoutSession(next);
                navigate(`/checkout/konfigurer?${shopSearch}`, { state: next }); return;
              }
              await new Promise(resolve => setTimeout(resolve, 2500));
            }
            setNotice('PDF-eksporten arbejder stadig. Hent den igen om lidt.');
          })}>Hent tilbage og kontrollér fil</Button>
        </div>
        <p className="text-sm text-muted-foreground">Filen skal kontrolleres og godkendes i WebPrinter før bestilling. En hentet PDF er ikke automatisk klar til tryk.</p>
        <Button variant="ghost" disabled={!!busy} onClick={() => { setDraft(null); requestId.current = crypto.randomUUID(); }}>Vælg et andet design</Button>
      </CardContent></Card>}
      {drafts.length > 0 && <Card><CardHeader><CardTitle>Dine seneste designs</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{drafts.map(item => <Button key={item.id} variant="outline" disabled={!!busy} onClick={() => void perform('Åbner dit design…', async () => { await loadDraft(item.id); })}>{CANVA_TEMPLATES.find(template => template.key === item.templateKey)?.name || 'Design'} · {item.id.slice(0,6)}</Button>)}</CardContent></Card>}
      {connected && <Button variant="ghost" disabled={!!busy} onClick={() => setConnected(false)}>Forbind Canva igen</Button>}
      <Button variant="ghost" onClick={() => navigate(activeCheckout?.productSlug ? `/produkt/${encodeURIComponent(activeCheckout.productSlug)}?${shopSearch}` : checkout?.productSlug ? `/produkt/${encodeURIComponent(checkout.productSlug)}?${shopSearch}` : `/?${shopSearch}`)}><ArrowLeft className="mr-2 h-4 w-4" />Tilbage til shoppen</Button>
    </main>
  </StorefrontThemeFrame>;
}
