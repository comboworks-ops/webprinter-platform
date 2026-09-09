import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_CUSTOMER_FILE_SIZE, uploadCustomerReplacementFile, validateCustomerReplacement } from './replacementFile.ts';

const request = () => ({ orderId:'order-a', tenantId:'shop-a', userId:'customer-a', file:new File(['%PDF test'], 'print.pdf', {type:'application/pdf'}), expectedCurrentFileIds:['old-file'] });
function harness(results: unknown[], uploadError: unknown = null) {
  interface CallArgs {
    p_validate_only?: boolean;
    p_expected_current_file_ids?: string[];
    bucket?: string;
    path?: string;
    file?: File;
    options?: { upsert: boolean };
  }
  const calls: {name: string; args: CallArgs}[] = [];
  const client = {
    rpc: async (name: string,args: CallArgs) => { calls.push({name,args}); const result=results.shift(); if(result instanceof Error) throw result; return result; },
    storage: {from: (bucket: string) => ({upload: async (path: string,file: File,options: {upsert: boolean}) => { calls.push({name:'upload',args:{bucket,path,file,options}}); return {error:uploadError}; }})},
  };
  return {client: client as unknown as SupabaseClient,calls};
}
test('an unavailable finalizer prevents any upload or destructive browser database calls',async () => {
  const {client,calls}=harness([{data:null,error:{code:'PGRST202'}}]);
  await assert.rejects(uploadCustomerReplacementFile(client,request()),/ikke tilgængelig/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].args.p_validate_only,true);
});
test('success follows immutable upload and verified finalization, retaining current-file CAS',async () => {
  const {client,calls}=harness([{data:'order-a',error:null},{data:'new-file',error:null}]);
  assert.equal(await uploadCustomerReplacementFile(client,request()),'new-file');
  assert.deepEqual(calls.map(x=>x.name),['customer_finalize_order_file','upload','customer_finalize_order_file']);
  assert.equal(calls[1].args.options.upsert,false);
  assert.match(calls[1].args.path,/^order-a\/customer-a\/[a-f0-9-]+\.pdf$/);
  assert.deepEqual(calls[2].args.p_expected_current_file_ids,['old-file']);
  assert.equal(calls[2].args.p_validate_only,false);
});
test('storage failure never reaches finalization',async () => {
  const {client,calls}=harness([{data:'order-a',error:null}],new Error('storage failure'));
  await assert.rejects(uploadCustomerReplacementFile(client,request()),/nuværende fil er bevaret/);
  assert.equal(calls.length,2);
});
test('uncertain finalization does not retry or delete a potentially committed file',async () => {
  for(const result of [new Error('timeout'),{data:null,error:{code:'timeout'}},{data:null,error:null}]) {
    const {client,calls}=harness([{data:'order-a',error:null},result]);
    await assert.rejects(uploadCustomerReplacementFile(client,request()),/kontrollér den aktuelle fil/);
    assert.equal(calls.length,3);
  }
});
test('replacement validation retains established formats and rejects empty/oversize/unsafe file names',() => {
  for (const ext of ['pdf','jpg','jpeg','png','ai','eps']) assert.equal(validateCustomerReplacement({...request(),file:new File(['x'],`print.${ext}`)}),ext);
  for (const file of [new File(['x'],'script.html'),new File([],'empty.pdf'),new File(['x'],'bad\nname.pdf'),{name:'huge.pdf',size:MAX_CUSTOMER_FILE_SIZE+1} as File]) {
    assert.throws(()=>validateCustomerReplacement({...request(),file}));
  }
});
