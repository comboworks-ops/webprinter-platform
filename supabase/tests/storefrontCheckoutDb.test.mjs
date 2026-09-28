// Offline integration fixture. Requires an existing disposable Postgres container:
// CHECKOUT_TEST_CONTAINER=<name> node --test supabase/tests/storefrontCheckoutDb.test.mjs
// The script creates and drops only its own uniquely named empty fixture database.
import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {spawn,spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";

const container = process.env.CHECKOUT_TEST_CONTAINER;
if (!container || !/^[a-zA-Z0-9_-]+$/.test(container)) throw new Error("CHECKOUT_TEST_CONTAINER must name a disposable local Postgres container");
const database = `checkout_repair_${process.pid}`;
const docker = "/opt/homebrew/bin/docker";
function sql(query, db = database) {
  const result = spawnSync(docker,["exec","-i",container,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d",db],
    {input: query,encoding: "utf8"});
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  return result.stdout.trim();
}
function concurrentSql(query) {
  return new Promise((resolve,reject) => {
    const child = spawn(docker,["exec","-i",container,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d",database]);
    let out = "",err = ""; child.stdout.on("data",chunk => out += chunk); child.stderr.on("data",chunk => err += chunk);
    child.on("error",reject); child.on("close",code => code === 0 ? resolve(out.trim()) : reject(new Error(err))); child.stdin.end(query);
  });
}
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "11111111-1111-4111-8111-111111111112";
const tenant = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";
const service = `set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);`;
const finalize = (attempt = id,payment = "pi_123") => `select public.finalize_storefront_checkout('${attempt}','${payment}',12345,'dkk',false);`;
function seed(attempt = id,payment = "pi_123",name = "approved.pdf",shop = tenant,customer = user) {
  sql(`${service}
    insert into public.storefront_checkout_attempts(id,tenant_id,user_id,access_token_hash,request_hash,
      order_snapshot,quote_snapshot,files_snapshot,amount_ore,livemode,payment_intent_id,state)
    values('${attempt}','${shop}','${customer}',repeat('a',64),repeat('b',64),
      '{"customer_email":"synthetic@example.test","customer_name":"Synthetic","product_name":"Synthetic matrix",
      "quantity":100,"delivery_address":"Testvej 1","delivery_address2":"2. th.","delivery_city":"Odense","delivery_zip":"5000","delivery_country":"DE"}',
      '{}','[{"file_name":"${name}","storage_path":"checkout-finalized/${attempt}/0-file.pdf","file_url":"https://example.test/immutable/${attempt}.pdf","file_type":"pdf","file_size":12,"sha256":"${"a".repeat(64)}"}]',
      12345,false,'${payment}','ready');
    insert into storage.objects(bucket_id,name,metadata) values('order-files','checkout-finalized/${attempt}/0-file.pdf','{"size":12}');`);
}

before(() => {
  sql(`create database ${database};`,"postgres");
  sql(`
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
    create schema auth; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant execute on function auth.jwt() to anon,authenticated,service_role;
    create table auth.users(id uuid primary key);
    create table public.tenants(id uuid primary key);
    create table public.orders(id uuid primary key default gen_random_uuid(),order_number text not null unique,
      user_id uuid,tenant_id uuid,customer_email text not null,customer_name text,customer_phone text,
      product_name text not null,product_slug text,quantity integer not null,total_price numeric not null,
      currency text,status text,delivery_type text,delivery_address text,delivery_zip text,delivery_city text,
      delivery_country text,product_configuration text,status_note text);
    create table public.order_files(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),
      file_name text not null check(file_name <> '__FAIL__.pdf'),file_url text not null,file_type text,file_size integer,
      is_current boolean,uploaded_by uuid,notes text);
    create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
    grant all on public.orders,public.order_files,storage.objects to service_role;
    grant select,insert,update,delete on public.orders,public.order_files,storage.objects to authenticated;
    insert into public.tenants values('${tenant}'),('22222222-2222-4222-8222-222222222223');
    insert into auth.users values('${user}'),('33333333-3333-4333-8333-333333333334');
  `);
  sql(readFileSync(new URL("../migrations/20260908171743_storefront_checkout_finalization.sql",import.meta.url),"utf8"));
});
after(() => {sql(`drop database if exists ${database} with (force);`,"postgres");});

test("concurrent duplicate callbacks commit one order, one file, full address and one payment reference", async () => {
  seed();
  const results = await Promise.all([concurrentSql(service + finalize()),concurrentSql(service + finalize()),concurrentSql(service + finalize())]);
  const orders = results.map(value => JSON.parse(value.split("\n").at(-1)));
  assert.equal(new Set(orders.map(order => order.id)).size,1);
  assert.equal(sql("select count(*) from public.orders"),"1"); assert.equal(sql("select count(*) from public.order_files"),"1");
  assert.equal(sql("select delivery_address2 || '|' || delivery_country || '|' || total_price from public.orders"),"2. th.|DE|123.4500000000000000");
});
test("failed file insert rolls back order and attempt completion; retry later succeeds once", () => {
  seed(otherId,"pi_456","__FAIL__.pdf","22222222-2222-4222-8222-222222222223","33333333-3333-4333-8333-333333333334");
  assert.throws(() => sql(service + finalize(otherId,"pi_456")),/violates check constraint/);
  assert.equal(sql(`select count(*) from public.orders where checkout_attempt_id = '${otherId}'`),"0");
  assert.equal(sql(`select state || '|' || (order_id is null)::text from public.storefront_checkout_attempts where id = '${otherId}'`),"ready|true");
  sql(`update public.storefront_checkout_attempts set files_snapshot = jsonb_set(files_snapshot,'{0,file_name}','"fixed.pdf"') where id = '${otherId}';`);
  sql(service + finalize(otherId,"pi_456"));
  assert.equal(sql(`select tenant_id || '|' || user_id from public.orders where checkout_attempt_id = '${otherId}'`),
    "22222222-2222-4222-8222-222222222223|33333333-3333-4333-8333-333333333334");
});
test("customer and anonymous roles cannot read attempts or execute finalization", () => {
  for (const role of ["authenticated","anon"]) {
    assert.throws(() => sql(`set role ${role}; select * from public.storefront_checkout_attempts;`),/permission denied/);
    assert.throws(() => sql(`set role ${role}; ${finalize()}`),/permission denied/);
  }
});
test("forged payment identity and changed captured amount are rejected", () => {
  assert.throws(() => sql(service + finalize(id,"pi_wrong")),/checkout_payment_mismatch/);
  assert.throws(() => sql(`${service} select public.finalize_storefront_checkout('${id}','pi_123',1,'dkk',false);`),/checkout_payment_mismatch/);
  assert.throws(() => sql(`set role authenticated; update public.orders set total_price = 1 where checkout_attempt_id='${id}';`),/checkout_order_identity_immutable/);
});
test("finalized storage objects cannot be inserted by customer or mutated by service", () => {
  assert.throws(() => sql(`set role authenticated; insert into storage.objects values('order-files','checkout-finalized/forged.pdf','{}');`),/checkout_artifact_server_only/);
  assert.throws(() => sql(`${service} delete from storage.objects where name='checkout-finalized/${id}/0-file.pdf';`),/checkout_artifact_immutable/);
  assert.throws(() => sql(`${service} update storage.objects set metadata='{"size":20}' where name='checkout-finalized/${id}/0-file.pdf';`),/checkout_artifact_immutable/);
});
test("cancelling a nonexistent attempt prevents a delayed creator from inserting it", () => {
  const cancelledId = "11111111-1111-4111-8111-111111111119";
  assert.equal(sql(`${service} select public.cancel_unstarted_storefront_checkout('${cancelledId}',repeat('a',64));`).split("\n").at(-1),"t");
  assert.throws(() => seed(cancelledId,"pi_never"),/checkout_attempt_cancelled/);
  assert.equal(sql(`select count(*) from public.storefront_checkout_attempts where id='${cancelledId}'`),"0");
  assert.equal(sql(`${service} select public.cancel_unstarted_storefront_checkout('${id}',repeat('a',64));`).split("\n").at(-1),"f");
});
