import { escapeEmailHtml, validEmail, validateEmailConfig, type StorefrontEmailConfig } from './storefrontOrderEmail.ts';

type StatusEmailType = 'status_change' | 'problem_notification';
export interface StatusEmailOrder {
  id: string; tenant_id: string; checkout_attempt_id: string | null;
  order_number: string; product_name: string; quantity: number; total_price: number;
  currency: string | null; status: string; customer_email: string; customer_name: string | null;
  tracking_number: string | null; estimated_delivery: string | null;
  has_problem: boolean; problem_description: string | null; user_id: string | null;
}
export interface StatusEmailTenant {
  id: string; owner_id: string | null; name: string; settings: Record<string, unknown> | null;
}
export interface StatusEmailRepository {
  getUser(token: string): Promise<{ id: string } | null>;
  getTenant(tenantId: string): Promise<StatusEmailTenant | null>;
  getRoles(userId: string): Promise<Array<{ role: string; tenant_id: string | null }>>;
  getOrder(orderId: string, tenantId: string): Promise<StatusEmailOrder | null>;
  getAttempt(attemptId: string, orderId: string, tenantId: string): Promise<{
    id: string; order_id: string | null; tenant_id: string; state: string; livemode: boolean;
  } | null>;
}
const statuses: Record<string, string> = {
  pending: 'Modtaget', processing: 'Behandles', production: 'Under produktion',
  shipped: 'Afsendt', delivered: 'Leveret', cancelled: 'Annulleret', problem: 'Problem med ordre',
};
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const text = (value: unknown, max = 500) => String(value ?? '').slice(0, max);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const statusEmailHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: statusEmailHeaders });

function buildStatusEmail(type: StatusEmailType, order: StatusEmailOrder, tenant: StatusEmailTenant, config: StorefrontEmailConfig) {
  const number = text(order.order_number, 101).trim();
  if (!number || number.length > 100 || [...number].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || !Object.hasOwn(statuses, order.status) || !text(order.product_name).trim()
    || !Number.isInteger(order.quantity) || order.quantity < 1 || !Number.isFinite(Number(order.total_price)) || Number(order.total_price) < 0) {
    throw new Error('saved_order_invalid');
  }
  if (type === 'problem_notification' && (!(order.has_problem || order.status === 'problem') || !text(order.problem_description).trim())) {
    throw new Error('saved_problem_missing');
  }
  const company = record(tenant.settings?.company);
  const shopName = text(company.name || tenant.name || 'Webprinter');
  const support = validEmail(company.email) ? company.email : null;
  const subject = type === 'problem_notification' ? `Handling påkrævet - Ordre ${number}` : `Ordre ${number} - ${statuses[order.status]}`;
  const headline = type === 'problem_notification' ? 'Handling påkrævet' : `Din ordre er nu: ${statuses[order.status]}`;
  const orderUrl = new URL('/min-konto/ordrer', config.siteUrl);
  orderUrl.searchParams.set('tenantId', order.tenant_id); orderUrl.searchParams.set('order', order.id);
  const currency = order.currency || 'DKK';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('saved_order_invalid');
  const fields = [
    ['Ordrenummer', number], ['Produkt', text(order.product_name)], ['Antal', String(order.quantity)],
    ['Samlet beløb', `${Number(order.total_price).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`],
    ['Status', statuses[order.status]],
    ...(type === 'problem_notification' ? [['Problem', text(order.problem_description, 3000)]] : []),
    ...(order.status === 'shipped' ? [['Trackingnummer', text(order.tracking_number)], ['Forventet levering', text(order.estimated_delivery)]] : []),
  ].filter(([, value]) => value);
  const action = order.user_id ? `Se din ordre: ${orderUrl}` : 'Gem ordrenummeret ved spørgsmål til butikken.';
  return {
    from: config.from, to: [order.customer_email.trim().toLowerCase()], ...(support ? { reply_to: support } : {}), subject,
    text: `${shopName}\n\nHej ${text(order.customer_name) || 'kunde'}\n${headline}\n\n${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${action}${support ? `\nKontakt: ${support}` : ''}`,
    html: `<!doctype html><html lang="da"><head><meta charset="utf-8"></head><body style="font:16px/1.6 Arial,sans-serif;color:#172033"><main style="max-width:600px;margin:24px auto"><h2>${escapeEmailHtml(shopName)}</h2><p>Hej ${escapeEmailHtml(order.customer_name || 'kunde')}</p><h1>${escapeEmailHtml(headline)}</h1><table>${fields.map(([label, value]) => `<tr><th style="text-align:left;padding:8px">${escapeEmailHtml(label)}</th><td style="padding:8px">${escapeEmailHtml(value)}</td></tr>`).join('')}</table><p>${order.user_id ? `<a href="${escapeEmailHtml(orderUrl.toString())}">Se din ordre</a>` : escapeEmailHtml(action)}</p>${support ? `<p>Kontakt: ${escapeEmailHtml(support)}</p>` : ''}</main></body></html>`,
  };
}

/** Manual operational mail only. Confirmation/new-order notifications use the durable outbox. */
export async function handleStorefrontStatusEmail(req: Request, repository: StatusEmailRepository, config: StorefrontEmailConfig, fetcher: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: statusEmailHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    if (Number(req.headers.get('content-length')) > 16384) return json({ error: 'invalid_request' }, 413);
    const raw = await req.text();
    if (raw.length > 16384) return json({ error: 'invalid_request' }, 413);
    let body: Record<string, unknown>;
    try { body = record(JSON.parse(raw)); } catch { return json({ error: 'invalid_request' }, 400); }
    if (body.type === 'order_confirmation' || body.type === 'admin_new_order') return json({ error: 'use_durable_checkout_notifications' }, 409);
    if ((body.type !== 'status_change' && body.type !== 'problem_notification') || !uuid(body.order_id) || !uuid(body.tenant_id)) return json({ error: 'invalid_request' }, 400);
    const bearer = req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!bearer || bearer.length > 8192) return json({ error: 'unauthorized' }, 401);
    const user = await repository.getUser(bearer);
    if (!user || !uuid(user.id)) return json({ error: 'unauthorized' }, 401);
    const [tenant, roles] = await Promise.all([repository.getTenant(body.tenant_id), repository.getRoles(user.id)]);
    const authorized = tenant?.id === body.tenant_id && (tenant.owner_id === user.id || roles.some(role => role.role === 'master_admin'
      || (['admin', 'staff'].includes(role.role) && role.tenant_id === body.tenant_id)));
    if (!authorized || !tenant) return json({ error: 'forbidden' }, 403);
    const order = await repository.getOrder(body.order_id, body.tenant_id);
    if (!order || order.id !== body.order_id || order.tenant_id !== body.tenant_id) return json({ error: 'forbidden' }, 403);
    try { validateEmailConfig(config); } catch { return json({ error: config.mode === 'disabled' ? 'email_dispatch_disabled' : 'email_dispatch_not_configured' }, config.mode === 'disabled' ? 409 : 503); }
    const recipient = typeof order.customer_email === 'string' ? order.customer_email.trim().toLowerCase() : '';
    if (!validEmail(recipient) || (config.allowlist && !config.allowlist.includes(recipient))) return json({ error: 'recipient_not_allowed' }, 409);
    if (order.checkout_attempt_id) {
      const attempt = await repository.getAttempt(order.checkout_attempt_id, order.id, order.tenant_id);
      if (!attempt || attempt.id !== order.checkout_attempt_id || attempt.order_id !== order.id || attempt.tenant_id !== order.tenant_id
        || attempt.state !== 'completed' || attempt.livemode !== (config.mode === 'live')) return json({ error: 'email_mode_mismatch' }, 409);
    } else if (config.mode !== 'live') return json({ error: 'email_mode_mismatch' }, 409);
    // All message fields come from authenticated, exact saved rows. Extra caller fields are ignored.
    let payload: ReturnType<typeof buildStatusEmail>;
    try { payload = buildStatusEmail(body.type, order, tenant, config); } catch { return json({ error: 'saved_order_not_emailable' }, 409); }
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `storefront-status-email/v1/${order.id}/${body.type}/${digest}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return json({ error: 'email_provider_unconfirmed' }, 503);
    const result = await response.json().catch(() => null);
    if (typeof result?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(result.id)) return json({ error: 'email_provider_unconfirmed' }, 503);
    return json({ success: true, accepted: true });
  } catch { return json({ error: 'email_temporarily_unavailable' }, 503); }
}
