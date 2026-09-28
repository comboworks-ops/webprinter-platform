# Simpler system landing page — 9 September 2026

Local preview: `http://127.0.0.1:8110/platform`.

Thomas requested the original sliding product images, less scrolling, a useful
calculator example, a place for a future system film, and clearer positioning
for print shops replacing an older website in a changing AI landscape. This
is a focused revision of the existing white/navy/blue landing direction.

## Changed

- A centered, shorter introduction: **En ny hjemmeside. Et samlet printsystem.**
  It addresses replacing the old site with a shared platform for webshop,
  pricing, design and orders.
- Restored the original 18 platform product illustrations in a compact moving
  strip. Removed hover magnification; added pause/resume, offscreen/hidden-tab
  pausing and a scrollable static row for reduced-motion preferences.
- Added three keyboard-accessible capability tabs: price calculation, online
  designer and order overview. They share one area instead of separate tall
  sections. The existing designer illustration remains labelled illustrative.
- The isolated calculator calls the existing `calculateStorformatPrice` with
  sample material values: Banner 120 kr/m² and Skilt 180 kr/m². It accepts
  clearable dimensions and decimal commas, shows inline validation and labels
  all prices as examples excluding VAT. It cannot submit an order or save prices.
- A dedicated **Videogennemgang på vej** area reserves space for the future
  system film, with a working demo link. It has no non-functional play button.
  The former illustrative walkthrough source/assets are retained, but the
  landing no longer presents it as the main system demonstration.
- **Bygget til en hverdag med AI / Du behøver ikke starte fra bunden.** explains
  ongoing development, people-first usability and the ability to extend a shared
  product as technology changes. It does not promise an autonomous operator,
  guaranteed AI visibility, or automatically deployed customer updates.
- Scoped blue darkened to `#0775b7` for normal-size text/white CTA contrast.

## Assets

All original PNG illustrations remain intact. Additive 320px WebP derivatives
preserve their appearance and transparency, with original PNG fallbacks.
The 18 originals total 15,004,609 bytes; their WebP derivatives total 192,674
bytes. The actual rendered image boxes are 112 × 84px, with captions below.
The system-video poster is the existing storefront capture, not a film frame.

## Verification

The Vite listener on port 8110 was checked against this exact checkout.
Browser QA used the real local React application through the in-app browser.

- Widths: 1440, 1280, 1235, 1200, 1199, 1024, 801, 800, 768, 390 and 320px.
  No horizontal page overflow. Laptop/tablet and narrow phone screenshots were
  inspected; images no longer overlap their captions. The landing header keeps
  its existing measured desktop/compact policy.
- At 1235px, default page height decreased from 2966px to 1748px, about 41%.
  Smaller screens stack the video and capability area naturally.
- Calculator: 200 × 50 cm Skilt × 5 returns 900 kr; Danish decimal 100,5 × 50 cm
  Skilt × 5 returns 452 kr using the engine's existing nearest-krone rounding.
  Keyboard-selecting and deleting the width leaves the field empty, displays
  the inline error and replaces the price with a dash. Original production
  pricing code and product data are unchanged.
- Capability mouse selection and arrow/Home keyboard navigation work. Inactive
  panels are hidden; calculator choices persist between tabs.
- Slider transform progressed while playing, remained identical across paused
  observations, resumed on command and paused offscreen. Accessibility tree
  exposes the 18 captions once; duplicate visual group is aria-hidden. Hidden-tab
  and reduced-motion handling were source-reviewed, not OS-setting tested.
- Phone menu retains all destinations; Escape closes it and restores toggle
  focus. The demo CTA opens the master shop with Tryksager, Storformat,
  Klistermærker, Plakater and Tekstiltryk categories.
- Six meaningful calculator tests pass. Scoped ESLint and whitespace checks
  pass. Final Vite production build passes; existing large-bundle warnings remain.
- Final browser viewport override reset; `/platform` left open at the natural
  window size. Fresh final console checked for errors.

Screenshots and measurements: `output/qa/platform-landing-2026-09-09/`.

## Boundaries and rollback

Local source only. No deployment, settings writes, pricing-engine changes,
checkout/POD changes, authenticated workflow proof or finished video production.
The copy describes product direction; it does not change the separate release
readiness gates in the project continuity documents.

Rollback is limited to this landing revision in `Index.tsx`, the landing header
anchors and scoped styles, new capability/calculator components, and slider
changes/WebP derivatives. Preserve all unrelated dirty work and original PNGs.
