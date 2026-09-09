import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCheck, ChevronRight, Download, FileText, Loader2, MessageCircle, Package, Search, Send, Truck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AccountState } from '@/components/account/AccountShell';
import { filterCustomerOrders, formatOrderDate, orderConfiguration, orderStatus, reorderProductHref, safeOrderDocumentUrl, safeProductImageUrl, type CustomerOrder, type CustomerOrderDetails, type OrderSection } from '@/lib/account/orders';
import '@/styles/customerOrders.css';

export type { CustomerOrder, CustomerOrderDetails } from '@/lib/account/orders';
export interface CustomerOrdersViewProps {
  orders: CustomerOrder[];
  selectedOrderId: string | null;
  onSelectOrder: (id: string | null) => void;
  details: CustomerOrderDetails;
  onRetryDetails: () => void;
  link: (href: string) => string;
  onSendMessage?: (orderId: string, message: string) => Promise<boolean>;
  onOpenConversation?: (orderId: string) => void;
  onUploadFile?: (orderId: string, file: File) => Promise<boolean>;
  sending?: boolean;
  uploading?: boolean;
  messageError?: string | null;
  uploadError?: string | null;
  productLookupError?: string | null;
}

function StatusBadge({ order }: { order: CustomerOrder }) {
  const status = orderStatus(order);
  return <span className={`co-status co-status--${status.tone}`}><span aria-hidden="true" />{status.label}</span>;
}

function ProductPicture({ order, large = false }: { order: CustomerOrder; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = safeProductImageUrl(order.product?.image_url);
  useEffect(() => setBroken(false), [src]);
  return <div className={`co-product-picture${large ? ' co-product-picture--large' : ''}`}>
    {src && !broken ? <img src={src} alt={`${order.product_name} – produktbillede`} onError={() => setBroken(true)} /> : <Package aria-label="Produktbillede ikke tilgængeligt" />}
  </div>;
}

function SectionContent<T>({ section, onRetry, children, label }: { section: OrderSection<T>; onRetry: () => void; children: (data: T) => ReactNode; label: string }) {
  if (section.status === 'loading') return <p className="co-section-state" role="status"><Loader2 className="animate-spin" />Henter {label}…</p>;
  if (section.status === 'error') return <div className="co-section-error" role="alert"><p>{section.error}</p><Button variant="outline" size="sm" onClick={onRetry}>Prøv igen</Button></div>;
  return <>{children(section.data)}</>;
}

const trackingLabels: Record<string, string> = {
  order_placed: 'Ordre modtaget', processing: 'Behandles', in_production: 'I produktion', quality_check: 'Kvalitetskontrol', packed: 'Pakket', picked_up: 'Afhentet af fragtfirma', in_transit: 'Undervejs', out_for_delivery: 'Ude til levering', delivered: 'Leveret',
};

function OrderDetail({ order, ...props }: CustomerOrdersViewProps & { order: CustomerOrder }) {
  const [draft, setDraft] = useState('');
  const [conversationOpen, setConversationOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [order.id]);
  const { details, link, onRetryDetails } = props;
  const configuration = orderConfiguration(order);
  const reorderHref = reorderProductHref(order);
  const latestAdmin = details.messages.status === 'ready' ? [...details.messages.data].reverse().find(message => message.sender_type === 'admin') : null;
  const currency = /^[A-Z]{3}$/.test(order.currency || '') ? order.currency! : 'DKK';
  const price = new Intl.NumberFormat('da-DK', { style: 'currency', currency }).format(order.total_price);

  return <section className="co-detail" aria-label={`Ordre ${order.order_number}`}>
    <button className="co-back" onClick={() => props.onSelectOrder(null)}><ArrowLeft />Til mine ordrer</button>
    <header className="co-detail-header">
      <ProductPicture order={order} large />
      <div><p className="co-order-number">{order.order_number}</p><h2 ref={heading} tabIndex={-1}>{order.product_name}</h2><p className="co-muted">{order.quantity.toLocaleString('da-DK')} stk. · Bestilt {formatOrderDate(order.created_at)}</p><StatusBadge order={order} /></div>
    </header>

    {order.requires_file_reupload && <div className="co-upload-callout">
      <span className="co-callout-icon"><AlertCircle /></span>
      <div><h3>Din trykfil skal rettes</h3><p>Trykkeriet har bedt om en ny fil.</p><p className="co-muted">Se beskeden, og upload din rettede trykfil.</p></div>
      <Button className="co-primary" disabled={props.uploading || !props.onUploadFile || details.files.status !== 'ready'} onClick={() => fileInput.current?.click()}>
        {props.uploading ? <Loader2 className="animate-spin" /> : <Upload />}{props.uploading ? 'Gemmer fil…' : 'Upload ny fil'}
      </Button>
      <input ref={fileInput} className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.ai,.eps" tabIndex={-1} aria-label="Vælg rettet trykfil" onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) await props.onUploadFile?.(order.id, file);
      }} />
    </div>}
    {props.uploadError && <p className="co-section-error" role="alert">{props.uploadError}</p>}
    {order.has_problem && order.problem_description && <div className="co-problem" role="status"><AlertCircle /><div><h3>Besked om din ordre</h3><p>{order.problem_description}</p></div></div>}

    <section className="co-files" aria-label="Trykfiler">
      <SectionContent section={details.files} onRetry={onRetryDetails} label="trykfiler">{files => files.length ? <>
        {files.filter(file => file.is_current).map(file => <div className="co-file" key={file.id}>
          <FileText /><div><strong>{file.file_name}</strong><p>Uploadet {formatOrderDate(file.uploaded_at, true)}</p></div>
          <span className={`co-status co-status--${order.requires_file_reupload ? 'warning' : 'neutral'}`}>{order.requires_file_reupload ? 'Afventer rettelse' : 'Aktuel fil'}</span>
          {safeOrderDocumentUrl(file.file_url) && <a className="co-icon-link" href={safeOrderDocumentUrl(file.file_url)!} target="_blank" rel="noopener noreferrer" aria-label={`Åbn ${file.file_name}`}><Download /></a>}
        </div>)}
        {!files.some(file => file.is_current) && <p className="co-muted">Ingen fil er markeret som aktuel. Kontakt trykkeriet via beskeder.</p>}
        {files.some(file => !file.is_current) && <details className="co-file-history"><summary>Tidligere filer ({files.filter(file => !file.is_current).length})</summary>{files.filter(file => !file.is_current).map(file => <div className="co-file" key={file.id}><FileText /><div><strong>{file.file_name}</strong><p>{formatOrderDate(file.uploaded_at, true)}</p></div>{safeOrderDocumentUrl(file.file_url) && <a className="co-icon-link" href={safeOrderDocumentUrl(file.file_url)!} target="_blank" rel="noopener noreferrer" aria-label={`Åbn tidligere fil ${file.file_name}`}><Download /></a>}</div>)}</details>}
      </> : <p className="co-muted">Der er endnu ingen registrerede trykfiler på ordren.</p>}</SectionContent>
    </section>

    <section className="co-section co-conversation" aria-label="Beskeder med trykkeriet">
      <div className="co-section-heading"><h3><MessageCircle />{latestAdmin ? 'Besked fra trykkeriet' : 'Beskeder til trykkeriet'}</h3><button className="co-text-button" onClick={() => { if (!conversationOpen) props.onOpenConversation?.(order.id); setConversationOpen(!conversationOpen); }} aria-expanded={conversationOpen}>{conversationOpen ? 'Luk samtale' : 'Åbn samtale'}<ArrowRight /></button></div>
      <SectionContent section={details.messages} onRetry={onRetryDetails} label="beskeder">{messages => <>
        {!conversationOpen && (latestAdmin ? <div className="co-message-preview"><time>{formatOrderDate(latestAdmin.created_at, true)}</time><p>{latestAdmin.content}</p><span className="co-message-sender"><span>TR</span>Dit trykkeri</span></div> : <p className="co-muted">Har du et spørgsmål? Send en besked direkte om denne ordre.</p>)}
        {conversationOpen && <>
          <div className="co-message-list">{messages.length ? messages.map(message => <article className={`co-message co-message--${message.sender_type}`} key={message.id}><div><strong>{message.sender_type === 'customer' ? 'Dig' : 'Trykkeriet'}</strong><time>{formatOrderDate(message.created_at, true)}</time></div><p>{message.content}</p>{message.sender_type === 'customer' && message.is_read && <span className="co-read"><CheckCheck />Læst af trykkeriet</span>}</article>) : <p className="co-muted">Ingen beskeder endnu.</p>}</div>
          <form onSubmit={async event => { event.preventDefault(); if (draft.trim() && await props.onSendMessage?.(order.id, draft.trim())) setDraft(''); }}>
            <label htmlFor={`order-message-${order.id}`}>Din besked</label>
            <Textarea id={`order-message-${order.id}`} value={draft} onChange={event => setDraft(event.target.value)} maxLength={5000} placeholder="Skriv din besked til trykkeriet…" disabled={props.sending} />
            {props.messageError && <p className="co-section-error" role="alert">{props.messageError}</p>}
            <div className="co-message-submit"><Button className="co-primary" disabled={!draft.trim() || props.sending || !props.onSendMessage}>{props.sending ? <Loader2 className="animate-spin" /> : <Send />}{props.sending ? 'Sender…' : 'Send besked'}</Button></div>
          </form>
        </>}
        {details.readReceiptError && <p className="co-muted co-small" role="status">{details.readReceiptError}</p>}
      </>}</SectionContent>
    </section>

    <section className="co-section" aria-label="Ordreoplysninger"><div className="co-section-heading"><h3><Package />Ordreoplysninger</h3><strong>{price}</strong></div>
      {configuration && <div className="co-configuration"><h4>Din bestilling</h4><p>{configuration}</p></div>}
      <dl className="co-facts"><div><dt>Antal</dt><dd>{order.quantity.toLocaleString('da-DK')} stk.</dd></div>{order.delivery_type && <div><dt>Levering</dt><dd>{order.delivery_type}</dd></div>}{order.delivery_address && <div><dt>Leveringsadresse</dt><dd>{order.delivery_address}<br />{order.delivery_zip} {order.delivery_city}</dd></div>}</dl>
      {reorderHref ? <div className="co-reorder"><Link to={link(reorderHref)} className="co-text-button">Bestil produktet igen<ArrowRight /></Link><p className="co-muted co-small">Vælg format og øvrige muligheder igen, og se den aktuelle pris før bestilling.</p></div> : <p className="co-muted co-small">{props.productLookupError || 'Produktet er ikke tilgængeligt til en ny bestilling her. Kontakt trykkeriet via beskeder.'}</p>}
    </section>

    <section className="co-section" aria-label="Levering og sporing"><div className="co-section-heading"><h3><Truck />Levering og sporing</h3></div>
      {order.tracking_number && <p className="co-tracking-number">Trackingnummer: <strong>{order.tracking_number}</strong></p>}
      {order.estimated_delivery && <p className="co-muted">Forventet levering: {formatOrderDate(order.estimated_delivery)}</p>}
      {order.shipped_at && <p className="co-muted">Afsendt {formatOrderDate(order.shipped_at)}</p>}
      {order.delivered_at && <p className="co-muted">Leveret {formatOrderDate(order.delivered_at)}</p>}
      <SectionContent section={details.tracking} onRetry={onRetryDetails} label="leveringsstatus">{events => events.length ? <ol className="co-timeline">{events.map(event => <li key={event.id}><strong>{trackingLabels[event.event_type] || event.description || 'Opdatering fra fragtfirma'}</strong><time>{formatOrderDate(event.occurred_at, true)}</time>{event.description && trackingLabels[event.event_type] && <p>{event.description}</p>}{event.location && <p>{event.location}</p>}</li>)}</ol> : <p className="co-muted">Der er endnu ingen registrerede leveringsopdateringer.</p>}</SectionContent>
    </section>

    <section className="co-section" aria-label="Fakturaer"><div className="co-section-heading"><h3><FileText />Fakturaer</h3></div><SectionContent section={details.invoices} onRetry={onRetryDetails} label="fakturaer">{invoices => invoices.length ? invoices.map(invoice => <div className="co-file" key={invoice.id}><FileText /><div><strong>Faktura {invoice.invoice_number}</strong><p>{({ paid: 'Betalt', pending: 'Afventer betaling', cancelled: 'Annulleret', refunded: 'Refunderet' })[invoice.status] || 'Status ikke oplyst'}</p></div>{safeOrderDocumentUrl(invoice.pdf_url) ? <a className="co-text-button" href={safeOrderDocumentUrl(invoice.pdf_url)!} target="_blank" rel="noopener noreferrer"><Download />Hent PDF</a> : <span className="co-muted co-small">PDF ikke tilgængelig</span>}</div>) : <p className="co-muted">Ingen faktura er tilgængelig på kontoen endnu.</p>}</SectionContent></section>
    <details className="co-section co-history"><summary>Ordrehistorik</summary><SectionContent section={details.history} onRetry={onRetryDetails} label="ordrehistorik">{history => history.length ? <ol className="co-timeline">{history.map(event => <li key={event.id}><strong>{orderStatus({ status: event.new_status }).label}</strong><time>{formatOrderDate(event.created_at, true)}</time></li>)}</ol> : <p className="co-muted">Ingen statusændringer er registreret endnu.</p>}</SectionContent></details>
  </section>;
}

/** Real account presentation with explicit data props for local fixture QA. */
export function CustomerOrdersView(props: CustomerOrdersViewProps) {
  const [search, setSearch] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const previousSelection = useRef(props.selectedOrderId);
  useEffect(() => {
    if (previousSelection.current && !props.selectedOrderId) searchInput.current?.focus({ preventScroll: true });
    previousSelection.current = props.selectedOrderId;
  }, [props.selectedOrderId]);
  const visibleOrders = filterCustomerOrders(props.orders, search);
  const order = props.orders.find(item => item.id === props.selectedOrderId);
  if (!props.orders.length) return <AccountState kind="empty" title={props.selectedOrderId ? 'Ordren blev ikke fundet' : 'Din første bestilling starter her'} description={props.selectedOrderId ? 'Ordren findes ikke på denne kundekonto i den valgte webshop.' : 'Når du bestiller hos denne webshop, kan du følge ordren, finde dine filer og tale med trykkeriet her.'}><Button asChild className="co-primary"><Link to={props.link('/produkter')}>Find dit produkt<ArrowRight /></Link></Button></AccountState>;
  return <div className={`customer-orders${props.selectedOrderId ? ' customer-orders--selected' : ''}`}>
    <section className="co-list" aria-label="Dine ordrer"><div className="co-search"><Search /><Input ref={searchInput} aria-label="Søg i dine ordrer" placeholder="Søg i dine ordrer…" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <p className="sr-only" role="status">{visibleOrders.length} ordrer fundet</p>
      <div className="co-order-list">{visibleOrders.map(item => <button key={item.id} onClick={() => props.onSelectOrder(item.id)} className={`co-order-card${item.id === props.selectedOrderId ? ' is-selected' : ''}`} aria-current={item.id === props.selectedOrderId ? 'true' : undefined}><ProductPicture order={item} /><span className="co-order-card-copy"><span className="co-order-number">{item.order_number}</span><strong>{item.product_name}</strong><span className="co-muted">{item.quantity.toLocaleString('da-DK')} stk. · {formatOrderDate(item.created_at)}</span><StatusBadge order={item} /></span><ChevronRight /></button>)}</div>
      {!visibleOrders.length && <div className="co-no-results"><p>Ingen ordrer matcher “{search}”.</p><Button variant="outline" onClick={() => setSearch('')}>Ryd søgning</Button></div>}
    </section>
    {order ? <OrderDetail key={order.id} {...props} order={order} /> : <div className="co-detail co-detail-empty">{props.selectedOrderId && <button className="co-back" onClick={() => props.onSelectOrder(null)}><ArrowLeft />Til mine ordrer</button>}<AccountState kind="empty" title={props.selectedOrderId ? 'Ordren blev ikke fundet' : 'Følg din bestilling'} description={props.selectedOrderId ? 'Ordren findes ikke på denne kundekonto i den valgte webshop.' : 'Vælg en ordre for at se status, filer og beskeder.'} /></div>}
  </div>;
}
