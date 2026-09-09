import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AccountShell, AccountState } from '@/components/account/AccountShell';
import { useCustomerAccount } from '@/components/account/CustomerAccountContext';
import { CustomerDesignsView, type CustomerSavedDesign } from '@/components/account/CustomerDesignsView';

export default function MyDesigns() {
  const account = useCustomerAccount();
  const userId = account.user?.id;
  const tenantId = account.shop?.id;
  const identityKey = userId && tenantId ? `${userId}:${tenantId}` : '';
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; state: 'loading' | 'ready' | 'error'; designs: CustomerSavedDesign[] }>({ key: '', state: 'loading', designs: [] });

  useEffect(() => {
    if (!userId || !tenantId || account.loading || account.error) return;
    let cancelled = false;
    setResult({ key: identityKey, state: 'loading', designs: [] });
    const load = async () => {
      try {
        const { data, error } = await supabase.from('designer_saved_designs' as never)
          .select('id, name, width_mm, height_mm, preview_thumbnail_url, updated_at, product_id')
          .eq('user_id', userId).eq('tenant_id', tenantId).order('updated_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setResult({ key: identityKey, state: 'ready', designs: (data || []) as unknown as CustomerSavedDesign[] });
      } catch {
        if (!cancelled) setResult({ key: identityKey, state: 'error', designs: [] });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [userId, tenantId, identityKey, account.loading, account.error, reload]);

  const current = result.key === identityKey ? result : { state: 'loading' as const, designs: [] };
  return <AccountShell title="Mine designs" description="Dine gemte designs, klar til at arbejde videre med."
    actions={<Button asChild className="customer-button"><Link to={account.link('/')} className="gap-2">Find et produkt <ArrowRight size={16} /></Link></Button>}>
    {account.loading ? <AccountState kind="loading" /> : account.error ? <AccountState kind="error" description={account.error} onRetry={account.retry} /> : (
      <CustomerDesignsView key={identityKey} designs={current.designs} state={current.state} onRetry={() => setReload(value => value + 1)} link={account.link} />
    )}
  </AccountShell>;
}
