import test from 'node:test';
import assert from 'node:assert/strict';
import {intersectSourceShapeExactLineArc,signSourceShapeNestedRadical} from './sourceShapeLineArcContacts';
import type {ExactOffsetLine} from './sourceShapeLineContacts';
import type {ExactRoundArc} from './sourceShapeArcContacts';
const line=(normalSign:1|-1=1):ExactOffsetLine=>({segment:0,origin:['0','0'],direction:['4','0'],radius:'1',normalSign,scale2Exponent:0});
const arc=(center:[string,string]):ExactRoundArc=>({afterSegment:0,center,radius:'1',startDirection:['0','-1'],endDirection:['1','1'],sweep:1,scale2Exponent:0,incomingLeadingOrder:1,outgoingLeadingOrder:1});
test('nested-radical signs retain exact cancellation and tiny differences',()=>{
  assert.equal(signSourceShapeNestedRadical(-1n,1n,2n,-1n,3n,-2n),0);
  assert.equal(signSourceShapeNestedRadical(1n,-1n,2n,1n,3n,-2n),0);
  assert.equal(signSourceShapeNestedRadical(-3n,0n,2n,1n,8n,0n),-1);
  assert.equal(signSourceShapeNestedRadical(-(1n<<1000n),0n,2n,1n,(1n<<2000n)+1n,0n),1);
  assert.throws(()=>signSourceShapeNestedRadical(0n,0n,2n,1n,-1n,0n),/Negative/);
});
test('both line-circle roots survive while the exact native arc selects one contact',()=>{
  const result=intersectSourceShapeExactLineArc(line(),arc(['2','-1']));
  assert.equal(result.relation,'two_line_circle_support_roots');assert.equal(result.contactCount,1);
  assert.deepEqual(result.roots.map(r=>r.rootSign),[-1,1]);
  assert.deepEqual(result.roots.map(r=>r.contact),[false,true]);
  assert.ok(result.roots.every(r=>r.onLine.startSign===1&&r.onLine.endSign===-1));
});
test('native circle tangent at a closed line endpoint is one exact root',()=>{
  const result=intersectSourceShapeExactLineArc(line(),arc(['0','0']));
  assert.equal(result.relation,'tangent_line_circle_support');assert.equal(result.contactCount,1);
  assert.equal(result.roots.length,1);assert.equal(result.roots[0].onLine.startSign,0);
  assert.equal(result.roots[0].onArc.startSign,0);
});
test('real support roots outside the finite line remain explicit noncontacts',()=>{
  const result=intersectSourceShapeExactLineArc(line(),arc(['8','0']));
  assert.equal(result.relation,'tangent_line_circle_support');assert.equal(result.contactCount,0);
  assert.equal(result.roots[0].onLine.endSign,1);
});
test('distinct supports and reversed offset normals are classified exactly',()=>{
  assert.equal(intersectSourceShapeExactLineArc(line(),arc(['0','2'])).relation,'no_real_line_circle_root');
  const result=intersectSourceShapeExactLineArc(line(-1),arc(['2','1']));
  assert.equal(result.contactCount,1);assert.equal(result.roots.length,2);
});
test('foreign scales/radii, nonminor sectors and collapsed lines refuse',()=>{
  assert.throws(()=>intersectSourceShapeExactLineArc(line(),{...arc(['0','0']),radius:'2'}),/scope/);
  assert.throws(()=>intersectSourceShapeExactLineArc(line(),{...arc(['0','0']),scale2Exponent:-1}),/scope/);
  assert.throws(()=>intersectSourceShapeExactLineArc({...line(),direction:['0','0']},arc(['0','0'])),/Collapsed/);
  assert.throws(()=>intersectSourceShapeExactLineArc(line(),{...arc(['0','0']),endDirection:['0','1']}),/minor/);
});
