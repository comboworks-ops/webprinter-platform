/** Durable checkout email v1. Provider acceptance is not proof of inbox delivery. */
export type EmailStatus = 'pending' | 'processing' | 'sent' | 'needs_review' | 'failed';
export interface StorefrontEmailRow {
  id: string; attempt_id: string; order_id: string; tenant_id: string;
  notification_type: 'customer_confirmation' | 'operator_new_order'; recipient_email: string;
  livemode: boolean; message_snapshot: Record<string, unknown>; provider_payload: Record<string, unknown> | null;
  claim_token: string; attempts: number; first_attempt_at: string;
}
export interface StorefrontEmailConfig {
  mode: 'disabled' | 'test' | 'live'; apiKey: string; from: string; siteUrl: string; allowlist: string[] | null;
}
export interface EmailRepository {
  claim(limit: number, live: boolean, allowlist: string[] | null): Promise<StorefrontEmailRow[]>;
  prepare(row: StorefrontEmailRow, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  finish(row: StorefrontEmailRow, status: EmailStatus, providerId?: string, errorCode?: string): Promise<boolean>;
}
export const validEmail = (value: unknown): value is string => typeof value === 'string'
  && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const uuid = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const text = (value: unknown, max = 500) => String(value ?? '').slice(0, max);
export const escapeEmailHtml = (value: unknown) => text(value, 4000).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
function validFrom(value: string) {
  if (!value || value.length > 320 || /[\r\n\x00-\x1f]/.test(value)) return false;
  if (validEmail(value as unknown)) return true;
  const match = value.match(/^[^<>]+<([^<>]+)>$/);
  return !!match && validEmail(match[1]);
}
export function validEmailSiteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
      && !url.search && !url.hash && url.pathname === '/' && value === url.origin + (value.endsWith('/') ? '/' : '');
  } catch { return false; }
}
export function validateEmailConfig(config: StorefrontEmailConfig) {
  if (config.mode === 'disabled') throw new Error('email_dispatch_disabled');
  if (!['test', 'live'].includes(config.mode) || !config.apiKey || !validFrom(config.from) || !validEmailSiteUrl(config.siteUrl)) throw new Error('email_dispatch_not_configured');
  if (config.mode === 'test' && !config.allowlist?.length) throw new Error('test_recipient_allowlist_required');
  if (config.allowlist?.some(email => !validEmail(email) || email !== email.toLowerCase())) throw new Error('recipient_allowlist_invalid');
}
export async function authorizedEmailDispatcher(header: string | null, secret: string): Promise<boolean> {
  if (secret.length < 32 || secret.length > 256 || !header?.startsWith('Bearer ') || header.length > 1024) return false;
  const encode = (value: string) => new TextEncoder().encode(value);
  const [actual, expected] = await Promise.all([crypto.subtle.digest('SHA-256', encode(header.slice(7))), crypto.subtle.digest('SHA-256', encode(secret))]);
  let difference = 0;
  const a = new Uint8Array(actual), b = new Uint8Array(expected);
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}
export function buildStorefrontEmail(row: StorefrontEmailRow, from: string, siteUrl: string): Record<string, unknown> {
  const s = row.message_snapshot;
  if (!validFrom(from) || !validEmailSiteUrl(siteUrl) || !validEmail(row.recipient_email) || !uuid(row.id) || !uuid(row.order_id) || !uuid(row.tenant_id)
    || s.version !== 1 || s.order_id !== row.order_id || s.tenant_id !== row.tenant_id
    || !['customer_confirmation', 'operator_new_order'].includes(row.notification_type)) throw new Error('email_snapshot_invalid');
  const quantity = Number(s.quantity), total = Number(s.total_price);
  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(total) || total <= 0 || s.currency !== 'DKK') throw new Error('email_snapshot_invalid');
  const orderNumber = text(s.order_number, 100).replace(/[\r\n\x00-\x1f]/g, ' ');
  if (!orderNumber.trim() || !text(s.product_name).trim() || !text(s.shop_name).trim()) throw new Error('email_snapshot_invalid');
  const operator = row.notification_type === 'operator_new_order';
  const subject = `${operator ? 'Ny ordre modtaget' : 'Ordrebekræftelse'} - ${orderNumber}`;
  const headline = operator ? 'Ny ordre modtaget' : 'Tak for din ordre';
  const introduction = operator ? 'Butikken har modtaget en betalt ordre med produktionsfil.' : 'Din betaling, ordre og produktionsfil er registreret.';
  const totalLabel = `${total.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DKK`;
  const orderUrl = new URL('/min-konto/ordrer', siteUrl);
  orderUrl.searchParams.set('tenantId', row.tenant_id); orderUrl.searchParams.set('order', row.order_id);
  const fields = [['Ordrenummer', orderNumber], ['Produkt', text(s.product_name)], ['Antal', String(quantity)], ['Samlet beløb', totalLabel],
    ['Leveringsmetode', text(s.delivery_type)], ['Levering til', text(s.delivery_summary, 1500)]];
  if (operator) fields.push(['Kunde', text(s.customer_name)], ['Kundens email', text(s.customer_email)]);
  const support = validEmail(s.support_email) ? s.support_email : null;
  const action = !operator && s.has_customer_account === true ? `Se din ordre: ${orderUrl}` : 'Gem ordrenummeret ved spørgsmål til butikken.';
  return {
    from, to: [row.recipient_email], ...(support ? { reply_to: support } : {}), subject,
    text: `${text(s.shop_name)}\n\n${headline}\n${introduction}\n\n${fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${action}${support ? `\nKontakt: ${support}` : ''}`,
    html: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f5f5;font:16px/1.6 Arial,sans-serif;color:#172033"><main style="max-width:600px;margin:24px auto;background:white;border-radius:8px;overflow:hidden"><header style="padding:24px;background:#0879c8;color:white"><h2 style="margin:0">${escapeEmailHtml(s.shop_name)}</h2></header><section style="padding:28px"><h1>${headline}</h1><p>${introduction}</p><table style="width:100%;border-collapse:collapse">${fields.filter(([, value]) => value).map(([label, value]) => `<tr><th style="text-align:left;padding:10px 8px 10px 0;border-bottom:1px solid #ddd">${label}</th><td style="padding:10px 0;border-bottom:1px solid #ddd">${escapeEmailHtml(value)}</td></tr>`).join('')}</table><p>${!operator && s.has_customer_account === true ? `<a href="${escapeEmailHtml(orderUrl.toString())}">Se din ordre</a>` : escapeEmailHtml(action)}</p>${support ? `<p>Kontakt butikken: <a href="mailto:${escapeEmailHtml(support)}">${escapeEmailHtml(support)}</a></p>` : ''}</section></main></body></html>`,
  };
}

export async function dispatchStorefrontOrderEmails(repository: EmailRepository, config: StorefrontEmailConfig, fetcher: typeof fetch = fetch) {
  validateEmailConfig(config);
  const rows = await repository.claim(5, config.mode === 'live', config.allowlist);
  const result = { claimed: rows.length, sent: 0, pending: 0, needs_review: 0, failed: 0, unrecorded: 0 };
  for (const row of rows) {
    let status: EmailStatus = 'pending', providerId: string | undefined, errorCode: string | undefined;
    try {
      // Defense in depth: never send a wrong-mode or disallowed row even if a
      // repository adapter returns data outside the atomic claim predicate.
      if (row.livemode !== (config.mode === 'live') || (config.allowlist && !config.allowlist.includes(row.recipient_email))) {
        status = 'needs_review'; errorCode = 'dispatch_scope_mismatch';
      } else {
        let payload: Record<string, unknown>;
        try { payload = row.provider_payload || buildStorefrontEmail(row, config.from, config.siteUrl); }
        catch { status = 'failed'; errorCode = 'email_snapshot_invalid'; }
        if (!errorCode) {
          // Persist the exact provider body before the first HTTP request. A
          // later template/from setting change cannot change this retry body.
          payload = await repository.prepare(row, payload!);
          if (!Array.isArray(payload.to) || payload.to.length !== 1 || payload.to[0] !== row.recipient_email) throw new Error('email_payload_scope_mismatch');
          const response = await fetcher('https://api.resend.com/emails', {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
            headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `storefront-order-email/v1/${row.id}` },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            const body = await response.json().catch(() => null);
            if (typeof body?.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(body.id)) { status = 'sent'; providerId = body.id; }
            else errorCode = 'provider_response_unconfirmed';
          } else if (response.status === 409) { status = 'needs_review'; errorCode = 'provider_idempotency_conflict'; }
          else if (response.status === 429 || response.status === 408 || response.status >= 500) errorCode = 'provider_retryable_response';
          else { status = row.attempts > 1 ? 'needs_review' : 'failed'; errorCode = 'provider_rejected_request'; }
        }
      }
    } catch {
      // Timeout or failure to save a provider response is ambiguous. Keep the
      // same frozen body/key and retry only inside the database's bounded window.
      errorCode = 'provider_or_checkpoint_unconfirmed';
    }
    try {
      if (await repository.finish(row, status, providerId, errorCode)) result[status as 'sent' | 'pending' | 'needs_review' | 'failed']++;
      else result.unrecorded++;
    } catch { result.unrecorded++; }
  }
  return result;
}
