# Complete local brochure checkout QA — 23 October 2026

Outcome: the complete local journey succeeded, including returning to edit one design and reviewing a fresh checkout. One initial local approval-save failure recovered on retry; its cause remains unconfirmed. This is local functional evidence, not production or printer acceptance.

## Verified journey

1. Opened the existing local brochure checkout in Chrome Yebbo on `127.0.0.1:8933`; retained both existing synthetic eight-page brochures and their 60/40 allocation.
2. Reviewed a complete synthetic contact/delivery address in Denmark. Standard delivery passed local review at 1,241.25 DKK including VAT. Express passed at 1,428.75 DKK including VAT.
3. Returned through the design workspace and existing brochure designer. Added the visible test text `LOCAL CHECKOUT EDIT` to København page 2 and saved.
4. København advanced from version 1 to version 2 and required fresh approval. Aarhus remained version 1 approved. Quantities stayed 60 and 40; the matrix product price stayed 944 DKK.
5. The previous checkout blocked while the edited design was unapproved. It also blocked after the new revision was approved: its stale version could not be reviewed as current.
6. Opened a fresh checkout containing København v2 approved and Aarhus v1 approved. Express preference and quantities survived. Contact/address fields cleared on navigation as designed (memory-only); re-entered the synthetic address.
7. Downloaded both approved PDFs using the UI, then completed the fresh local checkout review. The final UI confirms address, express, design versions, quantity and 1,428.75 DKK including VAT, with no order/payment created.

Synthetic address: Lokal prøvekunde, `test@nord-atelier.example`; Lokal prøvemodtager, Nord Atelier · lokal prøve, Prøvevej 12, 2. sal, tv., 8000 Aarhus C, DK. No address-book write or address/carrier lookup was performed.

## Price checks

| Selection | Product excl. VAT | Delivery excl. VAT | Net | VAT (25%) | Gross |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standard | 944.00 | 49.00 | 993.00 | 248.25 | 1,241.25 |
| Express | 944.00 | 199.00 | 1,143.00 | 285.75 | 1,428.75 |

The original product matrix selection and existing delivery/tax calculations were used. No application/pricing source changes remain from this QA. Twelve relevant source files, including the product panel, designer, workspace, local checkout and tax/delivery sources, have identical before/after SHA-256 hashes.

## PDF verification

- Both final PDFs contain eight pages, with `SIDE 1 AF 8` through `SIDE 8 AF 8` in order and 154 × 216 mm MediaBoxes (148 × 210 mm trim plus 3 mm bleed on each edge).
- Aarhus is byte-for-byte identical before and after editing København: SHA-256 `50953268c89a6332e675b85aeff924feedaa8801a89dbab0218a5ee07a857a69`.
- København changed from SHA-256 `0a9e3771200b02b5f2d0cd345cc184e4ba372265ac9ea559f52ea65cc9f5c759` to `f4b8b10e261aa49e12ff316e6455fa48864c5e3fa6788656309e261792dee8a4`.
- Poppler rendering at 96 dpi and pixel comparison show only page 2 changed (pixel box 30,388–554,423). Its other seven rendered pages are pixel-identical. Visual inspection confirms the new text on page 2. The text is not exposed by pypdf text extraction, so the visible edit was verified from rendering.
- The existing missing-output-intent warning remains visible for imported PDFs. These checks do not certify production color or printer readiness.

## Unresolved reliability observation

The first attempt to approve København v2 failed with “Kunne ikke gemme lokalt. Behold fanen åben; kontrollér browserens lagerplads.” The design remained unapproved and checkout stayed blocked. Both saved designs remained present and disk space was ample; the generic message does not establish a storage-full cause.

A temporary IndexedDB request-error diagnostic was added, then approval was retried successfully without clearing data. The diagnostic emitted no underlying failure, so the initial cause was not reproduced or established. The temporary source diagnostic was removed; original application source hashes match. Retain the failure evidence and investigate if it recurs. Do not describe this as a fixed bug or a flawless run.

## Evidence and boundaries

Evidence: `output/brochure-complete-checkout-2026-10-23/`, including `final-checkout.png`, `final-checkout.txt`, `pdf-verification.json`, source hash receipts, before/after PDFs/renders, failed approval snapshot and stale-checkout snapshots.

Final local checkout bundle: `89ead4f4-1ce0-4201-9c06-0c94c40978f9`. Workspace: `18a5f7e315f4b3ab78b696605c597ed7cbbc32fd0fa623ce8e46bc64b3a3a60e`. Keep the same Chrome profile and origin for browser-local records.

Payment, order submission, hosted upload, address-book writes, delivery booking, supplier submission and deployment remain disabled/unperformed. Existing product/pricing reads may use the configured service; this is not a claim of fully offline operation. No repeated spread variants or unrelated workflows were tested. Current-turn acceptance is browser/PDF QA; earlier automated implementation checks were not rerun because application source remains unchanged.
