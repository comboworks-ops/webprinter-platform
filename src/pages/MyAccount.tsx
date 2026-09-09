import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AccountShell, AccountState } from '@/components/account/AccountShell';
import { useCustomerAccount } from '@/components/account/CustomerAccountContext';
import { CustomerOverviewView, type CustomerOverviewOrder, type CustomerOverviewAddress, type CustomerCompanyLink } from '@/components/account/CustomerOverviewView';

type OrdersState = { key: string; status: 'loading' | 'ready' | 'error'; orders: CustomerOverviewOrder[]; messagesError?: string };
type AddressState = { key: string; status: 'loading' | 'ready' | 'error'; address?: CustomerOverviewAddress };
type CompanyState = { key: string; status: 'loading' | 'ready' | 'error'; companies: { id: string; name: string }[] };

function missingCompanyStatusColumn(error: { code?: string; message?: string } | null): 'member' | 'company' | null {
  if (!error || !['42703', 'PGRST204'].includes(error.code || '')) return null;
  const message = error.message || '';
  if (error.code === '42703') {
    if (/column\s+"?company_members(?:_\d+)?"?\."?status"?\s+does not exist/i.test(message)) return 'member';
    if (/column\s+"?(?:company_accounts(?:_\d+)?|company)"?\."?status"?\s+does not exist/i.test(message)) return 'company';
  }
  if (error.code === 'PGRST204' && /['"]status['"]\s+column/i.test(message)) {
    if (/['"]company_members['"]/.test(message)) return 'member';
    if (/['"]company_accounts['"]/.test(message)) return 'company';
  }
  return null;
}

async function readScopedCompanyLinks(userId: string, tenantId: string) {
  let memberHasStatus = true;
  let companyHasStatus = true;
  // Legacy shops omit these two V2 columns. Drop only the column proved absent;
  // a partially upgraded shop must still enforce whichever status column exists.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from('company_members' as never)
      .select(`${memberHasStatus ? 'status, ' : ''}company:company_accounts!inner(id, name, tenant_id${companyHasStatus ? ', status' : ''})`)
      .eq('user_id', userId).eq('tenant_id', tenantId).eq('company.tenant_id', tenantId);
    if (error) {
      const missing = missingCompanyStatusColumn(error);
      if (missing === 'member' && memberHasStatus) { memberHasStatus = false; continue; }
      if (missing === 'company' && companyHasStatus) { companyHasStatus = false; continue; }
      throw error;
    }
    type Membership = { status?: string; company: { id: string; name: string; tenant_id: string; status?: string } };
    return ((data || []) as unknown as Membership[])
      .filter(row => (!memberHasStatus || row.status === 'active') && row.company?.tenant_id === tenantId && (!companyHasStatus || row.company.status === 'active'))
      .map(row => ({ id: row.company.id, name: row.company.name }));
  }
  throw new Error('Company membership schema could not be confirmed');
}

export default function MyAccount() {
  const account = useCustomerAccount();
  const userId = account.user?.id;
  const tenantId = account.shop?.id;
  const identityKey = userId && tenantId ? `${userId}:${tenantId}` : '';
  const [reload, setReload] = useState(0);
  const [ordersResult, setOrdersResult] = useState<OrdersState>({ key: '', status: 'loading', orders: [] });
  const [addressResult, setAddressResult] = useState<AddressState>({ key: '', status: 'loading' });
  const [companyResult, setCompanyResult] = useState<CompanyState>({ key: '', status: 'loading', companies: [] });

  useEffect(() => {
    if (!userId || !tenantId || account.loading || account.error) return;
    let cancelled = false;
    setOrdersResult({ key: identityKey, status: 'loading', orders: [] });
    setAddressResult({ key: identityKey, status: 'loading' });
    setCompanyResult({ key: identityKey, status: 'loading', companies: [] });

    const loadOrders = async () => {
      try {
        const { data, error } = await supabase.from('orders' as never)
          .select('id, order_number, product_name, quantity, status, created_at, requires_file_reupload, has_problem, problem_description')
          .eq('user_id', userId).eq('tenant_id', tenantId).order('created_at', { ascending: false });
        if (error) throw error;
        const orders = (data || []) as unknown as CustomerOverviewOrder[];
        if (cancelled) return;
        setOrdersResult({ key: identityKey, status: 'ready', orders });
        if (!orders.length) return;
        const { data: messages, error: messageError } = await supabase.from('order_messages' as never)
          .select('order_id').in('order_id', orders.map(order => order.id)).eq('sender_type', 'admin').eq('is_read', false);
        if (cancelled) return;
        const counts = new Map<string, number>();
        for (const message of (messages || []) as unknown as { order_id: string }[]) counts.set(message.order_id, (counts.get(message.order_id) || 0) + 1);
        setOrdersResult({ key: identityKey, status: 'ready', orders: orders.map(order => ({ ...order, unread_count: counts.get(order.id) || 0 })),
          messagesError: messageError ? 'Beskedstatus kunne ikke hentes. Åbn en ordre for at se samtalen.' : undefined });
      } catch {
        if (!cancelled) setOrdersResult({ key: identityKey, status: 'error', orders: [] });
      }
    };
    const loadAddress = async () => {
      try {
        // Preserve the existing personal address ownership model.
        const { data, error } = await supabase.from('customer_addresses' as never)
          .select('first_name, last_name, street_address, street_address_2, postal_code, city, country')
          .eq('user_id', userId).eq('is_default', true).order('created_at', { ascending: false }).limit(1);
        if (error) throw error;
        if (!cancelled) setAddressResult({ key: identityKey, status: 'ready', address: data?.[0] as unknown as CustomerOverviewAddress });
      } catch {
        if (!cancelled) setAddressResult({ key: identityKey, status: 'error' });
      }
    };
    const loadCompanyLinks = async () => {
      try {
        const companies = await readScopedCompanyLinks(userId, tenantId);
        if (!cancelled) setCompanyResult({ key: identityKey, status: 'ready', companies });
      } catch {
        if (!cancelled) setCompanyResult({ key: identityKey, status: 'error', companies: [] });
      }
    };
    void loadOrders(); void loadAddress(); void loadCompanyLinks();
    return () => { cancelled = true; };
  }, [userId, tenantId, identityKey, account.loading, account.error, reload]);

  const retry = () => setReload(value => value + 1);
  const orders = ordersResult.key === identityKey ? ordersResult : { status: 'loading' as const, orders: [] };
  const address = addressResult.key === identityKey ? addressResult : { status: 'loading' as const };
  const companies: CustomerCompanyLink[] = companyResult.key === identityKey ? companyResult.companies.map(company => ({ ...company, href: account.link('/company') })) : [];
  const firstName = account.profile?.first_name;

  return <AccountShell title={firstName ? `Velkommen, ${firstName}` : 'Velkommen til din konto'} description="Følg dine bestillinger, find dine designs og hold kontakten med trykkeriet."
    actions={<Button asChild className="customer-button"><Link to={account.link('/')} className="gap-2">Ny bestilling <ArrowRight className="h-4 w-4" /></Link></Button>}>
    {account.loading ? <AccountState kind="loading" /> : account.error ? <AccountState kind="error" description={account.error} onRetry={account.retry} /> : (
      <><CustomerOverviewView orders={orders.orders} ordersState={orders.status} messagesError={'messagesError' in orders ? orders.messagesError : undefined} onRetryOrders={retry} link={account.link}
        contact={{ name: [account.profile?.first_name, account.profile?.last_name].filter(Boolean).join(' '), email: account.user?.email, phone: account.profile?.phone, company: account.profile?.company }}
        defaultAddress={'address' in address ? address.address : undefined} addressState={address.status} onRetryAddress={retry} companyLinks={companies} />
        {companyResult.key === identityKey && companyResult.status === 'error' && <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5 text-sm" role="alert"><p>Din firmaadgang kunne ikke hentes.</p><Button variant="outline" size="sm" onClick={retry}>Prøv igen</Button></div>}
      </>
    )}
  </AccountShell>;
}
