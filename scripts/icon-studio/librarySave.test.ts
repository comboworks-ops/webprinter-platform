import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { saveStudioOutputToLibrary, validateLibraryOutput, type LibrarySaveStore, type SavedLibraryRow } from '../../supabase/functions/_shared/iconStudioLibrarySave.ts';
import { productLibraryConstruction } from '../../supabase/functions/_shared/iconStudioProductLibrary.ts';
import { ICON_STUDIO_PRODUCT_KEYS } from '../../supabase/functions/_shared/iconStudioCatalog.ts';

const tenant='00000000-0000-0000-0000-000000000000', actor='11111111-1111-4111-8111-111111111111';
const jobId='22222222-2222-4222-8222-222222222222', outputId='33333333-3333-4333-8333-333333333333', refId='44444444-4444-4444-8444-444444444444';
const recipe={version:1,styleId:'outline',treatmentId:'none',viewId:'left',palette:['#087fc5','#eff6fc'],anchorOutputId:null,libraryReferenceId:refId};
const payload={tenantId:tenant,productKey:'leaflet',styleKey:'outline_technical',variantKey:'angled_front',recipe,brandOverlay:{enabled:false,assetId:null,placementPreset:null,finishKey:'flat'},references:{referenceAssetIds:[refId],maxAssets:5},output:{background:'transparent',format:'png',size:1024},sampleCount:1};
const job={id:jobId,tenant_id:tenant,status:'ready_for_review',provider_key:'openai-image-v1',payload};
const output={id:outputId,tenant_id:tenant,job_id:jobId,status:'active',storage_path:`tenant/${tenant}/jobs/${jobId}/${outputId}.png`,mime_type:'image/png',width_px:1024,height_px:1024};
const reference={id:refId,tenant_id:tenant,product_key:'leaflet',storage_path:`tenant/${tenant}/references/folder.png`,mime_type:'image/png',metadata:{productImageLibrary:true,formatKey:'a5',formatLabel:'A5 · 148 × 210 mm',orientationKey:'landscape',foldKey:'zigzagfalset',widthMm:148,heightMm:210,referenceReview:{rights:'owned',reviewed:true}}};
function png() {
  const chunk=(name:string,body:Buffer)=>{const bytes=Buffer.concat([Buffer.from(name),body]);let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}const result=Buffer.alloc(bytes.length+8);result.writeUInt32BE(body.length);bytes.copy(result,4);result.writeUInt32BE((crc^0xffffffff)>>>0,result.length-4);return result;};
  const header=Buffer.alloc(13);header.writeUInt32BE(1024,0);header.writeUInt32BE(1024,4);header[8]=8;header[9]=6;
  return new Blob([Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(1024*(1+1024*4)))),chunk('IEND',Buffer.alloc(0))])],{type:'image/png'});
}
function memoryStore() {
  const files=new Map<string,Blob>([[output.storage_path,png()]]),saved=new Map<string,SavedLibraryRow>();
  const reads:string[]=[];let uploads=0,inserts=0;
  const state={job:structuredClone(job),output:structuredClone(output),failInsert:false,failUpload:false};
  const store:LibrarySaveStore={
    getOutput:async(id,t)=>{reads.push(t);return id===state.output.id&&t===state.output.tenant_id?state.output:null;},
    getJob:async(id,t)=>{reads.push(t);return id===state.job.id&&t===state.job.tenant_id?state.job:null;},
    getReference:async(id,t)=>{reads.push(t);return t===tenant?(saved.get(id)||(id===refId?reference:null)):null;},
    getSaved:async(id,t)=>{reads.push(t);return t===tenant?saved.get(id)||null:null;},
    download:async path=>files.get(path)||null,
    uploadNew:async(path,file)=>{uploads++;if(files.has(path)||state.failUpload)return false;files.set(path,file);return true;},
    insertNew:async row=>{inserts++;if(saved.has(row.id)||state.failInsert)return false;saved.set(row.id,structuredClone(row));return true;},
  };
  return {store,files,saved,reads,state,counts:()=>({uploads,inserts})};
}
test('copies actual output privately and preserves original, fold, dimensions and provenance',async()=>{
  const m=memoryStore(),original=m.files.get(output.storage_path)!;
  const result=await saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name:'A5 Zigzag · blå kontur'});
  assert.deepEqual(result,{assetId:outputId,alreadySaved:false});
  const row=m.saved.get(outputId)!;assert.equal(row.is_active,false);assert.equal(row.created_by,actor);
  assert.equal(row.metadata.widthMm,148);assert.equal(row.metadata.heightMm,210);assert.equal(row.metadata.foldKey,'zigzagfalset');
  assert.equal((row.metadata.generatedFrom as Record<string,unknown>).rootReferenceId,refId);
  assert.match(productLibraryConstruction(row,tenant,'leaflet'),/210 × 148 mm/);
  assert.deepEqual(await m.files.get(row.storage_path)!.arrayBuffer(),await original.arrayBuffer());
  assert.equal(m.files.get(output.storage_path),original);assert.equal(m.state.job.status,'ready_for_review');
  assert.ok(m.reads.every(t=>t===tenant));
});
test('repeated and concurrent saves create one entry and never rename or overwrite it',async()=>{
  const m=memoryStore();const input={outputId,name:'Første navn'};
  await Promise.all([saveStudioOutputToLibrary(m.store,tenant,actor,input),saveStudioOutputToLibrary(m.store,tenant,actor,input)]);
  assert.equal(m.saved.size,1);assert.equal(m.files.size,2);
  const before=m.counts();assert.equal((await saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name:'Andet navn'})).alreadySaved,true);
  assert.equal(m.saved.get(outputId)!.name,'Første navn');assert.deepEqual(m.counts(),before);
});
test('a second saved generation keeps its immediate parent and original geometry without a recursive lookup',async()=>{
  const m=memoryStore();await saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name:'Første'});
  const nextId='55555555-5555-4555-8555-555555555555';
  m.state.output={...m.state.output,id:nextId,storage_path:`tenant/${tenant}/jobs/${jobId}/${nextId}.png`};
  m.files.set(m.state.output.storage_path,png());m.state.job.payload.recipe.libraryReferenceId=outputId;
  m.state.job.payload.references.referenceAssetIds=[outputId];
  await saveStudioOutputToLibrary(m.store,tenant,actor,{outputId:nextId,name:'Anden'});
  const row=m.saved.get(nextId)!;const origin=row.metadata.generatedFrom as Record<string,unknown>;
  assert.equal(origin.referenceId,outputId);assert.equal(origin.rootReferenceId,refId);
  assert.match(productLibraryConstruction(row,tenant,'leaflet'),/accordion Z fold/);
});
test('all product categories can use a saved generic generation as an explicit reference',async()=>{
  const m=memoryStore();m.state.job.payload.recipe.libraryReferenceId=undefined as unknown as string;
  m.state.job.payload.references.referenceAssetIds=[];
  await saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name:'Generisk'});
  const row=m.saved.get(outputId)!;
  for(const key of ICON_STUDIO_PRODUCT_KEYS) assert.ok(productLibraryConstruction({...row,product_key:key},tenant,key).includes(key));
  assert.throws(()=>productLibraryConstruction({...row,product_key:'unknown'},tenant,'unknown'));
  assert.throws(()=>productLibraryConstruction(row,actor,'leaflet'));
});
test('denies foreign tenant, in-progress/mock/deleted outputs and substituted file paths before writes',async()=>{
  const m=memoryStore();await assert.rejects(()=>saveStudioOutputToLibrary(m.store,actor,actor,{outputId,name:'Forkert shop'}));
  for(const changed of [{tenant_id:actor},{status:'deleted'},{storage_path:'https://example.com/a.png'},{storage_path:`tenant/${actor}/jobs/${jobId}/${outputId}.png`},{mime_type:'image/jpeg'},{width_px:1},{job_id:actor}]) assert.throws(()=>validateLibraryOutput({...output,...changed},job,tenant));
  for(const changed of [{tenant_id:actor},{status:'processing'},{provider_key:'mock-icon-studio-v1'}]) assert.throws(()=>validateLibraryOutput(output,{...job,...changed},tenant));
  for(const name of ['', 'x'.repeat(121), 'bad\nname']) await assert.rejects(()=>saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name}));
  assert.equal(m.saved.size,0);assert.equal(m.files.size,1);
});
test('failure and retry preserve originals and reuse a matching private copy',async()=>{
  const m=memoryStore();m.state.failInsert=true;
  await assert.rejects(()=>saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name:'Bevar'}));
  assert.equal(m.files.size,2);assert.equal(m.saved.size,0);
  m.state.failInsert=false;await saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name:'Bevar'});
  assert.equal(m.files.size,2);assert.equal(m.saved.size,1);
  const u=memoryStore();u.state.failUpload=true;await assert.rejects(()=>saveStudioOutputToLibrary(u.store,tenant,actor,{outputId,name:'Bevar'}));assert.equal(u.saved.size,0);assert.equal(u.files.size,1);
});
test('malformed/missing source image and copy collisions fail without overwriting',async()=>{
  const m=memoryStore();m.files.set(output.storage_path,new Blob(['invalid png']));
  await assert.rejects(()=>saveStudioOutputToLibrary(m.store,tenant,actor,{outputId,name:'Ikke PNG'}));assert.equal(m.saved.size,0);
  const c=memoryStore();const path=`tenant/${tenant}/references/generated/${outputId}.png`;const other=new Blob(['different']);c.files.set(path,other);
  await assert.rejects(()=>saveStudioOutputToLibrary(c.store,tenant,actor,{outputId,name:'Kollision'}));assert.equal(c.files.get(path),other);assert.equal(c.saved.size,0);
});
