import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { authorizedEmailDispatcher, dispatchStorefrontOrderEmails, type EmailRepository, type StorefrontEmailConfig } from '../_shared/storefrontOrderEmail.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
function serviceKey() {
  try { const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; if (typeof key === 'string' && key) return key; } catch { /* Legacy project fallback. */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!await authorizedEmailDispatcher(req.headers.get('Authorization'), Deno.env.get('STOREFRONT_ORDER_EMAIL_CRON_SECRET') || '')) return json({ error: 'unauthorized' }, 401);
  const mode = Deno.env.get('STOREFRONT_ORDER_EMAIL_MODE') || 'disabled';
  if (mode === 'disabled') return json({ error: 'email_dispatch_disabled' }, 409);
  if (mode !== 'test' && mode !== 'live') return json({ error: 'email_dispatch_not_configured' }, 503);
  const rawAllowlist = Deno.env.get('STOREFRONT_ORDER_EMAIL_RECIPIENT_ALLOWLIST') || '';
  const config: StorefrontEmailConfig = {
    mode, apiKey: Deno.env.get('RESEND_API_KEY') || '', from: Deno.env.get('CONTACT_EMAIL_FROM') || '',
    siteUrl: Deno.env.get('STOREFRONT_ORDER_EMAIL_SITE_URL') || '',
    allowlist: rawAllowlist.trim() ? [...new Set(rawAllowlist.split(',').map(email => email.trim().toLowerCase()).filter(Boolean))] : null,
  };
  const url = Deno.env.get('SUPABASE_URL'), key = serviceKey();
  if (!url || !key) return json({ error: 'email_dispatch_not_configured' }, 503);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const repository: EmailRepository = {
    async claim(limit, live, allowlist) {
      const { data, error } = await client.rpc('claim_storefront_order_emails', { p_limit: limit, p_livemode: live, p_recipient_allowlist: allowlist });
      if (error || !Array.isArray(data)) throw new Error('claim_failed'); return data;
    },
    async prepare(row, payload) {
      const { data, error } = await client.rpc('prepare_storefront_order_email', { p_id: row.id, p_claim_token: row.claim_token, p_payload: payload });
      if (error || !data) throw new Error('prepare_failed'); return data;
    },
    async finish(row, status, providerId, errorCode) {
      const { data, error } = await client.rpc('finish_storefront_order_email', { p_id: row.id, p_claim_token: row.claim_token, p_status: status, p_provider_message_id: providerId || null, p_error_code: errorCode || null });
      if (error) throw new Error('checkpoint_failed'); return data === true;
    },
  };
  try { return json(await dispatchStorefrontOrderEmails(repository, config)); }
  catch { return json({ error: 'email_dispatch_unavailable' }, 503); }
});
