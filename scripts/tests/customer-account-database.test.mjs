import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';

// Deliberately accepts only our disposable offline fixture container. Never
// point these destructive synthetic fixtures at the linked/hosted database.
const container = process.env.ACCOUNT_REPAIR_TEST_CONTAINER;
const enabled = container === 'webprinter-account-repairs-20260908';
const docker = process.env.ACCOUNT_TEST_DOCKER || '/opt/homebrew/bin/docker';
const database = `account_repair_${process.pid}`;
const sql = (query, db = database) => execFileSync(docker, ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '-At'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const S = '20000000-0000-4000-8000-000000000001';
const T = '20000000-0000-4000-8000-000000000002';
const O = '30000000-0000-4000-8000-000000000001';
const P = '30000000-0000-4000-8000-000000000002';
const F = '40000000-0000-4000-8000-000000000001';
const G = '40000000-0000-4000-8000-000000000002';
const M = '50000000-0000-4000-8000-000000000001';
const N = '50000000-0000-4000-8000-000000000002';
const C = '50000000-0000-4000-8000-000000000003';
const path = `${O}/${A}/60000000-0000-4000-8000-000000000001.pdf`;
const path2 = `${O}/${A}/60000000-0000-4000-8000-000000000002.pdf`;
const claims = (user) => `set role authenticated; select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated","iss":"https://fixture.supabase.co/auth/v1"}',false);`;
const finalize = (objectPath, tenant = S, ids = [F], validate = false, size = 9) => `select public.customer_finalize_order_file('${O}','${tenant}','print.pdf',${size},array[${ids.map(id => `'${id}'::uuid`).join(',')}],'${objectPath}',${validate});`;
const deny = (query, expected) => assert.throws(() => sql(query), error => error.stderr?.includes(expected));

let initialized = false;
after(() => { if (initialized) sql(`drop database ${database};`, 'postgres'); });

test('account migrations enforce ownership, narrow read receipts and atomic immutable replacement', { skip: !enabled }, async () => {
  sql(`create database ${database};`, 'postgres');
  initialized = true;
  sql(`
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
    create schema auth; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table public.orders (id uuid primary key, user_id uuid,tenant_id uuid,status text,requires_file_reupload boolean);
    create table public.order_files (id uuid primary key default gen_random_uuid(),order_id uuid references orders(id),file_name text not null,file_url text not null,file_type text,file_size integer,uploaded_by uuid,is_current boolean default true,uploaded_at timestamptz default now());
    create table public.order_messages (id uuid primary key,order_id uuid references orders(id),sender_id uuid,sender_type text not null,content text not null,is_read boolean default false);
    create table public.checkout_customer_profiles (id uuid primary key,user_id uuid,delivery_address text);
    create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text,name text unique,owner_id text,metadata jsonb);
    create function public.is_admin() returns boolean language sql stable as $$ select auth.uid() = '90000000-0000-4000-8000-000000000001'::uuid $$;
    grant select,insert,update,delete on public.orders,public.order_files,public.order_messages,storage.objects to authenticated;
    grant select,insert,update,delete on public.checkout_customer_profiles to authenticated;
    grant select,insert,update,delete on storage.objects to anon;
    alter table public.orders enable row level security;
    alter table public.order_files enable row level security;
    alter table public.order_messages enable row level security;
    alter table public.checkout_customer_profiles enable row level security;
    alter table storage.objects enable row level security;
    create policy own_orders on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
    create policy "Users can upload files to own orders" on public.order_files for insert to authenticated with check(exists(select 1 from orders where orders.id=order_files.order_id and user_id=auth.uid()));
    create policy own_files on public.order_files for select to authenticated using(exists(select 1 from orders where orders.id=order_files.order_id and user_id=auth.uid()));
    create policy admin_files on public.order_files for all to authenticated using(public.is_admin()) with check(public.is_admin());
    create policy own_messages on public.order_messages for select to authenticated using(exists(select 1 from orders where orders.id=order_messages.order_id and user_id=auth.uid()));
    create policy own_sent_messages on public.order_messages for all to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());
    create policy admin_messages on public.order_messages for all to authenticated using(public.is_admin()) with check(public.is_admin());
    create policy own_profiles on public.checkout_customer_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    -- Deliberately broad fixture: restrictive replacement guards must prevail.
    create policy public_objects on storage.objects for all to anon,authenticated using(true) with check(true);
    insert into orders values ('${O}','${A}','${S}','pending',true),('${P}','${B}','${T}','pending',true);
    insert into order_files(id,order_id,file_name,file_url,uploaded_by) values('${F}','${O}','old.pdf','https://fixture/old.pdf','${A}'),('${G}','${P}','old.pdf','https://fixture/other.pdf','${B}');
    insert into order_messages values ('${M}','${O}','90000000-0000-4000-8000-000000000001','admin','operator message',false),('${N}','${P}','90000000-0000-4000-8000-000000000001','admin','other customer',false),('${C}','${O}','${A}','customer','customer message',false);
  `);
  for (const filename of ['20260908140250_customer_order_file_finalization.sql', '20260908171700_customer_order_message_read_receipts.sql', '20260908172325_checkout_customer_profile_address_details.sql']) {
    sql(readFileSync(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
  }
  const receipt = (order, tenant, ids) => `select public.customer_mark_order_messages_read('${order}','${tenant}',array[${ids.map(id => `'${id}'::uuid`).join(',')}]);`;
  deny(`set role anon; ${receipt(O,S,[M])}`, 'permission denied');
  deny(claims(B) + receipt(O,S,[M]), 'customer_message_access_denied');
  deny(claims(A) + receipt(O,T,[M]), 'customer_message_access_denied');
  deny(claims(A) + receipt(O,S,[M,N]), 'customer_message_access_denied');
  deny(claims(A) + receipt(O,S,[C]), 'customer_message_access_denied');
  assert.equal(sql(`select is_read from order_messages where id='${M}';`).trim(), 'f');
  assert.ok(sql(claims(A) + receipt(O,S,[M])).includes(M));
  assert.ok(sql(claims(A) + receipt(O,S,[M])).includes(M));
  assert.ok(sql(claims(B) + receipt(P,T,[N])).includes(N));
  assert.equal(sql(`select count(*) from order_messages where is_read;`).trim(), '2');
  assert.equal(sql(claims(A) + `update order_messages set content='forged' where id='${M}';`).trim().split('\n').at(-1), 'UPDATE 0');
  assert.equal(sql(`select content from order_messages where id='${M}';`).trim(), 'operator message');
  const send = (order, sender, type) => `insert into order_messages(id,order_id,sender_id,sender_type,content) values(gen_random_uuid(),'${order}','${sender}','${type}','new message');`;
  deny(claims(A) + send(P,A,'customer'), 'row-level security');
  deny(claims(A) + send(O,A,'admin'), 'row-level security');
  deny(claims(A) + send(O,B,'customer'), 'row-level security');
  deny(claims(A) + `insert into order_messages(id,order_id,sender_id,sender_type,content,is_read) values(gen_random_uuid(),'${O}','${A}','customer','forged receipt',true);`, 'row-level security');
  sql(claims(A) + send(O,A,'customer'));
  sql(claims(B) + send(P,B,'customer'));
  assert.equal(sql(claims(A) + `update order_messages set sender_type='admin',order_id='${P}' where id='${C}'; delete from order_messages where id='${C}';`).trim().split('\n').slice(-2).join(','), 'UPDATE 0,DELETE 0');
  sql(claims('90000000-0000-4000-8000-000000000001') + send(O,'90000000-0000-4000-8000-000000000001','admin') + `update order_messages set is_read=true where id='${C}';`);
  assert.equal(sql(`select is_read from order_messages where id='${C}';`).trim(),'t');
  sql(claims(A) + `insert into checkout_customer_profiles(id,user_id,delivery_address,delivery_address_2,delivery_country,billing_address_2,billing_country) values('${F}','${A}','Test Street 1','2. tv','SE','Office 4','NO');`);
  assert.equal(sql(claims(A) + `select delivery_address_2 || '|' || delivery_country || '|' || billing_address_2 || '|' || billing_country from checkout_customer_profiles where id='${F}';`).trim().split('\n').at(-1), '2. tv|SE|Office 4|NO');
  assert.equal(sql(claims(B) + `update checkout_customer_profiles set delivery_country='DK' where id='${F}';`).trim().split('\n').at(-1), 'UPDATE 0');

  deny(`set role anon; ${finalize(path)}`, 'permission denied');
  deny(claims(B) + finalize(path), 'customer_file_access_denied');
  deny(claims(A) + finalize(path,T), 'customer_file_access_denied');
  deny(claims(A) + finalize(path,S,[G]), 'customer_file_version_changed');
  deny(claims(A) + `insert into order_files(order_id,file_name,file_url,uploaded_by) values('${O}','bypass.pdf','https://evil.invalid','${A}');`, 'row-level security');
  assert.ok(sql(claims(A) + finalize(path,S,[F],true)).includes(O));
  deny(claims(A) + finalize(path), 'customer_file_storage_unverified');
  const upload = (objectPath, owner, size = 9) => `insert into storage.objects(bucket_id,name,owner_id,metadata) values('order-files','${objectPath}','${owner}','{"size":${size}}');`;
  deny(claims(B) + upload(path,B), 'row-level security');
  deny(`set role anon; ${upload(path,A)}`, 'row-level security');
  sql(`set role anon; insert into storage.objects(bucket_id,name) values('other-bucket','unrelated.png');`);
  sql(claims(A) + upload(path,A) + upload(path2,A));
  deny(claims(A) + finalize(path,S,[F],false,10), 'customer_file_storage_unverified');
  assert.equal(sql(claims(A) + `update storage.objects set metadata='{"size":12}' where name='${path}'; delete from storage.objects where name='${path}';`).trim().split('\n').slice(-2).join(','), 'UPDATE 0,DELETE 0');
  assert.equal(sql(`select count(*) from storage.objects where name='${path}' and metadata->>'size'='9';`).trim(), '1');

  // Two transactions race with the same expected current file. The first holds
  // the order lock until commit; the second must fail after the request closes.
  const runAsync = query => new Promise(resolve => {
    const child = spawn(docker, ['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',database,'-At']);
    let output = ''; let error = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => error += chunk);
    child.on('exit', code => resolve({code,output,error}));
    child.stdin.end(query);
  });
  const first = runAsync(claims(A) + 'begin;' + finalize(path) + 'select pg_sleep(1); commit;');
  await new Promise(resolve => setTimeout(resolve, 150));
  const second = runAsync(claims(A) + finalize(path2));
  const results = await Promise.all([first, second]);
  assert.equal(results.filter(result => result.code === 0).length, 1);
  assert.match(results.find(result => result.code !== 0).error, /customer_file_request_closed/);
  assert.equal(sql(`select count(*) from order_files where order_id='${O}' and is_current;`).trim(),'1');
  assert.equal(sql(`select count(*) from order_files where order_id='${O}';`).trim(),'2');
  assert.equal(sql(`select requires_file_reupload from orders where id='${O}';`).trim(),'f');
  assert.equal(sql(`select is_current from order_files where id='${G}';`).trim(),'t');
  assert.ok(sql(claims(A) + finalize(path)).trim().split('\n').at(-1).match(/^[a-f0-9-]{36}$/));
  deny(claims(A) + finalize(path,S,[F],false,10), 'customer_file_version_changed');
  sql(claims('90000000-0000-4000-8000-000000000001') + `insert into order_files(order_id,file_name,file_url) values('${O}','operator.pdf','https://fixture/operator.pdf');`);
});
