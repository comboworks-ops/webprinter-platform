import { createNormalizedMatrixRecord } from './product-import/shared/normalized-pricing.js';
import { buildGenericPriceRowsFromNormalized } from './product-import/shared/matrix-publisher.js';
import { rollLabelPlannedId } from './product-import/shared/roll-label-catalogue.js';
import { rollLabelPriceSelectionKey, type RollLabelPricePreview } from '../src/lib/products/rollLabelPricePreview';
import type { RollLabelReviewFamily } from '../src/lib/products/rollLabelReview';
import type { RollLabelGenericPriceRow } from '../src/lib/products/rollLabelPriceMatrix';

/** Use the existing generic row publisher's pure builder; never call its writer. */
export function buildRollLabelGenericMatrix(family: RollLabelReviewFamily, packet: RollLabelPricePreview) {
  const tenantId = '00000000-0000-0000-0000-000000000000', contextSection = `roll-context-${family.familyId}`;
  const definitions = [
    { key: 'format', selectionMapKey: family.sections.format, extraDataIdField: 'formatId' },
    { key: 'context', selectionMapKey: contextSection, isVariantDimension: true },
  ];
  const formatValues = new Map(family.profiles.map(profile => [profile.formatValueId, { id: profile.formatValueId }]));
  const materialValues = new Map(family.profiles.map(profile => [profile.materialValueId, { id: profile.materialValueId }]));
  const contextValues = new Map<string, { id: string; name: string; meta: Record<string, unknown> }>();
  const profiles = new Map(family.profiles.map(profile => [profile.key, profile]));
  const normalizedRows = packet.points.map(point => {
    const s = point.selection, profile = profiles.get(s.profileKey);
    if (!profile) throw Error('Unknown exact matrix profile');
    // Single-motif totals vary by the quantity column. Multi-motif allocation
    // remains an exact context, including its total, rather than a ratio rule.
    const context = rollLabelPriceSelectionKey({ ...s, quantity: s.motifCount === 1 ? 1 : s.quantity,
      motifAllocations: s.motifCount === 1 ? [1] : s.motifAllocations });
    const id = rollLabelPlannedId(`matrix-context:${context}`);
    contextValues.set(context, { id, name: `${s.widthMm} × ${s.heightMm} mm · ${s.optionStateId}${s.motifCount > 1 ? ' · '+s.motifAllocations.join(' / ') : ''}`,
      meta: { sourceProfileKey: s.profileKey, widthMm: s.widthMm, heightMm: s.heightMm, sourceOptions: s.sourceOptions,
        optionStateId: s.optionStateId, motifCount: s.motifCount, ...(s.motifCount > 1 ? { motifAllocations: s.motifAllocations } : {}) } });
    return createNormalizedMatrixRecord({ supplier: 'wir-machen-druck', sourceType: 'captured-roll-label-proposal',
      importerKey: 'roll-label-system-integration-025', sourceKey: s.profileKey, quantity: s.quantity,
      extractedAt: point.capturedAt, finalPriceDkk: point.priceDkk, conversionRuleKey: packet.ruleKey,
      dimensions: { widthMm: s.widthMm, heightMm: s.heightMm },
      selections: { format: profile.formatValueId, material: profile.materialValueId, context },
      extraData: { rollLabels: s, capturedAt: point.capturedAt, commercialApproved: false, orderReady: false } });
  });
  const rows = buildGenericPriceRowsFromNormalized({ tenantId, productId: family.productId,
    matrixConfig: { verticalAxis: { key: 'material', selectionMapKey: family.sections.material, extraDataIdField: 'materialId' } },
    resolved: { verticalAxis: { valueByName: materialValues, group: { id: family.pricingStructure.vertical_axis.groupId } },
      sections: definitions, resolvedSections: new Map([
        ['format', { valueByName: formatValues }], ['context', { valueByName: contextValues }],
      ]) }, normalizedRows }) as RollLabelGenericPriceRow[];
  if (rows.length !== packet.points.length) throw Error('Generic matrix would collapse exact sticker prices');
  const byIdentity = new Map(rows.map(row => [rollLabelPriceSelectionKey(row.extra_data.rollLabels), row]));
  const boundPacket: RollLabelPricePreview = { ...packet, points: packet.points.map(point => {
    const row = byIdentity.get(rollLabelPriceSelectionKey(point.selection))!;
    const formatValueId = row.extra_data.selectionMap[family.sections.format];
    return { ...point, matrix: { variantName: row.variant_name, variantValue: row.variant_value, formatValueId,
      contextValueId: row.extra_data.selectionMap[contextSection] } };
  }) };
  const groupId = rollLabelPlannedId(`matrix-context-group:${family.familyId}`);
  const contextGroup = { id: groupId, product_id: family.productId, tenant_id: tenantId, library_group_id: null,
    name: 'Priskonfiguration', kind: 'finishes', source: 'product', ui_mode: 'dropdown', enabled: true, sort_order: 2,
    values: [...contextValues.values()].map((value, sort_order) => ({ ...value, product_id: family.productId,
      group_id: groupId, enabled: true, sort_order })) };
  return { packet: boundPacket, rows, contextSection, contextGroup };
}
