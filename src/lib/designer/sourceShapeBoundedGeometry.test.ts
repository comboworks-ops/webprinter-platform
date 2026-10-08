import test from 'node:test';
import assert from 'node:assert/strict';
import { boundSourceShapeTopology, boundSourceShapeOffset } from './sourceShapeBoundedGeometry.ts';
import type { ShapePoint, SourceShapeSegment } from './sourceShapeReviewGeometry.ts';
const polygon=(ps:ShapePoint[]):SourceShapeSegment[]=>ps.map((p,i)=>({operator:'l',pointsPt:[p,ps[(i+1)%ps.length]]}));
const square=polygon([[0,0],[10,0],[10,10],[0,10]]);
const k=0.5522847498307936,r=10;
const circle:SourceShapeSegment[]=[
  [[r,0],[r,k*r],[k*r,r],[0,r]],[[0,r],[-k*r,r],[-r,k*r],[-r,0]],
  [[-r,0],[-r,-k*r],[-k*r,-r],[0,-r]],[[0,-r],[k*r,-r],[r,-k*r],[r,0]],
].map(pointsPt=>({operator:'c',pointsPt:pointsPt as unknown as ShapePoint[]}));
const reverse=(p:SourceShapeSegment[])=>p.map(s=>({...s,pointsPt:[...s.pointsPt].reverse()})).reverse();

test('exact dyadic topology certifies straight and curved loops in either winding without mutating inputs',()=>{
  for(const p of [square,circle,reverse(circle),polygon([[0,0],[11,2],[9,12],[-2,10]])]) {
    const before=JSON.stringify(p),g=boundSourceShapeTopology(p);
    assert.equal(g.status,'binary_input_simple_loop_proved');assert.equal(g.arithmetic,'exact_integer_dyadic');
    assert.equal(g.sourceGeometryAccepted,false);assert.equal(g.supplierScalingAccepted,false);
    assert.equal(JSON.stringify(p),before);assert.ok(g.leafCount>=4);
  }
});
test('crossings, repeated edges, tangency and single-cubic loops cannot obtain topology acceptance',()=>{
  const fixtures=[polygon([[0,0],[10,10],[0,10],[10,0]]),polygon([[0,0],[10,0],[10,10],[0,10],[10,0]]),
    polygon([[0,0],[10,0],[5,5],[10,10],[0,10],[5,5]]),
    [{operator:'c',pointsPt:[[0,0],[10,10],[-10,10],[0,0]]},{operator:'l',pointsPt:[[0,0],[0,-10]]},{operator:'l',pointsPt:[[0,-10],[0,0]]}] as SourceShapeSegment[]];
  for(const p of fixtures){const g=boundSourceShapeTopology(p,10,10000);assert.notEqual(g.status,'binary_input_simple_loop_proved');assert.ok(g.failures.length);}
  for(const p of fixtures.slice(0,3))assert.equal(boundSourceShapeTopology(p).status,'binary_input_not_simple');
  assert.equal(boundSourceShapeTopology(fixtures[0]).lineWitness?.kind,'unexpected_line_contact');
  assert.equal(boundSourceShapeTopology(polygon([[0,0],[10,9],[0,10],[10,0]])).lineWitness?.kind,'proper_line_crossing');
});
test('exact predicates retain a sub-tolerance gap while refusing true contact and respect work budgets',()=>{
  const almost=polygon([[0,0],[10,0],[10,10],[5,10],[5,1e-14],[4,1e-14],[4,10],[0,10]]);
  assert.equal(boundSourceShapeTopology(almost).status,'binary_input_simple_loop_proved');
  const touch=structuredClone(almost);touch[3].pointsPt[1]=[5,0];touch[4].pointsPt[0]=[5,0];
  assert.equal(boundSourceShapeTopology(touch,10).status,'binary_input_not_simple');
  const budget=boundSourceShapeTopology(circle,18,1);assert.equal(budget.status,'unresolved');
  assert.equal(budget.failures[0].reason,'topology_work_budget');
  assert.throws(()=>boundSourceShapeTopology(circle,100),/budget/);
});

function evaluate(s:SourceShapeSegment,t:number) {
  const ps=s.pointsPt,u=1-t;
  const point=ps.length===2?ps[0].map((v,i)=>u*v+t*ps[1][i]):ps[0].map((v,i)=>u**3*v+3*u*u*t*ps[1][i]+3*u*t*t*ps[2][i]+t**3*ps[3][i]);
  const first=ps.length===2?ps[0].map((v,i)=>ps[1][i]-v):ps[0].map((v,i)=>3*(u*u*(ps[1][i]-v)+2*u*t*(ps[2][i]-ps[1][i])+t*t*(ps[3][i]-ps[2][i])));
  return {point,first};
}
test('interval bound contains independent pointwise normal residuals on every cubic offset chord',()=>{
  for(const d of [-3,3]) {
    const g=boundSourceShapeOffset(circle,d,0.001);
    assert.equal(g.allBranchesBounded,true);assert.equal(g.allJoinsConstructed,true);
    assert.equal(g.globalOffsetTopologyProved,false);assert.equal(g.supplierJoinPolicyAccepted,false);
    assert.ok(g.branches.reduce((n,b)=>n+b.chords.length,0)>100);
    for(const b of g.branches)for(const chord of b.chords) {
      assert.ok(chord.maxErrorMm<=g.errorMm);assert.ok(chord.regularFactorLower>0);
      for(let i=0;i<=20;i++) {
        const fraction=i/20,t=chord.t0+(chord.t1-chord.t0)*fraction,{point,first}=evaluate(circle[b.segment],t),speed=Math.hypot(...first);
        const normal=[point[0]+d*first[1]/speed,point[1]-d*first[0]/speed];
        const linear=chord.start.map((v,k)=>v+(chord.end[k]-v)*fraction);
        assert.ok(Math.hypot(normal[0]-linear[0],normal[1]-linear[1])<=chord.maxErrorMm+1e-12);
      }
    }
  }
});
test('square normal branches and exposed circular joins are constructed, inward trimming is explicitly refused',()=>{
  const g=boundSourceShapeOffset(square,3);
  assert.equal(g.allBranchesBounded,true);assert.equal(g.allJoinsConstructed,true);
  assert.ok(g.branches.every(b=>b.chords.length===1));assert.ok(g.joins.every(j=>j.kind==='analytic_round_arc'&&j.radiusMm===3&&j.sweep===1));
  assert.deepEqual(g.branches[0].chords[0].start,[0,-3]);assert.deepEqual(g.branches[0].chords[0].end,[10,-3]);
  const inside=boundSourceShapeOffset(square,-3);assert.equal(inside.allBranchesBounded,true);assert.equal(inside.allJoinsConstructed,false);
  assert.ok(inside.joins.every(j=>j.reason==='reentrant_join_requires_trimmed_arrangement'));
  const back=boundSourceShapeOffset(reverse(square),3);assert.ok(back.joins.every(j=>j.sweep===0));
  assert.ok(back.branches.some(b=>b.chords[0].start[1]===-3));
});
test('stationary tangents, focal reversal, sharp concavity and numeric/work exhaustion remain closed',()=>{
  const stopped=structuredClone(circle);stopped[0].pointsPt[1]=stopped[0].pointsPt[0];
  const g=boundSourceShapeOffset(stopped,3);assert.equal(g.branches[0].reason,'stationary_native_endpoint');assert.equal(g.joins.at(-1)!.reason,'stationary_join_tangent');
  const focal=boundSourceShapeOffset(circle,-11,0.01,12);assert.equal(focal.allBranchesBounded,false);
  assert.ok(focal.branches.some(b=>b.reason==='orientation_preserving_offset_refused'));
  const concave=boundSourceShapeOffset(polygon([[0,0],[10,0],[10,10],[5,5],[0,10]]),3);
  assert.ok(concave.joins.some(j=>j.reason==='reentrant_join_requires_trimmed_arrangement'));
  const budget=boundSourceShapeOffset(circle,3,0.001,18,1);assert.equal(budget.allBranchesBounded,false);
  assert.ok(budget.branches.some(b=>b.reason==='offset_work_budget'));
  for(const d of [0,NaN,Infinity,101])assert.throws(()=>boundSourceShapeOffset(square,d),/budget/);
});
test('bounded offset branches preserve winding and approximate the same physical side after reversal',()=>{
  const a=boundSourceShapeOffset(circle,3),b=boundSourceShapeOffset(reverse(circle),3);
  assert.equal(a.allBranchesBounded,true);assert.equal(b.allBranchesBounded,true);
  const endpoints=(g:ReturnType<typeof boundSourceShapeOffset>)=>g.branches.flatMap(b=>b.chords.map(c=>c.start));
  for(const p of endpoints(a))assert.ok(Math.min(...endpoints(b).map(q=>Math.hypot(q[0]-p[0],q[1]-p[1])))<0.01);
});
