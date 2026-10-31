import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const installerRequire = createRequire(require.resolve('@mapbox/node-pre-gyp'));
const tar = installerRequire('tar');

test('patched archive dependency preserves installer stream, promise and callback APIs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'webprinter-archive-test-'));
  try {
    await mkdir(path.join(root, 'input', 'Release'), { recursive: true });
    await mkdir(path.join(root, 'stream'));
    await mkdir(path.join(root, 'promise'));
    await writeFile(path.join(root, 'input', 'Release', 'fixture.txt'), 'archive fixture');
    const archive = path.join(root, 'fixture.tgz');
    await new Promise((resolve, reject) => tar.create({ file: archive, cwd: path.join(root, 'input'), gzip: true }, ['Release/fixture.txt'], error => error ? reject(error) : resolve()));
    let entries = 0;
    await pipeline(createReadStream(archive), tar.extract({ cwd: path.join(root, 'stream'), strip: 1, onentry() { entries++; } }));
    await tar.extract({ file: archive, cwd: path.join(root, 'promise'), strip: 1 });
    assert.equal(entries, 1);
    for (const directory of ['stream', 'promise']) assert.equal(await readFile(path.join(root, directory, 'fixture.txt'), 'utf8'), 'archive fixture');
  } finally { await rm(root, { recursive: true, force: true }); }
});
