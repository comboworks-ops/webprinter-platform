import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFString, PDFDict, PDFArray } from 'pdf-lib';
import { ROLL_LABEL_SPECIAL_CUT_REQUIREMENTS as requirements } from './cutContourRequirements.ts';
import { inspectPdfCutContourProduction, registerCopiedCutContourLayers, hasOnlySourceCutLayers } from './pdfCutContourProductionInspection.ts';
import { inspectPdfCutContours } from './pdfCutContourInspection.ts';
import { validateProductionCutContour } from './validateProductionCutContour.ts';

type Options = { spot?:string; width?:number; tint?:number; alternate?:number[]; layer?:boolean; overprint?:boolean;
  hidden?:boolean; registered?:boolean; matrix?:string; formMatrix?:number[]; formBox?:number[]; pageSize?:number[]; unit?:number; program?:string; form?:boolean; split?:boolean; artworkInLayer?:boolean };
async function fixture(o:Options = {}) {
  const pdf = await PDFDocument.create(), page = pdf.addPage(o.pageSize as [number,number] || [100,100]);
  const layer = pdf.context.register(pdf.context.obj({Type:'OCG',Name:PDFString.of('Cutkontur'),Usage:{Print:{PrintState:o.hidden?'OFF':'ON'}}}));
  if(o.registered!==false) pdf.catalog.set(PDFName.of('OCProperties'),pdf.context.obj({OCGs:[layer],D:{BaseState:'ON',Order:[layer]}}));
  const resources = pdf.context.obj({ColorSpace:{CC:['Separation',o.spot||'Cutkontur','DeviceCMYK',
    {FunctionType:2,C0:[0,0,0,0],C1:o.alternate||[0,1,0,0],Domain:[0,1],N:1}]},
    ExtGState:{OP:{Type:'ExtGState',OP:o.overprint!==false}},Properties:{Cut:layer}});
  let program = o.program || `q ${o.matrix || ''} ${o.layer===false?'':'/OC /Cut BDC'} /OP gs /CC CS ${o.tint??1} SCN ${o.width??0.25} w 10 10 m 80 10 l 50 80 l h S ${o.artworkInLayer?'0 0 1 rg 20 20 10 10 re f':''} ${o.layer===false?'':'EMC'} Q`;
  if(o.form){ const ref = pdf.context.register(pdf.context.flateStream(program,{Type:'XObject',Subtype:'Form',BBox:o.formBox||[0,0,100,100],Resources:resources,Matrix:o.formMatrix||[1,0,0,1,0,0]}));
    resources.set(PDFName.of('XObject'),pdf.context.obj({F:ref})); program='/F Do'; }
  page.node.set(PDFName.of('Resources'),resources);
  if(o.unit)page.node.set(PDFName.of('UserUnit'),pdf.context.obj(o.unit));
  const parts = o.split ? [program.slice(0,program.indexOf('10 10 m')),program.slice(program.indexOf('10 10 m'))] : [program];
  for(const p of parts) page.node.addContentStream(pdf.context.register(pdf.context.flateStream(p)));
  return (await pdf.save()).slice().buffer as ArrayBuffer;
}
test('the four independent receipt014 counterexamples remain geometry-valid and fail the source production contract', async()=>{
  for(const o of [{width:1,layer:false,overprint:false},{spot:'CutContour',layer:false,overprint:false},
    {tint:0,layer:false,overprint:false},{alternate:[1,0,0,0],layer:false,overprint:false}]){
    const bytes=await fixture(o);
    assert.deepEqual(await inspectPdfCutContours(bytes,0),{paths:1,valid:true});
    assert.equal((await inspectPdfCutContourProduction(bytes,0,requirements)).valid,false);
    const canvas={getObjects:()=>[{data:{kind:'pdf_page_background',originalPdfBytes:bytes,pageIndex:0}}]} as unknown as Parameters<typeof validateProductionCutContour>[0];
    await assert.doesNotReject(validateProductionCutContour(canvas));
    await assert.rejects(validateProductionCutContour(canvas,null,requirements));
  }
});
test('exact production properties survive compressed streams, nested forms and page stream boundaries',async()=>{
  for(const o of [{},{form:true},{split:true}]) assert.deepEqual(await inspectPdfCutContourProduction(await fixture(o),0,requirements),{paths:1,valid:true,violations:[]});
});
test('each property is enforced independently, including a hidden or unregistered layer and mixed artwork',async()=>{
  const cases:[Options,string][]=[[{spot:'CutContour'},'spot_name'],[{width:1},'physical_width'],[{tint:0},'spot_tint'],
    [{alternate:[1,0,0,0]},'alternate_color'],[{layer:false},'separate_layer'],[{overprint:false},'stroke_overprint'],
    [{hidden:true},'separate_layer'],[{registered:false},'separate_layer'],[{artworkInLayer:true},'layer_contains_artwork']];
  for(const [o,violation] of cases){const result=await inspectPdfCutContourProduction(await fixture(o),0,requirements);assert.equal(result.valid,false,violation);assert.ok(result.violations.includes(violation),JSON.stringify(result));}
});
test('physical width uses accumulated page/form transforms and UserUnit, rejecting anisotropic pens',async()=>{
  // Scaled/rotated positive controls must be fully on-page, independently of
  // the pen-width check. The original 100pt page clipped those examples.
  for(const o of [{matrix:'2 0 0 2 0 0 cm',width:0.125,pageSize:[200,200]},
    {form:true,formMatrix:[0,2,-2,0,200,0],width:0.125,pageSize:[200,200]},{unit:2,width:0.125}]){
    assert.equal((await inspectPdfCutContourProduction(await fixture(o),0,requirements)).valid,true);
  }
  for(const o of [{matrix:'2 0 0 2 0 0 cm'},{form:true,formMatrix:[2,0,0,2,0,0]},{matrix:'2 0 0 1 0 0 cm',width:0.125}]){
    assert.ok((await inspectPdfCutContourProduction(await fixture(o),0,requirements)).violations.includes('physical_width'));
  }
});
test('copied form layers require registration; this does not repair hidden or mixed production layers',async()=>{
  for(const hidden of [false,true]){
    const source=await PDFDocument.load(await fixture({form:true,hidden})), output=await PDFDocument.create(), page=output.addPage([100,100]);
    const [form]=await output.embedPages([source.getPages()[0]]);page.drawPage(form);
    assert.equal((await inspectPdfCutContourProduction((await output.save()).slice().buffer as ArrayBuffer,0,requirements)).valid,false);
    registerCopiedCutContourLayers(output);
    assert.equal((await inspectPdfCutContourProduction((await output.save()).slice().buffer as ArrayBuffer,0,requirements)).valid,!hidden);
  }
});
test('malformed, open, multiple and unsupported contours never receive production acceptance',async()=>{
  for(const program of ['q /OC /Cut BDC /CC CS 1 SCN 0.25 w /OP gs 10 10 m 80 10 l 50 80 l S EMC Q',
    'q /OC /Cut BDC /CC CS 1 SCN 0.25 w /OP gs 10 10 20 20 re 40 40 20 20 re S EMC Q',
    'q /OC /Missing BDC /CC CS 1 SCN 0.25 w /OP gs 10 10 20 20 re S EMC Q','BI /W 1 /H 1 ID x EI']){
    const result=await inspectPdfCutContourProduction(await fixture({program}),0,requirements);
    assert.ok(!result.valid||result.paths!==1);
  }
  await assert.rejects(inspectPdfCutContourProduction(await fixture(),0,{...requirements,spotName:'CutContour'} as unknown as typeof requirements));
});
test('clamped alternate color, invisible stroke and automatic layer configurations cannot bypass the production check',async()=>{
 for(const change of ['range','alpha','automatic']){
  const pdf=await PDFDocument.load(await fixture()),resources=pdf.getPage(0).node.Resources()!;
  if(change==='range'){
   const space=resources.lookup(PDFName.of('ColorSpace'), PDFDict);
   space.lookup(PDFName.of('CC'), PDFArray).lookup(3, PDFDict).set(PDFName.of('Range'),pdf.context.obj([0,0,0,0,0,0,0,0]));
  } else if(change==='alpha'){
   resources.lookup(PDFName.of('ExtGState'), PDFDict).lookup(PDFName.of('OP'), PDFDict).set(PDFName.of('CA'),pdf.context.obj(0));
  } else pdf.catalog.lookup(PDFName.of('OCProperties'), PDFDict).lookup(PDFName.of('D'), PDFDict).set(PDFName.of('AS'),pdf.context.obj([]));
  assert.equal((await inspectPdfCutContourProduction((await pdf.save()).slice().buffer as ArrayBuffer,0,requirements)).valid,false);
 }
});
test('the production layer import exception never authorizes unrelated, hidden or configured optional layers',async()=>{
 const pdf=await PDFDocument.load(await fixture());assert.equal(hasOnlySourceCutLayers(pdf,requirements),true);
 const oc=pdf.catalog.lookup(PDFName.of('OCProperties'), PDFDict);
 const layer=oc.lookup(PDFName.of('OCGs'), PDFArray).lookup(0, PDFDict);
 layer.set(PDFName.of('Name'),PDFString.of('Artwork'));
 assert.equal(hasOnlySourceCutLayers(pdf,requirements),false);
 assert.equal(hasOnlySourceCutLayers(await PDFDocument.load(await fixture({hidden:true})),requirements),false);
});

test('receipt018 fully clipped contour is rejected while its visible positive remains accepted', async()=>{
 for (const [id, valid] of [['opaque_positive',true],['fully_clipped_cut',false]] as const) {
  const bytes = Uint8Array.from(await readFile(`output/qa/roll-labels-2026-10-06/contour-visibility-${id}-018.pdf`)).buffer;
  const result = await inspectPdfCutContourProduction(bytes,0,requirements);
  assert.equal(result.valid, valid, id);
 }
});

test('receipt022 post-path translation is rejected without changing generic geometry validation', async()=>{
 for (const [id, valid] of [['visible_control',true],['postpath_translation',false]] as const) {
  const bytes=Uint8Array.from(await readFile(`output/qa/roll-labels-2026-10-06/contour-physical-${id}-022.pdf`)).buffer;
  assert.deepEqual(await inspectPdfCutContours(bytes,0),{paths:1,valid:true});
  const result=await inspectPdfCutContourProduction(bytes,0,requirements);
  assert.equal(result.valid,valid,id);
  const canvas={getObjects:()=>[{data:{kind:'pdf_page_background',originalPdfBytes:bytes,pageIndex:0}}]} as unknown as Parameters<typeof validateProductionCutContour>[0];
  await assert.doesNotReject(validateProductionCutContour(canvas));
  if (!valid) {
   assert.ok(result.violations.includes('contour_path_transform'));
   await assert.rejects(validateProductionCutContour(canvas,null,requirements));
  }
 }
});

test('unfinished contour transform changes fail across q/Q, forms and split streams; completed artwork remains scoped',async()=>{
 const prefix='q /OC /Cut BDC /OP gs /CC CS 1 SCN 0.25 w';
 const path='10 10 m 80 10 l 50 80 l h';
 const suffix='S EMC Q';
 for(const mutation of ['1 0 0 1 -200 -200 cm', '1 0 0 1 0.00000001 0 cm', 'q 1 0 0 1 -200 -200 cm Q',
  '2 0 0 2 0 0 cm 0.5 0 0 0.5 0 0 cm']) {
  for(const wrapper of [{},{form:true},{split:true}]) {
   const result=await inspectPdfCutContourProduction(await fixture({...wrapper,program:`${prefix} ${path} ${mutation} ${suffix}`}),0,requirements);
   assert.ok(result.violations.includes('contour_path_transform'),mutation);
  }
 }
 assert.ok((await inspectPdfCutContourProduction(await fixture({program:`${prefix} 10 10 m 1 0 0 1 20 0 cm 80 10 l 50 80 l h ${suffix}`}),0,requirements)).violations.includes('contour_path_transform'));
 // Restoring a changed CTM through Q while the path survives must also block.
 assert.ok((await inspectPdfCutContourProduction(await fixture({program:`${prefix} q 1 0 0 1 1 1 cm ${path} Q ${suffix}`}),0,requirements)).violations.includes('contour_path_transform'));
 for(const program of [`q 1 0 0 1 -200 -200 cm 0 0 1 1 re f Q ${prefix} ${path} ${suffix}`,
  `${prefix} ${path} 1 0 0 1 0 0 cm ${suffix}`,`${prefix} ${path} q Q ${suffix}`]) {
  assert.equal((await inspectPdfCutContourProduction(await fixture({program}),0,requirements)).valid,true);
 }
 // An unproved clipping path cannot become a false enclosing clip after paint.
 const clip='q 0 0 100 100 re 1 0 0 1 -200 -200 cm W n 1 0 0 1 200 200 cm';
 assert.ok((await inspectPdfCutContourProduction(await fixture({program:`${clip} ${prefix} ${path} ${suffix} Q`}),0,requirements)).violations.includes('contour_clipping'));
});

const cut = '/OC /Cut BDC /OP gs /CC CS 1 SCN 0.25 w 10 10 m 80 10 l 50 80 l h S EMC';
test('only clips proved to contain the full stroke can accept a required contour',async()=>{
 for (const rule of ['W','W*']) {
  for (const clip of ['0 0 1 1 re','0 0 50 100 re','10 10 70 70 re']) {
   const result=await inspectPdfCutContourProduction(await fixture({program:`q ${clip} ${rule} n ${cut} Q`}),0,requirements);
   assert.ok(result.violations.includes('contour_clipping'), clip);
  }
  assert.equal((await inspectPdfCutContourProduction(await fixture({program:`q 0 0 100 100 re ${rule} n ${cut} Q`}),0,requirements)).valid,true);
 }
 const unsupported = '0 0 m 100 0 l 100 100 l 0 100 l h W n';
 assert.ok((await inspectPdfCutContourProduction(await fixture({program:`q ${unsupported} ${cut} Q`}),0,requirements)).violations.includes('contour_clipping'));
});
test('artwork clips remain scoped by q/Q and cannot leak from forms or be undone by a larger clip',async()=>{
 for (const clip of ['0 0 1 1 re W n','0 0 m 1 0 l 1 1 l h W n']) {
  const bytes=await fixture({program:`q ${clip} 1 0 0 rg 0 0 100 100 re f Q q ${cut} Q`});
  assert.equal((await inspectPdfCutContourProduction(bytes,0,requirements)).valid,true);
 }
 assert.equal((await inspectPdfCutContourProduction(await fixture({program:`q 0 0 1 1 re W n 0 0 100 100 re W n ${cut} Q`}),0,requirements)).valid,false);
 const pdf=await PDFDocument.load(await fixture({form:true,program:'q 0 0 1 1 re W n 1 0 0 rg 0 0 100 100 re f Q'}));
 pdf.getPage(0).node.addContentStream(pdf.context.register(pdf.context.flateStream(`q ${cut} Q`)));
 assert.equal((await inspectPdfCutContourProduction((await pdf.save()).slice().buffer as ArrayBuffer,0,requirements)).valid,true);
});
test('page CropBox and implicit transformed form BBox clips retain full contour fidelity',async()=>{
 for (const formBox of [[0,0,1,1],[0,0,50,100],[10,10,80,80]]) {
  const result=await inspectPdfCutContourProduction(await fixture({form:true,formBox}),0,requirements);
  assert.ok(result.violations.includes('contour_clipping'));
 }
 assert.equal((await inspectPdfCutContourProduction(await fixture({form:true,formMatrix:[-1,0,0,1,100,0]}),0,requirements)).valid,true);
 const pdf=await PDFDocument.load(await fixture());pdf.getPage(0).setCropBox(0,0,50,100);
 assert.ok((await inspectPdfCutContourProduction((await pdf.save()).slice().buffer as ArrayBuffer,0,requirements)).violations.includes('contour_clipping'));
});
test('path coordinates and clips are frozen under the CTM at construction time',async()=>{
 for (const matrix of ['2 0 0 2 0 0 cm','1 0 0 1 80 0 cm']) {
  const bytes=await fixture({program:`q ${matrix} 0 0 1 1 re W n Q q ${cut} Q`});
  assert.equal((await inspectPdfCutContourProduction(bytes,0,requirements)).valid,true);
 }
 // A transformed enclosing clip remains enclosing after the CTM changes back.
 assert.equal((await inspectPdfCutContourProduction(await fixture({program:`q 2 0 0 2 0 0 cm 0 0 50 50 re W n 0.5 0 0 0.5 0 0 cm ${cut} Q`}),0,requirements)).valid,true);
 const escaped='q /OC /Cut BDC /OP gs /CC CS 1 SCN 0.25 w 10 10 m 20 100 90 100 80 10 c h S EMC Q';
 assert.ok((await inspectPdfCutContourProduction(await fixture({program:`q 0 0 100 90 re W n ${escaped} Q`}),0,requirements)).violations.includes('contour_clipping'));
});
test('text clipping is conservative when it affects a required contour, but scoped artwork text is allowed',async()=>{
 const text='BT 7 Tr (clip) Tj ET';
 assert.equal((await inspectPdfCutContourProduction(await fixture({program:`q ${text} ${cut} Q`}),0,requirements)).valid,false);
 assert.equal((await inspectPdfCutContourProduction(await fixture({program:`q ${text} Q q ${cut} Q`}),0,requirements)).valid,true);
});
