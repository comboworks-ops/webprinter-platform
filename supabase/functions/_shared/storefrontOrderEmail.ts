/** Durable checkout email v1. Provider acceptance is not proof of inbox delivery. */
import { brandedEmailFrom, renderEmailLetter, resolveEmailBrand, type EmailTenant } from './storefrontEmailDesign.ts';
import { checkoutTaxEmailFields } from './storefrontTax.ts';
export { escapeEmailHtml } from './storefrontEmailDesign.ts';
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
/** Test order mail must not require a global key that activates unrelated legacy handlers. */
export function resolveStorefrontEmailApiKey(mode: string, read: (name: string) => string | undefined): string {
  if (mode !== 'test' && mode !== 'live') return '';
  return read('STOREFRONT_ORDER_EMAIL_RESEND_API_KEY') || (mode === 'live' ? read('RESEND_API_KEY') || '' : '');
}
export interface EmailRepository {
  claim(limit: number, live: boolean, allowlist: string[] | null): Promise<StorefrontEmailRow[]>;
  getTenant?(tenantId: string): Promise<EmailTenant | null>;
  prepare(row: StorefrontEmailRow, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  finish(row: StorefrontEmailRow, status: EmailStatus, providerId?: string, errorCode?: string): Promise<boolean>;
}
export const validEmail = (value: unknown): value is string => typeof value === 'string'
  && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const uuid = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const text = (value: unknown, max = 500) => String(value ?? '').slice(0, max);
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
export function buildStorefrontEmail(row: StorefrontEmailRow, from: string, siteUrl: string, tenant: EmailTenant | null = null): Record<string, unknown> {
  const s = row.message_snapshot;
  if (!validFrom(from) || !validEmailSiteUrl(siteUrl) || !validEmail(row.recipient_email) || !uuid(row.id) || !uuid(row.order_id) || !uuid(row.tenant_id)
    || s.version !== 1 || s.order_id !== row.order_id || s.tenant_id !== row.tenant_id
    || (tenant && tenant.id !== row.tenant_id)
    || !['customer_confirmation', 'operator_new_order'].includes(row.notification_type)) throw new Error('email_snapshot_invalid');
  const quantity = Number(s.quantity), total = Number(s.total_price);
  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(total) || total <= 0 || s.currency !== 'DKK') throw new Error('email_snapshot_invalid');
  const orderNumber = text(s.order_number, 100).replace(/[\r\n\x00-\x1f]/g, ' ');
  if (!orderNumber.trim() || !text(s.product_name).trim() || !text(s.shop_name).trim()) throw new Error('email_snapshot_invalid');
  const operator = row.notification_type === 'operator_new_order';
  const subject = `${operator ? 'Ny ordre modtaget' : 'Ordrebekræftelse'} - ${orderNumber}`;
  const headline = operator ? 'En ny ordre er klar til behandling.' : 'Tak for din ordre.';
  const introduction = operator ? 'Betalingen er registreret, og kundens fil er gemt på ordren. Gennemgå ordren og filen før produktion.' : 'Vi har modtaget din betaling og gemt din fil sammen med ordren. Du hører fra os, når der er nyt.';
  const totalLabel = `${total.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DKK`;
  const orderUrl = new URL('/min-konto/ordrer', siteUrl);
  orderUrl.searchParams.set('tenantId', row.tenant_id); orderUrl.searchParams.set('order', row.order_id);
  const fields = [['Ordrenummer', orderNumber], ['Produkt', text(s.product_name)], ['Antal', String(quantity)], ...checkoutTaxEmailFields(s.checkout_tax, total), ['Samlet beløb', totalLabel],
    ['Leveringsmetode', text(s.delivery_type)], ['Levering til', text(s.delivery_summary, 1500)]];
  if (operator) fields.push(['Kunde', text(s.customer_name)], ['Kundens email', text(s.customer_email)]);
  const support = validEmail(s.support_email) ? s.support_email : null;
  const action = !operator && s.has_customer_account === true ? `Se din ordre: ${orderUrl}` : 'Gem ordrenummeret ved spørgsmål til butikken.';
  const brand = resolveEmailBrand(tenant, text(s.shop_name), siteUrl);
  return {
    from: brandedEmailFrom(from, brand.name), to: [row.recipient_email], ...(support ? { reply_to: support } : {}), subject,
    text: `${brand.name}\n\n${headline}\n${introduction}\n\n${fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${action}${support ? `\nKontakt: ${support}` : ''}`,
    html: renderEmailLetter(brand, {
      label: operator ? 'Ny ordre' : 'Ordrebekræftelse', headline, introduction, orderNumber,
      greeting: !operator && text(s.customer_name).trim() ? `Hej ${text(s.customer_name, 100)}` : undefined,
      fields: fields.filter(([label]) => !['Ordrenummer', 'Samlet beløb'].includes(label)), total: totalLabel, support,
      ...(!operator && s.has_customer_account === true ? { action: { label: 'Se din ordre', url: orderUrl.toString() } } : {}),
      note: operator ? 'Kontrollér fil, leveringsvalg og eventuelle bemærkninger, før ordren sendes til produktion.' : 'Gem denne bekræftelse. Oplys dit ordrenummer, hvis du har spørgsmål til os.',
    }),
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
        // A transient settings read failure remains retryable, before any provider request.
        const tenant = !row.provider_payload && repository.getTenant ? await repository.getTenant(row.tenant_id) : null;
        if (!row.provider_payload && repository.getTenant && !tenant) throw new Error('email_tenant_unavailable');
        try {
          if (row.provider_payload) payload = row.provider_payload;
          else {
            payload = buildStorefrontEmail(row, config.from, config.siteUrl, tenant);
          }
        }
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
