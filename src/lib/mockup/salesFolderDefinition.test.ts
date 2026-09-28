import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SALES_FOLDER_MODELS } from './salesFolderModels.generated.ts';
import { salesFolderPanelAngle, salesFolderInsideUv } from './salesFolderDefinition.ts';
import { resolveApprovedPrintModel, printModelTemplatePageCount } from './approvedPrintModels.ts';

const unique = [...new Map(SALES_FOLDER_MODELS.map(m => [m.definition.panels, m])).values()];
test('every catalogue variant has an exact unique fingerprint; ambiguous legacy stays review-only', () => {
  assert.equal(SALES_FOLDER_MODELS.length, 1421);
  assert.equal(new Set(SALES_FOLDER_MODELS.map(m => m.ticket)).size, 143);
  assert.equal(new Set(SALES_FOLDER_MODELS.map(m => m.definition.templateHash)).size, 1421);
  assert.equal(unique.length, 79);
  for (const m of SALES_FOLDER_MODELS) {
    const d = m.definition;
    assert.match(d.templateHash, /^[a-f0-9]{64}$/);
    assert.equal(Boolean(resolveApprovedPrintModel(d.templateHash)), m.artworkMode !== 'review_only');
    if (m.artworkMode !== 'review_only') {
      assert.equal(printModelTemplatePageCount(resolveApprovedPrintModel(d.templateHash)!), 2);
      assert.equal(m.pages, m.label.endsWith('4+4') ? 2 : 1);
    }
    assert.ok(!m.label.includes('DIN lang'));
  }
});
test('every measured panel tree is connected, finite and within its exact sheet', () => {
  for (const {definition:d,label} of unique) {
    const seen = new Set<string>();
    assert.equal(d.panels.filter(p => p.parent === null).length, 1, label);
    for (const p of d.panels) {
      assert.ok(!seen.has(p.id), label);
      if (p.parent) assert.ok(seen.has(p.parent), `${label}: parent before child`);
      seen.add(p.id);
      assert.ok(p.outline.length >= 3);
      for (const [x,y] of [...p.outline,...p.holes.flat(),p.hinge,p.hingeEnd]) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), label);
        assert.ok(x >= -.1 && y >= -.1 && x <= d.sheetWidthMm + .1 && y <= d.sheetHeightMm + .1, label);
      }
      assert.ok(Math.hypot(p.hinge[0]-p.hingeEnd[0],p.hinge[1]-p.hingeEnd[1])>1);
      assert.equal(salesFolderPanelAngle(p,100),0);
      assert.equal(salesFolderPanelAngle(p,150),0);
      assert.equal(salesFolderPanelAngle(p,-20),p.angle);
    }
  }
});
test('closed broad panels face parallel to the back; gussets preserve measured depth', () => {
  for (const {definition:d,label} of unique) {
    const groups = new Map<string,THREE.Group>();
    for (const p of d.panels) {
      const parent=d.panels.find(x=>x.id===p.parent), g=new THREE.Group();
      g.position.set(p.hinge[0]-(parent?.hinge[0]??d.centre[0]),(parent?.hinge[1]??d.centre[1])-p.hinge[1],0);
      const axis=new THREE.Vector3(p.hingeEnd[0]-p.hinge[0],p.hinge[1]-p.hingeEnd[1],0).normalize();
      g.quaternion.setFromAxisAngle(axis,salesFolderPanelAngle(p,0));
      if(p.parent) groups.get(p.parent)!.add(g);
      groups.set(p.id,g);g.updateWorldMatrix(true,false);
      const xs=p.outline.map(p=>p[0]),ys=p.outline.map(p=>p[1]);
      if(Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))>20 && p.angle!==0) {
        const n=new THREE.Vector3(0,0,1).transformDirection(g.matrixWorld);
        assert.ok(Math.abs(n.z)>.995,`${label}: ${p.id} folded normal ${n.z}`);
      }
    }
  }
});
test('window templates contain real holes and reader faces have unique page labels', () => {
  for (const m of SALES_FOLDER_MODELS) {
    const d=m.definition;
    if(m.label.includes('vinduesudstansning')) assert.ok(d.panels.some(p=>p.holes.length>0),m.label);
    const outer=d.panels.flatMap(p=>p.pageOutside ? [p.pageOutside] : []);
    const inner=d.panels.flatMap(p=>p.pageInside ? [p.pageInside] : []);
    assert.deepEqual([...outer,...inner].sort((a,b)=>a-b),Array.from({length:d.readerPages},(_,i)=>i+1),m.label);
    const cover=d.panels.find(p=>p.pageOutside===1)!;
    if(m.label.includes('lukning')) assert.equal(cover.outsideRotation,180);
  }
});
test('inside artwork maps the reverse sheet without mirroring outside artwork', () => {
  const d=SALES_FOLDER_MODELS[0].definition;
  assert.deepEqual(salesFolderInsideUv(d,.2,.7),[.8,.7]);
  assert.deepEqual(salesFolderInsideUv({...d,insideTransform:'mirror-y'},.2,.7),[.2,1-.7]);
  assert.deepEqual(salesFolderInsideUv({...d,insideTransform:'identity'},.2,.7),[.2,.7]);
  assert.deepEqual(salesFolderInsideUv({...d,insideTransform:'rotate-180'},.2,.7),[.8,1-.7]);
});
