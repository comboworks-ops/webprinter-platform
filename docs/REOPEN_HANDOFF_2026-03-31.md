# Reopen Handoff — 2026-03-31

Dette dokument er lavet som genåbningsstatus for næste session.
Det opsummerer hvor projektet står lige nu, hvad der allerede er verificeret live, hvad der er deployet, hvad der stadig kun er lokalt, og hvad næste sikre skridt er.

## 1. Overordnet status
Fokus er tilbage på launch-forberedelse for den rigtige WebPrinter-platform og ikke på parallelle redesigns.

Den vigtigste aktuelle konklusion er:
- standard storefront-flowet virker næsten helt til launch
- mindst ét publiceret POD-v2-produkt er launch-blokeret
- kontaktflow, platform/tenant-separation og metadata/SEO er nu sat op og testet live
- GitHub er ikke ajour med de live Vercel-ændringer endnu

## 2. Hvad der er live nu
Følgende er verificeret live på de rigtige domæner:

### Kontakt og email-routing
- `webprinter.dk` platform-kontakt går til `info@webprinter.dk`
- tenant-shops går til den konkrete tenants `settings.company.email`
- afsenderen er central fra `info@webprinter.dk`
- Resend er flyttet til `webprinter.dk` som verified sender-domæne
- Edge Function secrets er sat til:
  - `CONTACT_EMAIL_FROM=info@webprinter.dk`
  - `PLATFORM_CONTACT_EMAIL=info@webprinter.dk`
- `send-contact-message` er deployet og returnerede `200` i live test

### Domæner og routing
- `webprinter.dk` og `www.webprinter.dk` peger nu på `printmaker-web-craft-main`
- `onlinetryksager.dk` / `salgsmapper.dk` peger også på samme projekt
- platform-host og tenant-hosts er nu adskilt korrekt i offentlig routing

### Metadata / branding / platform assets
- platform-hostet bruger nu server-side/injected metadata fra denne kodebase
- `www.webprinter.dk/kontakt` bruger nu platform-specifik titel/description
- platform-fallback assets er opdateret til:
  - `platform-og-image.png`
  - `platform-favicon.svg`

## 3. Hvad der blev verificeret i launch-audit
Der blev lavet live browsergennemgang af kundevejen.

### Verificeret live
1. `https://www.webprinter.dk/`
   - er marketing/platform landing page
2. `https://www.webprinter.dk/shop`
   - er rigtig storefront med publicerede produkter
3. Produktside -> checkout virker
4. Standard ikke-POD produkt kan nå frem til Stripe payment UI
5. Kontaktformularer virker live

### Kritisk fund
Det publicerede POD-v2-produkt `flyer-demand` kan ikke komme videre til betaling.

Live reproduktion:
- gå til `https://www.webprinter.dk/produkt/flyer-demand`
- vælg konfiguration
- klik `Bestil nu!`
- upload fil
- godkend fil
- checkout viser `Print.com preflight mangler`
- `Gå til betaling` er stadig disabled

Teknisk årsag:
- frontend kalder `pod2-pdf-preflight`
- checkout låser betaling ved preflight-fejl
- dokumentationen siger, at denne funktion findes men ikke er deployet

Kodepegepinde:
- `src/pages/FileUploadConfiguration.tsx`
- `supabase/functions/pod2-pdf-preflight/index.ts`
- `POD2_README.md`

## 4. Publicerede produkter lige nu
Der er 8 publicerede produkter på master storefront.

### Behold til launch
- `standard-postcards` — Postkort
- `new-folders` — Foldere
- `new-flyer-test` — Flyers med finish
- `neon-plakater` — Neon Plakater
- `aluminium` — Aluminium Skilte
- `color-t-shirt-4-plus-4` — Farve T-shirts med tryk
- `silketryk-t-shirt` — T-shirts med silketryk

### Skjul før launch
- `flyer-demand` — Flyers

Begrundelse:
- dette er den ene klart verificerede launch-blocker i offentlig checkout

### Særbemærkninger pr. kategori
- T-shirt-produkterne bruger størrelsesfordeling
  - dette blev spot-checket live
  - `Bestil nu!` er disabled indtil størrelsessummen matcher valgt antal
  - når summen matcher, bliver knappen aktiv
- `aluminium` blev spot-checket som storformat-flow
  - produktside og konfiguration er tilgængelig
  - ikke verificeret hele vejen gennem betaling endnu

## 5. Betaling / Stripe-status
### Verificeret
- checkout kan på et standard ikke-POD-produkt nå frem til Stripe payment element
- Stripe payment modal/iframe loader live
- `stripe-create-payment-intent` er deployet og koblet i checkout-flowet

### Ikke endeligt bevist endnu
Der er endnu ikke gennemført en fuld reel testordre med succesbetaling og efterfølgende verificering af:
- ordre oprettes i databasen
- admin ser ordren
- ordrebekræftelse sendes
- admin-/shop-notifikation sendes

Det er næste store launch-test.

## 6. Tenant/platform separation
Den aktuelle model er nu:

### Platform
- `webprinter.dk` er platform/site for WebPrinter selv
- platform-kontakt bruger `PLATFORM_CONTACT_EMAIL`
- lige nu: `info@webprinter.dk`

### Tenants
- hver tenant-shop bruger sin egen `settings.company.email` som modtager
- eksempel:
  - `onlinetryksager.dk` -> `support@onlinetryksager.dk`
  - `salgsmapper.dk` -> sin tenant-email

### Vigtigt
- mails bliver stadig sendt fra WebPrinters fælles sender
- tenants sender ikke fra eget domæne
- det er den rigtige launch-model lige nu

## 7. Signup / automatisk kontakt-email
Nye shops gemmer nu email som kontaktmodtager automatisk.

Det gælder:
- public signup
- admin-oprettelse af tenant

Det betyder:
- når en ny tenant oprettes med email
- kan kontaktformular-routing virke med det samme
- uden ny separat mail-provider-opsætning pr. tenant

## 8. Git / GitHub / Vercel status
### Git
- branch: `main`
- HEAD: `be4cf52`
- `origin/main` peger stadig på samme commit
- det betyder at nuværende ændringer **ikke er pushed** til GitHub endnu

### Vercel
- flere launch-relevante ændringer er deployet direkte fra lokal kode via Vercel CLI
- det betyder at Vercel lige nu er foran GitHub på mindst:
  - platform metadata
  - platform favicon/OG image
  - tenant/platform SEO shell
  - kontaktflow

### Konsekvens
GitHub er ikke den fulde sandhed lige nu.
Repoet har en stor beskidt worktree med både:
- launch-fixes
- igangværende featurearbejde
- eksperimentelle områder

## 9. Non-destruktiv oprydning der allerede er lavet
Der er ryddet op uden at slette noget.

### Tilføjet til `.gitignore`
- `dist-check/`
- `dist-check*/`
- `.playwright-cli/`
- `.TODO_DROPDOWN_IMAGE`
- `.agent/SITE_DESIGN_V2_SCRATCHPAD.tmp`

### Arbejdsdokumenter der allerede findes
- `docs/LAUNCH_PREP_2026-03-27.md`
- `docs/GO_LIVE_READINESS_LOG.md`
- `docs/WORKTREE_SCOPE_2026-03-30.md`
- `docs/LAUNCH_COMMIT_PLAN_2026-03-31.md`

## 10. Launch-only commit-plan
Der er allerede lavet en præcis commit-plan for kun launch-filer i:
- `docs/LAUNCH_COMMIT_PLAN_2026-03-31.md`

Formålet med den plan er:
- stage kun launch/runtime-filer
- undgå at blande dem med machine UI, Canva, site design v2 og POD3

## 11. Områder der ikke skal blandes ind i launch-commit
Disse områder er i gang og bør holdes adskilt:

### Machine / pricing UI
- `src/components/admin/MachineForm.tsx`
- `src/components/admin/MachinePricingManager.tsx`
- `src/components/admin/PricingProfileForm.tsx`
- `src/components/admin/InkSetForm.tsx`
- `src/components/admin/MaterialForm.tsx`
- `src/components/admin/MarginProfileForm.tsx`
- `src/components/admin/ImpositionPreview.tsx`

### Canva / template library / designer
- `src/components/admin/DesignerTemplateManager.tsx`
- `src/components/designer/DesignLibraryDrawer.tsx`
- `src/hooks/useDesignLibrary.ts`
- `src/lib/designer/templateLibrary.ts`
- `src/lib/canva/`
- `src/pages/CanvaReturn.tsx`
- `supabase/migrations/20260326120000_template_library_v2.sql`

### Site design v2 / branding editor
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/admin/SiteDesignPreviewFrame.tsx`
- `src/components/admin/TenantSiteDesignV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/lib/branding/*`
- `src/lib/siteDesignTargets.ts`

### POD3 / supplier work / import scripts
- `src/components/pod3/`
- `src/pages/admin/Pod3FlyerAlarm.tsx`
- `supabase/functions/pod3-flyeralarm-request/`
- `supabase/functions/pod2x-printcom-proxy/`
- diverse `check-*.cjs`, `fix-*.cjs`, `migrate-*.cjs`

## 12. Næste sikre skridt
Når programmet åbnes igen, er den rigtige rækkefølge:

1. Afpublicér eller skjul `flyer-demand`
   - eller deploy/fix `pod2-pdf-preflight` hvis POD-v2-flyeren skal med ved launch
2. Kør én reel lav-værdi testordre på et standardprodukt
   - bedste kandidat: `standard-postcards`
3. Verificér efter betaling:
   - ordre i database
   - ordre i admin
   - kundemail
   - admin-/shop-notifikation
4. Isolér launch-filer i egen commit efter planen i `docs/LAUNCH_COMMIT_PLAN_2026-03-31.md`
5. Push først når launch-committen er læst igennem og ren

## 13. Kort beslutningsstatus
Hvis launch skulle ske meget snart, er den pragmatiske beslutning:
- launch med de 7 ikke-POD publicerede produkter
- skjul `flyer-demand` indtil POD-v2-preflight er faktisk deployet og retestet

## 14. Hurtig opsummering
- kontaktflow virker
- platform/tenant separation virker
- metadata/domæner virker
- standard checkout når Stripe
- POD-v2 flyer er launch-blocker
- GitHub er bagud ift. Vercel
- launch-only commit-plan er klar
