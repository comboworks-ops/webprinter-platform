# Production Supabase key replacement

Latest production rollout checkpoint (16 September, evening): **41 live functions now use modern keys**, verified ACTIVE; public unpublished pricing is closed and the hardened supplier explorer is live. All 201 products and 357,913 generic price rows remain unchanged across 23-table content checks. Vercel production build settings use the modern public key and private-upload flag; domains and live schema/bucket are unchanged. The old service key remains enabled. Thomas approved preserving live contact emails; send-contact-message v8 is deployed and verified without sending mail. Thomas also approved the existing OpenAI/Gemini image-sharing and provider-cost behavior; icon-studio-generate v7 is ACTIVE with exact source verification and a denied guest probe, without generating images. A separate live checkout-schema migration was rejected as premature before the matched release; no live DDL was applied. The full v4 candidate is now READY on its protected Vercel URL after fixing server-dependency packaging and protected same-origin asset fetches. The six customer domains remain on the existing deployment; the prepared Stripe callback has not been created. Three new asset-security tests pass; TypeScript remains at 403 diagnostics. Matched backend/file/frontend release and final key disable remain open. New isolated checkout snapshots retain production selections. 145 focused tests pass; TypeScript remains at 403 diagnostics. See [the current rollout checkpoint](PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-16.md) for exact versions, candidate, remaining audit findings, approvals and rollback. Earlier checkpoints below are historical.

Latest key/file checkpoint (2026-09-16, 18:34 CEST): Thomas approved both
previously blocked actions, conditional on preserving products. Import deletion
is paused by zero-database-call HTTP 409 handlers in BOTH environments (v24 test,
v8 live for each removal endpoint). All 201 live products, 357,913 generic price
rows, options and imports are unchanged; full content checksums match across 23
tables in each backend. The isolated order-files bucket is now private. Its CDN
cache was purged after two old public URLs remained cached; all 11 original file
references then passed signed reads and public denial. Customer/tenant ownership,
history, paid files, supplier signed download without submission, anonymous
denials, immutable artwork, temporary PDF cleanup, signed-in capabilities and
replacement upload pass. All 20 original stored objects remain; the replacement
adds one file revision, with all 12 references bound and the old files retained.
The live file bucket, frontend, domain aliases and credentials remain unchanged.
50 existing isolated functions use modern keys; the removal endpoints need no
keys. Checkout/email remain paused; no payment, email or supplier order sent.
The exposed old live service key is still enabled. Current full production build,
matched live rollout, credential disable and browser acceptance remain open.
Prior 120 focused tests/build passed; 403 TypeScript diagnostics remain.
Read [the current migration checkpoint](KEY_AND_FILE_MIGRATION_2026-09-16.md) for proof and rollback boundaries.

Prepared 16 September 2026. Target: `ziattmsmiirfweiuunfo` / `printmaker-dev`.
No credential has been changed. Do not confuse this with isolated
`cyurochbkxggcobnxaxq` or the shared Stripe account.

## Evidence and scope

- The repository recorded service-role key exposure on 19 February 2026.
- The configured local key is a legacy service-role JWT issued 8 December 2025.
  One read-only Auth administrator request returned 200 on 16 September at
  12:07 UTC. Values and returned user data were not printed or retained.
  Evidence: `tmp/launch-email-20260916/legacy-key-status.json`.
- Read-only inventory found references in one Vercel API route, 53 Edge Function
  files, and 38 scripts. This counts references, not independently stored keys.
  Exact paths: `tmp/launch-email-20260916/service-key-consumers.txt`.
- Local `.env` contains the service key. The current downloaded Vercel production
  environment contains no named Supabase service/secret key; its browser anon key
  is legacy JWT. `api/tenant-shell.ts` has an optional privileged-key fallback.
  Supabase functions use platform-injected service-role environment configuration.
- Browser inspection confirms an existing modern `default` publishable key and
  masked `default` secret key. No additional key was created or secret revealed.
  The legacy disable action affects both anon and service-role keys. Do not press
  it while clients use them.
- Thomas confirmed this is the three-shop multi-tenant platform and its own
  admin/import system; no other applications are known to use it. His Webprinter
  admin login/password is separate from these API credentials and remains unchanged.
- Current live inventory contains **54 deployed Edge Functions**. This differs
  from the 53 source-file key references above. Preserve deployed versions and
  review consumers; do not deploy the dirty local functions directory wholesale.
- At 12:56 UTC, read-only requests with the existing modern publishable key passed
  the live tenants REST read and `tenant-context-read` storefront mode (both
  apikey-only and compatibility bearer forms). Legacy control also returned 200.
  `tenant-context-read` still has gateway JWT verification enabled. Evidence:
  `tmp/launch-email-20260916/modern-public-key-probes.json`. This does not verify
  private handlers, user login, new backend secret use, or legacy-key revocation.

## Coordinated replacement sequence

1. Use the existing modern API keys for staged migration. **Current Supabase
   guidance says legacy anon/service-role/JWT-secret rotation is no longer
   possible.** Do not follow the earlier legacy-rotation suggestion. API-key
   migration is separate from Auth JWT signing-key migration; do not change user
   passwords or signing keys as part of this API-key replacement.
2. Review and update consumers before disabling legacy API keys:
   - Vercel/browser configuration and the release validator currently use a legacy
     public JWT; the validator must safely accept a verified modern public key.
   - The optional `api/tenant-shell.ts` server credential fallback needs a modern
     private environment name and removal of its unsafe `VITE_` private fallback.
     No private Supabase key is configured in the downloaded production Vercel env.
   - Edge Functions read injected legacy credentials. Current documented modern
     variables are `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS`, JSON maps
     keyed by name. Update/verify actual deployed consumers, including caller Auth
     validation and service-to-service requests, without weakening authorization.
   - Local scripts, scheduled jobs, Vault/pg_net requests and any CI consumers need
     appropriate replacement values and headers. API keys belong in `apikey`;
     authenticated users retain their real access token in `Authorization`.
   Do not blanket-toggle gateway verification. The observed public gateway accepts
   the modern key, but gateway admission alone never proves a user or admin role.
3. Prepare each consumer update and a recovery window before revocation.
   The browser automation policy requires owner handoff for the credential-change
   submission. The open Supabase page is for coordination, not a request to click
   Disable now. No auto-review rejection occurred in this checkpoint.
4. Store replacement values only in appropriate private environments. Prove the
   staged replacement works for public reads, authenticated customer/admin paths,
   import access, payment finalization and email workers before disabling legacy
   keys. Modern keys coexisting with the old key do not close the exposure.
5. Rebuild the full matched frontend/backend candidate using the replacement public
   key. The current build manifest is valid for its existing key only. Preserve
   the six server routes; never promote the static isolated preview.
6. Prove the old privileged key is rejected, the replacement works, public tenant
   reads and customer/admin authentication work, tenant boundaries hold, and the
   reviewed checkout/webhook/file/email paths remain functional. Retain recovery
   for already-issued payments. An owner performs any real-money acceptance.

If cutover fails, pause new payments/sends and repair the affected consumer.
Do not restore a compromised administrator credential as a rollback.

Official references checked during preparation:
[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys),
[legacy rotation no longer available](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd),
[Vercel deployments](https://vercel.com/docs/deployments/managing-deployments).
The Supabase changelog Markdown URL could not be read by the web tool; this plan
does not assume unverified new key or gateway capabilities.
