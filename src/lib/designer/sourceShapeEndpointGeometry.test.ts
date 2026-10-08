import test from 'node:test';
import assert from 'node:assert/strict';
import {boundSourceShapeEndpointNormals} from './sourceShapeEndpointGeometry.ts';
import type {ShapePoint,SourceShapeSegment} from './sourceShapeReviewGeometry.ts';
const close=(points:ShapePoint[]):SourceShapeSegment[]=>[{operator:'c',pointsPt:points},
  {operator:'l',pointsPt:[points[3],[10,10]]},{operator:'l',pointsPt:[[10,10],[0,10]]},{operator:'l',pointsPt:[[0,10],points[0]]}];
const reverse=(p:SourceShapeSegment[])=>p.map(s=>({...s,pointsPt:[...s.pointsPt].reverse()})).reverse();
function evaluate(s:SourceShapeSegment,t:number) {
  const p=s.pointsPt,u=1-t;
  return {point:p[0].map((v,k)=>u**3*v+3*u*u*t*p[1][k]+3*u*t*t*p[2][k]+t**3*p[3][k]),
    velocity:p[0].map((v,k)=>3*(u*u*(p[1][k]-v)+2*u*t*(p[2][k]-p[1][k])+t*t*(p[3][k]-p[2][k])))};
}
test('curved endpoint normal extension preserves native polynomial and refuses the reverse side',()=>{
  const path=close([[0,0],[0,0],[4,0],[10,2]]),before=JSON.stringify(path);
  const out=boundSourceShapeEndpointNormals(path,3),inside=boundSourceShapeEndpointNormals(path,-3);
  assert.equal(out.branches[0].status,'bounded_endpoint_normal_branch');
  assert.equal(inside.branches[0].reason,'offset_reverses_near_stationary_endpoint');assert.deepEqual(inside.branches[0].chords,[]);
  assert.equal(out.branches[0].certificate.startOrder,1);assert.equal(out.branches[0].certificate.identityProved,true);
  const first=out.branches[0].chords[0];assert.ok(Math.hypot(first.start[0],first.start[1]+3)<1e-10);
  const s=evaluate(path[0],1e-8),speed=Math.hypot(...s.velocity);
  const near=[s.point[0]+3*s.velocity[1]/speed,s.point[1]-3*s.velocity[0]/speed];
  assert.ok(Math.hypot(near[0]-first.start[0],near[1]-first.start[1])<1e-6);
  assert.equal(JSON.stringify(path),before);assert.equal(out.globalOffsetTopologyProved,false);assert.equal(out.designerAllowed,false);
});
test('first, second and two-ended stationary factors retain parameterwise chord error and finite limits',()=>{
  const fixtures=[close([[0,0],[0,0],[4,0],[10,2]]),close([[0,0],[4,0],[10,2],[10,2]]),
    close([[0,0],[0,0],[0,0],[10,0]]),close([[0,0],[10,0],[10,0],[10,0]]),close([[0,0],[0,0],[10,0],[10,0]])];
  for(const p of fixtures)for(const path of [p,reverse(p)])for(const d of [-3,3]) {
    const g=boundSourceShapeEndpointNormals(path,d,0.001);
    for(const b of g.branches)if(b.status!=='refused')for(const c of b.chords) {
      assert.ok(c.maxErrorMm<=0.001);assert.ok(c.normalizedSpeedLower>0);
      for(let i=1;i<10;i++) {
        const f=i/10,t=c.t0+(c.t1-c.t0)*f,s=evaluate(path[b.segment],t),v=Math.hypot(...s.velocity);
        const actual=[s.point[0]+d*g.exactWinding*s.velocity[1]/v,s.point[1]-d*g.exactWinding*s.velocity[0]/v];
        const approximate=c.start.map((n,k)=>n+(c.end[k]-n)*f);
        assert.ok(Math.hypot(actual[0]-approximate[0],actual[1]-approximate[1])<=c.maxErrorMm+1e-10);
      }
    }
  }
  assert.equal(boundSourceShapeEndpointNormals(fixtures[2],3).branches[0].certificate.startOrder,2);
  assert.equal(boundSourceShapeEndpointNormals(fixtures[3],3).branches[0].certificate.endOrder,2);
  assert.equal(boundSourceShapeEndpointNormals(fixtures[4],3).branches[0].certificate.endOrder,1);
});
test('exact tiny nonzero tangent never becomes stationary and normalized zero cannot be bridged',()=>{
  const near=close([[0,0],[1e-100,0],[4,0],[10,2]]);
  assert.equal(boundSourceShapeEndpointNormals(near,3).branches.length,0);
  const cusp=close([[0,0],[0,0],[20,0],[10,0]]);
  const g=boundSourceShapeEndpointNormals(cusp,3,0.01,12);
  assert.equal(g.branches[0].status,'refused');assert.equal(g.branches[0].reason,'normalized_hodograph_interior_zero_proved');assert.deepEqual(g.branches[0].chords,[]);
});
test('limit joins preserve refusal of reentrant/opposed tangents and work budgets drop all partial chords',()=>{
  const path=close([[0,0],[0,0],[4,0],[10,2]]);
  const a=boundSourceShapeEndpointNormals(path,3),b=boundSourceShapeEndpointNormals(path,-3);
  assert.ok(a.joins.some(j=>j.kind==='analytic_round_arc'));assert.ok(b.joins.some(j=>j.reason==='reentrant_join_requires_trimmed_arrangement'));
  const stopped=boundSourceShapeEndpointNormals(path,3,0.00001,18,1);
  assert.equal(stopped.totalWork,1);assert.equal(stopped.branches[0].reason,'endpoint_work_budget');assert.deepEqual(stopped.branches[0].chords,[]);
  const open=structuredClone(path);open[0].pointsPt[0]=[1,0];assert.throws(()=>boundSourceShapeEndpointNormals(open,3),/open/);
  for(const d of [0,NaN,101])assert.throws(()=>boundSourceShapeEndpointNormals(path,d),/budget/);
});
