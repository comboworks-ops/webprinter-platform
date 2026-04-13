# Go-Live Readiness Log

Date opened: 2026-03-21
Owner: Webprinter
Overall status: In progress

## Deadline Notice

Target go-live date for accepting real customer orders: NOT SET

This date must be set before opening the storefront to unrestricted live customer traffic.
Do not treat the storefront as go-live ready until the stop-ship items below are green.

## Current Focus

- Stabilize customer-facing storefront behavior before enabling real customer traffic.
- Finish a full route-by-route and order-flow review.
- Keep `Site Design V2` work from destabilizing the live storefront.
- Replace white-screen failure cases with a customer-safe fallback message.

## Step System

### 1. Customer-Safe Runtime Handling
- [x] Global customer-safe crash fallback at app root
- [ ] Verify fallback on local runtime with an intentional crash test
- [ ] Decide final customer-facing wording and support path for production

### 2. Critical Storefront Route Audit
- [ ] `/`
- [ ] `/shop`
- [ ] `/produkt/:slug`
- [ ] `/kontakt`
- [ ] `/grafisk-vejledning`
- [ ] `/min-konto`
- [ ] `/checkout/konfigurer`

### 3. Product And Pricing Sanity Checks
- [ ] Confirm published product cards render correct title/image/price
- [ ] Confirm featured product and side panel behave correctly
- [ ] Confirm category tabs, filters, and product navigation are stable
- [ ] Spot-check 5 to 10 live products end-to-end

### 4. Checkout And Order Intake
- [ ] Add-to-cart or configurator flow works on real published products
- [ ] File upload flow works without customer-facing errors
- [ ] Checkout form validation is clear and recoverable
- [ ] Order reaches admin/order management correctly
- [ ] Notification emails and contact touchpoints are verified

### 5. Tenant And Domain Safety
- [ ] Confirm correct storefront content on root domain vs tenant domains
- [ ] Confirm contact page routing works on both marketing and shop domains
- [ ] Confirm tenant isolation for branding and visible catalog content

### 6. Legal, Contact, And Trust
- [ ] Contact route is usable and trustworthy on live domains
- [ ] Terms, privacy, and cookie pages are reachable
- [ ] Footer/header contact details are correct on live storefront

### 7. Launch Decision
- [ ] All stop-ship items cleared
- [ ] Go-live date set
- [ ] Final manual smoke test completed
- [ ] Decision logged below with date and owner

## After Current Launch Steps

This is the next structural task after the current storefront/order/notification fixes are complete.

### Multi-Tenant Fulfillment Routing Audit
- [ ] Map which products are `tenant_self`
- [ ] Map which products are `master_manual`
- [ ] Map which products are `pod_v1`
- [ ] Map which products are `pod_v2`
- [ ] Decide whether a shared `fulfillment_mode` model is needed for products/orders
- [ ] Confirm customer-facing emails always use tenant identity, not master identity
- [ ] Confirm master-processed orders stay tenant-branded toward the customer
- [ ] Confirm POD/master forwarding keeps sender/blind-shipping intent intact
- [ ] Document which communication is customer-facing vs internal-only
- [ ] Write the final routing rules for `tenant -> master -> supplier/customer`

## Stop-Ship Items

Do not open for real customer ordering if any of these remain unresolved:

- White screen, uncaught crash, or blank customer-facing route without fallback
- Broken product page or configurator on a published product
- Wrong price display on a published customer-facing product
- Checkout or file upload fails on critical paths
- Tenant/domain routing serves the wrong storefront or wrong contact flow
- Missing contact/legal pages on live domains

## Progress Log

- 2026-03-21: Opened go-live readiness log and checklist.
- 2026-03-21: Added app-level customer-safe crash fallback so runtime failures show refresh/home/contact actions instead of a blank screen.
- 2026-03-21: Next required task is a deliberate critical-path audit across storefront, product, checkout, contact, and account routes.
- 2026-03-23: Added a follow-up fulfillment-routing audit for the mixed tenant/master/POD model so white-label customer ownership stays tenant-facing even when fulfillment goes through master or supplier channels.

## Notes For The Next Pass

- `Site Design V2` should continue as additive work, but storefront launch readiness has priority over new editor UX.
- Pricing logic remains protected and should only be checked, not changed, unless explicitly approved.
- If a release candidate is prepared, record the final go-live date and decision in this file before opening customer traffic.
- After the current launch blockers are cleared, audit the mixed fulfillment model explicitly: tenant-owned storefront, master-processed orders, and POD/manual supplier channels must be separated from customer-facing branding.
