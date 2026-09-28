import type { ExactCombinationCandidate, ExactCombinationSelection } from '../pricing/exactCombinationResolver';

export const UNAVAILABLE_OPTION_ANCHOR = 'unavailable_option';
export const unavailableOptionAnchor = (sectionId: string, valueId: string) =>
  `${UNAVAILABLE_OPTION_ANCHOR}:${sectionId}:${valueId}`;

export interface AvailabilityTooltipText { anchor: string; text: string }

export function resolveAvailabilityText(tooltips: AvailabilityTooltipText[], sectionId: string, valueId: string, option: string) {
  const text = tooltips.find(item => item.anchor === unavailableOptionAnchor(sectionId, valueId))?.text
    || tooltips.find(item => item.anchor === UNAVAILABLE_OPTION_ANCHOR)?.text
    || '{option} er ikke tilgængelig med dine nuværende valg.';
  return text.split('{option}').join(option);
}

/** Each alternative is one real combination, never a mix of different rows. */
export function getAvailabilityAlternatives({ candidates, currentSelections, sectionId, valueId, constraintSectionIds, valueLabel, sectionLabel }: {
  candidates: ExactCombinationCandidate[];
  currentSelections: ExactCombinationSelection;
  sectionId: string;
  valueId: string;
  constraintSectionIds: string[];
  valueLabel: (valueId: string, sectionId: string) => string;
  sectionLabel: (sectionId: string) => string;
}): string[] {
  let minimum = Infinity;
  const alternatives = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.selections[sectionId] !== valueId) continue;
    const constraints = constraintSectionIds.filter(id => id !== sectionId && currentSelections[id]);
    // Incomplete rows cannot substantiate an activation instruction.
    if (constraints.some(id => !candidate.selections[id])) continue;
    const changed = constraints.filter(id => candidate.selections[id] !== currentSelections[id]);
    if (!changed.length || changed.length > minimum) continue;
    if (changed.length < minimum) { minimum = changed.length; alternatives.clear(); }
    alternatives.add(changed.map(id => `${sectionLabel(id)}: ${valueLabel(candidate.selections[id]!, id)}`).join(' + '));
  }
  return Array.from(alternatives).sort((a, b) => a.localeCompare(b, 'da')).slice(0, 4);
}
