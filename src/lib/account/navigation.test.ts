import test from 'node:test';
import assert from 'node:assert/strict';
import { customerAuthHref, customerLink, postLoginDestination, safeCustomerReturnTarget } from './navigation.ts';

test('customer auth preserves exact order and every supported shop context through recovery', () => {
  const query = '?tenantId=shop-a&force_domain=shop.test&tenant_subdomain=shop&noise=ignored';
  const href = customerAuthHref('/min-konto/ordrer?order=order-7#filer', query, 'reset');
  const params = new URL(href, 'https://test.invalid').searchParams;
  assert.equal(params.get('tenantId'), 'shop-a');
  assert.equal(params.get('mode'), 'reset');
  assert.equal(params.get('noise'), null);
  assert.equal(params.get('redirect'), '/min-konto/ordrer?order=order-7&tenantId=shop-a&force_domain=shop.test&tenant_subdomain=shop#filer');
});
test('auth refuses external, protocol-relative, encoded slash and backslash redirects', () => {
  for (const target of ['https://evil.test', '//evil.test', '/\\evil.test', '/%5cevil.test', '/%2fevil.test', '/auth?redirect=/auth', '/x%0ay', '/bad%']) {
    assert.equal(safeCustomerReturnTarget(target), '/min-konto', target);
  }
  assert.equal(safeCustomerReturnTarget('/checkout/konfigurer?step=2'), '/checkout/konfigurer?step=2');
});
test('current shop wins over a stale embedded target shop and order query survives', () => {
  assert.equal(customerLink('/min-konto/ordrer?tenantId=old&order=7', '?force_domain=new.test'), '/min-konto/ordrer?order=7&force_domain=new.test');
  assert.equal(customerLink('/min-konto/adresser', ''), '/min-konto/adresser');
});

test('default login distinguishes customers from verified administrators and keeps the shop', () => {
  const search = '?force_domain=salgsmapper.dk&tenantId=shop-a';
  assert.equal(postLoginDestination(false, null, search), '/min-konto?tenantId=shop-a&force_domain=salgsmapper.dk');
  assert.equal(postLoginDestination(true, null, search), '/admin?tenantId=shop-a&force_domain=salgsmapper.dk');
  assert.equal(postLoginDestination(true, '/min-konto?force_domain=old.test', search), '/admin?tenantId=shop-a&force_domain=salgsmapper.dk');
});
test('administrator login keeps explicit customer tasks and safe backend destinations', () => {
  assert.equal(postLoginDestination(true, '/min-konto/ordrer?order=7#filer', ''), '/min-konto/ordrer?order=7#filer');
  assert.equal(postLoginDestination(true, '/checkout/konfigurer?step=2', ''), '/checkout/konfigurer?step=2');
  assert.equal(postLoginDestination(true, '/admin/products', '?force_domain=shop.test'), '/admin/products?force_domain=shop.test');
  assert.equal(postLoginDestination(true, '/admin/login', ''), '/admin');
});
test('customer redirects cannot select the backend and external return targets stay local', () => {
  assert.equal(postLoginDestination(false, '/admin/products', ''), '/min-konto');
  assert.equal(postLoginDestination(false, '//evil.test', ''), '/min-konto');
  assert.equal(postLoginDestination(true, 'https://evil.test', ''), '/admin');
});
