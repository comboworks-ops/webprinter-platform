import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashCheckoutArtifact} from './checkoutArtifact.ts';

test('hashes exact bytes across chunk boundaries without reading the whole file', async () => {
  const bytes = new Uint8Array(5 * 1024 * 1024 + 19).map((_, i) => i % 251);
  const file = new Blob([bytes]);
  file.arrayBuffer = () => { throw new Error('whole-file allocation'); };
  const progress: number[] = [];
  assert.equal(await hashCheckoutArtifact(file, n => progress.push(n)), createHash('sha256').update(bytes).digest('hex'));
  assert.equal(progress.at(-1), file.size);
  assert.equal(progress.length, 3);
});
