#!/usr/bin/env node
/** Public brochure evidence adapter. Local snapshots only; no live importer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { applyConversionRule } from './shared/conversion.js';
import { createNormalizedMatrixRecord } from './shared/normalized-pricing.js';
import { brochureVariants, brochureSupplierNet, brochurePricePolicy } from './shared/brochure-pricing.js';
import { readPackedBrochureCapture } from './shared/brochure-capture-archive.js';

const HOST = 'www.wir-machen-druck.de';
const sourceUrls = new Map();
const freshTokens = new Map();
const output = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : 'output/brochure-2026-10-06';
const articleFilter = process.argv.includes('--article') ? process.argv[process.argv.indexOf('--article') + 1] : null;
const priceMode = process.argv.includes('--prices');
const baseMode = process.argv.includes('--base-prices');
const attributeMode = process.argv.includes('--attributes');
const verifyMode = process.argv.includes('--verify-rules');
const classMode = process.argv.includes('--verify-classes');
const documentMode = process.argv.includes('--documents');
const resumeComplete = process.argv.includes('--resume');
const readyOnly = process.argv.includes('--ready-only');
const workerCount = process.argv.includes('--workers') ? Number(process.argv[process.argv.indexOf('--workers') + 1]) : (baseMode ? 4 : 2);
if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > 4) throw new Error('Use between one and four supplier evidence workers');
const maxMaterials = process.argv.includes('--max-materials') ? Number(process.argv[process.argv.indexOf('--max-materials') + 1]) : Infinity;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const text = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&sup2;/g, '²').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim();
const attributes = s => Object.fromEntries([...s.matchAll(/([\w[\]-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1], text(m[2] ?? m[3])]));

export function readBrochureHtml(html) {
  const inputs = Object.fromEntries([...html.matchAll(/<input\b([^>]*)>/gi)].map(m => attributes(m[1])).filter(a => a.name).map(a => [a.name, a.value || '']));
  const selects = Object.fromEntries([...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)].map(m => [attributes(m[1]).name,
    [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(o => ({ ...attributes(o[1]), label: text(o[2]) }))]));
  return { inputs, selects, pdfs: [...new Set([...html.matchAll(/href="([^"]+\.pdf[^"]*)"/g)].map(m => new URL(m[1], `https://${HOST}`).href))] };
}
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /token|secret|cookie|password/i.test(k) ? '[REDACTED]' : sanitize(v)]));
  return value;
}
async function capture(relative, url, payload) {
  if (new URL(url).hostname !== HOST) throw new Error('Outside supplier allowlist');
  const file = path.join(output, relative);
  let cachedBytes;
  try { cachedBytes = await fs.readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!cachedBytes) cachedBytes = await readPackedBrochureCapture(output, relative);
  try {
    const cached = cachedBytes ? gunzipSync(cachedBytes).toString() : '';
    if (cached.length > 10) return payload ? JSON.parse(cached).response : cached;
  } catch { /* incomplete local snapshot: fetch again */ }
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...(payload ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(45000) });
      if (!response.ok || new URL(response.url).hostname !== HOST) { const error = new Error(`Supplier HTTP ${response.status}`); error.status = response.status; throw error; }
      const raw = await response.text();
      if (!raw.trim()) throw new Error('Empty supplier response');
      const data = payload ? JSON.parse(raw) : raw;
      if (payload && (data.code !== 200 || !data.data?.response)) throw new Error('Supplier API rejected configuration');
      const evidence = payload ? JSON.stringify({ capturedAt: new Date().toISOString(), url, request: sanitize(payload), response: data }) : raw;
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(`${file}.part`, gzipSync(evidence));
      await fs.rename(`${file}.part`, file);
      return data;
    } catch (error) { if (error.code === 'ENOSPC' || error.status === 400) throw error; last = error; await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); }
  }
  throw last;
}
async function refreshPublicToken(articleId) {
  const sourceUrl = sourceUrls.get(articleId);
  if (!sourceUrl || new URL(sourceUrl).hostname !== HOST) throw new Error('Missing exact supplier article for token refresh');
  const response = await fetch(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Supplier page refresh HTTP ${response.status}`);
  const html = await response.text();
  const fresh = readBrochureHtml(html);
  const previous = readBrochureHtml(gunzipSync(await fs.readFile(path.join(output, 'raw/articles', `${articleId}.html.gz`))).toString());
  const identities = config => (config.selects.sorten || []).map(value => [value.value, value.label]);
  if (fresh.inputs.c !== articleId || !fresh.inputs._token || fresh.inputs.categoryId !== previous.inputs.categoryId
      || JSON.stringify(identities(fresh)) !== JSON.stringify(identities(previous))) throw new Error('Supplier article/material inventory changed; review required before resuming prices');
  const target = path.join(output, 'raw/refreshed-articles', `${articleId}.html.gz`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(`${target}.part`, gzipSync(html)); await fs.rename(`${target}.part`, target);
  return fresh.inputs._token;
}
async function post(name, body, relative) {
  const file = `raw/api/${relative}.json.gz`, url = `https://${HOST}/wmdrest/article/${name}`;
  let token = freshTokens.has(body.articleId) ? await freshTokens.get(body.articleId) : body.token;
  try { return (await capture(file, url, { ...body, token })).data.response; }
  catch (error) {
    if (error.status !== 400) throw error;
    if (!freshTokens.has(body.articleId)) freshTokens.set(body.articleId, refreshPublicToken(body.articleId));
    const renewed = await freshTokens.get(body.articleId);
    if (renewed === token) throw error;
    token = renewed;
    return (await capture(file, url, { ...body, token })).data.response;
  }
}

async function articleInventory(article) {
  const html = await capture(`raw/articles/${article.articleId}.html.gz`, article.sourceUrl);
  const config = readBrochureHtml(html);
  if (config.inputs.c !== article.articleId || !config.selects.sorten?.length) throw new Error('Article identity/material inventory mismatch');
  return { articleId: article.articleId, sourceUrl: article.sourceUrl, pageCount: article.source.seitenanzahl,
    widthMm: article.source.endformat_x, heightMm: article.source.endformat_y,
    orientation: article.path[1].id === 13313 ? 'free' : article.path[1].id === 22063 ? 'portrait' : article.path[1].id === 22064 ? 'landscape' : 'square',
    materials: config.selects.sorten.map((m, sourceOrder) => ({ id: m.value, label: m.label, sourceOrder })),
    defaultCoverFields: Object.fromEntries(Object.entries(config.selects).filter(([k]) => k.startsWith('zusatzfeld'))),
    pdfs: config.pdfs, sourceHtmlSha256: hash(html), config };
}

async function extractPrices(article, inventory) {
  if (inventory.orientation === 'free') return { articleId: article.articleId, state: 'requires_exact_dimension_quote', priceRows: 0 };
  const { inputs } = inventory.config;
  let rowCount = 0;
  for (const material of inventory.materials.slice(0, maxMaterials)) {
    const base = { token: inputs._token, articleId: article.articleId, categoryId: inputs.categoryId, shopId: inputs.shopId || '0', userId: '0', substrateId: material.id,
      quantity: '1', ownPrintData: '1', isIndividualQuantity: false, articleOptions: [], additionalOptions: [], additionalUpsells: {}, deliveryOption: '0' };
    const options = await post('get-options', base, `${article.articleId}/${material.id}/options`);
    const quantities = await post('get-sorten-auflage', base, `${article.articleId}/${material.id}/quantities`);
    const fields = Object.values(options.additionalFieldsData || {});
    const groups = fields.filter(f => /umschlag papier|heftung|dispersionslack/i.test(f.bezeichnung));
    const unsupported = fields.filter(f => f.pflicht && !groups.includes(f));
    if (unsupported.length) throw new Error(`Unreviewed mandatory fields for ${article.articleId}/${material.id}: ${unsupported.map(f => f.bezeichnung).join(', ')}`);
    let variants = [{}];
    for (const field of groups) {
      let values = Object.values(field.werte || {}).filter(v => v.visibility !== 0);
      if (/heftung/i.test(field.bezeichnung)) values = values.filter(v => /klassische drahtheftung/i.test(v.bezeichnung));
      if (!values.length) throw new Error('No supported classic stitching/cover/varnish value');
      variants = variants.flatMap(current => values.map(v => ({ ...current, [String(field.id)]: { id: v.id, value: v.bezeichnung } })));
    }
    const rows = [];
    for (const quantity of Object.values(quantities).filter(q => q.wert > 0 && q.wert <= 10000)) {
      for (const upsells of variants) {
        const payload = { ...base, quantity: String(quantity.wert), priceScaleId: String(quantity.id), additionalUpsells: upsells };
        const key = hash(JSON.stringify(upsells)).slice(0, 16);
        const price = await post('get-price', payload, `${article.articleId}/${material.id}/prices/${quantity.wert}-${key}`);
        if (Number(price.quantity) !== Number(quantity.wert) || Number(price.priceScaleId) !== Number(quantity.id) || price.currency !== 'EUR' || Number(price.taxInPercentage) !== 19 || !Number.isFinite(Number(price.price))) throw new Error('Price identity/currency/VAT mismatch');
        const converted = applyConversionRule(Number(price.price), 'wmd_tiered_fx_7_5');
        const selections = { orientation: inventory.orientation, format: `${inventory.widthMm}x${inventory.heightMm}`, pageCount: String(inventory.pageCount), paperCover: material.id,
          ...Object.fromEntries(Object.entries(upsells).map(([id, v]) => [`field_${id}`, String(v.id)])) };
        rows.push(createNormalizedMatrixRecord({ ...converted, supplier: 'wir-machen-druck', sourceType: 'supplier_api', importerKey: 'wmd-saddle-stitched-brochures',
          sourceUrl: article.sourceUrl, sourceKey: article.articleId, productFamily: 'books', quantity: Number(quantity.wert), supplierCurrency: 'EUR',
          conversionRuleKey: converted.ruleKey, dimensions: { widthMm: inventory.widthMm, heightMm: inventory.heightMm }, selections,
          labels: { paperCoverOriginal: material.label }, sourceIdentifiers: { articleId: article.articleId, substrateId: material.id, priceScaleId: quantity.id },
          extraData: { vatState: 'excluded', supplierPriceEvidence: { endpoint: 'get-price', rawFile: `${quantity.wert}-${key}.json.gz` } } }));
      }
    }
    await fs.mkdir(path.join(output, 'normalized/prices', article.articleId), { recursive: true });
    await fs.writeFile(path.join(output, 'normalized/prices', article.articleId, `${material.id}.jsonl.gz`), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n'));
    rowCount += rows.length;
    console.log(`Prices ${article.articleId}/${material.id}: ${rows.length} exact rows`);
  }
  return { articleId: article.articleId, priceRows: rowCount, state: 'extracted' };
}
async function extractBasePrices(article, inventory) {
  if (inventory.orientation === 'free') return { articleId: article.articleId, state: 'requires_exact_dimension_quote', baseRows: 0 };
  const target = path.join(output, 'base-prices', `${article.articleId}.json.gz`);
  const rows = [];
  let index = 0;
  for (const material of inventory.materials) {
    const inputs = inventory.config.inputs;
    const payload = { token: inputs._token, articleId: article.articleId, categoryId: inputs.categoryId, shopId: '0', userId: '0', substrateId: material.id, quantity: '1', isIndividualQuantity: false, ownPrintData: '1', articleOptions: [], additionalOptions: [], additionalUpsells: {}, deliveryOption: '0' };
    const quantities = await post('get-sorten-auflage', payload, `${article.articleId}/${material.id}/quantities`);
    const tiers = Object.values(quantities).filter(q => q.wert > 0 && q.wert <= 10000);
    if (!tiers.length || tiers.some(q => String(q.artikel_sorten__id) !== material.id || !Number.isFinite(Number(q.preis)) || Number(q.preis) <= 0)) throw new Error('Supplier quantity/material/price mismatch');
    rows.push({ substrateId: material.id, sourceOrder: material.sourceOrder, tiers: tiers.map(q => ({ quantity: Number(q.wert), priceScaleId: String(q.id), supplierNetEur: Number(q.preis), ...applyConversionRule(Number(q.preis), 'wmd_tiered_fx_7_5') })) });
    if (++index % 20 === 0) console.log(`Base prices ${article.articleId}: ${index}/${inventory.materials.length}`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(`${target}.part`, gzipSync(JSON.stringify({ articleId: article.articleId, sourceUrl: article.sourceUrl, vatState: 'excluded', currency: 'EUR', state: 'base_only_finish_options_require_verification', rows })));
  await fs.rename(`${target}.part`, target);
  return { articleId: article.articleId, baseRows: rows.reduce((sum, r) => sum + r.tiers.length, 0), state: 'base_extracted' };
}
async function extractAttributes(article, inventory) {
  const inputs = inventory.config.inputs, materials = [];
  const target = path.join(output, 'attributes', `${article.articleId}.json.gz`);
  if (resumeComplete) {
    try {
      const saved = JSON.parse(gunzipSync(await fs.readFile(target)));
      if (saved.articleId === article.articleId && saved.materials.length === inventory.materials.length
          && saved.materials.every((material, index) => material.substrateId === inventory.materials[index].id && Array.isArray(material.fields))) {
        return { articleId: article.articleId, materials: saved.materials.length, state: 'attributes_extracted', resumed: true };
      }
    } catch { /* Resume individual sanitized API captures below. */ }
  }
  let bases;
  if (inventory.orientation !== 'free') {
    try { bases = JSON.parse(gunzipSync(await fs.readFile(path.join(output, 'base-prices', `${article.articleId}.json.gz`)))); } catch { /* Resolve the first native tier from the supplier below. */ }
  }
  for (const material of inventory.materials) {
    const payload = { token: inputs._token, articleId: article.articleId, categoryId: inputs.categoryId, shopId: '0', userId: '0', substrateId: material.id, quantity: '1', isIndividualQuantity: false, ownPrintData: '1', articleOptions: [], additionalOptions: [], additionalUpsells: {}, deliveryOption: '0' };
    if (inventory.orientation !== 'free') {
      let tier = bases?.rows.find(r => r.substrateId === material.id)?.tiers[0];
      if (!tier) {
        const quantities = await post('get-sorten-auflage', payload, `${article.articleId}/${material.id}/quantities`);
        const native = Object.values(quantities).find(q => q.wert > 0 && q.wert <= 10000);
        if (!native || String(native.artikel_sorten__id) !== material.id) throw new Error('Missing native tier for material attributes');
        tier = { quantity: Number(native.wert), priceScaleId: String(native.id) };
      }
      payload.quantity = String(tier.quantity); payload.priceScaleId = tier.priceScaleId;
    }
    const options = await post('get-options', payload, `${article.articleId}/${material.id}/options`);
    materials.push({ substrateId: material.id, fields: Object.values(options.additionalFieldsData || {}).map(f => ({ id: f.id, labelOriginal: f.bezeichnung, mandatory: Boolean(f.pflicht), sourceOrder: f.position, priceType: f.upsell_typ,
      values: Object.values(f.werte || {}).filter(v => v.visibility !== 0).map(v => ({ id: v.id, labelOriginal: v.bezeichnung, sourceOrder: v.sort, preselected: Boolean(v.is_preselected), percentage: Number(v.upsell_percentage), salePrice: Number(v.upsell_sale_price), basePrice: Number(v.upsell_base_price_sale), minimumPrice: Number(v.upsell_percental_min_price) })) })) });
    if (materials.length % 20 === 0) console.log(`Attributes ${article.articleId}: ${materials.length}/${inventory.materials.length}`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(`${target}.part`, gzipSync(JSON.stringify({ articleId: article.articleId, materials }))); await fs.rename(`${target}.part`, target);
  return { articleId: article.articleId, materials: materials.length, state: 'attributes_extracted' };
}
async function verifyPriceRules(article, inventory) {
  if (inventory.orientation === 'free') return { articleId: article.articleId, state: 'dimension_quote_required' };
  const bases = JSON.parse(gunzipSync(await fs.readFile(path.join(output, 'base-prices', `${article.articleId}.json.gz`))));
  const attributes = JSON.parse(gunzipSync(await fs.readFile(path.join(output, 'attributes', `${article.articleId}.json.gz`))));
  const inputs = inventory.config.inputs;
  let verified = 0;
  for (const material of attributes.materials) {
    const variants = brochureVariants(material.fields);
    const signature = hash(JSON.stringify(material.fields));
    const target = path.join(output, 'verified-rules', `${signature}.json`);
    try { const existing = JSON.parse(await fs.readFile(target, 'utf8')); if (existing.verified === true) continue; } catch { /* first observation */ }
    const tiers = bases.rows.find(r => r.substrateId === material.substrateId)?.tiers;
    if (!tiers?.length) throw new Error('Missing supplier base tiers');
    const samples = [...new Map([tiers[0], tiers[Math.floor(tiers.length / 2)], tiers[tiers.length - 1]].map(t => [t.quantity, t])).values()];
    const checks = [];
    for (const tier of samples) for (const variant of variants) {
      const payload = { token: inputs._token, articleId: article.articleId, categoryId: inputs.categoryId, shopId: '0', userId: '0', substrateId: material.substrateId,
        quantity: String(tier.quantity), priceScaleId: tier.priceScaleId, ownPrintData: '1', isIndividualQuantity: false, articleOptions: [], additionalOptions: [], additionalUpsells: variant.upsells, deliveryOption: '0' };
      const key = hash(JSON.stringify(variant.upsells)).slice(0, 16);
      const price = await post('get-price', payload, `${article.articleId}/${material.substrateId}/prices/${tier.quantity}-${key}`);
      const expected = brochureSupplierNet(tier.supplierNetEur, variant.percentage);
      if (Number(price.quantity) !== tier.quantity || String(price.priceScaleId) !== tier.priceScaleId || price.currency !== 'EUR' || Number(price.taxInPercentage) !== 19 || Math.abs(Number(price.price) - expected) > .00001) throw new Error(`Supplier fee model mismatch ${article.articleId}/${material.substrateId}/${tier.quantity}: ${price.price} vs ${expected}`);
      checks.push({ quantity: tier.quantity, selections: variant.selections, baseEur: tier.supplierNetEur, quotedNetEur: Number(price.price), expectedNetEur: expected, rawFile: `raw/api/${article.articleId}/${material.substrateId}/prices/${tier.quantity}-${key}.json.gz` });
    }
    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, JSON.stringify({ verified: true, sourceArticleId: article.articleId, substrateId: material.substrateId, fieldsSha256: signature, checks }, null, 2));
    console.log(`Verified supplier fee rule ${article.articleId}/${material.substrateId}: ${checks.length} exact quotes`); verified++;
  }
  return { articleId: article.articleId, verifiedRuleClasses: verified };
}
async function extractSupplierDocuments(article, inventory) {
  const inputs = inventory.config.inputs;
  const substrateId = inventory.materials[0].id;
  const base = { token: inputs._token, articleId: article.articleId, categoryId: inputs.categoryId, shopId: '0', customerId: '0', substrateId,
    additionalOptions: [0], productDimensions: inventory.orientation === 'free' ? { width: 14.8, height: 21 } : { width: inventory.widthMm / 10, height: inventory.heightMm / 10 } };
  const response = await post('print-template', base, `${article.articleId}/${substrateId}/print-template`);
  const target = path.join(output, 'documents/source-map', `${article.articleId}.json`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(`${target}.part`, JSON.stringify({ articleId: article.articleId, substrateId, response }));
  await fs.rename(`${target}.part`, target);
  return { articleId: article.articleId, state: 'documents_captured' };
}
async function verifyBrochurePriceClasses(articles) {
  const groups = new Map(), bindings = [], articleById = new Map(articles.map(article => [article.articleId, article]));
  for (const article of articles) {
    const inventory = JSON.parse(await fs.readFile(path.join(output, 'inventory', `${article.articleId}.json`)));
    if (inventory.orientation === 'free') continue;
    const baseBytes = await fs.readFile(path.join(output, 'base-prices', `${article.articleId}.json.gz`));
    const attributes = JSON.parse(gunzipSync(await fs.readFile(path.join(output, 'attributes', `${article.articleId}.json.gz`))));
    if (attributes.materials.length !== inventory.materials.length) throw new Error('Incomplete brochure attribute inventory');
    for (const [index, material] of attributes.materials.entries()) {
      if (material.substrateId !== inventory.materials[index].id) throw new Error('Brochure attribute order/identity mismatch');
      const policy = brochurePricePolicy(material.fields);
      const format = `${inventory.widthMm}x${inventory.heightMm}`;
      const policyKey = hash(JSON.stringify({ format, policy }));
      const member = { articleId: article.articleId, substrateId: material.substrateId, pageCount: inventory.pageCount, sourceOrder: index,
        fieldsSha256: hash(JSON.stringify(material.fields)), basePricesSha256: hash(baseBytes), policyKey };
      bindings.push(member);
      if (!groups.has(policyKey)) groups.set(policyKey, { policyKey, format, policy, members: [] });
      groups.get(policyKey).members.push(member);
    }
  }
  const jobs = [...groups.values()]; let cursor = 0;
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < jobs.length) {
      const group = jobs[cursor++];
      group.members.sort((left, right) => left.pageCount - right.pageCount || left.articleId.localeCompare(right.articleId) || left.sourceOrder - right.sourceOrder);
      group.scopeSha256 = hash(JSON.stringify(group.members));
      const target = path.join(output, 'verified-policy-classes', `${group.policyKey}.json`);
      try { const previous = JSON.parse(await fs.readFile(target)); if (previous.verified && previous.scopeSha256 === group.scopeSha256) { group.checks = previous.checks; continue; } } catch { /* verify new exact coverage */ }
      const samples = [...new Map([group.members[0], group.members[Math.floor(group.members.length / 2)], group.members[group.members.length - 1]]
        .map(member => [`${member.articleId}/${member.substrateId}`, member])).values()];
      const checks = [];
      for (const member of samples) {
        const article = articleById.get(member.articleId), inventory = await articleInventory(article), inputs = inventory.config.inputs;
        const base = JSON.parse(gunzipSync(await fs.readFile(path.join(output, 'base-prices', `${member.articleId}.json.gz`))));
        const attrs = JSON.parse(gunzipSync(await fs.readFile(path.join(output, 'attributes', `${member.articleId}.json.gz`))));
        const material = attrs.materials.find(value => value.substrateId === member.substrateId);
        const variants = brochureVariants(material.fields), tiers = base.rows.find(value => value.substrateId === member.substrateId).tiers;
        const quantities = [...new Map([tiers[0], tiers[Math.floor(tiers.length / 2)], tiers[tiers.length - 1]].map(tier => [tier.quantity, tier])).values()];
        for (const tier of quantities) for (const variant of variants) {
          const payload = { token: inputs._token, articleId: member.articleId, categoryId: inputs.categoryId, shopId: '0', userId: '0', substrateId: member.substrateId,
            quantity: String(tier.quantity), priceScaleId: tier.priceScaleId, ownPrintData: '1', isIndividualQuantity: false, articleOptions: [], additionalOptions: [], additionalUpsells: variant.upsells, deliveryOption: '0' };
          const key = hash(JSON.stringify(variant.upsells)).slice(0, 16), relative = `${member.articleId}/${member.substrateId}/prices/${tier.quantity}-${key}`;
          const price = await post('get-price', payload, relative), expected = brochureSupplierNet(tier.supplierNetEur, variant.percentage);
          if (Number(price.quantity) !== tier.quantity || String(price.priceScaleId) !== tier.priceScaleId || price.currency !== 'EUR' || Number(price.taxInPercentage) !== 19 || Math.abs(Number(price.price) - expected) > .00001) throw new Error(`Brochure price policy mismatch ${relative}`);
          checks.push({ articleId: member.articleId, substrateId: member.substrateId, pageCount: member.pageCount, quantity: tier.quantity,
            selections: variant.selections, baseEur: tier.supplierNetEur, quotedNetEur: Number(price.price), expectedNetEur: expected, rawFile: `raw/api/${relative}.json.gz` });
        }
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(`${target}.part`, JSON.stringify({ verified: true, format: group.format, policy: group.policy, policyKey: group.policyKey, scopeSha256: group.scopeSha256, members: group.members, checks }));
      await fs.rename(`${target}.part`, target); group.checks = checks;
      console.log(`Verified ${group.format}: ${group.members.length} native configurations, ${checks.length} exact quotes`);
    }
  }));
  const index = { version: 1, verified: true, fixedArticles: articles.filter(article => article.path[1].id !== 13313).length,
    scopeSha256: hash(JSON.stringify(bindings)), bindings, classes: jobs.map(({ policyKey, format, scopeSha256, checks }) => ({ policyKey, format, scopeSha256, checks: checks.length })) };
  const target = path.join(output, articleFilter ? `verified-policy-index-${articleFilter}.json` : 'verified-policy-index.json');
  await fs.writeFile(`${target}.part`, JSON.stringify(index)); await fs.rename(`${target}.part`, target);
  console.log(JSON.stringify({ classes: jobs.length, configurations: bindings.length, exactQuoteChecks: jobs.reduce((sum, group) => sum + group.checks.length, 0), databaseWrites: false }));
}
async function main() {
  const discovery = JSON.parse(await fs.readFile(path.join(output, 'discovery.json'), 'utf8'));
  for (const article of discovery.articles) sourceUrls.set(article.articleId, article.sourceUrl);
  let articles = discovery.articles.filter(a => !articleFilter || a.articleId === articleFilter).sort((a, b) => (a.articleId === '973' ? -1 : b.articleId === '973' ? 1 : 0));
  if (classMode) { await verifyBrochurePriceClasses(articles); return; }
  if (documentMode && !articleFilter) {
    const seen = new Set();
    articles = articles.filter(article => { const key = article.path[1].id === 13313 ? 'free' : `${article.source.endformat_x}x${article.source.endformat_y}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }
  let pendingArticles = 0;
  if (readyOnly) {
    if (!verifyMode) throw new Error('--ready-only requires --verify-rules');
    const available = await Promise.all(articles.map(async article => {
      try {
        await fs.access(path.join(output, 'base-prices', `${article.articleId}.json.gz`));
        await fs.access(path.join(output, 'attributes', `${article.articleId}.json.gz`));
        return article;
      } catch { pendingArticles++; return null; }
    }));
    articles = available.filter(Boolean);
  }
  const failures = [], results = [];
  let cursor = 0;
  await fs.mkdir(path.join(output, 'inventory'), { recursive: true });
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < articles.length) {
      const article = articles[cursor++];
      try {
        const inventory = await articleInventory(article);
        const { config, ...publicInventory } = inventory;
        const inventoryFile = path.join(output, 'inventory', `${article.articleId}.json`);
        const inventoryJson = JSON.stringify(publicInventory);
        let unchanged = false;
        try { unchanged = await fs.readFile(inventoryFile, 'utf8') === inventoryJson; } catch { /* first capture */ }
        if (!unchanged) { await fs.writeFile(`${inventoryFile}.part`, inventoryJson); await fs.rename(`${inventoryFile}.part`, inventoryFile); }
        results.push(documentMode ? await extractSupplierDocuments(article, inventory) : verifyMode ? await verifyPriceRules(article, inventory) : attributeMode ? await extractAttributes(article, inventory) : baseMode ? await extractBasePrices(article, inventory) : priceMode ? await extractPrices(article, inventory) : { articleId: article.articleId, materials: inventory.materials.length });
        console.log(`Article ${article.articleId}: ${inventory.materials.length} material/cover pairs (${results.length}/${articles.length})`);
      } catch (error) { if (error.code === 'ENOSPC') throw error; failures.push({ articleId: article.articleId, reason: error.message }); console.error(`Article ${article.articleId}: ${error.message}`); }
    }
  }));
  await fs.writeFile(path.join(output, documentMode ? 'document-progress.json' : verifyMode ? 'rule-progress.json' : attributeMode ? 'attribute-progress.json' : baseMode ? 'base-price-progress.json' : priceMode ? 'price-progress.json' : 'inventory-progress.json'), JSON.stringify({ results, failures, pendingArticles, complete: failures.length === 0 && pendingArticles === 0, databaseWrites: false }, null, 2));
  console.log(JSON.stringify({ completed: results.length, failed: failures.length, databaseWrites: false }));
  if (failures.length) process.exitCode = 1;
}
if (process.argv[1] === new URL(import.meta.url).pathname) await main();
