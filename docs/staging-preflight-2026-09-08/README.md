# Staging preflight — 8 September 2026

Status: **HOLD — staging target not yet created; hosted acceptance not run.**

Setup follow-up: **Vercel CLI access is confirmed**, despite the connector's
403 response. Provisioning is waiting on the required billing-organisation
choice and subsequent Supabase cost confirmation. See [setup status](setup-status.md).

The [live inventory and remaining runbook](../connection-repairs-hosted-acceptance-2026-09-08.md)
record the exact blockers and deployment order. The connected backend is the
existing business project, not a confirmed staging target. Vercel project
inspection through the connector remains blocked by a 403 response; the
existing command-line login can inspect the exact project successfully.

- [Backend manifest](backend-manifest.json) records SHA-256 checksums for six
  ordered migrations, five Edge entrypoints, their local runtime imports,
  function configuration, and the five focused test suites run in this turn.
  It records current working files, not just the Git HEAD. It excludes the ERP
  migration. A complete frontend/dependency release still needs to be frozen
  and tested; this is not a deployable full application packet.
- [Hosted results sheet](hosted-results.csv) has one row per scenario and
  account/shop combination, including the four purchases and guest checkout.
  Every result starts as `NOT_RUN`. Fill actual actor/shop identifiers and
  evidence only during the designated staging run. Record the expected denial
  and byte/persistence checks as well as successful flows. Split compound rows
  into individual subchecks before execution; a row passes only when every
  requirement in its runbook scenario has been demonstrated.
- [Frontend candidate](frontend-candidate.json) records 1,077 frozen current
  source/config/asset files and a passing local Vite build with 260 output
  files. The build uses inert `.invalid` backend configuration and must be
  rebuilt with actual staging public settings. No environment files or
  deployment linkage were copied. Fresh dependency installation, Vercel API
  runtime and the existing TypeScript backlog remain unverified.

Local verification: 51 focused source/protocol tests passed; grants passed
for seven pending files and function exposure checks passed for 59 functions.
These results do not prove deployed authentication, payments, file storage or
inbox delivery. Missing-price products remain excluded, and the TypeScript
backlog remains open.

The manifest deliberately records `staging_target: null`. Set no production
identity as a fallback. `supabase/config.toml` is checksummed for review, but
its existing project link is not a staging configuration; prepare explicit
staging-scoped configuration in the isolated release workspace. Keep new
checkout and email dispatch disabled until the runbook's enabling steps.

Recalculate hashes after any source edit. Keep credentials, client secrets,
JWTs, card details and email bodies out of the results sheet. Required hosted
evidence connects shop/account, attempt, Stripe test intent/event, order,
immutable file path/hash, and notification/provider receipt; provider
acceptance alone does not prove inbox delivery.
