import { StorefrontPrimaryButton } from "@/components/storefront/StorefrontPrimaryButton";
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Image, MousePointer2, Square, Type, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrderFlowDesign } from '@/hooks/useOrderFlowDesign';
import { type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';
import { getOrderFlowPreviewPath } from '@/lib/preview/orderFlowPreview';
import {
  OrderCheckoutLayout, OrderPaymentLayout, OrderConfirmationLayout, OrderReceipt,
  ProofReviewLayout, type OrderReceiptData,
} from '@/components/checkout/OrderFlowLayouts';
import '@/styles/siteDesignOrderFlowPreview.css';

const receipt: OrderReceiptData = {
  productName: 'Eksempelprodukt', format: 'A4 · 210 × 297 mm', variant: '170 g papir',
  quantity: 100, fileName: 'trykfil-eksempel.pdf', subtotal: 400, shipping: 49, total: 561.25,
  tax: { policy: 'dk-domestic-v1', sellerCountry: 'DK', deliveryCountry: 'DK', rateBps: 2500, netAmountOre: 44900, vatAmountOre: 11225, grossAmountOre: 56125 },
};
const artwork = '/design-presets/order-flow/sample-artwork.webp';

/** Uses customer layout components with example content. No checkout state,
 * payment SDK, file upload, design save or backend mutation is mounted here. */
export function SiteDesignOrderFlowPreview({ page, shopName, onNavigate }: {
  page: Exclude<OrderFlowPage, 'calculator'>; shopName: string; onNavigate: (path: string) => void;
}) {
  const design = useOrderFlowDesign(page);
  const go = (step: Exclude<OrderFlowPage, 'calculator'>) => onNavigate(getOrderFlowPreviewPath(step));
  return <section className="sd-order-preview" data-preview-order-step={page} data-order-design={design}>
    <p className="sd-order-preview-notice" role="note">Forhåndsvisning med eksempeldata · dine layoutvalg følger med, når du publicerer shopdesignet.</p>
    {page === 'checkout' && <main className="storefront-order-flow storefront-checkout-flow">
      <OrderCheckoutLayout design={design} onBack={() => onNavigate('/produkter')}
        contact={<section className="order-contact-card"><div><h2>Kontakt & modtager</h2></div><div className="sd-preview-fields">
          <label>Navn<input defaultValue="Eksempelkunde" autoComplete="off" /></label>
          <label>Email<input value="kunde@example.test" readOnly /></label>
          <label>Adresse<input value="Eksempelvej 1" readOnly /></label>
          <label>Postnummer og by<input value="8000 Aarhus C" readOnly /></label>
        </div></section>}
        file={<section className="order-file-card"><div><h2>Din trykfil</h2></div><div>
          <div className="sd-preview-upload"><Upload /><strong>Upload din trykfil</strong><p>Her kan kunden tilføje sin PDF og kontrollere den før bestilling.</p></div>
          <Button variant="outline" onClick={() => go('proof')}>Se filkorrektur</Button>
          <Button variant="ghost" onClick={() => go('designer')}>Se designer</Button>
        </div></section>}
        delivery={<p>Levering til adresse · 49 kr ekskl. moms</p>}
        deliverySummary="Levering til adresse"
        summary={<><OrderReceipt data={receipt} />{design === 4 && <p className="order-selected-delivery">Levering til adresse · 49 kr</p>}
          <StorefrontPrimaryButton className="mt-6 w-full" onClick={() => go('payment')}>Se betaling</StorefrontPrimaryButton></>}
      />
    </main>}
    {page === 'proof' && <div className="order-proof-dialog sd-inline-order-dialog" data-order-design={design}>
      <div><h2>Filkorrektur</h2><p>Kontrollér din trykfil</p></div>
      <ProofReviewLayout design={design}
        canvas={<div className="order-proof-canvas"><p className="order-sample-filebar"><FileText size={18} /> trykfil-eksempel.pdf · Side 1 af 1</p>
          <div className="mx-auto"><img className="order-sample-proof-art" src={artwork} alt="Eksempel på en trykfil" /></div>
        </div>}
        status={<div className="order-proof-status order-sample-proof-status"><h2>Tjek din fil</h2>
          <p><CheckCircle2 /> Eksempel på filkontrol<small>Den rigtige korrektur viser resultatet for kundens fil.</small></p>
          <dl><div><dt>Bestilt format</dt><dd>210 × 297 mm</dd></div><div><dt>Udfald</dt><dd>3 mm</dd></div></dl>
          <StorefrontPrimaryButton onClick={() => go('checkout')}>Tilbage til checkout</StorefrontPrimaryButton>
        </div>}
      />
    </div>}
    {page === 'designer' && <DesignerLayoutExample design={design} onBack={() => go('checkout')} />}
    {(page === 'payment' || page === 'confirmation') && <div className="order-flow-dialog sd-inline-order-dialog" data-order-design={design}>
      <header className="order-flow-dialog-header"><div className="order-dialog-brand">{shopName}</div><Button variant="ghost" onClick={() => go('checkout')}><ArrowLeft size={16} /> Tilbage</Button></header>
      {page === 'payment' ? <OrderPaymentLayout design={design} receipt={receipt} onBack={() => go('checkout')}
        form={<div className="order-sample-payment"><h2>Kortbetaling</h2><fieldset disabled>
          <label>Kortnummer<input placeholder="1234 1234 1234 1234" /></label>
          <div className="order-sample-payment-row"><label>Udløbsdato<input placeholder="MM / ÅÅ" /></label><label>CVC<input placeholder="123" /></label></div>
          <label>Korthaver<input placeholder="Navn på kortet" /></label>
          <StorefrontPrimaryButton disabled>Betal 561,25 kr</StorefrontPrimaryButton>
        </fieldset><p className="order-preview-note">Kortfelterne er inaktive i forhåndsvisningen.</p><Button variant="outline" onClick={() => go('confirmation')}>Se bekræftelse</Button></div>}
      /> : <OrderConfirmationLayout design={design} receipt={receipt} orderNumber="EKSEMPEL-1042"
        message="Sådan vises bekræftelsen, når kundens ordre er oprettet."
        notices={<p className="order-preview-note">Eksempel · ingen ordre er oprettet.</p>} onHome={() => onNavigate('/')}
      />}
    </div>}
  </section>;
}

/** The same layout classes as the real Designer; example canvas only. */
function DesignerLayoutExample({ design, onBack }: { design: number; onBack: () => void }) {
  const [text, setText] = useState('Dit design');
  return <div className="order-designer sd-designer-example flex flex-col" data-order-design={design}>
    <div data-designer-toolbar className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
      <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Tilbage</Button><h1>A4 · Eksempeldesign</h1><StorefrontPrimaryButton disabled>Fortsæt til checkout</StorefrontPrimaryButton>
    </div>
    <div className="order-designer-metadata">210 × 297 mm · 3 mm udfald · layout med eksempelmotiv</div>
    <div className="order-designer-workspace flex-1">
      <aside className="order-designer-tools flex border-r bg-white"><div className="flex flex-col">
        {([{ label: 'Vælg', Icon: MousePointer2 }, { label: 'Tekst', Icon: Type }, { label: 'Billede', Icon: Image }, { label: 'Figur', Icon: Square }]).map(({ label, Icon }) =>
          <Button key={label} variant="ghost" disabled><Icon size={18} /><span className="order-designer-tool-label">{label}</span></Button>
        )}
      </div></aside>
      <main className="sd-designer-example-canvas"><div><img src={artwork} alt="Eksempelmotiv på designerens arbejdsflade" /><p>{text}</p></div></main>
      <aside className="order-designer-inspector flex bg-white"><section className="p-5"><h2>Egenskaber</h2><label className="sd-designer-example-text">Eksempeltekst<input value={text} onChange={event => setText(event.target.value)} /></label><p className="order-preview-note">Visning af layout. Kundens værktøjer og trykfil åbnes i den rigtige designer.</p></section></aside>
    </div>
  </div>;
}
