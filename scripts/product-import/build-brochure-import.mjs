#!/usr/bin/env node
/** Source-specific staging only. Canonical pricing/conversion and the current
 * manifest validator remain the boundaries for any later approved DB import. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { brochureVariants, brochureSupplierNet, brochurePricePolicy } from './shared/brochure-pricing.js';
import { applyConversionRule } from './shared/conversion.js';
import { createNormalizedMatrixRecord } from './shared/normalized-pricing.js';
import { brochurePaperLabelDa as danish } from './shared/brochure-copy.js';

const root = 'output/brochure-2026-10-06';
const articleFilter = process.argv.includes('--article') ? process.argv[process.argv.indexOf('--article') + 1] : null;
const allowPartial = process.argv.includes('--allow-partial');
const target = path.join(root, 'review', articleFilter || 'complete');
const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file));
const readGz = async file => JSON.parse(gunzipSync(await fs.readFile(file)));
const discovery = await read(path.join(root, 'discovery.json'));
const sourceArchive = await readGz(path.join(root, 'raw/api-snapshots-index.json.gz'));
const sourceArticles = discovery.articles.filter(article => !articleFilter || article.articleId === articleFilter);
if (!sourceArticles.length) throw new Error('Unknown brochure article');
const templates = new Map((await read(path.join(root, 'documents/templates.json'))).map(template => [template.key, template]));
const guides = new Map((await read(path.join(root, 'documents/native-guides.json'))).map(guide => [guide.key, guide]));
let policyIndex;
try { policyIndex = await read(path.join(root, articleFilter ? `verified-policy-index-${articleFilter}.json` : 'verified-policy-index.json')); } catch { /* Exact field proofs can still be used for partial review. */ }
const policies = new Map((policyIndex?.verified ? policyIndex.bindings : []).map(binding => [`${binding.articleId}/${binding.substrateId}`, binding]));
const groups = new Map(['orientation', 'format', 'pageCount', 'paperCover', 'cover', 'varnish'].map(key => [key, new Map()]));
const originals = { orientation: 'Ausrichtung', format: 'Endformat', pageCount: 'Seitenanzahl', paperCover: 'Inhalt und Umschlag', cover: 'Umschlag Papier', varnish: 'Dispersionslack auf Umschlag' };
const labels = { orientation: 'Retning', format: 'Format', pageCount: 'Sider inklusive omslag', paperCover: 'Indhold og omslag', cover: 'Omslagets papirtype', varnish: 'Dispersionslak på omslag' };
const orientationNames = { portrait: 'Lodret', landscape: 'Vandret', square: 'Kvadratisk', free: 'Fri størrelse' };
const coverNames = { matte: 'Mat', gloss: 'Blank', recycled: 'Genbrug', natural: 'Naturpapir', default: 'Fast specialomslag' };
const varnishNames = { none: 'Uden ekstra lak', dispersion_matte: 'Mat dispersionslak' };
function option(key, value, labelOriginal, labelDa, meta = {}) {
  const previous = groups.get(key).get(value);
  if (previous && previous.labelOriginal !== labelOriginal) throw new Error(`Conflicting source option ${key}/${value}`);
  if (!previous) groups.get(key).set(value, { key: value, labelOriginal, labelDa, sourceOrder: groups.get(key).size, meta });
}
const configurations = [], quarantine = [], quantities = new Set();
for (const article of sourceArticles) {
  const inventory = await read(path.join(root, 'inventory', `${article.articleId}.json`));
  const format = inventory.orientation === 'free' ? 'free' : `${inventory.widthMm}x${inventory.heightMm}`;
  option('orientation', inventory.orientation, inventory.orientation, orientationNames[inventory.orientation]);
  option('format', format, format, format === 'free' ? 'Fri størrelse' : `${inventory.widthMm} × ${inventory.heightMm} mm`, { widthMm: inventory.widthMm, heightMm: inventory.heightMm });
  option('pageCount', String(inventory.pageCount), `${inventory.pageCount} Seiten`, `${inventory.pageCount} sider`, { brochurePageCount: inventory.pageCount });
  for (const material of inventory.materials) option('paperCover', material.id, material.label, danish(material.label));
  if (inventory.orientation === 'free') {
    quarantine.push({ articleId: article.articleId, state: 'exact_dimension_quote_required', pageCount: inventory.pageCount, materials: inventory.materials.length,
      reasonDa: 'Fri størrelse prissættes kun ved de præcise mål via den afgrænsede tilbudsadapter. Ingen fast formatpris eller interpolation.',
      quoteEndpoint: '/api/brochure-quote', boundsMm: { minWidth: 98, maxWidth: 297, minHeight: 98, maxHeight: 297 } });
    continue;
  }
  let base, attributes, baseHash;
  try { const bytes = await fs.readFile(path.join(root, 'base-prices', `${article.articleId}.json.gz`)); base = JSON.parse(gunzipSync(bytes)); baseHash = sha(bytes); attributes = await readGz(path.join(root, 'attributes', `${article.articleId}.json.gz`)); }
  catch (error) { quarantine.push({ articleId: article.articleId, state: 'incomplete_source', reason: error.message }); continue; }
  const guide = guides.get(format), template = templates.get(format);
  if (!guide?.factsReviewed || !template?.factsReviewed || guide.templateSourceUrl !== template.sourceUrl) throw new Error(`Missing reviewed native documents for ${format}`);
  for (const material of inventory.materials) {
    const fields = attributes.materials.find(value => value.substrateId === material.id)?.fields;
    const tiers = base.rows.find(value => value.substrateId === material.id)?.tiers;
    if (!fields || !tiers?.length) { quarantine.push({ articleId: article.articleId, substrateId: material.id, state: 'incomplete_material' }); continue; }
    const fieldsHash = sha(fields), policyKey = sha({ format, policy: brochurePricePolicy(fields) }), binding = policies.get(`${article.articleId}/${material.id}`);
    const verified = binding?.fieldsSha256 === fieldsHash && binding?.basePricesSha256 === baseHash && binding?.policyKey === policyKey;
    if (!verified) { quarantine.push({ articleId: article.articleId, substrateId: material.id, state: 'finish_fee_verification_pending' }); continue; }
    for (const variant of brochureVariants(fields)) {
      option('cover', variant.cover, variant.cover, coverNames[variant.cover]); option('varnish', variant.varnish, variant.varnish, varnishNames[variant.varnish]);
      const selections = { orientation: inventory.orientation, format, pageCount: String(inventory.pageCount), paperCover: material.id, cover: variant.cover, varnish: variant.varnish };
      configurations.push({ article, inventory, material, variant, tiers, selections, template, guide, fieldsHash, policyKey, baseHash });
      for (const tier of tiers) quantities.add(tier.quantity);
    }
  }
}
const unresolved = quarantine.filter(row => row.state !== 'exact_dimension_quote_required');
if (unresolved.length && !allowPartial) throw new Error(`${unresolved.length} configurations still need source/fee verification; no complete import package written`);
await fs.mkdir(path.join(target, 'normalized'), { recursive: true }); await fs.mkdir(path.join(target, 'documents'), { recursive: true });
for (const template of templates.values()) {
  const bytes = await fs.readFile(path.join('public', template.templateUrl));
  if (sha(bytes) !== template.templatePdfSha256) throw new Error(`Changed brochure template ${template.key}`);
  await fs.writeFile(path.join(target, 'documents', `${template.key}.pdf`), bytes);
}
async function writer(relative) {
  const file = path.join(target, relative), handle = await fs.open(`${file}.part`, 'w');
  const hash = createHash('sha256'); let buffer = '', bytes = 0, rowCount = 0;
  const flush = async () => { if (!buffer) return; const chunk = Buffer.from(buffer); hash.update(chunk); bytes += chunk.length; await handle.writeFile(chunk); buffer = ''; };
  return { async row(value) { buffer += JSON.stringify(value) + '\n'; rowCount++; if (buffer.length > 1024 * 1024) await flush(); },
    async close() { await flush(); await handle.close(); await fs.rename(`${file}.part`, file); return { path: relative, format: 'jsonl', sha256: hash.digest('hex'), bytes, rowCount }; } };
}
const prices = await writer('normalized/pricing.jsonl'), documents = await writer('normalized/document-bindings.jsonl'), evidence = await writer('normalized/configuration-evidence.jsonl');
let priceOrder = 0, documentOrder = 0;
for (const configuration of configurations) {
  const { article, inventory, material, variant, tiers, selections, template, guide, fieldsHash, policyKey, baseHash } = configuration;
  for (const tier of tiers) {
    const converted = applyConversionRule(brochureSupplierNet(tier.supplierNetEur, variant.percentage), 'wmd_tiered_fx_7_5');
    const canonical = createNormalizedMatrixRecord({ ...converted, supplier: 'wir-machen-druck', sourceType: 'supplier_api', importerKey: 'wmd-saddle-stitched-brochures',
      // The actual quote endpoint is the price source. The exact article URL
      // stays in configuration evidence, avoiding millions of repeated slugs.
      sourceUrl: 'https://www.wir-machen-druck.de/wmdrest/article/get-price', sourceKey: article.articleId, productFamily: 'books', conversionRuleKey: converted.ruleKey,
      quantity: tier.quantity, selections, dimensions: { widthMm: inventory.widthMm, heightMm: inventory.heightMm } });
    // Compact canonical review projection; exact request IDs, option inventories
    // and raw payloads are retained in the separate evidence index and snapshots.
    await prices.row({ sourceOrder: priceOrder++, quantity: canonical.quantity, supplierPrice: canonical.supplierPrice, convertedPriceDkk: canonical.convertedPriceDkk,
      finalPriceDkk: canonical.finalPriceDkk, sourceUrl: canonical.sourceUrl, selections: canonical.selections });
  }
  const documentKey = `${article.articleId}-${material.id}-${variant.cover}-${variant.varnish}`;
  await documents.row({ sourceOrder: documentOrder++, documentKey, match: selections,
    guide: { sourceUrl: guide.guideSourceUrl, nativeGuideKey: `brochure-${template.key}`, factsReviewed: true },
    template: { sourceUrl: guide.templateSourceUrl, sanitizedPdfPath: `documents/${template.key}.pdf`, sanitizedPdfSha256: template.templatePdfSha256,
      designerTemplateId: null, widthMm: template.widthMm, heightMm: template.heightMm, bleedMm: template.bleedMm, safeMm: template.safeMm, pageCount: 1,
      metadataRemoved: true, supplierBrandingRemoved: true, artworkMode: 'online_designer', onlineDesignerAllowed: true, designerLoadMode: 'locked_non_printing_guide_overlay',
      lockedInDesigner: true, nonPrintingOverlay: true, excludedFromExport: true, verificationStatus: 'pending' } });
  await evidence.row({ documentKey, selections, sourceArticleId: article.articleId, sourceSubstrateId: material.id, materialSourceOrder: material.sourceOrder,
    sourceUrl: article.sourceUrl, originalLabel: material.label, fieldsSha256: fieldsHash, policyKey, supplierPercentage: variant.percentage, selectedSupplierUpsells: variant.upsells,
    nativeTiersArtifact: `base-prices/${article.articleId}.json.gz`, nativeBasePricesSha256: baseHash, sourceHtmlSha256: inventory.sourceHtmlSha256, nativeFieldsArtifact: `attributes/${article.articleId}.json.gz`, guideSha256: guide.guideSha256 });
  if (documentOrder % 1000 === 0) { const disk = await fs.statfs(target); if (disk.bavail * disk.bsize < 300 * 1024 * 1024) throw new Error('Less than 300 MB disk reserve; staging paused before filling the disk'); console.log(`Staged ${documentOrder} configurations / ${priceOrder} price rows`); }
}
const priceArtifact = await prices.close(), documentArtifact = await documents.close(), evidenceArtifact = await evidence.close();
const manifest = { schemaVersion: 2, runId: `wmd-brochures-2026-10-06${articleFilter ? `-${articleFilter}` : ''}`,
  source: { supplierSlug: 'wir-machen-druck', entryUrl: 'https://www.wir-machen-druck.de/broschuere-drahtheftung,category,9434.html', scopeMode: 'single_product_family',
    allowedHosts: ['www.wir-machen-druck.de'], extractor: 'bounded_native_brochure_api_adapter', capturedAt: new Date().toISOString() },
  product: { sourceKey: 'wmd-saddle-stitched-brochures-9434', family: 'books', nameOriginal: 'Broschüren mit klassischer Drahtheftung', nameDa: 'Brochurer med trådhæftning',
    descriptionOriginal: 'Broschüren mit klassischer Drahtheftung, 4/4-farbig.', descriptionDa: 'Magasiner, programmer og brochurer med klassisk trådhæftning. Vælg format, sidetal, indholdspapir og omslag. Fuldfarvetryk på begge sider. Sidetallet omfatter omslaget.', sourceLanguage: 'de', targetLanguage: 'da' },
  optionGroups: [...groups].map(([key, values], sourceOrder) => ({ key, labelOriginal: originals[key], labelDa: labels[key], displayType: key === 'pageCount' ? 'dropdown' : 'buttons', sourceOrder, values: [...values.values()] })),
  pricing: { supplierCurrency: 'EUR', vatState: 'excluded', conversionRuleKey: 'wmd_tiered_fx_7_5', recordsArtifact: priceArtifact }, documents: { recordsArtifact: documentArtifact },
  target: { mode: 'supplier_bank', state: 'extracted', publishProduct: false, writeLivePricing: false },
  artifacts: { rawSnapshot: '../../discovery.json', normalizedPricing: priceArtifact.path, reviewReport: 'report.md', configurationEvidence: evidenceArtifact,
    nativeApiArchive: { path: '../../'+sourceArchive.archivePath, sha256: sourceArchive.archiveSha256, bytes: sourceArchive.archiveBytes, fileCount: sourceArchive.fileCount, byteVerified: sourceArchive.byteVerified } },
  coverage: { fixedSourceArticles: sourceArticles.filter(article => article.path[1].id !== 13313).length, normalizedPriceRows: configurations.reduce((sum, configuration) => sum + configuration.tiers.length, 0),
    fixedConfigurationsComplete: unresolved.length === 0, quarantinedConfigurations: unresolved.length, dynamicFreeSize: quarantine.filter(row => row.state === 'exact_dimension_quote_required') } };
await fs.writeFile(path.join(target, 'quarantine.json'), JSON.stringify(quarantine, null, 2));
await fs.writeFile(path.join(target, 'import-manifest.json'), JSON.stringify(manifest, null, 2));
await fs.writeFile(path.join(target, 'report.md'), `# Brochure import review\n\n${priceArtifact.rowCount} canonical price projections; ${documentArtifact.rowCount} exact document bindings.\n\nFixed configurations complete: ${manifest.coverage.fixedConfigurationsComplete}. Unresolved: ${unresolved.length}.\n\nFree size remains an exact-dimension native quote, 98–297 mm on both axes. It never inherits a fixed-format price.\n\nOnly classic wire stitching, requested cover choices and dispersion varnish are included. Other paid effects remain at the explicit zero-cost supplier default. Net EUR prices use existing wmd_tiered_fx_7_5 conversion. Fee policies are checked against stored native quotes; no interpolation or invented quantities.\n\nNo database writes or publication. Before an approved draft import, resolve the target tenant, rebuild canonical rows from this projection and evidence, and reuse the existing matrix publisher.\n`);
console.log(JSON.stringify({ target, pricing: priceArtifact, documents: documentArtifact, complete: manifest.coverage.fixedConfigurationsComplete, databaseWrites: false }));
