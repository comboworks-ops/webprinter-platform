import { type ReactNode, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, FileText, User, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrderDesignPreviewSwitch } from './OrderDesignPreviewSwitch';
import '@/styles/orderFlowDesigns.css';

export function OrderFlowSteps({ current, onBack }: { current: 2 | 3; onBack?: () => void }) {
  return <nav className="order-flow-steps" aria-label="Bestillingens trin"><ol>
    {['Bestilling', 'Fil og levering', 'Betaling'].map((label, i) => <li key={label} aria-current={current === i + 1 ? 'step' : undefined}>
      <span className="order-step-number">{i + 1 < current ? <Check size={15} /> : i + 1}</span>
      {i === 0 && onBack ? <button type="button" onClick={onBack}>{label}</button> : <span>{label}</span>}
    </li>)}
  </ol></nav>;
}

export function OrderCheckoutLayout({ design, contact, file, summary, extras, onBack, contactSummary, delivery, deliverySummary, advanced }: {
  design: number; contact: ReactNode; file: ReactNode; summary: ReactNode; extras?: ReactNode;
  onBack: () => void; contactSummary?: string;
  delivery?: ReactNode; deliverySummary?: string; advanced?: ReactNode;
}) {
  const [contactOpen, setContactOpen] = useState(!contactSummary);
  return <>
    <OrderFlowSteps current={2} onBack={onBack} />
    <div className="order-checkout-grid">
      <div className="order-checkout-content">
        <div className="order-page-heading"><h1>{design === 6 ? 'Klar til næste skridt' : 'Gør din bestilling klar.'}</h1><p>Tjek din fil og vælg levering, så er du klar til at gennemføre din bestilling.</p></div>
        {design === 6 ? <>
          <details className="order-guided-section" open={contactOpen} onToggle={event => setContactOpen(event.currentTarget.open)}>
            <summary><User /><span><strong>Kontakt & modtager</strong>{contactSummary && <small>{contactSummary}</small>}</span><ChevronDown /></summary>
            {contact}
          </details>
          <details className="order-guided-section" open>
            <summary><FileText /><span><strong>Din trykfil</strong><small>Upload og tjek din fil, før du godkender.</small></span><ChevronDown /></summary>
            {file}
          </details>
          {delivery && <details className="order-guided-section">
            <summary><Truck /><span><strong>Leveringsmetode</strong><small>{deliverySummary}</small></span><ChevronDown /></summary>
            <div className="order-guided-delivery">{delivery}</div>
          </details>}
          {advanced}
        </> : <><section className="order-checkout-file">{file}</section><section className="order-checkout-contact">{contact}</section></>}
        {extras}
      </div>
      <aside className="order-checkout-summary" aria-label="Din bestilling">{summary}</aside>
    </div>
  </>;
}

export type OrderReceiptData = {
  productName: string; imageUrl?: string | null; format?: string; variant?: string;
  quantity: number; fileName?: string | null; subtotal: number; shipping: number; total: number;
};

export function OrderReceipt({ data, showHeading = true, detailed = false }: { data: OrderReceiptData; showHeading?: boolean; detailed?: boolean }) {
  const money = (value: number) => `${value.toLocaleString('da-DK')} kr`;
  return <div className="order-receipt">
    {showHeading && <h2>Din bestilling</h2>}
    {!detailed && <div className="order-receipt-product">
      {data.imageUrl && <img src={data.imageUrl} alt={data.productName} />}
      <div><h3>{data.productName}</h3><p>{data.format}</p><p>{data.variant}</p><p>{data.quantity} stk</p></div>
    </div>}
    {detailed && <dl className="order-receipt-details"><div><dt>Produkt</dt><dd>{data.productName}</dd></div><div><dt>Størrelse</dt><dd>{data.format}</dd></div><div><dt>Materiale</dt><dd>{data.variant}</dd></div><div><dt>Antal</dt><dd>{data.quantity} stk</dd></div></dl>}
    {data.fileName && <div className="order-receipt-file"><FileText size={18} /><span>{data.fileName}</span></div>}
    <dl><div><dt>Produkt</dt><dd>{money(data.subtotal)}</dd></div><div><dt>Levering</dt><dd>{money(data.shipping)}</dd></div><div className="order-receipt-total"><dt>Samlet beløb</dt><dd>{money(data.total)}</dd></div></dl>
  </div>;
}

/** The payment processor stays in the supplied form slot. This component never submits a payment. */
export function OrderPaymentLayout({ design, receipt, form, onBack }: {
  design: number; receipt: OrderReceiptData; form: ReactNode; onBack: () => void;
}) {
  return <div className="order-payment-page" data-order-design={design}>
    <OrderFlowSteps current={3} onBack={onBack} />
    <OrderDesignPreviewSwitch page="payment" value={design} />
    <div className="order-payment-grid"><section className="order-payment-content">
      <h1>{design === 15 ? 'Afslut din bestilling' : 'Betaling'}</h1>
      <p className="order-payment-intro">Betal sikkert med dit betalingskort.</p>{form}
    </section><aside><OrderReceipt data={receipt} /></aside></div>
  </div>;
}

export function OrderConfirmationLayout({ design, receipt, orderNumber, message, notices, onHome, warning = false }: {
  design: number; receipt: OrderReceiptData; orderNumber?: string | null; message: string;
  notices?: ReactNode; onHome: () => void; warning?: boolean;
}) {
  if (design === 16) return <div className="order-confirmation-page" data-order-design={design}>
    <OrderDesignPreviewSwitch page="confirmation" value={design} />
    <section className="order-confirmation-greeting">
      <CheckCircle2 className="order-success-icon" />
      <h1>{warning ? 'Din betaling er modtaget' : 'Tak for din bestilling'}</h1>
      <p>{message}</p>
      {orderNumber && <p className="order-confirmation-number">Ordrenummer: <strong>{orderNumber}</strong></p>}
      {notices}
    </section>
    <div className="order-confirmation-receipt-grid">
      <section><OrderReceipt data={receipt} detailed /></section>
      <aside className="order-confirmation-next">
        {receipt.imageUrl && <img src={receipt.imageUrl} alt={receipt.productName} />}
        <h2>Hvad sker der nu?</h2><p>Gem dit ordrenummer, hvis du får brug for at kontakte os.</p>
        <Button className="order-home-action" onClick={onHome}>Tilbage til forsiden <ArrowRight size={17} /></Button>
      </aside>
    </div>
  </div>;
  return <div className="order-confirmation-page" data-order-design={design}>
    <OrderDesignPreviewSwitch page="confirmation" value={design} />
    <div className="order-confirmation-grid"><section className="order-confirmation-greeting">
      <CheckCircle2 className="order-success-icon" />
      <h1>{warning ? 'Din betaling er modtaget' : design === 18 ? 'Tak. Din ordre er modtaget.' : 'Tak for din bestilling'}</h1>
      <p>{message}</p>
      {orderNumber && <p className="order-confirmation-number">Ordrenummer: <strong>{orderNumber}</strong></p>}
      {notices}
      <Button className="order-home-action" onClick={onHome}>Tilbage til forsiden <ArrowRight size={17} /></Button>
    </section><section className="order-confirmation-receipt"><OrderReceipt data={receipt} /></section></div>
  </div>;
}

/** Full-screen Radix dialog retains focus trapping, Escape and accessible naming. */
export function OrderFlowDialog({ open, onClose, title, children, design, shopName }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; design: number; shopName: string;
}) {
  const id = useId();
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="order-flow-dialog" data-order-design={design} aria-describedby={id}>
      <DialogHeader className="order-flow-dialog-header">
        <div className="order-dialog-brand">{shopName}</div>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription id={id} className="sr-only">{title}</DialogDescription>
        <Button type="button" variant="ghost" onClick={onClose}><ArrowLeft size={16} /> Tilbage</Button>
      </DialogHeader>{children}
    </DialogContent>
  </Dialog>;
}

export function ProofReviewLayout({ design, canvas, status }: { design: number; canvas: ReactNode; status: ReactNode }) {
  return <div className="order-proof-grid">{canvas}{status}</div>;
}
