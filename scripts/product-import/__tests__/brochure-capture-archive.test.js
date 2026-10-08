import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readPackedBrochureCapture } from '../shared/brochure-capture-archive.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(corrupt = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'brochure-archive-test-'));
  await fs.mkdir(path.join(root,'raw'));
  const name='raw/api/973/42/options.json.gz', bytes=gzipSync('native supplier response');
  const header=Buffer.alloc(512);header.write(name);header.write(bytes.length.toString(8).padStart(11,'0'),124);header[156]=48;
  const archive=gzipSync(Buffer.concat([header,bytes,Buffer.alloc((512-bytes.length%512)%512),Buffer.alloc(1024)]));
  const index={archivePath:'raw/api-snapshots.tar.gz',archiveSha256:sha(archive),archiveBytes:archive.length,byteVerified:true,fileCount:1,files:{[name]:sha(bytes)}};
  await fs.writeFile(path.join(root,index.archivePath),corrupt?Buffer.concat([archive,Buffer.from('changed')]):archive);
  await fs.writeFile(path.join(root,'raw/api-snapshots-index.json.gz'),gzipSync(JSON.stringify(index)));
  return {root,name,bytes};
}
test('packed source snapshots retain the exact gzip bytes and reject traversal',async()=>{
  const f=await fixture();try{assert.deepEqual(await readPackedBrochureCapture(f.root,f.name),f.bytes);assert.equal(await readPackedBrochureCapture(f.root,'raw/api/../secret'),null);assert.equal(await readPackedBrochureCapture(f.root,'raw/api/missing'),null);}finally{await fs.rm(f.root,{recursive:true,force:true});}
});
test('changed evidence fails closed instead of silently fetching a replacement',async()=>{
  const f=await fixture(true);try{await assert.rejects(readPackedBrochureCapture(f.root,f.name),/Changed brochure capture archive/);}finally{await fs.rm(f.root,{recursive:true,force:true});}
});
