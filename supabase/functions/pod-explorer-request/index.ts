// Master-only POD v1 catalog/quote access. Supplier orders use their validated handlers.
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {readSupabaseKey} from '../_shared/supabaseKeys.ts';
import {requireRole} from '../_shared/auth.ts';
import {MASTER_TENANT_ID,normalizePrintcomBaseUrl,buildPrintcomUrl,PRINTCOM_EXPLORER_ORIGINS} from '../_shared/pod2PrintcomSafety.ts';
import {validatePodExplorerRequest,boundedExplorerText} from '../_shared/podExplorerAccess.ts';
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  try {
    const auth=await requireRole(req,['master_admin'],MASTER_TENANT_ID);
    if(!auth.ok)return auth.response;
    let input;try{input=validatePodExplorerRequest(JSON.parse(await boundedExplorerText(req.body,2*1024*1024)));}
    catch{return json({error:'pod_explorer_operation_not_allowed'},400);}
    const client=createClient(Deno.env.get('SUPABASE_URL')!,readSupabaseKey(name=>Deno.env.get(name),'secret')!);
    let query=client.from('pod_supplier_connections').select('*').eq('tenant_id',MASTER_TENANT_ID).eq('is_active',true);
    if(input.connectionId)query=query.eq('id',String(input.connectionId));
    const {data:connections,error}=await query.limit(10);
    if(error)return json({error:'pod_connection_unavailable'},503);
    const connection=connections?.find(c=>String(c.provider_key||'').toLowerCase().replace(/[^a-z0-9]/g,'')==='printcom');
    if(!connection)return json({error:'No active supplier connection found'},404);
    let base:string;
    try{base=normalizePrintcomBaseUrl(input.baseUrlOverride || connection.base_url,PRINTCOM_EXPLORER_ORIGINS);}
    catch{return json({error:'Base URL not allowed'},400);}
    const url=buildPrintcomUrl(base,input.path);
    for(const [name,value]of Object.entries(input.query)){if(value!=null&&value!=='')url.searchParams.set(name,String(value));}
    if(url.toString().length>8192)return json({error:'pod_explorer_invalid_query'},400);
    const apiKey=String(connection.api_key_encrypted||'').trim();
    if(!apiKey||/[\x00-\x1f\x7f]/.test(apiKey))return json({error:'pod_connection_credentials_invalid'},409);
    const protectedValues=[apiKey];
    const headers:Record<string,string>={'Content-Type':'application/json',Accept:'application/json'};
    switch(connection.auth_header_mode){
      case 'authorization_bearer':headers.Authorization=`Bearer ${apiKey}`;break;
      case 'x_api_key':headers['X-API-Key']=apiKey;break;
      case 'custom':{
        const name=String(connection.auth_header_name||''),prefix=String(connection.auth_header_prefix||'');
        if(!/^[A-Za-z0-9-]+$/.test(name)||/[\x00-\x1f\x7f]/.test(prefix))return json({error:'pod_connection_credentials_invalid'},409);
        headers[name]=prefix?`${prefix} ${apiKey}`:apiKey;break;
      }
      case 'oauth_client_credentials':{
        const [clientId,clientSecret]=apiKey.includes(':')?apiKey.split(':'):[apiKey,apiKey];
        protectedValues.push(clientId,clientSecret);
        const response=await fetch(new URL('/v2/oauth',base),{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
          headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret})});
        if(!response.ok)return json({error:'Supplier authentication failed'},502);
        const data=JSON.parse(await boundedExplorerText(response.body,64*1024));
        if(typeof data.access_token!=='string'||!data.access_token)return json({error:'Supplier authentication failed'},502);
        protectedValues.push(data.access_token);headers.Authorization=`Bearer ${data.access_token}`;break;
      }
      default:headers.Authorization=`PrintApiKey ${apiKey}`;
    }
    const run=async(requestHeaders:Record<string,string>)=>{
      const response=await fetch(url,{method:input.method,headers:requestHeaders,redirect:'error',signal:AbortSignal.timeout(20000),
        ...(input.method==='POST'?{body:JSON.stringify(input.requestBody||{})}:{})});
      let text=await boundedExplorerText(response.body,10*1024*1024);
      for(const secret of protectedValues.filter(value=>value.length>=8))text=text.split(secret).join('[redacted]');
      let data:unknown=text;if(response.headers.get('content-type')?.includes('application/json')){try{data=JSON.parse(text);}catch{data=text;}}
      return {response,data};
    };
    let result=await run(headers),fallbackUsed=false;
    if([401,403].includes(result.response.status)&&connection.auth_header_mode!=='x_api_key'&&connection.auth_header_mode!=='oauth_client_credentials'){
      result=await run({'Content-Type':'application/json',Accept:'application/json','X-API-Key':apiKey});fallbackUsed=true;
    }
    return json({status:result.response.status,statusText:result.response.statusText,
      headers:{'content-type':result.response.headers.get('content-type')||''},data:result.data,meta:{fallbackUsed}});
  }catch{return json({error:'pod_explorer_unavailable'},503);}
});
