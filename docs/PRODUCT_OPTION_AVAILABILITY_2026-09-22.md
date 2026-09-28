# Product option availability — local implementation

The shared matrix product selector keeps every enabled, configured attribute value visible. A value unavailable for the current selections is grey and opens a small explanation when clicked or activated with the keyboard. It does not select the value or change the price. This applies to text, picture, compact, colour, checkbox-style, and dropdown presentations (dropdowns have separate help buttons for unavailable values).

Product configuration → Tooltips → **Utilgængelige valg** edits the product default or an individual option's explanation. `{option}` expands to the option's display name. Entries use the existing `banner_config.visual_tooltips` storage and save callback, with anchors `unavailable_option` and `unavailable_option:<sectionId>:<valueId>`. No migration, new access grant, or publishing behavior was introduced.

Activation instructions are derived from actual compatibility/price rows and the relevant preceding selections. Each suggested combination belongs to one real row; the helper chooses combinations requiring the fewest changes and displays up to four. Disabled/unconfigured attributes are excluded. If no supported alternative exists, the tooltip says so. Pricing arithmetic, exact-combination selection, and POD flows are unchanged.

## Verification

- Real local WMD folder: midterfalset keeps 4/6/8/10 pages visible; grey 8 explains Rullefalset or zigzag falset.
- Rullefalset keeps 4 pages visible and grey; its help identifies Folder midterfalset.
- At 21 × 21 cm with Rullefalset, grey 10 pages identifies compatible formats. Opening help preserves the selected 6 pages.
- The signed-in product Tooltips tab lists individual 4/6/8/10-page entries.
- A separate local-only fixture using the actual editor, button, and text resolver verified editing an 8-page explanation, saving to local JSON storage, reloading, and displaying the custom text with automatic alternatives. Enter opens and Escape closes the popover.
- TypeScript check and production build passed. Nine focused availability and existing exact-combination tests passed. Lint comparison found no added diagnostics; the touched legacy files retain 41 pre-existing diagnostics.

Hosted save/reload was not exercised: localhost uses the shared Supabase backend. No hosted product settings, prices, orders, or deployments were changed. Other products and mobile layouts have not received individual browser acceptance testing.

## Local runtime and rollback

Source changes are in the workspace and synchronized to the recovered full application served at port 8113 by `tmp/start-webprinter-connected-recovered.mjs`. This recovery is necessary while some workspace files are cloud-offloaded. Future edits must likewise reach the runtime copy until the regular workspace server can run again.

Rollback consists of reverting only this feature's renderer, preview, and designer changes and removing its new helper, hook, button, editor, and tests. Existing unrelated local work must be preserved. Persisted tooltip entries, if later created by an owner, are additive and can safely remain ignored by the previous renderer.
