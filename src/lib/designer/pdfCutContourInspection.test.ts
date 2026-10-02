import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { inspectPdfCutContours } from './pdfCutContourInspection.ts';
async function example(program: string, form = false) {
 const pdf = await PDFDocument.create(), page = pdf.addPage([100,100]);
 const spaces = pdf.context.obj({ CC: ['Separation','CutContour','DeviceCMYK', { FunctionType: 2, C0: [0,0,0,0], C1: [0,1,0,0], Domain: [0,1], N: 1 }] });
 page.node.Resources()!.set(PDFName.of('ColorSpace'), spaces);
 if(form){const stream=pdf.context.flateStream(program,{Type:'XObject',Subtype:'Form',BBox:[0,0,100,100],Resources:{ColorSpace:spaces}});const ref=pdf.context.register(stream);page.node.Resources()!.set(PDFName.of('XObject'),pdf.context.obj({F:ref}));program='/F Do';}
 const ref=pdf.context.register(pdf.context.flateStream(program));page.node.addContentStream(ref);
 const bytes=await pdf.save();return bytes.slice().buffer as ArrayBuffer;
}
const cut='/CC CS 1 SCN 0 0 m 50 0 l 20 50 l h S';
test('compressed resources and nested forms retain a single closed spot path',async()=>{
 for(const form of [false,true]) assert.deepEqual(await inspectPdfCutContours(await example(cut,form),0),{paths:1,valid:true});
});
test('spot name without a real path, open paths, multiple and disconnected paths cannot pass',async()=>{
 assert.deepEqual(await inspectPdfCutContours(await example(''),0),{paths:0,valid:true});
 assert.deepEqual(await inspectPdfCutContours(await example('/CC CS 1 SCN 0 0 m 50 0 l 20 50 l S'),0),{paths:1,valid:false});
 assert.deepEqual(await inspectPdfCutContours(await example(cut+' '+cut),0),{paths:2,valid:true});
 assert.deepEqual(await inspectPdfCutContours(await example('/CC CS 1 SCN 0 0 m 50 0 l 20 50 l h 70 70 m 80 70 l 80 90 l h S'),0),{paths:2,valid:false});
});
test('ordinary PDF text and unused spot dictionaries are not cutting geometry',async()=>{
 const result=await inspectPdfCutContours(await example('BT (fake 0 0 m 50 0 l h S /CC CS) Tj ET % /CC CS 1 SCN\n0 0 0 RG 0 0 m 50 0 l 20 50 l h S'),0);
 assert.deepEqual(result,{paths:0,valid:true});
});
