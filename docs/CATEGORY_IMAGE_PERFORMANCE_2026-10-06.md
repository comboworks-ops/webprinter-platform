# Category image delivery — 6 October 2026

Implemented and verified locally. No production deployment, uploaded artwork changes,
storage setting changes, database changes or pricing changes were made.

## Finding

The live Webprinter `/shop` rendered original public Storage PNGs in small product
and category slots. One 2784 × 1536 image displayed around 360–430 CSS pixels wide
downloaded 3,506,556 bytes. The selected local Salgsmapper category used an
800 × 781 PNG weighing 525,868 bytes. Built-in product PNGs were mostly around
1925 pixels square, although menu thumbnails and cards were much smaller.

## Change

- `StorefrontImage` requests responsive compressed copies for public Supabase PNG,
  JPEG, WebP and AVIF artwork. Width groups: thumbnails 96/192; cards up to 960;
  larger category/featured slots up to 1280. Quality 78; aspect ratio and alpha
  retained, with no server crop. Existing CSS still controls presentation.
- CSS-sized lazy images use native `sizes="auto, ..."` with explicit fallback sizes;
  other images have slot-specific size hints. The browser selects for its screen
  density. First standard-grid images load eagerly; lower items remain lazy.
- Built-in artwork has 113 additive WebP variants from 17 originals. Regenerate
  using `scripts/generate-storefront-image-variants.py` with Python and Pillow.
  Original files and `getProductImage`/admin synchronization remain unchanged.
- Shared category layouts, catalogue presentations, standard product grids,
  category/product drop-down media, search thumbnails and featured product media
  use the component. Tenant artwork, branding, layouts and hover styles remain.
- A failed optimized source clears the responsive candidates and retries the
  original once, then delegates to the caller's existing error/fallback behavior.
- Signed/private URLs, foreign image hosts, SVG and GIF sources retain their
  existing delivery. No new proxy or service was introduced.

## Measured transfer sizes

These are file-size comparisons, not an overall page-loading benchmark.

| Image | Original | 640 px WebP copy | Reduction |
| --- | ---: | ---: | ---: |
| Live Webprinter aluminium artwork | 3,506,556 bytes | 16,394 bytes | 99.5% |
| Selected Salgsmapper category artwork | 525,868 bytes | 21,194 bytes | 96.0% |
| 17 built-in images combined | 3,355,340 bytes | 263,488 bytes | 92.1% |

Public source paths measured on the existing project `ziattmsmiirfweiuunfo`:
`product-images/6c546267-6585-4465-a4fe-857e3d343612-1772242969899.png` and
`product-images/62b759c7-7083-45bb-bd11-e0fb3fd493eb-1772965535538.png`.
Both original and resized requests returned HTTP 200. The image service was
already available; it was not enabled or reconfigured for this change.

## Verification

- 16 relevant source-policy, catalogue and menu setting tests passed.
- Whole-application TypeScript check passed.
- New/shared image modules and changed catalogue/theme modules lint cleanly.
  Broader touched-file lint reports 25 existing `no-explicit-any` errors and
  4 existing hook warnings in Header, ProductGrid and FeaturedProductConfigurator;
  these are outside the image changes.
- Production build passed; all 113 variants are present in the build.
- Selected shop category layouts checked at 1440, 1280, 1024, 768, 390 and 320
  pixels: loaded artwork and no horizontal overflow.
- Default product drop-down: four thumbnails loaded from compressed 96 px
  service copies rather than original PNGs.
- A 140 px fixture selected 320 px responsive copies. Temporarily withholding
  generated Flyers copies verified recovery to the original PNG for eager and
  lazy loading. All generated copies were restored before the final build.
- Preview console errors: none. Evidence and screenshot:
  `output/category-images-2026-10-06/`.

## Release boundary and rollback

The live shops still need a separate reviewed release. This checkout contains
other ongoing work: isolate this image-delivery change before releasing it.
After release, confirm current image URLs and transfer sizes on the live shop,
including a phone and the product menu.

Rollback: replace `StorefrontImage` call sites with their previous `img` tags.
Original upload URLs and original built-in artwork are intact; no data repair
is necessary. The additive generated variants can remain unused.

References checked before implementation:
[Supabase image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations),
[responsive image sizing](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#sizes).
