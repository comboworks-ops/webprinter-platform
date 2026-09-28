# Machine setup — 8 September 2026

Implemented locally for `/admin/machine-pricing`. Existing dirty work is preserved. No deployment, hosted save, database/schema change, product price write or POD change was performed.

## Result

- Machine, ink, material, margin and pricing-profile dialogs plus cost testing and job pooling use small corners, neutral panels and blue actions. Portal dialogs carry the same scoped styling. Mobile headers omit duplicated statistic cards; form grids and headings remain inside the dialog.
- `NumberInput` separates editable text from the numeric calculation value. A default zero can be deleted with one Backspace; an empty field stays empty during editing and returns to its numeric fallback on blur. Decimal typing, external resets and minimum-one quantities are covered. Adoption is scoped to machine-pricing sections; the global `Input` component is unchanged.
- The new machine form estimates cost from unsaved machine inputs. A6/A5/A4/DL/card buttons show fit counts. Quantity, bleed and spacing update immediately. Missing dimensions, impossible fit, absent speed/rate, fractional quantity and negative values do not show a valid price.
- The draft estimate consumes `machineCost` from the existing `simulateMachineCost` implementation. It includes setup, production time and waste. It is explicitly the machine share, excluding material, ink/clicks, other finishing, VAT and margin.
- Optional cutting time multiplied by its own hourly rate is added separately to this **preview only**. Quantity/format/bleed/gap/cutting test settings are not stored in the machine record. Test controls cannot trigger machine submission or invalidate the saved form. Persisted cutting configuration and customer selling-price integration were not implemented.
- Sheet previews use true physical proportions and square paper/trim corners. The new machine preview and cost workbench pass the existing simulator's selected rotation/grid. Other `ImpositionPreview` callers retain their previous unrotated count selection. Roll previews are explicitly labeled excerpts, separate from whole-job consumed length.

## Verification

- 10 Node tests pass: five new draft-cost cases plus five existing job-pool regressions. Source: `src/lib/pricing/machineDraftEstimate.test.ts`, `src/lib/pricing/jobPoolOptimizer.test.ts`.
- Six isolated Chromium input tests pass in `src/components/ui/number-input.browser.test.mjs`: deleting zero/replacing it, decimal input, an unrelated rerender while blank, blur fallback, external reset, and a minimum-one quantity. Initial execution was blocked by macOS sandbox browser-launch restrictions; the isolated local test passed when run with the approved browser launch permissions.
- Actual local React components were exercised through the in-app browser at `http://127.0.0.1:8148/`, using synthetic machine/material/ink records and a fake backend which rejects every mutation. The fixture imports the real admin workspace/surface and new machine styles. Its CSP blocks external connections/forms. This is browser UI evidence, not authenticated persistence or hosted RLS evidence.
- New machine: blank dimensions show no estimate; default width zero deletes with one Backspace; entering name, 450 × 320 mm, 1,200 sheets/hour and 450 kr/hour displays 18.75 kr for 100 single-sided A4s before save (no setup or waste entered in this case).
- Existing example machine: 450 × 320 mm, 5 mm margins, 3 mm bleed, 2 mm gap, 8-minute setup, 10 setup sheets plus 2% waste, 1,200 sheets/hour, 450 kr/hour. At 100 copies, A4 shows 2-up, 61 sheets, 82.88 kr; A5 shows 4-up rotated 90°, 36 sheets, 73.50 kr. Adding 15 minutes cutting at 300 kr/hour adds 75 kr.
- Clearing test quantity removes the price but leaves the enclosing machine form valid. Enter in a test input keeps the dialog open. A 100 × 100 mm sheet shows zero A4 fit and no cost.
- Machine dialog checked at 1440, 1280, 1024, 768, 390 and 320 CSS pixels. Paper width/height ratio measured approximately 1.40625 for 450/320; computed paper radius is 0. No offscreen input or dialog overflow in the checked machine states.
- Ink/material/margin/profile dialogs checked at 1440, 390 and 320. A real 320-pixel margin-dialog clipping issue was found and corrected; final inputs and sections remain inside the dialog. Cost-test and job-pool sections checked at 1440, 390 and 320 with full admin surface CSS; no document horizontal overflow. Desktop and phone screenshots were inspected inline.
- Final Vite build passes in 23.48 seconds. Existing LCMS/import and large-bundle warnings remain. Full application TypeScript still fails (419 diagnostics at this run); changed-area diagnostics are existing schema-result accesses in MachinePricingManager and MarginProfileForm. New estimate/input/preview files have no TypeScript diagnostics.
- New estimate/input/preview files and both workbenches have no ESLint errors. ImpositionPreview retains its existing Fast Refresh constant-export warning. MachineForm's five existing `any` lint errors match its pre-edit snapshot. Existing typing/lint debt in other forms remains. `git diff --check` passes.

Machine-local fixture, source snapshot and logs: `tmp/machine-setup-20260908/`. Final build output: `/private/tmp/webprinter-machine-setup-build-20260908`.

## Rollback

Revert only this task's component/style/helper hunks and new files; preserve prior dirty versions of the shared manager and workbenches. No schema, hosted data or pricing-engine rollback is required.
