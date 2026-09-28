import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAvailabilityAlternatives, resolveAvailabilityText, unavailableOptionAnchor } from './optionAvailability.ts';

const candidates = [
  { selections: { format: 'A4', fold: 'midter', pages: '4' } },
  { selections: { format: 'A4', fold: 'rulle', pages: '6' } },
  { selections: { format: 'A4', fold: 'zigzag', pages: '6' } },
  { selections: { format: 'A5', fold: 'zigzag', pages: '8' } },
];
const explain = (valueId: string) => getAvailabilityAlternatives({ candidates,
  currentSelections: { format: 'A4', fold: 'midter', pages: '4' }, sectionId: 'pages', valueId,
  constraintSectionIds: ['format', 'fold'], valueLabel: value => value, sectionLabel: section => section });

test('page alternatives explain either compatible fold without changing the selection', () => {
  assert.deepEqual(explain('6'), ['fold: rulle', 'fold: zigzag']);
});
test('a size and fold change stay together as one real combination', () => {
  assert.deepEqual(explain('8'), ['format: A5 + fold: zigzag']);
  assert.deepEqual(explain('10'), []);
});
test('incomplete and unrelated candidates cannot invent availability', () => {
  assert.deepEqual(getAvailabilityAlternatives({ candidates: [{ selections: { pages: '8', fold: 'zigzag' } }],
    currentSelections: { format: 'A4', fold: 'midter' }, sectionId: 'pages', valueId: '8',
    constraintSectionIds: ['format', 'fold'], valueLabel: value => value, sectionLabel: section => section }), []);
});
test('editable product tooltip defaults and individual overrides survive JSON persistence', () => {
  const tooltips = JSON.parse(JSON.stringify([{ anchor: 'unavailable_option', text: 'Om {option}' },
    { anchor: unavailableOptionAnchor('pages', '8'), text: 'Hjælp til {option}' }]));
  assert.equal(resolveAvailabilityText(tooltips, 'pages', '6', '6 sider'), 'Om 6 sider');
  assert.equal(resolveAvailabilityText(tooltips, 'pages', '8', '8 sider'), 'Hjælp til 8 sider');
  assert.match(resolveAvailabilityText([], 'pages', '4', '4 sider'), /4 sider/);
});
