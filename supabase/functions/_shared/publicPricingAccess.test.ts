import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const master='00000000-0000-0000-0000-000000000000';
const source=readFileSync(new URL('../pricing-read/index.ts',import.meta.url),'utf8');
const tree=ts.createSourceFile('pricing.ts',source,ts.ScriptTarget.Latest,true);
const node=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='fetchProduct')!;
const js=ts.transpileModule(node.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const fetchProduct=new Function('MASTER_TENANT_ID','isUuid',js+'; return fetchProduct;')(master,()=>false);

test('public pricing never resolves tenant, master or unrelated unpublished products',async()=>{
  for(const tenant_id of ['tenant',master,'unrelated']){
    const product={id:'product',slug:'proof',tenant_id,is_published:false};
    const client={from:()=>{
      const filters: Array<[string,unknown]>=[];
      const query:any={select:()=>query,eq:(key:string,value:unknown)=>{filters.push([key,value]);return query;},
        limit:async()=>({data:filters.every(([key,value])=>(product as any)[key]===value)?[product]:[],error:null})};return query;
    }};
    assert.equal((await fetchProduct(client,'tenant',{slug:'proof',productId:''})).product,null);
    product.is_published=true;
    assert.equal((await fetchProduct(client,'tenant',{slug:'proof',productId:''})).product.id,'product');
  }
});
