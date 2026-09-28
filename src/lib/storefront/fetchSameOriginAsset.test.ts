import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSameOriginAsset} from './fetchSameOriginAsset.ts';

test('protected assets receive only the deployment credential on the exact origin', async t => {
  const calls: Array<{url: string; init: RequestInit}> = [];
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    calls.push({url:String(url),init}); return new Response('<html>shop</html>');
  });
  const request = new Request('https://preview.vercel.app/produkt/plakat', {headers:{
    cookie:'customer_session=private; _vercel_jwt=preview-access; analytics=unused',
    authorization:'Bearer customer-private', 'x-vercel-protection-bypass':'automation-access',
    'x-forwarded-host':'foreign.example',
  }});
  const response = await fetchSameOriginAsset(request,'/index.html',{headers:{'x-tenant-shell':'1'},cache:'no-store'});
  assert.equal(await response.text(),'<html>shop</html>');
  assert.equal(calls[0].url,'https://preview.vercel.app/index.html');
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get('cookie'),'_vercel_jwt=preview-access');
  assert.equal(headers.get('x-vercel-protection-bypass'),'automation-access');
  assert.equal(headers.get('authorization'),null);
  assert.equal(headers.get('x-tenant-shell'),'1');
  assert.equal(calls[0].init.redirect,'manual');
  assert.equal(calls[0].init.cache,'no-store');
  for (const path of ['https://foreign.example/index.html','//foreign.example/index.html','https://user:password@preview.vercel.app/']) {
    assert.throws(() => fetchSameOriginAsset(request,path),/incoming origin/);
  }
  assert.equal(calls.length,1);
});

test('public asset requests do not gain credentials', async t => {
  t.mock.method(globalThis,'fetch',async (_url: URL,init: RequestInit) => {
    const headers=new Headers(init.headers);
    assert.equal(headers.get('cookie'),null);
    assert.equal(headers.get('x-vercel-protection-bypass'),null);
    return new Response('icon');
  });
  await fetchSameOriginAsset(new Request('https://webprinter.dk/favicon.ico'),'/platform-favicon.png');
});

test('redirects cannot forward deployment credentials to another destination', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async (_url: URL,init: RequestInit) => {
    calls++;
    assert.equal(init.redirect,'manual');
    return new Response(null,{status:302,headers:{location:'https://foreign.example'}});
  });
  await assert.rejects(fetchSameOriginAsset(new Request('https://preview.vercel.app/',{
    headers:{cookie:'_vercel_jwt=access'},
  }),'/index.html'),/Unexpected asset redirect/);
  assert.equal(calls,1);
});
