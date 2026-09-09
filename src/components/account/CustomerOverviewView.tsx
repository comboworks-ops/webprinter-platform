import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Building2, ChevronRight, FileImage, MapPin, MessageCircle, Package, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountState } from '@/components/account/AccountShell';
import '@/styles/customerOverview.css';

export interface CustomerOverviewOrder {
  id: string;
  order_number: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  requires_file_reupload?: boolean;
  has_problem?: boolean;
  problem_description?: string | null;
  unread_count?: number;
}
export interface CustomerOverviewAddress {
  first_name: string;
  last_name: string;
  street_address: string;
  street_address_2?: string | null;
  postal_code: string;
  city: string;
  country?: string;
}
export interface CustomerCompanyLink { id: string; name: string; href: string }
export interface CustomerOverviewViewProps {
  orders: CustomerOverviewOrder[];
  ordersState: 'loading' | 'ready' | 'error';
  ordersError?: string;
  messagesError?: string;
  onRetryOrders?: () => void;
  link: (path: string) => string;
  contact?: { name?: string; email?: string; phone?: string; company?: string };
  defaultAddress?: CustomerOverviewAddress;
  addressState?: 'loading' | 'ready' | 'error';
  onRetryAddress?: () => void;
  companyLinks?: CustomerCompanyLink[];
}

const orderStatuses: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Modtaget', tone: 'pending' },
  processing: { label: 'Behandles', tone: 'active' },
  production: { label: 'Under produktion', tone: 'active' },
  shipped: { label: 'Afsendt', tone: 'active' },
  delivered: { label: 'Leveret', tone: 'complete' },
  cancelled: { label: 'Annulleret', tone: 'neutral' },
  problem: { label: 'Kræver opmærksomhed', tone: 'attention' },
};

function OrderRow({ order, link }: { order: CustomerOverviewOrder; link: CustomerOverviewViewProps['link'] }) {
  const status = order.requires_file_reupload ? { label: 'Afventer ny fil', tone: 'attention' } : orderStatuses[order.status] || { label: order.status || 'Status ikke angivet', tone: 'neutral' };
  const date = new Date(order.created_at);
  return <Link className="customer-overview-order" to={link(`/min-konto/ordrer?order=${encodeURIComponent(order.id)}`)}>
    <span className="customer-overview-order-icon"><Package aria-hidden="true" size={24} strokeWidth={1.6} /></span>
    <span className="customer-overview-order-copy"><span className="customer-overview-order-number">{order.order_number}</span><strong>{order.product_name}</strong><span>{order.quantity.toLocaleString('da-DK')} stk.{!Number.isNaN(date.getTime()) && ` · ${date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}`}</span></span>
    <span className="customer-overview-order-trailing"><span className="customer-overview-status" data-tone={status.tone}>{status.label}</span>{!!order.unread_count && <span className="customer-overview-unread"><MessageCircle size={15} aria-hidden="true" />{order.unread_count} {order.unread_count === 1 ? 'ny besked' : 'nye beskeder'}</span>}</span>
    <ChevronRight className="customer-overview-chevron" size={20} aria-hidden="true" />
  </Link>;
}

export function CustomerOverviewView({ orders, ordersState, ordersError, messagesError, onRetryOrders, link, contact, defaultAddress, addressState = 'ready', onRetryAddress, companyLinks = [] }: CustomerOverviewViewProps) {
  const activeOrders = orders.filter(order => !['delivered', 'cancelled'].includes(order.status));
  const attentionOrders = orders.filter(order => order.requires_file_reupload || order.has_problem || (order.unread_count || 0) > 0);
  const recentOrders = orders.filter(order => !activeOrders.slice(0, 5).some(active => active.id === order.id)).slice(0, 5);

  return <div className="customer-overview">
    <div className="customer-overview-main">
      {ordersState === 'loading' ? <AccountState kind="loading" title="Henter dine ordrer" /> : ordersState === 'error' ? (
        <AccountState kind="error" title="Vi kunne ikke hente dine ordrer" description={ordersError || 'Prøv igen om et øjeblik. Dine bestillinger er ikke ændret.'} onRetry={onRetryOrders} />
      ) : orders.length === 0 ? (
        <AccountState kind="empty" title="Din første bestilling starter her" description="Når du bestiller hos os, kan du følge ordren og skrive med trykkeriet her."><Button asChild className="customer-button"><Link to={link('/')}>Find dit næste tryk <ArrowRight size={16} className="ml-2" /></Link></Button></AccountState>
      ) : <>
        {attentionOrders.length > 0 && <section className="customer-overview-attention" aria-labelledby="customer-attention-title">
          <h2 id="customer-attention-title">Det næste skridt</h2>
          {attentionOrders.slice(0, 3).map(order => {
            const needsFile = order.requires_file_reupload;
            const hasProblem = order.has_problem;
            const Icon = needsFile ? Upload : hasProblem ? AlertCircle : MessageCircle;
            return <Link key={order.id} to={link(`/min-konto/ordrer?order=${encodeURIComponent(order.id)}`)} className="customer-overview-action" data-tone={needsFile || hasProblem ? 'attention' : 'message'}>
              <Icon size={25} strokeWidth={1.7} aria-hidden="true" /><span><strong>{needsFile ? 'Din trykfil skal rettes' : hasProblem ? 'Trykkeriet har brug for din opmærksomhed' : 'Du har en besked fra trykkeriet'}</strong><span>{order.product_name} · {order.order_number}</span><span>{needsFile ? 'Se beskeden, og upload din rettede fil.' : hasProblem ? 'Åbn ordren for at se, hvad der skal ske.' : 'Åbn ordren, og fortsæt samtalen.'}</span></span><ChevronRight size={20} aria-hidden="true" />
            </Link>;
          })}
          {attentionOrders.length > 3 && <Link className="customer-overview-text-link" to={link('/min-konto/ordrer')}>Se alle dine ordrer <ArrowRight size={16} aria-hidden="true" /></Link>}
        </section>}
        {messagesError && <p className="customer-overview-inline-error" role="status">{messagesError} <button type="button" onClick={onRetryOrders}>Prøv igen</button></p>}
        {activeOrders.length > 0 && <section aria-labelledby="customer-active-title"><div className="customer-overview-section-heading"><h2 id="customer-active-title">Aktive ordrer</h2><Link to={link('/min-konto/ordrer')}>Se alle <ArrowRight size={16} aria-hidden="true" /></Link></div><div className="customer-overview-order-list">{activeOrders.slice(0, 5).map(order => <OrderRow key={order.id} order={order} link={link} />)}</div></section>}
        {recentOrders.length > 0 && <section aria-labelledby="customer-recent-title"><div className="customer-overview-section-heading"><h2 id="customer-recent-title">Seneste ordrer</h2>{activeOrders.length === 0 && <Link to={link('/min-konto/ordrer')}>Se alle <ArrowRight size={16} aria-hidden="true" /></Link>}</div><div className="customer-overview-order-list">{recentOrders.map(order => <OrderRow key={order.id} order={order} link={link} />)}</div></section>}
      </>}
      <Link className="customer-overview-design-link" to={link('/min-konto/designs')}><FileImage size={26} strokeWidth={1.6} aria-hidden="true" /><span><strong>Fortsæt med dine designs</strong><span>Find et gemt design, og arbejd videre i designeren.</span></span><ArrowRight size={20} aria-hidden="true" /></Link>
    </div>
    <aside className="customer-overview-details" aria-label="Dine oplysninger">
      <section><div className="customer-overview-section-heading"><h2><User size={18} aria-hidden="true" /> Dine oplysninger</h2><Link to={link('/min-konto/indstillinger')}>Rediger</Link></div>
        {contact?.name && <strong>{contact.name}</strong>}{contact?.company && <p>{contact.company}</p>}{contact?.email && <p>{contact.email}</p>}{contact?.phone && <p>{contact.phone}</p>}{!contact?.name && <p>Tilføj dit navn og dine kontaktoplysninger, så de er klar til næste bestilling.</p>}
      </section>
      <section><div className="customer-overview-section-heading"><h2><MapPin size={18} aria-hidden="true" /> Leveringsadresse</h2><Link to={link('/min-konto/adresser')}>Administrer</Link></div>
        {addressState === 'loading' ? <p role="status">Henter standardadresse…</p> : addressState === 'error' ? <p className="customer-overview-inline-error" role="status">Adressen kunne ikke hentes. <button type="button" onClick={onRetryAddress}>Prøv igen</button></p> : defaultAddress ? <address><strong>{defaultAddress.first_name} {defaultAddress.last_name}</strong><span>{defaultAddress.street_address}</span>{defaultAddress.street_address_2 && <span>{defaultAddress.street_address_2}</span>}<span>{defaultAddress.postal_code} {defaultAddress.city}</span></address> : <p>Du har endnu ikke valgt en standardadresse.</p>}
      </section>
      {companyLinks.length > 0 && <section><div className="customer-overview-section-heading"><h2><Building2 size={18} aria-hidden="true" /> Firmaadgang</h2></div>{companyLinks.map(company => <Link key={company.id} className="customer-overview-text-link" to={company.href}>{company.name}<ArrowRight size={16} aria-hidden="true" /></Link>)}</section>}
    </aside>
  </div>;
}
