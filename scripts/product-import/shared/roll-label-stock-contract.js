import { createHash } from 'node:crypto';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const number = text => Number(text.replace(',', '.'));
const textOf = value => String(value || '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,' ')
  .replace(/&(?:uuml|Uuml);/g,'ü').replace(/&(?:auml|Auml);/g,'ä').replace(/&(?:ouml|Ouml);/g,'ö')
  .replace(/&szlig;/g,'ß').replace(/&times;/g,'×').replace(/&nbsp;/g,' ').replace(/&agrave;|&#(?:224|xE0);/g,'à').replace(/\s+/g,' ').trim();
const unique = values => [...new Set(values)];
function assertion(condition, message) { if (!condition) throw Error(message); }

/** Exact local preparation for a stock article. A family ID, H article type or
 * ownPrintData=1 alone is not evidence that the customer's artwork is absent.
 * Quantity/price-scale IDs are retained, never converted to numbers of labels. */
export function prepareRollLabelStockContract(family, profile, rawBytes) {
  assertion(profile.customerArtworkRequired === false && !profile.blockers.length, 'Not an eligible stock profile');
  assertion(sha(rawBytes) === profile.sourceEvidenceSha256, 'Changed source material');
  const raw = JSON.parse(rawBytes), article = family.articles.find(a => a.articleId === profile.articleId);
  assertion(article && String(raw.article_id) === profile.articleId && String(raw.material.value) === profile.sourceMaterialId
    && profile.key === `${profile.articleId}:${profile.sourceMaterialId}`, 'Foreign source identity');
  const quotes = raw.quotes.map(q => q.evidence);
  assertion(quotes.length && quotes.every(q => String(q.request.articleId) === profile.articleId
    && String(q.request.substrateId) === profile.sourceMaterialId && q.response.code === 200 && q.response.data.response.articleType === 'H'), 'Missing exact stock responses');
  const descriptions = unique(quotes.map(q => textOf(q.response.data.response.articleDescription)));
  const text = descriptions.join('\n'), title = article.titleOriginal;
  let kind;
  if (/neutrales Muster/i.test(title) && /Musterst(?:r)?eifen/i.test(text)) kind='neutral_booklet_sample';
  else if (/Thermotransfer(?:folie|band)/i.test(title) && /Thermotransferband|Premium Wachsqualität/i.test(text)) kind='thermal_transfer_ribbon';
  else if (/unbedruckt/i.test(text) && /DIN-A4-Bogen/i.test(text)) kind='blank_a4_sheet_pack';
  else if (/unbedruckt/i.test(text) && /Thermotransfer|Thermo|Inkjet|Typenschild/i.test(title+' '+text)) kind='blank_label_roll';
  else if (/^Hinweisetiketten\b/i.test(title) && /bedruckt/i.test(text) && /Pro Rolle:/i.test(text)) kind='preprinted_notice_roll';
  assertion(kind, 'Stock classification not demonstrated by exact source text: '+profile.key);
  const rows=raw.price_rows.filter(r=>Number(r.wert)>0);
  assertion(rows.length && rows.length === profile.sourceQuantities.length && rows.every((r,i)=>
    Number(r.wert) === profile.sourceQuantities[i].quantity && String(r.id) === profile.sourceQuantities[i].sourcePriceScaleId
    && r.bezeichnung === profile.sourceQuantities[i].labelOriginal && String(r.artikel_sorten__id) === profile.sourceMaterialId), 'Changed source quantity/scale binding');
  const quantities=rows.map(r=>({quantity:Number(r.wert),sourcePriceScaleId:String(r.id),sourceLabel:r.bezeichnung}));
  assertion(quantities.every(r=>Number.isSafeInteger(r.quantity)&&r.quantity>0) && unique(quantities.map(r=>r.quantity)).length === quantities.length, 'Invalid stock quantities');
  const packaging={};
  const labels=unique([...text.matchAll(/(?:Stückzahl pro Rolle|Etiketten pro Rolle|Pro Rolle)\s*:\s*(\d+)/gi)].map(m=>Number(m[1])));
  assertion(labels.length<=1,'Conflicting labels-per-roll');
  if(labels.length) packaging.labelsPerRoll=labels[0];
  if(kind==='thermal_transfer_ribbon') {
    const m=title.match(/(\d+(?:[,.]\d+)?)\s*mm\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*m\b/i);
    assertion(m,'Missing ribbon width/length units');packaging.ribbonWidthMm=number(m[1]);packaging.ribbonLengthM=number(m[2]);
  }
  if(kind==='blank_a4_sheet_pack') {
    const packs=unique([...text.matchAll(/Pro Packung:\s*(\d+)\s*Bogen\s*à\s*(\d+)\s*Etikett\w*\s*=\s*(\d+)\s*Etiketten/gi)].map(m=>`${m[1]}:${m[2]}:${m[3]}`));
    assertion(packs.length===1,'Missing/conflicting sheet packaging formula: '+profile.key);
    const [sheets,perSheet,total]=packs[0].split(':').map(Number);assertion(sheets*perSheet===total,'Invalid sheet package arithmetic');
    Object.assign(packaging,{sheetsPerPack:sheets,labelsPerSheet:perSheet,labelsPerPack:total});
  }
  if(kind==='neutral_booklet_sample') {
    const count=text.match(/Musterst(?:r)?eifen von\s*(\d+)\s*Etiketten/i);assertion(count,'Missing sample strip label count');packaging.sampleLabels=Number(count[1]);
  }
  const sourceQuantityUnit=quantities.every(r=>/^\d+\s+Rollen\b/.test(r.sourceLabel)) ? 'rolls' : 'source_items';
  const payload={version:1,status:'source_stock_preparation_only',familyId:family.sourceFamilyId,productId:family.productId,
    profileKey:profile.key,articleId:profile.articleId,materialId:profile.sourceMaterialId,sourceEvidenceSha256:profile.sourceEvidenceSha256,
    sourceEvidencePath:profile.sourceEvidencePath,kind,sourceTitle:title,descriptionTextSha256:sha(Buffer.from(text)),
    sourceQuantityUnit,quantities,packaging,sourceDescriptions:descriptions,
    quoteIdentities:quotes.map(q=>({requestSha256:sha(Buffer.from(JSON.stringify(q.request))),quantity:q.request.quantity,
      sourcePriceScaleId:String(q.request.priceScaleId||q.response.data.response.priceScaleId),sourceArticleType:'H'})),
    customerArtworkRequired:false,onlineDesignerAllowed:false,quantityConvertedToLabels:false,orderReady:false};
  return {...payload,sha256:sha(Buffer.from(JSON.stringify(payload)))};
}
