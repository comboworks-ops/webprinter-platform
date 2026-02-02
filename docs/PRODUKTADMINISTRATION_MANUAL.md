# Webprinter Platform - Produktadministration Manual

**Version:** 1.0  
**Sidst opdateret:** 6. januar 2026  

---

## Indholdsfortegnelse

1. [Oversigt](#oversigt)
2. [Tab: Detaljer (Produktdetaljer)](#tab-detaljer)
3. [Tab: Priser](#tab-priser)
4. [Tab: Valgmuligheder](#tab-valgmuligheder)
5. [Tab: Felter (Custom Fields)](#tab-felter)
6. [Tab: Format & Preflight](#tab-format--preflight)
7. [Tab: Maskin-beregning (MPA)](#tab-maskin-beregning-mpa)
8. [Tab: Tooltips](#tab-tooltips)
9. [Tab: Om (About)](#tab-om)
10. [Logik & Beregningsflow](#logik--beregningsflow)

---

## Oversigt

Produktadministrationen er hjertet i Webprinter-platformen. Her kan du konfigurere alle aspekter af et produkt:

- **Hvad produktet hedder og ser ud** (Detaljer)
- **Hvad det koster** (Priser + Maskin-beregning)
- **Hvilke valg kunden kan træffe** (Valgmuligheder)
- **Specielle input-felter** (Felter)
- **Tekniske print-specifikationer** (Format & Preflight)
- **Hjælpetekster** (Tooltips)
- **Uddybende produktinformation** (Om)

Produktsiden er organiseret i **8 tabs**, hver med sit fokusområde.

---

## Tab: Detaljer

### Formål
Grundlæggende produktinformation der vises på forsiden og i produktoversigten.

### Felter

| Felt | Beskrivelse |
|------|-------------|
| **Produktnavn** | Det navn kunden ser i shoppen (f.eks. "Flyers", "Visitkort") |
| **Beskrivelse** | Kort introduktionstekst der vises under produktnavnet |
| **Produktbillede** | Thumbnail-billede til produktoversigten (upload JPG/PNG) |
| **Farveprofil (ICC)** | Hvilket farverum designeren skal bruge til soft-proofing |

### Logik

1. **Produktnavn** bruges som overskrift på produktsiden og i navigation
2. **Beskrivelse** vises både i produktgrid og som intro på produktsiden
3. **Farveprofil** kobles til Designeren - når kunden åbner "Design online", aktiveres denne profil for CMYK-simulering

### Tip
> Vælg en ICC-profil der matcher din trykmaskines output (f.eks. FOGRA39 til coated offset, FOGRA47 til ucoated).

---

## Tab: Priser

### Formål
Administrer produktets prisstruktur. Understøtter flere prismodeller afhængigt af produkttype.

### Prismodeller

| Type | Beskrivelse | Eksempel |
|------|-------------|----------|
| **Matrix** | Faste priser i en tabel (format × antal) | Flyers: A4 × 500 stk = 299 kr |
| **Takst (Rate)** | Pris per kvadratmeter | Bannere: 89 kr/m² |
| **Formel** | Basispris + pris per enhed | Hæfter: 150 kr + 2,50 kr/side |
| **Fast pris** | Én pris uanset konfiguration | Logo-design: 599 kr |
| **Maskin-beregning** | Dynamisk pris fra MPA-motor | Se "Maskin-beregning" tab |

### Kolonner i pris-tabellen

Afhængigt af produkttype ses forskellige kolonner:

| Kolonne | Produkter | Formål |
|---------|-----------|--------|
| **Format** | Flyers, Foldere, Hæfter, Plakater | A4, A5, DL, etc. |
| **Papir** | Flyers, Foldere, Visitkort | 170g silk, 300g mat, etc. |
| **Materiale** | Klistermærker, Skilte, Bannere | Vinyl, Folie, PVC |
| **Falsetype** | Foldere | Enkelt, Zigzag, Rullet |
| **Antal sider** | Hæfter | 8, 12, 16, 24, etc. |
| **Størrelse** | Beachflag | S, M, L, XL |
| **Antal** | Alle | Antal eksemplarer |
| **Pris (DKK)** | Alle | Salgspris ekskl. moms |
| **Listepris** | Flyers | "Før-pris" til overstreget visning |
| **Rabat %** | Skilte, Bannere | Mængderabat ved større arealer |
| **Pris per enhed** | Hæfter, Salgsmapper | Tillæg per ekstra side |

### Funktioner

- **Tilføj ny pris**: Opret ny prisrække manuelt
- **CSV Import**: Bulk-import priser fra regneark
- **CSV Export**: Eksporter alle priser til backup/redigering
- **Hierarki-filter**: Filtrer på format, papir, materiale
- **Gem alle priser**: Batch-gem ændringer

### Logik

1. Prisrækkerne filtreres baseret på kundens valg
2. Ved bestilling vælges den eksakte række der matcher (format + papir + antal)
3. Listepris (hvis angivet) vises som "før-pris" med overstregning
4. Rabat % beregnes automatisk ved større arealer (for m²-produkter)

---

## Tab: Valgmuligheder

### Formål
Opret tilkøb og varianter som kunden kan vælge på produktsiden. F.eks. laminering, layout-hjælp, haster-produktion.

### Begreber

| Begreb | Beskrivelse |
|--------|-------------|
| **Gruppe** | En samling af relaterede valgmuligheder (f.eks. "Efterbehandling") |
| **Valgmulighed** | Et konkret valg kunden kan træffe (f.eks. "Mat laminering") |
| **Pris-mode** | Hvordan ekstraprisen beregnes |
| **Display type** | Hvordan valgmulighederne vises (dropdown, radio, checkboxes) |

### Gruppe-indstillinger

| Felt | Beskrivelse |
|------|-------------|
| **Navn** | Internt navn (f.eks. `finishing`) |
| **Label** | Hvad kunden ser (f.eks. "Efterbehandling") |
| **Visningstype** | `dropdown` / `radio` / `checkbox` |
| **Beskrivelse** | Hjælpetekst til gruppen |

### Valgmulighed-indstillinger

| Felt | Beskrivelse |
|------|-------------|
| **Navn** | Internt navn (f.eks. `mat_laminering`) |
| **Label** | Hvad kunden ser (f.eks. "Mat laminering") |
| **Beskrivelse** | Ekstra forklaring |
| **Ikon** | Upload lille ikon (valgfrit) |
| **Ekstrapris** | Tillæg i DKK |
| **Pris-mode** | Se nedenfor |
| **Sorteringsorden** | Rækkefølge i listen |

### Pris-modes

| Mode | Beregning | Eksempel |
|------|-----------|----------|
| **Fixed** | Fast tillæg uanset antal | +50 kr for layout-tjek |
| **Per quantity** | Tillæg × antal | +0,50 kr/stk for laminering |
| **Per area** | Tillæg × m² | +15 kr/m² for UV-lak |

### Logik

1. Valgmulighederne vises på produktsiden i den definerede rækkefølge
2. Ved valg beregnes ekstrapris baseret på pris-mode
3. Samlet ekstrapris lægges til bundpris
4. Valgte optioner gemmes med ordren til produktion

---

## Tab: Felter

### Formål
Definer specielle input-felter som kunden skal/kan udfylde. F.eks. "Antal sider i PDF", "Ønske om korrektur".

### Felttyper

| Type | Beskrivelse | Eksempel |
|------|-------------|----------|
| **Number** | Numerisk input | "Antal sider" (1-100) |
| **Boolean** | Ja/Nej toggle | "Jeg ønsker korrektur" |

### Felt-indstillinger

| Felt | Beskrivelse |
|------|-------------|
| **Feltnavn** | Internt navn (f.eks. `page_count`) |
| **Label** | Hvad kunden ser (f.eks. "Antal sider") |
| **Type** | `number` eller `boolean` |
| **Påkrævet** | Om feltet skal udfyldes før bestilling |
| **Standardværdi** | Forvalgt værdi |

### Logik

1. Felterne vises på produktsiden under prisvalg
2. Påkrævede felter blokerer checkout indtil udfyldt
3. Feltværdier gemmes med ordren og vises i admin-ordrevisning
4. Number-felter kan bruges i prisberegningsformler (MPA)

---

## Tab: Format & Preflight

### Formål
Definer produktets fysiske dimensioner og preflight-regler for fil-validering.

### Felter

| Felt | Beskrivelse | Standard |
|------|-------------|----------|
| **Vælg Format** | Foruddefineret format (A4, A5, DL, etc.) | - |
| **Bredde (mm)** | Slutformatets bredde | - |
| **Højde (mm)** | Slutformatets højde | - |
| **Bleed (mm)** | Beskæringsmargen uden for formatet | 3 mm |
| **Min. DPI** | Minimum opløsning for billeder | 300 |
| **Fri format** | Tillad kundevalgt størrelse | Nej |

### Logik

1. **Format-valg**: Vælg standard (A4, A5, etc.) eller indtast manuelt
2. **Bleed**: Definerer "overflow"-område - billeder skal gå ud i bleed for at undgå hvid kant
3. **Min. DPI**: Bruges af Preflight-systemet til at advare ved lavopløselige billeder
4. **Fri format**: Når aktiveret kan kunden selv indtaste dimensioner

### Preflight-regler

Når kunden uploader filer eller bruger Designeren, valideres:

| Regel | Beskrivelse | Handling |
|-------|-------------|----------|
| **DPI < 96** | Kritisk lav opløsning | 🔴 Fejl - blokerer |
| **DPI < 150** | Lav opløsning | 🟡 Advarsel |
| **DPI < 300** | Under optimal | 🟡 Info |
| **Billede nær kant** | Ikke i bleed & ikke i safe zone | 🟡 Advarsel |
| **Tekst i beskæring** | Tekst uden for safe zone | 🟡 Advarsel |

### Live Preview

En visuel forhåndsvisning viser:
- Hvid boks = Slutformat
- Rød stiplet linje = Beskæringslinje (bleed)
- Teksten "Design Zone" = Sikkert område

---

## Tab: Maskin-beregning (MPA)

### Formål
Avanceret prisberegning baseret på maskiner, materialer, blæk og avance. Bruges til storformat, specialprodukter og komplekse beregninger.

### Metode-valg

| Metode | Beskrivelse |
|--------|-------------|
| **Matrix** | Brug standard pris-tabel (fra Priser-tab) |
| **Maskin (MPA)** | Dynamisk beregning fra MPA-motoren |

### MPA-konfiguration

#### Profil-opsætning

| Felt | Beskrivelse |
|------|-------------|
| **Pris-profil** | Kombination af maskine + blæksæt |
| **Margin-profil** | Avancetrin baseret på mængde |

#### Pris-profil indeholder:
- Maskine (hastighed, timepris, arkstørrelse)
- Blæksæt (ml/m², pris per ml)
- Standardindstillinger

#### Margin-profil indeholder:
- Avancetrin (f.eks. 1-10 stk: 80%, 11-100 stk: 60%, 100+ stk: 40%)
- Afrundingsregler (nærmeste 5 kr, 10 kr, etc.)

### Tryk-sider

| Valg | Betydning |
|------|-----------|
| **Kun 4+0** | Kun enkeltsidettryk |
| **Kun 4+4** | Kun dobbeltsidettryk |
| **Valgfrit** | Kunden vælger på produktsiden |

### Produktions-parametre

| Felt | Beskrivelse |
|------|-------------|
| **Beskæring (bleed) mm** | Tillæg til formatet for beskæring |
| **Mellemrum (gap) mm** | Afstand mellem emner på ark |
| **Tilgængelige materialer** | Hvilke materialer kunden kan vælge |
| **Tilgængelige færdiggørelser** | Hvilke finish-optioner der tilbydes |
| **Mængder** | De antal kunden kan vælge (f.eks. 50, 100, 250, 500) |

### Numerering (valgfrit)

Tillad fortløbende nummerering på tryksager:

| Felt | Beskrivelse |
|------|-------------|
| **Opstarts-gebyr** | Engangs setup-pris |
| **Pris pr. enhed** | Tillæg per stk. |
| **Antal positioner** | Hvor mange numre per emne |

### Størrelses-presets

Definer faste størrelser kunden kan vælge:

| Felt | Beskrivelse |
|------|-------------|
| **Navn** | Visningsnavn (f.eks. "A4") |
| **Bredde** | Bredde i mm |
| **Højde** | Højde i mm |

### Beregningslogik

MPA-motoren beregner pris i følgende trin:

```
1. Beregn emne-størrelse med bleed
   → emne_bredde = format_bredde + (bleed × 2)
   → emne_højde = format_højde + (bleed × 2)

2. Beregn imposition (emner per ark)
   → ark_bredde / (emne_bredde + gap)
   → ark_højde / (emne_højde + gap)
   → emner_per_ark = kolonner × rækker

3. Beregn antal ark + spild
   → ark_behov = antal / emner_per_ark
   → inkluder waste (typisk 2-5%)

4. Beregn materialeomkostning
   → ark_behov × ark_størrelse_m² × pris_per_m²

5. Beregn blækomkostning
   → total_m² × ml_per_m² × pris_per_ml

6. Beregn maskintid
   → ark_behov / ark_per_time × timepris

7. Beregn finish-omkostninger
   → sum af valgte finish × enheder

8. Samlet kostpris
   → materiale + blæk + maskintid + finish

9. Anvend margin
   → find margin-tier baseret på antal
   → salgspris = kostpris × (1 + margin%)

10. Afrund
    → til nærmeste prisskridt (f.eks. 5 kr)
```

---

## Tab: Tooltips

### Formål
Definer hjælpetekster der vises som "hover-tips" på produktsiden.

### Felter

| Felt | Vises ved | Eksempel |
|------|-----------|----------|
| **Produkt tooltip** | Produktkortet | "Klik for at se priser og bestille" |
| **Pris tooltip** | Prisvisningen | "Pris ekskl. moms og levering" |
| **Quick-tilbud tooltip** | Quick-tilbud knap | "Få et hurtigt tilbud på dette produkt" |

### Logik

1. Tooltips vises når kunden holder musen over elementet
2. Tomme felter = ingen tooltip
3. Bruges til at forklare særlige forhold (f.eks. "Pris ved 4+0 tryk")

---

## Tab: Om

### Formål
Uddybende produktinformation der vises nederst på produktsiden.

### Felter

| Felt | Beskrivelse |
|------|-------------|
| **Overskrift** | Sektion-titel (f.eks. "Om vores flyers") |
| **Beskrivelse** | Længere tekst med produktinfo |
| **Billede** | Illustration til sektionen |
| **Skabelon-filer** | Downloadbare templates (AI, PDF, INDD) |

### Logik

1. "Om"-sektionen vises under prisvalg
2. Skabelon-filer tilbydes som genvej til grafisk forberedelse
3. God plads til SEO-venligt indhold

---

## Logik & Beregningsflow

### Prisberegning - Samlet flow

```
Kundens valg                    Systemet beregner
─────────────────              ─────────────────────
Format: A4                      → Find prisrække
Papir: 170g silk               → Match format + papir
Antal: 500                     → Match antal
Efterbehandling: Mat lam.      → + ekstrapris (per qty)
Haster: Ja                     → + ekstrapris (fixed)
                               ─────────────────────
                               = Totalpris
```

### Prisberegning - MPA flow

```
Konfiguration                   Beregning
─────────────────              ─────────────────────
Format: 210×297                 → Imposition: 8/ark
Materiale: 130g silk           → 62.50 ark behov
Antal: 500                     → 23.05 kr materiale
Finish: Mat lam.               → 8.25 kr blæk
                               → 31.25 kr maskintid
                               → 25.00 kr finish
                               ─────────────────────
                               = 87.55 kr kostpris
                               × 1.65 (margin tier)
                               ─────────────────────
                               = 145 kr salgspris
```

### Preflight - Validerings-flow

```
Upload/Design                   Tjek
─────────────────              ─────────────────────
Billede importeres             → Beregn DPI ved output størrelse
                               → < 96: FEJL
                               → < 150: Advarsel
                               → < 300: Info
                               
Placering                       → Check: inden for bleed?
                               → Check: inden for safe zone?
                               → Delvist udenfor: Advarsel
```

---

## Appendix: Database-tabeller

| Tabel | Formål |
|-------|--------|
| `products` | Grundlæggende produktdata |
| `generic_product_prices` | Generiske prisrækker |
| `print_flyers` | Flyer-specifikke priser |
| `folder_prices` | Folder-priser |
| `visitkort_prices` | Visitkort-priser |
| `option_groups` | Valgmuligheds-grupper |
| `product_options` | Valgmuligheder |
| `custom_product_fields` | Felter |
| `product_pricing_configs` | MPA-konfiguration |
| `pricing_profiles` | Pris-profiler (maskine + blæk) |
| `margin_profiles` | Avance-profiler |
| `margin_profile_tiers` | Avance-trin |
| `machines` | Maskinedata |
| `ink_sets` | Blæksæt |
| `materials` | Materialer |
| `finish_options` | Færdiggørelser |

---

**Dokumentet er sidst opdateret:** 6. januar 2026

*For teknisk support, kontakt platform-administrator.*
