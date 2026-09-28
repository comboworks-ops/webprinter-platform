import type { SupabaseClient } from '@supabase/supabase-js';

export interface CustomerOrder {
  id: string;
  user_id?: string;
  tenant_id?: string;
  order_number: string;
  product_name: string;
  product_slug?: string | null;
  product_configuration?: string | null;
  quantity: number;
  total_price: number;
  currency?: string | null;
  status: string;
  status_note?: string | null;
  delivery_type?: string | null;
  delivery_address?: string | null;
  delivery_zip?: string | null;
  delivery_city?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
  has_problem?: boolean;
  problem_description?: string | null;
  requires_file_reupload?: boolean;
  created_at: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  product?: { image_url: string | null; slug: string; is_published: boolean } | null;
}

export interface OrderMessage {
  id: string;
  order_id?: string;
  content: string;
  sender_type: 'customer' | 'admin';
  created_at: string;
  is_read: boolean;
}
export interface OrderFile {
  id: string;
  order_id?: string;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  file_type?: string | null;
  is_current: boolean;
  uploaded_at: string;
}
export interface OrderTracking {
  id: string;
  event_type: string;
  location?: string | null;
  description?: string | null;
  occurred_at: string;
}
export interface OrderInvoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  pdf_url: string | null;
}
export interface OrderHistory {
  id: string;
  new_status: string;
  created_at: string;
}
export type OrderSection<T> =
  | { status: 'loading'; data?: never; error?: never }
  | { status: 'error'; data?: never; error: string }
  | { status: 'ready'; data: T; error?: never };
export interface CustomerOrderDetails {
  messages: OrderSection<OrderMessage[]>;
  files: OrderSection<OrderFile[]>;
  tracking: OrderSection<OrderTracking[]>;
  invoices: OrderSection<OrderInvoice[]>;
  history: OrderSection<OrderHistory[]>;
  readReceiptError?: string | null;
}
export interface OrderScope { userId: string; tenantId: string }

export function assertOrderScope(scope: OrderScope) {
  if (!scope.userId || !scope.tenantId) throw new Error('Kunde og webshop skal være kendt, før ordren kan hentes.');
}

// The client argument permits isolated tests without replacing the application's client.
// Explicit predicates are additional safeguards; server RLS remains authoritative.
export function scopedOrdersQuery(client: SupabaseClient, scope: OrderScope) {
  assertOrderScope(scope);
  return client.from('orders').select('*').eq('user_id', scope.userId).eq('tenant_id', scope.tenantId);
}

export const CUSTOMER_DETAIL_COLUMNS: Record<string, string> = {
  order_messages: 'id,order_id,content,sender_type,created_at,is_read',
  order_files: 'id,order_id,file_name,file_url,file_size,file_type,is_current,uploaded_at',
  delivery_tracking: 'id,event_type,location,description,occurred_at',
  order_invoices: 'id,invoice_number,total,status,pdf_url',
  order_status_history: 'id,new_status,created_at',
};
export function scopedOrderDetailQuery(client: SupabaseClient, table: string, orderId: string, scope: OrderScope) {
  assertOrderScope(scope);
  if (!orderId || !Object.prototype.hasOwnProperty.call(CUSTOMER_DETAIL_COLUMNS, table)) throw new Error('Ugyldig ordre.');
  return client.from(table).select(`${CUSTOMER_DETAIL_COLUMNS[table]}, orders!inner(user_id, tenant_id)`)
    .eq('order_id', orderId).eq('orders.user_id', scope.userId).eq('orders.tenant_id', scope.tenantId);
}

export function requirePersistedRow<T extends { id: string }>(result: { data: T | null; error: unknown }, expectedId?: string): T {
  if (result.error) throw result.error;
  if (!result.data?.id || (expectedId && result.data.id !== expectedId)) throw new Error('Ændringen kunne ikke bekræftes. Prøv at genindlæse.');
  return result.data;
}

export function orderStatus(order: Pick<CustomerOrder, 'status' | 'requires_file_reupload' | 'has_problem'>) {
  if (order.requires_file_reupload) return { label: 'Afventer ny fil', tone: 'warning' };
  if (order.has_problem) return { label: 'Kræver din opmærksomhed', tone: 'danger' };
  const statuses: Record<string, { label: string; tone: string }> = {
    pending: { label: 'Modtaget', tone: 'neutral' },
    processing: { label: 'Behandles', tone: 'blue' },
    production: { label: 'Under produktion', tone: 'blue' },
    shipped: { label: 'Afsendt', tone: 'blue' },
    delivered: { label: 'Leveret', tone: 'success' },
    cancelled: { label: 'Annulleret', tone: 'neutral' },
    problem: { label: 'Kræver din opmærksomhed', tone: 'danger' },
  };
  return statuses[order.status] || { label: 'Status ikke oplyst', tone: 'neutral' };
}

export function filterCustomerOrders(orders: CustomerOrder[], query: string) {
  const normalized = query.trim().toLocaleLowerCase('da-DK').replace(/^#/, '');
  return normalized ? orders.filter(order => `${order.order_number} ${order.product_name}`.toLocaleLowerCase('da-DK').includes(normalized)) : orders;
}

export function customerOrderHref(orderId: string, search = '') {
  const params = new URLSearchParams(search);
  params.set('order', orderId);
  return `/min-konto/ordrer?${params.toString()}`;
}

export function orderConfiguration(order: CustomerOrder): string | null {
  if (order.product_configuration?.trim()) return order.product_configuration.trim();
  const note = order.status_note || '';
  if (!note.startsWith('[SIZE-DISTRIBUTION]')) return null;
  // Older checkout rows stored configuration before internal fulfillment tags.
  return note.slice('[SIZE-DISTRIBUTION]'.length).split(/\n\[/)[0].trim() || null;
}

export function safeOrderDocumentUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; }
}

export function safeProductImageUrl(value: string | null | undefined): string | null {
  if (value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !Array.from(value).some(character => character.charCodeAt(0) <= 32)) return value;
  return safeOrderDocumentUrl(value);
}

export function reorderProductHref(order: CustomerOrder): string | null {
  // Historical configuration is free text, not a recoverable option map. Never
  // copy historic price or pretend those options can be restored automatically.
  if (!order.product?.is_published || !order.product.slug) return null;
  return `/produkt/${encodeURIComponent(order.product.slug)}`;
}

export function loadingOrderDetails(): CustomerOrderDetails {
  return { messages: { status: 'loading' }, files: { status: 'loading' }, tracking: { status: 'loading' }, invoices: { status: 'loading' }, history: { status: 'loading' } };
}

export function formatOrderDate(value: string, includeTime = false): string {
  if (!Number.isFinite(new Date(value).getTime())) return 'Dato ikke oplyst';
  return new Date(value).toLocaleString('da-DK', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Copenhagen',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  });
}
