import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSourceShapePath,sourceShapeMetrics,sourceShapeContinuity,transformSourceShape,flattenSourceShape,
  reviewSourceShapeAtSize,sourceShapeSvgPath,type SourceShapeSegment,type ShapePoint} from './sourceShapeReviewGeometry.ts';
const square:SourceShapeSegment[]=[[[0,0],[10,0]],[[10,0],[10,10]],[[10,10],[0,10]],[[0,10],[0,0]]]
  .map(points=>({operator:'l',pointsPt:points.map(p=>[p[0],p[1]] as ShapePoint)}));
const arch:SourceShapeSegment[]=[{operator:'c',pointsPt:[[0,0],[0,4],[4,4],[4,0]]},{operator:'l',pointsPt:[[4,0],[0,0]]}];

test('analytic curve extrema and signed integral differ from control hull and reverse correctly',()=>{
  const m=sourceShapeMetrics(arch);assert.deepEqual(m.bounds,[0,0,4,3]);assert.ok(Math.abs(m.signedArea+9.6)<1e-10);
  const reverse=arch.map(s=>({...s,pointsPt:[...s.pointsPt].reverse()})).reverse();
  assert.ok(Math.abs(sourceShapeMetrics(reverse).signedArea-9.6)<1e-10);
  const scaled=transformSourceShape(arch,m.bounds,40,60,3);const sm=sourceShapeMetrics(scaled);
  assert.deepEqual(sm.bounds,[3,3,43,63]);assert.ok(Math.abs(sm.signedArea+1920)<1e-7);
  assert.deepEqual(arch[0].pointsPt,[[0,0],[0,4],[4,4],[4,0]]);
});

test('native closure rejects open, disconnected, unknown and collapsed curves without snapping',()=>{
  const changed=structuredClone(square);changed[3].pointsPt[1]=[0,1e-9];
  assert.throws(()=>assertSourceShapePath(changed),/open/);
  const disconnected=structuredClone(square);disconnected[1].pointsPt[0]=[10.1,0];
  assert.throws(()=>assertSourceShapePath(disconnected),/disconnected/);
  assert.equal(sourceShapeContinuity(changed).closed,false);
  assert.throws(()=>assertSourceShapePath([{operator:'q',pointsPt:[[0,0],[1,1]]},...square]),/Unsupported/);
  assert.throws(()=>sourceShapeMetrics(square.map(s=>({...s,pointsPt:s.pointsPt.map(()=>[0,0] as ShapePoint)}))),/Collapsed/);
  for(const v of [NaN,Infinity,-1,0,10001])assert.throws(()=>reviewSourceShapeAtSize(square,v,50,3,3));
});

test('bounded flattening contains independent cubic samples and never bridges the closing seam',()=>{
  const path=transformSourceShape(arch,sourceShapeMetrics(arch).bounds,40,60),flat=flattenSourceShape(path,0.001);
  const pointDistance=(p:ShapePoint,a:ShapePoint,b:ShapePoint)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
  };
  for(let i=0;i<=1000;i++) {
    const t=i/1000,u=1-t,p=path[0].pointsPt;
    const sample=[0,1].map(k=>u**3*p[0][k]+3*u*u*t*p[1][k]+3*u*t*t*p[2][k]+t**3*p[3][k]) as unknown as ShapePoint;
    const residual=Math.min(...flat.points.slice(1).map((b,j)=>pointDistance(sample,flat.points[j],b)));
    assert.ok(residual<=flat.maxErrorMm);
  }
  assert.deepEqual(flat.points[0],flat.points.at(-1));assert.ok(flat.segmentCount>100);
});

test('normal diagnostic directions follow winding; sharp joins never manufacture an offset',()=>{
  const g=reviewSourceShapeAtSize(square,10,10,3,3);
  assert.equal(g.diagnostics.nonSmoothJoins,4);assert.equal(g.diagnostics.minSampledRadiusMm,null);
  const p=g.normalSamples.find(p=>p.cut[0]===8&&p.cut[1]===3)!;
  assert.deepEqual(p.safe,[8,6]);assert.deepEqual(p.bleed,[8,0]);
  assert.equal(g.offsetGeometryConstructed,false);assert.equal(g.exactTopologyProved,false);assert.equal(g.sourceGeometryAccepted,false);
  const reverse=square.map(s=>({...s,pointsPt:[...s.pointsPt].reverse()})).reverse();
  const back=reviewSourceShapeAtSize(reverse,10,10,3,3);
  assert.ok(back.normalSamples.some(p=>p.cut[0]===8&&p.cut[1]===3&&p.safe[1]===6&&p.bleed[1]===0));
  assert.match(sourceShapeSvgPath(square),/^M 0 0 L/);
});

test('self crossing and singular samples remain diagnostic witnesses instead of exact topology claims',()=>{
  const bow:SourceShapeSegment[]=[[[0,0],[10,10]],[[10,10],[0,10]],[[0,10],[10,0]],[[10,0],[0,0]]]
    .map(points=>({operator:'l',pointsPt:points.map(p=>[p[0],p[1]] as ShapePoint)}));
  const g=reviewSourceShapeAtSize(bow,10,10,3,3);
  assert.equal(g.diagnostics.polylineCrossings.length,1);assert.equal(g.exactTopologyProved,false);
  const curved=reviewSourceShapeAtSize(arch,4,3,3,3);
  assert.ok(curved.diagnostics.inwardFocalRadiusExceededSamples>0);assert.equal(curved.offsetGeometryConstructed,false);
});
