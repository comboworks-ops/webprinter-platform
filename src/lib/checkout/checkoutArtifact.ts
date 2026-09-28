/** Hash the exact bytes approved for production. Server verifies before payment. */
export async function hashCheckoutArtifact(file: Blob, onProgress?: (loaded: number) => void): Promise<string> {
  const {createSHA256} = await import('hash-wasm');
  const hash = await createSHA256();
  hash.init();
  const chunkSize = 2 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    hash.update(new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer()));
    onProgress?.(Math.min(offset + chunkSize, file.size));
  }
  return hash.digest('hex');
}
