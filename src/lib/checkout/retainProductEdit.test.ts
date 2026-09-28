import test from 'node:test';
import assert from 'node:assert/strict';
import { retainProductEditDraft } from './retainProductEdit.ts';
const previous = {productId:'a',designWidthMm:210,designHeightMm:297,designBleedMm:3,
  siteUpload:{filePath:'original.pdf'},checkoutCustomer:{customerName:'Fixture'},
  designerExport:{filePath:'original.pdf',productionFiles:[{format:'pdf' as const,filePath:'back.pdf'}]}};
const next={productId:'a',width:210,height:297,bleed:3};
test('paper edit retains all production files and contact draft but requires approval',()=>{
  const retained=retainProductEditDraft(previous,next,true);
  assert.equal(retained.designerExport,previous.designerExport);
  assert.equal(retained.siteUpload,previous.siteUpload);
  assert.equal(retained.proofApprovalRequired,true);
});
test('changed dimensions keep original upload without treating it as a fitting designer export',()=>{
  const retained=retainProductEditDraft(previous,{...next,width:148},true);
  assert.equal(retained.designerExport,null);
  assert.equal(retained.siteUpload,previous.siteUpload);
});
test('new orders and different products never inherit artwork or contact draft',()=>{
  assert.deepEqual(retainProductEditDraft(previous,next,false),{});
  assert.deepEqual(retainProductEditDraft(previous,{...next,productId:'b'},true),{});
});
