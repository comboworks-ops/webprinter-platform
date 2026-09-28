# Admin live verification — 8 September 2026

Status: read-only connected-database checks completed at approximately 09:31 UTC. Authenticated browser acceptance is pending owner sign-in. This report supplements the [synthetic browser QA](ADMIN_DESIGN_QA_2026-09-08.md).

## Environment and evidence boundary

- The real local application listens on `127.0.0.1:8110`, process 63926, with its working directory at this checkout. Port 8138 is the separate synthetic UI fixture.
- Both local environment URL hostnames and `supabase/config.toml` identify Supabase project `ziattmsmiirfweiuunfo` (`printmaker-dev`, active/healthy). The project name does not establish that its data is disposable staging data.
- Aggregate queries used the Supabase connector against that project. These privileged database reads do not verify browser authentication, RLS for a signed-in user, or successful saves.
- Opening the real `/admin?force_domain=webprinter.dk` redirected to the storefront without an admin session. The sign-in screen is open for the owner. No session bypass was added.
- No live rows, payment methods, orders, supplier submissions, or deployments were changed. No customer-identifying data was selected for the usage checks.

## Is POD v1 in use?

The current database has no configured POD v1 storefront products or tenant imports, no fulfillment jobs, and no billing profiles. POD v1 remains installed as a legacy integration, with three catalog entries and callable admin routes/functions. This does not prove it has never been invoked or that deleted historical rows never existed.

| Live measure | POD v1 | POD v2 |
| --- | ---: | ---: |
| Catalog entries | 3 | 5 |
| Tenant import rows | 0 | 4 |
| Products with the integration flag | 0 | 3 |
| Published products with that flag | 0 | 3 |
| Fulfillment jobs | 0 | 3 |
| Billing profiles | 0 | 0 |
| Billing profiles with a `pm_demo_` method | 0 | 0 |

POD v2 has two jobs marked `submitted`, both with a provider reference, and one `awaiting_approval`. The newest job was created on 21 April 2026 at 07:09 UTC. These historical rows are not proof of a successful new order, current Stripe readiness, or physical fulfillment.

The checked-in application agrees with this configuration:

- Current checkout invokes `pod2-create-jobs` for `technical_specs.is_pod_v2` in `src/pages/FileUploadConfiguration.tsx`.
- Printproduktion reads POD v2 data through `src/lib/print-production/usePrintProductionData.ts` and submits through `pod2-order-submit` in `src/lib/pod2/hooks.ts`.
- Legacy storefront shipping requests can still invoke `pod-shipping-possibilities` for an `is_pod` product with Matrix layout and POD shipping enabled. No current product has that v1 flag.
- Legacy `/admin/pod-ordrer` retains manual v1 creation/charge actions. Both generations of Edge Functions remain deployed; deployment alone does not show use.

## Correction to the earlier billing finding

`src/pages/admin/PodBetaling.tsx` is the legacy POD v1 screen. Its setup handler requests a Stripe SetupIntent but then records a `pm_demo_` payment-method ID and readiness without completing card confirmation. That is a real source finding limited to the legacy workflow, which currently has no billing rows or configured products. It should not be presented as a limitation of the current POD v2 checkout.

The separate `src/pages/admin/Pod2Betaling.tsx` uses Stripe Elements and `stripe.confirmSetup`, checks a successful SetupIntent and payment method, and then writes to `pod2_tenant_billing`. Its source implementation does not establish live payment success; no card setup or charge was attempted here.

## Live schema checks

The source queries for the dashboard, orders, messages, and Printproduktion were compared with the connected database. All 106 distinct checked columns across 13 tables exist, including the dashboard's `tenants.settings` identity lookup. The four checked foreign-key relationships needed for embedded queries also exist: messages to orders, platform messages to tenants, and POD v2 price matrices/imports to catalog products.

The required authenticated-role table grants checked for these reads and the order/message mutations are present. RLS is enabled and policies exist on the checked tables. Policy presence and privileged schema access do not prove that a particular signed-in user can read or update the intended rows, or that another tenant is correctly denied.

## Dashboard context defect found and corrected locally

Executing the existing storefront tenant-selection branch and admin resolver with the same synthetic master-admin session reproduced a mismatch: the dashboard selected an owned shop while the header/order list selected the master tenant. The dashboard previously used the storefront `useShopSettings` hook, whose selection and fallback behavior differ from the admin resolver.

`Dashboard.tsx` now uses `resolveAdminTenant` and reads the name/logo from the exact resolved tenant. Its small `workspace/dashboardContext.ts` helper keeps missing identities, failed reads, context changes, and late responses explicit. The global storefront hook, admin resolver, pricing, and POD handlers were not changed.

Six behavioral regression tests pass. The three changed/added TypeScript files have zero diagnostics in the focused syntax/semantic check. The isolated browser dashboard at 924 × 827 rendered five fixture orders, with no page overflow, error alert, or captured console error. This is local regression evidence; the same behavior under the owner's real session is still pending.

The production build also completed successfully after this correction (`tmp/admin-overhaul-20260908/build-live-verification.log`, output under `/tmp/webprinter-admin-live-verification-build-20260908`). Existing bundle-size and WASM browser-compatibility warnings remain; this was a local build, not a deployment.

Evidence: `tmp/admin-overhaul-20260908/dashboard-context-before.log`, `dashboard-context-after.log`, `dashboard-context-types.log`, and `dashboard-context-after.png`.

## Remaining authenticated acceptance

After owner sign-in, verify the real dashboard, product register/configuration, order selection/detail, messages, Printproduktion, and design library against loaded data, including page errors and responsive layout. Successful saves, reload-after-save, storage, tenant isolation, payment setup, and supplier operations require their own appropriate acceptance evidence. Opening a route or querying as the project owner cannot establish those outcomes.
