# API key and order file migration — 16 September 2026

Latest production rollout checkpoint (16 September, evening): **41 live functions now use modern keys**, verified ACTIVE; public unpublished pricing is closed and the hardened supplier explorer is live. All 201 products and 357,913 generic price rows remain unchanged across 23-table content checks. Vercel production build settings use the modern public key and private-upload flag; domains and live schema/bucket are unchanged. The old service key remains enabled. Thomas approved preserving live contact emails; send-contact-message v8 is deployed and verified without sending mail. Thomas also approved the existing OpenAI/Gemini image-sharing and provider-cost behavior; icon-studio-generate v7 is ACTIVE with exact source verification and a denied guest probe, without generating images. A separate live checkout-schema migration was rejected as premature before the matched release; no live DDL was applied. The full v4 candidate is now READY on its protected Vercel URL after fixing server-dependency packaging and protected same-origin asset fetches. The six customer domains remain on the existing deployment; the prepared Stripe callback has not been created. Three new asset-security tests pass; TypeScript remains at 403 diagnostics. Matched backend/file/frontend release and final key disable remain open. New isolated checkout snapshots retain production selections. 145 focused tests pass; TypeScript remains at 403 diagnostics. See [the current rollout checkpoint](PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-16.md) for exact versions, candidate, remaining audit findings, approvals and rollback. Earlier checkpoints below are historical.

Status at 18:34 CEST: HOLD for the full production release. Thomas explicitly
approved the deletion pause in test then production and the isolated private-file
cutover, conditional on preserving products. Both steps are now complete. The
two removal endpoints are paused in both environments; 50 other existing
functions use modern keys in isolation. No live credential, bucket, frontend or
domain change was made in this checkpoint. No payment, email or supplier order
was sent. The earlier automatic-review blocks were resolved by this approval.

## Product preservation proof

Before/after full-row checksums match across 23 product, option, import and price
tables in EACH backend. Live: **201 products, 357,913 generic price rows, 195
option groups, 311 options and all four POD v2 imports retained unchanged**.
Isolated: 206 products and 357,918 generic price rows unchanged. Specialized
pricing tables and POD catalogue price matrices were also checked. Source proof:
`tmp/key-migration-20260916/preservation-{before,after}.json`.
No product, price, import, option, existing file or order was deleted.

## API keys

- Downloaded all 54 LIVE and 57 isolated function versions before editing. The
  source snapshots and exact per-function patches are in
  `tmp/key-migration-20260916/` and `output/key-migration-{live,staging}-20260916/`.
  Do not deploy the dirty local functions directory wholesale.
- `scripts/prepare-supabase-key-migration.mjs` preserves each deployed entrypoint,
  dependencies, import map and gateway setting, changing only key reads. The
  separately hardened endpoints below must replace their original key-only
  packets. Never accidentally redeploy an unsafe original packet.
- Shared `supabaseKeys.ts` selects modern singular environment keys or the named
  entry in `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS`. Bad configuration
  fails closed. Hosted deployments cannot fall back to legacy keys; local-only
  compatibility is retained. No secret was revealed, copied, created or revoked.
- Modern-key hosted guest/customer/platform-admin probes pass. The guest and
  customer cannot enter tenant administration; the platform admin can. Latest
  evidence: `tmp/key-migration-20260916/staging-canary-probes.json`.
- Browser and Vercel release validators accept modern public keys only after a
  read-only request proves the key belongs to the exact expected backend.
  The optional tenant-shell private `VITE_` fallback was removed.
- The LIVE frontend still uses its existing legacy public key, and LIVE backend
  consumers have not been migrated. **The exposed old service key remains valid.**
  Do not disable legacy keys until all consumers and the frontend are migrated.
  Admin login/password and Auth signing keys are separate and unchanged.
- A redacted deployment inventory is saved beside the other proof artifacts.
  Exact versions: `tmp/key-migration-20260916/staging-deployment-proof.json`.
  Script environments, external consumers and final credential disable still need
  coordinated acceptance. Test email cron remains inactive; its Vault entries
  contain the project URL and separate cron secret, with no legacy JWT detected.
- The image-generator key-only deployment was initially rejected for potential
  image disclosure/API spending. Read-only staging secret-name inspection then
  proved both OpenAI and Gemini credentials absent, and source inspection proved
  provider resolution fails before any external image request. The retry was
  accepted with no new provider credentials, permissions or image payload.

## Additional endpoint repairs found during migration

Automatic approval review rejected several unchanged legacy handlers inside the
key-only packets. Those rejections were not bypassed. The following replacements
were changed, tested and accepted for isolated deployment:

- `pod-explorer-request`: platform master role before supplier credentials,
  active master Print.com connection, allowlisted origins and product/price-quote
  operations, bounded input/output, no redirects, timeouts and secret redaction.
  Existing single/batch price quotes remain available. No supplier calls tested.
- `pod-shipping-possibilities`: retain customer storefront delivery quotes while
  accepting only an existing published product, quantity and stored price variant.
  Free-form supplier option/address/request fields are rejected. Active master
  Print.com connection only, fixed quote endpoint, bounded responses, no redirects
  and no raw provider payload/error exposure. Existing UI request shape passes.
- `pod2-create-jobs`: an order UUID is no longer authority. A guest must supply
  the completed checkout's separate recovery token bound to this order, tenant
  and paid amount; otherwise exact tenant admin/owner or platform master access
  is required. Automatic paid forwarding additionally requires completed payment
  evidence. Existing manual jobs without that evidence await approval. The
  checkout callback now supplies its recovery capability.

`pod-tenant-remove` and `pod2-tenant-remove` now return HTTP 409 with
`import_removal_temporarily_disabled`. They contain no database client, credentials
or deletion calls. Both are version 24 in isolation and version 8 live, with
gateway JWT verification retained. Test public-key and platform-admin requests
both refuse deletion; live public-key probes also refuse it. OPTIONS still works.
The test inventory matched before the live deployment; both backend inventories
matched afterward. Only import removal is paused. Neither endpoint changes
products, price calculations, ordinary imports or storefront reads.
Evidence: `tmp/key-migration-20260916/removal-pause-*.json`.
Do not redeploy the original key-only removal packets: they restore hard deletion.

## Private file foundation and readers

Deployed on isolated `cyurochbkxggcobnxaxq` only:

- `20260916151258_storefront_private_file_access.sql` creates a service-only,
  RLS-protected upload-claim table with hashed random capabilities and expiry.
- `storefront-file-access` v1, gated by `STOREFRONT_PRIVATE_FILES_ENABLED=true`
  in the isolated backend. Guest uploads use random paths and short-lived signed
  upload grants with overwrite disabled. Read grants require the exact capability,
  tenant and, for signed-in allocations, matching owner.
- `stripe-create-payment-intent` v34 checks the upload capability and approved
  SHA-256, copies exact bytes into immutable finalized paths, and strips raw file
  capabilities from persisted order snapshots. Checkout remains paused.
- `pod2-pdf-preflight` v19 signs legacy inputs with the caller's storage rights
  or validates a private upload capability. Corrected output is a new file with
  a signed download link and requires re-upload/approval; it no longer overwrites
  an approved file. Tenant role checks are scoped to admin/owner/master.
- `pod2-order-submit` v26 prepares a bounded-duration signed supplier link after
  checking the durable order/file binding. The validation fingerprint retains
  the stable archive locator. The binding RPC is now installed and the exact
  helper retrieved identical PDF bytes through a supplier signed link. A mismatched
  order cannot obtain a link. Actual supplier submission remains untested and was
  not performed.

The frontend includes capability-based guest upload/download, signed-on-click
customer/admin file links, and Designer integration. Capabilities live in the
browser tab session; closing that tab can require re-upload before checkout.
Existing paid-attempt recovery remains independent of upload expiry.

Real isolated API/SDK test: uploaded the known synthetic 1,390,741-byte CMYK PDF,
downloaded identical bytes, rejected wrong/missing tokens, wrong tenant, conflicting
allocation and overwrite attempts. The repeated probe after cutover also rejects
public URLs and anonymous direct reads. Evidence:
`tmp/key-migration-20260916/private-upload-probes.json`. The test bucket enforces
a 25 MiB file limit. Signed-in allocations additionally reject another user or a
guest even when the upload capability is known.

## Storage cutover: isolated acceptance passed

`20260916152039_restrict_order_file_storage_reads.sql` was applied to isolated
`cyurochbkxggcobnxaxq` after Thomas's explicit approval. It remains unapplied live.

The SQL freezes legacy file-to-order bindings, derives finalized bindings from
service-owned checkout snapshots, retains owned customer replacements, and adds
restrictive read/write boundaries before making the bucket private. Mutable
order_files references alone cannot grant access to another shop's object.
URL decoding supports encoded spaces/Danish filenames. Service-only binding RPC
and explicit grants are included; no files or order history are deleted.

**The isolated order-files bucket is private; the live bucket remains public.**
Real API/SDK checks passed:

- All 11 original order-file references remain bound and readable by the platform
  admin, including guest paid-order artwork. All original public URLs deny reads.
- Customer A and tenant owner A can open their current/history and finalized paid
  files; customer B and tenant owner B cannot. Guest upload capabilities and
  signed-in owner checks pass. Anonymous list/sign/read/direct upload is denied.
- A customer cannot overwrite or delete paid artwork. A temporary PDF input can
  be uploaded, read and cleaned up by its owner; another customer cannot read or
  remove it. Only the newly created temporary probe file was deleted.
- The production signing helper reads exact stored PDF bytes, rejects a foreign
  order binding and preserves the stable validation fingerprint across signing.
  This uses the actual storage API and helper; it does not prove a real supplier
  order, external supplier acceptance or physical production.
- The actual customer replacement helper completed immutable upload plus atomic
  registration on synthetic fixture order A. Its two previous file revisions are
  retained, one new revision is current, the re-upload request is cleared, and
  customer/tenant owner access plus supplier binding pass. Closed requests and
  another customer's uploads are denied. No new order was created.
- All 20 stored objects present before cutover remain (ID checksum
  `ddb237dadd34154a6af46cf3d770490f` unchanged). There are still 11 orders and now
  12 order-file references, all bound. The extra reference is the replacement test.

Evidence: `tmp/key-migration-20260916/private-reader-probes.json`,
`private-replacement-probes.json`, `private-upload-probes.json`, and
`private-cutover-final-proof.json`. These are hosted API/SDK checks using fixture
accounts and the real reader/replacement helpers, not full browser acceptance.

### Required CDN step for the future live cutover

The first reader test found two old public URLs still returning PDF bytes from
the CDN (`cf-cache-status: HIT`) after the database flag became private. A fresh
`cacheNonce` request for the same files returned 400, identifying stale CDN copies.
The SQL bucket update does not run the Storage API's public-to-private cache purge.
The documented cache-only `DELETE /storage/v1/cdn/order-files` endpoint returned
200 on the isolated project. After propagation, all 11 original public URLs were
denied and the full reader checks passed. No stored object was removed by purging.
Evidence: `tmp/key-migration-20260916/private-cache-purge.json`.

For any later live cutover, deploy matching readers and authorization first, then
make storage private AND purge its CDN cache through the Storage API. Verify old
public URLs without adding a cache-busting parameter. Do not reopen the bucket.
Supabase documents up to 60 seconds for CDN invalidation and notes that browser
caches are unaffected; signed-token expiry also does not invalidate an already
cached signed response. Treat signed links as bearer download grants and avoid
claiming immediate revocation of downloaded/cached copies.
Sources: [cache purge](https://supabase.com/docs/guides/storage/cdn/purge-cdn-cache),
[Storage API update behavior](https://github.com/supabase/storage/blob/master/src/storage/storage.ts),
[signed response caching](https://supabase.com/docs/guides/storage/cdn/smart-cdn).
No public-to-private switch should be shipped alone.

## Verification and rollback

- 120 focused checkout/tax/email/key/file/job tests pass, recorded in
  `tmp/key-migration-20260916/release-tests.log`. Four changed payment/file/POD handlers
  plus the hardened shipping and job handlers pass Deno checking.
- Final isolated Vite build passes in 9.79s with modern public key, test Stripe key and
  private-upload UI. The protected preview opens; Webprinter catalogue and
  Salgsmapper tenant navigation render. No console errors in that limited check.
  This is not full authenticated/browser/upload or all-product acceptance.
- Final protected preview:
  https://printmaker-web-craft-main-mfwnq9tk3-thomas-projects-d80b9ddd.vercel.app
  (`dpl_BZuYAdSk9tTWP6mwtN4YaEs7wphW`, target null). Final catalogue rendered and
  browser error log was empty. This replaces the intermediate 6qxel2b6i preview.
  Payment is paused despite the banner describing the build's test-only capability.
- Final pause evidence: checkout HTTP 503 `checkout_backend_not_ready`; secret
  digests match checkout false and email disabled, cron inactive. See
  `tmp/key-migration-20260916/paused-effects-proof.json`. Secret values were not
  printed or altered to run this check.
- TypeScript still reports 403 diagnostics, matching the prior count. No new
  diagnostics were reported in the added file/key/link modules. The compiler is
  not clean. Grant and function-exposure checks pass. No lockfile was changed.
- The `npm audit` command could not start because npm is absent from the tool
  runtime; dependency-audit acceptance remains open before production release.
- No full current production build was created. All earlier full production
  candidates are stale after these source changes. Do not promote the static
  isolated preview to production: it has test configuration and no six API routes.

Rollback: pause new checkout, email, supplier actions and upload allocation when
needed; retain successful-payment reconciliation, claims, immutable artwork and
paid-order evidence. Restore a reviewed compatible handler from the saved source
snapshots only if it retains the new authorization boundary. Do not restore
unsafe proxies or hard-delete endpoints. After storage privacy is accepted, fix
the affected reader rather than republishing customer files. Do not disable old
keys until replacement consumers have been verified and the owner performs the
final credential action.
