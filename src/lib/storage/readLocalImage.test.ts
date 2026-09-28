import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocalImage } from './readLocalImage.ts';

test('loads selected image bytes before upload', async () => {
  const original = globalThis.FileReader;
  class Reader {
    result: ArrayBuffer | null = null;
    onload = () => {};
    onerror = () => {};
    onabort = () => {};
    async readAsArrayBuffer(file: File) {
      this.result = await file.arrayBuffer();
      this.onload();
    }
    abort() { this.onabort(); }
  }
  globalThis.FileReader = Reader as never;
  try {
    const selected = new File(['image bytes'], 'image.png', { type: 'image/png' });
    const local = await readLocalImage(selected, 100);
    assert.equal(local.name, selected.name);
    assert.equal(local.type, selected.type);
    assert.equal(await local.text(), 'image bytes');
  } finally { globalThis.FileReader = original; }
});

test('stalled cloud file read ends with an actionable error', async () => {
  const original = globalThis.FileReader;
  let aborted = false;
  class Reader {
    result = null;
    onload = () => {};
    onerror = () => {};
    onabort = () => {};
    readAsArrayBuffer() {}
    abort() { aborted = true; this.onabort(); }
  }
  globalThis.FileReader = Reader as never;
  try {
    await assert.rejects(readLocalImage(new File(['x'], 'cloud.png'), 5), /Hent den fra iCloud/);
    assert.equal(aborted, true);
  } finally { globalThis.FileReader = original; }
});
