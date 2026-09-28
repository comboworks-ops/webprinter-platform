/** Local visual review only. No payment SDK, upload handler, order API or hosted writes. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, Lock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderFlowDialog, OrderPaymentLayout, OrderConfirmationLayout, ProofReviewLayout, type OrderReceiptData } from '@/components/checkout/OrderFlowLayouts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { OrderDesignPreviewSwitch } from '@/components/checkout/OrderDesignPreviewSwitch';
import { OrderFlowDesignPicker } from '@/components/admin/OrderFlowDesignPicker';
import { applyOrderFlowDesign, resolveOrderFlowDesign, type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';
import '@/index.css';
import '@/styles/orderFlowDesigns.css';

const receipt: OrderReceiptData = {
  productName: 'Aluminium Skilte', imageUrl: 'https://ziattmsmiirfweiuunfo.supabase.co/storage/v1/object/public/product-images/6c546267-6585-4465-a4fe-857e3d343612-1772242969899.png',
  format: '100 × 100 cm', variant: 'Hvid alu-plade 3 mm', quantity: 1,
  fileName: 'skilt-demo.pdf', subtotal: 436, shipping: 129, total: 565,
};
const tenant = 'tenantId=00000000-0000-0000-0000-000000000000';

function SamplePaymentForm() {
  return <div className="order-sample-payment"><h2>Kortbetaling</h2>
    <p className="order-preview-note">Visuelt eksempel · kortfelterne nedenfor er inaktive. Den rigtige checkout bruger Stripe.</p>
    <fieldset disabled><label>Kortnummer<input placeholder="1234 1234 1234 1234" /></label>
      <div className="order-sample-payment-row"><label>Udløbsdato<input placeholder="MM / ÅÅ" /></label><label>CVC<input placeholder="123" /></label></div>
      <label>Korthaver<input placeholder="Navn på kortet" /></label><label>Land<select defaultValue="DK"><option value="DK">Danmark</option></select></label>
    </fieldset>
    <p className="order-sample-lock"><Lock size={13} /> Ingen betaling kan gennemføres her.</p>
    <Button disabled className="w-full">Betal 565 kr · eksempel</Button>
  </div>;
}

function Preview() {
  const [params, setParams] = useSearchParams();
  const [settings, setSettings] = useState<{ themeSettings?: Record<string, unknown> }>({});
  const [approved, setApproved] = useState(false);
  const page = params.get('page') || '';
  const show = (next: string) => { const p = new URLSearchParams(params); p.set('page', next); p.delete('orderDesign'); setParams(p); };
  const design = (part: OrderFlowPage) => resolveOrderFlowDesign(part, settings, params.get('orderDesign'));
  const back = () => show('');
  return <div className="order-preview-index" data-order-design="1">
    <main><p className="order-preview-kicker">WEBPRINTER · LOKAL DESIGNGENNEMGANG</p><h1>Dine valgte sider</h1>
      <p>Standard og alternativ for hver side i bestillingsflowet. De almindelige produktsider bruger de eksisterende produkter og priser. Korrektur, betaling og bekræftelse nedenfor bruger eksempeldata.</p>
      <div className="order-preview-links">
        <a href={`/produkt/aluminium?${tenant}`}>Produkt & pris · 2 / 1</a>
        <a href={`/checkout/konfigurer?${tenant}`}>Checkout · 6 / 4</a>
        <button onClick={() => show('proof')}>Filkorrektur · 7 / 9</button>
        <a href={`/designer?${tenant}&productId=6c546267-6585-4465-a4fe-857e3d343612&designerMode=storformat&pricingModel=storformat_area&format=100+x+100+cm&widthMm=1000&heightMm=1000&bleedMm=3&safeMm=2&order=1&returnTo=%2Fcheckout%2Fkonfigurer%3F${tenant}`}>Designer · 12 / 11</a>
        <button onClick={() => show('payment')}>Betaling · 13 / 15</button>
        <button onClick={() => show('confirmation')}>Bekræftelse · 16 / 18</button>
      </div>
      <details className="order-preview-settings"><summary>Prøv designindstillingerne</summary>
        <p>Samme vælger som i Site Design. Ændringer her gælder kun denne forhåndsvisning.</p>
        <OrderFlowDesignPicker branding={settings} onChange={(part, id) => setSettings(current => applyOrderFlowDesign(current, part, id))} />
      </details>
    </main>
    {page === 'payment' && <OrderFlowDialog open onClose={back} title="Betaling – visuelt eksempel" design={design('payment')} shopName="webprinter">
      <OrderPaymentLayout design={design('payment')} receipt={receipt} onBack={back} form={<SamplePaymentForm />} />
    </OrderFlowDialog>}
    {page === 'confirmation' && <OrderFlowDialog open onClose={back} title="Bekræftelse – visuelt eksempel" design={design('confirmation')} shopName="webprinter">
      <OrderConfirmationLayout design={design('confirmation')} receipt={receipt} orderNumber="DEMO-1042" message="Eksempel på den bekræftelse, kunden ser efter en bestilling." onHome={back} notices={<p className="order-preview-note">Demovisning · ingen ordre er oprettet.</p>} />
    </OrderFlowDialog>}
    {page === 'proof' && <Dialog open onOpenChange={open => { if (!open) back(); }}><DialogContent className="order-proof-dialog" data-order-design={design('proof')}>
      <DialogHeader><DialogTitle>Filkorrektur</DialogTitle><DialogDescription>Visuelt eksempel · ingen kundeﬁl er uploadet.</DialogDescription></DialogHeader>
      <OrderDesignPreviewSwitch page="proof" value={design('proof')} />
      <ProofReviewLayout design={design('proof')} canvas={<div className="order-proof-canvas">
        <div className="order-sample-filebar"><span><FileText size={16} /> skilt-demo.pdf · Side 1 af 1</span><Button variant="ghost" size="sm" onClick={() => setApproved(false)}><RotateCcw size={14} /> Nulstil</Button></div>
        <div className="mx-auto"><img className="order-sample-proof-art" src="/design-presets/order-flow/sample-artwork.webp" alt="Eksempel på en trykfil med WP-motiv" /></div>
        <p className="order-preview-note">Motivet er et eksempel. Den rigtige korrektur viser filens mål, udfald og sikkerhedszone.</p>
      </div>} status={<div className="order-proof-status order-sample-proof-status">
        <h2>Tjek din fil</h2><p><CheckCircle2 /> Originalfil: OK <small>Eksempel på en kontrolleret fil.</small></p><p><CheckCircle2 /> Placering: OK <small>Kontrollér selv motivet før godkendelse.</small></p>
        <dl><div><dt>Bestilt format</dt><dd>1000 × 1000 mm</dd></div><div><dt>Filformat</dt><dd>1006 × 1006 mm</dd></div><div><dt>Udfald</dt><dd>3 mm</dd></div><div><dt>Sikkerhedsafstand</dt><dd>2 mm</dd></div></dl>
        <p className="order-preview-note">Farver på skærmen er vejledende.</p>
        <Button onClick={() => setApproved(true)}>{approved ? 'Eksemplet er godkendt' : 'Godkend fil · eksempel'}</Button><Button variant="outline" onClick={back}>Luk korrektur</Button>
      </div>} />
    </DialogContent></Dialog>}
  </div>;
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<BrowserRouter><Preview /></BrowserRouter>);
