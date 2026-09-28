import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {safePdfDocumentOptions} from './pdfDocumentOptions.ts';

test('untrusted rendering options cannot enable PDF font code evaluation',()=>{
  const data=new Uint8Array([37,80,68,70]);
  const result=safePdfDocumentOptions({data,isEvalSupported:true,disableFontFace:true});
  assert.equal(result.isEvalSupported,false);
  assert.equal(result.data,data);
  assert.equal(result.disableFontFace,true);
});

test('every application PDF.js loader enforces the safe options boundary',()=>{
  const loaderFiles = new Set<string>();
  for(const entry of fs.readdirSync('src',{recursive:true}).map(String).filter(p=>/\.[jt]sx?$/.test(p)&&!p.includes('backup-')&&!p.endsWith('.test.ts'))){
    const file=ts.createSourceFile(entry,fs.readFileSync('src/'+entry,'utf8'),ts.ScriptTarget.Latest,true);
    const visit=(node:ts.Node)=>{
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='getDocument'){
        loaderFiles.add(entry);const arg=node.arguments[0];
        assert.ok(arg&&ts.isCallExpression(arg)&&ts.isIdentifier(arg.expression)&&arg.expression.text==='safePdfDocumentOptions',entry+' bypasses the PDF security boundary');
      }
      ts.forEachChild(node,visit);
    };visit(file);
  }
  assert.deepEqual([...loaderFiles].sort(), [
    'components/admin/MachineCostWorkbench.tsx',
    'components/designer/PDFImportModal.tsx',
    'lib/localPdf.ts',
    'pages/Designer.tsx',
    'pages/FileUploadConfiguration.tsx',
  ].sort(), 'must inspect each current PDF entry point, including the shared local loader');
});
