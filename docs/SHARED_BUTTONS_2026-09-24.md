# Fælles knapper — 24 September 2026

## Outcome and current boundary

Implemented in the working repository and verified in an isolated local application at
http://127.0.0.1:8136/button-lab.html. This uses the actual production controls and shop
components with synthetic branding and a Supabase stub that rejects all access.

The open editor on port **8113 has not received these changes**. It serves
`/private/tmp/featured-product-review-2026-09-22/app`, and contains an unsaved user draft.
Automatic approval review rejected interacting with that origin because a reload could
lose the draft. Preserve that tab and serving tree until the user has saved the draft
and authorized loading the new implementation. No hosted branding/product save,
publication, upload, payment, schema change or deployment was performed.

## Controls and inheritance

- Separate CTA / bestilling and Valgknapper masters in the existing Site Design
  menu inspector. Changes appear in the connected shop/product preview.
- Independent background/text colours for normal, hover and selected states,
  border colour, corner radius, text size and vertical spacing.
- Ten effects: Vandfyld, Lysstrejf, Gelé, Svæv, Neonglød, Ringbølge, Farveskub,
  Nordlys, Lyskreds and Åndedrag; plus Ingen effekt. Four effects support optional
  subtle idle motion. Effects also respond to keyboard focus. Disabled controls
  do not animate; CSS respects reduced motion.
- Reset uses the selected shop design's default builder for the current role,
  while preserving bank entries and locked exceptions.
- Named button bank: save, apply and remove. It follows the current design's
  existing draft/save/publication lifecycle and undo/redo history. Real action
  labels remain configured in their individual settings.
- Local lock checkboxes in header, banner, catalogue, featured product,
  order-flow and price-matrix settings. Locking takes a style snapshot; locked
  styles can be edited independently. Individual product-option locks and effects
  use the existing per-value appearance editor and its guarded save path.

Existing designs retain their current appearance until a role is changed or reset.
New styles are stored under `themeSettings.sharedButtons` in the existing branding
document. The bank is scoped to that design. Product locks use existing presentation
metadata. No pricing data or option identities are altered.

Master CTA styling reaches header actions, primary hero buttons, catalogue cards
and alternate catalogue presentations, featured products, order buttons and the
shared order/upload/designer action component. Selection styling reaches product
options, quantity/price choices, catalogue filters and relevant delivery/file
choices. The price grid retains compact padding and text to preserve its geometry.
Administrative/destructive actions and navigation icons retain their existing roles.

## Compact inspector follow-up

Following the user's review, the master editor now has three compact groups:
**Farver & form**, **Effekter** and **Knapbank**. Colour editing switches between
Normal, Hover and Valgt; all seven colour settings, sizing, reset, ten effects,
optional idle motion and bank functions remain. The large duplicate preview and
its preview-only text field have been removed. Local locks remain exclusively in
the relevant page/button settings, with no lock controls in the master panel.

The isolated review page now mounts the actual `SiteDesignWorkspace` and
`SiteDesignNavigation`, demonstrating the existing Fælles knapper menu activation,
connected product preview, and contextual local settings. It is still a synthetic
fixture, not a second product screen or an authenticated editor session.

Fresh compact-panel QA covered all 11 effect choices (none plus ten effects),
applying the saved Ocean entry, moving between master and local inspectors,
locking the order button and verifying it remains unchanged after a master-colour
edit, and selected-state editing independently of normal colours. All six widths
from 320 to 1440 px fit without page overflow; desktop and 320 px screenshots were
reviewed. Whole-app typecheck, production build and changed-component lint passed.
No new tests were added for the presentation-only regrouping. Previous 52-test
results cover the unchanged styling, bank and save helpers.

## Verification

- **52/52 tests passed**: new normalization/inheritance/lock/bank tests together with
  existing Site Design control, guarded product styling save, branding adapter and
  print design preset suites.
- Whole-application TypeScript and Vite production build passed in the isolated
  full-source application. Existing large-chunk build warning remains.
- Scoped lint: baseline and updated source both have 199 existing errors and 20
  warnings; zero new diagnostic signatures. The new components/helpers are clean.
- Browser verified master CTA propagation into actual order and hero components,
  independent selected background/text colours, lock preservation after master
  edits, selected-theme reset, bank save/apply/remove/undo, and synthetic local
  draft save/reload preserving styles, bank and locks.
- All ten effects respond to keyboard focus; disabled CTA animation and pseudo
  layers are suppressed. Selected colours remain selected during hover/focus.
- Unavailable product choices retain help and keyboard access without changing
  the selection. Price matrix click and ArrowRight preserve the callback's exact
  quantities and prices (100/200 units, 200/350 kr synthetic fixtures).
- Widths 320, 390, 768, 1024, 1280 and 1440 px have no page overflow. The final price
  matrix check at 320 px retains its own horizontal scrolling and swipe hint.
- All **23 scoped source/test files** match the tested isolated copy. Every
  previously existing file on 8113 still matches its before snapshot; the new
  files remain absent there. Temporary browser viewport override was reset.

These checks do not establish authenticated hosted save/readback, customer
publication or physical-device acceptance. Reduced-motion behaviour is implemented
and source-reviewed; OS-level reduced-motion emulation was not exercised here.

## Evidence and continuation

`output/shared-buttons-2026-09-24/` contains task-specific before snapshots,
`implementation.diff`, SHA-256 `source-manifest.json`, test/build/typecheck logs,
lint baseline/comparison, and the isolated button-lab source/configuration.

After the user has preserved the 8113 draft and authorizes loading the changes:

1. Compare current serving-file hashes with the recorded before hashes; reconcile
   concurrent changes rather than replacing an entire tree.
2. Copy only the 23 source/test paths from the manifest into the serving copy.
3. Open Fælles knapper in the actual Site Design editor and verify the connected
   preview, selected-design reset and local inspectors without saving test values
   to the shared backend.
4. Keep hosted save/publication as a separate, explicitly authorized real workflow.

Rollback is local source reversal using the task diff/before snapshots, accounting
for any subsequent edits. There is no migration to reverse. Existing persisted
branding and product records were not mutated during this work.

Effects are original scoped CSS; no animation dependency or copied component was
introduced. Visual references consulted: [Magic UI shimmer button](https://magicui.design/docs/components/shimmer-button)
and [Aceternity hover border gradient](https://ui.aceternity.com/components/hover-border-gradient).
