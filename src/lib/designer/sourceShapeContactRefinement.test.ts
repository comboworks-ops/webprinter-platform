import test from 'node:test';
import assert from 'node:assert/strict';
import {boundSourceShapeBranchContacts, refineSourceShapeBranchContacts, type ContactBranch, type ContactChord} from './sourceShapeContactGeometry';
const chord=(start:[number,number],end:[number,number],r=0.01):ContactChord=>({start,end,t0:0,t1:1,maxErrorMm:r});
const branch=(segment:number,chords:ContactChord[]):ContactBranch=>({segment,status:'bounded_normal_branch',chords});
const result=(a:ContactChord,b:ContactChord)=>refineSourceShapeBranchContacts([branch(0,[a]),branch(1,[b])],[[0,1]]);

test('diagonal tubes exclude a whole pair whose coordinate boxes overlap',()=>{
  const input=[branch(4,[chord([0,0],[10,10])]),branch(9,[chord([0,0.1],[10,10.1])])];
  const original=JSON.stringify(input);
  assert.equal(boundSourceShapeBranchContacts(input).pairs[0].status,'unresolved');
  const r=refineSourceShapeBranchContacts(input,[[4,9]]),p=r.pairs[0];
  assert.equal(p.status,'disjoint_inherited_curve_tubes');assert.equal(p.reason,null);
  assert.equal(p.tubeTests,1);assert.equal(p.separationLeaves[0][0],'tube');
  assert.equal(JSON.stringify(input),original);
  for(const flag of ['actualContactsIsolated','withinBranchInjectivityProved','joinsExamined','focalFragmentsExamined',
    'retainedBoundaryAccepted','globalOffsetTopologyProved','scalingAuthorityProved','sourceGeometryAccepted','designerAllowed','orderReady'] as const)assert.equal(r[flag],false);
});
test('crossings, equality and intersecting inherited tubes never become contact or separation proofs',()=>{
  const a=chord([0,0],[10,0]);
  for(const b of [chord([5,-1],[5,1]),chord([0,0.02],[10,0.02]),chord([0,0.015],[10,0.015]),a]){
    const p=result(a,b).pairs[0];assert.equal(p.status,'unresolved');assert.equal(p.reason,'chord_tubes_overlap_contact_unresolved');
    assert.deepEqual(p.separationLeaves,[]);assert.deepEqual(p.unresolvedChordRanges,[[0,1],[0,1]]);
  }
});
test('endpoint axes handle point chords and reversed ordering without square-root rounding',()=>{
  const a=chord([0,0],[0,0],0.02),b=chord([0.03,0.03],[0.03,0.03],0.02);
  for(const [x,y] of [[a,b],[b,a]])assert.equal(result(x,y).pairs[0].status,'disjoint_inherited_curve_tubes');
  assert.equal(result(a,chord([0.02,0.02],[0.02,0.02],0.02)).pairs[0].status,'unresolved');
});
test('subnormal radii retain strictly positive exact projection certificates',()=>{
  const tiny=Number.MIN_VALUE;
  const a=chord([0,0],[1,1],tiny),b=chord([0,8*tiny],[1,1],tiny);
  // The endpoints coincide; a tiny offset at only one end is not a separation.
  assert.equal(result(a,b).pairs[0].status,'unresolved');
  const pointA=chord([0,0],[0,0],tiny),pointB=chord([2*tiny,2*tiny],[2*tiny,2*tiny],tiny);
  const p=result(pointA,pointB).pairs[0];assert.equal(p.status,'disjoint_inherited_curve_tubes');
  assert.equal(p.separationLeaves[0][0],'tube');
});
test('mixed box and tube leaves cover the full Cartesian domain, or are all discarded',()=>{
  const a=[{...chord([0,0],[1,1]),t1:0.5},{...chord([1,1],[2,2]),t0:0.5}];
  const b=[{...chord([0,0.1],[1,1.1]),t1:0.5},{...chord([1,1.1],[2,2.1]),t0:0.5}];
  const good=refineSourceShapeBranchContacts([branch(0,a),branch(1,b)],[[0,1]]).pairs[0];
  assert.equal(good.status,'disjoint_inherited_curve_tubes');
  const covered=new Set<string>();
  for(const leaf of good.separationLeaves){
    const [a0,a1,b0,b1]=leaf[0]==='box'?leaf.slice(1,5) as number[]:[leaf[1],leaf[1]+1,leaf[2],leaf[2]+1];
    for(let i=a0;i<a1;i++)for(let j=b0;j<b1;j++){assert.ok(!covered.has(`${i}:${j}`));covered.add(`${i}:${j}`);}
  }
  assert.equal(covered.size,4);
  const broken=structuredClone(b);broken[1].end=[2,2];
  const failed=refineSourceShapeBranchContacts([branch(0,a),branch(1,broken)],[[0,1]]).pairs[0];
  assert.equal(failed.status,'unresolved');assert.deepEqual(failed.separationLeaves,[]);
  const budget=refineSourceShapeBranchContacts([branch(0,a),branch(1,b)],[[0,1]],2).pairs[0];
  assert.equal(budget.reason,'contact_work_budget');assert.equal(budget.work,2);assert.deepEqual(budget.separationLeaves,[]);
});
test('unconstructed branches and malformed or duplicate candidate identities remain explicit',()=>{
  const input=[branch(0,[chord([0,0],[1,1])]),{segment:1,status:'refused',chords:[]} as ContactBranch];
  const p=refineSourceShapeBranchContacts(input,[[0,1]]).pairs[0];assert.equal(p.reason,'unconstructed_native_branch');
  for(const pairs of [[[0,0]],[[0,2]],[[0,1],[1,0]]])assert.throws(()=>refineSourceShapeBranchContacts(input,pairs as [number,number][]));
  assert.throws(()=>refineSourceShapeBranchContacts(input,[[0,1]],0),/budget/);
  assert.throws(()=>refineSourceShapeBranchContacts([branch(0,[{...chord([0,0],[1,1]),t0:0.1}]),input[1]],[[0,1]]),/coverage/);
  assert.equal(refineSourceShapeBranchContacts(input,[]).pairs.length,0);
});
