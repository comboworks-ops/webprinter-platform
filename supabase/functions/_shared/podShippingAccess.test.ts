import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePodShippingInput} from './podShippingAccess.ts';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {boundedExplorerText} from './podExplorerAccess.ts';
import {readSupabaseKey} from './supabaseKeys.ts';
const body={productId:'11111111-1111-4111-8111-111111111111',quantity:100,variantKey:'format:a4',
  verticalValueId:'22222222-2222-4222-8222-222222222222',address:{country:'DK'}};
test('the existing storefront shipping request remains valid',()=>assert.deepEqual(validatePodShippingInput(body),body));
test('free-form supplier selections, address data and unbounded quotes are rejected',()=>{
  for(const delta of [{selectionMap:{}},{dateFrom:'2026-01-01'},{address:{country:'DK',postcode:'1000'}},
    {quantity:1.5},{quantity:0},{quantity:1000001},{productId:'invalid'},{verticalValueId:'invalid'},{variantKey:''}])
    assert.throws(()=>validatePodShippingInput({...body,...delta}));
});
test('actual handler denies an unpublished product before loading any supplier credentials',async()=>{
  let handler:(req:Request)=>Promise<Response>;const tables:string[]=[],filters:any[]=[];
  const scope={validatePodShippingInput,boundedExplorerText,readSupabaseKey,checkRateLimit:()=>null,
    serve:(fn:typeof handler)=>{handler=fn;},Deno:{env:{get:(name:string)=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture'}[name])}},
    createClient:()=>({from:(table:string)=>{tables.push(table);assert.equal(table,'products');
      const query:any={select:()=>query,eq:(...args:any[])=>{filters.push(args);return query;},maybeSingle:async()=>({data:null})};return query;}}),
    fetch:()=>{throw new Error('Unexpected supplier request');}};
  const source=readFileSync(new URL('../pod-shipping-possibilities/index.ts',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
  new Function(...Object.keys(scope),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)(...Object.values(scope));
  const response=await handler!(new Request('https://fixture.test',{method:'POST',body:JSON.stringify(body)}));
  assert.equal(response.status,400);assert.deepEqual(tables,['products']);
  assert.ok(filters.some(([key,value])=>key==='is_published'&&value===true));
});
