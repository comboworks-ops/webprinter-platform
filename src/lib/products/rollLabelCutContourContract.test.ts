import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readRollLabelCutContourContract,rollLabelCutContourInstructions} from './rollLabelCutContourContract.ts';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06/';
const family=JSON.parse(fs.readFileSync(base+'review/families/25143.json','utf8'));
const packet=JSON.parse(fs.readFileSync(base+'source-cut-contour-contracts.json','utf8'));
test('all459 source-bound special profiles retain exact production requirements and closed geometry/Designer/order gates',()=>{
 assert.equal(packet.contracts.length,459);
 for(const c of packet.contracts){const profile=family.profiles.find(p=>p.key===c.profileKey);
  assert.deepEqual(readRollLabelCutContourContract(profile,'25143',c),c);
  assert.deepEqual(profile.cutContourContract,c);
  assert.deepEqual(rollLabelCutContourInstructions(profile,'25143'),[
    'Læg skærelinjen på et separat lag med særfarven “Cutkontur”.',
    'Brug 100 % magenta og 100 % farvetone til skærelinjen.',
    'Linjen skal være 0,25 pt og stå til overtryk (overprint).']);
  assert.equal(c.geometryVerified,false);assert.equal(c.onlineDesignerVerified,false);assert.equal(c.orderReady,false);
 }
});
test('foreign profile/family, changed material evidence or requirements and any enabled gate are rejected',()=>{
 const c=packet.contracts[0],profile=family.profiles.find(p=>p.key===c.profileKey);
 for(const changed of [{profileKey:'foreign'},{familyId:'20649'},{sourceEvidenceSha256:'f'.repeat(64)},
   {requirements:{...c.requirements,spotName:'CutContour'}},{requirements:{...c.requirements,lineWidthPt:1}},
   {guideSha256:''},{guideTextSha256:''},{geometryVerified:true},{onlineDesignerVerified:true},{orderReady:true}]){
  assert.equal(readRollLabelCutContourContract(profile,'25143',{...c,...changed}),null);
 }
 assert.equal(readRollLabelCutContourContract(profile,'20649',c),null);
 assert.equal(readRollLabelCutContourContract({...profile,sourceMaterialId:'foreign'},'25143',c),null);
 assert.equal(readRollLabelCutContourContract({...profile,format:{...profile.format,shape:'rectangle'}},'25143',c),null);
});
