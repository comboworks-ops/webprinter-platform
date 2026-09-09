import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { calculateStorformatDisplayPrice } from './storformatDisplayPrice.ts';
import { getStorformatSourceQuoteFields } from '../lib/pricing/storformatQuoteUi.ts';

test('catalogue config read failure cannot reveal an obsolete m2-tier price', async () => {
  const source = readFileSync(new URL('./productPriceDisplay.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '');
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText.replace('export async function', 'async function');
  const product = {id: 'pixart', slug: 'pixart-flat-surface-adhesive', pricing_type: 'STORFORMAT', banner_config: {}};
  for (const response of [{data: null, error: null}, {data: null, error: {code: 'outage'}}]) {
    const tables: string[] = [];
    const supabase = {from: (table: string) => {
      tables.push(table);
      const query = {select: () => query, eq: () => query, maybeSingle: async () => response};
      return query;
    }};
    const createGetPrice = new Function('supabase', 'getPriceForSelection', 'calculateStorformatDisplayPrice', 'getStorformatSourceQuoteFields', compiled + '\nreturn getProductDisplayPrice;');
    const getPrice = createGetPrice(supabase, () => { throw new Error('must not quote fallback'); }, calculateStorformatDisplayPrice, getStorformatSourceQuoteFields);
    assert.equal(await getPrice(product), 'Se priser');
    assert.deepEqual(tables, ['storformat_configs']);
  }
});
