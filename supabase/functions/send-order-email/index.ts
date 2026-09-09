import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { handleStorefrontStatusEmail, statusEmailHeaders, type StatusEmailRepository } from '../_shared/storefrontStatusEmail.ts';
import type { StorefrontEmailConfig } from '../_shared/storefrontOrderEmail.ts';

function serviceKey() {
  try { const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; if (typeof key === 'string' && key) return key; } catch { /* Legacy project fallback. */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: statusEmailHeaders });
  const limited = checkRateLimit(req, { keyPrefix: 'send-order-email', limit: 10, windowMs: 60_000 });
  if (limited) return new Response(limited.body, { status: limited.status, headers: { ...statusEmailHeaders } });
  const url = Deno.env.get('SUPABASE_URL'), key = serviceKey();
  if (!url || !key) return new Response(JSON.stringify({ error: 'email_dispatch_not_configured' }), { status: 503, headers: statusEmailHeaders });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const repository: StatusEmailRepository = {
    async getUser(token) { const { data, error } = await client.auth.getUser(token); return error ? null : data.user; },
    async getTenant(id) {
      const { data, error } = await client.from('tenants').select('id,owner_id,name,settings').eq('id', id).maybeSingle();
      if (error) throw new Error('tenant_lookup_failed'); return data;
    },
    async getRoles(userId) {
      const { data, error } = await client.from('user_roles').select('role,tenant_id').eq('user_id', userId);
      if (error || !Array.isArray(data)) throw new Error('role_lookup_failed'); return data;
    },
    async getOrder(orderId, tenantId) {
      const { data, error } = await client.from('orders')
        .select('id,tenant_id,checkout_attempt_id,order_number,product_name,quantity,total_price,currency,status,customer_email,customer_name,tracking_number,estimated_delivery,has_problem,problem_description,user_id')
        .eq('id', orderId).eq('tenant_id', tenantId).maybeSingle();
      if (error) throw new Error('order_lookup_failed'); return data;
    },
    async getAttempt(attemptId, orderId, tenantId) {
      const { data, error } = await client.from('storefront_checkout_attempts').select('id,order_id,tenant_id,state,livemode')
        .eq('id', attemptId).eq('order_id', orderId).eq('tenant_id', tenantId).maybeSingle();
      if (error) throw new Error('attempt_lookup_failed'); return data;
    },
  };
  const mode = Deno.env.get('STOREFRONT_ORDER_EMAIL_MODE') || 'disabled';
  const rawAllowlist = Deno.env.get('STOREFRONT_ORDER_EMAIL_RECIPIENT_ALLOWLIST') || '';
  const config: StorefrontEmailConfig = {
    mode: mode === 'test' || mode === 'live' ? mode : 'disabled',
    apiKey: Deno.env.get('RESEND_API_KEY') || '', from: Deno.env.get('CONTACT_EMAIL_FROM') || '',
    siteUrl: Deno.env.get('STOREFRONT_ORDER_EMAIL_SITE_URL') || '',
    allowlist: rawAllowlist.trim() ? [...new Set(rawAllowlist.split(',').map(email => email.trim().toLowerCase()).filter(Boolean))] : null,
  };
  return handleStorefrontStatusEmail(req, repository, config);
});
