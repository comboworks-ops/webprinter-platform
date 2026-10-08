# Shared icon families · 5 October 2026

Implemented locally in the existing shared checkout. Review: http://127.0.0.1:8162/header-menu-review.html?icons=phosphor&entrance=cascade . Full designer/storefront comparison: http://127.0.0.1:8162/dropdown-menu-review.html?icons=phosphor . Balanced Search & Discover and all nine existing menu designs remain available.

Ten new freely selectable families: Bootstrap, Carbon, Fluent, Heroicons Solid, Iconoir, Material Rounded, Phosphor Duotone, Tabler, Remix Filled and MingCute Filled. The original Classic, Modern, Gradient and Outline Pro remain, with their existing paid metadata and purchasing callbacks untouched.

The saved Agent System catalogue at `Projects/AGENT SYSTEM/knowledge/agent-system-index/UI_RESOURCES.md` contains Animate UI and React Bits. Animate UI’s official icon documentation describes animated Lucide icons with Motion. It is the closest identified resource, not a confirmed identification from the user. Menu hover/focus animation is authored locally with the existing motion/CSS facilities, using that interaction pattern as a reference. No Animate UI/React Bits source collection is copied or redistributed. Ten permissive icon datasets are converted into local React SVG trees instead; no new dependency or external icon service is installed.

## Shared application behavior

`selectedIconPackId` remains the existing saved draft field. It now affects the app route tree, active storefront theme frame and designer draft. Portals inherit the same React context, including Products/account/search/language panels. Shared Lucide imports across 301 source files use a compatibility entry point through exact Vite and TypeScript aliases. The original package is separately resolved as `@webprinter/lucide-base`; types and unwrapped utilities remain available. No mass rewrite of application imports was necessary.

Real product-category fallbacks and selector samples share the same icon renderer. Existing four product packs use their actual authored SVG samples. New families cover all common menu, product and purchase symbols. Family changes do not replace uploaded artwork, product photos, social trademarks, national flags or the progress spinner. A family without an equivalent specialist symbol retains its meaning through a Lucide outline with that family’s stroke treatment. The per-family remaining cases are explicit in `docs/icons/provenance.json` (zero in Phosphor, Tabler and Remix; two to nine in other families).

The icon choice follows the existing branding draft/preview/publish path. The two DEV review pages additionally carry a public whitelisted family in their links and save it only to browser-local review storage. No hosted branding save or publish was performed.

Header → shared menu settings offers optional `dropdownIconMotion`: None, Calm lift or Playful bounce. It affects hover/focus on actual header/menu symbols, uses current menu colours and remains independent of the five existing dropdown entrances. Reduced-motion CSS disables it. Default is None.

## Sources and performance

Pinned Iconify data revision: `a7ddea98b00a171c8056b9c5cc9338d0ffda6854`. Provenance contains provider, upstream author, source URL, licence, exact revision, input checksum, licence-source checksum and retrieval date. Full MIT/Apache notices ship at `/licenses/icon-families.txt`.

`scripts/icons/generate-icon-families.py` reads the fetched JSON files, extracts explicitly mapped symbols and validates every SVG tag and attribute. It refuses scripts, event handlers, external URLs, unknown tags, embedded resources and unsafe values. Runtime uses React elements, not HTML injection. Ten local data chunks load on demand; the current minified chunks are approximately 52–112 KB each. The comparison gallery loads all families only when its samples mount. The ordinary storefront needs its selected family.

For regeneration, fetch the ten source JSON files at the recorded revision into `/private/tmp/webprinter-icon-sources/`, run the generator with Python, retain notices/provenance, and run `scripts/icons/icon-families.test.mjs`. The generator scans current named Lucide imports; its coverage test catches new imports that need a themed export. Revalidate licences and checksums if changing the revision.

## Local verification

- 22 focused checks pass: ten family SVG/semantic validations, distinct geometry for User/Search/Package, compatibility coverage, provenance/notices, review links, palette independence and existing menu settings/search behavior.
- Whole-app TypeScript passes. Focused lint has zero errors and four Fast Refresh warnings (two existing selector exports, two new mixed helper/provider exports).
- Isolated production build passes in 56.66 seconds at `output/icon-families-2026-10-05/build`. Existing chunk-size warnings remain. No deploy occurred.
- Browser: all ten account-menu User drawings have different actual geometry and correct source families. Phosphor account, search and language symbols verified; search filtering, ArrowDown focus and Escape remain working. Full shop preview shows the selected family throughout its visible interface, including header, service and product-menu symbols.
- Designer picker: Tabler selection → local save → reload propagates into the iframe. Header review: Phosphor selection → local save → reload retains the choice and motion setting.
- Both the full storefront iframe and menu review checked at 1440, 1280, 1024, 768, 390 and 320 px. No horizontal page overflow; storefront header changes to compact at 768 in this sample. Account menu fits at 320 (288 px wide).
- Test fixtures use an example account (`anna@example.invalid`) and sample search products. Full preview reads the existing catalogue. This is local visual/interaction proof, not authenticated checkout or hosted publication acceptance.

Evidence: `output/icon-families-2026-10-05/` includes tests, typecheck, lint, build log, browser checks and final screenshots. Existing dirty changes retained; pricing/POD/schema/tenant scoping untouched.
