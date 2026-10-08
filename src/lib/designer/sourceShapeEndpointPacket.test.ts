import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {boundSourceShapeEndpointNormals} from './sourceShapeEndpointGeometry.ts';
const base='output/qa/roll-labels-2026-10-06',target=base+'/endpoint-geometry-019';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const packet=read(target+'/endpoint-geometry.json'),previous=read(base+'/bounded-geometry-018/bounded-geometry.json');
test('endpoint supplement binds all135 inherited cases and459 freshly checked profiles without permission upgrade',()=>{
  assert.equal(packet.cases.length,135);assert.equal(packet.currentBindings.length,459);
  assert.equal(packet.sourcePacketSha256,createHash('sha256').update(fs.readFileSync(base+'/bounded-geometry-018/bounded-geometry.json')).digest('hex'));
  for(const c of packet.cases) {
    const old=previous.cases.find(n=>n.key===c.key);assert.equal(c.sourceShapeSha256,old.sourceShapeSha256);
    for(const side of ['bleed','safe']) {
      const g=c[side];assert.ok(g.totalWork<=g.maxWork);
      for(const b of g.branches) {
        assert.equal(old[side].branches[b.segment].reason,'stationary_native_endpoint');assert.equal(b.certificate.identityProved,true);
        if(b.status==='refused'){assert.equal(b.chords.length,0);assert.equal(b.reason,'offset_reverses_near_stationary_endpoint');}
        else {assert.equal(b.reason,null);assert.equal(b.chords[0].t0,0);assert.equal(b.chords.at(-1).t1,1);
          for(let i=0;i<b.chords.length;i++){const p=b.chords[i];assert.ok(p.maxErrorMm<=0.01);assert.ok(p.normalizedSpeedLower>0);assert.ok(p.derivativeCoefficientLower>0);if(i)assert.equal(p.t0,b.chords[i-1].t1);}}
      }
      for(const j of g.joins)assert.equal(old[side].joins[j.afterSegment].reason,'stationary_join_tangent');
      for(const key of ['sourceGeometryAccepted','designerAllowed','orderReady','globalOffsetTopologyProved','supplierJoinPolicyAccepted','scalingAuthorityProved'])assert.equal(g[key],false);
    }
  }
  for(const c of packet.currentBindings) {
    const old=previous.currentBindings.find(n=>n.profileKey===c.profileKey);
    for(const key of ['currentProfileSha256','sourceShapeSha256','proposalSha256','cutContractSha256'])assert.equal(c[key],old[key]);
    assert.equal(c.selectionCount,1);assert.equal(c.currentResolverChecks,1);assert.equal(c.inherited018SelectionCount,5);
    assert.equal(c.sourceGeometryAccepted,false);assert.equal(c.designerAllowed,false);assert.equal(c.orderReady,false);
  }
  for(const key of ['sourceGeometryAccepted','designerAllowed','orderReady','globalOffsetTopologyProved','supplierJoinPolicyAccepted','scalingAuthorityProved','fullCatalogueComplete','remoteWrites'])assert.equal(packet[key],false);
});
test('six representative source paths reproduce every normalized branch and join at both distances',()=>{
  for(const article of ['25016','25019','25021','25027','25034','25039']) {
    const old=previous.cases.find(c=>c.articleId===article&&c.widthMm===50&&c.heightMm===50),c=packet.cases.find(c=>c.key===old.key);
    assert.deepEqual(c.bleed,boundSourceShapeEndpointNormals(old.path,3));assert.deepEqual(c.safe,boundSourceShapeEndpointNormals(old.path,-3));
  }
});
test('all original and018 protected inputs rehash without mutation or source extraction',()=>{
  const inputs=read(target+'/input-integrity.json').inputs;assert.ok(inputs.length>578);
  for(const e of inputs)assert.equal(createHash('sha256').update(fs.readFileSync(e.path)).digest('hex'),e.sha256,e.path);
});
