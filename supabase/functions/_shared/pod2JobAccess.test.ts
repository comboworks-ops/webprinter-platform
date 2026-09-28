import test from 'node:test';
import assert from 'node:assert/strict';
import {completedOrderProof,ownsCompletedCheckout,canManagePod2Jobs} from './pod2JobAccess.ts';
import {sha256} from './storefrontCheckout.ts';
const order={id:'order',tenant_id:'tenant',total_price:125};
const token='11111111-1111-4111-8111-111111111111';
test('a job requires the exact completed payment/order/tenant/amount and recovery token',async()=>{
  const attempt={order_id:'order',tenant_id:'tenant',state:'completed',amount_ore:12500,payment_intent_id:'pi_fixture',access_token_hash:await sha256(token)};
  assert.equal(await ownsCompletedCheckout(attempt,order,token),true);
  for(const delta of [{order_id:'other'},{tenant_id:'other'},{state:'ready'},{amount_ore:10000},{payment_intent_id:null}])
    assert.equal(await ownsCompletedCheckout({...attempt,...delta},order,token),false);
  assert.equal(await ownsCompletedCheckout(attempt,order,'22222222-2222-4222-8222-222222222222'),false);
  assert.equal(completedOrderProof(null,order),false);
});
test('tenant job management excludes customer/staff and other-tenant admins',async()=>{
  let roles:any[]=[],owner='other';
  const client={from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{owner_id:owner}}),
    then:(resolve:any)=>resolve({data:roles})};return q;}};
  for(const role of [{role:'customer',tenant_id:'tenant'},{role:'staff',tenant_id:'tenant'},{role:'admin',tenant_id:'other'}]){
    roles=[role];assert.equal(await canManagePod2Jobs(client,'user','tenant'),false);
  }
  roles=[{role:'admin',tenant_id:'tenant'}];assert.equal(await canManagePod2Jobs(client,'user','tenant'),true);
  roles=[{role:'master_admin',tenant_id:null}];assert.equal(await canManagePod2Jobs(client,'user','tenant'),true);
  roles=[];owner='user';assert.equal(await canManagePod2Jobs(client,'user','tenant'),true);
});
