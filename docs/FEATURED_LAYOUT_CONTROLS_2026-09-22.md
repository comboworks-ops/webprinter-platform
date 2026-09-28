# Featured banner placement controls

The featured product inspector now groups alignment, whole-banner width, edge inset, vertical offset, bottom spacing, corner rounding and responsive composition in **Placering og størrelse**. The existing box click target opens this group. Repeated selection also reopens a manually collapsed details section. Product text/image/CTA targets retain their separate destinations.

Optional per-slide `layout` overrides travel through the existing branding draft. Explicit zero vertical offset suppresses legacy overlap; positive offset creates normal-flow space above the banner, including its side panel. The shortcut sets 24 px. Unmodified designs retain their previous placement and overlap; resetting the overrides restores those original settings. Edge spacing is capped responsively. Width scales the existing composition; it does not change prices or product selections.

Verification:
- 10 focused layout/banner tests pass; TypeScript passes with zero diagnostics.
- Production Vite build passes in the existing recovered application copy with the seven changed source files hash-matched to the workspace. Existing large-bundle warning remains.
- Inspector and new helper/tests have no lint findings. Configurator retains its prior nine explicit-any errors and one hook dependency warning; these are not new.
- Real editor and renderer exercised using the isolated synthetic client at `http://127.0.0.1:8134/__site-design-qa`: box click opens the correct group, repeat click reopens collapsed controls, width/right alignment/inset update together, positive offset produces measured 24 px space, and local draft save/reload retains 95% width and 24 px offset.
- Desktop 1280, tablet 768 and mobile 390 previews checked; document width does not overflow at tablet/mobile. No browser console errors observed. Desktop restored. Other viewport widths and physical devices were not tested in this pass.
- Existing localhost 8113 responds with the updated inspector source. Its authenticated editor session was not reloaded, saved or published.

No hosted branding writes, publication, database changes, pricing changes or deployment. Save/reload evidence is synthetic local storage only. The preview uses existing copied application dependencies/assets because some workspace files remain cloud-offloaded.

Evidence and selective rollback: `output/featured-layout-2026-09-22/changes.patch`, source hashes, build/type/lint/test logs. Reverse only this patch's matching hunks; preserve the extensive pre-existing changes. No data rollback is required.
