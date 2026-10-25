import assert from 'node:assert/strict';
import test from 'node:test';
import { appendStorefrontTenantContext } from './storefrontTenantContext.ts';

function at(url: string, check: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: new URL(url) } });
  try { check(); } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('shared production storefront links retain each supported explicit shop selector', () => {
  for (const [key, value] of [['tenantId', 'trykker'], ['tenant_id', 'trykker'], ['force_domain', 'salgsmapper.dk'], ['tenant_subdomain', 'trykker']]) {
    at(`https://www.webprinter.dk/shop?${key}=${value}`, () => {
      for (const href of ['/', '/auth', '/grafisk-vejledning', '/shop']) {
        assert.equal(appendStorefrontTenantContext(href), `${href}?${key}=${value}`);
      }
    });
  }
});

test('ordinary custom-domain and platform links remain unchanged without an explicit selector', () => {
  for (const hostname of ['salgsmapper.dk', 'www.webprinter.dk']) at(`https://${hostname}/shop?category=mapper`, () => {
    for (const href of ['/', '/auth?mode=signup#form', 'produkt/folder', '#prices']) assert.equal(appendStorefrontTenantContext(href), href);
  });
});

test('explicit context also survives supported custom-host previews', () => {
  at('https://salgsmapper.dk/shop?tenantId=trykker', () => {
    assert.equal(appendStorefrontTenantContext('/auth?mode=signup#form'), '/auth?mode=signup&tenantId=trykker#form');
  });
});

test('a destination explicit shop selector wins without mixing another source shop', () => {
  at('http://localhost:8916/shop?tenantId=shop-a&force_domain=a.example.test', () => {
    assert.equal(appendStorefrontTenantContext('/shop?tenantId=shop-b'), '/shop?tenantId=shop-b');
    assert.equal(appendStorefrontTenantContext('/shop?tenant_id=shop-b'), '/shop?tenant_id=shop-b');
    assert.equal(appendStorefrontTenantContext('/shop?force_domain=b.example.test'), '/shop?force_domain=b.example.test');
  });
});

test('localhost keeps explicit context without copying unrelated filters or inventing a pinned tenant', () => {
  at('http://127.0.0.1:8916/shop?tenantId=shop-a&category=old', () => {
    assert.equal(appendStorefrontTenantContext('/produkter?category=new#items'), '/produkter?category=new&tenantId=shop-a#items');
  });
  at('http://localhost:8916/shop', () => assert.equal(appendStorefrontTenantContext('/auth'), '/auth'));
});

test('external, mail, telephone and fragment links are untouched', () => {
  at('https://www.webprinter.dk/shop?tenantId=trykker', () => {
    for (const href of ['https://example.test/shop', '//example.test/shop', 'mailto:help@example.test', 'tel:12345678', '#prices']) {
      assert.equal(appendStorefrontTenantContext(href), href);
    }
  });
});
