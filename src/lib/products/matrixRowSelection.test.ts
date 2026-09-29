import assert from 'node:assert/strict';
import test from 'node:test';
import { withMatrixRowSelection } from './matrixRowSelection.ts';
import { resolveSelectedDesignerTemplateLaunch } from '../designer/productTemplateLinks.ts';
const axis = { sectionId: 'paper', valueIds: ['chromo', 'silk'] };
const names = (id: string) => id === 'silk' ? '350g mat silk-papir' : 'Chromo-karton til mapper';

test('automatic soft-touch row change emits the priced silk template selection', () => {
  const oldSelection = { format: 'a6', print: '4+0', finish: 'soft-touch', paper: 'chromo' };
  const template = { name: 'A6.pdf', url: 'https://example.test/a6-soft-touch.pdf', selectionConstraints: { ...oldSelection, paper: 'silk' } };
  assert.equal(resolveSelectedDesignerTemplateLaunch({ templates: [template], selectedSectionValues: oldSelection }), null);
  const selected = withMatrixRowSelection(oldSelection, axis, '350g mat silk-papir', names);
  assert.equal(resolveSelectedDesignerTemplateLaunch({ templates: [template], selectedSectionValues: selected })?.pdfUrl, template.url);
  assert.equal(oldSelection.paper, 'chromo');
  assert.equal(selected.finish, 'soft-touch');
});
test('direct row IDs and unchanged rows preserve selection identity', () => {
  const selected = { paper: 'silk', spine: '5mm' };
  assert.equal(withMatrixRowSelection(selected, axis, 'silk', names), selected);
  assert.equal(withMatrixRowSelection(selected, axis, '350g mat silk-papir', names), selected);
  assert.equal(withMatrixRowSelection(selected, axis, null, names), selected);
});
test('unknown or ambiguous row labels cannot retain a stale paper template', () => {
  assert.equal(withMatrixRowSelection({ paper: 'chromo' }, axis, 'Missing', names).paper, null);
  assert.equal(withMatrixRowSelection({ paper: 'chromo' }, axis, 'Same', () => 'Same').paper, null);
});
