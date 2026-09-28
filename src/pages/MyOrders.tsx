import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AccountShell, AccountState } from '@/components/account/AccountShell';
import { useCustomerAccount } from '@/components/account/CustomerAccountContext';
import { CustomerOrdersView } from '@/components/account/CustomerOrdersView';
import { customerOrderHref, loadingOrderDetails, requirePersistedRow, scopedOrderDetailQuery, scopedOrdersQuery, type CustomerOrder, type CustomerOrderDetails, type OrderMessage, type OrderScope } from '@/lib/account/orders';
import { uploadCustomerReplacementFile } from '@/lib/account/replacementFile';
import { acknowledgeCustomerOrderMessages } from '@/lib/account/readReceipts';

// Legacy orders tables are absent from the generated Database type.
const db = supabase as unknown as SupabaseClient;

function ScopedCustomerOrders({ userId, tenantId }: { userId: string; tenantId: string }) {
  const { link } = useCustomerAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const scope = useMemo<OrderScope>(() => ({ userId, tenantId }), [userId, tenantId]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productLookupError, setProductLookupError] = useState<string | null>(null);
  const [details, setDetails] = useState<CustomerOrderDetails>(loadingOrderDetails);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const alive = useRef(true);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const pendingMessages = useRef<Record<string, { id: string; content: string }>>({});
  const sendLock = useRef(false);
  const uploadLock = useRef(false);
  const selectedOrderId = new URLSearchParams(location.search).get('order');
  const selectedRef = useRef(selectedOrderId);
  selectedRef.current = selectedOrderId;
  const selectedOrderExists = orders.some(order => order.id === selectedOrderId);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const loadOrders = useCallback(async () => {
    const request = ++listRequest.current;
    setLoading(true);
    setError(null);
    setProductLookupError(null);
    try {
      const result = await scopedOrdersQuery(db, scope).order('created_at', { ascending: false });
      if (result.error) throw result.error;
      const rows: CustomerOrder[] = result.data || [];
      const slugs = [...new Set(rows.map(order => order.product_slug).filter(Boolean))];
      let products: CustomerOrder['product'][] = [];
      if (slugs.length) {
        try {
          const productResult = await db.from('products').select('slug,image_url,is_published').eq('tenant_id', scope.tenantId).eq('is_published', true).in('slug', slugs);
          if (productResult.error) throw productResult.error;
          products = productResult.data || [];
        } catch {
          if (alive.current && request === listRequest.current) setProductLookupError('Vi kunne ikke kontrollere produktets tilgængelighed. Genindlæs siden for at prøve igen.');
        }
      }
      if (!alive.current || request !== listRequest.current) return;
      setOrders(rows.map(order => ({ ...order, product: products.find(product => product?.slug === order.product_slug) || null })));
    } catch {
      if (alive.current && request === listRequest.current) { setOrders([]); setError('Dine ordrer kunne ikke hentes. Prøv igen om et øjeblik.'); }
    } finally {
      if (alive.current && request === listRequest.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const loadDetails = useCallback(async (orderId: string) => {
    const request = ++detailRequest.current;
    setDetailsKey(orderId);
    setDetails(loadingOrderDetails());
    const sections = [
      ['messages', 'order_messages', 'created_at', true, 'Beskederne kunne ikke hentes.'],
      ['files', 'order_files', 'uploaded_at', false, 'Trykfilerne kunne ikke hentes.'],
      ['tracking', 'delivery_tracking', 'occurred_at', false, 'Leveringsopdateringerne kunne ikke hentes.'],
      ['invoices', 'order_invoices', 'created_at', false, 'Fakturaerne kunne ikke hentes.'],
      ['history', 'order_status_history', 'created_at', false, 'Ordrehistorikken kunne ikke hentes.'],
    ] as const;
    await Promise.allSettled(sections.map(async ([key, table, sort, ascending, description]) => {
      try {
        const result = await scopedOrderDetailQuery(db, table, orderId, scope).order(sort, { ascending });
        if (result.error) throw result.error;
        if (alive.current && request === detailRequest.current && selectedRef.current === orderId) setDetails(previous => ({ ...previous, [key]: { status: 'ready', data: result.data || [] } }));
      } catch {
        if (alive.current && request === detailRequest.current && selectedRef.current === orderId) setDetails(previous => ({ ...previous, [key]: { status: 'error', error: description } }));
      }
    }));
  }, [scope]);

  useEffect(() => {
    setMessageError(null);
    setUploadError(null);
    if (selectedOrderId && selectedOrderExists) void loadDetails(selectedOrderId);
    else { detailRequest.current++; setDetailsKey(null); setDetails(loadingOrderDetails()); }
  }, [selectedOrderId, selectedOrderExists, loadDetails]);

  const assertCurrentOrder = async (orderId: string) => {
    if (!alive.current || !orders.some(order => order.id === orderId)) throw new Error('Ordren er ikke længere valgt.');
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || auth.user?.id !== userId || !alive.current) throw new Error('Log ind igen, før du fortsætter.');
    const result = await scopedOrdersQuery(db, scope).eq('id', orderId).single();
    const order = requirePersistedRow<CustomerOrder>(result, orderId);
    if (!alive.current) throw new Error('Kundekontoen er ændret.');
    return order;
  };

  const sendMessage = async (orderId: string, content: string): Promise<boolean> => {
    if (sendLock.current || !content.trim() || content.length > 5000) return false;
    sendLock.current = true;
    setSending(true);
    setMessageError(null);
    const pending = pendingMessages.current[orderId]?.content === content ? pendingMessages.current[orderId] : { id: crypto.randomUUID(), content };
    pendingMessages.current[orderId] = pending;
    try {
      await assertCurrentOrder(orderId);
      // Reconcile an uncertain response before a manual retry, using the same id.
      const existing = await scopedOrderDetailQuery(db, 'order_messages', orderId, scope).eq('id', pending.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!alive.current) return false;
      let saved: OrderMessage;
      if (existing.data) {
        saved = requirePersistedRow<OrderMessage>({ data: existing.data as unknown as OrderMessage, error: existing.error }, pending.id);
        if (saved.content !== content || saved.sender_type !== 'customer') throw new Error('Beskeden kunne ikke bekræftes.');
      } else {
        const result = await db.from('order_messages').insert({ id: pending.id, order_id: orderId, sender_id: userId, sender_type: 'customer', content }).select('*').single();
        saved = requirePersistedRow<OrderMessage>(result, pending.id);
      }
      if (!alive.current) return false;
      delete pendingMessages.current[orderId];
      if (selectedRef.current === orderId) setDetails(previous => previous.messages.status === 'ready' ? { ...previous, messages: { status: 'ready', data: [...previous.messages.data.filter(message => message.id !== saved.id), saved] } } : previous);
      toast.success('Din besked er sendt.');
      return true;
    } catch {
      if (alive.current && selectedRef.current === orderId) setMessageError('Beskeden kunne ikke bekræftes som sendt. Din tekst er bevaret. Prøv igen for at kontrollere og sende den.');
      return false;
    } finally {
      sendLock.current = false;
      if (alive.current) setSending(false);
    }
  };

  const markConversationRead = async (orderId: string) => {
    if (detailsKey !== orderId || details.messages.status !== 'ready') return;
    const unread = details.messages.data.filter(message => message.sender_type === 'admin' && !message.is_read);
    if (!unread.length) return;
    try {
      await assertCurrentOrder(orderId);
      const savedIds = await acknowledgeCustomerOrderMessages(db, { orderId, tenantId, messageIds: unread.map(message => message.id) });
      if (!alive.current || selectedRef.current !== orderId) return;
      setDetails(previous => ({ ...previous, readReceiptError: savedIds.size !== unread.length ? 'Læsekvitteringen kunne ikke gemmes. Du kan stadig læse og besvare beskederne.' : null, messages: previous.messages.status === 'ready' ? { status: 'ready', data: previous.messages.data.map(message => savedIds.has(message.id) ? { ...message, is_read: true } : message) } : previous.messages }));
    } catch {
      if (alive.current && selectedRef.current === orderId) setDetails(previous => ({ ...previous, readReceiptError: 'Læsekvitteringen kunne ikke gemmes. Du kan stadig læse og besvare beskederne.' }));
    }
  };

  const uploadFile = async (orderId: string, file: File): Promise<boolean> => {
    if (uploadLock.current || detailsKey !== orderId || details.files.status !== 'ready') return false;
    uploadLock.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const order = await assertCurrentOrder(orderId);
      if (!order.requires_file_reupload) throw new Error('Ordren afventer ikke længere en ny fil. Genindlæs ordren.');
      await uploadCustomerReplacementFile(db, { orderId, tenantId, userId, file, expectedCurrentFileIds: details.files.data.filter(item => item.is_current).map(item => item.id) });
      if (!alive.current) return false;
      toast.success('Din nye trykfil er gemt.');
      await loadOrders();
      if (selectedRef.current === orderId) await loadDetails(orderId);
      return true;
    } catch (failure) {
      if (alive.current && selectedRef.current === orderId) setUploadError(failure instanceof Error ? failure.message : 'Den nye fil kunne ikke gemmes. Din tidligere fil er bevaret.');
      return false;
    } finally {
      uploadLock.current = false;
      if (alive.current) setUploading(false);
    }
  };

  const selectOrder = (id: string | null) => {
    if (id) navigate(link(customerOrderHref(id, location.search)));
    else {
      const params = new URLSearchParams(location.search);
      params.delete('order');
      navigate(link(`/min-konto/ordrer${params.size ? `?${params}` : ''}`));
    }
  };

  return <AccountShell title="Dine ordrer" description="Se og følg dine ordrer, upload nye filer og hold dialogen med trykkeriet." actions={<Button asChild className="co-primary"><Link to={link('/produkter')}>Ny bestilling<ArrowRight /></Link></Button>}>
    {loading ? <AccountState kind="loading" title="Henter dine ordrer" /> : error ? <AccountState kind="error" title="Vi kunne ikke hente dine ordrer" description={error} onRetry={() => void loadOrders()} /> : <CustomerOrdersView orders={orders} selectedOrderId={selectedOrderId} onSelectOrder={selectOrder} details={detailsKey === selectedOrderId ? details : loadingOrderDetails()} onRetryDetails={() => selectedOrderId && void loadDetails(selectedOrderId)} link={link} onSendMessage={sendMessage} onOpenConversation={markConversationRead} onUploadFile={uploadFile} sending={sending} uploading={uploading} messageError={messageError} uploadError={uploadError} productLookupError={productLookupError} />}
  </AccountShell>;
}

export default function MyOrders() {
  const { user, shop, loading, error, retry } = useCustomerAccount();
  if (error || loading || !user || !shop) return <AccountShell title="Dine ordrer"><AccountState kind={error ? 'error' : 'loading'} title={error ? 'Din konto kunne ikke hentes' : 'Henter din konto'} description={error || undefined} onRetry={error ? retry : undefined} /></AccountShell>;
  // Reset all rows/drafts synchronously before rendering a different customer/shop.
  return <ScopedCustomerOrders key={`${user.id}:${shop.id}`} userId={user.id} tenantId={shop.id} />;
}
