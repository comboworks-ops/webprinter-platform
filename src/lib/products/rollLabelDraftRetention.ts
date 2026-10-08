import { rollLabelInitialDraft, type RollLabelConfigurationDraft } from './rollLabelConfiguration';
import type { RollLabelReviewProfile } from './rollLabelReview';

/** Retain customer inputs, never a foreign price/profile identity. An option
 * state transfers only when the complete source vector exists in the new profile. */
export function rollLabelDraftForProfileChange(profile: RollLabelReviewProfile, previous: RollLabelReviewProfile, draft: RollLabelConfigurationDraft) {
  const next = rollLabelInitialDraft(profile);
  next.dimensions = { ...draft.dimensions };
  const range = profile.quantityInputs.find(input => input.name === 'menge');
  if (range || profile.sourceQuantities.includes(Number(draft.quantity))) next.quantity = draft.quantity;
  if (profile.format.motifCount === previous.format.motifCount) next.allocations = [...draft.allocations];
  const oldState = previous.optionStates?.states.find(state => state.id === draft.optionStateId);
  if (oldState) {
    const matches = profile.optionStates?.states.filter(state => Object.keys(state.options).length === Object.keys(oldState.options).length
      && Object.entries(oldState.options).every(([key,value]) => state.options[key] === value));
    if (matches?.length === 1) next.optionStateId = matches[0].id;
  }
  return next;
}
