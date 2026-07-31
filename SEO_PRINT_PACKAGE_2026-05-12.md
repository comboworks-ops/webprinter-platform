# Print SEO Package - 2026-05-12

## Basis

This package was built from Danish print SERP patterns and Google Search Central guidance. Competitors commonly emphasize:

- "tryksager", "online trykkeri", "billige tryksager"
- product-intent terms such as "flyers", "plakater", "postkort", "blokke", "salgsmapper"
- conversion terms such as "beregn pris", "bestil online", "upload trykfil", "hurtig levering"
- trust terms such as "rådgivning", "filcheck", "kvalitet", "professionel finish"

Google guidance used:

- Every page should have a descriptive, concise `<title>`.
- Avoid keyword stuffing and repeated boilerplate titles.
- Google must recrawl and reprocess changes before search results update.
- Sitemaps and Search Console URL Inspection help Google discover changes.

## Applied Scope

Tenant SEO rows:

- Onlinetryksager: all current public pages and product pages, including missing `/produkt/blokke`.
- Salgsmapper.dk: homepage/account/legal rows and all current product pages.

Platform SEO:

- Webprinter platform fallback copy was updated in code.
- Platform page rows are prepared in `platform_seo_pages`.

Technical indexing:

- Added domain-aware `/robots.txt`.
- Added domain-aware `/sitemap.xml`.
- Tenant sitemaps include public static pages, product pages, and custom SEO rows.

## Notes

This package does not guarantee rankings. It gives Google cleaner page titles, meta descriptions, canonical URLs, robots discovery, and sitemap discovery. Search result changes still depend on crawling, competition, authority, content quality, links, and Search Console processing.
