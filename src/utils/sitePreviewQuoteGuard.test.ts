import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../../public/site-previews/banner-builder-pro/banner-visualizer-inject.mjs', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('preview.mjs', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
function functionFromSource(name: string, scope: Record<string, unknown>) {
  let match: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) match = node;
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.ok(match, `${name} exists`);
  return new Function(...Object.keys(scope), `return (${match.getText(parsed)});`)(...Object.values(scope));
}

test('quote preview route uses the actual runtime product and preserves tenant context', () => {
  const route = functionFromSource('quoteProductCalculatorUrl', {
    window: {location: {origin: 'http://127.0.0.1:8110'}}, readCheckoutTenantId: () => 'master',
  });
  assert.equal(route({runtimeProduct: {id: 'pixart-id', slug: 'pixart-flat-surface-adhesive'}}),
    'http://127.0.0.1:8110/produkt/pixart-flat-surface-adhesive?tenantId=master');
  for (const runtimeProduct of [null, {}, {id: 'pixart-id'}, {slug: 'demo'}, {id: 'pixart-id', slug: '..'}]) {
    assert.equal(route({runtimeProduct}), null);
  }
});

test('switching to a quote product removes stale delivery details and keeps the renamed CTA discoverable', () => {
  let removed = 0;
  const priceNode = {textContent: '435 DKK'};
  const card = {querySelectorAll: () => [{remove: () => {removed++;}}, {remove: () => {removed++;}}]};
  const host = {querySelector: () => priceNode, querySelectorAll: () => [priceNode]};
  const button = {textContent: 'Bestil nu', disabled: false, dataset: {} as Record<string, string>, parentElement: host, closest: () => card};
  const update = functionFromSource('updateBackendPriceSummaryDisplay', {
    findPriceSummaryHost: () => ({orderButton: button, host}), BACKEND_PRICING_BREAKDOWN_ID: 'wp-backend-pricing-breakdown',
    setSimpleNodeText: (node: {textContent: string}, text: string) => {node.textContent = text; return true;},
    normalizeText: (text: string) => text.toLowerCase(), quoteProductCalculatorUrl: (result: {runtimeProduct: unknown}) => result.runtimeProduct ? '/produkt/pixart' : null,
  });
  update({requiresProductCalculator: true, runtimeProduct: {}}, 120, 80, 'Pixart');
  assert.equal(removed, 2); assert.equal(priceNode.textContent, 'Se pris og tilvalg');
  assert.equal(button.textContent, 'Åbn produktets prisberegner');
  const find = functionFromSource('findPriceSummaryHost', {
    document: {getElementById: () => ({querySelectorAll: () => [button]})}, normalizeText: (text: string) => text.toLowerCase(),
  });
  assert.equal(find().orderButton, button);
  update({requiresProductCalculator: true, runtimeProduct: null}, 120, 80, 'Pixart');
  assert.equal(button.disabled, true); assert.equal(button.textContent, 'Prisberegner utilgængelig');
  update({requiresProductCalculator: true, runtimeProduct: {}}, 120, 80, 'Pixart');
  assert.equal(button.disabled, false);
});

test('quote preview click cannot create a legacy checkout or navigate to a demo fallback', () => {
  const location = {href: ''};
  let fallbackQuotes = 0;
  const click = functionFromSource('handleCheckoutOrderClick', {
    readDimensions: () => ({widthCm: 120,heightCm: 80}), clamp: (value: number) => value,
    readFinishSelection: () => ({}), readProductVariant: () => 'default',
    applyBackendPricingBridge: () => ({requiresProductCalculator: true}),
    resolveCheckoutSelectedProduct: () => ({slug: 'wrong-demo-fallback'}),
    quoteProductCalculatorUrl: () => null, window: {top: {location}},
    collectSelectedFinishes: () => {fallbackQuotes++; throw new Error('must not construct legacy checkout');},
  });
  click(); assert.equal(location.href, ''); assert.equal(fallbackQuotes, 0);
});
