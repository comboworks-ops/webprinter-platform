import test from 'node:test';
import assert from 'node:assert/strict';
import { tooltipDraftChanged } from './tooltipDraft.ts';
test('opening a generated tooltip is clean regardless of property order and absent target',()=>{
  assert.equal(tooltipDraftChanged({anchor:'material:a:b',text:'Paper',title:'Paper',target:undefined},{title:'Paper',text:'Paper',anchor:'material:a:b'}),false);
});
test('a content edit or target position edit is dirty',()=>{
  assert.equal(tooltipDraftChanged({text:'New'},{text:'Paper'}),true);
  assert.equal(tooltipDraftChanged({target:{page:'/',x:20}},{target:{x:30,page:'/'}}),true);
});
