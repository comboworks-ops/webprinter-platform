# Grafisk vejledning — combined visual guide
Date: 2026-09-20

final result: passed

## Scope and visual target

Implemented the user's selected combination: displayed proposal 2's topic menu and next-step control, with proposal 1's visual explanations. The five lessons are cutting/bleed, safe text placement, image quality, colour, and PDF export. The actual route is http://127.0.0.1:8111/grafisk-vejledning.

Source visual truth: output/design-exploration/grafisk-vejledning-2026-09-20/selected-combined.png (1402 × 1122 pixels). The user explicitly requested implementation of the blend; the revised combined mock was shown before coding. The selection manifest binds the original displayed proposals to stable names.

Implementation evidence: output/design-exploration/grafisk-vejledning-2026-09-20/implementation/desktop-final.png, 1402 × 1122 pixels, CSS viewport 1402 × 1122, 1:1 density. The source and browser capture were opened together in the same comparison input, without rescaling. Focused safety, image quality, colour and PDF lesson captures inspect the diagrams and explanatory labels at readable size. Mobile and tablet captures supplement the desktop comparison.

The existing tenant header, account controls, fonts, colours and footer remain authoritative. Their lighter blue and signed-in state intentionally differ from the anonymous mock. The lesson illustrations are purpose-made educational assets, not engineering drawings or colour proofs.

## Findings and fixes

1. [Resolved P2] The first desktop illustration occupied too much height, pushing the next button below the reference viewport. Constrained the illustration's desktop height and aligned the menu/lesson columns. Before: implementation/desktop-first.png. After: implementation/desktop-final.png.
2. [Resolved P2] The shared link-colour rule hid the final product CTA's text against its background. Scoped the primary action's foreground explicitly; browser computed style confirms white text and a blue background. After: implementation/pdf-final.png.
3. [Resolved P2] The original single-word safety label split its last letter onto a new line at 390px. Changed the visible label to “Sikker afstand”, which wraps naturally at 320px.
4. No actionable P0/P1/P2 findings remain in the changed guidance content.

## Required fidelity surfaces

- Typography: the existing Inter / tenant font cascade is preserved. Fluid page and lesson titles, 16px base copy, restrained 14px supporting copy; no clipping in tested widths.
- Spacing and layout: white open page, 268px desktop topic column, thin divider, two-image instructional composition, bottom-right next action. Tablet uses a narrower topic column; mobile uses a two-column topic menu above the lesson.
- Colours and tokens: tenant primary/print colours and shared rhythm tokens. Correct/incorrect states include icons and words, not colour alone. Existing tenant header styling is unchanged.
- Image quality: five native raster assets generated with the built-in tool, inspected independently and in-browser. Bleed is outside trim; safe text is inside trim. Exact margins remain product-specific. The current designer defaults to 3mm, so the guide illustrates 3mm rather than introducing a conflicting 2mm requirement.
- Copy: Danish, short active instructions. CMYK/300dpi advice is scoped to ordinary paper printing; textile and large-format exceptions remain visible. PDF/X-4 is a recommendation, not a certification claim.
- Accessibility: named native buttons, current-step semantics, keyboard-operable topic selection, focus moved to the lesson heading, announced progress, image alt text, and a modal enlargement with Escape/focus return. The enlarged image can scroll horizontally on narrow phones. Not a complete WCAG audit.

## Verified interactions

- Next advances through all five lessons, updating title, illustration, selected topic and progress.
- Direct topic selection, previous step, browser Back and refresh retain the correct lesson.
- Keyboard Enter selects the PDF lesson.
- Image enlargement opens; Escape closes it and returns focus to the trigger.
- Template action opens a genuine explanation and catalogue link; the catalogue was rendered in-browser.
- The existing downloadable-template component is disabled in this repository. No new download is promised; customers are directed to the product and its available template.
- Original detailed guidance and its anchors remain available in the expandable section. PDF program instructions and wide-format sections were opened.
- All five active lesson images loaded successfully.
- Document width equals viewport at 1440, 1280, 1024, 768, 761, 760, 390 and 320px. No guidance controls extend outside the page.
- No error-level browser console messages during the verification run.

Evidence data: implementation/browser-checks.json. Initial rapid resize captures had incorrect bitmap widths from the browser's pending resize; the final tablet/mobile captures were recaptured after verifying the settled viewport. Those transient captures are not layout-overflow findings.

## Build and source checks

- Scoped ESLint passed for the three new/changed TypeScript components/data files.
- git diff --check passed for the changed tracked guidance component.
- Final Vite production build passed in 30.48s; existing large-bundle warning remains. Build is in output/grafisk-vejledning-build-2026-09-20.
- App-wide TypeScript check reports 403 diagnostics elsewhere, consistent with the documented repository baseline; none name the changed/new guide files. This is not a globally type-clean checkout.
- React review: static lesson definitions outside rendering, URL-derived active state, no new backend queries, semantic controls, no added dependencies.

## Implementation and rollback

Files: src/components/content/GrafiskVejledningContent.tsx, GrafiskVejledningDetails.tsx, graphicGuideLessons.ts, src/styles/graphicGuide.css, and public/images/graphic-guidance/*.png.

The original detailed content was retained in GrafiskVejledningDetails. Selectively restore the prior guidance component and remove only these newly added imports/assets to roll back. Preserve all unrelated dirty-worktree changes.

Local implementation and browser proof only. No deployment, database/branding writes, pricing/POD changes, orders, uploads or outbound messages were performed.

## Follow-up polish

- The illustrative PNGs could be compressed into delivery variants in a separate asset-optimisation pass.
- A real physical print proof remains outside this visual guidance task.
