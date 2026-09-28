import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashArtifactResponse, MAX_ARTWORK_BYTES} from './streamedArtifact.ts';

test('hashes a 1 GiB stream with bounded memory and the same native digest', async () => {
  const chunk = new Uint8Array(1024 * 1024);
  let count = 0;
  const expected = createHash('sha256');
  const stream = new ReadableStream({pull(controller) {
    if (count++ === 1024) {controller.close(); return;}
    expected.update(chunk); controller.enqueue(chunk);
  }});
  const result = await hashArtifactResponse(new Response(stream));
  assert.equal(result.size, MAX_ARTWORK_BYTES);
  assert.equal(result.sha256,expected.digest('hex'));
});
test('rejects a false Content-Length, overflow, empty bodies and unavailable files', async () => {
  await assert.rejects(hashArtifactResponse(new Response('12345'), 4), /too_large/);
  await assert.rejects(hashArtifactResponse(new Response('1',{headers:{'content-length':'5'}}), 4), /too_large/);
  await assert.rejects(hashArtifactResponse(new Response('')), /empty/);
  await assert.rejects(hashArtifactResponse(new Response('secret',{status:403})), /unavailable/);
});
