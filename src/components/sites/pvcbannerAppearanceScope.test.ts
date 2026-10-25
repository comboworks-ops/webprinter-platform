import assert from 'node:assert/strict';
import test from 'node:test';
import { isPvcbannerJourney as applies, isPvcbannerFrame } from './pvcbannerAppearanceScope.ts';
test('PVC identity continues across storefront, Designer, checkout and account', () => {
 for(const host of ['pvcbanner.dk','www.pvcbanner.dk']) for(const path of ['/','/produkt/pvc-banner','/designer','/checkout/konfigurer','/min-konto']) assert.equal(applies(host,path,''),true);
});
test('other shops and admin previews preserve their branding', () => {
 for(const host of ['webprinter.dk','onlinetryksager.dk','salgsmapper.dk','pvcbanner.dk.attacker.test']) assert.equal(applies(host,'/designer','?force_domain=pvcbanner.dk'),false);
 for(const path of ['/admin','/admin/products','/preview-shop','/preview-storefront']) assert.equal(applies('pvcbanner.dk',path,''),false);
});
test('local QA can select PVC identity without changing tenant data', () => {
 assert.equal(applies('127.0.0.1','/designer','?force_domain=pvcbanner.dk'),true);
 assert.equal(applies('localhost','/designer','?force_domain=webprinter.dk'),false);
});

test('native frame only follows the explicitly selected preview tenant', () => {
 const id = 'cd3c7d7b-2220-46b8-93cf-096de23e93d8';
 assert.equal(isPvcbannerFrame('webprinter.dk','/preview-shop',`?tenantId=${id}`,null,true),true);
 assert.equal(isPvcbannerFrame('webprinter.dk','/preview-shop',`?tenant_id=${id}`,null,true),true);
 assert.equal(isPvcbannerFrame('pvcbanner.dk','/preview-shop','?tenantId=another',id,true),false);
 assert.equal(isPvcbannerFrame('webprinter.dk','/preview-shop','',id,true),false);
 assert.equal(isPvcbannerFrame('other-shop.dk','/kontakt','', 'another',false),false);
});
