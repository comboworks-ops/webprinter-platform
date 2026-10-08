import { rollLabelHash } from './roll-label-catalogue.js';

export const rollLabelOptionKey = options => JSON.stringify(Object.fromEntries(Object.entries(options).sort(([a],[b]) => a.localeCompare(b))));

/** Project complete, witnessed option vectors, never independent value unions.
 * Quote acceptance proves these options at the recorded size/allocation only;
 * this contract grants neither arbitrary-size pricing nor order readiness. */
export function buildRollLabelOptionStates(profile, records) {
  const states = new Map();
  for (const record of records) {
    if (record.sourceKey !== profile.key) throw Error('Foreign option-state quote');
    const request = record.rawPayload?.sourceRequest;
    if (String(request?.articleId) !== profile.articleId || String(request?.substrateId) !== profile.sourceMaterialId) throw Error('Option-state identity mismatch');
    const options = Object.fromEntries(Object.entries(request.additionalUpsells || {}).map(([field,value]) => {
      if (!profile.optionFields.find(f => f.sourceFieldId === field)?.values.some(v => v.sourceValueId === String(value.id))) throw Error('Option-state value outside source profile');
      return [field, String(value.id)];
    }));
    const key = rollLabelOptionKey(options);
    if (!states.has(key)) states.set(key, { id: rollLabelHash({ profileKey: profile.key, options: key }), options, evidence: [] });
    states.get(key).evidence.push({ signature: record.extraData.signature, responseSha256: record.extraData.responseSha256,
      widthMm: record.dimensions?.widthMm ?? null, heightMm: record.dimensions?.heightMm ?? null, quantity: record.quantity });
  }
  const defaults = Object.fromEntries(Object.entries(profile.defaultSourceOptions || {}).map(([id,value]) => [id, String(value.id)]));
  const initial = states.get(rollLabelOptionKey(defaults));
  return { version: 1, profileKey: profile.key, initialStateId: initial?.id || null,
    states: [...states.values()], coverage: 'observed_complete_option_vectors_only', pricingReady: false, orderReady: false };
}
