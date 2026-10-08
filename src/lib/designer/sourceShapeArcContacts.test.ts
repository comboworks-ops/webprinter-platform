import test from 'node:test';
import assert from 'node:assert/strict';
import {constructSourceShapeExactRoundArcs,intersectSourceShapeExactRoundArcs,signSourceShapeRadical,type ExactRoundArc} from './sourceShapeArcContacts';
import {boundSourceShapeOffset} from './sourceShapeBoundedGeometry';
import {boundSourceShapeEndpointNormals} from './sourceShapeEndpointGeometry';
import type {SourceShapeSegment} from './sourceShapeReviewGeometry';
const arc=(id:number,center:[number,number],start:[number,number],end:[number,number],radius=1):ExactRoundArc=>({afterSegment:id,
  center:center.map(String) as [string,string],radius:String(radius),startDirection:start.map(String) as [string,string],
  endDirection:end.map(String) as [string,string],sweep:1,scale2Exponent:0,incomingLeadingOrder:1,outgoingLeadingOrder:1});
test('radical signs distinguish exact equality and near equality without square roots',()=>{
  for(const [a,b,t,s] of [[0n,1n,2n,1],[0n,-1n,2n,-1],[2n,-1n,4n,0],[3n,-1n,4n,1],[-3n,1n,4n,-1],
    [1n,-1n,2n,-1],[-1n,1n,2n,1],[1n,2n,0n,1]] as const)assert.equal(signSourceShapeRadical(a,b,t),s);
  const n=1n<<1000n;assert.equal(signSourceShapeRadical(n,-1n,n*n-1n),1);
  assert.equal(signSourceShapeRadical(n,-1n,n*n+1n),-1);
  assert.throws(()=>signSourceShapeRadical(1n,1n,-1n));
});
test('all circle roots are retained while exact arc sectors select one or two actual contacts',()=>{
  const a=arc(0,[0,0],[1,0],[0,1]),b=arc(1,[1,0],[0,1],[-1,0]);
  const r=intersectSourceShapeExactRoundArcs(a,b);
  assert.equal(r.status,'isolated_exact_round_arc_contacts');assert.equal(r.contactCount,1);assert.equal(r.roots.length,2);
  assert.deepEqual(r.roots.map(p=>p.contact),[false,true]);
  assert.deepEqual(r.roots[1].point,{base:['1','0'],coefficient:['0','1'],denominator:'2',radicand:'3'});
  const both=intersectSourceShapeExactRoundArcs(arc(0,[0,0],[1,-2],[1,2]),arc(1,[1,0],[-1,2],[-1,-2]));
  assert.equal(both.contactCount,2);
  const off=intersectSourceShapeExactRoundArcs(arc(0,[0,0],[-1,0],[0,-1]),b);
  assert.equal(off.status,'disjoint_exact_round_arcs');assert.equal(off.roots.length,2);assert.equal(off.contactCount,0);
});
test('circle tangency is one exact root, including closed-sector endpoint equality',()=>{
  const r=intersectSourceShapeExactRoundArcs(arc(0,[0,0],[1,0],[0,1]),arc(1,[2,0],[0,1],[-1,0]));
  assert.equal(r.relation,'tangent_circle_support');assert.equal(r.contactCount,1);assert.equal(r.roots.length,1);
  assert.equal(r.roots[0].onA.startSign,0);assert.equal(r.roots[0].onB.endSign,0);
  assert.equal(r.roots[0].point.radicand,'0');
});
test('external, contained and concentric circles are disjoint without approximate tolerances',()=>{
  const a=arc(0,[0,0],[1,0],[0,1]);
  for(const b of [arc(1,[3,0],[0,1],[-1,0]),arc(1,[0,0],[0,1],[-1,0],2)]){
    const r=intersectSourceShapeExactRoundArcs(a,b);assert.equal(r.status,'disjoint_exact_round_arcs');assert.equal(r.roots.length,0);
  }
  const internal=intersectSourceShapeExactRoundArcs(arc(0,[0,0],[1,0],[0,1],4),arc(1,[1,0],[0,1],[-1,0]));
  assert.equal(internal.status,'disjoint_exact_round_arcs');
});
test('coincident disjoint sectors exclude contact; touching/overlapping sectors stay explicitly unresolved',()=>{
  const a=arc(0,[0,0],[1,0],[0,1]);
  assert.equal(intersectSourceShapeExactRoundArcs(a,arc(1,[0,0],[-1,0],[0,-1])).status,'disjoint_exact_round_arcs');
  for(const b of [arc(1,[0,0],[0,1],[-1,0]),arc(1,[0,0],[1,0],[0,1])]){
    const r=intersectSourceShapeExactRoundArcs(a,b);assert.equal(r.status,'coincident_sector_contact_unresolved');assert.equal(r.roots.length,0);
  }
});
test('native endpoint factors reconstruct round joins without display-point snapping',()=>{
  const path:SourceShapeSegment[]=[{operator:'c',pointsPt:[[0,0],[0,0],[1,0],[1,1]]},
    {operator:'l',pointsPt:[[1,1],[0,1]]},{operator:'l',pointsPt:[[0,1],[0,0]]}];
  const old=boundSourceShapeOffset(path,0.1),endpoint=boundSourceShapeEndpointNormals(path,0.1);
  const joins=old.joins.map(j=>endpoint.joins.find(e=>e.afterSegment===j.afterSegment)??j);
  const native=JSON.stringify(path),r=constructSourceShapeExactRoundArcs(path,0.1,joins);
  assert.equal(r.arcs.length,3);assert.equal(r.arcs.find(a=>a.afterSegment===2)!.outgoingLeadingOrder,2);
  assert.equal(r.winding,1);assert.equal(r.sourceGeometryAccepted,false);assert.equal(r.supplierJoinPolicyAccepted,false);
  assert.equal(r.globalOffsetTopologyProved,false);assert.equal(r.designerAllowed,false);assert.equal(r.orderReady,false);
  assert.equal(JSON.stringify(path),native);
  const shifted=structuredClone(joins);shifted[0].center=[2,2];assert.throws(()=>constructSourceShapeExactRoundArcs(path,0.1,shifted),/Foreign/);
  const rounded=structuredClone(joins);rounded[0].start=[999,999];
  assert.deepEqual(constructSourceShapeExactRoundArcs(path,0.1,rounded),r);
  assert.throws(()=>constructSourceShapeExactRoundArcs(path,0.1,joins.slice(1)),/inventory/);
});
test('invalid half/full-circle sectors and foreign native pair identities refuse',()=>{
  const a=arc(0,[0,0],[1,0],[0,1]);
  for(const b of [arc(1,[0,0],[1,0],[-1,0]),arc(1,[0,0],[1,0],[1,0]),{...arc(1,[0,0],[1,0],[0,1]),radius:'0'}])
    assert.throws(()=>intersectSourceShapeExactRoundArcs(a,b));
  assert.throws(()=>intersectSourceShapeExactRoundArcs(a,{...a,afterSegment:1,scale2Exponent:1}),/scope/);
  assert.throws(()=>intersectSourceShapeExactRoundArcs(a,a),/scope/);
});
