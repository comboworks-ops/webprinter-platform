import assert from 'node:assert/strict';
import test from 'node:test';
import {validatePodExplorerRequest,boundedExplorerText} from './podExplorerAccess.ts';
import {buildPrintcomUrl,normalizePrintcomBaseUrl,PRINTCOM_EXPLORER_ORIGINS} from './pod2PrintcomSafety.ts';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {readSupabaseKey} from './supabaseKeys.ts';
test('v1 product reads and existing single/batch price quotes remain available',()=>{
  for(const [method,path] of [['GET','/products'],['GET','/products/business-cards'],['POST','/products/business-cards/price'],['POST','/products/batch/prices']]) {
    assert.equal(validatePodExplorerRequest({method,path,requestBody:{copies:100}}).path,path);
  }
});
test('supplier writes, account reads, alternate origins and path escaping are refused',()=>{
  for(const path of ['/orders','/accounts','//evil.test/products','https://evil.test/products','/products/../orders','/products/%2e%2e/orders','/products/a?x=1','/products/a#x']) {
    for(const method of ['GET','POST','PUT','PATCH','DELETE'])assert.throws(()=>validatePodExplorerRequest({method,path}));
  }
  assert.throws(()=>normalizePrintcomBaseUrl('https://evil.test',PRINTCOM_EXPLORER_ORIGINS));
  assert.throws(()=>buildPrintcomUrl('https://api.print.com','//evil.test/products'));
});
test('oversized request and response bodies are stopped during reading',async()=>{
  await assert.rejects(()=>boundedExplorerText(new Response('123456').body,5),/payload_too_large/);
  assert.equal(await boundedExplorerText(new Response('12345').body,5),'12345');
});
test('actual handler denies non-master callers before loading credentials; accepted quote stays on allowlisted host',async()=>{
  let handler:(req:Request)=>Promise<Response>,allowed=false,clientCalls=0;const requests:any[]=[];
  const source=readFileSync(new URL('../pod-explorer-request/index.ts',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
  const scope={serve:(fn:typeof handler)=>{handler=fn;},readSupabaseKey,validatePodExplorerRequest,boundedExplorerText,
    MASTER_TENANT_ID:'00000000-0000-0000-0000-000000000000',buildPrintcomUrl,normalizePrintcomBaseUrl,PRINTCOM_EXPLORER_ORIGINS,
    requireRole:async(_req:Request,roles:string[],tenant:string)=>{assert.deepEqual(roles,['master_admin']);assert.equal(tenant,scope.MASTER_TENANT_ID);
      return allowed?{ok:true}:{ok:false,response:new Response('{}',{status:403})};},
    createClient:()=>{clientCalls++;const query:any={select:()=>query,eq:()=>query,limit:async()=>({data:[{provider_key:'printcom',
      base_url:'https://api.print.com',api_key_encrypted:'supplier-secret-fixture',auth_header_mode:'x_api_key'}],error:null})};return {from:()=>query};},
    Deno:{env:{get:(key:string)=>({SUPABASE_URL:'https://project.example.test',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_fixture"}'}[key])}},
    fetch:async(url:URL,options:RequestInit)=>{requests.push({url:String(url),options});return new Response('{"price":123,"echo":"supplier-secret-fixture"}',{headers:{'content-type':'application/json'}});}};
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  new Function(...Object.keys(scope),compiled)(...Object.values(scope));
  const request=(body:any)=>new Request('https://edge.example.test',{method:'POST',body:JSON.stringify(body)});
  assert.equal((await handler!(request({method:'GET',path:'/products'}))).status,403);assert.equal(clientCalls,0);assert.equal(requests.length,0);
  allowed=true;
  assert.equal((await handler!(request({method:'POST',path:'/orders'}))).status,400);assert.equal(clientCalls,0);
  const response=await handler!(request({method:'POST',path:'/products/cards/price',requestBody:{copies:100}}));
  assert.equal(response.status,200);assert.equal(requests.length,1);assert.equal(requests[0].url,'https://api.print.com/products/cards/price');
  assert.equal(requests[0].options.redirect,'error');assert.equal(requests[0].options.method,'POST');
  assert.deepEqual((await response.json()).data,{price:123,echo:'[redacted]'});
});
