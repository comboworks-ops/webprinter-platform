// Offline Postgres integration. No remote service or provider is contacted.
// CHECKOUT_TEST_CONTAINER=<disposable postgres container> node --test supabase/tests/storefrontOrderEmailDb.test.mjs
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const container = process.env.CHECKOUT_TEST_CONTAINER;
if (!container || !/^[a-zA-Z0-9_-]+$/.test(container)) throw new Error('CHECKOUT_TEST_CONTAINER must name a disposable local Postgres container');
const database = `checkout_email_${process.pid}`, docker = '/opt/homebrew/bin/docker';
const args = db => ['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db];
function sql(query, db = database) { const r = spawnSync(docker,args(db),{input:query,encoding:'utf8'}); if (r.status !== 0) throw new Error(r.stderr || r.error?.message); return r.stdout.trim(); }
function concurrentSql(query) { return new Promise((resolve,reject) => { const child = spawn(docker,args(database)); let out='',err=''; child.stdout.on('data',c=>out+=c); child.stderr.on('data',c=>err+=c); child.on('error',reject); child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err))); child.stdin.end(query); }); }
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const shopA = '22222222-2222-4222-8222-222222222222', shopB = '22222222-2222-4222-8222-222222222223';
const userA = '33333333-3333-4333-8333-333333333333', userB = '33333333-3333-4333-8333-333333333334';
const service = `set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);`;
const finalize = (n, live = false) => `select public.finalize_storefront_checkout('${id(n)}','pi_email_${n}',12345,'dkk',${live});`;
const row = n => JSON.parse(sql(`select row_to_json(q) from public.storefront_order_email_outbox q where attempt_id='${id(n)}' and notification_type='customer_confirmation'`));
const tail = value => value.split('\n').at(-1);
function seed(n, {shop=shopA,user=userA,email='customer-a@example.test',live=false}={}) {
  const snapshot = JSON.stringify({customer_email:email,customer_name:shop===shopA?'Customer A':'Customer B',product_name:shop===shopA?'Shop A print':'Shop B print',quantity:25,delivery_type:'Standard',delivery_address:'Testvej 1',delivery_address2:'2. th.',delivery_city:'Odense',delivery_zip:'5000',delivery_country:'DE'});
  sql(`${service} insert into public.storefront_checkout_attempts(id,tenant_id,user_id,access_token_hash,request_hash,order_snapshot,quote_snapshot,files_snapshot,amount_ore,livemode,payment_intent_id,state)
    values('${id(n)}','${shop}',${user?literal(user):'null'},repeat('a',64),repeat('b',64),${literal(snapshot)},'{}',
    '[{"file_name":"approved.pdf","storage_path":"checkout-finalized/${id(n)}/0-file.pdf","file_url":"https://example.test/immutable/${id(n)}.pdf","file_type":"pdf","file_size":12,"sha256":"${'a'.repeat(64)}"}]',12345,${live},'pi_email_${n}','ready');
    insert into storage.objects(bucket_id,name,metadata) values('order-files','checkout-finalized/${id(n)}/0-file.pdf','{"size":12}');`);
}
const allow = emails => `array[${emails.map(literal).join(',')}]::text[]`;
function claim(emails, limit=5, live=false) { return JSON.parse(tail(sql(`${service} select coalesce(jsonb_agg(to_jsonb(q)),'[]') from public.claim_storefront_order_emails(${limit},${live},${emails===null?'null':allow(emails)}) q;`))); }
const finish = (r,status,provider=null,error=null) => `${service} select public.finish_storefront_order_email('${r.id}','${r.claim_token}',${literal(status)},${provider?literal(provider):'null'},${error?literal(error):'null'});`;
function prepare(r,payload) { return JSON.parse(tail(sql(`${service} select public.prepare_storefront_order_email('${r.id}','${r.claim_token}',${literal(JSON.stringify(payload))});`))); }

before(() => {
  sql(`create database ${database};`,'postgres');
  sql(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
    create schema auth; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant execute on function auth.jwt() to anon,authenticated,service_role;
    create table auth.users(id uuid primary key);
    create table public.tenants(id uuid primary key,name text,settings jsonb);
    create table public.orders(id uuid primary key default gen_random_uuid(),order_number text not null unique,user_id uuid,tenant_id uuid,customer_email text not null,customer_name text,customer_phone text,
      product_name text not null,product_slug text,quantity integer not null,total_price numeric not null,currency text,status text,delivery_type text,delivery_address text,delivery_zip text,delivery_city text,delivery_country text,product_configuration text,status_note text);
    create table public.order_files(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),file_name text not null,file_url text not null,file_type text,file_size integer,is_current boolean,uploaded_by uuid,notes text);
    create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
    grant all on public.orders,public.order_files,storage.objects to service_role;
    grant select on public.tenants to service_role;
    insert into public.tenants values('${shopA}','Shop A','{"company":{"email":"operator-a@example.test","name":"Shop A"}}'),('${shopB}','Shop B','{"company":{"email":"operator-b@example.test","name":"Shop B"}}');
    insert into auth.users values('${userA}'),('${userB}');`);
  sql(readFileSync(new URL('../migrations/20260908171743_storefront_checkout_finalization.sql',import.meta.url),'utf8'));
  seed(900); sql(service+finalize(900)); // Historical completion before outbox migration.
  sql(readFileSync(new URL('../migrations/20260908184205_storefront_order_email_outbox.sql',import.meta.url),'utf8'));
});
after(() => { sql(`drop database if exists ${database} with (force);`,'postgres'); });

test('migration and repeated historical callback do not backfill completed orders', () => {
  assert.equal(sql('select count(*) from public.storefront_order_email_outbox'),'0');
  sql(service+finalize(900));
  sql(`update public.storefront_checkout_attempts set state='completed' where id='${id(900)}'`);
  assert.equal(sql('select count(*) from public.storefront_order_email_outbox'),'0');
});
test('duplicate concurrent paid callbacks enqueue once; two shops and accounts keep recipient and snapshot scope', async () => {
  seed(1); seed(2,{shop:shopB,user:userB,email:'customer-b@example.test'});
  const completed = await Promise.all([concurrentSql(service+finalize(1)),concurrentSql(service+finalize(1)),concurrentSql(service+finalize(1))]);
  assert.equal(new Set(completed.map(value=>JSON.parse(tail(value)).id)).size,1);
  sql(service+finalize(2));
  const rows = JSON.parse(sql('select jsonb_agg(to_jsonb(q) order by recipient_email) from public.storefront_order_email_outbox q'));
  assert.equal(rows.length,4);
  for (const r of rows) {
    const a = r.tenant_id === shopA; assert.equal(r.tenant_id,a?shopA:shopB);
    assert.equal(r.recipient_email,`${r.notification_type==='customer_confirmation'?'customer':'operator'}-${a?'a':'b'}@example.test`);
    assert.equal(r.message_snapshot.tenant_id,r.tenant_id); assert.equal(r.message_snapshot.order_id,r.order_id);
    assert.equal(r.message_snapshot.shop_name,a?'Shop A':'Shop B'); assert.equal(r.message_snapshot.product_name,a?'Shop A print':'Shop B print');
    assert.equal(r.message_snapshot.customer_name,a?'Customer A':'Customer B'); assert.match(r.message_snapshot.delivery_summary,/2\. th\..*DE/);
    assert.equal(r.status,'pending'); assert.equal(r.accepted_at,null);
  }
});
test('configured notification switches are respected; missing or invalid shop inbox never falls back to master', () => {
  sql(`update public.tenants set settings='{"company":{"email":"invalid-address"}}' where id='${shopB}'`);
  seed(3,{shop:shopB,user:null,email:'guest@example.test'}); sql(service+finalize(3));
  assert.equal(sql(`select notification_type from public.storefront_order_email_outbox where attempt_id='${id(3)}'`),'customer_confirmation');
  assert.equal(row(3).message_snapshot.has_customer_account,false); assert.equal(row(3).message_snapshot.support_email,null);
  sql(`update public.tenants set settings='{"company":{"email":"operator-b@example.test"},"notifications":{"new_orders":false,"order_confirmations":false}}' where id='${shopB}'`);
  seed(4,{shop:shopB,user:userB,email:'disabled@example.test'}); sql(service+finalize(4));
  assert.equal(sql(`select count(*) from public.storefront_order_email_outbox where attempt_id='${id(4)}'`),'0');
  sql(`update public.tenants set settings='{"company":{"email":"operator-b@example.test","name":"Shop B"}}' where id='${shopB}'`);
});
test('queue failure rolls back paid order, file and completion atomically; corrected retry queues once', () => {
  seed(5,{email:'blocked@example.test'});
  sql(`alter table public.storefront_order_email_outbox add constraint simulate_queue_failure check(recipient_email <> 'blocked@example.test')`);
  assert.throws(()=>sql(service+finalize(5)),/simulate_queue_failure/);
  assert.equal(sql(`select count(*) from public.orders where checkout_attempt_id='${id(5)}'`),'0');
  assert.equal(sql(`select state || '|' || (order_id is null)::text from public.storefront_checkout_attempts where id='${id(5)}'`),'ready|true');
  assert.equal(sql(`select count(*) from public.storefront_order_email_outbox where attempt_id='${id(5)}'`),'0');
  sql('alter table public.storefront_order_email_outbox drop constraint simulate_queue_failure'); sql(service+finalize(5));
  assert.equal(sql(`select count(*) from public.storefront_order_email_outbox where attempt_id='${id(5)}'`),'2');
});
test('anonymous and both customer identities cannot read/write outbox or invoke dispatcher RPCs', () => {
  for (const [role,user] of [['anon',null],['authenticated',userA],['authenticated',userB]]) {
    const auth = `set role ${role}; select set_config('request.jwt.claims',${literal(JSON.stringify({role,sub:user}))},false);`;
    for (const query of ['select * from public.storefront_order_email_outbox','update public.storefront_order_email_outbox set status=\'sent\'',
      `select public.claim_storefront_order_emails(1,true,null)`, `select public.prepare_storefront_order_email('${id(1)}','${id(1)}','{}')`,
      `select public.finish_storefront_order_email('${id(1)}','${id(1)}','sent','forged',null)`]) assert.throws(()=>sql(auth+query),/permission denied/);
  }
  assert.equal(sql("select relrowsecurity from pg_class where oid='public.storefront_order_email_outbox'::regclass"),'t');
  assert.equal(sql("select count(*) from pg_policies where tablename='storefront_order_email_outbox'"),'0');
});
test('test mode requires allowlist and never claims live messages; bounded claim and immutable scope', () => {
  seed(6,{email:'mode@example.test',live:true}); sql(service+finalize(6,true));
  seed(7,{email:'mode@example.test'}); sql(service+finalize(7));
  assert.throws(()=>claim(null),/storefront_email_claim_invalid/); assert.throws(()=>claim(['mode@example.test'],6),/storefront_email_claim_invalid/);
  const rows = claim(['mode@example.test']); assert.equal(rows.length,1); assert.equal(rows[0].attempt_id,id(7)); assert.equal(rows[0].livemode,false);
  const live = claim(['mode@example.test'],5,true); assert.equal(live.length,1); assert.equal(live[0].attempt_id,id(6));
  assert.throws(()=>sql(`${service} update public.storefront_order_email_outbox set recipient_email='outsider@example.test' where id='${rows[0].id}'`),/storefront_email_identity_immutable/);
});
test('parallel workers obtain disjoint rows and cannot steal active leases', async () => {
  seed(8,{email:'concurrent-a@example.test'}); seed(9,{shop:shopB,user:userB,email:'concurrent-b@example.test'}); sql(service+finalize(8)+finalize(9));
  const command = `${service} select coalesce(jsonb_agg(to_jsonb(q)),'[]') from public.claim_storefront_order_emails(1,false,${allow(['concurrent-a@example.test','concurrent-b@example.test'])}) q;`;
  const batches = await Promise.all([concurrentSql(command),concurrentSql(command),concurrentSql(command)]);
  const rows = batches.flatMap(value=>JSON.parse(tail(value))); assert.equal(rows.length,2); assert.equal(new Set(rows.map(r=>r.id)).size,2);
  assert.equal(claim(['concurrent-a@example.test','concurrent-b@example.test']).length,0);
});
test('payload checkpoints validate recipient and freeze exact payload across configuration changes/retries', () => {
  const r = row(8); const original = {from:'Print <sender@example.test>',to:[r.recipient_email],subject:'Frozen',html:'Frozen body'};
  assert.throws(()=>prepare(r,{...original,to:['foreign@example.test']}),/storefront_email_payload_invalid/);
  assert.deepEqual(prepare(r,original),original);
  assert.deepEqual(prepare(r,{...original,from:'Changed <new@example.test>',subject:'Changed',to:['foreign@example.test']}),original);
  assert.throws(()=>sql(`${service} update public.storefront_order_email_outbox set provider_payload='{}' where id='${r.id}'`),/storefront_email_identity_immutable/);
  assert.equal(tail(sql(finish(r,'pending',null,'provider_response_unconfirmed'))),'t');
  assert.equal(claim([r.recipient_email]).length,0); // Backoff is enforced.
  sql(`update public.storefront_order_email_outbox set next_attempt_at=now()-interval '1 second' where id='${r.id}'`);
  const retry = claim([r.recipient_email])[0]; assert.equal(retry.attempts,2); assert.deepEqual(retry.provider_payload,original);
  assert.notEqual(retry.claim_token,r.claim_token); assert.equal(tail(sql(finish(r,'sent','stale-provider'))),'f');
  assert.equal(tail(sql(finish(retry,'sent','accepted-provider-id'))),'t');
  const accepted = row(8); assert.equal(accepted.status,'sent'); assert.ok(accepted.accepted_at); assert.equal(accepted.provider_message_id,'accepted-provider-id');
  assert.equal(claim([r.recipient_email]).length,0);
  assert.throws(()=>sql(`${service} update public.storefront_order_email_outbox set status='pending' where id='${r.id}'`),/storefront_email_identity_immutable/);
});
test('worker crash lease expires safely; old token cannot prepare or acknowledge reclaimed row', () => {
  const old = row(9); sql(`update public.storefront_order_email_outbox set claimed_until=now()-interval '1 second' where id='${old.id}'`);
  const retry = claim([old.recipient_email])[0]; assert.equal(retry.attempts,2); assert.notEqual(retry.claim_token,old.claim_token);
  assert.throws(()=>prepare(old,{to:[old.recipient_email]}),/storefront_email_claim_lost/);
  assert.equal(tail(sql(finish(old,'sent','stale-id'))),'f'); assert.equal(tail(sql(finish(retry,'pending',null,'provider_timeout'))),'t');
});
test('ambiguous retries stop before 24-hour provider dedup expiry and after eight attempts', () => {
  seed(10,{email:'expired@example.test'}); seed(11,{email:'exhausted@example.test'}); sql(service+finalize(10)+finalize(11));
  const expired = claim(['expired@example.test'])[0], exhausted = claim(['exhausted@example.test'])[0];
  sql(`update public.storefront_order_email_outbox set claimed_until=now()-interval '1 second',first_attempt_at=now()-interval '23 hours' where id='${expired.id}';
    update public.storefront_order_email_outbox set claimed_until=now()-interval '1 second',attempts=8 where id='${exhausted.id}'`);
  assert.equal(claim(['expired@example.test','exhausted@example.test']).length,0);
  assert.equal(row(10).status,'needs_review'); assert.equal(row(10).last_error_code,'idempotency_window_elapsed');
  assert.equal(row(11).status,'needs_review'); assert.equal(row(11).last_error_code,'retry_limit_reached');
  assert.equal(claim(['expired@example.test','exhausted@example.test']).length,0);
});


test('canary allowlist does not sweep an expired row outside its recipient scope', () => {
  seed(12,{email:'outside-canary@example.test'}); sql(service+finalize(12));
  const outside = claim(['outside-canary@example.test'])[0];
  sql(`update public.storefront_order_email_outbox set status='pending',first_attempt_at=now()-interval '25 hours' where id='${outside.id}'`);
  claim(['different-canary@example.test']);
  assert.equal(row(12).status,'pending');
  claim(['outside-canary@example.test']); assert.equal(row(12).status,'needs_review');
  assert.throws(()=>sql(`${service} delete from public.storefront_order_email_outbox where id='${outside.id}'`),/permission denied/);
});
