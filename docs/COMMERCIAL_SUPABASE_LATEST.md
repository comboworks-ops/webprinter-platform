# Commercial Supabase Report

Generated: 2026-07-27T23:33:17.835Z
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [ahead 49]
Status: REVIEW REQUIRED

This is a local, read-only Supabase review artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Supabase entries: 21
Deployable packet entries: 16
Hold/local artifact entries: 5
Risk groups: 5

## Required Checks

| Status | Check | Evidence |
| --- | --- | --- |
| PASS | Supabase Data API grants | Supabase Data API grant check passed for 2 migration file(s). |
| PASS | Supabase function exposure | Supabase function exposure check passed for 55 functions. |

## Supabase Risk Groups

| Group | Files | Review focus |
| --- | ---: | --- |
| config duplicate/local | 1 | Confirm duplicate or space-suffixed config files are local artifacts and not deployable config. |
| edge functions | 15 | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| function deployment config | 1 | Verify function JWT/public-read settings before deploying Edge Functions. |
| local Supabase temp | 2 | Usually local tooling state; avoid staging unless there is a deliberate reason. |
| migration/grants | 2 | Verify explicit Data API GRANT/REVOKE decisions, RLS scope and rollback notes before deployment. |

## Required Verification

- `npm run check:supabase-grants` must pass for changed/untracked migrations.
- `npm run check:supabase-functions` must pass before any function deploy.
- Function changes touching `pricing-read` or `product-detail-read` need service-role, tenant-scope and public exposure review before deployment.
- Space-suffixed Supabase files such as `supabase/config 2.toml` or `supabase/functions/test-env/index 2.ts` are held outside the deployable packet unless explicitly approved.

## Supabase Candidate Files

| Decision | Status | Path | Risk group | Review focus |
| --- | --- | --- | --- | --- |
| HOLD | M | `supabase/.temp/cli-latest` | local Supabase temp | Usually local tooling state; avoid staging unless there is a deliberate reason. |
| DEPLOY-REVIEW | M | `supabase/config.toml` | function deployment config | Verify function JWT/public-read settings before deploying Edge Functions. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2-create-jobs/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2-explorer-request/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2-master-forward/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2-order-submit/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2-printcom-sync-status/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2-submit-to-printcom/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2-tenant-approve-charge/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/pod2x-printcom-proxy/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| HOLD | ?? | `supabase/.temp/cli-latest 2` | local Supabase temp | Usually local tooling state; avoid staging unless there is a deliberate reason. |
| HOLD | ?? | `supabase/config 2.toml` | config duplicate/local | Confirm duplicate or space-suffixed config files are local artifacts and not deployable config. |
| DEPLOY-REVIEW | ?? | `supabase/functions/_shared/erpShadow.test.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | ?? | `supabase/functions/_shared/erpShadow.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | ?? | `supabase/functions/_shared/pod2PrintcomSafety.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | ?? | `supabase/functions/_shared/pod2PrintcomSafety_test.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | ?? | `supabase/functions/company-hub-invite-member/` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | ?? | `supabase/functions/supplier-bank-url-import/` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| HOLD | ?? | `supabase/functions/test-env/index 2.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| HOLD | ?? | `supabase/migrations/20260509120000_index_generic_product_prices_lookup 2.sql` | migration/grants | Verify explicit Data API GRANT/REVOKE decisions, RLS scope and rollback notes before deployment. |
| DEPLOY-REVIEW | ?? | `supabase/migrations/20260714190000_harden_print_production_submission.sql` | migration/grants | Verify explicit Data API GRANT/REVOKE decisions, RLS scope and rollback notes before deployment. |

## Held Outside Deployable Packet

| Status | Path | Hold reason |
| --- | --- | --- |
| HOLD | `supabase/.temp/cli-latest` | Usually local tooling state; avoid staging unless there is a deliberate reason. |
| HOLD | `supabase/.temp/cli-latest 2` | Usually local tooling state; avoid staging unless there is a deliberate reason. |
| HOLD | `supabase/config 2.toml` | Confirm duplicate or space-suffixed config files are local artifacts and not deployable config. |
| HOLD | `supabase/functions/test-env/index 2.ts` | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| HOLD | `supabase/migrations/20260509120000_index_generic_product_prices_lookup 2.sql` | Verify explicit Data API GRANT/REVOKE decisions, RLS scope and rollback notes before deployment. |

## Deploy Owner Plan

- Deploy only after the release owner has freshened the branch and rerun `npm run check:commercial-release`.
- Apply the index migration before deploying the public read functions when this packet is released.
- Config: `pricing-read` and `product-detail-read` are intentionally public read functions (`verify_jwt = false`) and must stay tenant-scoped in code.
- Functions: deploy `pod2-create-jobs`, `pod2-explorer-request`, `pod2-master-forward`, `pod2-order-submit`, `pod2-printcom-sync-status`, `pod2-submit-to-printcom`, `pod2-tenant-approve-charge`, `pod2x-printcom-proxy` with the project-approved Supabase function deploy command.

## Rollback Notes

- Function exposure rollback: restore `verify_jwt = true` for `pricing-read` and `product-detail-read`, then redeploy function config.
- Function rollback: redeploy the previous known-good versions of `pod2-create-jobs`, `pod2-explorer-request`, `pod2-master-forward`, `pod2-order-submit`, `pod2-printcom-sync-status`, `pod2-submit-to-printcom`, `pod2-tenant-approve-charge`, `pod2x-printcom-proxy`.

## Post-Deploy Smoke

- Run `npm run check:commercial-release` after Supabase deployment.
- Check Webprinter Aluminium price/order handoff.
- Check Salgsmapper standard folder template/download/designer handoff.
- Check Onlinetryksager flyer order handoff.
- Stop and roll back if either public read function returns cross-tenant data, unpublished products, missing prices, or CORS/JWT errors.

## Suggested Packet Commands

```sh
git add -- \
  'supabase/config.toml' \
  'supabase/functions/pod2-create-jobs/index.ts' \
  'supabase/functions/pod2-explorer-request/index.ts' \
  'supabase/functions/pod2-master-forward/index.ts' \
  'supabase/functions/pod2-order-submit/index.ts' \
  'supabase/functions/pod2-printcom-sync-status/index.ts' \
  'supabase/functions/pod2-submit-to-printcom/index.ts' \
  'supabase/functions/pod2-tenant-approve-charge/index.ts' \
  'supabase/functions/pod2x-printcom-proxy/index.ts' \
  'supabase/functions/_shared/erpShadow.test.ts' \
  'supabase/functions/_shared/erpShadow.ts' \
  'supabase/functions/_shared/pod2PrintcomSafety.ts' \
  'supabase/functions/_shared/pod2PrintcomSafety_test.ts' \
  'supabase/functions/company-hub-invite-member/' \
  'supabase/functions/supplier-bank-url-import/' \
  'supabase/migrations/20260714190000_harden_print_production_submission.sql'
```

```sh
npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions
```
