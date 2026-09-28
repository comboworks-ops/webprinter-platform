import test from 'node:test';
import assert from 'node:assert/strict';
import { A4_FOLDER, A4_FOLDER_OUTSIDE_HASH, resolveFolderDefinition } from './folderDefinition.ts';
import { A4_FOLDER_BOTH_SIDES_HASH, resolveProductFolderPreview, hasProductFolderPreview, folderPreviewColor } from './productFolderPreview.ts';

test('product preview matches the reviewed selected print variant without changing artwork eligibility', () => {
  assert.deepEqual(resolveProductFolderPreview(A4_FOLDER_OUTSIDE_HASH), { definition: A4_FOLDER, print: '4+0' });
  assert.deepEqual(resolveProductFolderPreview(A4_FOLDER_BOTH_SIDES_HASH), { definition: A4_FOLDER, print: '4+4' });
  assert.equal(resolveFolderDefinition(A4_FOLDER_BOTH_SIDES_HASH, 494, 366), null);
  for (const hash of [null, '', 'unknown-a4', 'A4 5mm 4+4']) assert.equal(resolveProductFolderPreview(hash), null);
});
test('plain product colours use valid tenant colours and a blue fallback', () => {
  assert.equal(folderPreviewColor('#b21e76'), '#b21e76');
  assert.equal(folderPreviewColor('#ABC'), '#ABC');
  for (const value of [null, '', 'url(example)', '#nothex']) assert.equal(folderPreviewColor(value), '#0EA5E9');
});
test('reviewed template configuration maps exact selections regardless of product or tenant ID', () => {
  const selection = { templateFiles: [{ templatePdfSha256: A4_FOLDER_OUTSIDE_HASH }], selectedSectionValues: {
    'format-section': '3adc1463-2954-4029-8f6f-f1d0226b0727',
    'section-1775868111673': 'f4670208-0ecc-4bb7-a7d7-8d59a64a0dda',
    'print-mode-section': '743f9d6c-2d65-4aa3-ad63-c26cd56726e3',
  } };
  assert.equal(resolveProductFolderPreview(null, selection)?.print, '4+4');
  assert.equal(resolveProductFolderPreview(null, { ...selection, templateFiles: [] }), null);
  for (const key of Object.keys(selection.selectedSectionValues)) {
    // Even a stale known template must not override an incompatible selection.
    assert.equal(resolveProductFolderPreview(A4_FOLDER_OUTSIDE_HASH, { ...selection, selectedSectionValues: { ...selection.selectedSectionValues, [key]: null } }), null);
  }
  assert.equal(resolveProductFolderPreview(null, { ...selection, selectedSectionValues: { ...selection.selectedSectionValues, 'print-mode-section': '6ee575df-a3ab-46fd-911f-f73b3a8b3e92' } })?.print, '4+0');
  assert.ok(hasProductFolderPreview(null, selection));
});

test('master configuration survives product imports with new IDs and uses each product option schema', () => {
  const master = { id: 'master-product', tenant_id: 'webprinter', workspaceContent: { preview3d: {
    version: 1, variants: [
      { templateHash: A4_FOLDER_OUTSIDE_HASH, conditions: [{ sectionId: 'size', valueId: 'a4' }, { sectionId: 'spine', valueId: '1mm' }, { sectionId: 'print', valueId: 'outside' }] },
      { templateHash: A4_FOLDER_BOTH_SIDES_HASH, conditions: [{ sectionId: 'size', valueId: 'a4' }, { sectionId: 'spine', valueId: '1mm' }, { sectionId: 'print', valueId: 'both' }] },
    ],
  } } };
  for (const tenant of ['webprinter', 'salgsmapper', 'onlinetryksager']) {
    const imported = { ...structuredClone(master), id: `${tenant}-product`, tenant_id: tenant };
    // Import changes option identities. Store IDs as values (not object keys)
    // so the existing remap_jsonb_uuid_strings traversal carries every link.
    for (const variant of imported.workspaceContent.preview3d.variants) {
      variant.conditions = variant.conditions.map(({ sectionId, valueId }) => ({ sectionId: `${tenant}-${sectionId}`, valueId: `${tenant}-${valueId}` }));
    }
    const selectedSectionValues = { [`${tenant}-size`]: `${tenant}-a4`, [`${tenant}-spine`]: `${tenant}-1mm`, [`${tenant}-print`]: `${tenant}-both` };
    const selection = { workspaceContent: imported.workspaceContent, selectedSectionValues };
    assert.equal(resolveProductFolderPreview(null, selection)?.print, '4+4');
    assert.equal(resolveProductFolderPreview(A4_FOLDER_OUTSIDE_HASH, { ...selection, selectedSectionValues: { ...selectedSectionValues, [`${tenant}-spine`]: '5mm' } }), null);
    assert.equal(resolveFolderDefinition(A4_FOLDER_BOTH_SIDES_HASH, 494, 366), null);
  }
});

test('explicit disabled, invalid or ambiguous configurations cannot silently pick a model', () => {
  for (const config of [null, false, { version: 2, variants: [] }, { version: 1, variants: [] },
    { version: 1, variants: [{ templateHash: 'unknown', conditions: [] }] },
    { version: 1, variants: [{ templateHash: A4_FOLDER_OUTSIDE_HASH, conditions: [{ sectionId: 'size', valueId: 42 }] }] },
  ]) {
    const selection = { workspaceContent: { preview3d: config }, templateFiles: [{ templatePdfSha256: A4_FOLDER_OUTSIDE_HASH }] };
    assert.equal(resolveProductFolderPreview(A4_FOLDER_OUTSIDE_HASH, selection), null);
    assert.equal(hasProductFolderPreview(A4_FOLDER_OUTSIDE_HASH, selection), false);
  }
  assert.equal(resolveProductFolderPreview(A4_FOLDER_OUTSIDE_HASH, { workspaceContent: { preview3d: { version: 1, variants: [
    { templateHash: A4_FOLDER_OUTSIDE_HASH, conditions: [] }, { templateHash: A4_FOLDER_BOTH_SIDES_HASH, conditions: [] },
  ] } } }), null);
});

test('template-linked products share the model registry and unknown constructions stay unavailable', () => {
  assert.equal(hasProductFolderPreview(null, { templateFiles: [{ templatePdfSha256: A4_FOLDER_OUTSIDE_HASH }] }), true);
  assert.equal(resolveProductFolderPreview(null, { templateFiles: [{ templatePdfSha256: A4_FOLDER_OUTSIDE_HASH }] }), null);
  assert.equal(hasProductFolderPreview(null, { templateFiles: [{ name: 'A4 folder without flaps.pdf' }] }), false);
});
