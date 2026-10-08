import { createHash } from 'node:crypto';

/** Whitelist-only display projection. Private descriptions/price labels never
 * enter this contract. Purchase quantities retain their original meaning. */
export function buildRollLabelStockDisplay(family, profile, contract) {
  if (!contract) return null;
  const {sha256, ...payload} = contract;
  if (createHash('sha256').update(JSON.stringify(payload)).digest('hex') !== sha256
    || contract.version !== 1 || contract.status !== 'source_stock_preparation_only'
    || contract.familyId !== family.sourceFamilyId || contract.productId !== family.productId
    || contract.profileKey !== profile.key || contract.articleId !== profile.articleId
    || contract.materialId !== profile.sourceMaterialId || profile.key !== `${profile.articleId}:${profile.sourceMaterialId}`
    || contract.sourceEvidenceSha256 !== profile.sourceEvidenceSha256 || profile.customerArtworkRequired !== false
    || profile.blockers.length || contract.customerArtworkRequired !== false || contract.onlineDesignerAllowed !== false
    || contract.quantityConvertedToLabels !== false || contract.orderReady !== false
    || contract.quantities.length !== profile.sourceQuantities.length
    || !contract.quantities.every((q,i) => q.quantity === profile.sourceQuantities[i].quantity
      && q.sourcePriceScaleId === profile.sourceQuantities[i].sourcePriceScaleId)) throw Error('Stale or foreign stock display evidence');
  const allowed = {
    blank_label_roll: ['labelsPerRoll'], preprinted_notice_roll: ['labelsPerRoll'],
    thermal_transfer_ribbon: ['ribbonWidthMm','ribbonLengthM'],
    blank_a4_sheet_pack: ['sheetsPerPack','labelsPerSheet','labelsPerPack'], neutral_booklet_sample: ['sampleLabels'],
  }[contract.kind];
  if (!allowed || !['rolls','source_items'].includes(contract.sourceQuantityUnit)
    || Object.keys(contract.packaging).some(key => !allowed.includes(key))) throw Error('Unsupported stock packaging');
  return {version:1, familyId:contract.familyId, productId:contract.productId, profileKey:profile.key,
    articleId:profile.articleId, materialId:profile.sourceMaterialId, sourceEvidenceSha256:profile.sourceEvidenceSha256,
    sourceContractSha256:sha256, kind:contract.kind, sourceQuantityUnit:contract.sourceQuantityUnit,
    quantities:contract.quantities.map(q => ({quantity:q.quantity,sourcePriceScaleId:q.sourcePriceScaleId})),
    packaging:Object.fromEntries(allowed.filter(key => key in contract.packaging).map(key => [key,contract.packaging[key]])),
    customerArtworkRequired:false, onlineDesignerAllowed:false, quantityConvertedToLabels:false, orderReady:false};
}
