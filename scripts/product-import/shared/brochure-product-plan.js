import { randomUUID } from 'node:crypto';
import { brochureMatrixAdapter } from './brochure-matrix.js';
import { buildMatrixLayoutV1, buildGenericPriceRowsFromNormalized } from './matrix-publisher.js';

const AXES = ['orientation', 'format', 'pageCount', 'paperCover', 'cover', 'varnish'];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

/** Allocate a local, reviewable insert plan. IDs here are proposed identities;
 * only a persisted write/readback receipt can call them created database IDs. */
export function allocateBrochureProductPlan(manifest, { tenantId, productId = randomUUID(), idFactory = randomUUID }) {
  assert(manifest.product?.sourceKey === 'wmd-saddle-stitched-brochures-9434', 'Unexpected brochure package');
  assert(/^[a-f0-9-]{36}$/i.test(tenantId) && /^[a-f0-9-]{36}$/i.test(productId), 'Explicit draft tenant/product UUID required');
  const adapter = brochureMatrixAdapter(manifest);
  const ids = new Set([productId]);
  const allocate = () => {
    const id = idFactory();
    assert(/^[a-f0-9-]{36}$/i.test(id) && !ids.has(id), 'Duplicate or invalid proposed ID');
    ids.add(id); return id;
  };
  const catalog = definition => {
    const group = { id: allocate(), tenant_id: tenantId, product_id: productId, name: definition.groupName,
      kind: definition.kind, source: 'product', ui_mode: definition.uiMode, sort_order: definition.sortOrder, enabled: true };
    const values = definition.valueSpecs.map((spec, index) => ({ id: allocate(), tenant_id: tenantId, product_id: productId,
      group_id: group.id, name: spec.name, sort_order: index, enabled: true,
      width_mm: spec.widthMm, height_mm: spec.heightMm, meta: spec.meta }));
    return { definition, group, values, valueByName: new Map(values.map(value => [value.name, value])) };
  };
  const resolved = { verticalAxis: catalog(adapter.matrixConfig.verticalAxis), sections: adapter.matrixConfig.sections,
    resolvedSections: new Map(adapter.matrixConfig.sections.map(definition => [definition.key, catalog(definition)])) };
  const catalogs = new Map([['paperCover', resolved.verticalAxis], ...resolved.resolvedSections]);
  const sourceValues = new Map(manifest.optionGroups.map(group => [group.key, new Map(group.values.map(value => [value.key, value]))]));
  const selectionIds = selections => {
    const names = adapter.remap(selections);
    return Object.fromEntries(AXES.map(key => {
      const value = catalogs.get(key)?.valueByName.get(names[key]);
      assert(value, `Unresolved brochure value ${key}`); return [key, value.id];
    }));
  };
  const axisSections = Object.fromEntries([...catalogs].map(([key, value]) => [key, value.definition.sectionId]));
  const pricingStructure = buildMatrixLayoutV1(adapter.matrixConfig, resolved, []);
  Object.assign(pricingStructure, { autoResolveExactCombination: true, sparseCompatibilityRequired: true,
    interpolationAllowed: false, hideUnavailableQuantities: true,
    customerSelectionOrder: ['orientation', 'format', 'pageCount', 'cover', 'varnish'],
    templateBinding: { profile: 'brochure_v1', axisSections } });
  return { tenantId, productId, adapter, resolved, catalogs, sourceValues, selectionIds, axisSections, pricingStructure, allocate,
    priceRow(record) {
      const rows = buildGenericPriceRowsFromNormalized({ tenantId, productId, matrixConfig: adapter.matrixConfig,
        resolved, normalizedRows: [adapter.rehydrate(record)] });
      assert(rows.length === 1, 'Brochure price could not be resolved'); return rows[0];
    } };
}

/** Resolve every fixed configuration using the existing publisher's IDs. The
 * compatibility list contains only selectors; active prices determine which
 * paper rows exist. Format templates coalesce only on identical source/hash/
 * geometry, avoiding hundreds of thousands of repeated JSONB template fields. */
export async function inspectBrochureDocumentResolution(plan, bindings, expectedCount) {
  const compatibility = new Map(), templates = new Map(), nativeCells = new Map();
  let count = 0;
  for await (const binding of bindings) {
    assert(binding.match?.format !== 'free', 'Free format requires its dimension-specific template');
    const ids = plan.selectionIds(binding.match), template = binding.template;
    const format = plan.sourceValues.get('format').get(binding.match.format);
    assert(template?.artworkMode === 'online_designer' && template.pageCount === 1
      && template.lockedInDesigner === true && template.nonPrintingOverlay === true && template.excludedFromExport === true
      && /^[a-f0-9]{64}$/.test(template.sanitizedPdfSha256)
      && Number(template.widthMm) === Number(format?.meta?.widthMm)
      && Number(template.heightMm) === Number(format?.meta?.heightMm)
      && template.bleedMm === 3 && template.safeMm === 3 && binding.guide?.factsReviewed === true,
    'Unreviewed or inconsistent brochure template binding');
    const cellKey = AXES.map(key => ids[key]).join('|');
    const native = nativeCells.get(cellKey);
    assert(!native || native === binding.match.paperCover, 'Distinct native paper IDs collapse into one fixed matrix cell');
    assert(!native, 'Duplicate fixed configuration binding');
    nativeCells.set(cellKey, binding.match.paperCover);
    const selectors = Object.fromEntries(plan.resolved.sections.map(section => [section.sectionId, ids[section.key]]));
    compatibility.set(JSON.stringify(selectors), selectors);
    const contract = { formatSourceKey: binding.match.format, sourceUrl: template.sourceUrl,
      nativeGuideSourceUrl: binding.guide.sourceUrl, sanitizedPdfPath: template.sanitizedPdfPath,
      templatePdfSha256: template.sanitizedPdfSha256, widthMm: template.widthMm, heightMm: template.heightMm,
      bleedMm: template.bleedMm, safeMm: template.safeMm, pageCount: 1 };
    const previous = templates.get(binding.match.format);
    assert(!previous || JSON.stringify(previous.contract) === JSON.stringify(contract), 'One format has conflicting source templates');
    if (!previous) templates.set(binding.match.format, { proposedDesignerTemplateId: plan.allocate(),
      selectionConstraints: { [plan.axisSections.format]: ids.format }, contract, exactConfigurationCount: 0 });
    templates.get(binding.match.format).exactConfigurationCount++;
    count++;
  }
  assert(count === expectedCount, 'Document resolution count mismatch');
  plan.pricingStructure.brochureCompatibility = { version: 1, selections: [...compatibility.values()] };
  return { exactConfigurationCount: count, uniqueSelectorCombinations: compatibility.size, templates: [...templates.values()] };
}

/** Free-paper native IDs are resolved separately from fixed prices. A quote
 * must still validate article, paper, page count and both exact dimensions. */
export function resolveBrochureFreeRegistry(plan, registry) {
  const pageValues = plan.sourceValues.get('pageCount');
  const paperValues = plan.sourceValues.get('paperCover');
  const result = [];
  for (const [articleId, article] of Object.entries(registry)) {
    const sourceUrl = new URL(article.sourceUrl);
    assert(/^[0-9]+$/.test(articleId) && sourceUrl.origin === 'https://www.wir-machen-druck.de'
      && sourceUrl.pathname.endsWith('.html'), 'Unexpected free brochure source');
    assert(pageValues.has(String(article.pageCount)) && article.pageCount <= 120, 'Unresolved free brochure page count');
    const pageValue = plan.catalogs.get('pageCount').valueByName.get(pageValues.get(String(article.pageCount)).labelDa);
    const materialIds = new Set();
    const materials = article.materials.map(nativeId => {
      const source = paperValues.get(nativeId);
      assert(source, 'Unresolved free brochure native paper');
      const value = plan.resolved.verticalAxis.valueByName.get(source.labelDa);
      assert(value && !materialIds.has(value.id), 'Distinct free-paper IDs collapse into one matrix row');
      materialIds.add(value.id);
      return { materialValueId: value.id, nativePaperId: nativeId };
    });
    result.push({ articleId, sourceUrl: sourceUrl.href, pageCount: article.pageCount, pageCountValueId: pageValue.id, materials });
  }
  const formatSource = plan.sourceValues.get('format').get('free');
  const orientationSource = plan.sourceValues.get('orientation').get('free');
  const formatValue = formatSource && plan.catalogs.get('format').valueByName.get(formatSource.labelDa);
  const orientationValue = orientationSource && plan.catalogs.get('orientation').valueByName.get(orientationSource.labelDa);
  const neutralSelectionIds = Object.fromEntries([['cover', 'matte'], ['varnish', 'none']].map(([axis, key]) => {
    const source = plan.sourceValues.get(axis).get(key);
    const value = source && plan.catalogs.get(axis).valueByName.get(source.labelDa);
    assert(value, 'Unresolved neutral free selector'); return [axis, value.id];
  }));
  assert(formatValue && orientationValue, 'Unresolved free format/orientation');
  return { version: 1, quoteEndpoint: '/api/brochure-quote', formatValueId: formatValue.id,
    orientationValueId: orientationValue.id, neutralSelectionIds, axisSections: plan.axisSections,
    minWidthMm: 98, maxWidthMm: 297, minHeightMm: 98,
    maxHeightMm: 297, stepMm: .1, separateCoverSelector: false, separateVarnishSelector: false,
    requiresExactDimensionQuote: true, articles: result };
}
