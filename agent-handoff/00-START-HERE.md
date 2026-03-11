# WebPrinter Agent Handoff Pack

This folder is the curated handoff pack for another agent or technical reviewer.

Use this pack instead of handing over the raw repository first.

## Purpose

Give a new agent enough context to understand:

- what WebPrinter is
- where the critical logic lives
- what must not be broken
- which systems are stable vs evolving
- how to work safely in the repo

## Read Order

1. `00-START-HERE.md`
2. `01-SYSTEM-OVERVIEW.md`
3. `02-CRITICAL_FLOWS.md`
4. `03-DOMAIN_CONTRACTS.md`
5. `04-API_ROLLOUT_PLAN.md`
6. `05-REPO-MAP.md`
7. `06-DATABASE-SUMMARY.md`
8. `07-KNOWN-RISKS.md`
9. `08-HOW-TO-WORK-SAFELY.md`
10. `repo-index.json`

## What This System Is

WebPrinter is a multi-tenant web-to-print platform with several tightly related domains:

- storefront
- admin/product management
- pricing
- site designer / branding
- designer module
- tenant/domain management
- sites/facade storefronts
- POD v1 and POD v2
- supplier import tooling

## Current Architectural Position

- pricing and product flows are central and must be treated carefully
- Site Designer V2 exists and is partially recovered
- `Sites` now supports product-to-site mapping and live site activation
- POD v1 must remain intact
- POD v2 must stay isolated and additive

## Most Important Guardrails

- do not change pricing logic without explicit approval
- do not break POD v1 behavior
- do not mix POD v1 and POD v2 data models
- do not assume visual editor controls are fully wired unless verified
- prefer additive changes over replacements

## Portable Use

This folder is the maintained source handoff pack.

The disposable zip export can be generated from this folder and moved out of the repo.
