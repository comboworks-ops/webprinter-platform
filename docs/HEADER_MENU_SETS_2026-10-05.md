# Existing header menu sets — 5 October 2026

The existing `header.dropdownPreset` choice now governs the entire menu set:
Products, account, search and language. Optional search/language presentations and
a shared entrance master use the existing header draft. No new preset identity,
database schema or publication flow is introduced. All nine
approved choices and deliberate legacy selections remain available. Search &
Discover remains the selected balanced default.

Account and language panels receive the same `--menu-*` colour, font and radius
tokens as Products, including explicit customized dark-menu colours. Compact
navigation inherits those tokens and retains its account/language destinations.
Account links and authorization-dependent admin visibility are unchanged.
Language selection uses accessible radio items on desktop and pressed buttons
in compact navigation. Portal styling is scoped so global link colours and
generic popup styles cannot override menu contrast.

Each original preset has companion treatments: tab-like section heading,
showroom cards, dark bold type, compact list, balanced standard, folded paper,
open directory, scrollable filmstrip, or spacious curtain. The designer's
existing picker contains small account/search/language samples beneath the
original Products image. Its single selection still uses existing draft,
preview, save and publication paths.

Search keeps one icon-triggered field within the header row at every width.
Browse-first modes present up to six actual catalogue entries and a browse-all
link. Compact and keyboard modes prompt for a query or category instead. Typing
searches the entire catalogue with all query tokens; category choices narrow it. Loading,
error and empty results are retained. Enter/ArrowDown, Escape, outside click and
tenant-aware destinations remain supported. Results inherit the selected set.

## Local review

- Full existing designer/published-preview components:
  http://127.0.0.1:8162/dropdown-menu-review.html
- Interactive account/search/language samples, paired with the original
  Products thumbnails: http://127.0.0.1:8162/header-menu-review.html

Both are DEV-only entries. The corner review uses a clearly labelled synthetic
user and six synthetic products, without authentication or hosted saves. The
full picker uses real read-only catalogue data and supports browser-local saves
only. Review links retain the same menu ID between the two pages. Neither page
creates an additional production menu setting.

## Verification

- 32 existing preset, branding-preservation, print-design and header-fit tests
  pass; application TypeScript passes.
- All nine sets checked in the actual shared account/language/search controls:
  correct shared preset IDs, all four account/admin destinations, language
  switching and matching A5 search. First five also checked for initial browse,
  ArrowDown into results and Escape dismissal/focus restoration.
- Actual Site Design `HeaderSection` choice changed the real preview iframe to
  `visual-showroom`; no hosted save/publication was performed.
- Actual Salgsmapper product route at 1440, 1280, 1024, 768, 390 and 320 px:
  72 px header, no page overflow, search field/results within the viewport,
  input focus and four actual catalogue matches. Desktop through 1024 px;
  compact at 768/390/320. Compact language selection checked at 320 px and
  cramped label wrapping corrected. No real-storefront browser errors observed.
- Production build passes with the existing chunk-size/mixed-import warnings.
  New helpers/review entries and HeaderSearch lint clean. Existing Header
  retains five explicit-any errors and three dependency warnings; HeaderSection
  retains one dependency warning. No unrelated cleanup performed.

Evidence: `output/header-utility-2026-10-05/browser-checks.json` and
`standard-account.jpg`. Six-width checks used signed-out real storefront data;
account checks used a synthetic user. Authenticated hosted account operations,
hosted draft save/reload, physical devices and production deployment are outside
this local evidence.

No pricing, POD, database, order, upload or publication changes. The existing
dirty checkout is preserved. Rollback is the narrow frontend/menu stylesheet
change; no data rollback or migration is needed. Preview port 8162 serves this
checkout; the existing 8160 listener was not restarted.

## Distinct behaviours and shared animation master

The first five designs now differ in both appearance and interaction. The four
additional approved designs retain their original identities and matching corner
panels. The same picker still selects Products and account appearance together.

| Existing set | Account | Search by default | Language by default |
| --- | --- | --- | --- |
| Tabbed Explorer | Konto/Ordrer views with keyboard-selectable radio tabs | Category filters | Full language name |
| Visual Showroom | Avatar and four action cards | Large product cards | Two language cards |
| Kinetic Type | Bold dark menu | Keyboard search with Ctrl/Command K | Direct DA/EN buttons |
| Quick List | Compact direct links | Query-first result list | DA/EN codes |
| Search & Discover | Balanced existing standard | Six suggestions before typing | Flag button and radio choices |
| Paper Fold | Folded paper treatment | Category filters | Full language name |
| Open Directory | Spacious direct links | Category filters | Full language name |
| Product Filmstrip | Horizontal action rail | Horizontal product cards | Language cards |
| Focus Curtain | Spacious large heading | Keyboard search | DA/EN codes |

In **Site Design → Header → Dropdown layout → Fælles menuindstillinger**, edit
search form, language presentation, background, text, hover/selected colour and
accent using the shared colour picker and saved swatches. An unset accent follows
the tenant primary colour. Shared font/radius/opacity controls remain available.
Changing motion or search/language behaviour does not mark the dark menu palette
as customized; an actual colour edit does. Palette tokens reach portal panels,
search, compact navigation, Products and live designer thumbnails.

Five shared entrance choices apply to opening Products, account, language and
search panels. Direct DA/EN changes language immediately without opening a panel:

| Choice | Panel | Content |
| --- | --- | --- |
| Langsom fade | 540 ms opacity fade | Together |
| Hurtig zoom | 190 ms small scale and lift | Together |
| Bounce | 480 ms spring-like overshoot | Together |
| Udfoldning | 460 ms box reveal | Content follows after 280 ms |
| Trinvis opbygning | 280 ms box entrance | Items stagger from 140 to 320 ms |

`header.dropdownEntrance`, `dropdownSearchPresentation`,
`dropdownLanguagePresentation` and `dropdownAccentColor` are optional existing
header-draft fields. “Brug menusættets oprindelige bevægelse” removes the entrance
override and retains authored motion. Unsupported persisted values safely fall
back. Reduced-motion CSS removes all shared panel/item animations; existing
Framer Motion reduced-motion handling remains. The OS preference was not changed
for this review. Keyboard-focused links become immediately visible (actual cascade account focus
checked: item opacity 1, item/panel animations none), and typing
or filtering search results skips item staging.

The corner review has the real controls and a quick set selector. Its link into
the full designer carries public visual choices, including explicit resets to
automatic behaviour. Browser-local save updates its URL so reload cannot restore
an older incoming choice. No account credentials, tenant secrets or product
content are encoded in these links.

### Additional verification

- 41 focused tests pass: full-catalogue token/category search, behaviour defaults
  and overrides, five motion resolvers, palette customization, both real branding
  merge paths, JSON save/reload, page-theme preservation and review-link resets.
- All five motion names/timings checked on actual Products, account, language and
  search panels. Unfold/cascade item delays verified, including Products category
  items. All nine account/search sets checked in shared components.
- First-five search/language forms verified: real category filtering, empty-state
  differences, cards/list layouts, English/Dansk selection, ArrowDown/Escape,
  keyboard account tab selection and Control K input focus.
- Actual `HeaderSection` edits to set, search/language forms, animation and four
  colours saved locally and survived reload. A custom background/text/accent
  matched across real Products and synthetic account/language/search panels.
- Preview iframe at 1440/1280/1024/768/390/320 px: 72 px header, no overflow;
  desktop through 1024 and compact at 768/390/320. At 320 px, language switching
  and real-catalogue search worked; results stayed between x=20 and x=300, and
  typed-result animation was `none`. Corner lab also fits 320 px.
- One earlier iframe resize emitted a ResizeObserver delivery notification and
  the existing runtime guard showed its fallback. Reload cleared it. The six
  width repeat checks and subsequent compact interactions passed without a
  repeat. Temporary diagnostics were removed; no runtime-guard changes made.
  Six existing runtime-policy tests also pass. This transient observation remains
  separate from the successful menu checks.
- Application TypeScript and focused new/modified component lint pass. Final production
  build passes (6m 16s), with the existing chunk-size/mixed-import warnings.
  Existing Header/HeaderSection lint debt remains as described above.

Additional evidence: `output/header-utility-2026-10-05/motion-browser-checks.json`,
`menu-controls-account.png`, `menu-controls-showroom.png`, `motion-tests.log`,
`motion-typecheck.log`, `motion-lint.log` and `motion-build.log`.

All changes remain local. Hosted/authenticated operations, hosted settings
persistence and production deployment have not been verified or performed.
