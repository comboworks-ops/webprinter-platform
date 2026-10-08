import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const archives = new Map();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
/** Packed source evidence retains exact original gzip bytes and relative paths.
 * Integrity failures must never be treated as a missing cache entry. */
export async function readPackedBrochureCapture(root, relative) {
  if (!relative.startsWith('raw/api/') || relative.split('/').includes('..')) return null;
  const key = path.resolve(root);
  if (!archives.has(key)) archives.set(key, (async () => {
    let indexBytes;
    try { indexBytes = await fs.readFile(path.join(key, 'raw/api-snapshots-index.json.gz')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    const index = JSON.parse(gunzipSync(indexBytes));
    if (index.archivePath !== 'raw/api-snapshots.tar.gz' || index.byteVerified !== true) throw new Error('Invalid brochure capture archive index');
    const compressed = await fs.readFile(path.join(key, index.archivePath));
    if (sha(compressed) !== index.archiveSha256 || compressed.length !== index.archiveBytes) throw new Error('Changed brochure capture archive');
    const tar = gunzipSync(compressed), files = new Map();
    for (let offset = 0; offset + 512 <= tar.length;) {
      const header = tar.subarray(offset, offset + 512);
      if (header.every(byte => byte === 0)) break;
      const name = header.toString('utf8', 0, 100).split('\0')[0];
      const size = parseInt(header.toString('ascii', 124, 136).replaceAll('\0', '').trim(), 8);
      if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length || !name.startsWith('raw/api/') || name.split('/').includes('..') || ![0,48].includes(header[156]) || files.has(name) || !index.files[name]) throw new Error('Invalid brochure capture archive member');
      files.set(name, tar.subarray(offset + 512, offset + 512 + size));
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    if (files.size !== index.fileCount || files.size !== Object.keys(index.files).length) throw new Error('Incomplete brochure capture archive');
    return { index, files };
  })());
  const archive = await archives.get(key);
  const bytes = archive?.files.get(relative);
  if (!bytes) return null;
  if (sha(bytes) !== archive.index.files[relative]) throw new Error('Changed brochure source capture');
  return bytes;
}
