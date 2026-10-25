# Checkout and selection fixes — fresh live verification

21 October 2026, 13:20 CEST

**Both requested issues are already fixed and deployed.** On starting this follow-up, inspection found an existing implementation and release record for the exact two issues. Fresh REA browser checks confirm the current public behavior. No additional application edits or deployment were necessary in this follow-up.

## Root causes and existing repairs

The [original implementation record](CHECKOUT_SELECTION_FIXES_2026-10-21.md) identifies a deployed frontend tax-policy mismatch: the older PVCbanner frontend omitted its already-approved shop entry, while the working source and payment handler included it. The scoped frontend release supplied the correct entry without changing VAT arithmetic, catalogue pricing or payment safeguards.

The Salgsmapper homepage link previously carried no configuration. Its existing repair carries variant IDs, material ID and quantity, validates them against the destination product, and initializes the existing matrix. It carries no price; the destination matrix remains authoritative. See the [release record](CHECKOUT_SELECTION_RELEASE_2026-10-21.md) for deployment scope and pricing-source preservation receipts.

## Fresh observed results

| Scenario | Result |
| --- | --- |
| PVCbanner product entry | 100 × 100 cm, eyelets, 1 piece; matrix remains visible; product 399 kr + delivery 49 kr excluding VAT. |
| PVCbanner → checkout | Total 560.00 kr including 112.00 kr VAT. The previous tax/payment-total warning is absent. |
| Salgsmapper homepage entry | 200-piece offer 739 kr; link contains actual selection identifiers and quantity. |
| Homepage 200-piece offer → product | A6, 1 mm spine, front print, 350 g matt silk, 200 pieces; selected matrix cell 739 kr retained. |
| Homepage 500-piece offer → product | Same format/material, 500 pieces; selected matrix cell 1,346 kr retained and visible. |
| 500-piece handoff → manually select 250 in matrix → checkout | 250 pieces, product 861 kr, delivery 49 kr, VAT 227.50 kr, total 1,137.50 kr. Manual changes override the initial homepage selection correctly. |

All six isolated browser scenarios completed without captured JavaScript page errors. The captured screenshots for checkout, retained product selection and manual change were visually inspected. The Salgsmapper description also now avoids the old fixed A4/100-piece wording; its separate [copy release](CATALOGUE_COPY_RELEASE_2026-10-21.md) records that change.

Ten focused existing tests passed: checkout tax regression and rejection cases, matrix handoff/invalid-choice validation, initial matrix row mapping, advertised-offer price guards and wide-format navigation preservation. No build was rerun because this follow-up changed only assessment documents and saved verification evidence.

The payment buttons remain disabled with empty customer information and no approved artwork. This is not the prior tax warning. No customer details were entered, files uploaded, payments initiated, orders created, emails sent or supplier actions taken. This confirms public navigation, selection and displayed totals; it does not certify payment completion or physical production.

## Evidence and assessment update

Fresh PNG, accessibility text and REA JSON for six scenarios, plus machine-checked assertions, are in `output/checkout-selection-recheck-2026-10-21/`. Before-copies of the assessment files are retained in its `before/` directory.

The [original assessment](WEBPRINTER_SYSTEM_ASSESSMENT_2026-10-21.md) and its HTML review now carry a prominent resolution notice. Original findings/screenshots remain intact as historical evidence. No price matrix, pricing calculation, product data, tax rate or application behavior was changed by this verification follow-up.
