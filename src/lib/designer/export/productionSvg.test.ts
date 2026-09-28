import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {validateProductionSvg} from './productionSvg.ts';
const require=createRequire(import.meta.url);
const fabricRequire=createRequire(require.resolve('fabric'));
// XML parsing needs no native canvas; disable only jsdom's optional canvas adapter.
try {
  require.cache[fabricRequire.resolve('canvas')] = { exports: {} } as NodeModule;
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') throw error;
}
const {JSDOM}=fabricRequire('jsdom');
const window=new JSDOM('').window;
const parse=(body:string)=>new window.DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`,'image/svg+xml');

test('safe vector paths and local clipping retain original geometry',()=>{
  const doc=parse('<defs><clipPath id="clip"><rect width="20" height="30"/></clipPath></defs><g clip-path="url(#clip)"><path d="M0 0 L20 30" fill="#ff0000"/></g>');
  assert.equal(validateProductionSvg(doc),doc.documentElement);
  assert.equal(doc.querySelector('path')?.getAttribute('d'),'M0 0 L20 30');
});
test('Fabric id, image, pattern and gradient injections fail before import into document',()=>{
  for(const markup of ['<g id="x" onload="alert(1)"/>','<image href="https://evil.test/a.png"/>',
    '<pattern><image href="data:image/svg+xml,test"/></pattern>','<linearGradient><stop stop-color="red" onload="alert(1)"/></linearGradient>',
    '<script>alert(1)</script>','<g style="fill:url(https://evil.test/a)"/>','<g xmlns="http://www.w3.org/1999/xhtml"/>','<g id="broken>']){
    assert.throws(()=>validateProductionSvg(parse(markup)),markup);
  }
});
