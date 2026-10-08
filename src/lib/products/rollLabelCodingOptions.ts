import type { RollLabelReviewProfile } from './rollLabelReview';
import type { RollLabelSelection } from './rollLabelConfiguration';
import { readRollLabelCodingDelivery } from './rollLabelCodingDelivery';

const hash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
/** Source-option evidence only. A match carries no retail quote, Excel/JPG
 * delivery approval, code rendering or permission to order. */
export function rollLabelCodingOptionReference(profile: RollLabelReviewProfile, selection: RollLabelSelection | null) {
  if (!readRollLabelCodingDelivery(profile)) return null;
  const state = profile.optionStates?.states.find(s => s.id === selection?.optionStateId);
  if (!selection || !state || selection.profileKey !== profile.key || selection.articleId !== profile.articleId
    || selection.materialId !== profile.sourceMaterialId || selection.motifCount !== 1
    || Object.keys(selection.sourceOptions).length !== Object.keys(state.options).length
    || Object.entries(state.options).some(([key, value]) => selection.sourceOptions[key] !== value)) return 'pending';
  const documented = state.evidence.some(e => hash(e.signature) && hash(e.responseSha256)
    && hash(e.sourceReceiptSha256) && hash(e.qaRequestFingerprint)
    && /^output\/qa\/roll-labels-2026-10-06\/predecessor006-coding-(option-source-check-045|code-font-source-check-046|code-font-feed-source-check-047)\//.test(e.sourceReceiptPath || '')
    && e.widthMm === selection.widthMm && e.heightMm === selection.heightMm && e.quantity === selection.quantity);
  return documented ? 'documented' : 'pending';
}
