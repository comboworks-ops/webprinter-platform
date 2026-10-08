import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildRollLabelStockDisplay} from './roll-label-stock-display.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const number=s=>Number(s.replace(',','.'));
const mm=(s,unit)=>Number((number(s)*(unit.toLowerCase()==='cm'?10:1)).toFixed(6));
const n=value=>value.toLocaleString('da-DK',{maximumFractionDigits:6});

// Display numbers only. Never populate width_mm, source request dimensions,
// geometry, template bindings or production permissions from this contract.
export function prepareRollLabelStockFormatDisplay(family,profile,stockContract,articleBytes) {
  const stock=buildRollLabelStockDisplay(family,profile,stockContract);
  assert.ok(stock);
  const article=family.articles.find(a=>a.articleId===profile.articleId), source=JSON.parse(articleBytes);
  assert.equal(String(source.article_id),profile.articleId); assert.equal(source.title,article.titleOriginal);
  assert.equal(source.status,200); assert.equal(profile.format.customSize,false);
  const title=source.title;
  let dimensions;
  if(stock.kind==='thermal_transfer_ribbon') {
    const m=title.match(/(\d+(?:[,.]\d+)?)\s*mm\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*m\b/i);
    assert.ok(m,'Missing explicit ribbon units');
    dimensions={kind:'ribbon_mm_m',widthMm:number(m[1]),lengthM:number(m[2])};
    assert.equal(dimensions.widthMm,stock.packaging.ribbonWidthMm);assert.equal(dimensions.lengthM,stock.packaging.ribbonLengthM);
  } else if(stock.kind==='neutral_booklet_sample' && profile.format.shape==='circle') {
    const m=title.match(/(\d+(?:[,.]\d+)?)\s*(mm|cm)\s*Ø/i);
    assert.ok(m,'Missing explicit sample diameter');dimensions={kind:'diameter_mm',diameterMm:mm(m[1],m[2])};
  } else {
    const matches=[...title.matchAll(/(\d+(?:[,.]\d+)?)\s*(mm|cm)?\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*(mm|cm)\b/gi)];
    assert.equal(matches.length,1,'Missing or ambiguous label size');const m=matches[0];
    assert.ok(!m[2] || m[2].toLowerCase()===m[4].toLowerCase(),'Mixed label units');
    dimensions={kind:'label_mm',widthMm:mm(m[1],m[4]),heightMm:mm(m[3],m[4])};
    if(profile.format.dimensions) for(const key of ['widthMm','heightMm']) assert.ok(Math.abs(dimensions[key]-profile.format.dimensions[key])<1e-8,'Changed physical label size');
    if(stock.kind==='blank_a4_sheet_pack') {
      const count=title.match(/\((\d+)\s*Etikett\w*\s*\/\s*Bogen\)/i);
      assert.ok(count);assert.equal(Number(count[1]),stock.packaging.labelsPerSheet);
    }
  }
  assert.ok(Object.entries(dimensions).filter(([key])=>key!=='kind').every(([,value])=>Number.isFinite(value)&&value>0));
  const payload={version:1,productId:profile.productId,familyId:profile.familyId,profileKey:profile.key,
    articleId:profile.articleId,materialId:profile.sourceMaterialId,formatValueId:profile.formatValueId,
    sourceEvidenceSha256:profile.sourceEvidenceSha256,sourceStockContractSha256:stock.sourceContractSha256,
    articleEvidenceSha256:sha(articleBytes),dimensions,geometryAccepted:false,orderReady:false};
  return {...payload,sha256:sha(JSON.stringify(payload))};
}

export function rollLabelStockFormatCaption(article,stock,display,baseName) {
  if(!display)return baseName;
  const {sha256,...payload}=display;
  assert.equal(sha(JSON.stringify(payload)),sha256,'Changed format display contract');
  assert.ok(stock,'Missing stock binding');assert.equal(display.sourceStockContractSha256,stock.sha256);
  assert.equal(display.sourceEvidenceSha256,stock.sourceEvidenceSha256);
  assert.equal(display.profileKey,stock.profileKey);assert.equal(display.productId,stock.productId);assert.equal(display.familyId,stock.familyId);
  assert.equal(display.geometryAccepted,false);assert.equal(display.orderReady,false);
  assert.equal(display.articleId,article.articleId);assert.equal(display.formatValueId,article.formatValueId);
  const d=display.dimensions;
  if(d.kind==='ribbon_mm_m')return `Bånd ${n(d.widthMm)} mm × ${n(d.lengthM)} m`;
  if(stock.kind==='blank_a4_sheet_pack')return `Etiket ${n(d.widthMm)} × ${n(d.heightMm)} mm · ${n(stock.packaging.labelsPerSheet)} ${stock.packaging.labelsPerSheet===1?'etiket':'etiketter'} pr. A4-ark`;
  const parts=baseName.split(' · ');
  parts[1]=d.kind==='diameter_mm'?`Ø ${n(d.diameterMm)} mm`:`${n(d.widthMm)} × ${n(d.heightMm)} mm`;
  if(stock.kind==='neutral_booklet_sample')parts.push('Neutral prøve');
  return parts.join(' · ');
}
