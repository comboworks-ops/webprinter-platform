import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRollLabelNativeNavigation } from '../shared/roll-label-native-navigation.js';
import { getProductCategoryPath, getProductCategoryDescendantIds } from '../../../src/utils/productCategories.ts';
const base = new URL('../../../output/supplier-imports/roll-labels-catalogue-2026-10-06/',import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name,base)));
const index = read('review/catalogue.json');
const evidence = read('import-review/navigation-collision-plan-004.json');
test('native mapping preserves captured existing identities, mode, exact groups and product IDs without selecting a tenant', () => {
  const before = JSON.stringify(index);
  const candidate = buildRollLabelNativeNavigation(index,evidence);
  const existing = evidence.verifiedExistingMasterNavigation;
  assert.equal(candidate.hierarchy.overview.id,existing.overviewId);
  assert.equal(candidate.hierarchy.categories[0].slug,'klistermrker');
  assert.equal(candidate.hierarchy.categories[0].navigation_mode,'all_in_one');
  assert.equal(candidate.hierarchy.categories[1].parent_category_id,existing.stickerCategoryId);
  assert.equal(candidate.hierarchy.categories[1].navigation_mode,'submenu');
  assert.equal(candidate.hierarchy.categories.length,7);
  assert.deepEqual(candidate.products.map(p=>p.id),index.products.map(p=>p.id));
  for (const product of candidate.products) assert.equal(getProductCategoryPath(candidate.hierarchy.categories,existing.stickerCategoryId,product.categoryId)?.length,2);
  assert.equal(candidate.navigationReview.targetTenantSelected,false);
  assert.equal(candidate.navigationReview.databaseWrites,false);
  assert.equal(JSON.stringify(index),before);
  const changed = structuredClone(evidence); changed.verifiedExistingMasterNavigation.stickerNavigationMode='submenu';
  assert.throws(()=>buildRollLabelNativeNavigation(index,changed),/review required/);
});
test('ancestry resolves deep routes and rejects foreign overview, sibling branch, missing parent and cycles', () => {
  const categories = [
    {id:'root',overview_id:'one'}, {id:'roll',overview_id:'one',parent_category_id:'root'},
    {id:'group',overview_id:'one',parent_category_id:'roll'}, {id:'leaf',overview_id:'one',parent_category_id:'group'},
    {id:'other',overview_id:'one'}, {id:'foreign',overview_id:'two',parent_category_id:'root'},
    {id:'broken',overview_id:'one',parent_category_id:'missing'},
    {id:'cycleA',overview_id:'one',parent_category_id:'cycleB'}, {id:'cycleB',overview_id:'one',parent_category_id:'cycleA'},
  ];
  assert.deepEqual(getProductCategoryPath(categories,'root','leaf').map(c=>c.id),['roll','group','leaf']);
  assert.deepEqual(getProductCategoryPath(categories,'root','root'),[]);
  for (const invalid of ['other','foreign','broken','cycleA','missing']) assert.equal(getProductCategoryPath(categories,'root',invalid),null);
  assert.deepEqual(getProductCategoryDescendantIds(categories,'cycleA'),['cycleA','cycleB']);
});
