import assert from 'node:assert/strict';
import { createCanvaHandler } from './index.ts';
import { tokenVault } from './security.ts';
import { CANVA_FIELDS, CANVA_TEMPLATES } from '../../../shared/canva.ts';

type Row = Record<string, unknown>;
const USER = '10000000-0000-0000-0000-000000000001';
const SHOP = '20000000-0000-0000-0000-000000000001';
const PRODUCT = '30000000-0000-0000-0000-000000000001';
const ID = '40000000-0000-0000-0000-000000000001';
const EXPORT = '50000000-0000-0000-0000-000000000001';
const template = CANVA_TEMPLATES[0];

/** Small transactional fake: predicates and returning rows exercise the actual handler ownership/CAS logic. */
function database(tables: Record<string,Row[]>) {
  return { from(table: string) {
    let rows: Row[] = tables[table] ||= [];
    const filters: Array<(row:Row)=>boolean> = [];
    let operation = 'select', payload: Row = {}, singular = false, executed = false;
    let result: { data: Row | Row[] | null; error: { code: string } | null };
    const query = {
      select(_columns?: string) { return query; },
      eq(key:string,value:unknown) { filters.push(row => row[key] === value); return query; },
      is(key:string,value:unknown) { filters.push(row => (row[key] ?? null) === value); return query; },
      gt(key:string,value:unknown) { filters.push(row => String(row[key]) > String(value)); return query; },
      lt(key:string,value:unknown) { filters.push(row => String(row[key]) < String(value)); return query; },
      order() { return query; }, limit() { return query; },
      insert(value:Row) { operation = 'insert'; payload = value; return query; },
      upsert(value:Row) { operation = 'upsert'; payload = value; return query; },
      update(value:Row) { operation = 'update'; payload = value; return query; },
      delete() { operation = 'delete'; return query; },
      maybeSingle() { singular = true; return query; }, single() { singular = true; return query; },
      then(resolve: (value: typeof result)=>unknown, reject?: (error:unknown)=>unknown) {
        if (!executed) {
          executed = true;
          let matched = rows.filter(row => filters.every(filter => filter(row)));
          let error: typeof result.error = null;
          if (operation === 'insert') {
            if (rows.some(row => payload.id ? row.id === payload.id : row.state_hash === payload.state_hash)) error = { code: '23505' };
            else { const row = { export_job_id: null, export_starting: false, ...payload }; rows.push(row); matched = [row]; }
          } else if (operation === 'upsert') {
            matched = rows.filter(row => row.user_id === payload.user_id && row.tenant_id === payload.tenant_id);
            if (!matched.length) { rows.push({ ...payload }); matched = [rows.at(-1)!]; } else matched.forEach(row => Object.assign(row,payload));
          } else if (operation === 'update') matched.forEach(row => Object.assign(row,payload));
          else if (operation === 'delete') { rows = tables[table] = rows.filter(row => !matched.includes(row)); }
          result = { data: error ? null : singular ? matched[0] ? { ...matched[0] } : null : matched.map(row => ({ ...row })), error };
        }
        return Promise.resolve(result).then(resolve,reject);
      },
    };
    return query;
  } };
}

async function fixture() {
  const vault = await tokenVault('a'.repeat(64));
  const tables: Record<string,Row[]> = {
    tenants: [{ id: SHOP, settings: { canva: { enabled: true } } }],
    products: [{ id: PRODUCT, tenant_id: SHOP, is_published: true, technical_specs: { canva: { enabled: true, mode: 'autofill', template_keys: [template.key] } } }],
    canva_customer_connections: [{ user_id: USER, tenant_id: SHOP, expires_at: new Date(Date.now() + 3600000).toISOString(), lock_until: new Date(0).toISOString(), token_ciphertext: await vault.seal({ access_token: 'customer-token', refresh_token: 'refresh' }, `${USER}:${SHOP}`) }],
  };
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let dataset: Row = { ...Object.fromEntries(CANVA_FIELDS.map(field => [field.key, { type: 'text' }])), hero_image: { type: 'image' } };
  let downloadUrl = 'https://export-download.canva.com/result.pdf';
  let failAutofill = false;
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url); calls.push({ url: target, init });
    assert.equal(init?.redirect, 'error');
    if (target.endsWith('/oauth/token')) return Response.json({ access_token: 'new', refresh_token: 'next', expires_in: 3600 });
    if (target.endsWith('/dataset')) return Response.json({ dataset });
    if (target.endsWith('/asset-uploads')) return Response.json({ job: { id: 'upload1', status: 'in_progress' } });
    if (target.endsWith('/asset-uploads/upload1')) return Response.json({ job: { id: 'upload1', status: 'success', asset: { id: 'Mphoto' } } });
    if (target.endsWith('/autofills')) {
      if (failAutofill) throw new Error('lost response');
      return Response.json({ job: { id: 'fill1', status: 'in_progress' } });
    }
    if (target.endsWith('/autofills/fill1')) return Response.json({ job: { id: 'fill1', status: 'success', result: { type: 'create_design', design: { id: 'Dcustomer' } } } });
    if (target.endsWith('/designs/Dcustomer')) return Response.json({ design: { id: 'Dcustomer', urls: { edit_url: 'https://www.canva.com/api/design/temporary/edit' } } });
    if (target.endsWith('/exports')) return Response.json({ job: { id: 'export1', status: 'in_progress' } });
    if (target.endsWith('/exports/export1')) return Response.json({ job: { id: 'export1', status: 'success', urls: [downloadUrl] } });
    if (target === downloadUrl) return new Response('%PDF-1.7\nfixture', { headers: { 'Content-Type': 'application/pdf' } });
    throw new Error(`Unexpected provider request ${target}`);
  };
  const settings: Record<string,string> = { CANVA_WORKFLOW_ENABLED:'true', CANVA_CLIENT_ID:'client', CANVA_CLIENT_SECRET:'secret', CANVA_TOKEN_ENCRYPTION_KEY:'a'.repeat(64), CANVA_ALLOWED_ORIGINS:'https://shop.test', SUPABASE_URL:'https://project.test', SUPABASE_SECRET_KEY:'sb_secret_fixture' };
  const handler = createCanvaHandler({
    createClient: (() => database(tables)) as unknown as NonNullable<Parameters<typeof createCanvaHandler>[0]>['createClient'],
    requireUser: async req => req.headers.get('authorization') === 'Bearer denied' ? { ok: false, response: new Response(null,{status:401}) }
      : { ok: true, user: { id: req.headers.get('authorization') === 'Bearer other' ? 'other-user' : USER }, authHeader: 'Bearer fixture' },
    checkRateLimit: () => null, env: name => settings[name] || '', fetch: fetcher as typeof fetch,
  });
  async function call(input: Row, options: { multipart?: boolean; auth?: string; origin?: string } = {}) {
    let body: string | FormData = JSON.stringify({ tenantId: SHOP, ...input });
    if (options.multipart) { const form = new FormData(); form.set('input', body); form.set('photo', new File([new Uint8Array([255,216,255,1])], 'photo.jpg', { type:'image/jpeg' })); body = form; }
    return handler(new Request('https://project.test/functions/v1/canva-workflow', { method: 'POST', headers: { origin:options.origin || 'https://shop.test', authorization:`Bearer ${options.auth || 'fixture'}` }, body }));
  }
  const create = () => call({ action:'create', id:ID, productId:PRODUCT, templateKey:template.key,
    text:Object.fromEntries(CANVA_FIELDS.map(field => [field.key,'Kundens tekst'])), checkout:{productId:PRODUCT, designWidthMm:148, designHeightMm:210, quantity:250, pricingQuote:{quantity:250}} },{multipart:true});
  return { tables,calls,call,create,settings,setDataset:(value:Row)=>dataset=value,setDownload:(value:string)=>downloadUrl=value,setFailAutofill:()=>failAutofill=true };
}

Deno.test('full customer roundtrip uploads own photo, creates one copy, edits and retrieves PDF', async () => {
  const f = await fixture();
  assert.equal((await f.create()).status,200);
  assert.equal((await f.create()).status,200); // Lost client response must not duplicate.
  await f.call({action:'progress',id:ID});
  const ready = await (await f.call({action:'progress',id:ID})).json();
  assert.equal(ready.status,'ready'); assert.equal(ready.checkout.quantity,250);
  const fillCalls = f.calls.filter(call => call.url.endsWith('/autofills'));
  assert.equal(fillCalls.length,1);
  const fill = JSON.parse(String(fillCalls[0].init?.body));
  assert.equal(fill.type,'create_from_design'); assert.equal(fill.design_id,template.designId);
  assert.deepEqual(fill.data.hero_image,{type:'image',asset_id:'Mphoto'});
  assert.equal(f.calls.filter(call=>call.url.endsWith('/asset-uploads')).length,1);
  const edit = await (await f.call({action:'edit',id:ID})).json();
  assert.equal(new URL(edit.url).searchParams.get('correlation_state'),ID);
  assert.equal((await (await f.call({action:'export_start',id:ID,exportRequestId:EXPORT})).json()).ready,false);
  assert.equal((await (await f.call({action:'export',id:ID,exportRequestId:EXPORT})).json()).ready,true);
  const pdf = await f.call({action:'download',id:ID,exportRequestId:EXPORT});
  assert.equal(pdf.headers.get('content-type'),'application/pdf');
  assert.match(await pdf.text(),/^%PDF-/);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/exports')).length,1);
});
Deno.test('another customer/shop cannot read, edit, export or import a saved draft', async () => {
  const f = await fixture(); await f.create();
  for (const action of ['progress','edit','export','download']) {
    assert.equal((await f.call({action,id:ID},{auth:'other'})).status,404);
    assert.equal((await f.call({action,id:ID,tenantId:'20000000-0000-0000-0000-000000000002'})).status,403);
  }
  assert.equal((await f.call({action:'status'},{auth:'denied'})).status,401);
  assert.equal((await f.call({action:'status'},{origin:'https://evil.test'})).status,400);
});
Deno.test('dataset drift blocks all customer-photo uploads and creation', async () => {
  const f = await fixture(); f.setDataset({renamed:{type:'text'}});
  assert.equal((await f.create()).status,400);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/asset-uploads')).length,0);
});
Deno.test('unpublished, foreign and unassigned products cannot create drafts', async () => {
  for (const change of [{is_published:false},{tenant_id:'another-shop'},{technical_specs:{canva:{enabled:true,mode:'autofill',template_keys:[]}}}]) {
    const f=await fixture();Object.assign(f.tables.products[0],change);
    assert.equal((await f.create()).status,403);assert.equal(f.calls.length,0);
  }
});
Deno.test('uncertain autofill results never post a second generation on resume', async () => {
  const f=await fixture();await f.create();f.setFailAutofill();
  await f.call({action:'progress',id:ID});await f.call({action:'progress',id:ID});await f.create();
  assert.equal(f.calls.filter(call=>call.url.endsWith('/autofills')).length,1);
  assert.equal(f.tables.canva_customer_drafts[0].status,'failed');
});
Deno.test('provider export URLs cannot become arbitrary server downloads', async () => {
  const f=await fixture();await f.create();await f.call({action:'progress',id:ID});await f.call({action:'progress',id:ID});await f.call({action:'export_start',id:ID,exportRequestId:EXPORT});
  f.setDownload('http://169.254.169.254/latest/meta-data');
  assert.equal((await f.call({action:'download',id:ID,exportRequestId:EXPORT})).status,400);
  assert.ok(!f.calls.some(call=>call.url.includes('169.254')));
});
Deno.test('OAuth state is customer-bound, expires and cannot be replayed', async () => {
  const f=await fixture();const start=await (await f.call({action:'connect'})).json();const url=new URL(start.url);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const input={action:'callback',state:url.searchParams.get('state'),code:'fixture-code'};
  assert.equal((await f.call(input,{auth:'other'})).status,400);
  assert.equal((await f.call(input)).status,200);
  assert.equal((await f.call(input)).status,400);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/oauth/token')).length,1);
  const second=await (await f.call({action:'connect'})).json();
  f.tables.canva_customer_oauth[0].expires_at=new Date(0).toISOString();
  assert.equal((await f.call({...input,state:new URL(second.url).searchParams.get('state')})).status,400);
});
Deno.test('unactivated integration fails closed without contacting providers', async () => {
  const f=await fixture();f.settings.CANVA_WORKFLOW_ENABLED='false';
  assert.equal((await f.call({action:'connect'})).status,503);assert.equal(f.calls.length,0);
});

Deno.test('re-edit invalidates old exports and each explicit import requests fresh bytes', async () => {
  const f=await fixture();await f.create();await f.call({action:'progress',id:ID});await f.call({action:'progress',id:ID});
  await f.call({action:'export_start',id:ID,exportRequestId:EXPORT});
  await f.call({action:'export_start',id:ID,exportRequestId:EXPORT});
  assert.equal(f.calls.filter(call=>call.url.endsWith('/exports')).length,1);
  await f.call({action:'edit',id:ID});
  assert.equal((await f.call({action:'download',id:ID,exportRequestId:EXPORT})).status,400);
  const next='50000000-0000-0000-0000-000000000002';
  assert.equal((await f.call({action:'export_start',id:ID,exportRequestId:next})).status,200);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/exports')).length,2);
  assert.equal((await f.call({action:'download',id:ID,exportRequestId:EXPORT})).status,400);
  assert.equal((await f.call({action:'download',id:ID,exportRequestId:next})).status,200);
});
