import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadCheckoutFile } from './privateUploads.ts';

test('checkout uses a signed private upload when the feature flag is absent', async () => {
  const previousStorage = globalThis.sessionStorage;
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { setItem: (key: string, value: string) => saved.set(key, value) },
  });
  let allocated = 0;
  let signedUploads = 0;
  let directUploads = 0;
  const client = {
    functions: {
      invoke: async (_name: string, { body }: { body: { action: string; id: string } }) => {
        if (body.action === 'allocate') {
          allocated++;
          return { data: { id: body.id, path: `checkout-uploads/${body.id}.pdf`, token: 'signed' }, error: null };
        }
        return { data: null, error: new Error('stop after signed upload') };
      },
    },
    storage: {
      from: () => ({
        upload: async () => { directUploads++; return { error: null }; },
        uploadToSignedUrl: async () => { signedUploads++; return { error: null }; },
      }),
    },
  };
  try {
    await assert.rejects(
      uploadCheckoutFile(client as never, 'tenant-id', new Blob(['print'], { type: 'application/pdf' }), 'print.pdf', 'order-files/legacy.pdf'),
      /Uploaden kunne ikke bekræftes/,
    );
    assert.equal(allocated, 1);
    assert.equal(signedUploads, 1);
    assert.equal(directUploads, 0);
    assert.equal(saved.size, 1);
  } finally {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: previousStorage });
  }
});
