import test from 'node:test';
import assert from 'node:assert/strict';
import {brochureManagementCounter} from '../shared/brochure-management-count.js';
import {countBrochureOwned} from '../shared/brochure-product-draft.js';
const plan={tenantId:'00000000-0000-0000-0000-000000000000',proposedProductId:'1f494aac-e4f2-47a2-96ab-b4b6955382ef'};
const client=result=>({from(){const query={select(){return query;},eq(){return query;},then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};return query;}});
test('large count fallback uses only a schema-qualified parameterized read-only query for owned brochure rows',async()=>{
  let request;
  const count=brochureManagementCounter({projectRef:'ziattmsmiirfweiuunfo',accessToken:'fixture-only',fetchImpl:async(url,options)=>{
    request={url,options};return new Response(JSON.stringify([{count:'5073527'}]));}});
  assert.equal(await count('generic_product_prices',plan),5073527);
  assert.match(request.url,/\/database\/query\/read-only$/);
  const body=JSON.parse(request.options.body);assert.match(body.query,/public\.generic_product_prices/);
  assert.match(body.query,/tenant_id = \$1::uuid and product_id = \$2::uuid/);assert.deepEqual(body.parameters,[plan.tenantId,plan.proposedProductId]);
  await assert.rejects(count('products; delete from public.products',plan),/scope/);
  await assert.rejects(count('generic_product_prices',{...plan,proposedProductId:"' or true --"}),/scope/);
});
test('count fallback recovers unavailable REST counts but cannot hide extra rows or a real count mismatch',async()=>{
  let called=0;const fallback=async()=>{called++;return 3;};
  assert.equal(await countBrochureOwned(client({count:null,error:{message:''},status:500}),'generic_product_prices',plan,3,fallback),3);
  assert.equal(called,1);
  await assert.rejects(countBrochureOwned(client({count:4,error:null}),'generic_product_prices',plan,3,fallback),/unexpected/);
  assert.equal(called,1);
  await assert.rejects(countBrochureOwned(client({count:null,error:{message:'timeout'}}),'generic_product_prices',plan,3,async()=>4),/unexpected/);
});
