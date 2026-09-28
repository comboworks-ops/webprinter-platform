import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareProductLayoutSave, saveProductLayout } from './productLayoutSave.ts';
import { placeWorkspaceGroup, prepareWorkspaceSave, readWorkspaceDraft, workspaceGroups, workspaceRows } from './productWorkspace.ts';
const fixture = () => ({mode:'matrix_layout_v1',version:1,vertical_axis:{sectionId:'paper',sectionType:'materials',groupId:'paper',valueIds:['silk']},layout_rows:[{id:'first',columns:[{id:'format',title:'Format',sectionType:'formats',groupId:'format',valueIds:['a4']}]},{id:'second',columns:[{id:'finish',title:'Efterbehandling',sectionType:'finishes',groupId:'finish',valueIds:['mat'],focusSelectedValue:true}]}],quantities:[100,500],markup:15,supplier:{id:'original'}});
test('join and split sections survives draft reload and apply without touching price identity',()=>{
 const original=fixture();const snapshot=structuredClone(original);
 const joined=placeWorkspaceGroup(original,'finish','format');
 assert.equal(workspaceRows(workspaceGroups(joined)).at(-1)?.length,2);
 const saved=prepareWorkspaceSave(original,original,joined,false);
 assert.deepEqual(readWorkspaceDraft(saved).structure,joined);
 const applied=prepareWorkspaceSave(saved,saved,joined,true);
 assert.deepEqual(applied.layout_rows,original.layout_rows);assert.deepEqual(applied.supplier,original.supplier);assert.deepEqual(original,snapshot);
 assert.equal(workspaceRows(workspaceGroups(placeWorkspaceGroup(applied,'finish'))).at(-1)?.length,1);
});
test('matrix row cannot join a selector row and row capacity is three',()=>{
 const original=fixture();assert.throws(()=>placeWorkspaceGroup(original,'paper','format'),/Matrixrækken/);
 const expanded={...original,workspaceGroups:[...workspaceGroups(original),{id:'extra',title:'Ekstra',options:[]},{id:'fourth',title:'Fjerde',options:[]}]};
 const joined=placeWorkspaceGroup(placeWorkspaceGroup(expanded,'finish','format'),'extra','format');
 assert.throws(()=>placeWorkspaceGroup(joined,'fourth','format'),/højst være tre/);
});
test('layout-only save preserves quantities, prices, markups, metadata and existing presentation rows',()=>{
 const original=placeWorkspaceGroup(fixture(),'finish','format');
 const candidate=structuredClone(original);candidate.layout_rows.reverse();candidate.layout_rows[0].columns[0].title='Overflade';candidate.quantities=[1];candidate.markup=900;candidate.supplier=null;
 const result=prepareProductLayoutSave(original,original,candidate);
 assert.deepEqual(result.quantities,original.quantities);assert.equal(result.markup,15);assert.deepEqual(result.supplier,original.supplier);
 assert.equal(result.workspaceGroups.find(g=>g.id==='finish').rowId,original.workspaceGroups.find(g=>g.id==='finish').rowId);
});
test('layout-only save rejects stale editors and removing price identities',()=>{
 const original=fixture();assert.throws(()=>prepareProductLayoutSave({...original,markup:20},original,original),/ændret/);
 const deleted=structuredClone(original);deleted.layout_rows.pop();assert.throws(()=>prepareProductLayoutSave(original,original,deleted),/prisvalg/);
 const draft={...original,workspaceDraft:{version:1}};assert.throws(()=>prepareProductLayoutSave(draft,draft,original),/kladde/);
});
test('new product can save its source structure without manufacturing prices',()=>{
 const result=prepareProductLayoutSave(null,null,fixture());assert.equal(result.mode,'matrix_layout_v1');assert.equal(result.quantities,undefined);assert.equal(result.markup,undefined);assert.equal(result.supplier,undefined);
});

function clientFixture(accept = true) {
 const calls: unknown[][] = [];
 const client={from(table: string){calls.push(['from',table]);let write=false;const q={select(...args: unknown[]){calls.push(['select',...args]);return q;},eq(...args: unknown[]){calls.push(['eq',...args]);return q;},update(value: unknown){write=true;calls.push(['update',value]);return q;},async single(){return {data:{pricing_structure:fixture(),updated_at:'version-1'},error:null};},async maybeSingle(){return {data:accept&&write?{id:'product-1'}:null,error:null};}};return q;}};
 return {client: client as unknown as Parameters<typeof saveProductLayout>[0],calls};
}
test('layout save scopes both queries and writes only product presentation',async()=>{
 const {client,calls}=clientFixture();await saveProductLayout(client,'tenant-1','product-1',fixture(),fixture());
 assert.deepEqual(calls.filter(c=>c[0]==='from'),[['from','products'],['from','products']]);
 assert.equal(calls.filter(c=>c[0]==='eq'&&c[1]==='tenant_id'&&c[2]==='tenant-1').length,2);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='version-1'));
 assert.deepEqual(Object.keys(calls.find(c=>c[0]==='update')![1] as object),['pricing_structure']);
});
test('a concurrent save is rejected instead of claiming success',async()=>{
 const {client}=clientFixture(false);await assert.rejects(saveProductLayout(client,'tenant-1','product-1',fixture(),fixture()),/samtidig/);
});
