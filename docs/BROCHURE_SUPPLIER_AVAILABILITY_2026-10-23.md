# Four brochure rows: supplier price tables unavailable

Local investigation on 23 October 2026. **The requested prices could not be restored:** the supplier currently returns no price table for these exact eight-page combinations. The local matrix now explains their availability instead of presenting a generic transport error. No substitute prices or paper mappings were introduced.

## Reproduction and cause

At article `2009`, eight pages, 148 × 210 mm, the following native paper IDs all return HTTP 400 from `get-sorten-auflage`, with code 400 and description `There is not data found from Price table`:

| Native ID | Content / cover |
| --- | --- |
| 282596 | 90g glossy / 250g glossy |
| 282600 | 90g matte / 250g matte |
| 282602 | 115g glossy / 250g glossy |
| 282606 | 115g matte / 250g matte |

The article HTML still lists these options. The working control `282599` (90g matte / 90g matte) succeeds through the same protocol, size and quantity, returning 100 copies at 78.63 EUR net → existing conversion → **944 DKK net**. Changing only the initial failed lookup's quantity from 1 to 100 did not repair it; this hypothesis was rejected and no request-parameter change was retained.

The supplier's own configurator was tested with 90g matte / 250g matte at 14.8 × 21 cm. Its quantity selector disappeared, total became 0.00 EUR and it explicitly displayed `Artikel ist leider momentan nicht verfügbar`. That zero is an unavailable-state display, not a usable price. Its browser also logged an undefined `.find` error. There is no evidence that the local matrix or price conversion caused the missing tables. This does not prove physical stock status or unavailability at every page count/size.

## Local change

The shared native protocol recognizes only the exact HTTP 400 / `get-sorten-auflage` / code 400 / known description response and produces the static Danish message **“Papirkombinationen er midlertidigt utilgængelig.”** Other HTTP failures and malformed responses retain the existing generic error. Raw supplier diagnostics are not sent to customers.

The brochure matrix shows that controlled error message in its row label. Cells remain disabled and a manual retry remains available if the supplier restores the table. No negative-result cache, automatic retries, alternative supplier, catalogue write or pricing fallback was added.

Pricing formulas, bounds/identity validation, sparse quantity handling and the successful quote path are byte-identical to the before-copy. Ten other protected pricing, API, designer, approval, tax and checkout hashes match. Only local source changed; no Supabase deployment, data write, payment, order submission or production deployment occurred.

## Verification and evidence

- Regression test failed before the error classification and passed afterward. Other/malformed supplier responses remain generic; no price or subsequent supplier call is fabricated.
- Twenty focused tests pass, including dense existing FX/markup parity, exact checkout quote handling, source identity/currency/price mismatches, sparse tiers and client queue behavior.
- TypeScript and scoped lint pass. The production build passes into the separate evidence directory; existing bundle-size/Browserslist warnings remain. The build took longer than the previous run but completed successfully; existing `dist` and the running loopback listener were preserved.
- Local browser confirms all four revised messages, disabled cells, normal 100-copy selection at 944 DKK net / 993 DKK with standard delivery, unchanged disabled order submission and no console errors.
- Evidence: `output/brochure-quote-repair-2026-10-23/`, including minimal read-only traces, all four source results, supplier DOM/screenshot, local matrix DOM/screenshot, pricing-protection comparison and validation logs.

The remaining gate is supplier restoration of valid exact price tables (or a separately approved, source-verified alternative product mapping). Do not fill these cells from another paper or treat this task as a completed price restoration.

Rollback: restore only the native protocol's added error-classification branch from its before-copy and the matrix's one-line message presentation if needed. Keep all price/identity guards, originals, browser storage and unrelated dirty worktree changes. There is no schema or hosted rollback.
