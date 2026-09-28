import assert from 'node:assert/strict';
import test from 'node:test';
import {MAX_CHECKOUT_UPLOAD_BYTES,validateUploadAllocation,requireUploadCapability} from './storefrontFileAccess.ts';
import {sha256} from './storefrontCheckout.ts';
const id='11111111-1111-4111-8111-111111111111',tenant='22222222-2222-4222-8222-222222222222',token='a'.repeat(64);
const input={id,tenant_id:tenant,access_token:token,file_name:'art.pdf',file_size:1024,sha256:'b'.repeat(64)};
test('upload paths are generated independently of filenames; invalid size/type/token rejected',()=>{
  assert.equal(validateUploadAllocation({...input,file_name:'../art.pdf'}).storage_path,`checkout-uploads/${id}.pdf`);
  assert.equal(validateUploadAllocation({...input,file_size:MAX_CHECKOUT_UPLOAD_BYTES}).file_size,MAX_CHECKOUT_UPLOAD_BYTES);
  for(const changed of [{file_size:0},{file_size:MAX_CHECKOUT_UPLOAD_BYTES+1},{file_size:1.5},{file_name:'payload.html'},
    {file_name:'bad\n.pdf'},{access_token:'guess'},{tenant_id:'wrong'},{sha256:'wrong'}]) {
    assert.throws(()=>validateUploadAllocation({...input,...changed}));
  }
});
test('capability requires exact token, tenant, optional owner and unexpired claim',async()=>{
  const claim:any={...validateUploadAllocation(input),access_token_hash:await sha256(token),user_id:null,
    expires_at:new Date(Date.now()+60000).toISOString()};
  const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:claim,error:null})})})})};
  const request={id,tenant_id:tenant,access_token:token,user_id:null};
  assert.equal(await requireUploadCapability(client,request),claim);
  await assert.rejects(()=>requireUploadCapability(client,{...request,access_token:'c'.repeat(64)}),/file_access_denied/);
  await assert.rejects(()=>requireUploadCapability(client,{...request,tenant_id:id}),/file_access_denied/);
  claim.user_id='owner';
  await assert.rejects(()=>requireUploadCapability(client,request),/file_access_denied/);
  assert.equal(await requireUploadCapability(client,{...request,user_id:'owner'}),claim);
  claim.expires_at=new Date(Date.now()-1000).toISOString();
  await assert.rejects(()=>requireUploadCapability(client,{...request,user_id:'owner'}),/file_access_denied/);
});
