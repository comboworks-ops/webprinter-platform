import {createHash} from 'node:crypto';

export const MAX_ARTWORK_BYTES = 1024 * 1024 * 1024;

/** Hash original bytes with native SHA-256, retaining only the current network chunk. */
export async function hashArtifactResponse(response: Response, maxBytes = MAX_ARTWORK_BYTES) {
  if (!response.ok || !response.body) throw new Error('checkout_artifact_unavailable');
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body.cancel();
    throw new Error('checkout_artifact_too_large');
  }
  const reader = response.body.getReader();
  const hash = createHash('sha256');
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('checkout_artifact_too_large');
      hash.update(value);
    }
    if (!size) throw new Error('checkout_artifact_empty');
    return {size, sha256: hash.digest('hex')};
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
