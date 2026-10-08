import { rollLabelPlannedId } from './roll-label-catalogue.js';
import { buildRollLabelSizeContract } from './roll-label-size-contract.js';
import { buildRollLabelStockDisplay } from './roll-label-stock-display.js';
import { rollLabelStockFormatCaption } from './roll-label-stock-format-display.js';

const tenantId = '00000000-0000-0000-0000-000000000000';
const shapes = { rectangle: 'Rektangel', circle: 'Rund', oval: 'Oval', custom_contour: 'Egen kontur', source_specific: 'Specialformat' };
const namedShapes = { Apfel: 'Æble', Auto: 'Bil', Bierkrug: 'Ølkrus', Birne: 'Pære', Blatt: 'Blad', Button: 'Badge',
  Eis: 'Is', Feuer: 'Ild', Flasche: 'Flaske', Fußabdruck: 'Fodaftryk', Glocke: 'Klokke', Haus: 'Hus', Herz: 'Hjerte',
  Hund: 'Hund', Katze: 'Kat', Kleeblatt: 'Kløver', Mond: 'Måne', Pfeil: 'Pil', Pflaster: 'Plaster',
  Schmetterling: 'Sommerfugl', Schneeflocke: 'Snefnug', Schwein: 'Gris', Shirt: 'T-shirt', Sprechblase: 'Taleboble',
  Stern: 'Stjerne', Tannenbaum: 'Grantræ', Wolke: 'Sky' };
export function rollLabelFormatName(article) {
  const f = article.format;
  const named = article.titleOriginal.match(/in (.+)-Form\b/)?.[1];
  const din = article.titleOriginal.match(/\bDIN\s+(A\d)/)?.[1];
  const shape = named ? namedShapes[named] || named : din || (/quadratisch/.test(article.titleOriginal) ? 'Kvadrat' : shapes[f.shape]);
  const parts = [shape, f.dimensions ? `${f.dimensions.widthMm} × ${f.dimensions.heightMm} mm` : f.customSize ? 'egne mål' : `variant ${article.articleId}`];
  const ink = article.titleOriginal.match(/\b([014])\/0-farbig\b/);
  if (ink) parts.push(ink[1] === '0' ? 'Uden tryk' : `${ink[1]}/0-tryk`);
  if (/Folienkaschierung/.test(article.titleOriginal)) parts.push('Laminering');
  if (/mit Prägung|Heißfolienprägung/.test(article.titleOriginal)) parts.push('Foliepræg');
  if (/Teillackierung/.test(article.titleOriginal)) parts.push('Spotlak');
  if (/Inkjetetiketten aus Papier/.test(article.titleOriginal)) parts.push('Papir');
  if (/Inkjetetiketten aus Folie/.test(article.titleOriginal)) parts.push('Folie');
  const printedText = article.titleOriginal.match(/^Hinweisetiketten (.+?)\s*\(/)?.[1];
  if (printedText) parts.push(`Tysk motiv: ${printedText}`);
  if (f.pageCount) parts.push(`${f.pageCount} sider`);
  if (f.motifCount > 1) parts.push(`${f.motifCount} motiver`);
  if (f.rollModel) parts.push(f.rollModel === 'outer_diameter' ? 'yderdiameter' : 'antal pr. rulle');
  return parts.join(' · ');
}

/** Candidate backend attribute/layout contract. No retail prices or source
 * documents are copied into the browser review. Captured dependent fields are
 * inventory only until an exact transition has been separately verified. */
export function buildRollLabelProductReview(family, sizeAudits = new Map(), optionStates = new Map(), nativeGuides = new Map(), artworkInstructions = new Map(), sizeGeometry = new Map(), cutContourContracts = new Map(), stockContracts = new Map(), stockFormats = new Map(), motifDelivery = new Map(), codingDelivery = new Map()) {
  if (!family.profiles?.every(p => p.familyId === family.sourceFamilyId && p.productId === family.productId)) throw Error('Foreign family profile');
  const sections = { format: `roll-format-${family.sourceFamilyId}`, material: `roll-material-${family.sourceFamilyId}` };
  const groups = ['format','material'].map((kind,sort_order) => ({
    id: rollLabelPlannedId(`group:${family.sourceFamilyId}:${kind}`), tenant_id: tenantId, product_id: family.productId,
    library_group_id: null, name: kind === 'format' ? 'Form og format' : 'Materiale og overflade',
    kind, ui_mode: kind === 'material' ? 'dropdown' : 'buttons', source: 'product', sort_order, enabled: true,
  }));
  const available = family.profiles.filter(p => p.blockers.length === 0);
  const formatIds = new Set(available.map(p => p.formatValueId));
  const materialIds = new Set(available.map(p => p.materialValueId));
  const formatName = article => {
    const profiles=available.filter(p=>p.articleId===article.articleId);
    const captions=profiles.map(p=>rollLabelStockFormatCaption(article,stockContracts.get(p.key),stockFormats.get(p.key),rollLabelFormatName(article)));
    if(new Set(captions).size>1)throw Error('Conflicting material-specific format captions');
    return captions[0] || rollLabelFormatName(article);
  };
  const values = [
    ...family.articles.filter(a => formatIds.has(a.formatValueId)).map((article,sort_order) => ({
      id: article.formatValueId, product_id: family.productId, group_id: groups[0].id,
      name: formatName(article), key: article.articleId, sort_order, enabled: true,
      width_mm: article.format.dimensions?.widthMm ?? null, height_mm: article.format.dimensions?.heightMm ?? null,
      meta: { sourceArticleId: article.articleId, sourceLabel: article.titleOriginal, shape: article.format.shape,
        customSize: article.format.customSize, motifCount: article.format.motifCount, pageCount: article.format.pageCount, rollModel: article.format.rollModel },
    })),
    ...family.materials.filter(m => materialIds.has(m.id)).map((material,sort_order) => ({
      id: material.id, product_id: family.productId, group_id: groups[1].id,
      name: material.labelDa, key: null, sort_order, enabled: true, width_mm: null, height_mm: null,
      meta: { sourceLabel: material.labelOriginal },
    })),
  ];
  const exactSelections = available.map(p => ({ [sections.format]: p.formatValueId, [sections.material]: p.materialValueId }));
  if (new Set(exactSelections.map(s => JSON.stringify(s))).size !== exactSelections.length) throw Error('Ambiguous article/material identity');
  const sourceGroups = groups.map(group => ({ ...group, values: values.filter(value => value.group_id === group.id) }));
  const pricingStructure = { mode: 'matrix_layout_v1', version: 1, autoResolveExactCombination: true,
    customerSelectionOrder: [sections.format, sections.material], quantities: [],
    vertical_axis: { sectionId: sections.material, sectionType: 'materials', groupId: groups[1].id,
      valueIds: sourceGroups[1].values.map(v => v.id), title: groups[1].name, ui_mode: 'dropdown' },
    layout_rows: [{ id: `roll-row-${family.sourceFamilyId}`, columns: [{ id: sections.format, sectionType: 'formats',
      groupId: groups[0].id, valueIds: sourceGroups[0].values.map(v => v.id), title: groups[0].name, ui_mode: 'buttons', selection_mode: 'required' }] }],
    workspaceGroups: groups.map((group,index) => ({ id: sections[group.kind], title: group.name, uiMode: group.ui_mode,
      options: sourceGroups[index].values.map(value => ({ sectionId: sections[group.kind], valueId: value.id })) })),
  };
  return { schemaVersion: 1, state: 'local_configuration_review', familyId: family.sourceFamilyId,
    productId: family.productId, name: family.name, description: family.description, categoryId: family.categoryId,
    sections, sourceGroups, pricingStructure, exactSelections, initialSelection: exactSelections[0] || {},
    existingProductToPreserve: family.existingProductToPreserve,
    articles: family.articles.map(a => ({ articleId: a.articleId, name: formatName(a), format: a.format,
      blockers: [...new Set([...a.blockers, ...family.profiles.filter(p => p.articleId === a.articleId).flatMap(p => p.blockers)])] })),
    profiles: family.profiles.map(p => ({ key: p.key, articleId: p.articleId, sourceMaterialId: p.sourceMaterialId,
      formatValueId: p.formatValueId, materialValueId: p.materialValueId, format: p.format,
      blockers: p.blockers, customerArtworkRequired: p.customerArtworkRequired,
      ...(stockContracts.has(p.key) ? { sourceEvidenceSha256:p.sourceEvidenceSha256,
        sourceQuantityBindings:p.sourceQuantities.map(q => ({quantity:q.quantity,sourcePriceScaleId:q.sourcePriceScaleId})),
        stockDisplay:buildRollLabelStockDisplay(family,p,stockContracts.get(p.key)) } : {}),
      ...(stockFormats.has(p.key) ? {stockFormatDisplay:stockFormats.get(p.key)} : {}),
      ...(motifDelivery.has(p.key) ? {sourceEvidenceSha256:p.sourceEvidenceSha256,motifDelivery:motifDelivery.get(p.key)} : {}),
      ...(codingDelivery.has(p.key) ? {sourceEvidenceSha256:p.sourceEvidenceSha256,codingDeliveryDisplay:codingDelivery.get(p.key)} : {}),
      nativeGuide: nativeGuides.get(p.key) || null,
      sizeGeometry: sizeGeometry.get(p.key) || null,
      artworkInstructions: artworkInstructions.get(p.key) || null,
      ...(cutContourContracts.has(p.key) ? { cutContourContract: cutContourContracts.get(p.key) } : {}),
      sizeContract: sizeAudits.size ? buildRollLabelSizeContract(p, sizeAudits.get(p.key)) : null,
      optionStates: optionStates.get(p.key) || null,
      optionFields: p.optionFields.map(f => ({ sourceFieldId: f.sourceFieldId, labelDa: f.labelDa, visible: f.visible, required: f.required,
        values: (optionStates.get(p.key)?.fieldValues?.[f.sourceFieldId] || f.values).map(v => ({ sourceValueId: v.sourceValueId, labelDa: v.labelDa, rotationDegrees: v.rotationDegrees,
          selected: String(p.defaultSourceOptions?.[f.sourceFieldId]?.id) === v.sourceValueId })) })),
      quantityInputs: p.quantityInputs, sourceQuantities: p.sourceQuantities.map(q => q.quantity),
      optionDependencyStatus: p.optionDependencyStatus, orderReady: false,
    })),
    counts: { articles: family.articles.length, profiles: family.profiles.length, selectableProfiles: available.length },
    retailPricesIncluded: false, orderReady: false,
  };
}

export function buildRollLabelReviewIndex(plan) {
  return { schemaVersion: 1, state: 'local_configuration_review', counts: plan.counts, hierarchy: plan.hierarchy,
    families: plan.families.map(f => ({ familyId: f.sourceFamilyId, productId: f.productId, slug: f.slug, name: f.name,
      categoryId: f.categoryId, articleCount: f.articles.length })),
    products: plan.families.map(f => ({ id: f.productId, name: f.name, description: f.description, slug: f.slug,
      image_url: null, category: f.proposedProduct.category, categoryKey: f.proposedProduct.category,
      categoryLabel: plan.sourceGroups.find(g => g.sourceId === f.sourceGroupId).name,
      categoryId: f.categoryId, categoryOverviewId: plan.hierarchy.overview.id, pricing_type: 'matrix',
      default_variant: null, default_quantity: null, banner_config: null, tooltip_product: null, tooltip_price: null,
      displayPrice: 'Under klargøring', technical_specs: { local_review_family_id: f.sourceFamilyId } })),
    retailPricesIncluded: false, orderReady: false };
}
