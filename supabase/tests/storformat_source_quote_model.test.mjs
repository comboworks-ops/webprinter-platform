import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Only a network-disabled, disposable fixture created for this test. Never accept linked/hosted targets.
const container = process.env.PIXART_QUOTE_TEST_CONTAINER;
const enabled = container === 'webprinter-pixart-quotes-20260909';
const docker = '/opt/homebrew/bin/docker';
const database = `pixart_quote_${process.pid}`;
const sql = (query, db = database) => execFileSync(docker,
  ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '-At'],
  {input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
const quotedJson = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

test('source quote migration preserves existing rows/grants, enforces paired metadata, and rolls back', {skip: !enabled}, () => {
  assert.equal(execFileSync(docker, ['inspect', '--format', '{{.HostConfig.NetworkMode}}', container], {encoding: 'utf8'}).trim(), 'none');
  sql(`create database ${database}`, 'postgres');
  try {
    sql("create table public.storformat_configs (id integer primary key, sentinel text); insert into public.storformat_configs values (1,'keep'); alter table public.storformat_configs enable row level security;");
    const beforeAccess = sql("select coalesce(relacl::text,'NULL') || '|' || relrowsecurity from pg_class where oid='public.storformat_configs'::regclass");
    sql(readFileSync(new URL('../migrations/20260909131000_storformat_source_quote_model.sql', import.meta.url), 'utf8'));
    assert.equal(sql("select area_pricing_basis || '|' || coalesce(source_quote_model::text,'NULL') || '|' || sentinel from public.storformat_configs where id=1"), 'total_area|NULL|keep');
    assert.equal(sql("select coalesce(relacl::text,'NULL') || '|' || relrowsecurity from pg_class where oid='public.storformat_configs'::regclass"), beforeAccess);
    const model = {version: 1, currency: 'DKK', price_basis: 'regular', base_product_ids: [], combinations: [
      {material_id: 'material', finish_ids: [], product_ids: [], points: [{area_m2: 0.96, quantity: 1, total_price: 183.5856}]},
    ]};
    const rejected = (query) => assert.throws(() => sql(query), error => error.stderr?.includes('source_quote_model_pair_check'));
    rejected("update public.storformat_configs set area_pricing_basis='per_piece_quotes' where id=1");
    rejected(`update public.storformat_configs set source_quote_model=${quotedJson(model)} where id=1`);
    rejected("update public.storformat_configs set area_pricing_basis='unknown' where id=1");
    for (const invalid of [null, {}, {...model, version: '1'}, {...model, version: 2}, {...model, currency: 'EUR'},
      {...model, price_basis: 'sale'}, {...model, base_product_ids: null}, {...model, combinations: []}, {...model, combinations: {}}]) {
      rejected(`update public.storformat_configs set area_pricing_basis='per_piece_quotes', source_quote_model=${quotedJson(invalid)} where id=1`);
    }
    sql(`update public.storformat_configs set area_pricing_basis='per_piece_quotes',source_quote_model=${quotedJson(model)} where id=1`);
    assert.equal(sql("select source_quote_model->'combinations'->0->'points'->0->>'total_price' from public.storformat_configs where id=1"), '183.5856');
    sql("update public.storformat_configs set area_pricing_basis='total_area',source_quote_model=NULL where id=1; alter table public.storformat_configs drop constraint storformat_configs_source_quote_model_pair_check, drop column source_quote_model, drop column area_pricing_basis;");
    assert.equal(sql("select sentinel from public.storformat_configs where id=1"), 'keep');
    assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='storformat_configs'"), '2');
  } finally {
    sql(`drop database ${database}`, 'postgres');
  }
});
