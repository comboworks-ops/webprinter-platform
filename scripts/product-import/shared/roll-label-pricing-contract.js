import {rollLabelHash} from './roll-label-catalogue.js';

/** Read-only audit of what the existing two-axis matrix would retain. This is
 * not a publisher, conversion rule, interpolation model or quote endpoint. */
export function auditRollLabelPricingContract(profiles,records) {
  const known=new Map(profiles.map(p=>[p.key,p]));
  const groups=new Map(),quotedProfiles=new Set();
  for(const record of records){
    const profile=known.get(record.sourceKey);
    if(!profile || record.selections.article!==profile.articleId || record.selections.material!==profile.sourceMaterialId) throw Error('Foreign pricing-contract record');
    const key=JSON.stringify([profile.productId,profile.formatValueId,profile.materialValueId,record.quantity]);
    const group=groups.get(key)||[];group.push(record);groups.set(key,group);quotedProfiles.add(profile.key);
  }
  const collisions=[...groups.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({
    matrixKey:JSON.parse(key),profileKey:rows[0].sourceKey,exactRows:rows.length,
    differingAxes:Object.keys(rows[0].selections).filter(axis=>new Set(rows.map(row=>row.selections[axis])).size>1),
    supplierTotalsEur:[...new Set(rows.map(r=>r.supplierPrice))],
    sourceSignatures:rows.map(r=>r.extraData.signature),
  }));
  return {schemaVersion:1,databaseWrites:false,pricingEngineChanged:false,retailReady:false,
    inputSha256:rollLabelHash(records),counts:{profiles:profiles.length,quotedProfiles:quotedProfiles.size,
      exactRows:records.length,twoAxisMatrixRows:groups.size,collapsedRows:records.length-groups.size,
      collidingMatrixKeys:collisions.length,collisionsWithDifferentSupplierTotals:collisions.filter(c=>c.supplierTotalsEur.length>1).length,
      customSizeProfiles:profiles.filter(p=>p.format.customSize).length},collisions,
    fullIdentityAxes:Object.keys(records[0]?.selections||{}),
    unsupportedCapabilities:['arbitrary_dimensions','arbitrary_individual_quantity','unwitnessed_option_combinations',
      'exact_motif_allocations_beyond_captured_quotes','verified_Denmark_delivery'],
    recommendation:'separately_approved_authoritative_exact_quote_extension',
    safeguards:{noInterpolation:true,noCrossShapeSubstitution:true,noExtraSetupAdded:true,noMatrixPublication:true,
      pendingDraftOrderGateRetained:true,existingFreeSizeAndPilotPreserved:true}};
}
