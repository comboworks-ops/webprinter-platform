import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedPreviewRequestBlock, isolatedCheckoutTestEnabled, PREVIEW_BACKEND } from './isolatedPreview.ts';

test('isolated preview rejects every other backend, including ordinary data writes', () => {
  for (const host of ['ziattmsmiirfweiuunfo.supabase.co', 'example.com', PREVIEW_BACKEND+'.evil.test']) {
    assert.equal(isolatedPreviewRequestBlock(new Request(`https://${host}/rest/v1/tenants`,{method:'PATCH'}),true)?.status,403);
  }
});
test('isolated preview permits its catalogue, auth, saves and storage', () => {
  for (const path of ['/rest/v1/tenants','/rest/v1/rpc/save_tenant_branding_settings','/auth/v1/token','/storage/v1/object/product-images/test.png','/functions/v1/catalog-read','/functions/v1/product-detail-read','/functions/v1/tenant-context-read']) {
    assert.equal(isolatedPreviewRequestBlock(new URL(`https://${PREVIEW_BACKEND}${path}`),true),null);
  }
});
test('isolated preview rejects payments, mail, supplier calls and unknown functions', () => {
  for (const fn of ['stripe-create-payment-intent','stripe-finalize-checkout','send-contact-message','send-quote-email','send-order-email','pod2-order-submit','new-unreviewed-handler']) {
    assert.equal(isolatedPreviewRequestBlock(`https://${PREVIEW_BACKEND}/functions/v1/${fn}`,true)?.status,403);
  }
});
test('ordinary builds preserve all existing request behavior', () => {
  assert.equal(isolatedPreviewRequestBlock('https://live.example/functions/v1/stripe-create-payment-intent',false),null);
});

test('checkout testing requires an explicit isolated build, exact backend and Stripe test public key', () => {
  const config = {isolated:true, requested:true, backendUrl:`https://${PREVIEW_BACKEND}`, publishableKey:'pk_test_fixture'};
  assert.equal(isolatedCheckoutTestEnabled(config), true);
  for (const patch of [{isolated:false}, {requested:false}, {publishableKey:''}, {publishableKey:'pk_live_fixture'},
    {publishableKey:'sk_test_fixture'}, {backendUrl:'https://ziattmsmiirfweiuunfo.supabase.co'},
    {backendUrl:`http://${PREVIEW_BACKEND}`}, {backendUrl:`https://${PREVIEW_BACKEND}.evil.test`}, {backendUrl:'invalid'}]) {
    assert.equal(isolatedCheckoutTestEnabled({...config,...patch}), false);
  }
});

test('checkout test preview permits only its matched payment handlers while keeping outbound actions blocked', () => {
  for (const fn of ['stripe-create-payment-intent', 'stripe-finalize-checkout']) {
    assert.equal(isolatedPreviewRequestBlock(`https://${PREVIEW_BACKEND}/functions/v1/${fn}`,true,true),null);
    assert.equal(isolatedPreviewRequestBlock(`https://ziattmsmiirfweiuunfo.supabase.co/functions/v1/${fn}`,true,true)?.status,403);
  }
  for (const path of ['/functions/v1/send-order-email','/functions/v1/storefront-order-email-dispatch',
    '/functions/v1/send-quote-email','/functions/v1/pod2-order-submit','/functions/v1/unknown',
    '/functions/v1/stripe-create-payment-intent/extra','/functions/v1/']) {
    assert.equal(isolatedPreviewRequestBlock(`https://${PREVIEW_BACKEND}${path}`,true,true)?.status,403);
  }
});
