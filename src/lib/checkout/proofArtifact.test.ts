import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresProofExport, proofArtifactFingerprint, primaryProductionFiles, type ProofArtifactInput } from './proofArtifact.ts';
const pdf: ProofArtifactInput = { fileUrl: 'https://storage.test/a.pdf', filePath: 'order-files/a.pdf', sha256: 'a'.repeat(64), fileType: 'pdf', designerExport: false,
  physicalWidthMm: 216, physicalHeightMm: 303, targetWidthMm: 216, targetHeightMm: 303, scale: 100, offsetX: 0, offsetY: 0 };
test('unchanged production-sized PDF can be approved directly', () => assert.equal(requiresProofExport(pdf), false));
test('drag, scale, source resize and raster placement require baked production export', () => {
  for (const change of [{ sha256: '' }, { offsetX: 1 }, { offsetY: -1 }, { scale: 110 }, { physicalWidthMm: 210 }, { fileType: 'image' as const }, { scale: NaN }]) {
    assert.equal(requiresProofExport({ ...pdf, ...change }), true);
  }
});
test('designer output remains valid only while placement is unchanged', () => {
  assert.equal(requiresProofExport({ ...pdf, fileType: 'image', designerExport: true }), false);
  assert.equal(requiresProofExport({ ...pdf, designerExport: true, offsetY: 2 }), true);
});
test('file replacement and every placement/size change invalidate approval identity', () => {
  for (const change of [{ fileUrl: 'https://storage.test/b.pdf' }, { filePath: 'order-files/b.pdf' }, { targetWidthMm: 300 }, { scale: 120 }, { offsetX: 2 }, { offsetY: 3 }]) {
    assert.notEqual(proofArtifactFingerprint(pdf), proofArtifactFingerprint({ ...pdf, ...change }));
  }
});
test('apparel alternate PNG cannot displace its explicitly primary production PDF', () => {
  const files = [{ name: 'front.png', isPrimary: false }, { name: 'front.pdf', isPrimary: true }];
  assert.deepEqual(primaryProductionFiles(files).map(file => file.name), ['front.pdf', 'front.png']);
  assert.equal(files[0].name, 'front.png');
});
