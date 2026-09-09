import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { mergeBrandingWithDefaults } from '@/hooks/useBrandingDraft';
import { customerAuthHref, customerLink } from '@/lib/account/navigation';
import { customerShopTarget, customerShopSettings, readCustomerShop } from '@/lib/account/shop';

export interface CustomerProfile { id?: string; first_name: string; last_name: string; phone: string; company: string; email?: string }
export interface CustomerAccountValue {
  user: User | null;
  profile: CustomerProfile | null;
  shop: (ReturnType<typeof customerShopSettings> & { branding: ReturnType<typeof mergeBrandingWithDefaults> }) | null | undefined;
  loading: boolean;
  error: string | null;
  retry: () => void;
  link: (href: string) => string;
  refetchProfile: () => Promise<unknown>;
}
const CustomerAccountContext = createContext<CustomerAccountValue | null>(null);

export function CustomerAccountProvider({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hostname = window.location.hostname;
  const rootDomain = import.meta.env.VITE_ROOT_DOMAIN || 'webprinter.dk';
  const currentSearch = new URLSearchParams(location.search);
  const shopParams = new URLSearchParams();
  for (const key of ['tenantId', 'tenant_id', 'force_domain', 'tenant_subdomain']) {
    if (currentSearch.has(key)) shopParams.set(key, currentSearch.get(key) || '');
  }
  const shopSearch = shopParams.toString();
  const shopQuery = useQuery({
    queryKey: ['customer-account', 'shop', hostname, shopSearch, rootDomain],
    queryFn: async () => {
      const tenant = await readCustomerShop(supabase, customerShopTarget(hostname, shopSearch, rootDomain));
      const settings = customerShopSettings(tenant);
      return { ...settings, branding: mergeBrandingWithDefaults(settings.branding) };
    },
    retry: false,
    staleTime: 30_000,
    placeholderData: () => undefined,
  });
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let authRevision = 0;
    setSessionError(null);
    const initialRevision = authRevision;
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled || authRevision !== initialRevision) return;
      if (error && error.name !== 'AuthSessionMissingError') setSessionError('Vi kunne ikke kontrollere din login-session. Prøv igen.');
      setUser(data.user || null);
      setSessionReady(true);
    }).catch(() => { if (!cancelled) { setSessionError('Vi kunne ikke kontrollere din login-session. Prøv igen.'); setSessionReady(true); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision += 1;
      if (cancelled) return;
      setUser(session?.user || null);
      setSessionReady(true);
      setSessionError(null);
      if (!session) queryClient.removeQueries({ queryKey: ['customer-account'] });
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [attempt, queryClient]);

  const profileQuery = useQuery({
    queryKey: ['customer-account', 'profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id,first_name,last_name,phone,company').eq('id', user!.id).maybeSingle();
      if (error) throw error;
      return data as CustomerProfile | null;
    },
    retry: false,
    staleTime: 30_000,
  });
  const link = useCallback((href: string) => customerLink(href, location.search), [location.search]);
  const shop = shopQuery.isError ? null : shopQuery.data;
  const error = sessionError || (shopQuery.isError || (!shopQuery.isLoading && !shop?.id)
    ? 'Vi kunne ikke hente den valgte butik. Prøv igen.' : null)
    || (profileQuery.isError ? 'Vi kunne ikke hente dine kontooplysninger. Prøv igen.' : null);
  useEffect(() => {
    if (sessionReady && !user && !sessionError) navigate(customerAuthHref(`${location.pathname}${location.search}${location.hash}`, location.search), { replace: true });
  }, [sessionReady, user, sessionError, location.pathname, location.search, location.hash, navigate]);

  const value: CustomerAccountValue = {
    user, profile: user ? profileQuery.data ?? null : null, shop,
    loading: !error && (!sessionReady || !user || shopQuery.isLoading || profileQuery.isLoading), error, link,
    retry: () => { setAttempt(current => current + 1); void shopQuery.refetch(); if (user) void profileQuery.refetch(); },
    refetchProfile: profileQuery.refetch,
  };
  return <CustomerAccountContext.Provider value={value}>{children || <Outlet key={`${user?.id || 'signed-out'}:${shop?.id || 'shop-loading'}`} />}</CustomerAccountContext.Provider>;
}

export function useCustomerAccount() {
  const value = useContext(CustomerAccountContext);
  if (!value) throw new Error('Customer account pages require CustomerAccountProvider');
  return value;
}
