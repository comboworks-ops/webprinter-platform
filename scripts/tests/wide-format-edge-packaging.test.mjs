import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PDFDocument } from 'pdf-lib';

// Vercel transpiles shared TypeScript into JavaScript before resolving imports.
// A frontend bundle alone accepts .ts specifiers and misses this deployment failure.
test('transpiled edge endpoint resolves its shared modules and serves exact PDF geometry', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const output = await mkdtemp(join(tmpdir(), 'wide-format-edge-'));
  try {
    await writeFile(join(output, 'package.json'), '{"type":"module"}');
    await symlink(join(root, 'node_modules'), join(output, 'node_modules'), 'dir');
    for (const path of ['api/wide-format-template.ts', 'src/lib/designer/generateWideFormatTemplate.ts', 'src/lib/designer/wideFormatGeometry.ts', 'src/lib/designer/gulvfolieShapes.ts']) {
      const source = await readFile(join(root, path), 'utf8');
      const { outputText } = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}});
      const destination = join(output, path.replace(/\.ts$/, '.js'));
      await mkdir(dirname(destination), {recursive:true});
      await writeFile(destination, outputText);
    }
    const { default: handler } = await import(pathToFileURL(resolve(output, 'api/wide-format-template.js')).href);
    const url = 'https://example.test/api/wide-format-template?v=1&shape=rectangle&widthMm=370&heightMm=610';
    const response = await handler(new Request(url));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPage(0);
    assert.ok(Math.abs(page.getWidth()*25.4/72-376) < 1e-7);
    assert.ok(Math.abs(page.getHeight()*25.4/72-616) < 1e-7);
    assert.equal((await handler(new Request(url.replace('shape=rectangle', 'shape=missing')))).status, 400);
    assert.equal((await handler(new Request(url, {method:'POST'}))).status, 405);
    const head = await handler(new Request(url, {method:'HEAD'}));
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  } finally { await rm(output, {recursive:true, force:true}); }
});
