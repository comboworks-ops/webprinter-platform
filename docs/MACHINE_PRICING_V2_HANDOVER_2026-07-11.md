# Machine Pricing v2 handover

Date: 2026-07-11

## Commercial objective

Give a print shop a simple way to turn its own machines, materials, consumables,
capacity and margin requirements into transparent product prices.

The system must show how a price was calculated. Manufacturer claims must never
be confused with the print shop's real operating cost or measured output.

## Implemented first slice

- A read-only `Kostpris-test` workspace in Machine Pricing.
- Corrected sheet imposition with rotation, bleed and gap.
- Roll-media calculation using columns and consumed linear length.
- Setup waste, run waste, setup time, runtime and machine hourly cost.
- Ink cost from printed area, coverage and tolerance.
- Digital click cost per printed sheet side.
- Offset plate cost and an additional fixed job cost.
- Target-margin calculation with visible cost, profit and unit price.
- Warnings when material, ink, click price, machine rate or speed is missing.
- Twenty reviewed manufacturer candidates across wide format, digital sheet and
  offset. Manufacturer sources are linked from every profile.
- Manufacturer profiles only open a machine draft. They never write a price.
- PDF brochure reader that extracts candidate specifications into a reviewable
  machine draft. It does not save automatically.

## Deliberate safeguards

- The existing `calculate-machine-price` edge function is unchanged.
- Existing product prices and pricing profiles are unchanged.
- No database migration was added in this slice.
- Factory-rated speed is displayed as reference data but is not copied into the
  operational speed field. The operator must enter a measured production speed.
- Machine hourly cost remains a print-shop value. It must include the owner's
  chosen combination of labour, finance/depreciation, service, power and
  overhead.

## Cost model boundaries

### Wide-format inkjet

Use roll width, measured m2/hour for the sold quality mode, setup/run waste,
material per m2, measured ink ml/m2, coverage and machine hourly cost.

### Digital sheet press

Use raw sheet size, measured sheets/hour for the actual stock mix, sheet cost,
click charge per printed side, setup/run waste and machine hourly cost.

### Sheet-fed offset

Use raw sheet size, measured sheets/hour, setup/run waste, plate count and price,
ink estimate, fixed makeready/wash cost and machine hourly cost. Offset requires
a dedicated persisted v2 model before storefront publication.

## Required production phases

1. Add versioned machine-v2 fields for process type, speed modes, click charge,
   plates, power, labour, maintenance and calibration metadata.
2. Add a calibration workflow using three completed jobs per machine. Compare
   estimated and actual material, time, consumables and waste.
3. Create `calculate-machine-price-v2` with typed input validation and tests.
4. Add an explicit per-product v1/v2 pricing-engine selector. Default to v1.
5. Add approval states: draft, calibrated, approved and retired.
6. Add audit history for every change that can affect a customer-facing price.
7. Pilot one product from each process before wider publication.

## Acceptance gate for live product pricing

A machine may drive a storefront price only when it has:

- a non-zero machine hourly cost;
- a measured production speed for the selected quality/material mode;
- a priced material;
- a valid ink, click or offset consumable model;
- a tested margin profile;
- calibration evidence from completed jobs;
- an approved v2 pricing profile and product assignment.

Until those conditions are met, the cost test is advisory only.

## Local end-to-end pilot result

Tested on 2026-07-11 with a temporary published product and a `v2_pilot`
product flag. The temporary product and pricing configuration were deleted after
the test.

- Default A4 foil, 20 units: 48 DKK excluding VAT.
- Changing dimensions to 420 x 300 mm: 93 DKK for 20 units.
- Selecting 50 units at 420 x 300 mm: 147 DKK.
- Checkout retained 50 units and 147 DKK product price.
- Standard delivery added 129 DKK, producing a 276 DKK checkout total.
- Temporarily changing the Roland machine rate from 0 to 300 DKK/hour changed
  the default A4/20 storefront price from 48 DKK to 135 DKK.
- Restoring the rate to 0 DKK/hour returned the storefront price to 48 DKK.
- Browser console check returned no warnings or errors during the final pass.

Cleanup verification:

- Temporary pilot product rows remaining: 0.
- Roland machine rate after test: 0 DKK/hour.
- No order or payment was submitted.
