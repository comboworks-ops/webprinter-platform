# STORFORMAT below-minimum price correction — 9 September 2026

## Follow-up: authorized Pixart quote mode

The user approved the additional pricing-model implementation. The local
`area_pricing_basis = per_piece_quotes` mode and versioned `source_quote_model`
retain full retail DKK order totals keyed by material, finishing, production
option, **piece area and exact quantity**. Existing products default to
`total_area` and retain their original data and calculation path.

Only piece area is interpolated, and only between captured points for the same
quantity and option combination. Exact samples reproduce exact captured
totals before configured rounding. Missing quantities, combinations, invalid
payloads and areas outside coverage fail closed; the UI clears the selected
price and disables unavailable matrix cells. No per-piece fee or minimum rule
was invented. Estimates between samples are interpolation, not fresh supplier
quotes. Geometry restrictions and source collection still require review.

The source-quote helper and calculation have exact deployment-local mirrors.
Verified checkout re-resolves the stored model and rejects unsupported
selections. The public model includes retail prices only; supplier EUR costs
and extraction provenance remain in the local import review. Item/global
markups and rounding remain supported. Admin save and bank projections retain
the model and genuine point anchors. Catalogue and featured previews use
actual base production IDs; missing quote data is never replaced by a legacy
tier price. The older standalone banner site preview sends quote-mode products
to the canonical product calculator instead of its separate demo formula.

The existing Pixart importer and agent workflow now default flat-surface
imports to this mode, retain every size/count tuple, bind real option IDs,
validate coverage/arithmetic, and show regular-price basis, excluded temporary
promotions, supported counts/areas and a price comparison during dry-run.
Existing products cannot be destructively re-created by this import command.
Rigids and explicitly selected legacy imports retain their existing model.

New source evidence: `output/qa/pixart-quote-mode-2026-09-09/fresh-small/`
contains 20 valid regular-price quotes for Matt/no finish, piece areas
0.15/0.5/0.96/1/2 m² and counts 1–4. The 100 × 96 cm samples match the earlier
120 × 80 cm quotes in this capture; this observation is not a general guarantee
that all shapes with equal area cost the same.

Local browser evidence is in `output/qa/pixart-quote-mode-2026-09-09/ui-*.txt`.
It renders the actual storefront and admin components with a memory-only data
gateway: 184/354/531/708 kr at 120 × 80 cm, disabled count 5, unavailable size
and finish clearing selection, keyboard navigation skipping count 5, and admin
save followed by component remount preserving the quote model and anchors.
No browser errors were observed. These are isolated component checks, not
authenticated hosted persistence or live checkout proof.

Final validation: 72 focused source/import/checkout/preview tests pass; the
production build passed in 11.89 seconds with existing dependency/chunk
warnings. All 40 bound Standard/Fast quote points from the fresh 20-row source
packet reproduce the calculator's rounded totals. An offline PostgreSQL 17
fixture verified legacy defaults, valid/invalid metadata pairs, existing row,
RLS/grant preservation and rollback; its disposable container was removed.
The final real-backend localhost smoke still shows 172/343/489/435 kr for the
unchanged stored matrix at 120 × 80 cm, without browser errors. Evidence:
`tests.log`, `build.log`, `import-to-calculator-parity.json`,
`small-source-quote-importer-dry-run.txt`, and `existing-product-smoke.txt` in
the quote-mode QA directory. Full repository TypeScript remains unclean from
existing diagnostics; targeted engine/helper TypeScript checks pass.

Registered-agent copy boundary: `.agent/skills/pixart/SKILL.md` and the runbook
are updated. `.agents/skills/pixart/SKILL.md` is a separate older, protected
file (the skill catalogue points there). Automatic approval review rejected
synchronizing it as an out-of-scope persistent instruction change. It remains
unchanged pending explicit approval; `registered-pixart-skill-sync.diff` is the
exact proposed sync. Do not bypass the rejection. The importer itself already
defaults to the new mode regardless of that stale copy.

Deployment boundary: the additive migration
`20260909131000_storformat_source_quote_model.sql`, matching frontend/server
code and reviewed replacement prices have **not** been applied to the hosted
system. The current live-data localhost product retains its original stored
tiers and the initial below-minimum correction described below. Follow the
existing matched checkout release packet; do not deploy the dirty payment
function independently. Rollback first restores the reviewed legacy config and
sets both mode/model fields to `total_area`/NULL together, then reverts matching
clients; the columns can remain harmlessly additive.

## Result and authorization

The user approved correcting the diagnosed lookup and preparing replacement Pixart prices for review. The local storefront now shows **172 kr for one / 343 kr for two** at 120 × 80 cm, Matt Monomeric, with no finish. Before the correction it showed 155 / 343 kr.

Only the below-first-tier fallback changed in the shared customer formula and its exact server mirror. A sub-1 m² order no longer receives the last, 20+ m² bulk rate. Existing matched brackets, gaps, upper-range behavior, markups and rounding retain their previous behavior.

## Changed code

- `src/utils/storformatPricing.ts`: select first tier when the requested area is below its minimum, in both fallback branches.
- `supabase/functions/_shared/storefrontStorformatFormula.ts`: identical deployment-local formula.
- `supabase/functions/_shared/storefrontStorformatQuote.test.ts`: observed case, anchor/interpolation variants, markups, boundaries and mirror parity.
- `supabase/functions/_shared/storefrontCheckoutHandlers.test.ts`: reject old 204 kr including delivery and accept corrected 221 kr in the synthetic payment-handler test.
- `scripts/audit-pixart-replacement.mjs` and its test: local quote-candidate validation, with exact coverage, geometry, arithmetic, source metadata, input hash, duplicate/stale series and quantity anomaly checks. It never imports or smooths prices.
- `.gitignore`: two narrow exceptions retain the reusable audit files.

The importer needed its already installed transitive `js-yaml@4.2.0` package exposed through an ignored `node_modules/js-yaml` symlink. No dependency manifest or lockfile changed for this task.

## Verification

- Regression-first: the new quote and payment-handler cases failed before the two-line correction.
- 23 quote/checkout tests pass, including exact frontend/server mirror equality.
- 12 candidate-audit tests pass.
- Independent source review found no remaining actionable issues within those changes.
- Production build passed. The existing bundle-size warning remains.
- Real local browser with current Supabase product data: one item 172 + 49 delivery = 221 kr; two items 343 + 49 = 392 kr. No console errors. Restored the user's 120 × 80 cm / one-item selection.
- No checkout purchase, live pricing write, function deployment, migration, or frontend deployment occurred.

Evidence is under `output/qa/pixart-price-audit-2026-09-09/`: browser-before/after, regression logs, calculator snapshots, fresh source artifacts and the replacement review.

## Fresh supplier evidence and remaining model problem

The original stored matrix remains irregular: 3 pieces still calculate as 489 kr and 4 as 435 kr. This is not fixed by the below-minimum lookup.

The completed review packet contains `fresh-combined-regular-reference.json` (168 rows), `fresh-vs-stored-56-points.csv`, `fresh-regular-reference-all-168.csv`, and `user-size-quantity-reference.csv`. All 36 failed initial tuples were recovered with separately captured valid dimensions, preserving per-row source file/index/hash provenance. The existing normalizer and import dry-run both pass 168/168, but the packet is explicitly **not apply-ready** because the pricing representation still differs. Passing the current importer does not certify the resulting prices.

Fresh extraction used the existing Pixart probe/extract workflow. A 12-row smoke sample passed. The base-material review covers seven materials, eight area points (1, 2, 3, 5, 10, 12, 15, 20 m²) and quantities 1–3. Failed large-dimension attempts were retained, then retried with valid 200/250 cm widths. Actual width/height and source provenance must remain attached to each quote.

Supplier UI inspection found a maximum height of 1497 cm for the tested Grey Back configuration. The old 100 × 1500 cm request therefore cannot supply a valid 15 m² quote. Its unchanged grid must not be reused.

The extractor selects the regular price from the slowest-delivery cell. The current site also displays a temporary 10% promotional price in that cell. Review amounts are therefore **regular supplier prices excluding VAT, before the temporary promotion**, converted with the product's existing 7.6 EUR/DKK × 1.8 markup factor. They are not the current promotional payable amount.

For the actual 120 × 80 cm Matt / no-finish configuration, the captured regular supplier order amounts are €13.42 / €25.87 / €38.80 / €51.74 for 1–4 pieces. Existing conversion/rounding gives **184 / 354 / 531 / 708 kr** as quote-based reference values, not the current app prices.

A replacement of m² rates alone cannot faithfully reproduce these quantities. Current STORFORMAT pricing looks up a rate using total area across all pieces, while the supplier quotes retain piece-size/count and minimum-order effects. Even fresh point anchors produce incorrect multi-piece prices. Do not mark a bulk reimport ready solely because extraction and arithmetic pass.

This diagnosis led to the separately authorized quote mode described above. It uses additive fields rather than changing the existing `pricing_mode` constraint. Dedicated small-size quotes now represent small-order behavior directly, and genuine point anchors survive admin saves. The earlier replacement review remains a record of why the aggregate-area model was insufficient.

## Deployment and rollback

This is a local correction. The payment function already belongs to an undeployed, matched connection-repair packet with additional migrations and runtime changes. Do not deploy the dirty payment function alone or enable real payments as part of this price repair. Follow `docs/SYSTEM_CONNECTION_REPAIRS_2026-09-08.md` for the existing release conditions.

Selective rollback: restore only the two fallback expressions in the frontend formula and regenerate the exact mirror from it, preserving the unrelated shared worktree. Keep the regression evidence and price snapshot. No database rollback is required because no live prices changed.
