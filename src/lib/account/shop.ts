import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPublishedBranding } from '../branding/settings-persistence.ts';

export const CUSTOMER_MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';
export type CustomerShopTarget = { kind: 'id' | 'domain'; value: string };
export interface CustomerShopRow {
  id: string;
  name: string;
  domain: string | null;
  settings: Record<string, unknown> | null;
  is_platform_owned?: boolean;
}
export interface CustomerShopSettings extends Record<string, unknown> {
  id: string;
  tenant_name: string;
  domain: string | null;
  branding: unknown;
  _rawBranding: Record<string, unknown> | undefined;
  subdomain: string | undefined;
  is_platform_owned: boolean;
}

function normalizedHostname(value: string): string {
  const input = value.trim();
  if (!input || /[\\\s]/.test(input)) throw new Error('Butikkens domæne mangler eller er ugyldigt.');
  const url = new URL(input.includes('://') ? input : `https://${input}`);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Butikkens domæne er ugyldigt.');
  }
  return url.hostname.toLowerCase().replace(/\.$/, '');
}

/** Account shop identity comes from the storefront URL, never the signed-in user's admin ownership. */
export function customerShopTarget(hostname: string, search: string, rootDomain = 'webprinter.dk'): CustomerShopTarget {
  const params = new URLSearchParams(search);
  const tenantId = params.get('tenantId');
  const tenantAlias = params.get('tenant_id');
  if (params.has('tenantId') || params.has('tenant_id')) {
    if (tenantId !== null && tenantAlias !== null && tenantId.trim() !== tenantAlias.trim()) throw new Error('Butiksvalget er modstridende.');
    const value = (tenantId ?? tenantAlias ?? '').trim();
    if (!value) throw new Error('Butiksvalget mangler.');
    return { kind: 'id', value };
  }
  const root = normalizedHostname(rootDomain).replace(/^www\./, '');
  const fromDomain = (input: string): CustomerShopTarget => {
    const value = normalizedHostname(input).replace(/^www\./, '');
    return value === root || value === 'webprinter.dk'
      ? { kind: 'id', value: CUSTOMER_MASTER_TENANT_ID }
      : { kind: 'domain', value };
  };
  if (params.has('force_domain')) return fromDomain(params.get('force_domain') || '');
  if (params.has('tenant_subdomain')) {
    const subdomain = (params.get('tenant_subdomain') || '').trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) throw new Error('Butikkens subdomæne er ugyldigt.');
    return fromDomain(subdomain === 'www' ? root : `${subdomain}.${root}`);
  }
  const host = normalizedHostname(hostname);
  if (['localhost', '127.0.0.1', '[::1]', 'webprinter-platform.vercel.app'].includes(host)) return { kind: 'id', value: CUSTOMER_MASTER_TENANT_ID };
  // Retain the existing tenant preview-host mapping, with an exact suffix boundary.
  const previewSuffix = '.webprinter-platform.vercel.app';
  if (host.endsWith(previewSuffix)) return fromDomain(`${host.slice(0, -previewSuffix.length)}.${root}`);
  return fromDomain(host);
}

export async function readCustomerShop(client: SupabaseClient, target: CustomerShopTarget): Promise<CustomerShopRow> {
  if (!target.value) throw new Error('Butiksvalget mangler.');
  const query = client.from('tenants' as never).select('id, name, domain, settings, is_platform_owned');
  const domains = target.kind === 'domain' ? [target.value, `www.${target.value}`] : [];
  const { data, error } = await (target.kind === 'id' ? query.eq('id', target.value) : query.in('domain', domains)).maybeSingle();
  if (error) throw error;
  const tenant = data as unknown as CustomerShopRow | null;
  if (!tenant?.id || (target.kind === 'id' && tenant.id !== target.value)) throw new Error('Den valgte butik kunne ikke findes.');
  if (target.kind === 'domain' && (!tenant.domain || normalizedHostname(tenant.domain).replace(/^www\./, '') !== target.value)) {
    throw new Error('Butikken matcher ikke det valgte domæne.');
  }
  return tenant;
}

/** Same published-branding shape consumed by the existing storefront; no cache or fallback tenant. */
export function customerShopSettings(tenant: CustomerShopRow): CustomerShopSettings {
  const settings = tenant.settings || {};
  const raw = settings.branding as Record<string, unknown> | undefined;
  const branding = extractPublishedBranding(settings);
  return { ...settings, branding, _rawBranding: raw, tenant_name: tenant.name, id: tenant.id, domain: tenant.domain,
    subdomain: tenant.id === CUSTOMER_MASTER_TENANT_ID ? 'master' : undefined, is_platform_owned: tenant.is_platform_owned ?? false };
}
