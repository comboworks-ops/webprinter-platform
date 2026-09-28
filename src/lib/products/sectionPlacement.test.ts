import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveSectionToRow } from './sectionPlacement.ts';
test('wide-format section placement preserves all pricing references and empties no source array',()=>{
 const finish={id:'finish',valueIds:['eyelets'],markup:12};const rows=[{id:'format-row',sections:[{id:'format',valueIds:['custom'],markup:0}]},{id:'finish-row',sections:[finish]}];
 const together=moveSectionToRow(rows,'finish','format-row');assert.equal(together.length,1);assert.deepEqual(together[0].sections[1],finish);assert.equal(rows.length,2);assert.equal(rows[1].sections.length,1);
 const apart=moveSectionToRow(together,'finish','new-row');assert.equal(apart.length,2);assert.deepEqual(apart[1].sections,[finish]);
});
test('section placement rejects missing sources and full destination rows',()=>{
 const rows=[{id:'full',sections:[{id:'a'},{id:'b'},{id:'c'}]},{id:'other',sections:[{id:'d'}]}];
 assert.throws(()=>moveSectionToRow(rows,'missing','full'),/findes ikke/);assert.throws(()=>moveSectionToRow(rows,'d','full'),/højst/);
});
