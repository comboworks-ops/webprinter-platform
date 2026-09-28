import test from 'node:test';
import assert from 'node:assert/strict';
import { saveProductTooltips } from './saveProductTooltips.ts';

function clientFor(tooltips: unknown[] = [], conflict = false) {
  const writes: unknown[] = []; const filters: unknown[][] = [];
  const chain = {
    select: () => chain,
    eq: (...args: unknown[]) => { filters.push(args);return chain; },
    single: async () => ({data:{id:'p',updated_at:'version-1',banner_config:{special_badge:{text:'Keep'},visual_tooltips:tooltips}},error:null}),
    update: (value: unknown) => {writes.push(value);return chain;},
    maybeSingle: async () => ({data:conflict?null:{id:'p'},error:null}),
  };
  return {client:{from:()=>chain} as unknown as Parameters<typeof saveProductTooltips>[0],writes,filters};
}
const tooltip={anchor:'placed:one',icon:'info' as const,color:'#000000',animation:'fade' as const,text:'Help'};
test('tooltip saves preserve unrelated banner settings and bind tenant and version',async()=>{
  const fixture=clientFor();await saveProductTooltips(fixture.client,'tenant-a','p',[],[tooltip]);
  assert.deepEqual(fixture.writes,[{banner_config:{special_badge:{text:'Keep'},visual_tooltips:[tooltip]}}]);
  assert.ok(fixture.filters.some(filter=>filter[0]==='tenant_id'&&filter[1]==='tenant-a'));
  assert.ok(fixture.filters.some(filter=>filter[0]==='updated_at'&&filter[1]==='version-1'));
});
test('stale tooltip drafts cannot overwrite someone else’s tooltip',async()=>{
  const fixture=clientFor([tooltip]);await assert.rejects(saveProductTooltips(fixture.client,'tenant-a','p',[],[]),/andet vindue/);assert.equal(fixture.writes.length,0);
});
test('a concurrent update is reported as a failed save',async()=>{
  const fixture=clientFor([],true);await assert.rejects(saveProductTooltips(fixture.client,'tenant-a','p',[],[tooltip]),/samtidig/);
});
