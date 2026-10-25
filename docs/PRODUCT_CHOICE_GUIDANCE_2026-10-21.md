# Produktvalg og filvejledning — 21. oktober 2026

**25 October live update:** the prepared wording/product guidance is now released on the existing shop aliases. See [the live release record](REA_LIVE_RELEASE_2026-10-25.md). The original local implementation/verification account below is historical.

Lokale, additive forbedringer. Ingen udgivelse, databaseændringer, upload, ordre, betaling eller leverandørhandling.

## Resultat

- Matrixproduktets eksisterende valg får en foldbar forklaring af 4+0, 4+4 og kachering, når de relevante betegnelser findes i produktvalgene. Tallene forklares som trykfarver på hver side; de forveksles ikke med PDF-sidetal. Mat, blank og softfeel forklares uden at ændre produktets egne beskrivelser eller tooltips.
- Efter et brugerinitieret valg observeres beregnerens allerede eksisterende materiale- og antalsændringer. En vedvarende, skærmlæservenlig status viser før → efter. Første indlæsning, manuelt matrixvalg og rene prisændringer giver ingen automatisk advarsel. Næste brugerhandling rydder beskeden; produktskift rydder historikken. Følgeændringer fra samme handling samles.
- Begge eksisterende prispanelvisninger får vejledning om færdig trykfil, design online/i den konkrete skabelon og download til eget program. Skabelonknappen hedder nu “Design i skabelonen”, når en PDF-skabelon faktisk er tilknyttet. Produkter uden skabelon lover ingen skabelon; professionel-PDF-begrænsningen bevares.
- Eksisterende handlers, prisberegning, prisrækker, kombinationsvalg, skabelonbindinger, editor, tenantbranding, kundetekster, POD v1/v2 og egne løsninger er bevaret. Beskedsystemet observerer kun og vælger ikke nye værdier.

## Lokal verifikation

Aktuel kataloglæsning på den lokale side:

http://127.0.0.1:8932/produkt/salgsmapper-med-kachering?tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba

Port 8932 tilhører Vite i denne checkout; browseren får HTTP 200. Frisk, isoleret Chrome-session uden eksisterende kundelogin:

- Første valg: Chromo-karton / 50 stk. / 1.645 kr. Åbning af forklaringen bevarer samme matrixcelle og pris.
- Softfeel ændrer automatisk Chromo-karton → 350 g mat silk-papir; beskeden gengiver skiftet. Eksisterende pris bliver 530 kr. for det nye valg.
- A4 → A5 ændrer automatisk 50 → 100 stk.; beskeden gengiver skiftet. Eksisterende pris bliver 1.475 kr. for det nye valg.
- Manuel materialecelle og ændring af folie med uændret materiale/antal giver ingen falsk besked.
- 1440, 1280, 1024, 768, 390 og 320 px: ingen dokumentoverløb; eksisterende vandret matrixnavigation bevares. Ingen browser-runtimefejl.
- Separat syntetisk React-fixture tester tastaturåbning, stille initialisering, forsinket materiale+antal fra samme handling, manuelle valg, produktskift og filvejledningens skabelon/PDF-grænser. Dette er lokal komponenttest, ikke hosted ordre- eller uploadacceptance.
- 53 målrettede tests består: ændringsbeskeder, eksisterende materialeforklaringer, eksakt kombinationsresolver, skabelonbindinger, navigation, checkoutsession og bevarelse af produktredigering.
- Hele appens TypeScript består. Nye filer har ren ESLint; de to eksisterende komponenter har uændret antal eksisterende lintfund (32 og 74), ingen nye. Scoped diff har ingen whitespace-fejl.
- Begge lokale produktionsbygninger består; den endelige bygning tog 3m43s. Eksisterende advarsler om bundle-størrelse, Browserslist, pdfjs eval og lcms-modul er bevaret. Log: `output/product-choice-guidance-2026-10-21/build-final.txt`.

Kontrollen dækker den konkrete mappe og de delte komponenter. Andre beregnertyper, alle katalogprodukter, autentificeret upload, designer-retur, betaling og produktionsudgivelse er ikke gennemtestet i denne opgave.

## Filer og gendannelse

Kode: `ProductChoiceGuidance.tsx`, `useAutomaticSelectionNotice.ts`, `automaticSelectionNotice.ts` og `.test.ts`, samt små tilføjelser i `MatrixLayoutV1Renderer.tsx` og `ProductPricePanel.tsx`.

Før-kopier, snæver patch, testlog og screenshots ligger i `output/product-choice-guidance-2026-10-21/`. Checkout havde omfattende eksisterende ændringer før opgaven. Ved fortrydelse tilbageføres kun denne opgaves patch efter gennemgang; overskriv ikke hele komponenter med historiske Git-versioner eller før-kopier, hvis der siden er kommet andet arbejde. Ingen database-rollback er nødvendig.
