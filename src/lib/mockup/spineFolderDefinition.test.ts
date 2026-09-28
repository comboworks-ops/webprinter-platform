import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { A4_THREE_MM_FOLDER as d, spineFolderPose, assertSpineFolderPdf, type SpinePanelId, type SpineFolderDefinition } from './spineFolderDefinition.ts';
import { A4_TEN_MM_FOLDER } from './tenMmFolderDefinition.ts';
import { A4_FIVE_MM_FOLDER } from './fiveMmFolderDefinition.ts';
const close = (a: number, b: number) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
function transforms(open: number, definition: SpineFolderDefinition = d) {
  const d = definition;
  const pose = spineFolderPose(open, d), result = new Map<SpinePanelId, THREE.Matrix4>();
  for (const panel of d.panels) {
    const parent = d.panels.find(p => p.id === panel.parent);
    const position = new THREE.Vector3(panel.hinge[0]-(parent?.hinge[0]??0), (parent?.hinge[1]??0)-panel.hinge[1], 0);
    if (panel.id === 'side-spine') position.z = pose.sideLayer;
    if (panel.id === 'bottom-spine') position.z = pose.bottomLayer;
    const euler = new THREE.Euler(); if (panel.fold) euler[panel.axis]=pose[panel.fold];
    const local = new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromEuler(euler),new THREE.Vector3(1,1,1));
    result.set(panel.id, panel.parent ? result.get(panel.parent)!.clone().multiply(local) : local);
  }
  return result;
}
test('flat 500 × 369 sheet retains sampled cut coordinates, bleed and continuous hinge pairs', () => {
  const matrices=transforms(100);
  for (const p of d.panels) for (const [x,y] of p.outline) {
    assert.ok(x>=4.9&&x<=495.01&&y>=4.9&&y<=364.01);
    const world=new THREE.Vector3(x-p.hinge[0],p.hinge[1]-y,0).applyMatrix4(matrices.get(p.id)!);
    close(world.x,x); close(world.y,-y); close(world.z,0);
  }
  close(d.panels[2].hinge[0]-d.panels[1].hinge[0],d.spineMm);
  close(d.panels[3].hinge[0]-d.panels[4].hinge[0],2.99);
  close(d.panels[6].hinge[1]-d.panels[5].hinge[1],2.99);
});
test('closed cover is parallel to back at actual 3.51 mm crease depth with outward front', () => {
  const m=transforms(0).get('cover')!;
  const hinge=new THREE.Vector3(0,0,0).applyMatrix4(m);
  const tip=new THREE.Vector3(214.96,0,0).applyMatrix4(m);
  close(hinge.x,276.53);close(hinge.z,-3.51);close(tip.x,61.57);close(tip.z,-3.51);
  const normal=new THREE.Vector3(0,0,1).transformDirection(m);close(normal.z,-1);
  const bottomZ = new THREE.Vector3().applyMatrix4(transforms(0).get('bottom')!).z;
  const sideZ = new THREE.Vector3().applyMatrix4(transforms(0).get('side')!).z;
  const coverInsideZ = tip.z + d.displayThicknessMm / 2;
  const bottomPrintedZ = bottomZ - d.displayThicknessMm / 2;
  close(bottomPrintedZ - coverInsideZ, .055);
  close(sideZ - bottomZ - d.displayThicknessMm, .03);
});
test('cover opens before either pocket; pockets fold away from the back, not through it', () => {
  const closed=spineFolderPose(0),coverOpen=spineFolderPose(45),bottomOpen=spineFolderPose(70);
  close(coverOpen.cover,0);close(coverOpen.side,closed.side);close(coverOpen.bottom,closed.bottom);
  close(bottomOpen.bottom,0);close(bottomOpen.side,closed.side);
  for (let open=0;open<=100;open+=5) {
    const m=transforms(open);
    for (const id of ['cover','side','bottom'] as const) {
      const p=d.panels.find(p=>p.id===id)!;
      for (const [x,y] of p.outline) {
        const pos=new THREE.Vector3(x-p.hinge[0],p.hinge[1]-y,0).applyMatrix4(m.get(id)!);
        assert.ok(pos.z<=.081,`${id} at ${open}% crosses back: ${pos.z}`);
      }
    }
  }
});
test('4+0 accepts only one exact full-size print page, not the grey second reference', () => {
  const page={widthMm:500,heightMm:369}; assert.doesNotThrow(()=>assertSpineFolderPdf([page],d));
  for(const pages of [[],[page,page],[{widthMm:490,heightMm:359}],[{widthMm:369,heightMm:500}],[{widthMm:NaN,heightMm:369}]]) assert.throws(()=>assertSpineFolderPdf(pages,d));
});

test('5 mm uses its own 504 × 371 sheet, cut outline and crease pairs', () => {
  const f = A4_FIVE_MM_FOLDER;
  const matrices = transforms(100, f);
  for (const panel of f.panels) for (const [x, y] of panel.outline) {
    assert.ok(x >= 4.9 && x <= 499.01 && y >= 4.9 && y <= 366.01);
    const world = new THREE.Vector3(x-panel.hinge[0], panel.hinge[1]-y, 0).applyMatrix4(matrices.get(panel.id)!);
    close(world.x, x); close(world.y, -y); close(world.z, 0);
  }
  close(f.panels[2].hinge[0]-f.panels[1].hinge[0], 5.5);
  close(f.panels[3].hinge[0]-f.panels[4].hinge[0], 5);
  close(f.panels[6].hinge[1]-f.panels[5].hinge[1], 5);
  assert.doesNotThrow(() => assertSpineFolderPdf([{widthMm:504,heightMm:371}], f));
  assert.throws(() => assertSpineFolderPdf([{widthMm:500,heightMm:369}], f));
});
test('5 mm closed cover keeps extra depth and clears both printed pocket faces', () => {
  const f = A4_FIVE_MM_FOLDER, matrices = transforms(0, f);
  const cover = matrices.get('cover')!;
  const tip = new THREE.Vector3(215,0,0).applyMatrix4(cover);
  close(tip.x, 63.5); close(tip.z, -5.5);
  close(new THREE.Vector3(0,0,1).transformDirection(cover).z,-1);
  const bottomZ = new THREE.Vector3().applyMatrix4(matrices.get('bottom')!).z;
  const sideZ = new THREE.Vector3().applyMatrix4(matrices.get('side')!).z;
  close(bottomZ-tip.z-f.displayThicknessMm, .035);
  close(sideZ-bottomZ-f.displayThicknessMm, .03);
  assert.ok(f.spineMm > d.spineMm);
});

test('10 mm retains its independent cut path and measured hinge depths', () => {
  const f = A4_TEN_MM_FOLDER, flat = transforms(100, f);
  for (const panel of f.panels) for (const [x,y] of panel.outline) {
    assert.ok(x>=4.9 && x<=509.01 && y>=4.9 && y<=371.01);
    const world = new THREE.Vector3(x-panel.hinge[0],panel.hinge[1]-y,0).applyMatrix4(flat.get(panel.id)!);
    close(world.x,x); close(world.y,-y); close(world.z,0);
  }
  close(f.panels[2].hinge[0]-f.panels[1].hinge[0],10.481);
  close(f.panels[3].hinge[0]-f.panels[4].hinge[0],10.038);
  close(f.panels[6].hinge[1]-f.panels[5].hinge[1],10.039);
  assert.doesNotThrow(()=>assertSpineFolderPdf([{widthMm:514,heightMm:376}],f));
  assert.throws(()=>assertSpineFolderPdf([{widthMm:504,heightMm:371}],f));
});
test('10 mm closes with outward front and separate cover/pocket paper layers', () => {
  const f = A4_TEN_MM_FOLDER, closed=transforms(0,f), cover=closed.get('cover')!;
  const tip=new THREE.Vector3(215.067,0,0).applyMatrix4(cover);
  close(tip.x,68.385); close(tip.z,-10.481);
  close(new THREE.Vector3(0,0,1).transformDirection(cover).z,-1);
  const bottomZ=new THREE.Vector3().applyMatrix4(closed.get('bottom')!).z;
  const sideZ=new THREE.Vector3().applyMatrix4(closed.get('side')!).z;
  close(bottomZ-tip.z-f.displayThicknessMm,.01);
  close(sideZ-bottomZ-f.displayThicknessMm,.031);
  // Protect already approved 3/5 mm fold positions while allocating 10 mm clearance.
  for (const previous of [d,A4_FIVE_MM_FOLDER]) {
    close(spineFolderPose(0,previous).sideLayer,.165);
    close(spineFolderPose(0,previous).bottomLayer,-.165);
  }
});
test('10 mm pockets and cover stay on the folding side through the animation', () => {
  const f=A4_TEN_MM_FOLDER;
  for (let open=0;open<=100;open+=5) {
    const matrices=transforms(open,f);
    for (const panel of f.panels.filter(p=>['cover','side','bottom'].includes(p.id))) {
      for(const [x,y] of panel.outline) {
        const point=new THREE.Vector3(x-panel.hinge[0],panel.hinge[1]-y,0).applyMatrix4(matrices.get(panel.id)!);
        assert.ok(point.z<=.1,`${panel.id} at ${open}% crosses back: ${point.z}`);
      }
    }
  }
});
