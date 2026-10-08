import test from 'node:test';
import assert from 'node:assert/strict';
import { readBrochureFreePriceResponse, validBrochureFreeSize } from './brochureFreePricing.ts';
const selection = { articleId: '2009', nativePaperId: '282595', pageCount: 8, widthMm: 148, heightMm: 210 };
const source = { articleId: '2009', substrateId: '282595', pageCount: 8, widthMm: 148, heightMm: 210,
  currency: 'DKK', vatState: 'excluded', conversionRuleKey: 'wmd_tiered_fx_7_5', prices: [[1,364,30.3,'native1'],[10000,11222,1068.8,'native10000']] };
test('free brochure keeps sparse source tiers only for the exact native selection and dimensions', () => {
  assert.deepEqual(readBrochureFreePriceResponse(source, selection), [[1,364],[10000,11222]]);
  for (const change of [{ widthMm: 147 }, { heightMm: 209 }, { pageCount: 12 }, { substrateId: 'other' }, { articleId: 'other' },
    { vatState: 'included' }, { currency: 'EUR' }, { conversionRuleKey: 'other' }]) {
    assert.throws(() => readBrochureFreePriceResponse({ ...source, ...change }, selection), /matcher/);
  }
});
test('duplicate/invalid quantities and malformed prices fail closed without inventing a cell', () => {
  for (const prices of [[], [source.prices[0],source.prices[0]], [[1,0,30.3,'native']], [[10001,364,30.3,'native']], [[1,364.5,30.3,'native']]]) {
    assert.throws(() => readBrochureFreePriceResponse({ ...source, prices }, selection));
  }
  assert.equal(validBrochureFreeSize(98,297), true);
  for (const [width,height] of [[97.9,210],[297.1,210],[148,420],[148.01,210],[NaN,210]]) assert.equal(validBrochureFreeSize(width,height),false);
});
