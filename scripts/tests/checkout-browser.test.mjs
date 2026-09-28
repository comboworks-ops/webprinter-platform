// Run against this repository's localhost:8110 Vite preview. All remote requests
// are intercepted, and no real authentication, Stripe or storage action occurs.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const output = new URL('../../tmp/connection-repairs-browser/', import.meta.url);
await mkdir(output, { recursive: true });
const pdf = await PDFDocument.create();
pdf.addPage([216 / 25.4 * 72, 303 / 25.4 * 72]);
const pdfBytes = await pdf.save();
const pdfSha256 = createHash('sha256').update(pdfBytes).digest('hex');
const mockSource = String.raw`const shop = '11111111-1111-4111-8111-111111111111';
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'synthetic@example.test', user_metadata: {} };
const tenant = { id: shop, name: 'Synthetic proof shop', domain: 'synthetic.test', settings: { branding: { published: { themeSettings: { storefrontTheme: 'print-familiar', orderFlowDesigns: { checkout: 14 } } } } } };
const product = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tenant_id: shop, slug: 'synthetic', name: 'Synthetic PDF product', technical_specs: { width_mm: 210, height_mm: 297, bleed_mm: 3, min_dpi: 300 }, banner_config: {}, template_files: [] };
const listeners = new Set();
window.__calls = JSON.parse(sessionStorage.getItem('__synthetic_calls') || '[]');
function record(call) { window.__calls.push(call); sessionStorage.setItem('__synthetic_calls', JSON.stringify(window.__calls)); }
window.__paymentMode = sessionStorage.getItem('__synthetic_payment_mode') || 'legacy';
window.__finalizeMode = sessionStorage.getItem('__synthetic_finalize_mode') || 'fail';
window.__releaseAddress = null;
function query(table) {
  let single = false, mutation = null;
  const q = new Proxy({}, { get(_, method) {
    if (method === 'then') return async resolve => {
      let data = [];
      if (mutation) { record({ table, mutation }); data = { id: 'saved' }; }
      else if (table === 'tenants') data = single ? tenant : [tenant];
      else if (table === 'products') data = single ? product : [product];
      else if (table === 'profiles') data = { first_name: 'Saved', last_name: 'Customer', phone: '12345678', company: '' };
      else if (table === 'tenant_payment_settings') data = { status: 'active', charges_enabled: true, stripe_account_id: null };
      else if (table === 'customer_addresses') data = await new Promise(resolveAddress => {
        window.__releaseAddress = () => resolveAddress([{ id: 'address-a', first_name: 'Saved', last_name: 'Recipient', street_address: 'Saved road 1', street_address_2: 'Floor 2', postal_code: '1000', city: 'Stockholm', country: 'SE', is_default: true }]);
      });
      resolve({ data, error: null });
    };
    return (...args) => {
      if (['single', 'maybeSingle'].includes(method)) single = true;
      if (['update', 'insert', 'delete', 'upsert'].includes(method)) mutation = { method, payload: args[0] };
      return q;
    };
  } });
  return q;
}
export const supabase = {
  from: query,
  rpc: () => query('rpc'),
  auth: {
    getUser: async () => ({ data: { user }, error: null }),
    getSession: async () => ({ data: { session: { user } }, error: null }),
    onAuthStateChange: fn => {
      listeners.add(fn);
      return { data: { subscription: { unsubscribe() { listeners.delete(fn); } } } };
    },
  },
  storage: {
    from: () => ({
      download: async () => ({ data: new Blob([Uint8Array.from(atob('__PDF_BASE64__'), character => character.charCodeAt(0)), window.__fileHashMismatch ? 'changed' : ''], { type: 'application/pdf' }), error: null }),
      getPublicUrl: path => ({ data: { publicUrl: 'https://synthetic.test/' + path } }),
    }),
  },
  functions: {
    invoke: async (name, { body }) => {
      record({ name, body });
      if (name === 'stripe-create-payment-intent') return {
        data: window.__paymentMode === 'legacy' ? { client_secret: 'old-secret' } : { contract_version: 2, checkout_attempt_id: body.checkout_attempt_id, payment_intent_id: 'pi_synthetic', client_secret: 'synthetic_secret', connected: false }, error: null,
      };
      if (name === 'stripe-finalize-checkout') return window.__finalizeMode === 'fail'
        ? { data: null, error: { message: 'simulated finalizer failure' } }
        : { data: { contract_version: 2, success: true, order: {
          id: 'order-synthetic', order_number: 'TEST-0001', product_name: 'Persisted synthetic product', quantity: 25, total_price: 777, customer_email: user.email, customer_name: 'Saved Customer',
          checkout_receipt: { productName: 'Persisted synthetic product', quantity: 25, fileName: 'persisted-print.pdf', subtotal: 700, shipping: 77, total: 777 },
          checkout_notification: { status: sessionStorage.getItem('__synthetic_notification_status') || 'pending' },
        } }, error: null };
      return { data: [], error: null };
    },
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: async () => {},
};
window.__setSyntheticUser = next => { Object.assign(user, next); for (const fn of listeners) fn('SIGNED_IN', { user }); };
`;
const mock = mockSource.replace('__PDF_BASE64__', Buffer.from(pdfBytes).toString('base64'));
const shop = '11111111-1111-4111-8111-111111111111';
const product = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const base = 'http://127.0.0.1:8110';
const browser = await chromium.launch({ headless: true });
const report = { proofBoundary: 'Real local checkout components; synthetic Supabase module, Stripe form, and Designer destination; remote requests intercepted without transmission.', assertions: [], widths: [], pageErrors: [], consoleErrors: [], interceptedRemoteRequests: [] };
const contexts = [];
let currentPage;
async function setup() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  contexts.push(context);
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin === base && u.pathname === '/src/integrations/supabase/client.ts') return route.fulfill({ contentType: 'text/javascript', body: mock });
    if (u.origin === base && u.pathname === '/src/components/checkout/StripePaymentForm.tsx') return route.fulfill({ contentType: 'text/javascript', body: `import React from '/.vite/deps/react.js'; export function StripePaymentForm(props){return React.createElement('div',{'data-testid':'synthetic-stripe'},React.createElement('p',null,'Synthetic payment boundary'),React.createElement('button',{onClick:()=>props.onSuccess('pi_synthetic')},'Complete synthetic payment'));}` });
    if (u.origin === base && u.pathname === '/src/pages/Designer.tsx') return route.fulfill({ contentType: 'text/javascript', body: `import React from '/.vite/deps/react.js';export function Designer(){return React.createElement('main',{'data-testid':'synthetic-designer-destination'},'Synthetic Designer destination');}export default Designer;` });
    if (u.origin === base) return route.continue();
    report.interceptedRemoteRequests.push({ method: route.request().method(), url: u.origin + u.pathname });
    if (u.hostname === 'synthetic.test' && u.pathname.endsWith('.pdf')) return route.fulfill({ contentType: 'application/pdf', body: Buffer.from(pdfBytes) });
    return route.fulfill({ contentType: u.pathname.endsWith('.css') ? 'text/css' : 'application/json', body: u.pathname.endsWith('.css') ? '' : '[]' });
  });
  await context.addInitScript(({ product, pdfSha256 }) => {
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5xkAAAAASUVORK5CYII=';
    if (!sessionStorage.getItem('wp_site_checkout_session')) sessionStorage.setItem('wp_site_checkout_session', JSON.stringify({
      productId: product, productSlug: 'synthetic', productName: 'Synthetic PDF product', quantity: 100, totalPrice: 500, productPrice: 500,
      selectedFormat: 'A4', designWidthMm: 210, designHeightMm: 297, designBleedMm: 3, pricingQuote: { productId: product, quantity: 100 },
      siteUpload: { sha256: pdfSha256, name: 'approved.pdf', mimeType: 'application/pdf', fileUrl: 'https://synthetic.test/approved.pdf', filePath: 'order-files/print.pdf', physicalWidthMm: 216, physicalHeightMm: 303, previewDataUrl: pixel }, checkoutCustomer: {},
    }));
  }, { product, pdfSha256 });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('response', response => { if(response.status() >= 400) report.consoleErrors.push(response.status() + ' ' + new URL(response.url()).pathname); });
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${base}/checkout/konfigurer?tenantId=${shop}`, { waitUntil: 'networkidle' });
  if (await page.getByRole('button', { name: 'Kun nødvendige', exact: true }).isVisible()) await page.getByRole('button', { name: 'Kun nødvendige', exact: true }).click();
  await page.locator('#delivery-address').waitFor({ state: 'attached' });
  await page.locator('summary').filter({ hasText: 'Kontakt & modtager' }).click();
  await page.locator('#delivery-address').waitFor({ state: 'visible' });
  await page.waitForFunction(() => typeof window.__releaseAddress === 'function');
  return page;
}
async function releaseAddress(page) {
  await page.evaluate(() => window.__releaseAddress());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function approve(page) {
  await page.getByRole('button', { name: 'Godkend fil', exact: true }).first().click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Gå til betaling')?.disabled === false);
}
try {
  const countryPage = await setup();
  await countryPage.locator('#delivery-country').fill('NO');
  await releaseAddress(countryPage);
  assert.equal(await countryPage.locator('#delivery-country').inputValue(), 'NO');
  report.assertions.push('A country-only customer edit survives a late default-address response.');
  await countryPage.context().close();

  const page = await setup();
  await page.locator('#delivery-address').fill('Typed street 1');
  await releaseAddress(page);
  assert.equal(await page.locator('#delivery-address').inputValue(), 'Typed street 1');
  report.assertions.push('A typed street survives the late default-address response.');
  for (const [id, value] of [['customer-email', 'synthetic@example.test'], ['customer-name', 'Typed Customer'], ['delivery-recipient-name', 'Typed Recipient'], ['delivery-address2', 'Floor 3'], ['delivery-country', 'SE'], ['delivery-zip', '1000'], ['delivery-city', 'Stockholm']]) {
    await page.locator('#' + id).fill(value);
  }
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('wp_site_checkout_session')).checkoutCustomer?.deliveryAddress2 === 'Floor 3');
  report.addressBeforeReload = await page.evaluate(() => {const state=JSON.parse(sessionStorage.getItem('wp_site_checkout_session'));return {checkoutInstanceId:state.checkoutInstanceId,customer:state.checkoutCustomer,history:history.state};});
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#delivery-address').waitFor({ state: 'attached' });
  report.addressAfterReload = await page.evaluate(() => {const state=JSON.parse(sessionStorage.getItem('wp_site_checkout_session'));return {checkoutInstanceId:state.checkoutInstanceId,customer:state.checkoutCustomer,history:history.state};});
  await page.locator('summary').filter({ hasText: 'Kontakt & modtager' }).click();
  await page.waitForFunction(() => typeof window.__releaseAddress === 'function');
  await releaseAddress(page);
  assert.equal(await page.locator('#delivery-address').inputValue(), 'Typed street 1');
  assert.equal(await page.locator('#delivery-address2').inputValue(), 'Floor 3');
  assert.equal(await page.locator('#delivery-country').inputValue(), 'SE');
  report.assertions.push('Street, address line 2, and country survive a complete page reload.');
  await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = true; }));
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: fileURLToPath(new URL(`checkout-${width}.png`, output)), fullPage: true, animations: 'disabled' });
    if (width === 390) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: fileURLToPath(new URL('checkout-390-viewport.png', output)), animations: 'disabled' }); }
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    report.widths.push({ width, ...dimensions });
    assert.ok(dimensions.document <= width + 1, `Horizontal document overflow at ${width}px: ${dimensions.document}px`);
  }
  report.assertions.push('Checkout has no horizontal document overflow at all six recorded widths.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await approve(page);
  report.assertions.push('An unchanged PDF with the exact product dimensions can be approved and enables payment.');
  await page.evaluate(() => { window.__fileHashMismatch = true; });
  await page.getByRole('button', { name: 'Gå til betaling', exact: true }).click();
  await page.getByText('Trykfilen er ændret', { exact: false }).first().waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.__calls.filter(call => call.name === 'stripe-create-payment-intent').length), 0);
  report.assertions.push('Changed production bytes after proof approval prevent any payment-intent request.');
  await page.evaluate(() => { window.__fileHashMismatch = false; });
  await page.getByRole('button', { name: 'Gå til betaling', exact: true }).click();
  await page.waitForFunction(() => window.__calls.some(call => call.name === 'stripe-create-payment-intent'));
  await page.getByText('Butikkens betaling er ikke klar til sikker ordreoprettelse.', { exact: false }).first().waitFor({ state: 'visible' }).catch(async () => {
    const body = await page.locator('body').innerText();
    assert.match(body, /ikke.*klar|ikke.*opdateret|opdateres|ikke.*sikker|understøtter/i);
  });
  assert.equal(await page.getByTestId('synthetic-stripe').count(), 0);
  assert.equal(await page.getByText('Ordrebekræftelse', { exact: true }).count(), 0);
  const firstAttempt = await page.evaluate(() => window.__calls.find(call => call.name === 'stripe-create-payment-intent').body.checkout_attempt_id);
  report.assertions.push('A legacy create-payment response cannot mount the Stripe form or display order success.');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Kontrollér betaling og ordre', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.getByTestId('synthetic-stripe').count(), 0);
  assert.equal(await page.evaluate(() => window.__calls.filter(call => call.name === 'stripe-create-payment-intent').length), 1);
  report.assertions.push('A pending attempt without a payment-intent ID survives reload with recovery controls and no new create request.');
  await approve(page);
  await page.evaluate(() => { window.__paymentMode = 'v2'; sessionStorage.setItem('__synthetic_payment_mode', 'v2'); });
  await page.getByRole('button', { name: 'Gå til betaling', exact: true }).click();
  await page.getByTestId('synthetic-stripe').waitFor({ state: 'visible' });
  const attempts = await page.evaluate(() => window.__calls.filter(call => call.name === 'stripe-create-payment-intent').map(call => call.body.checkout_attempt_id));
  assert.deepEqual(attempts, [firstAttempt, firstAttempt]);
  await page.getByRole('button', { name: 'Complete synthetic payment' }).click();
  await page.getByText('Betaling og ordre er endnu ikke bekræftet samlet.', { exact: false }).first().waitFor({ state: 'visible' });
  assert.equal(await page.getByText('Ordrebekræftelse', { exact: true }).count(), 0);
  report.assertions.push('Failed durable finalization shows a recoverable warning and no order success.');
  await page.evaluate(() => { window.__finalizeMode = 'success'; sessionStorage.setItem('__synthetic_finalize_mode', 'success'); });
  await page.getByRole('button', { name: 'Kontrollér betaling og ordre', exact: true }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Ordrebekræftelse', exact: true }).waitFor({ state: 'visible' });
  const confirmation = page.getByRole('dialog');
  const receiptText = await confirmation.innerText();
  assert.match(receiptText, /Persisted synthetic product/);
  assert.match(receiptText, /777/);
  assert.match(receiptText, /TEST-0001/);
  assert.doesNotMatch(receiptText, /Synthetic PDF product/);
  assert.match(receiptText, /sat i kø til afsendelse/);
  assert.doesNotMatch(receiptText, /ordrebekræftelse er afsendt/);
  report.assertions.push('A saved email queue entry is described as queued, without claiming an email has been sent.');
  await page.screenshot({ path: fileURLToPath(new URL('confirmation.png', output)), fullPage: false, animations: 'disabled' });
  report.confirmationStyle = await confirmation.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, opacity: getComputedStyle(element).opacity, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
  report.assertions.push('A verified retry shows server receipt product/777 total/order number, not the current form receipt.');
  const beforeReload = await page.evaluate(() => window.__calls.filter(call => call.name === 'stripe-create-payment-intent').length);
  const beforeFinalizeReload = await page.evaluate(() => window.__calls.filter(call => call.name === 'stripe-finalize-checkout').length);
  await page.evaluate(() => sessionStorage.setItem('__synthetic_notification_status', 'accepted'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('dialog').getByRole('heading', { name: 'Ordrebekræftelse', exact: true }).waitFor({ state: 'visible' });
  assert.match(await page.getByRole('dialog').innerText(), /Persisted synthetic product/);
  assert.equal(await page.evaluate(() => window.__calls.filter(call => call.name === 'stripe-create-payment-intent').length), beforeReload);
  assert.ok(await page.evaluate(() => window.__calls.filter(call => call.name === 'stripe-finalize-checkout').length) > beforeFinalizeReload);
  report.assertions.push('Completed-order reload asks the finalizer again, restores the server receipt, and does not create another payment.');
  assert.match(await page.getByRole('dialog').innerText(), /ordrebekræftelse er afsendt/);
  report.assertions.push('A restored receipt reports email sending only when the server reports provider acceptance.');
  const calls = await page.evaluate(() => window.__calls);
  assert.equal(calls.filter(call => call.table === 'orders' || call.table === 'order_files').length, 0);
  const startOrder = calls.find(call => call.name === 'stripe-create-payment-intent').body.checkout_order;
  assert.equal(startOrder.delivery_address2, 'Floor 3');
  assert.equal(startOrder.delivery_country, 'SE');
  assert.match(startOrder.files[0].sha256, /^[a-f0-9]{64}$/);
  report.assertions.push('Payment start binds country, address line 2 and a SHA-256 production artifact; browser performs no order/file INSERT.');

  const dragPage = await setup();
  await releaseAddress(dragPage);
  await dragPage.getByRole('button', { name: 'Åbn korrektur', exact: true }).first().click();
  await dragPage.getByRole('dialog').waitFor({ state: 'visible' });
  const artboard = dragPage.locator('.order-proof-canvas .cursor-grab').first();
  const box = await artboard.boundingBox();
  assert.ok(box);
  await dragPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await dragPage.mouse.down();
  await dragPage.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 22, { steps: 5 });
  await dragPage.mouse.up();
  await dragPage.screenshot({ path: fileURLToPath(new URL('proof-adjusted.png', output)), fullPage: false, animations: 'disabled' });
  await dragPage.getByRole('button', { name: 'Godkend fil og fortsæt', exact: true }).click();
  await dragPage.waitForURL('**/designer?**');
  await dragPage.getByTestId('synthetic-designer-destination').waitFor({ state: 'visible' });
  const upload = await dragPage.evaluate(() => JSON.parse(sessionStorage.getItem('wp_site_checkout_session')).siteUpload);
  assert.ok(Math.abs(upload.proofingOffsetXPercent) > 0.1 || Math.abs(upload.proofingOffsetYPercent) > 0.1);
  assert.equal(new URL(dragPage.url()).searchParams.get('tenantId'), shop);
  assert.match(new URL(dragPage.url()).searchParams.get('returnTo'), /checkout\/konfigurer/);
  report.assertions.push('Dragging the proof then approving routes to Designer with saved placement and preserved shop/checkout return.');
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.pass = true;
} catch (error) {
  report.pass = false;
  report.failure = error.stack;
  if (currentPage && !currentPage.isClosed()) {
    report.failureBody = await currentPage.locator('body').innerText();
    await currentPage.screenshot({ path: fileURLToPath(new URL('failure.png', output)), fullPage: true, animations: 'disabled' });
  }
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
