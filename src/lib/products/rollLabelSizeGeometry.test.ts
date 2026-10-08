import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib';
import type { RollLabelReviewProfile } from './rollLabelReview';
import { readRollLabelSizeGeometry, rollLabelSizeGuide } from './rollLabelSizeGeometry';
import { generateRollLabelSizeTemplate } from '../designer/generateRollLabelSizeTemplate';

const base = 'output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families';
const profiles:RollLabelReviewProfile[] = fs.readdirSync(base).flatMap(file=>JSON.parse(fs.readFileSync(`${base}/${file}`,'utf8')).profiles);
const documented = profiles.filter(p=>readRollLabelSizeGeometry(p));

test('all 547 exact primitive contracts retain bounds, physical offsets and foreign/malformed rejection',()=>{
  assert.equal(documented.length,547);
  for (const p of documented) {
    const rule = p.sizeGeometry!;
    const axis = p.sizeContract!.axes;
    for (const size of [axis.map(a=>a.minMm),axis.map(a=>Math.min(a.maxMm,50)),axis.map(a=>a.maxMm)]) {
      const w = size[0], h = p.sizeContract!.heightFromWidth?w:size[1];
      const guide=rollLabelSizeGuide(p,w,h);
      assert.ok(guide,p.key); assert.equal(guide.dataWidthMm,w+2*rule.bleedMm);
      assert.equal(guide.bleedMm,rule.bleedMm); assert.equal(guide.safeAreaMm,rule.safeMm);
      assert.equal(guide.vectorGuide!.templateSha256,null);
      assert.equal(guide.vectorGuide!.geometryContractSha256,rule.sha256);
      assert.equal(guide.vectorGuide!.pages[0].paths.length,3);
    }
    assert.equal(rollLabelSizeGuide(p,axis[0].minMm-0.1,50),null);
    assert.equal(rollLabelSizeGuide(p,axis[0].maxMm+0.1,50),null);
    assert.equal(readRollLabelSizeGeometry({...p,key:'foreign'}),null);
    assert.equal(readRollLabelSizeGeometry({...p,sizeGeometry:{...rule,evidence:[]}}),null);
  }
  assert.equal(rollLabelSizeGuide(documented[0],NaN,50),null);
  const circle = documented.find(p=>p.format.shape==='circle')!;
  assert.equal(rollLabelSizeGuide(circle,50,51),null);
  assert.ok(profiles.filter(p=>p.format.shape==='oval').every(p=>readRollLabelSizeGeometry(p)===null));
});

test('generated PDF has exact boxes, deterministic bytes, vector helpers and non-printing OCG usage',async()=>{
  for (const shape of ['rectangle','circle']) {
    const p = documented.find(p=>p.format.shape===shape)!;
    const w=shape==='circle'?50:37.125,h=shape==='circle'?50:61.375;
    const result = await generateRollLabelSizeTemplate(p,w,h);
    assert.deepEqual(result.bytes,(await generateRollLabelSizeTemplate(p,w,h)).bytes);
    const doc=await PDFDocument.load(result.bytes),page=doc.getPage(0),pt=72/25.4;
    assert.ok(Math.abs(page.getWidth()/pt-w-2*p.sizeGeometry!.bleedMm)<1e-8);
    assert.ok(Math.abs(page.getHeight()/pt-h-2*p.sizeGeometry!.bleedMm)<1e-8);
    assert.ok(Math.abs(page.getTrimBox().width/pt-w)<1e-8);
    assert.equal(page.getTrimBox().x/pt,p.sizeGeometry!.bleedMm);
    const groups=doc.catalog.lookup(PDFName.of('OCProperties'),PDFDict).lookup(PDFName.of('OCGs'),PDFArray);
    assert.equal(groups.size(),2);
    for(let i=0;i<groups.size();i++) {
      const usage=groups.lookup(i,PDFDict).lookup(PDFName.of('Usage'),PDFDict);
      for(const kind of ['Print','Export']) assert.equal(usage.lookup(PDFName.of(kind),PDFDict).get(PDFName.of(kind+'State'))?.toString(),'/OFF');
    }
    const panel=result.legend.panelPt;
    for(const line of result.legend.textBounds) {
      assert.ok(line.bboxPt[0]>=panel[0]+result.legend.paddingPt);
      assert.ok(line.bboxPt[2]<=panel[2]-result.legend.paddingPt+0.001);
      assert.ok(line.bboxPt[1]>=panel[1]+result.legend.paddingPt);
    }
  }
});

test('all documented minimum sizes retain readable legend bands without obscuring cut or safety geometry',async()=>{
  for(const p of documented) {
    const w=p.sizeContract!.axes[0].minMm,h=p.sizeContract!.heightFromWidth?w:p.sizeContract!.axes[1].minMm;
    const result=await generateRollLabelSizeTemplate(p,w,h),pt=72/25.4,b=p.sizeGeometry!.bleedMm*pt;
    assert.ok(result.legend.fontPt>=5,p.key);
    if('panelsPt' in result.legend) {
      for(const panel of result.legend.panelsPt!) {
        assert.ok(panel[0]>=0&&panel[2]<=(w+2*p.sizeGeometry!.bleedMm)*pt);
        assert.ok(panel[1]>=0&&panel[3]<=(h+2*p.sizeGeometry!.bleedMm)*pt);
        assert.ok(panel[3]<b || panel[1]>(h+p.sizeGeometry!.bleedMm)*pt);
      }
      for(const line of result.legend.textBounds) {
        assert.ok(result.legend.panelsPt!.some(panel=>line.bboxPt[0]>=panel[0]+result.legend.paddingPt
          &&line.bboxPt[2]<=panel[2]-result.legend.paddingPt+0.001&&line.bboxPt[1]>=panel[1]+result.legend.paddingPt
          &&line.bboxPt[3]<=panel[3]-result.legend.paddingPt+0.001));
      }
      assert.deepEqual(result.legend.textBounds.map(line=>line.text),['Data','Stans','Sikkerhed']);
    }
  }
  const circle=documented.find(p=>p.format.shape==='circle'&&p.sizeContract!.axes[0].minMm<=10)!;
  await assert.rejects(()=>generateRollLabelSizeTemplate(circle,9,9),/Mål/);
});
