# Commercial Supabase Report

Generated: 2026-07-10T01:18:29.685Z
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [behind 1]
Status: REVIEW REQUIRED

This is a local, read-only Supabase review artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Supabase entries: 7
Deployable packet entries: 4
Hold/local artifact entries: 3
Risk groups: 5

## Required Checks

| Status | Check | Evidence |
| --- | --- | --- |
| PASS | Supabase Data API grants | Supabase Data API grant check passed for 1 migration file(s). |
| PASS | Supabase function exposure | Supabase function exposure check passed for 53 functions. |

## Supabase Risk Groups

| Group | Files | Review focus |
| --- | ---: | --- |
| config duplicate/local | 1 | Confirm duplicate or space-suffixed config files are local artifacts and not deployable config. |
| edge functions | 3 | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| function deployment config | 1 | Verify function JWT/public-read settings before deploying Edge Functions. |
| local Supabase temp | 1 | Usually local tooling state; avoid staging unless there is a deliberate reason. |
| migration/grants | 1 | Verify explicit Data API GRANT/REVOKE decisions, RLS scope and rollback notes before deployment. |

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
| DEPLOY-REVIEW | M | `supabase/functions/pricing-read/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | M | `supabase/functions/product-detail-read/index.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |
| DEPLOY-REVIEW | A | `supabase/migrations/20260509120000_index_generic_product_prices_lookup.sql` | migration/grants | Verify explicit Data API GRANT/REVOKE decisions, RLS scope and rollback notes before deployment. |
| HOLD | ?? | `supabase/config 2.toml` | config duplicate/local | Confirm duplicate or space-suffixed config files are local artifacts and not deployable config. |
| HOLD | ?? | `supabase/functions/test-env/index 2.ts` | edge functions | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |

## Held Outside Deployable Packet

| Status | Path | Hold reason |
| --- | --- | --- |
| HOLD | `supabase/.temp/cli-latest` | Usually local tooling state; avoid staging unless there is a deliberate reason. |
| HOLD | `supabase/config 2.toml` | Confirm duplicate or space-suffixed config files are local artifacts and not deployable config. |
| HOLD | `supabase/functions/test-env/index 2.ts` | Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent. |

## Deploy Owner Plan

- Deploy only after the release owner has freshened the branch and rerun `npm run check:commercial-release`.
- Apply the index migration before deploying the public read functions when this packet is released.
- Migration: `supabase db push` or the project-approved migration deploy path for `20260509120000_index_generic_product_prices_lookup.sql`.
- Config: `pricing-read` and `product-detail-read` are intentionally public read functions (`verify_jwt = false`) and must stay tenant-scoped in code.
- Functions: deploy `pricing-read`, `product-detail-read` with the project-approved Supabase function deploy command.

## Rollback Notes

- Index rollback SQL: `DROP INDEX IF EXISTS public.idx_generic_product_prices_product_quantity_id;`
- Function exposure rollback: restore `verify_jwt = true` for `pricing-read` and `product-detail-read`, then redeploy function config.
- Function rollback: redeploy the previous known-good versions of `pricing-read`, `product-detail-read`.

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
  'supabase/functions/pricing-read/index.ts' \
  'supabase/functions/product-detail-read/index.ts' \
  'supabase/migrations/20260509120000_index_generic_product_prices_lookup.sql'
```

```sh
npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions
```
