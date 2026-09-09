import assert from "node:assert/strict";
import test from "node:test";
import { assertCheckoutIdentity, canonicalJson, sha256, validateCheckoutOrder, verifyCheckoutPayment } from "./storefrontCheckout.ts";
import { bindCheckoutPayment, finalizeCheckoutPayment, prepareCheckoutArtifacts, readCheckoutNotification } from "./storefrontCheckoutRuntime.ts";

const id = "11111111-1111-4111-8111-111111111111";
const tenant = "22222222-2222-4222-8222-222222222222";
const order = {
  customer_email: "test@example.test",customer_name: "Test",delivery_address: "Testvej 1",
  delivery_address2: "2. th.",delivery_zip: "5000",delivery_city: "Odense",delivery_country: "de",
  files: [{file_name: "art.pdf",bucket: "order-files",storage_path: "designer-production/approved.pdf",sha256: "a".repeat(64)}],
};
const attempt = {id,tenant_id: tenant,payment_intent_id: "pi_123",amount_ore: 12345,livemode: false,request_hash: "hash"};
const payment = {id: "pi_123",metadata: {checkout_attempt_id: id,tenant_id: tenant,contract_version: "2",request_hash: "hash"},
  amount: 12345,amount_received: 12345,currency: "dkk",status: "succeeded",livemode: false};

test("full address and ISO country survive normalized checkout snapshot", () => {
  const result = validateCheckoutOrder(order);
  assert.equal(result.delivery_address2,"2. th."); assert.equal(result.delivery_country,"DE");
});
test("approved production bytes are mandatory and source paths cannot fetch privileged objects", () => {
  for (const patch of [{files: []},{files: [{...order.files[0],sha256: null}]},
    {files: [{...order.files[0],storage_path: "../private.pdf"}]},
    {files: [{...order.files[0],storage_path: "checkout-finalized/other.pdf"}]},
    {files: [{...order.files[0],bucket: "private"}]}]) {
    assert.throws(() => validateCheckoutOrder({...order,...patch}));
  }
});
test("attempt identities require two UUIDs and stable canonical snapshot hash", async () => {
  assertCheckoutIdentity(id,tenant);
  assert.throws(() => assertCheckoutIdentity(id,"guessable"));
  assert.equal(await sha256(canonicalJson({b: 1,a: {d: 2,c: 3}})),await sha256(canonicalJson({a: {c: 3,d: 2},b: 1})));
  assert.notEqual(await sha256(canonicalJson(order)),await sha256(canonicalJson({...order,delivery_address: "Changed"})));
});
test("only succeeded exact amount/currency/tenant/payment/destination/mode can finalize", () => {
  verifyCheckoutPayment(attempt,payment);
  for (const patch of [{status: "processing"},{amount: 1},{amount_received: 1},{currency: "eur"},{id: "pi_other"},
    {livemode: true},{transfer_data: {destination: "acct_other"}},
    {metadata: {...payment.metadata,tenant_id: id}},{metadata: {...payment.metadata,checkout_attempt_id: tenant}},
    {metadata: {...payment.metadata,contract_version: "1"}}]) assert.throws(() => verifyCheckoutPayment(attempt,{...payment,...patch}));
});
test("database errors and missing returned order never report success", async () => {
  for (const result of [{error: {code: "outage"},data: null},{error: null,data: null},{error: null,data: {id}}]) {
    await assert.rejects(finalizeCheckoutPayment({rpc: async () => result},attempt,payment),/checkout_finalization_pending/);
  }
});
test("duplicate browser/webhook callbacks invoke the same atomic order identity", async () => {
  const calls: unknown[] = [];
  const db = {rpc: async (name: string,args: unknown) => {calls.push([name,args]); return {data: {id,order_number: "WP-1"},error: null};}};
  const results = await Promise.all([finalizeCheckoutPayment(db,attempt,payment),finalizeCheckoutPayment(db,attempt,payment)]);
  assert.deepEqual(results[0],results[1]); assert.deepEqual(calls[0],calls[1]);
});
test("binding cannot swap a previously recorded PaymentIntent or request hash", async () => {
  await assert.rejects(bindCheckoutPayment({},attempt,{...payment,id: "pi_other"}),/checkout_payment_mismatch/);
  await assert.rejects(bindCheckoutPayment({},attempt,{...payment,metadata: {...payment.metadata,request_hash: "other"}}),/checkout_payment_mismatch/);
});

test("approved bytes are copied before ready, and changed source bytes stop checkout", async () => {
  const originalFetch = globalThis.fetch;
  const bytes = new TextEncoder().encode("synthetic approved PDF").buffer;
  const hash = await sha256(bytes);
  const details = validateCheckoutOrder({...order,files: [{...order.files[0],sha256: hash}]});
  const uploads: any[] = [];
  let stored: any = {...attempt,state: "prepared"};
  const client = {
    storage: {from: () => ({upload: async (...args: any[]) => {uploads.push(args); return {error: null};},
      getPublicUrl: (path: string) => ({data: {publicUrl: `https://storage.example.test/${path}`}})})},
    from: () => {
      let update: any = null;
      const query: any = {select: () => query,eq: () => query,update: (value: any) => {update = value; return query;},
        maybeSingle: async () => ({data: stored,error: null}),
        then: (resolve: any) => {if (update) stored = {...stored,...update}; resolve({error: null});}};
      return query;
    },
  };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url),"https://storage.example.test/storage/v1/object/public/order-files/designer-production/approved.pdf");
      assert.equal(options?.redirect,"error"); assert.equal(options?.headers,undefined);
      return new Response(bytes);
    };
    const ready = await prepareCheckoutArtifacts(client,"https://storage.example.test",stored,details);
    assert.equal(ready.state,"ready"); assert.equal(uploads.length,1);
    assert.equal(uploads[0][2].upsert,false);
    assert.match(uploads[0][0],new RegExp(`^checkout-finalized/${id}/0-${hash}\\.pdf$`));
    assert.equal(ready.files_snapshot[0].sha256,hash);
    globalThis.fetch = async () => new Response("changed after approval");
    await assert.rejects(prepareCheckoutArtifacts(client,"https://storage.example.test",{...attempt,state: "prepared"},details),/checkout_approved_artifact_changed/);
    assert.equal(uploads.length,1);
  } finally {globalThis.fetch = originalFetch;}
});

test("durable receipt uses paid snapshot rather than a later browser form", async () => {
  const data = {id,order_number: "WP-1",product_name: "Paid product",quantity: 100};
  const result = await finalizeCheckoutPayment({rpc: async () => ({data,error: null})},
    {...attempt,files_snapshot: [{file_name: "approved.pdf"}],quote_snapshot: {productPriceOre: 6000,optionExtraOre: 1445,shippingOre: 4900}},payment);
  assert.deepEqual(result.checkout_receipt,{productName: "Paid product",quantity: 100,fileName: "approved.pdf",subtotal: 74.45,shipping: 49,total: 123.45});
  assert.deepEqual(result.checkout_notification,{status: "unavailable"});
});

test("confirmation status is scoped to the paid attempt, order, shop and customer notification", async () => {
  const filters: unknown[] = [];
  let row: unknown = {status: "sent", accepted_at: "2026-09-08T20:00:00Z", provider_message_id: "email-1"};
  const query = {
    select(columns: string) { assert.equal(columns, "status,accepted_at,provider_message_id"); return this; },
    eq(key: string, value: unknown) { filters.push([key, value]); return this; },
    maybeSingle() { return this; },
    async abortSignal() { return {data: row, error: null}; },
  };
  const client = {from(table: string) { assert.equal(table, "storefront_order_email_outbox"); return query; }};
  assert.deepEqual(await readCheckoutNotification(client, attempt, "order-1"), {status: "accepted"});
  assert.deepEqual(filters, [["attempt_id", attempt.id], ["order_id", "order-1"], ["tenant_id", attempt.tenant_id], ["notification_type", "customer_confirmation"]]);
  row = {status: "sent"};
  assert.deepEqual(await readCheckoutNotification(client, attempt, "order-1"), {status: "unavailable"});
  row = {status: "pending"};
  assert.deepEqual(await readCheckoutNotification(client, attempt, "order-1"), {status: "pending"});
});
