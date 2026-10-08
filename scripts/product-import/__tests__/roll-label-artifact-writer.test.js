import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRollLabelArtifactWriter} from '../shared/roll-label-artifact-writer.js';
const directory=()=>fs.mkdtempSync(path.join(os.tmpdir(),'roll-artifact-writer-050-'));
test('JSON key order/Unicode serialization changes preserve actual original bytes and mtime',()=>{
 const dir=directory(),file=path.join(dir,'family.json');
 const original=Buffer.from('{"b":"\\u00e6","a":1}\n');fs.writeFileSync(file,original);const time=fs.statSync(file).mtimeMs;
 const writer=createRollLabelArtifactWriter(dir);writer.stageJson('family.json',{a:1,b:'æ'});
 const receipt=writer.commit();assert.equal(receipt.changedCount,0);assert.ok(receipt.artifacts[0].preserved);
 assert.deepEqual(fs.readFileSync(file),original);assert.equal(fs.statSync(file).mtimeMs,time);
});
test('JSONL preservation keeps old exact bytes while real changed values are staged and atomically replaced',()=>{
 const dir=directory(),file=path.join(dir,'records.jsonl');
 const original=Buffer.from('{"b":2,"a":1}\n');fs.writeFileSync(file,original);
 const writer=createRollLabelArtifactWriter(dir);writer.stageJsonl('records.jsonl',[{a:1,b:2}]);assert.equal(writer.commit().changedCount,0);
 assert.deepEqual(fs.readFileSync(file),original);
 const changed=createRollLabelArtifactWriter(dir);changed.stageJsonl('records.jsonl',[{a:1,b:3}]);
 assert.deepEqual(fs.readFileSync(file),original);assert.equal(changed.commit({dryRun:true}).changedCount,1);
 assert.deepEqual(fs.readFileSync(file),original);assert.equal(changed.commit().changedCount,1);
 assert.deepEqual(JSON.parse(fs.readFileSync(file)),{a:1,b:3});
});
test('changed destinations, malformed previous JSON and escaped output paths fail before any staged write',()=>{
 const dir=directory(),a=path.join(dir,'a.json'),b=path.join(dir,'b.json');fs.writeFileSync(a,'{}');fs.writeFileSync(b,'{}');
 const writer=createRollLabelArtifactWriter(dir);writer.stageJson('a.json',{a:1});writer.stageJson('b.json',{b:1});
 fs.writeFileSync(b,'{"external":true}');assert.throws(()=>writer.commit(),/changed during preparation/);assert.equal(fs.readFileSync(a,'utf8'),'{}');
 assert.throws(()=>createRollLabelArtifactWriter(dir).stageJson('../escape.json',{}),/escaped/);
 fs.writeFileSync(a,'malformed');assert.throws(()=>createRollLabelArtifactWriter(dir).stageJson('a.json',{}));
 const fresh=createRollLabelArtifactWriter(dir);fresh.stageJson('new.json',{});fs.writeFileSync(path.join(dir,'new.json'),'{}');assert.throws(()=>fresh.commit());
});
