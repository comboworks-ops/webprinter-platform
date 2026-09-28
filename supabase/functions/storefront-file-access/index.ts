import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {readSupabaseKey} from '../_shared/supabaseKeys.ts';
import {CheckoutError,sha256} from '../_shared/storefrontCheckout.ts';
import {checkoutJson,checkoutFailure,checkoutCors} from '../_shared/storefrontCheckoutRuntime.ts';
import {checkRateLimit} from '../_shared/rateLimit.ts';
import {validateUploadAllocation,requireUploadCapability,signPrivateUpload} from '../_shared/storefrontFileAccess.ts';

Deno.serve(async req => {
  if(req.method==='OPTIONS')return new Response('ok',{headers:checkoutCors});
  if(req.method!=='POST')return checkoutJson({error:'method_not_allowed'},405);
  try {
    if(Deno.env.get('STOREFRONT_PRIVATE_FILES_ENABLED')!=='true')throw new CheckoutError('private_files_not_enabled',503);
    const limited=checkRateLimit(req,{keyPrefix:'storefront-files',limit:30,windowMs:60000});
    if(limited)return limited;
    const reader=req.body?.getReader();if(!reader)throw new CheckoutError('file_request_invalid');
    const chunks:Uint8Array[]=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
      if(length>8192){await reader.cancel();throw new CheckoutError('file_request_too_large',413);}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let input:any;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new CheckoutError('file_request_invalid');}
    if(!input || !['allocate','read'].includes(input.action))throw new CheckoutError('file_request_invalid');
    const url=Deno.env.get('SUPABASE_URL')!;
    const key=readSupabaseKey(name=>Deno.env.get(name),'secret')!;
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let userId:string|null=null;
    const authorization=req.headers.get('Authorization');
    if(authorization && authorization!==`Bearer ${req.headers.get('apikey')}`){
      const userClient=createClient(url,readSupabaseKey(name=>Deno.env.get(name),'publishable')!);
      const {data,error}=await userClient.auth.getUser(authorization.replace(/^Bearer /i,''));
      if(error||!data.user)throw new CheckoutError('file_access_denied',403);userId=data.user.id;
    }
    if(input.action==='allocate'){
      const allocation=validateUploadAllocation(input);
      const {data:tenant,error:tenantError}=await client.from('tenants').select('id').eq('id',allocation.tenant_id).maybeSingle();
      if(tenantError||!tenant)throw new CheckoutError('file_access_denied',403);
      const {error}=await client.from('storefront_file_uploads').insert({...allocation,user_id:userId,access_token_hash:await sha256(input.access_token)});
      if(error&&error.code!=='23505')throw new CheckoutError('file_access_unavailable',503);
      const claim=await requireUploadCapability(client,{...input,user_id:userId});
      if(['file_name','file_size','sha256','storage_path'].some(field=>claim[field]!==allocation[field as keyof typeof allocation]))throw new CheckoutError('file_upload_changed',409);
      const {data,error:signError}=await client.storage.from('order-files').createSignedUploadUrl(claim.storage_path,{upsert:false});
      if(signError||!data?.token)throw new CheckoutError('file_upload_unavailable',503);
      return checkoutJson({id:claim.id,path:claim.storage_path,token:data.token});
    }
    const claim=await requireUploadCapability(client,{...input,user_id:userId});
    return checkoutJson({path:claim.storage_path,url:await signPrivateUpload(client,claim),expires_in:900});
  }catch(error){return checkoutFailure(error);}
});
