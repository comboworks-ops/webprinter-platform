# Shopdesign-system

Dato: 2026-07-27

## Formål

Site Design V2 har et selvstændigt lag til shopdesign. Et shopdesign ændrer
hele butikkens præsentationsopskrift: header, produktmenu, kategorinavigation,
forsidekomposition, produktkort, produktside, bestilling, checkout, footer og
bevægelse.

Shopdesign og tema er to forskellige valg:

- **Shopdesign** styrer struktur og komponenternes præsentation.
- **Tema** styrer farver, typografi, knapper og effekter.

Produkter, priser, produktbilleder, tekster og brandfarver bevares, når et
shopdesign vælges.

## De ti shopdesigns

| ID | Navn | Primært formål |
| --- | --- | --- |
| `classic-catalog` | Klassisk Trykshop | Bredt produktsortiment |
| `quick-order` | Hurtig Bestilling | Genbestilling og faste kunder |
| `corporate-b2b` | Corporate B2B | Trykkerier og firmakunder |
| `editorial-studio` | Editorial Studio | Design, foto og premium print |
| `marketplace` | Produktmarked | Mange kategorier og produkter |
| `campaign-launch` | Kampagnebutik | Tilbud, sæsoner og lanceringer |
| `local-service` | Lokal Service | Lokale trykkerier og rådgivning |
| `minimal-gallery` | Minimal Galleri | Kuraterede sortimenter |
| `takeaway-print` | Takeaway Print | Restauranter og takeaway |
| `large-format-showroom` | Storformat Showroom | Skilte, bannere og storformat |

Hvert design har sin egen typede komponentopskrift. Det betyder eksempelvis,
at Hurtig Bestilling bruger brede produktrækker og kompakt checkout, Corporate
B2B bruger specifikationskort og stepper-checkout, Editorial Studio bruger
billedbårne produktkort, og Takeaway Print bruger menurækker og express
checkout.

## Produktmenu

Produktmenuen kan vælges uafhængigt af shopdesignet:

| ID | Navn | Brug |
| --- | --- | --- |
| `classic` | Klassisk katalog | Roligt og velkendt hierarki |
| `showcase-bar` | Visuel showcase | Kategoribilleder og hurtige indgange |
| `split-preview` | Delt preview | Menu med fremhævet produkt eller kampagne |
| `compact-columns` | Kompakte kolonner | Store kataloger og hurtig scanning |
| `gallery-cards` | Galleri-kort | Visuel produkt- og kategoripræsentation |

## Preview i Site Design V2

Preview-værktøjslinjen kan åbne forsiden, produktoversigten, checkout og enhver
tilgængelig produktside direkte. Produktmenu-knappen åbner og lukker butikkens
faktiske desktop- eller mobilmenu i previewet, så undermenuer kan vurderes uden
at forlade editoren.

Desktop-previewet renderer med et fast 1280 x 800 viewport og skaleres visuelt
til den plads, editoren har. Det betyder, at desktop-header, dropdowns og
produktsider ikke ved en fejl bliver vurderet som mobilvisning på en smal
administrationsskærm. Preview-navigation normaliserer tenant- og preview-query
parametre, før en produktslug udledes.

## Teknisk kontrakt

Layoutkontrakten er versioneret som `version: 1` og gemmes under
`branding.forside.layout`.

Den indeholder:

- `templateId`
- `sectionOrder`
- `heroTreatment`
- `heroHeight`
- `contentWidth`
- `sectionSpacing`
- `surfaceRhythm`

Ukendte eller ældre værdier falder tilbage til `classic-catalog`. Den klassiske
standard bruger den tidligere sektionsrækkefølge, så eksisterende shops uden en
gemt layoutindstilling ikke bliver ombygget automatisk.

Komponentopskriften gemmes ikke som kopieret tenant-data. Den afledes af
`templateId` i det centrale register og består af:

- Open Design-retning
- header og produktmenu
- kategorinavigation
- produktsamling og produktkort
- produktside og checkout
- footer og bevægelse

## Nøglefiler

- `src/lib/storefront/shopTemplates.ts`
- `src/components/admin/ShopTemplatePicker.tsx`
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/Header.tsx`
- `src/components/ProductGrid.tsx`
- `src/components/StorefrontProductTabs.tsx`
- `src/components/storefront/StorefrontThemeFrame.tsx`
- `src/components/storefront/StorefrontHomeContent.tsx`
- `src/pages/FileUploadConfiguration.tsx`
- `src/pages/PreviewShop.tsx`
- `src/lib/preview/siteDesignPreviewNavigation.ts`
- `src/styles/storefrontShopTemplates.css`
- `src/hooks/useBrandingDraft.ts`
- `docs/open-design-shop-system/DESIGN.md`
- `docs/open-design-shop-system/design-contract.md`
- `docs/open-design-shop-system/implementation-handoff.md`

## Sikkerhed og udvidelse

- Systemet ændrer ikke prislogik, produktdata eller POD-flow.
- Et layout bliver først live gennem den eksisterende publiceringsproces.
- Nye layouts skal tilføjes til det centrale register; lav ikke parallelle
  layoutvælgere.
- Open Design bruges nu som designkontrakt for de kontrollerede lokale
  komponentopskrifter. Der importeres ikke vilkårlig React-kode i en
  tenant-shop.
- Produkter, prisberegning, tenant-scope, POD og ordrelogik må ikke ændres af
  et shopdesign.

## Kontrol

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test src/lib/storefront/shopTemplates.test.ts

pnpm run build
```
