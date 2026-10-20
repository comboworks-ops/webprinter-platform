// Isolated PostgreSQL (PGlite) test. No network or hosted database connection.
// PGLITE_MODULE can point at an isolated, pinned installation; see the audit doc.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const dir = new URL('../../supabase/migrations/', import.meta.url);
const files = ['20231210100000_customer_addresses.sql', '20260310120000_create_checkout_customer_profiles.sql'];
const uidA='00000000-0000-0000-0000-000000000001';
const uidB='00000000-0000-0000-0000-000000000002';
const db = new PGlite();
let checks=0;
async function eq(sql, expected) { assert.deepEqual((await db.query(sql)).rows, expected); checks++; }
async function denied(sql) { await assert.rejects(db.query(sql), e=>e.code==='42501'); checks++; }
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 insert into auth.users values ('${uidA}'),('${uidB}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;`);
 // There are deliberately NO automatic table grants in this database.
 for (const file of files) await db.exec(readFileSync(new URL(file,dir),'utf8'));
 const followup=readdirSync(dir).find(x=>x.endsWith('_customer_account_explicit_data_api_grants.sql'));
 assert.ok(followup);
 const policiesBefore=(await db.query("select * from pg_policies order by tablename,policyname")).rows;
 await db.exec(readFileSync(new URL(followup,dir),'utf8'));
 await db.exec(readFileSync(new URL(followup,dir),'utf8')); // idempotent grants
 assert.deepEqual((await db.query("select * from pg_policies order by tablename,policyname")).rows,policiesBefore);checks++;
 for (const table of ['customer_addresses','checkout_customer_profiles']) {
  await eq(`select has_table_privilege('anon','public.${table}','SELECT') as allowed`,[{allowed:false}]);
  await eq(`select has_table_privilege('authenticated','public.${table}','TRUNCATE') as allowed`,[{allowed:false}]);
  await eq(`select has_table_privilege('service_role','public.${table}','SELECT') as allowed`,[{allowed:false}]);
  const values=table==='customer_addresses' ? "first_name,last_name,street_address,postal_code,city" : 'label';
  const data=table==='customer_addresses' ? "'A','Test','Synthetic street','0000','Test city'" : "'Synthetic profile'";
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uidA}',false)`);
  await db.exec(`insert into public.${table}(user_id,${values}) values ('${uidA}',${data})`);
  await eq(`select count(*)::int as n from public.${table}`,[{n:1}]);
  await denied(`insert into public.${table}(user_id,${values}) values ('${uidB}',${data})`);
  await denied(`update public.${table} set user_id='${uidB}'`);
  await db.exec(`select set_config('request.jwt.claim.sub','${uidB}',false)`);
  await eq(`select count(*)::int as n from public.${table}`,[{n:0}]);
  assert.equal((await db.query(`update public.${table} set updated_at=now() returning id`)).rows.length,0);checks++;
  assert.equal((await db.query(`delete from public.${table} returning id`)).rows.length,0);checks++;
  await db.exec(`select set_config('request.jwt.claim.sub','${uidA}',false)`);
  assert.equal((await db.query(`update public.${table} set updated_at=now() returning id`)).rows.length,1);checks++;
  assert.equal((await db.query(`delete from public.${table} returning id`)).rows.length,1);checks++;
  await db.exec('reset role; set role anon');
  await denied(`select * from public.${table}`);
  await db.exec('reset role');
 }
 console.log(`${checks} assertions passed: explicit grants, own-row CRUD, cross-user denial, no guest/service/TRUNCATE expansion, unchanged policies.`);
} finally { await db.close(); }
