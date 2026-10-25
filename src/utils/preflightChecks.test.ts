import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('./preflightChecks.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} as Record<string, unknown> };
vm.runInNewContext(source, { exports: module.exports, require: (name: string) => {
  assert.equal(name, 'fabric');
  return {fabric:{util:{qrDecompose:(m: number[])=>({scaleX:m[0],scaleY:m[3]})}}};
}, Math });
interface Warning { code: string; canIgnore: boolean; details: string }
const check = module.exports.runPreflightChecks as (canvas: { getObjects: () => unknown[] }, options: Record<string, number>) => { errors: Warning[]; warnings: Warning[] };
const image = (dpi: number, outside = false) => ({
  type:'image',width:100,height:100,__layerId:'image',
  getElement:()=>({naturalWidth:100,naturalHeight:100}),
  calcTransformMatrix:()=>[25.4/dpi,0,0,25.4/dpi,0,0],
  getBoundingRect:()=>({left:outside?95:120,top:120,width:100*25.4/dpi,height:100*25.4/dpi}),
});
const options = {documentWidth:210,documentHeight:297,bleed:3,safeArea:3,minDPI:300,targetDPI:300,optimalDPI:300,mmToPx:1};
test('even very low image resolution is an explicit overridable warning, never an export error', () => {
  for(const dpi of [20,75,149,299]) {
    const result=check({getObjects:()=>[image(dpi)]},options);
    assert.equal(result.errors.length,0);
    const warning=result.warnings.find(w=>w.code==='LOW_RESOLUTION');
    assert.ok(warning);assert.equal(warning.canIgnore,true);assert.match(warning.details,/eget ansvar/);
  }
});
test('the recommendation supplied for each product controls the resolution warning',()=>{
  for(const target of [100,150,300]) {
    assert.equal(check({getObjects:()=>[image(target)]},{...options,targetDPI:target}).warnings.some(w=>w.code==='LOW_RESOLUTION'),false);
    assert.equal(check({getObjects:()=>[image(target-1)]},{...options,targetDPI:target}).warnings.some(w=>w.code==='LOW_RESOLUTION'),true);
  }
});
test('artwork crossing bleed remains an overridable cropping warning and cut contours are not treated as artwork',()=>{
  const result=check({getObjects:()=>[image(300,true),{...image(300,true),__isCutContour:true}]},options);
  assert.equal(result.errors.length,0);
  const crop=result.warnings.filter(w=>w.code==='OUTSIDE_BLEED');
  assert.equal(crop.length,1);assert.equal(crop[0].canIgnore,true);assert.match(crop[0].details,/CutContour/);
});
