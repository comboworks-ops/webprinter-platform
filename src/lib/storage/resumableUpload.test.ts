import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumableUpload, storageUploadEndpoint} from './resumableUpload.ts';

test('uses the direct Storage hostname and preserves local/custom hosts', () => {
  assert.equal(storageUploadEndpoint('https://example.supabase.co'), 'https://example.storage.supabase.co/storage/v1/upload/resumable');
  assert.equal(storageUploadEndpoint('http://127.0.0.1:54321'), 'http://127.0.0.1:54321/storage/v1/upload/resumable');
  assert.equal(storageUploadEndpoint('https://storage.example.test?discard=true'), 'https://storage.example.test/storage/v1/upload/resumable');
});
test('an already cancelled upload never starts a network request', async () => {
  await assert.rejects(resumableUpload({supabaseUrl:'http://127.0.0.1:1',bucket:'order-files',path:'cancelled.pdf',
    file:new Blob(['test']),headers:{},signal:AbortSignal.abort()}), error => error instanceof DOMException && error.name==='AbortError');
});
