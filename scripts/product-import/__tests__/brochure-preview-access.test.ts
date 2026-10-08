import assert from 'node:assert/strict';
import test from 'node:test';
import {brochurePreviewAccess} from '../../brochure-preview-access.ts';

test('saved brochure preview permits local same-origin reads and rejects other hosts, origins and writes',()=>{
  const request={host:'127.0.0.1:8160',remoteAddress:'127.0.0.1',origin:'http://127.0.0.1:8160',method:'GET',fetchSite:'same-origin'};
  assert.equal(brochurePreviewAccess(request),200);
  assert.equal(brochurePreviewAccess({...request,method:'HEAD'}),200);
  assert.equal(brochurePreviewAccess({...request,host:'localhost:8160',origin:undefined,remoteAddress:'::1'}),200);
  for(const patch of [{host:'127.0.0.1.evil.test:8160'},{host:'0.0.0.0:8160'},{remoteAddress:'192.168.1.2'},
    {origin:'https://evil.test'},{origin:'http://127.0.0.1:8162'},{fetchSite:'cross-site'}]){
    assert.equal(brochurePreviewAccess({...request,...patch}),403);
  }
  for(const method of ['POST','PUT','DELETE','OPTIONS'])assert.equal(brochurePreviewAccess({...request,method}),405);
});
