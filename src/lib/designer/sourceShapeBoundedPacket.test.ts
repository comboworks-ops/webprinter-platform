import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {boundSourceShapeTopology,boundSourceShapeOffset} from './sourceShapeBoundedGeometry.ts';
import {sourceShapeMetrics,type SourceShapeSegment} from './sourceShapeReviewGeometry.ts';
const base='output/qa/roll-labels-2026-10-06/bounded-geometry-018';
const packet=JSON.parse(fs.readFileSync(base+'/bounded-geometry.json','utf8'));
const previous=JSON.parse(fs.readFileSync('output/qa/roll-labels-2026-10-06/special-shapes-017/special-shape-proposals.json','utf8'));
test('all native source loops reproduce exact topology results while every source/Designer/order gate stays false',()=>{
  assert.equal(packet.counts.articles,27);assert.equal(packet.counts.profiles,459);assert.equal(packet.cases.length,135);
  assert.equal(packet.currentBindings.length,459);
  for(const m of previous.models) {
    const current=packet.nativeTopology.find(c=>c.articleId===m.articleId);
    assert.equal(current.sourceShapeSha256,m.sha256);assert.deepEqual(current.topology,boundSourceShapeTopology(m.templateNativePath));
    assert.equal(m.scalingAuthorityProved,false);assert.equal(m.offsetAuthorityProved,false);assert.equal(m.sourceGeometryAccepted,false);
  }
  for(const c of packet.currentBindings) {
    const prior=previous.proposals.find(p=>p.profileKey===c.profileKey);
    assert.equal(c.currentProfileSha256,prior.currentProfileSha256);assert.equal(c.sourceShapeSha256,prior.sourceShapeSha256);
    assert.equal(c.proposalSha256,prior.sha256);assert.equal(c.cutContractSha256,prior.cutContractSha256);
    assert.equal(c.diagnosticKeys.length,5);assert.ok(c.diagnosticKeys.every(k=>packet.cases.some(c=>c.key===k)));
    assert.equal(c.sourceGeometryAccepted,false);assert.equal(c.designerAllowed,false);assert.equal(c.orderReady,false);
  }
  for(const key of ['scalingAuthorityProved','supplierJoinPolicyAccepted','globalOffsetTopologyProved','sourceGeometryAccepted','designerAllowed','orderReady','fullCatalogueComplete','catalogueRegenerated','remoteWrites'])assert.equal(packet[key],false);
});
function sample(s:SourceShapeSegment,t:number,d:number,sign:number) {
  const p=s.pointsPt,u=1-t;
  const pos=p[0].map((v,k)=>p.length===2?u*v+t*p[1][k]:u**3*v+3*u*u*t*p[1][k]+3*u*t*t*p[2][k]+t**3*p[3][k]);
  const v=p[0].map((n,k)=>p.length===2?p[1][k]-n:3*(u*u*(p[1][k]-n)+2*u*t*(p[2][k]-p[1][k])+t*t*(p[3][k]-p[2][k])));
  const speed=Math.hypot(...v);return [pos[0]+sign*d*v[1]/speed,pos[1]-sign*d*v[0]/speed];
}
test('every bounded chord in135 hypothetical cases contains independent normal evaluations; refused pieces are never bridged',()=>{
  let chordCount=0,samples=0,maxResidualMm=0;
  for(const c of packet.cases) {
    const sign=Math.sign(sourceShapeMetrics(c.path).signedArea);
    for(const g of [c.bleed,c.safe]) {
      assert.equal(g.sourceGeometryAccepted,false);assert.equal(g.designerAllowed,false);assert.equal(g.orderReady,false);
      assert.equal(g.globalOffsetTopologyProved,false);assert.equal(g.supplierJoinPolicyAccepted,false);assert.ok(g.totalWork<=g.maxWork);
      assert.equal(g.allBranchesBounded,g.branches.every(b=>b.status==='bounded_normal_branch'));
      assert.equal(g.allJoinsConstructed,g.joins.every(j=>j.kind!=='refused'));
      for(const b of g.branches) {
        if(b.status==='refused'){assert.equal(b.chords.length,0);assert.ok(b.reason);continue;}
        assert.equal(b.reason,null);assert.equal(b.chords[0].t0,0);assert.equal(b.chords.at(-1).t1,1);
        let end=0;
        for(const chord of b.chords) {
          chordCount++;assert.equal(chord.t0,end);end=chord.t1;
          assert.ok(chord.maxErrorMm<=0.01);assert.ok(chord.regularFactorLower>0);
          for(let i=0;i<=8;i++) {
            samples++;const fraction=i/8,t=chord.t0+(chord.t1-chord.t0)*fraction,p=sample(c.path[b.segment],t,g.signedDistanceMm,sign);
            const q=chord.start.map((v,k)=>v+(chord.end[k]-v)*fraction),error=Math.hypot(p[0]-q[0],p[1]-q[1]);
            maxResidualMm=Math.max(maxResidualMm,error);
            // Independent double evaluation is a numerical witness, separate
            // from the outward-rounded analytic bound and exact topology.
            assert.ok(error<=chord.maxErrorMm+1e-10);
          }
        }
      }
      for(const j of g.joins) {
        if(j.kind==='refused'){assert.ok(j.reason);assert.equal(j.start,null);assert.equal(j.end,null);continue;}
        assert.equal(j.reason,null);assert.ok(j.endpointErrorMm<1e-9);
        for(const p of [j.start,j.end])assert.ok(Math.abs(Math.hypot(p[0]-j.center[0],p[1]-j.center[1])-3)<=j.endpointErrorMm+1e-10);
      }
    }
  }
  assert.equal(chordCount,packet.counts.boundedChords);assert.equal(samples,chordCount*9);assert.ok(maxResidualMm<0.01);
  console.log(JSON.stringify({independentNormalSamples:samples,maxResidualMm,boundedChords:chordCount}));
});
test('representative source cases independently reproduce both complete and refused branch/join constructions',()=>{
  for(const article of ['25011','25016','25019','25024','25034','25039']) {
    const c=packet.cases.find(c=>c.articleId===article&&c.widthMm===50&&c.heightMm===50);
    assert.deepEqual(c.topology,boundSourceShapeTopology(c.path));
    assert.deepEqual(c.bleed,boundSourceShapeOffset(c.path,3));assert.deepEqual(c.safe,boundSourceShapeOffset(c.path,-3));
  }
});
test('all protected inputs remain byte-identical at new packet readback without repeating PDF extraction',()=>{
  const entries=JSON.parse(fs.readFileSync(base+'/input-integrity.json','utf8')).inputs;
  for(const e of entries)assert.equal(createHash('sha256').update(fs.readFileSync(e.path)).digest('hex'),e.sha256,e.path);
});
