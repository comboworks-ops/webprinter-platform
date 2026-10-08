import { createHash } from 'node:crypto';

export const ROLL_LABEL_GROUPS = [
  { sourceId: '30233', slug: 'standardetiketter', name: 'Standardetiketter', description: 'Egne mål, faste formater og specialformer.' },
  { sourceId: '31163', slug: 'maskinetiketter', name: 'Maskinetiketter', description: 'Etiketter til maskinel påføring med valg af rulle og motiver.' },
  { sourceId: '25142', slug: 'alternative-materialer', name: 'Alternative materialer', description: 'Genanvendte materialer, græspapir, bagasse og andre særlige materialer.' },
  { sourceId: '25144', slug: 'specialetiketter', name: 'Specialetiketter', description: 'Etiketter til særlige anvendelser, overflader og effekter.' },
  { sourceId: '28275', slug: 'blanke-etiketter-og-tilbehoer', name: 'Blanke etiketter og tilbehør', description: 'Etiketter til egen printer, farvebånd og relaterede varer.' },
];

const assert = (condition, message) => { if (!condition) throw Error(message); };
export const rollLabelHash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function rollLabelPlannedId(key) {
  const chars = rollLabelHash(`roll-label-catalogue-v1:${key}`).slice(0, 32).split('');
  chars[12] = '5'; chars[16] = ((parseInt(chars[16], 16) & 3) | 8).toString(16);
  const hex = chars.join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const rollLabelSlug = value => value.toLowerCase().replace(/æ/g,'ae').replace(/ø/g,'oe').replace(/å/g,'aa')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const exactLabels = {
  'Laufrichtung': 'Udløbsretning', 'Verarbeitung': 'Påføring', 'Prägefarbe': 'Foliefarve',
  'Folienkaschierung': 'Laminering', 'Rollengröße': 'Rullens yderdiameter',
  'Motivanzahl': 'Antal motiver', 'Stückzahl pro Rolle': 'Etiketter pr. rulle',
  'Schriftart': 'Skrifttype', 'Codierung oder Nummerierung': 'Kode eller nummerering', 'Veredelung': 'Efterbehandling',
  'Laufrichtung beliebig': 'Valgfri retning', 'per Hand': 'Manuel påføring',
  'per Maschine (76mm Hülse)': 'Maskinel påføring · 76 mm kerne',
  'Fuß voraus (keine Drehung)': 'Bundkant først', 'rechts voraus (Drehung um 90 Grad)': 'Højre kant først',
  'links voraus (Drehung um 270 Grad)': 'Venstre kant først', 'Kopf voraus (Drehung um 180 Grad)': 'Topkant først',
  'Gold': 'Guld', 'Silber': 'Sølv', 'Rot': 'Rød', 'Grün': 'Grøn', 'Blau': 'Blå',
  'Stahl': 'Stål', 'Roségold': 'Rosaguld', 'Matt': 'Mat', 'Glänzend': 'Blank',
  'Nummerierung': 'Nummerering', 'Keine Thermotransferfolie': 'Uden farvebånd',
};
/** Display-only glossary. Exact supplier identities and labels are retained.
 * This never translates price keys or adds material-performance claims. */
export function rollLabelDanishLabel(value) {
  if (exactLabels[value]) return exactLabels[value];
  return String(value)
    .replace(/Indoor nachhaltig:/g,'Indendørs · Øko-serie:')
    .replace(/Lebensmittelecht:/g,'Fødevareetiketserie:')
    .replace(/Tiefkühlgeeignet:/g,'Frostegnet:').replace(/Eiswasserbeständig:/g,'Isvandsbestandig:')
    .replace(/Seewasserbeständig:/g,'Havvandsbestandig:').replace(/Hitzebeständig:/g,'Varmebestandig:')
    .replace(/Kompostierbar:/g,'Komposterbar serie:').replace(/Abwaschbar:/g,'Afvaskelig:')
    .replace(/Holzbasierte Folie:/g,'Træbaseret folie:').replace(/Graspapier:/g,'Græspapir:').replace(/Bagassepapier:/g,'Bagassepapir:')
    .replace(/Typenschilder:/g,'Typeskilte:').replace(/Textilstruktur:/g,'Tekstilstruktur:')
    .replace(/Hochwertiger Qualitätsdruck auf/g,'Tryk på')
    .replace(/Harzangereichertes Wachs Premium Thermotransferband/g,'Premium termotransferbånd · voks med harpiks')
    .replace(/Harz Premium Thermotransferband/g,'Premium termotransferbånd · harpiks')
    .replace(/universell mit Inkjet bedruckbar/g,'til inkjettryk').replace(/hervorragend bedruckbares /g,'')
    .replace(/Inkjetpapier/g,'Inkjetpapir').replace(/Inkjetfolie/g,'Inkjetfolie')
    .replace(/Thermotransferpapier/g,'Termotransferpapir').replace(/Thermopapier/g,'Termopapir')
    .replace(/mit permanentem Kleber/g,'med permanent klæber')
    .replace(/aus 85 % recyceltem Post Consumer Kunststoffabfall/g,'af 85 % genanvendt plast fra forbrugeraffald')
    .replace(/aus 100 % Post Consumer Recyclingfasern/g,'af 100 % genanvendte fibre fra forbrugeraffald')
    .replace(/aus 30 % Grasfaser/g,'af 30 % græsfibre').replace(/aus landwirtschaftlichem Abfall/g,'af restmateriale fra landbrug')
    .replace(/mit recyceltem Trägermaterial/g,'med genanvendt bæremateriale')
    .replace(/kompostierbare Folie/g,'komposterbar folie').replace(/ablösbar/g,'aftagelig').replace(/g\/qm/g,'g/m²')
    .replace(/Trägerpapier/g,'bærepapir').replace(/PET Liner/g,'PET-bæremateriale').replace(/Kraftpapier/g,'kraftpapir')
    .replace(/Weißes/g,'Hvidt').replace(/Naturweißes/g,'Naturhvidt').replace(/Rotes/g,'Rødt')
    .replace(/Haftetikettenpapier/g,'selvklæbende etiketpapir').replace(/Opakes/g,'Dækkende')
    .replace(/Nassleimpapier/g,'vådlimspapir').replace(/Leuchtfarbenpapier/g,'fluorescerende papir')
    .replace(/einseitig leicht glänzend gestrichenes?/g,'let blankt bestrøget på én side')
    .replace(/einseitig gestrichenes/g,'bestrøget på én side').replace(/einseitig leicht glänzend/g,'let blankt på én side')
    .replace(/Rückseite weiß matt leicht gestrichen/g,'bagside let bestrøget i mat hvid')
    .replace(/Rückseite matt präpariert/g,'matbehandlet bagside').replace(/Rückseite schwarz gefärbt/g,'sortfarvet bagside')
    .replace(/mit blauem Rückseitenstrich/g,'med blå bestrøgning på bagsiden')
    .replace(/nass- und laugenfest/g,'våd- og ludbestandigt').replace(/nassfest/g,'vådstærkt')
    .replace(/Standard-Oberfläche/g,'standardoverflade').replace(/hochwertige Premium-Haptik/g,'markant struktur')
    .replace(/perlmuttartig/g,'perlemorsagtigt').replace(/leicht geprägt/g,'let præget')
    .replace(/Hammerschlag-Prägung/g,'hamret prægning').replace(/strukturiert/g,'struktureret')
    .replace(/elfenbeinfarben/g,'elfenbensfarvet').replace(/gerippt/g,'ribbet').replace(/satiniert/g,'satin')
    .replace(/naturfarben/g,'naturfarvet').replace(/Acetatseide/g,'acetatsilke').replace(/geschmeidig/g,'smidigt')
    .replace(/metallisierter holografische Glitzereffekt/g,'metalliseret holografisk glimmereffekt')
    .replace(/metallisierter holografischer Rainboweffekt/g,'metalliseret holografisk regnbueeffekt')
    .replace(/ohne Weißdruck/g,'uden hvidtryk').replace(/silber-metallic/g,'sølvmetallisk').replace(/\bsilber\b/g,'sølv')
    .replace(/Goldfolienprägung/g,'guldfoliepræg').replace(/Silberfolienprägung/g,'sølvfoliepræg')
    .replace(/Folienkaschierung/g,'laminering').replace(/Teillackierung/g,'spotlak')
    .replace(/Chromopapier maschinengestrichen/g,'maskinbestrøget chromopapir')
    .replace(/hochglänzend/g,'højblank').replace(/\bgestrichen\b/g,'bestrøget')
    .replace(/Fluor Gelb/g,'Neongul').replace(/Fluor Rot/g,'Neonrød').replace(/Fluor Grün/g,'Neongrøn').replace(/Fluor Orange/g,'Neonorange')
    .replace(/\bExclusiv:/g,'Eksklusiv:').replace(/\bExklusiv:/g,'Eksklusiv:').replace(/Öko-Haftfolie/g,'Øko-seriens selvklæbende folie')
    .replace(/--TOPSELLER--/g,'').replace(/Indoor:/g,'Indendørs:').replace(/Outdoor:/g,'Udendørs:')
    .replace(/Ablösbar:/g,'Aftagelig:').replace(/Stark haftend:/g,'Stærk klæber:').replace(/Recycling:/g,'Genanvendt:')
    .replace(/Außendurchmesser:/g,'Yderdiameter:').replace(/Thermotransferfolie/g,'Farvebånd')
    .replace(/Heißfolienveredelung/g,'Foliepræg').replace(/mit 3D Effekt/g,'med 3D-effekt').replace(/UV-Spotlack/g,'UV-spotlak')
    .replace(/\bGold\b/g,'guld').replace(/\bSilber\b/g,'sølv').replace(/\bKupfer\b/g,'kobber').replace(/\bBlau\b/g,'blå')
    .replace(/\bMotiv\b/g,'Motiv').replace(/\bStück\b/g,'stk.').replace(/\bRollen?\b/g,'ruller')
    .replace(/Haftfolie/g,'selvklæbende folie').replace(/Haftpapier/g,'selvklæbende papir')
    .replace(/Bilderdruckpapier/g,'bestrøget papir').replace(/Folien?/g,'folie').replace(/\bPapier\b/g,'papir')
    .replace(/weiß/g,'hvid').replace(/transparent/g,'transparent').replace(/glänzend/g,'blank').replace(/\bmatt\b/g,'mat')
    .replace(/kratzfest/g,'ridsefast').replace(/Glanz-UV-Lack/g,'blank UV-lak').replace(/Matt-UV-Lack/g,'mat UV-lak')
    .replace(/UV-beständig/g,'UV-bestandig').replace(/mit partiellem Weißdruck/g,'med delvist hvidtryk')
    .replace(/mit Weißdruck/g,'med hvidtryk').replace(/mit Perlmuteffekt/g,'med perlemorseffekt')
    .replace(/beschreib- und bestempelbar/g,'kan skrives og stemples på').replace(/\bmit\b/g,'med')
    .replace(/\bauf\b/g,'på').replace(/\bFett\b/g,'fed').replace(/\bKursiv\b/g,'kursiv')
    .replace(/\s+/g,' ').trim();
}

const directionRotation = label => ({
  'Fuß voraus (keine Drehung)': 0, 'rechts voraus (Drehung um 90 Grad)': 90,
  'links voraus (Drehung um 270 Grad)': 270, 'Kopf voraus (Drehung um 180 Grad)': 180,
})[label] ?? null;

function projectFields(material) {
  const fields = material.options_evidence?.response?.data?.response?.additionalFieldsData || {};
  return Object.values(fields).sort((a,b) => Number(a.sort) - Number(b.sort)).map((field,index) => ({
    sourceFieldId: String(field.id), labelOriginal: field.bezeichnung,
    labelDa: rollLabelDanishLabel(field.bezeichnung), sourceOrder: index,
    required: Number(field.pflicht) === 1, visible: Number(field.visibility) === 1,
    values: Object.values(field.werte || {}).sort((a,b) => Number(a.sort) - Number(b.sort)).map((value,sourceOrder) => ({
      sourceValueId: String(value.id), sourceValue: value.bezeichnung,
      labelDa: rollLabelDanishLabel(value.bezeichnung), sourceOrder,
      rotationDegrees: String(field.id) === '222' ? directionRotation(value.bezeichnung) : null,
      selected: Boolean(Number(value.is_preselected)),
    })),
    evidence: { sha256: material.options_evidence?.response_sha256, capturedAt: material.options_evidence?.captured_at,
      request: material.options_evidence?.request },
  }));
}

export function articleFormat(article) {
  const title = article.title_de;
  const size = title.match(/\((\d+(?:[.,]\d+)?)\s*(?:cm\s*)?x\s*(\d+(?:[.,]\d+)?)\s*cm\)/i);
  const circle = title.match(/\brund\s*\((\d+(?:[.,]\d+)?)\s*cm\)/i);
  const mmSize = title.match(/\b(?:Format\s+)?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*mm\b/i);
  const num = value => Number(value.replace(',','.')) * 10;
  const dimensions = size ? { widthMm: num(size[1]), heightMm: num(size[2]) }
    : circle ? { widthMm: num(circle[1]), heightMm: num(circle[1]) }
      : mmSize ? { widthMm: num(mmSize[1]) / 10, heightMm: num(mmSize[2]) / 10 } : null;
  const shape = /\brund\b/i.test(title) ? 'circle' : /\boval\s+mit\s+Kerbe\b/i.test(title) ? 'source_specific' : /\boval\b/i.test(title) ? 'oval'
    : /rechteckig|quadratisch|\bDIN\s+A\d/i.test(title) ? 'rectangle' : /Stanzform/i.test(title) ? 'custom_contour' : 'source_specific';
  const motif = title.match(/\b(\d+)\s*Motive?\b/i);
  const pages = title.match(/(\d+)-seitig\b/i);
  const rollModel = /Außendurchmesser wählbar/i.test(title) ? 'outer_diameter'
    : /Stückzahl pro Rolle wählbar/i.test(title) ? 'labels_per_roll' : null;
  const customSize = article.quantity_and_dimensions_inputs.some(input => input.name === 'grossdruck_width');
  return { shape, dimensions, customSize, motifCount: motif ? Number(motif[1]) : 1,
    pageCount: pages ? Number(pages[1]) : null, rollModel,
    dimensionsEvidence: dimensions ? (mmSize ? 'exact_supplier_article_title_mm' : 'exact_supplier_article_title_cm') : null };
}

/** Prepare all families without writes or synthetic Cartesian combinations.
 * loadMaterials returns the original captured material responses for an article. */
export function buildRollLabelCatalogue({ catalogue, loadMaterials, sourceSha256, bookletCandidates = [], standardCandidates, wetGlueGeometry = [] }) {
  assert(catalogue.families.length === 42 && catalogue.articles.length === 472, 'Full 42-family / 472-article source required');
  const overviewId = rollLabelPlannedId('overview:stickers'), rootId = rollLabelPlannedId('category:roll-labels');
  const articleById = new Map(catalogue.articles.map(a => [a.supplier_article_id,a]));
  const groupByFamily = new Map();
  for (const group of ROLL_LABEL_GROUPS) {
    const graph = catalogue.category_graph.find(node => node.url.includes(`category,${group.sourceId}.html`));
    assert(graph, `Missing source group ${group.sourceId}`);
    graph.children.forEach(child => {
      const id = child.url.match(/category,(\d+)\.html/)?.[1];
      if (id && catalogue.families.some(f => f.source_category_id === id)) {
        assert(!groupByFamily.has(id), `Family appears in multiple source groups: ${id}`);
        groupByFamily.set(id,group);
      }
    });
  }
  assert(groupByFamily.size === 42, 'Every family must belong to one supplier group');
  assert(Array.isArray(standardCandidates) && standardCandidates.length === 22, 'Reviewed standard geometry inventory required');
  assert(wetGlueGeometry.length === 0 || (wetGlueGeometry.length === 54
    && new Set(wetGlueGeometry.map(c => String(c.article_id))).size === 54), 'Complete wet-glue geometry inventory required');
  const categories = [{ id: rootId, name: 'Etiketter på rulle', slug: 'etiketter-paa-rulle', overview_id: overviewId,
    parent_category_id: null, navigation_mode: 'submenu', sort_order: 0 },
    ...ROLL_LABEL_GROUPS.map((group,sort_order) => ({ id: rollLabelPlannedId(`category:${group.sourceId}`),
      name: group.name, slug: group.slug, overview_id: overviewId, parent_category_id: rootId,
      navigation_mode: 'all_in_one', sort_order }))];
  const profiles = [], sourcePrices = [], exactQuotes = [], families = [];
  for (const family of catalogue.families) {
    const group = groupByFamily.get(family.source_category_id);
    const productId = rollLabelPlannedId(`product:${family.source_category_id}`);
    const articleProfiles = [], familyMaterials = new Map();
    for (const id of family.article_ids) {
      const article = articleById.get(id); assert(article, `Unknown article ${id}`);
      const format = articleFormat(article);
      const sourceMaterialOrder = new Map((article.selects_initial_state.find(s => s.name === 'sorten')?.options || [])
        .map((option,index) => [String(option.value),index]));
      const materials = [...loadMaterials(id)].sort((a,b) =>
        (sourceMaterialOrder.get(String(a.material.value)) ?? Number.MAX_SAFE_INTEGER)
        - (sourceMaterialOrder.get(String(b.material.value)) ?? Number.MAX_SAFE_INTEGER));
      const blockers = [];
      if (!materials.length) blockers.push('source_article_unavailable');
      const booklet = bookletCandidates.find(c => String(c.article_id) === id);
      if (booklet?.semantic_blockers?.length) blockers.push('booklet_geometry_quarantined');
      const standard = standardCandidates.find(c => String(c.article_id) === id);
      if (standard?.semantic_blockers?.length) blockers.push('standard_geometry_quarantined');
      const wetGlue = wetGlueGeometry.find(c => String(c.article_id) === id);
      if (wetGlue?.semantic_blockers?.length) blockers.push('wet_glue_geometry_quarantined');
      const materialKeys = [];
      for (const captured of materials) {
        assert(String(captured.article_id) === id, 'Foreign article material');
        const materialId = String(captured.material.value), key = `${id}:${materialId}`;
        assert(!materialKeys.includes(key), `Duplicate article/material pair ${key}`); materialKeys.push(key);
        const materialValueId = rollLabelPlannedId(`material:${family.source_category_id}:${captured.material.label}`);
        familyMaterials.set(materialValueId,{ id: materialValueId, labelOriginal: captured.material.label,
          labelDa: rollLabelDanishLabel(captured.material.label) });
        const documents = (captured.canonical_document_bindings || []).filter(d => ['guide','template'].includes(d.role));
        const materialBlockers = [...blockers];
        if (captured.errors?.length) materialBlockers.push('source_capture_error');
        const noCustomerArtwork = ['28276','26161','24671','32515','24682','32244','27140'].includes(family.source_category_id)
          || ['65927','65928','65929','65930'].includes(id);
        if (!noCustomerArtwork && !documents.some(d => d.role === 'template')) materialBlockers.push('missing_source_template');
        const profile = { key, familyId: family.source_category_id, productId, articleId: id, sourceMaterialId: materialId,
          materialValueId, formatValueId: rollLabelPlannedId(`format:${id}`),
          labelOriginal: captured.material.label, labelDa: rollLabelDanishLabel(captured.material.label),
          sourceOrder: profiles.length, format, customerArtworkRequired: !noCustomerArtwork,
          optionFields: projectFields(captured), defaultSourceOptions: captured.default_upsells,
          quantityInputs: article.quantity_and_dimensions_inputs,
          sourceQuantities: captured.price_rows.filter(row => Number(row.wert) > 0).map(row => ({
            quantity: Number(row.wert), sourcePriceScaleId: String(row.id), labelOriginal: row.bezeichnung })),
          documents, sourceUrl: article.source_url,
          captureStatus: captured.status, blockers: [...new Set(materialBlockers)],
          sourceEvidencePath: `extraction/articles/${id}/${materialId}.json`,
          sourceEvidenceSha256: captured.sourceEvidenceSha256 || null,
          // Source state was captured for a particular material/default selection.
          // It must be refreshed when dependent fields change, never unioned.
          optionDependencyStatus: 'captured_material_and_default_options_only',
          orderReady: false, designerBindingVerified: false,
        };
        profiles.push(profile);
        for (const row of captured.price_rows) if (Number(row.wert) > 0) sourcePrices.push({
          profileKey: key, articleId: id, materialId, quantity: Number(row.wert),
          sourcePriceScaleId: String(row.id), supplierPrice: row.preis, labelOriginal: row.bezeichnung,
          sourceDefaultOptions: captured.default_upsells, currency: 'EUR',
          evidencePath: profile.sourceEvidencePath, priceMeaning: 'supplier_list_value_requires_total_quote_reconciliation',
        });
        for (const quote of captured.quotes) {
          const response = quote.evidence?.response?.data?.response;
          if (!response) continue;
          exactQuotes.push({ profileKey: key, sourceRequest: quote.evidence.request,
            capturedAt: quote.evidence.captured_at, responseSha256: quote.evidence.response_sha256,
            supplierNetTotal: response.price, supplierGrossTotal: response.priceWithTax,
            basePrice: response.basePrice, setupAndServices: response.articleOptions,
            rollUpsells: response.additionalUpsells, quantity: response.quantity,
            dimensions: response.dimension, validation: quote.validation, currency: response.currency,
            evidencePath: profile.sourceEvidencePath, commercialApproval: false });
        }
      }
      articleProfiles.push({ articleId: id, formatValueId: rollLabelPlannedId(`format:${id}`),
        titleOriginal: article.title_de, format, materialKeys, blockers });
    }
    families.push({ sourceFamilyId: family.source_category_id, productId, slug: rollLabelSlug(family.name_da),
      name: family.name_da, description: family.description_da_draft, sourceGroupId: group.sourceId,
      categoryId: rollLabelPlannedId(`category:${group.sourceId}`), usageSectionId: family.section,
      sourceUrl: family.source_url, articles: articleProfiles, materials: [...familyMaterials.values()],
      relatedProduct: family.related_not_self_adhesive_roll_labels,
      proposedProduct: { id: productId, name: family.name_da, slug: rollLabelSlug(family.name_da),
        category: group.slug, pricing_type: 'matrix', is_published: false, is_ready: false, is_available_to_tenants: false },
      existingProductToPreserve: family.source_category_id === '20649'
        ? { id: 'f4d530bd-d80a-4cd7-8745-8e5431a18fe4', slug: 'wmd-roll-labels-free-size', action: 'review_append_only_collision_before_import' } : null,
    });
  }
  assert(new Set(profiles.map(p => p.key)).size === profiles.length, 'Duplicate captured profile');
  assert(new Set(families.flatMap(f => f.articles.map(a => a.articleId))).size === 472, 'Article scope incomplete');
  return { schemaVersion: 1, state: 'local_catalogue_resolution', sourceSha256,
    databaseWrites: false, proposedIdsOnly: true,
    approvals: { bankWrite: false, productWrite: false, retailPricing: false, publish: false },
    hierarchy: { overview: { id: overviewId, name: 'Klistermærker', slug: 'klistermaerker', sort_order: 0 }, categories },
    sourceGroups: ROLL_LABEL_GROUPS, families, profiles, sourcePrices, exactQuotes,
    counts: { families: families.length, articles: 472, materialProfiles: profiles.length,
      sourcePriceRows: sourcePrices.length, exactQuotes: exactQuotes.length,
      unavailableArticles: families.flatMap(f => f.articles).filter(a => !a.materialKeys.length).map(a => a.articleId) },
  };
}
