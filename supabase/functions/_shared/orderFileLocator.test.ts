import test from 'node:test';
import assert from 'node:assert/strict';
import {orderFileStoragePath,supplierOrderFileUrl} from './orderFileLocator.ts';
const backend='https://example.supabase.co';
const publicUrl=backend+'/storage/v1/object/public/order-files/checkout-finalized/attempt/fil%20%C3%A6.pdf';
test('archive locators decode filenames while excluding foreign or malformed paths',()=>{
  assert.equal(orderFileStoragePath(publicUrl,backend),'checkout-finalized/attempt/fil æ.pdf');
  assert.equal(orderFileStoragePath(publicUrl.replace('example.supabase.co','elsewhere.test'),backend),null);
  for(const path of ['bad%ZZ','dir/%2e%2e/escape','bad%5cfile','bad%00file','dir//file'])
    assert.throws(()=>orderFileStoragePath(backend+'/storage/v1/object/public/order-files/'+path,backend));
});
test('supplier signing requires an order binding and never retrieves foreign URLs',async()=>{
  let bound=false, signs=0;
  const client={rpc:async(name:string,args:any)=>{
    assert.equal(name,'storefront_order_file_is_bound');assert.equal(args.p_order_id,'order');
    return {data:bound};
  },storage:{from:()=>({createSignedUrl:async(path:string,ttl:number)=>{
    signs++;assert.equal(ttl,86400);return {data:{signedUrl:backend+'/storage/v1/object/sign/order-files/'+path+'?token=fixture'}};
  }})}};
  await assert.rejects(()=>supplierOrderFileUrl(client,backend,'order',publicUrl),/not bound/);
  assert.equal(signs,0);bound=true;
  assert.match(await supplierOrderFileUrl(client,backend,'order',publicUrl),/object\/sign/);
  await assert.rejects(()=>supplierOrderFileUrl(client,backend,'order','https://foreign.test/file.pdf'),/archive/);
  assert.equal(signs,1);
});
