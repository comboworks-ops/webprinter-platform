import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveProductImageReference} from './productImageReference.ts';

function client(result: unknown, updates: unknown[]) {
  return {from: () => ({update: (value: unknown) => {
    updates.push(value);
    return {eq: () => ({select: () => ({single: async () => result})})};
  }})} as never;
}
test('image removal only detaches the product reference and confirms the saved null', async () => {
  const updates: unknown[] = [];
  await saveProductImageReference(client({data:{id:'product',image_url:null},error:null},updates),'product',null);
  assert.deepEqual(updates,[{image_url:null}]);
});
test('image update rejects denied/zero-row writes and preserves the visible old image', async () => {
  for (const result of [{data:null,error:null},{data:null,error:new Error('denied')},{data:{id:'product',image_url:'old'},error:null}]) {
    await assert.rejects(saveProductImageReference(client(result,[]),'product','new'), /kunne ikke gemmes/);
  }
});
