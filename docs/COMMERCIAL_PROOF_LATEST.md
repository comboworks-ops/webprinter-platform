# Commercial Proof Report

Generated: 2026-07-10T01:18:29.365Z
Base URL: http://127.0.0.1:8083
Timeout: 25000 ms
Status: 12/12 tenant proof checks passed

This is a local, read-only proof artifact. It does not write products, prices, orders, SEO, POD or Supplier Bank data.

## Binding Guard

```text
Commercial readiness binding and proof alignment check passed.
```

## Tenant Proof Checks

| Status | Check | Route | Evidence |
| --- | --- | --- | --- |
| PASS | Salgsmapper PDF template | http://127.0.0.1:8083/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf | 200 application/pdf, 51845 bytes |
| PASS | Webprinter home | http://127.0.0.1:8083/?force_domain=webprinter.dk | 200 Webprinter.dk – Danmarks billigste tryksager √ bannere √ print |
| PASS | Webprinter aluminium | http://127.0.0.1:8083/checkout/konfigurer?force_domain=webprinter.dk | 200 Aluminium Skilte \| weprinter; order checkout handoff |
| PASS | Banner Builder Pro site package preview | http://127.0.0.1:8083/preview-shop?preview_mode=1&tenantId=00000000-0000-0000-0000-000000000000&siteId=banner-builder-pro&sitePreview=1&page=%2F | 200 Webprinter.dk – Danmarks billigste tryksager √ bannere √ print; site package iframe proof |
| PASS | Salgsmapper home | http://127.0.0.1:8083/?force_domain=www.salgsmapper.dk | 200 Salgsmapper med tryk \| Standard, laminering og UV-lak |
| PASS | Salgsmapper category landing | http://127.0.0.1:8083/produkter?overview=produkter&category=salgsmapper&force_domain=www.salgsmapper.dk | 200 Webprinter.dk – Danmarks billigste tryksager √ bannere √ print; category landing drilldown |
| PASS | Salgsmapper standard folder | http://127.0.0.1:8083/checkout/konfigurer?force_domain=www.salgsmapper.dk | 200 Standard Salgsmapper \| salgsmapper.dk; template download link; designer template handoff; designer production PDF return |
| PASS | Salgsmapper laminated folder | http://127.0.0.1:8083/produkt/salgsmapper-med-kachering?force_domain=www.salgsmapper.dk | 200 Salgsmapper med laminering \| salgsmapper.dk |
| PASS | Onlinetryksager home | http://127.0.0.1:8083/?force_domain=www.onlinetryksager.dk | 200 Billige tryksager online \| Flyers, plakater og print |
| PASS | Onlinetryksager category landing | http://127.0.0.1:8083/produkter?overview=produkter&category=tryksager&force_domain=www.onlinetryksager.dk | 200 Tryksager og printprodukter \| Se hele udvalget; category landing drilldown |
| PASS | Onlinetryksager flyer | http://127.0.0.1:8083/checkout/konfigurer?force_domain=www.onlinetryksager.dk | 200 Flyers og løsblade med tryk \| Billige flyers online; order checkout handoff |
| PASS | Onlinetryksager poster | http://127.0.0.1:8083/produkt/standard-plakater?force_domain=www.onlinetryksager.dk | 200 Plakater \| Onlinetryksager |

## Covered Proof Paths

- Webprinter Aluminium order/upload handoff.
- Banner Builder Pro site package preview.
- Salgsmapper category landing drilldown.
- Salgsmapper PDF template download and designer handoff.
- Onlinetryksager category landing drilldown.
- Onlinetryksager Flyers order/upload handoff.
