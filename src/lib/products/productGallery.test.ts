import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galleryMatrixSelections, gallerySelectionKey, matchProductGallery, readProductGallery, type ProductGalleryImage } from './productGallery.ts';
import { prepareWorkspaceSave, readWorkspaceDraft } from './productWorkspace.ts';
const images: ProductGalleryImage[] = [
  { id: 'paper', url: '/paper.png', alt: 'Materialeprøve', conditions: [] },
  { id: 'a4', url: '/a4.png', alt: 'A4', conditions: [{ sectionId: 'format', valueId: 'a4' }] },
  { id: 'inside', url: '/inside.png', alt: 'A4 med tryk indvendigt', conditions: [{ sectionId: 'format', valueId: 'a4' }, { sectionId: 'print', valueId: '4+4' }] },
  { id: 'fold', url: '/fold.png', alt: 'A6 midtfalset', conditions: [{ sectionId: 'format', valueId: 'a6' }, { sectionId: 'fold', valueId: 'midtfalset' }] },
];
test('matrix material row overrides stale selector state without mutating it', () => {
  const selected = { format: 'a4', paper: 'silk' };
  const axis = { sectionId: 'paper', valueIds: ['silk', 'chromo'], valueSettings: { chromo: { displayName: 'Chromo-karton' } } };
  assert.deepEqual(galleryMatrixSelections(selected, axis, 'Chromo-karton', { silk: 'Silk', chromo: 'Original' }), { format: 'a4', paper: 'chromo' });
  assert.equal(selected.paper, 'silk');
  assert.equal(galleryMatrixSelections(selected, axis, 'unknown', {}).paper, null);
  assert.equal(galleryMatrixSelections(selected, axis, 'chromo', {}).paper, 'chromo');
});
test('specific combinations take priority and require every exact section/value pair', () => {
  assert.equal(matchProductGallery(images, { format: 'a4' })?.id, 'a4');
  assert.equal(matchProductGallery(images, { format: 'a4', print: '4+4' })?.id, 'inside');
  assert.equal(matchProductGallery(images, { format: 'a4', print: '4+0' })?.id, 'a4');
  assert.equal(matchProductGallery(images, { format: 'a6', fold: 'midtfalset' })?.id, 'fold');
  assert.equal(matchProductGallery(images, { format: 'a6', fold: null }), undefined);
  assert.equal(matchProductGallery(images, { unrelated: 'a4' }), undefined);
});
test('equal specificity uses configured order, empty rules and invalid URLs never match', () => {
  const duplicate = { ...images[1], id: 'other' };
  assert.equal(matchProductGallery([duplicate, ...images], { format: 'a4' })?.id, 'other');
  assert.equal(matchProductGallery([{ ...images[1], url: 'javascript:alert(1)' }], { format: 'a4' }), undefined);
  assert.equal(matchProductGallery([{ ...images[1], conditions: [{ sectionId: '', valueId: '' }] }], { '': '' }), undefined);
});
test('legacy images remain compatible and explicit empty gallery removes them', () => {
  assert.deepEqual(readProductGallery({ images: ['/one.png'] }), [{ id: 'legacy-0', url: '/one.png', alt: '', conditions: [] }]);
  assert.deepEqual(readProductGallery({ images: ['/one.png'], gallery: [] }), []);
  assert.deepEqual(readProductGallery({ gallery: [null, { id: 'broken', url: '/x.png' }] }), []);
});
test('thumbnail reset key follows actual choices, not allocation or ordering', () => {
  assert.equal(gallerySelectionKey({ format: 'a4', print: '4+4' }), gallerySelectionKey({ print: '4+4', format: 'a4', unused: null }));
  assert.notEqual(gallerySelectionKey({ format: 'a4' }), gallerySelectionKey({ format: 'a6' }));
});
test('gallery survives draft reload and apply without changing pricing, supplier fields or original content', () => {
  const initial = { mode: 'matrix_layout_v1', vertical_axis: { sectionId: 'format', valueIds: ['a4'] }, layout_rows: [], quantities: [100, 500], supplier: { id: 'fixed' }, workspaceContent: { description: 'Original' } };
  const candidate = { ...initial, workspaceContent: { ...initial.workspaceContent, gallery: images } };
  const saved = prepareWorkspaceSave(initial, initial, candidate, false);
  assert.equal(saved.workspaceContent.gallery, undefined);
  assert.deepEqual(readProductGallery(readWorkspaceDraft(saved).structure.workspaceContent), images);
  const applied = prepareWorkspaceSave(saved, saved, readWorkspaceDraft(saved).structure, true);
  assert.deepEqual(readProductGallery(applied.workspaceContent), images);
  assert.deepEqual(applied.quantities, initial.quantities);
  assert.deepEqual(applied.supplier, initial.supplier);
  assert.equal(applied.workspaceContent.description, 'Original');
});
