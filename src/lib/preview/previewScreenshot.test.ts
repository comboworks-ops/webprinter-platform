import assert from 'node:assert/strict';
import test from 'node:test';
import { requestPreviewScreenshot } from './previewScreenshot.ts';

function fixture() {
  const listeners = new Set<(event: MessageEvent) => void>();
  const requests: Array<{ type: string; requestId: string }> = [];
  const host = {
    addEventListener(_type: string, listener: (event: MessageEvent) => void) { listeners.add(listener); },
    removeEventListener(_type: string, listener: (event: MessageEvent) => void) { listeners.delete(listener); },
  };
  const target = { postMessage(data: { type: string; requestId: string }, origin: string) {
    assert.equal(origin, 'https://editor.test'); requests.push(data);
  } };
  const emit = (data: unknown, source: unknown = target, origin = 'https://editor.test') => {
    listeners.forEach(listener => listener({ data, source, origin } as MessageEvent));
  };
  return { host, target, requests, emit, listeners };
}

test('thumbnail completion requires the originating frame, origin and exact request', async () => {
  const f = fixture();
  const pending = requestPreviewScreenshot({ ...f, origin: 'https://editor.test', timeoutMs: 200 });
  const data = { type: 'SCREENSHOT_CAPTURED', requestId: f.requests[0].requestId, dataUrl: 'data:image/jpeg;base64,YQ==' };
  f.emit(data, {}, 'https://editor.test');
  f.emit(data, f.target, 'https://other.test');
  f.emit({ ...data, requestId: 'old-request' });
  assert.equal(f.listeners.size, 1);
  f.emit(data);
  assert.equal(await pending, data.dataUrl);
  assert.equal(f.listeners.size, 0);
});

test('an earlier timeout cannot finish another editor or a later capture', async () => {
  const f = fixture();
  const first = requestPreviewScreenshot({ ...f, origin: 'https://editor.test', timeoutMs: 5 });
  const second = requestPreviewScreenshot({ ...f, origin: 'https://editor.test', timeoutMs: 200 });
  assert.equal(await first, null);
  assert.equal(f.listeners.size, 1);
  f.emit({ type: 'SCREENSHOT_CAPTURED', requestId: f.requests[0].requestId, dataUrl: 'data:image/jpeg;base64,YQ==' });
  assert.equal(f.listeners.size, 1);
  f.emit({ type: 'SCREENSHOT_CAPTURED', requestId: f.requests[1].requestId, dataUrl: 'data:image/jpeg;base64,Yg==' });
  assert.equal(await second, 'data:image/jpeg;base64,Yg==');
  assert.equal(f.listeners.size, 0);
});

test('capture errors and unexpected URLs fail without exposing a fetch destination', async () => {
  for (const data of [{ type: 'SCREENSHOT_ERROR' }, { type: 'SCREENSHOT_CAPTURED', dataUrl: 'https://other.test/private' }, { type: 'SCREENSHOT_CAPTURED', dataUrl: 'data:text/html;base64,YQ==' }]) {
    const f = fixture();
    const pending = requestPreviewScreenshot({ ...f, origin: 'https://editor.test', timeoutMs: 200 });
    f.emit({ ...data, requestId: f.requests[0].requestId });
    assert.equal(await pending, null);
    assert.equal(f.listeners.size, 0);
  }
});
