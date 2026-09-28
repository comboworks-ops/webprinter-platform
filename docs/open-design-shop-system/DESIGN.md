**Webprinter Open Design Shop System**

## Visual Theme & Atmosphere

The shop system offers ten deliberately different commercial experiences
rather than ten colour variations. Each recipe combines a recognised Open
Design direction with Webprinter's existing tenant branding:

- Klassisk Trykshop: calm, familiar print catalogue.
- Hurtig Bestilling: compact, task-first repeat ordering.
- Corporate B2B: precise, specification-led procurement.
- Editorial Studio: image-led, spacious and narrative.
- Produktmarked: dense, scannable multi-category commerce.
- Kampagnebutik: bold campaign hierarchy and visual emphasis.
- Lokal Service: approachable, advice-led local service.
- Minimal Galleri: restrained, image-first curation.
- Takeaway Print: direct, energetic menu-style ordering.
- Storformat Showroom: large imagery and project-led presentation.

The active tenant's content, products and identity remain recognisable in
every recipe. A shop recipe changes composition and component anatomy, not the
underlying business data.

## Color

Recipes consume the tenant's existing CSS colour tokens. They may change how
those colours are distributed through borders, bands, emphasis surfaces and
hover states, but they do not replace saved brand colours.

Contrast must remain readable in navigation, cards, buttons and checkout.
Neobrutalism uses stronger borders and solid shadows; editorial and minimal
recipes use quieter borders and transparent surfaces; campaign recipes use a
restrained tint of the primary colour.

## Typography

Typography continues to come from the selected visual theme and tenant font
settings. Recipes alter hierarchy, weight and scale only where the component
role changes:

- dense commerce keeps product titles and prices compact;
- editorial and showroom cards give titles more space;
- corporate cards use compact labels and specification-like hierarchy;
- takeaway uses stronger emphasis for rapid scanning.

Letter spacing remains zero. Hero-scale type is reserved for real hero
content, while cards, navigation and checkout retain operational sizing.

## Spacing & Grid

The system has contained, wide and full content widths plus compact, balanced
and generous section rhythms. Each recipe also owns a catalogue grid:

- rapid and menu lists use two wide rows on desktop;
- marketplace uses five compact columns;
- campaign uses four visual cards;
- corporate uses three specification cards;
- editorial, gallery and showroom use three image-led columns.

Layouts collapse to one column where needed on small viewports. Stable image
dimensions, minimum widths and responsive grid tracks prevent controls and
dynamic prices from shifting the page.

## Layout & Composition

Every recipe controls the whole customer journey:

- header treatment and navigation behaviour;
- category navigation;
- homepage section order and hero treatment;
- product collection and card anatomy;
- product configuration page;
- checkout composition;
- footer density and alignment.

Five product-menu patterns can also be selected independently: Klassisk
katalog, Visuel showcase, Delt preview, Kompakte kolonner and Galleri-kort.
This makes the menu adaptable without changing the rest of the chosen shop.

## Components

Recipe-aware components expose semantic data attributes and stable classes.
The central recipe registry is the only source of shop variants. Header,
category tabs, product grids, product cards, product flows, checkout and
footer consume the same resolved recipe.

Cards are individual product objects, never wrappers around whole sections.
Operational pages remain dense and predictable. Existing buttons, price
matrices, uploads, product records and checkout controls are reused rather
than replaced.

## Motion & Interaction

Motion variants are subtle, direct, precise, editorial, market or dramatic.
They change transition speed and hover emphasis without blocking ordering.
All movement is disabled or reduced when the user requests reduced motion.

Selecting a recipe updates the draft preview immediately. Nothing becomes
live until the existing publish action is used. Menu selection remains
independent from recipe selection.

## Voice & Brand

Customer-facing language remains Danish, concise and product-focused. The
interface should help customers choose, configure and buy print rather than
describe the design system itself.

Recipe names are editor-facing. Tenant names, product copy, category labels,
prices and calls to action remain owned by tenant data and branding settings.

## Anti-patterns

- Do not treat a shop recipe as a colour preset.
- Do not import arbitrary React code or remote components into a tenant shop.
- Do not duplicate the central template registry or create parallel selectors.
- Do not alter product, pricing, POD, tenant or checkout logic from a recipe.
- Do not use decorative cards for entire sections or nest cards inside cards.
- Do not add viewport-scaled typography, negative letter spacing or ornamental
  gradient blobs.
- Do not publish a recipe merely because it was previewed.
- Do not hide required configuration, price or checkout controls for style.
