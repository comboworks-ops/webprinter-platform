// Executes the actual edge handler bodies with isolated Stripe/database adapters.
// No network and no credentials. This complements real PostgreSQL transaction tests.
import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import * as boundary from "./storefrontCheckout.ts";
import * as runtime from "./storefrontCheckoutRuntime.ts";
import * as quoteAmounts from "./storefrontQuoteAmounts.ts";
import * as storformatQuote from "./storefrontStorformatQuote.ts";

function handler(file: string, dependencies: Record<string, unknown>) {
  let captured: (req: Request) => Promise<Response>;
  const source = readFileSync(new URL(file,import.meta.url),"utf8").replace(/^import .*;\s*$/gm, "");
  const compiled = ts.transpileModule(source,{compilerOptions: {target: ts.ScriptTarget.ES2022,module: ts.ModuleKind.ESNext}}).outputText;
  const scope = {...boundary,...runtime,...quoteAmounts,...storformatQuote,checkRateLimit: () => null,serve: (fn: typeof captured) => {captured = fn;},...dependencies};
  new Function(...Object.keys(scope),compiled)(...Object.values(scope));
  return captured!;
}
const id = "11111111-1111-4111-8111-111111111111";
const token = "22222222-2222-4222-8222-222222222222";
const body = {contract_version: 2,checkout_attempt_id: id,checkout_access_token: token,tenant_id: token,
  amount_ore: 10000,currency: "dkk",checkout_quote: {productId: id,quantity: 100},
  checkout_order: {customer_email: "synthetic@example.test",customer_name: "Synthetic",delivery_address: "Testvej 1",
    delivery_city: "Odense",delivery_zip: "5000",delivery_country: "DK",
    files: [{file_name: "proof.pdf",storage_path: "designer-production/proof.pdf",bucket: "order-files",sha256: "a".repeat(64)}]}};
const req = (payload: unknown) => new Request("https://edge.example.test",{method: "POST",body: JSON.stringify(payload)});

async function fixture() {
  const attempt: any = {id,tenant_id: token,user_id: null,access_token_hash: await boundary.sha256(token),
    request_hash: await boundary.sha256(boundary.canonicalJson({tenantId: token,userId: null,order: boundary.validateCheckoutOrder(body.checkout_order),quote: body.checkout_quote,amount: 10000})),
    state: "ready",amount_ore: 10000,livemode: false,created_at: new Date().toISOString(),payment_intent_id: null,
    files_snapshot: [{file_name: "proof.pdf"}],quote_snapshot: {productPriceOre: 5100,shippingOre: 4900}};
  const calls: any[] = [];
  let payment: any;
  const stripe = {paymentIntents: {
    create: async (data: any,options: any) => {
      calls.push(["create",options]); payment ||= {...data,id: "pi_fixture",client_secret: "pi_fixture_secret_fixture",livemode: false,status: "requires_payment_method"}; return payment;
    },retrieve: async () => payment,cancel: async () => {calls.push(["cancel"]); payment = {...payment,status: "canceled"}; return payment;},
  }};
  const client = {
    auth: {getUser: async () => ({data: {user: null}})},
    from: () => {
      let update: any = null;
      const query: any = {select: () => query,eq: () => query,is: () => query,update: (value: any) => {update = value; return query;},
        maybeSingle: async () => ({data: attempt,error: null}),
        then: (resolve: any) => {if (update) Object.assign(attempt,update); resolve({error: null});}};
      return query;
    },
    rpc: async () => ({data: {id,order_number: "WP-fixture",product_name: "Synthetic",quantity: 100,total_price: 100},error: null}),
  };
  const env: Record<string,string> = {STOREFRONT_CHECKOUT_ENABLED: "true",STOREFRONT_CHECKOUT_WEBHOOK_SECRET: "fixture",
    SUPABASE_URL: "https://supabase.example.test",SUPABASE_SERVICE_ROLE_KEY: "fixture",STRIPE_SECRET_KEY: "sk_test_fixture"};
  const deps = {createClient: () => client,Stripe: class {constructor() {return stripe;}},Deno: {env: {get: (key: string) => env[key]}}};
  return {attempt,calls,env,stripe,client,deps,get payment() {return payment;},set payment(value) {payment = value;}};
}
test("creator reuses durable PaymentIntent across retries; changed payload cannot create another", async () => {
  const f = await fixture(); const create = handler("../stripe-create-payment-intent/index.ts",f.deps);
  const first = await create(req(body)); assert.equal(first.status,200);
  const firstBody = await first.json(); assert.equal(firstBody.contract_version,2); assert.equal(firstBody.payment_intent_id,"pi_fixture");
  assert.equal((await create(req(body))).status,200);
  assert.equal(f.calls.filter(call => call[0] === "create").length,1);
  assert.equal(f.calls[0][1].idempotencyKey,`storefront-checkout-v2:${id}`);
  assert.equal((await create(req({...body,amount_ore: 1}))).status,409);
});
test("expired unbound attempt, old client and disabled release never issue a payment", async () => {
  const f = await fixture(); const create = handler("../stripe-create-payment-intent/index.ts",f.deps);
  f.attempt.created_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  assert.equal((await (await create(req(body))).json()).error,"checkout_reconciliation_required");
  assert.equal((await (await create(req({...body,contract_version: 1}))).json()).error,"checkout_upgrade_required");
  f.env.STOREFRONT_CHECKOUT_ENABLED = "false";
  assert.equal((await create(req(body))).status,503); assert.equal(f.calls.length,0);
});
test("finalizer rejects wrong recovery token and processing payment; definitive cancel permits replacement attempt", async () => {
  const f = await fixture(); await handler("../stripe-create-payment-intent/index.ts",f.deps)(req(body));
  const finalize = handler("../stripe-finalize-checkout/index.ts",f.deps);
  const payload = {checkout_attempt_id: id,checkout_access_token: token,payment_intent_id: "pi_fixture",action: "cancel"};
  assert.equal((await finalize(req({...payload,checkout_access_token: id}))).status,403);
  f.payment.status = "processing";
  assert.equal((await (await finalize(req(payload))).json()).error,"checkout_payment_processing");
  assert.equal(f.calls.filter(call => call[0] === "cancel").length,0);
  f.payment.status = "requires_payment_method";
  const result = await (await finalize(req(payload))).json();
  assert.equal(result.cancelled,true); assert.equal(f.attempt.state,"cancelled");
});
test("cancel racing a successful payment returns a durable order instead of false cancellation", async () => {
  const f = await fixture(); await handler("../stripe-create-payment-intent/index.ts",f.deps)(req(body));
  f.stripe.paymentIntents.cancel = async () => {f.payment.status = "succeeded"; f.payment.amount_received = 10000; throw new Error("already completed");};
  const result = await (await handler("../stripe-finalize-checkout/index.ts",f.deps)(req({checkout_attempt_id: id,checkout_access_token: token,action: "cancel"}))).json();
  assert.equal(result.success,true); assert.equal(result.order.id,id); assert.equal(result.cancelled,undefined);
});

test("webhook entrypoint rejects missing signature, preserves raw body and retries failed finalization", async () => {
  const f = await fixture(); await handler("../stripe-create-payment-intent/index.ts",f.deps)(req(body));
  f.payment.status = "succeeded"; f.payment.amount_received = 10000;
  const calls: any[] = [];
  const rawBody = '{ "fixture": "raw spacing retained" }';
  let databaseFails = true;
  const stripe = {...f.stripe,webhooks: {constructEventAsync: async (raw: string,signature: string,secret: string) => {
    assert.equal(raw,rawBody); assert.equal(secret,"fixture");
    if (signature !== "fixture-valid-signature") throw new Error("invalid signature");
    return {type: "payment_intent.succeeded",data: {object: f.payment}};
  }}};
  const client = {...f.client,rpc: async (name: string,args: any) => {
    calls.push([name,args]); return databaseFails ? {error: {code: "outage"},data: null}
      : {error: null,data: {id,order_number: "WP-fixture",product_name: "Synthetic",quantity: 100}};
  }};
  const webhook = handler("../stripe-storefront-webhook/index.ts",{...f.deps,createClient: () => client,
    Stripe: class {static createSubtleCryptoProvider() {return {};} constructor() {return stripe;}}});
  const event = (signature?: string) => new Request("https://edge.example.test",{method: "POST",body: rawBody,
    headers: signature ? {"stripe-signature": signature} : {}});
  assert.equal((await webhook(event())).status,400); assert.equal(calls.length,0);
  assert.equal((await webhook(event("fixture-valid-signature"))).status,503);
  databaseFails = false;
  assert.equal((await webhook(event("fixture-valid-signature"))).status,200);
  assert.equal((await webhook(event("fixture-valid-signature"))).status,200);
  assert.deepEqual(calls[0],calls[1]); assert.deepEqual(calls[1],calls[2]);
});

test("webhook ignores non-storefront legacy intents without writing any order", async () => {
  const f = await fixture();
  let writes = 0;
  f.client.rpc = async () => {writes += 1; throw new Error("must not write");};
  const stripe = {...f.stripe,webhooks: {constructEventAsync: async () => ({type: "payment_intent.succeeded",data: {object: {metadata: {}}}})}};
  const webhook = handler("../stripe-storefront-webhook/index.ts",{...f.deps,
    Stripe: class {static createSubtleCryptoProvider() {return {};} constructor() {return stripe;}}});
  const result = await (await webhook(req({}))).json();
  assert.equal(result.ignored,true); assert.equal(writes,0);
});

async function newQuoteFixture(pricingType: string) {
  const f = await fixture();
  let saved: any = null;
  const config = {rounding_step: 1,global_markup_pct: 0,quantities: [1,2],layout_rows: [],vertical_axis: null};
  const catalog: Record<string,any> = {
    products: {id,name: "Synthetic",slug: "synthetic",tenant_id: token,is_published: true,pricing_type: pricingType,banner_config: {}},
    storformat_configs: config,
    storformat_materials: [{id: token,max_width_mm: 2000,max_height_mm: 1000,markup_pct: 0,interpolation_enabled: true}],
    storformat_material_price_tiers: [{material_id: token,from_m2: 0,to_m2: null,price_per_m2: 100,is_anchor: true}],
    product_option_group_assignments: [{option_group_id: id}],
    product_options: [{id: token,group_id: id,extra_price: 5,price_mode: "per_area"}],
    product_attribute_values: {id: token,group_id: id,width_mm: 1000,height_mm: 500},
    product_attribute_groups: {id},
  };
  const client = {...f.client,from: (table: string) => {
    const query: any = {select: () => query,eq: () => query,in: () => query,order: () => query,
      insert: async (row: any) => {saved = {...row,state: "preparing",created_at: new Date().toISOString()}; return {error: null};},
      range: async () => ({data: catalog[table] || [],error: null}),
      maybeSingle: async () => ({data: catalog[table] || null,error: null}),
      then: (resolve: any) => resolve({data: catalog[table] || [],error: null})};
    return query;
  }};
  const deps = {...f.deps,createClient: () => client,getAttempt: async () => saved,
    prepareCheckoutArtifacts: async (_client: any,_url: string,attempt: any) => attempt,
    bindCheckoutPayment: async (_client: any,attempt: any,payment: any) => ({...attempt,payment_intent_id: payment.id}),
    fetch: async () => new Response(JSON.stringify({success: true,product: catalog.products,summary: {matchedRows: 1},
      bestMatch: {id,quantity: 2,price_dkk: 100.51,selectionMapFormat: token}})),
  };
  return {f,deps,catalog,get saved() {return saved;}};
}
test("creator first payment uses the stored STORFORMAT setup and preserves its verified dimensions", async () => {
  const f = await newQuoteFixture("STORFORMAT");
  const selection = {widthMm: 1000,heightMm: 500,materialId: token,finishIds: [],productIds: [],selectedSectionValues: {"vertical-axis": token}};
  const quote = {productId: id,quantity: 2,areaM2: 0.5,storformat: selection};
  const create = handler("../stripe-create-payment-intent/index.ts",f.deps);
  const mismatch = await create(req({...body,amount_ore: 1,checkout_quote: quote}));
  assert.equal(mismatch.status,409); assert.equal(f.saved,null); assert.equal(f.f.calls.length,0);
  const response = await create(req({...body,amount_ore: 14900,checkout_quote: quote}));
  assert.equal(response.status,200); assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(f.saved.quote_snapshot.pricingSource,"storformat_existing_formula_v1");
  assert.deepEqual(f.saved.quote_snapshot.verifiedDimensions,{widthMm: 1000,heightMm: 500,areaM2: 0.5});
  assert.equal(f.f.payment.amount,14900);
});
test("creator rejects the old below-minimum bulk quote and charges the first-tier 0.96 m2 price", async () => {
  const f = await newQuoteFixture("STORFORMAT");
  f.catalog.storformat_material_price_tiers = [
    {material_id: token,from_m2: 1,to_m2: 2,price_per_m2: 178.6608,is_anchor: false,markup_pct: 0},
    {material_id: token,from_m2: 20,to_m2: null,price_per_m2: 161.32824,is_anchor: false,markup_pct: 0},
  ];
  const selection = {widthMm: 1200,heightMm: 800,materialId: token,finishIds: [],productIds: [],selectedSectionValues: {"vertical-axis": token}};
  const quote = {productId: id,quantity: 1,areaM2: 0.96,storformat: selection};
  const create = handler("../stripe-create-payment-intent/index.ts",f.deps);
  // The old 155 kr product price plus 49 kr shipping must not create an intent.
  const outdated = await create(req({...body,amount_ore: 20400,checkout_quote: quote}));
  assert.equal(outdated.status,409); assert.equal(f.saved,null); assert.equal(f.f.calls.length,0);
  const response = await create(req({...body,amount_ore: 22100,checkout_quote: quote}));
  assert.equal(response.status,200);
  assert.equal(f.saved.quote_snapshot.productPriceOre,17200);
  assert.equal(f.saved.quote_snapshot.shippingOre,4900);
  assert.deepEqual(f.saved.quote_snapshot.verifiedDimensions,{widthMm: 1200,heightMm: 800,areaM2: 0.96});
  assert.equal(f.f.payment.amount,22100);
});
test("creator charges the opted-in source quote and never creates payment for an unsupported size", async () => {
  const f = await newQuoteFixture("STORFORMAT");
  f.catalog.storformat_material_price_tiers = [];
  Object.assign(f.catalog.storformat_configs,{area_pricing_basis: "per_piece_quotes",source_quote_model: {
    version: 1,currency: "DKK",price_basis: "regular",base_product_ids: [],combinations: [{material_id: token,
      finish_ids: [],product_ids: [],points: [{area_m2: 0.96,quantity: 1,total_price: 13.42 * 13.68}]}]}});
  const selection = {widthMm: 1200,heightMm: 800,materialId: token,finishIds: [],productIds: [],selectedSectionValues: {"vertical-axis": token}};
  const quote = {productId: id,quantity: 1,areaM2: 0.96,storformat: selection};
  const create = handler("../stripe-create-payment-intent/index.ts",f.deps);
  const uncovered = await create(req({...body,amount_ore: 23300,checkout_quote: {...quote,areaM2: 0.8,storformat: {...selection,widthMm: 1000}}}));
  assert.equal(uncovered.status,409);
  assert.equal((await uncovered.json()).error,"checkout_storformat_price_missing");
  assert.equal(f.saved,null); assert.equal(f.f.calls.length,0);
  const oldPrice = await create(req({...body,amount_ore: 22100,checkout_quote: quote}));
  assert.equal(oldPrice.status,409); assert.equal(f.saved,null); assert.equal(f.f.calls.length,0);
  const response = await create(req({...body,amount_ore: 23300,checkout_quote: quote}));
  assert.equal(response.status,200);
  assert.equal(f.saved.quote_snapshot.pricingSource,"storformat_source_quotes_v1");
  assert.equal(f.saved.quote_snapshot.productPriceOre,18400);
  assert.equal(f.saved.quote_snapshot.shippingOre,4900);
  assert.equal(f.f.payment.amount,23300);
});
test("creator fixed/rate/matrix stored rows verify per-area extras and reject altered dimensions before creating intent", async () => {
  for (const type of ["fixed","rate","matrix"]) {
    const f = await newQuoteFixture(type);
    const quote = {productId: id,quantity: 2,formatId: token,widthMm: 1000,heightMm: 500,areaM2: 0.5,optionIds: [token]};
    const create = handler("../stripe-create-payment-intent/index.ts",f.deps);
    const altered = await create(req({...body,amount_ore: 15500,checkout_quote: {...quote,widthMm: 1}}));
    assert.equal(altered.status,409); assert.equal(f.saved,null); assert.equal(f.f.calls.length,0);
    const response = await create(req({...body,amount_ore: 15500,checkout_quote: quote}));
    assert.equal(response.status,200); assert.equal(f.f.payment.amount,15500);
    assert.equal(f.saved.quote_snapshot.productPriceOre,10100);
    assert.equal(f.saved.quote_snapshot.optionExtraOre,500);
  }
});
