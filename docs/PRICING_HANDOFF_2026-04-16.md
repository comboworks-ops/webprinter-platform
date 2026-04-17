# Pricing Handoff — 2026-04-16

Dette dokument er lavet som genåbningsstatus for næste chatbot-session omkring pricing/import.
Det fokuserer kun på pricing-systemet, matrix-imports og den aktuelle `new-folders` gennemgang.

## 1. Læs dette først

Før der laves nye pricing-ændringer, læs i denne rækkefølge:
- `POD2_README.md`
- `AI_CONTINUITY.md`
- `SYSTEM_OVERVIEW.md`
- `.agent/HANDOVER.md`
- `docs/PRICING_SYSTEM.md`
- `docs/PRICING_INGESTION_ARCHITECTURE.md`
- dette dokument

## 2. Vigtige regler

- Pricing er produktionskritisk.
- Ændr ikke business logic, markup eller source mapping uden eksplicit beslutning.
- Bevar `MatrixLayoutV1`, `products.pricing_structure`, `generic_product_prices`, `variant_name`, `variant_value` og `extra_data` semantik.
- Manuale prisrettelser i admin er tilladt, men en ny import for samme produkt overskriver de publicerede prisrækker.

## 3. Nuvarande import-arkitektur

Der er nu et fælles pricing-lag under:
- `scripts/product-import/shared/conversion.js`
- `scripts/product-import/shared/normalized-pricing.js`
- `scripts/product-import/shared/validation.js`
- `scripts/product-import/shared/matrix-publisher.js`

Mål:
- extractors forbliver produktspecifikke
- normalisering går gennem fælles payload
- publish går gennem fælles matrix publisher

Vigtigt:
- publish sletter eksisterende `generic_product_prices` for produktet og indsætter nye rækker igen
- publish kan også provisionere manglende grupper/værdier hvis importen tillader det

## 4. Folder-importer status

`scripts/fetch-folders-import.js` har nu disse relevante flows:
- `--from-existing-product`
- `--from-clean-csv`
- `--merge-existing`
- `--prefer-source`

`--prefer-source` blev tilføjet for at løse et konkret problem:
- tidligere beholdt merge-flowet gamle live-rækker hvis samme nøgle allerede fandtes
- det betød at forkerte legacy-priser kunne overleve selv når ny supplier-data fandtes
- nu kan supplier-rækker erstatte eksisterende live-rækker på samme matrix-nøgle

Relevant helper:
- `scripts/product-import/shared/folders-matrix.js`

Test dækker nu både:
- standard merge-adfærd
- `preferSource` override-adfærd

## 5. Aktiv folder-prisregel

Den aktuelle regel vi beholdt for folders er:
- `EUR -> DKK` med faktor `7.5`
- `0-2000 DKK` base: `+60%` (`x1.6`)
- `2000-5000 DKK` base: `+50%` (`x1.5`)
- `5000-10000 DKK` base: `+40%` (`x1.4`)
- `10000+ DKK` base: `+30%` (`x1.3`)
- afrundes til hele kroner

Vigtigt:
- den gamle idé om `+80%` eller `+70%` blev ikke valgt som aktiv folder-regel
- hvis nogen forventer fx `223 kr` ud fra `16,36 EUR`, så matcher det ikke den nuværende folder-regel

## 6. `new-folders` status

Produkt:
- slug: `new-folders`
- navn: `Foldere`
- produkt-id: `51d950f4-c669-4345-95f4-5c11704cb9d0`
- tenant: master `00000000-0000-0000-0000-000000000000`

Lokal produktside:
- `http://localhost:8080/produkt/new-folders`

Der blev lavet live supplier-audit mod WIRmachenDRUCK og derefter republish til databasen.

### 6.1 Rettet i denne session

`DIN Lang / Rullefalset / 6 sider`
- tidligere lå der forkerte legacy-rækker med `eur = 0`
- de blev erstattet fra live WIRmachenDRUCK source

`DIN Lang / Rullefalset / 10 sider`
- tidligere pegede source mapping mod standard `wickelfalz-10seitig`
- det gav fx `11,43 EUR` og `137 kr` for lodret 50 stk
- dette blev vurderet som forkert source mapping
- importer-logikken foretrækker nu `sonderwickelfalz` for `Rullefalset / 10 sider`

### 6.2 Korrekt 10-siders source nu

Lodret:
- `https://www.wir-machen-druck.de/faltblatt-gefalzt-auf-din-lang-vertikaler-sonderwickelfalz-10seitig.html`

Vandret:
- `https://www.wir-machen-druck.de/faltblatt-gefalzt-auf-din-lang-quer-horizontaler-sonderwickelfalz-10seitig.html`

### 6.3 Verificerede priser efter fix

`DIN Lang / Rullefalset / 135g papir / Matsilk / Lodret / 50 stk`
- `6 sider`: `21,48 EUR` -> `258 kr`
- `8 sider`: `27,35 EUR` -> `328 kr`
- `10 sider`: `16,36 EUR` -> `196 kr`

Bemærk:
- `196 kr` er korrekt under den nuværende folder-regel
- `223 kr` ville kræve en anden markup/FX-regel end den aktive folder-regel

## 7. Hvordan manuale prisrettelser virker

Det er sikkert at rette priser manuelt i admin når final pricing gennemgås.

Men:
- manuelle publicerede priser bliver overskrevet af en senere import for samme produkt
- storefront læser kun publiceret `pricing_structure` + `generic_product_prices`
- der er ingen separat beskyttelses-layer for manuelle overrides endnu

Praktisk workflow:
1. gør supplier/source audit færdig
2. få mapping og import-regel på plads
3. lav derefter manuel final pricing i admin
4. undgå ny import for samme produkt bagefter, medmindre priser bevidst skal genberegnes

## 8. Ønske til næste forbedring

Der blev diskuteret et muligt nyt import-mode:
- behold eksisterende produktstruktur
- opret ikke nye grupper eller værdier
- opdater kun priser for kombinationer som allerede findes i pricing-systemet
- skip ukendte nye værdier og rapportér dem

Dette er ikke implementeret endnu, men det er en god næste forbedring for produkter der er i final pricing-fase.

Et godt navn kunne være:
- `--existing-structure-only`
eller
- `--price-only-refresh`

## 9. Nyttige filer fra denne session

- `.agent/HANDOVER.md`
- `docs/PRICING_HANDOFF_2026-04-16.md`
- `docs/PRICING_SYSTEM.md`
- `docs/PRICING_INGESTION_ARCHITECTURE.md`
- `scripts/fetch-folders-import.js`
- `scripts/product-import/shared/folders-matrix.js`
- `scripts/product-import/shared/matrix-publisher.js`
- `scripts/product-import/__tests__/shared-importers.test.js`

## 10. Startprompt til næste chatbot

Brug denne prompt i en ny chat:

```text
Read these files in order and get up to date before making changes:
1. POD2_README.md
2. AI_CONTINUITY.md
3. SYSTEM_OVERVIEW.md
4. .agent/HANDOVER.md
5. docs/PRICING_SYSTEM.md
6. docs/PRICING_INGESTION_ARCHITECTURE.md
7. docs/PRICING_HANDOFF_2026-04-16.md

Then summarize:
- current pricing importer architecture
- current folder pricing rule
- current new-folders status
- what has been fixed for 6/8/10-page Rullefalset
- what is still open

Do not change pricing rules or source mappings until you confirm the current live behavior first.
```

## 11. Kort version til hurtig bootstrap

Hvis man vil være endnu mere direkte, kan denne ene sætning bruges:

```text
Read POD2_README.md, AI_CONTINUITY.md, SYSTEM_OVERVIEW.md, .agent/HANDOVER.md, docs/PRICING_SYSTEM.md, docs/PRICING_INGESTION_ARCHITECTURE.md, and docs/PRICING_HANDOFF_2026-04-16.md, then summarize the current pricing/import state before touching anything.
```
