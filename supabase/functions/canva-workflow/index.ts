import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { readSupabaseKey } from '../_shared/supabaseKeys.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { CANVA_TEMPLATES, CANVA_PHOTO_LIMIT, validateCanvaText, validateCanvaPhoto, assertCanvaDataset, assertCustomerCopy, canvaUrl } from '../../../shared/canva.ts';
import { randomSecret, sha256, tokenVault, boundedBytes, callbackUri } from './security.ts';

const API = 'https://api.canva.com/rest/v1';
const MASTER = '00000000-0000-0000-0000-000000000000';
const env = (name: string) => Deno.env.get(name) || '';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Token = { access_token: string; refresh_token: string; expires_in: number };
type Job = { id: string; status: string; asset?: { id: string }; result?: { type: string; design?: { id: string } }; urls?: string[] };
type CanvaResult = { job?: Job; dataset?: Record<string, { type: string }>; design?: { id: string; urls: { edit_url: string }; thumbnail?: { url: string } } };
type Draft = { id: string; user_id: string; tenant_id: string; product_id: string; template_key: string; source_design_id: string; design_id: string | null; status: string; text_values: Record<string,string>; checkout_state: Record<string,unknown>; upload_job_id: string; autofill_job_id: string; export_job_id: string | null; export_request_id: string | null; export_starting: boolean; error_message: string | null; updated_at: string };

async function exchange(body: Record<string,string>, readEnv = env, request = fetch): Promise<Token> {
  const response = await request(`${API}/oauth/token`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Basic ${btoa(`${readEnv('CANVA_CLIENT_ID')}:${readEnv('CANVA_CLIENT_SECRET')}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  if (!response.ok) throw new Error('Canva-forbindelsen skal oprettes igen.');
  const token = await response.json();
  if (!token.access_token || !token.refresh_token || !Number.isFinite(token.expires_in)) throw new Error('Canva-forbindelsen kunne ikke gemmes.');
  return token;
}

export function createCanvaHandler(dependencies: { createClient?: typeof createClient; requireUser?: typeof requireUser; checkRateLimit?: typeof checkRateLimit; env?: typeof env; fetch?: typeof fetch } = {}) {
  const makeClient = dependencies.createClient || createClient;
  const authenticate = dependencies.requireUser || requireUser;
  const rateLimit = dependencies.checkRateLimit || checkRateLimit;
  const readEnv = dependencies.env || env;
  const request = dependencies.fetch || fetch;
  return async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin') || '';
  const origins = readEnv('CANVA_ALLOWED_ORIGINS').split(',').map(value => value.trim()).filter(Boolean);
  const headers = { 'Access-Control-Allow-Origin': origins.includes(origin) ? origin : 'null', 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin' };
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    if (readEnv('CANVA_WORKFLOW_ENABLED') !== 'true' || !readEnv('CANVA_CLIENT_ID') || !readEnv('CANVA_CLIENT_SECRET')) return json({ error: 'Canva-forbindelsen er endnu ikke aktiveret i denne shop.' }, 503);
    // Canva has one configured return URL per app. Pilot on that exact origin;
    // tenant IDs may differ, but cross-domain return brokerage is not implemented.
    if (origins.length !== 1) return json({ error: 'Canva-appens returadresse skal konfigureres til denne shop.' }, 503);
    const redirectUri = callbackUri(origin, origins);
    const auth = await authenticate(req);
    if (!auth.ok) return json({ error: 'Log ind for at gemme dit design.' }, 401);
    const userId = auth.user.id;
    const limited = rateLimit(req, { keyPrefix: `canva:${userId}`, limit: 45, windowMs: 60000 });
    if (limited) return json({ error: 'Vent et øjeblik og prøv igen.' }, 429);
    // Bound the body before parsing multipart data or JSON.
    const bytes = await boundedBytes(req, CANVA_PHOTO_LIMIT + 65536);
    const multipart = req.headers.get('content-type')?.startsWith('multipart/form-data');
    const form = multipart ? await new Response(bytes, { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData() : null;
    const input = JSON.parse(form ? String(form.get('input')) : new TextDecoder().decode(bytes));
    const tenantId = String(input.tenantId || '');
    if (!UUID.test(tenantId)) return json({ error: 'Shoppen kunne ikke findes.' }, 400);
    const db = makeClient(readEnv('SUPABASE_URL'), readSupabaseKey(name => readEnv(name), 'secret')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: tenant, error: tenantError } = await db.from('tenants').select('id,settings').eq('id', tenantId).maybeSingle();
    if (tenantError || !tenant || tenant.settings?.canva?.enabled !== true) return json({ error: 'Canva er ikke aktiveret i shoppen.' }, 403);
    const scope = `${userId}:${tenantId}`;
    const vault = await tokenVault(readEnv('CANVA_TOKEN_ENCRYPTION_KEY'));
    const connectionQuery = () => db.from('canva_customer_connections').select('*').eq('user_id', userId).eq('tenant_id', tenantId);
    const owned = () => db.from('canva_customer_drafts').select('*').eq('user_id', userId).eq('tenant_id', tenantId);
    const updateDraft = async (id: string, patch: Record<string,unknown>) => {
      const { error } = await db.from('canva_customer_drafts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).eq('tenant_id', tenantId);
      if (error) throw new Error('Designets status kunne ikke gemmes. Genindlæs siden.');
    };
    async function accessToken() {
      const { data: connection, error } = await connectionQuery().maybeSingle();
      if (error || !connection) throw new Error('Forbind din Canva-konto først.');
      let token: Token = await vault.open(connection.token_ciphertext, scope);
      if (Date.parse(connection.expires_at) > Date.now() + 60000) return token.access_token;
      const { data: claim, error: lockError } = await db.from('canva_customer_connections').update({ lock_until: new Date(Date.now() + 45000).toISOString() })
        .eq('user_id', userId).eq('tenant_id', tenantId).lt('lock_until', new Date().toISOString()).select('user_id').maybeSingle();
      if (lockError || !claim) throw new Error('Canva-forbindelsen opdateres. Prøv igen om et øjeblik.');
      try {
        // Re-read after acquiring the lock so concurrent refreshes never use an old refresh token.
        const { data: fresh, error: freshError } = await connectionQuery().single();
        if (freshError) throw freshError;
        token = await vault.open(fresh.token_ciphertext, scope);
        if (Date.parse(fresh.expires_at) <= Date.now() + 60000) {
          token = await exchange({ grant_type: 'refresh_token', refresh_token: token.refresh_token }, readEnv, request);
          const { error: saveError } = await db.from('canva_customer_connections').update({ token_ciphertext: await vault.seal(token, scope), expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString() })
            .eq('user_id', userId).eq('tenant_id', tenantId);
          if (saveError) throw new Error('Forbind Canva igen.');
        }
        return token.access_token;
      } finally {
        await db.from('canva_customer_connections').update({ lock_until: new Date(0).toISOString() }).eq('user_id', userId).eq('tenant_id', tenantId);
      }
    }
    let bearer: string | undefined;
    async function canva(path: string, init: RequestInit = {}): Promise<CanvaResult> {
      bearer ||= await accessToken();
      const response = await request(`${API}${path}`, { ...init, redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...init.headers } });
      if (!response.ok) {
        if ([401,403].includes(response.status)) throw new Error('Canva kræver adgang til skabelonen og en konto med autofill. Forbind kontoen igen, eller kontakt shoppen.');
        if (response.status === 429) throw new Error('Canva er optaget. Vent lidt og prøv igen.');
        throw new Error('Canva kunne ikke gennemføre handlingen. Prøv at hente status igen.');
      }
      return await response.json();
    }
    if (input.action === 'catalog') {
      if (!UUID.test(input.productId || '')) throw new Error('Vælg et produkt først.');
      const { data: product, error } = await db.from('products').select('id,tenant_id,technical_specs,is_published').eq('id', input.productId).eq('is_published', true).maybeSingle();
      const config = product?.technical_specs?.canva;
      if (error || !product || ![tenantId,MASTER].includes(product.tenant_id) || config?.enabled !== true || config?.mode !== 'autofill') return json({ templateKeys: [] });
      return json({ templateKeys: CANVA_TEMPLATES.filter(template => Array.isArray(config.template_keys) && config.template_keys.includes(template.key)
        && input.widthMm === template.widthMm && input.heightMm === template.heightMm).map(template => template.key) });
    }
    if (input.action === 'status') {
      const { data: connection, error } = await connectionQuery().maybeSingle();
      if (error) throw new Error('Forbindelsen kunne ikke kontrolleres.');
      const { data: drafts, error: draftsError } = await owned().order('created_at', { ascending: false }).limit(20);
      if (draftsError) throw new Error('Dine designs kunne ikke hentes.');
      return json({ connected: !!connection, drafts: (drafts || []).map((draft: Draft) => ({ id: draft.id, templateKey: draft.template_key, status: draft.status })) });
    }
    if (input.action === 'connect') {
      const state = randomSecret(), verifier = randomSecret();
      const { error } = await db.from('canva_customer_oauth').insert({ state_hash: await sha256(state), user_id: userId, tenant_id: tenantId,
        verifier_ciphertext: await vault.seal(verifier, scope), redirect_uri: redirectUri, expires_at: new Date(Date.now() + 600000).toISOString() });
      if (error) throw new Error('Forbindelsen kunne ikke startes.');
      const url = new URL('https://www.canva.com/api/oauth/authorize');
      url.search = new URLSearchParams({ client_id: readEnv('CANVA_CLIENT_ID'), response_type: 'code', redirect_uri: redirectUri, state,
        code_challenge: await sha256(verifier), code_challenge_method: 'S256', scope: 'design:content:read design:content:write design:meta:read asset:read asset:write' }).toString();
      return json({ url: url.href });
    }
    if (input.action === 'callback') {
      if (typeof input.state !== 'string' || input.state.length > 200 || typeof input.code !== 'string' || input.code.length > 4096) throw new Error('Ugyldigt Canva-svar.');
      // DELETE ... RETURNING is an atomic, one-use state claim tied to the authenticated customer.
      const { data: state, error } = await db.from('canva_customer_oauth').delete().eq('state_hash', await sha256(input.state)).eq('user_id', userId)
        .eq('tenant_id', tenantId).eq('redirect_uri', redirectUri).gt('expires_at', new Date().toISOString()).select('*').maybeSingle();
      if (error || !state) throw new Error('Forbindelsen er udløbet eller allerede brugt. Start den igen.');
      const token = await exchange({ grant_type: 'authorization_code', code: input.code, code_verifier: await vault.open(state.verifier_ciphertext, scope), redirect_uri: state.redirect_uri }, readEnv, request);
      const { error: saveError } = await db.from('canva_customer_connections').upsert({ user_id: userId, tenant_id: tenantId, token_ciphertext: await vault.seal(token, scope), expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), lock_until: new Date(0).toISOString() });
      if (saveError) throw new Error('Forbindelsen kunne ikke gemmes.');
      return json({ connected: true });
    }
    if (input.action === 'create') {
      if (!UUID.test(input.id || '') || !UUID.test(input.productId || '')) throw new Error('Vælg et produkt først.');
      // Idempotent even after a lost response: an existing operation is never posted again.
      const { data: prior, error: priorError } = await owned().eq('id', input.id).maybeSingle();
      if (priorError) throw priorError;
      if (prior) return json({ id: prior.id, status: prior.status });
      const template = CANVA_TEMPLATES.find(item => item.key === input.templateKey);
      const { data: product, error: productError } = await db.from('products').select('id,tenant_id,technical_specs,is_published').eq('id', input.productId).eq('is_published', true).maybeSingle();
      const config = product?.technical_specs?.canva;
      if (!template || productError || !product || ![tenantId,MASTER].includes(product.tenant_id) || config?.enabled !== true || config?.mode !== 'autofill'
        || !Array.isArray(config.template_keys) || !config.template_keys.includes(template.key)) return json({ error: 'Designet er ikke tilgængeligt til dette produkt.' }, 403);
      const checkout = input.checkout;
      if (!checkout || checkout.productId !== product.id || checkout.designWidthMm !== template.widthMm || checkout.designHeightMm !== template.heightMm
        || JSON.stringify(checkout).length > 50000) throw new Error('Vælg A5, stående, på produktsiden først.');
      const values = validateCanvaText(input.text);
      const photo = form?.get('photo');
      if (!(photo instanceof File)) throw new Error('Vælg dit eget foto.');
      const photoBytes = new Uint8Array(await photo.arrayBuffer());
      validateCanvaPhoto(photoBytes, photo.type);
      assertCanvaDataset((await canva(`/designs/${template.designId}/dataset`)).dataset);
      const { error: insertError } = await db.from('canva_customer_drafts').insert({ id: input.id, user_id: userId, tenant_id: tenantId, product_id: product.id,
        template_key: template.key, source_design_id: template.designId, text_values: values, checkout_state: checkout, status: 'starting' });
      if (insertError) {
        if (insertError.code === '23505') return json({ id: input.id, status: 'starting' });
        throw insertError;
      }
      try {
        const result = await canva('/asset-uploads', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Asset-Upload-Metadata': JSON.stringify({ name_base64: btoa('WebPrinter customer photo') }) }, body: photoBytes });
        if (!result.job?.id) throw new Error('Fotoet kunne ikke sendes til Canva.');
        await updateDraft(input.id, { upload_job_id: result.job.id, status: 'uploading' });
      } catch {
        await updateDraft(input.id, { status: 'failed', error_message: 'Fotoet kunne ikke bekræftes hos Canva. Start en ny kopi.' });
      }
      return json({ id: input.id });
    }
    if (!UUID.test(input.id || '')) throw new Error('Vælg dit gemte design.');
    const { data: raw, error: draftError } = await owned().eq('id', input.id).maybeSingle();
    if (draftError || !raw) return json({ error: 'Designet blev ikke fundet på din konto i denne shop.' }, 404);
    const draft = raw as Draft;
    if (input.action === 'progress') {
      if (draft.status === 'starting' && Date.parse(draft.updated_at) < Date.now() - 120000) {
        await updateDraft(draft.id, { status: 'failed', error_message: 'Forbindelsen blev afbrudt under oprettelsen. Kontrollér din Canva-konto før du opretter en ny kopi.' });
      }
      if (draft.status === 'uploading') {
        const job = (await canva(`/asset-uploads/${encodeURIComponent(draft.upload_job_id)}`)).job;
        if (job?.status === 'failed') await updateDraft(draft.id, { status: 'failed', error_message: 'Canva afviste fotoet. Vælg et andet foto.' });
        if (job?.status === 'success' && job.asset?.id) {
          const { data: claim, error } = await db.from('canva_customer_drafts').update({ status: 'starting', updated_at: new Date().toISOString() }).eq('id', draft.id).eq('user_id', userId).eq('tenant_id', tenantId).eq('status', 'uploading').select('id').maybeSingle();
          if (error) throw error;
          if (claim) {
            try {
              assertCanvaDataset((await canva(`/designs/${draft.source_design_id}/dataset`)).dataset);
              const data = { ...Object.fromEntries(Object.entries(draft.text_values).map(([key,text]) => [key, { type: 'text', text }])), hero_image: { type: 'image', asset_id: job.asset.id } };
              const result = await canva('/autofills', { method: 'POST', body: JSON.stringify({ type: 'create_from_design', design_id: draft.source_design_id, title: `${draft.text_values.business_name} · WebPrinter`, data }) });
              if (!result.job?.id) throw new Error('Manglende job.');
              await updateDraft(draft.id, { status: 'filling', autofill_job_id: result.job.id });
            } catch {
              await updateDraft(draft.id, { status: 'failed', error_message: 'Canva-kopien kunne ikke bekræftes. Kontrollér din Canva-konto før du opretter en ny kopi.' });
            }
          }
        }
      } else if (draft.status === 'filling') {
        const job = (await canva(`/autofills/${encodeURIComponent(draft.autofill_job_id)}`)).job;
        if (job?.status === 'failed') await updateDraft(draft.id, { status: 'failed', error_message: 'Canva kunne ikke udfylde designet. Kontakt shoppen.' });
        if (job?.status === 'success') {
          const id = job.result?.design?.id || '';
          assertCustomerCopy(id, draft.source_design_id);
          if (job.result?.type !== 'create_design') throw new Error('Canva oprettede ikke en ny kopi.');
          await updateDraft(draft.id, { status: 'ready', design_id: id });
        }
      }
      const { data: current, error } = await owned().eq('id', draft.id).single();
      if (error) throw error;
      return json({ id: current.id, status: current.status, message: current.error_message, checkout: current.checkout_state, templateKey: current.template_key });
    }
    if (draft.status !== 'ready' || !draft.design_id) throw new Error('Designet er ikke klar endnu.');
    assertCustomerCopy(draft.design_id, draft.source_design_id);
    if (input.action === 'edit') {
      const result = await canva(`/designs/${encodeURIComponent(draft.design_id)}`);
      if (result.design?.id !== draft.design_id) throw new Error('Designet kunne ikke åbnes.');
      const url = new URL(canvaUrl(result.design.urls.edit_url, 'edit'));
      // This value is only a navigation hint. Return JWTs never authorize an import.
      url.searchParams.set('correlation_state', draft.id);
      await updateDraft(draft.id, { export_job_id: null, export_request_id: null, export_starting: false });
      return json({ url: url.href });
    }
    if (input.action === 'export_start') {
      if (!UUID.test(input.exportRequestId || '')) throw new Error('Ugyldig eksport.');
      if (draft.export_request_id === input.exportRequestId) return json({ ready: false });
      // Each explicit import takes a fresh snapshot. A lost start response is safe to retry with the same request ID.
      let claimQuery = db.from('canva_customer_drafts').update({ export_starting: true, export_request_id: input.exportRequestId, export_job_id: null })
        .eq('id', draft.id).eq('user_id', userId).eq('tenant_id', tenantId).eq('export_starting', false);
      claimQuery = draft.export_request_id ? claimQuery.eq('export_request_id', draft.export_request_id) : claimQuery.is('export_request_id', null);
      const { data: claim, error } = await claimQuery.select('id').maybeSingle();
      if (error) throw error;
      if (!claim) throw new Error('En eksport er allerede startet. Vent lidt, eller åbn designet igen.');
      const result = await canva('/exports', { method: 'POST', body: JSON.stringify({ design_id: draft.design_id, format: { type: 'pdf', export_quality: 'pro' } }) });
      if (!result.job?.id) throw new Error('PDF-eksporten kunne ikke bekræftes.');
      const { data: saved, error: saveError } = await db.from('canva_customer_drafts').update({ export_job_id: result.job.id, export_starting: false })
        .eq('id', draft.id).eq('user_id', userId).eq('tenant_id', tenantId).eq('export_request_id', input.exportRequestId).select('id').maybeSingle();
      if (saveError || !saved) throw new Error('Designet blev åbnet igen under eksporten. Start en ny eksport.');
      return json({ ready: false });
    }
    if (['export','download'].includes(input.action) && (!UUID.test(input.exportRequestId || '') || input.exportRequestId !== draft.export_request_id)) {
      throw new Error('En nyere version af designet er åbnet eller hentet. Hent designet igen.');
    }
    if (input.action === 'export') {
      if (draft.export_job_id) {
        const job = (await canva(`/exports/${encodeURIComponent(draft.export_job_id)}`)).job;
        if (job?.status === 'failed') { await updateDraft(draft.id, { export_job_id: null, export_starting: false }); throw new Error('Canva kunne ikke eksportere PDF-filen. Prøv igen.'); }
        return json({ ready: job?.status === 'success' });
      }
      return json({ ready: false });
    }
    if (input.action === 'download') {
      if (!draft.export_job_id) throw new Error('Hent først designet fra Canva.');
      const job = (await canva(`/exports/${encodeURIComponent(draft.export_job_id)}`)).job;
      if (job?.status !== 'success' || job.urls?.length !== 1) throw new Error('PDF-filen er ikke klar.');
      const response = await request(canvaUrl(job.urls[0], 'download'), { redirect: 'error', signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error('PDF-linket er udløbet. Åbn designet og hent det igen.');
      const file = await boundedBytes(response, 50 * 1024 * 1024);
      if (new TextDecoder().decode(file.slice(0,5)) !== '%PDF-') throw new Error('Canva returnerede ikke en PDF-fil.');
      return new Response(file, { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="canva-design.pdf"' } });
    }
    return json({ error: 'Ukendt handling.' }, 400);
  } catch (error) {
    // Never log provider bodies, access tokens, authorization codes or customer text.
    const message = error instanceof Error && !error.message.startsWith('{') ? error.message : 'Canva-handlingen kunne ikke gennemføres.';
    return json({ error: message }, 400);
  }
  };
}

if (import.meta.main) Deno.serve(createCanvaHandler());
