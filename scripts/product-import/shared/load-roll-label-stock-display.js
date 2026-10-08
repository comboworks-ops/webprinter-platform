import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareRollLabelStockContract} from './roll-label-stock-contract.js';
import {prepareRollLabelStockFormatDisplay} from './roll-label-stock-format-display.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file));

/** Recompute every prepared stock profile from exact saved material and article
 * evidence before allowing future review regeneration. No writes or quotes. */
export function loadRollLabelStockDisplay(root,families) {
  const sourceRoot=path.join(root,'docs/roll-labels-2026-09-30');
  const inventory=json(path.join(sourceRoot,'catalogue.normalized.json'));
  const packet=json(path.join(root,'output/qa/roll-labels-2026-10-06/semantic-014/stock-contracts.json'));
  assert.equal(packet.contracts.length,94);
  const stocks=new Map(),formats=new Map();
  for(const contract of packet.contracts) {
    assert.ok(!stocks.has(contract.profileKey),'Duplicate stock identity');
    const family=families.find(f=>f.sourceFamilyId===contract.familyId);
    const p=family?.profiles.find(p=>p.key===contract.profileKey);assert.ok(p,'Missing exact stock profile');
    assert.deepEqual(prepareRollLabelStockContract(family,p,fs.readFileSync(path.join(sourceRoot,p.sourceEvidencePath))),contract);
    const article=inventory.articles.find(a=>String(a.supplier_article_id)===p.articleId);assert.ok(article);
    const articleBytes=fs.readFileSync(path.join(sourceRoot,`evidence/${article.evidence_key}.json`));
    const meta=JSON.parse(articleBytes);
    assert.equal(meta.source_sha256,article.source_sha256);assert.equal(meta.title,article.title_de);
    assert.equal(sha(gunzipSync(fs.readFileSync(path.join(sourceRoot,'evidence',meta.snapshot)))),article.source_sha256);
    stocks.set(p.key,contract);formats.set(p.key,prepareRollLabelStockFormatDisplay(family,p,contract,articleBytes));
  }
  assert.equal(stocks.size,94);assert.equal(formats.size,94);
  return {stocks,formats};
}
