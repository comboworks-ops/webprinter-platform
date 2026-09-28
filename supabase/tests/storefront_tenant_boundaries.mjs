// Hosted synthetic acceptance test. Requires the explicitly provisioned launch
// branch and its ignored fixture/credential files; refuses production or real users.
// Usage: node supabase/tests/storefront_tenant_boundaries.mjs <evidence.json>
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {PDFDocument} from 'pdf-lib';
const directory=new URL('../../tmp/launch-staging-20260910/',import.meta.url);
const config=JSON.parse(fs.readFileSync(new URL('branch-private.json',directory)));
const fixturePath=new URL('fixtures-private.json',directory);
const fixture=JSON.parse(fs.readFileSync(fixturePath));
assert.equal(new URL(config.SUPABASE_URL).hostname,'cyurochbkxggcobnxaxq.supabase.co','Only the isolated launch branch is allowed');
const output=process.argv[2];assert.ok(output?.endsWith('.json'),'Supply an evidence JSON path');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const service=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,options);
function required(result,label){assert.equal(result.error,null,`${label}: ${result.error?.message}`);return result.data;}
const clients={};
for(const [name,user] of Object.entries(fixture.users)){
  assert.match(user.email,/^launch-20260910-[a-z_]+@example\.invalid$/);
  const stored=required(await service.auth.admin.getUserById(user.id),'fixture user');
  assert.equal(stored.user.email,user.email);assert.equal(stored.user.user_metadata.test_fixture,'webprinter-launch-20260910');
  clients[name]=createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,options);
  required(await clients[name].auth.signInWithPassword(user),'test sign in');
}
for(const id of Object.values(fixture.tenants)){
  const tenant=required(await service.from('tenants').select('settings').eq('id',id).single(),'fixture tenant');
  assert.equal(tenant.settings.test_fixture,'webprinter-launch-20260910');
}
const proof={project:'cyurochbkxggcobnxaxq',started_at:new Date().toISOString(),environment:'hosted synthetic',checks:[]};
function record(name,pass,result){
  proof.checks.push({name,pass,error:result?.error?.code,message:result?.error?.message,rows:Array.isArray(result?.data)?result.data.length:undefined});
  fs.writeFileSync(output,JSON.stringify(proof,null,2));
}
const denied=result=>result.error?.code==='42501'||(!result.error&&Array.isArray(result.data)&&result.data.length===0);
const a=fixture.tenants.a,b=fixture.tenants.b;
const ownBefore=required(await service.from('tenants').select('settings').eq('id',a).single(),'own settings').settings;
const branding={testSave:randomUUID()};
const ownSave=await clients.owner_a.rpc('tenant_branding_settings_compare_and_swap',{p_tenant_id:a,p_expected_settings:ownBefore,p_branding_patch:{branding}});
record('owner branding save',!ownSave.error&&ownSave.data?.length===1,ownSave);
const ownReload=await clients.owner_a.from('tenants').select('settings').eq('id',a).single();
record('branding survives reload',ownReload.data?.settings?.branding?.testSave===branding.testSave,ownReload);
const stale=await clients.owner_a.rpc('tenant_branding_settings_compare_and_swap',{p_tenant_id:a,p_expected_settings:ownBefore,p_branding_patch:{branding:{stale:true}}});
record('stale branding save cannot overwrite',!stale.error&&stale.data?.length===0,stale);
const otherBefore=required(await service.from('tenants').select('settings').eq('id',b).single(),'other settings').settings;
const cross=await clients.owner_a.rpc('tenant_branding_settings_compare_and_swap',{p_tenant_id:b,p_expected_settings:otherBefore,p_branding_patch:{branding:{crossProbe:true}}});
record('cross-shop branding RPC denied cleanly',denied(cross),cross);
if(cross.data?.length)required(await service.from('tenants').update({settings:otherBefore}).eq('id',b),'restore synthetic settings');
const direct=await clients.owner_a.from('tenants').update({settings:{...otherBefore,crossProbe:true}}).eq('id',b).select('id');
record('cross-shop direct settings write denied',denied(direct),direct);
if(direct.data?.length)required(await service.from('tenants').update({settings:otherBefore}).eq('id',b),'restore synthetic settings');
const platform=await clients.platform_admin.rpc('tenant_branding_settings_compare_and_swap',{p_tenant_id:b,p_expected_settings:otherBefore,p_branding_patch:{branding:{platformProbe:true}}});
record('platform admin can save another shop',!platform.error&&platform.data?.length===1,platform);
required(await service.from('tenants').update({settings:otherBefore}).eq('id',b),'restore synthetic settings');

const controls=await clients.owner_a.from('tenants').update({pod2_auto_forward:true}).eq('id',a).select('id');
record('tenant cannot activate platform-only fulfillment',denied(controls),controls);
if(controls.data?.length)required(await service.from('tenants').update({pod2_auto_forward:false}).eq('id',a),'restore test flag');
const escalate=await clients.owner_a.from('user_roles').insert({user_id:fixture.users.owner_a.id,role:'master_admin',tenant_id:a}).select('id');
record('tenant admin cannot self-promote to platform admin',denied(escalate),escalate);
if(escalate.data?.length)required(await service.from('user_roles').delete().in('id',escalate.data.map(x=>x.id)),'remove synthetic escalation');
const foreignRole=await clients.owner_a.from('user_roles').insert({user_id:fixture.users.customer_b.id,role:'admin',tenant_id:b}).select('id');
record('tenant admin cannot assign roles in another shop',denied(foreignRole),foreignRole);
if(foreignRole.data?.length)required(await service.from('user_roles').delete().in('id',foreignRole.data.map(x=>x.id)),'remove synthetic foreign role');

for(const [label,id,expected] of [['own',fixture.products.a,true],['foreign',fixture.products.b,false]]){
  const before=required(await service.from('products').select('description').eq('id',id).single(),'product snapshot');
  const result=await clients.owner_a.from('products').update({description:'Synthetic authorization probe'}).eq('id',id).select('id');
  record(`${label} product edit ${expected?'allowed':'denied'}`,expected?(!result.error&&result.data?.length===1):denied(result),result);
  required(await service.from('products').update(before).eq('id',id),'restore synthetic product');
}
const foreignPrice=required(await service.from('generic_product_prices').select('id,price_dkk').eq('product_id',fixture.products.b).single(),'price snapshot');
const priceEdit=await clients.owner_a.from('generic_product_prices').update({price_dkk:1}).eq('id',foreignPrice.id).select('id');
record('foreign product price edit denied',denied(priceEdit),priceEdit);
required(await service.from('generic_product_prices').update({price_dkk:foreignPrice.price_dkk}).eq('id',foreignPrice.id),'restore synthetic price');
const forgedPrice=await clients.owner_a.from('generic_product_prices').insert({tenant_id:a,product_id:fixture.products.b,variant_name:'Test spoof',variant_value:'standard',quantity:9999,price_dkk:1}).select('id');
record('price cannot target a different tenant product',denied(forgedPrice),forgedPrice);
if(forgedPrice.data?.length)required(await service.from('generic_product_prices').delete().in('id',forgedPrice.data.map(x=>x.id)),'remove synthetic forged price');

fixture.orders??={};
for(const letter of ['a','b']){
  if(!fixture.orders[letter]){
    const id=randomUUID();
    required(await service.from('orders').insert({id,tenant_id:fixture.tenants[letter],user_id:fixture.users[`customer_${letter}`].id,order_number:`TEST-AUTH-${id}`,customer_email:fixture.users[`customer_${letter}`].email,product_name:'SYNTHETIC AUTHORIZATION FIXTURE',quantity:1,total_price:0,status:'pending'}),'synthetic order');
    fixture.orders[letter]=id;fs.writeFileSync(fixturePath,JSON.stringify(fixture,null,2),{mode:0o600});
  }
}
for(const name of ['owner_a','customer_a'])for(const letter of ['a','b']){
  const result=await clients[name].from('orders').select('id').eq('id',fixture.orders[letter]);
  record(`${name} ${letter==='a'?'own':'foreign'} order read`,letter==='a'?(!result.error&&result.data?.length===1):denied(result),result);
}
const crossOrder=await clients.owner_a.from('orders').update({status_note:'Unauthorized synthetic probe'}).eq('id',fixture.orders.b).select('id');
record('cross-shop order update denied',denied(crossOrder),crossOrder);
required(await service.from('orders').update({status_note:null}).eq('id',fixture.orders.b),'restore synthetic order');

const message=required(await service.from('order_messages').insert({order_id:fixture.orders.a,sender_id:fixture.users.owner_a.id,sender_type:'admin',content:'SYNTHETIC TEST - replacement requested',is_read:false}).select('id').single(),'synthetic message');
for(const name of ['customer_b','customer_a']){
  const result=await clients[name].rpc('customer_mark_order_messages_read',{p_order_id:fixture.orders.a,p_tenant_id:a,p_message_ids:[message.id]});
  record(`${name} message acknowledgement`,name==='customer_a'?(!result.error&&result.data?.includes(message.id)):result.error?.code==='42501',result);
}
const overwrite=await clients.customer_a.from('order_messages').update({content:'Forbidden rewrite'}).eq('id',message.id).select('id');
record('customer cannot rewrite an operator message',denied(overwrite),overwrite);

const orderId=fixture.orders.a;
required(await service.from('orders').update({requires_file_reupload:true}).eq('id',orderId),'open replacement request');
const current=required(await service.from('order_files').select('id').eq('order_id',orderId).eq('is_current',true),'current versions').map(x=>x.id);
const pdf=await PDFDocument.create();pdf.addPage([100,100]);const bytes=await pdf.save();
const storagePath=`${orderId}/${fixture.users.customer_a.id}/${randomUUID()}.pdf`;
const params={p_order_id:orderId,p_tenant_id:a,p_file_name:'synthetic-replacement.pdf',p_file_size:bytes.length,p_expected_current_file_ids:current,p_storage_path:storagePath};
const foreignFile=await clients.customer_b.rpc('customer_finalize_order_file',{...params,p_validate_only:true});
record('other customer replacement rejected',foreignFile.error?.code==='42501',foreignFile);
const preflight=await clients.customer_a.rpc('customer_finalize_order_file',{...params,p_validate_only:true});
record('own replacement preflight works',!preflight.error&&preflight.data===orderId,preflight);
const upload=await clients.customer_a.storage.from('order-files').upload(storagePath,bytes,{contentType:'application/pdf',upsert:false});
record('customer replacement storage upload works',!upload.error,upload);
if(!upload.error){
  const result=await clients.customer_a.rpc('customer_finalize_order_file',{...params,p_validate_only:false});
  record('replacement finalizes atomically',!result.error&&typeof result.data==='string',result);
  const repeat=await clients.customer_a.rpc('customer_finalize_order_file',{...params,p_validate_only:false});
  record('replacement retry returns the same version',!repeat.error&&repeat.data===result.data,repeat);
  const versions=await clients.customer_a.from('order_files').select('id').eq('order_id',orderId).eq('is_current',true);
  record('exactly one current file after replacement',!versions.error&&versions.data?.length===1,versions);
}
const profile=await clients.customer_a.from('checkout_customer_profiles').insert({user_id:fixture.users.customer_a.id,label:'Synthetic address',delivery_address_2:'2. tv.',delivery_country:'DK',billing_address_2:'Unit B',billing_country:'DK'}).select('id,delivery_address_2,billing_country').single();
record('customer address details persist',!profile.error&&profile.data?.delivery_address_2==='2. tv.'&&profile.data?.billing_country==='DK',profile);
if(profile.data){const result=await clients.customer_b.from('checkout_customer_profiles').select('id').eq('id',profile.data.id);record('other customer address read denied',denied(result),result);}
proof.finished_at=new Date().toISOString();proof.passed=proof.checks.filter(x=>x.pass).length;proof.failed=proof.checks.filter(x=>!x.pass).length;
fs.writeFileSync(output,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));process.exitCode=proof.failed?1:0;
