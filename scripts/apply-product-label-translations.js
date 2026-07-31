import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase URL or key in environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TENANTS = {
  master: '00000000-0000-0000-0000-000000000000',
  onlinetryksager: '7cb851f5-c792-40b1-a79a-1f7c7b5f668c',
  salgsmapper: '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba',
};

const dryRun = process.argv.includes('--dry-run');
const PAGE_SIZE = 1000;

async function fetchAllRows(table, select, tenantIds) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in('tenant_id', tenantIds)
      .range(from, to);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const productTextUpdates = [
  {
    tenant: 'salgsmapper',
    slug: 'visit-card',
    name: 'Visitkort',
    description:
      'Visitkort med tryk i klassisk 85 x 55 mm format - vælg mellem mat karton, premium naturkarton, genbrugskarton eller brunt kraftpap.',
    about_description: `Visitkort er stadig en af de nemmeste måder at efterlade et professionelt indtryk på. De er små, direkte og praktiske, men de siger meget om virksomheden, når papir, layout og farver føles rigtige.

Her kan du lave visitkort i klassisk format med tryk på den ene eller begge sider. Vælg en enkel mat karton til et rent og moderne udtryk, en mere eksklusiv naturkarton til et blødere premium look, genbrugskarton til en mere ansvarlig profil eller brunt kraftpap, hvis kortet gerne må have en mere rå og taktil karakter.

Visitkortene passer til medarbejdere, messer, netværksmøder, pakker, gavekort, loyalitetskort og små informationskort. De kan holdes helt minimalistiske med navn og kontaktdata eller bruges mere aktivt med QR-kode, kort budskab, ikoner og grafiske elementer.

Upload en trykklar fil med god kontrast og nok luft omkring kanterne. Små detaljer betyder meget på et visitkort, så hold teksten læsbar og placer logo og kontaktdata, så kortet er nemt at afkode på få sekunder.`,
  },
  {
    tenant: 'salgsmapper',
    slug: 'blokke',
    name: 'Blokke',
  },
  {
    tenant: 'salgsmapper',
    slug: 'salgsmapper-med-kachering',
    name: 'Salgsmapper med laminering',
    description:
      'Salgsmapper med laminering giver en stærkere og mere eksklusiv overflade, der beskytter trykket og får farverne til at stå skarpt.',
    about_title: 'Salgsmapper med laminering',
    about_description: `Salgsmapper med laminering er til dig, der vil have en mappe, som føles mere gennemført i hånden og holder sig pænere i brug. Laminering betyder, at der lægges en tynd folie oven på trykket, så overfladen bliver mere robust, og farverne får et mere færdigt udtryk.

Du kan bruge mapperne til tilbud, præsentationer, messer, salgsmateriale, velkomstmapper og alle de situationer, hvor papiret gerne må føles lidt mere professionelt. Mat folie giver et roligt og eksklusivt look, blank folie gør farverne mere levende, og softfeel giver en blød, premium overflade.

Mapperne kan laves i flere formater og papirkvaliteter, typisk med tryk på ydersiden eller både indvendigt og udvendigt. Det gør det nemt at matche mappen med resten af dit brand, uanset om du vil have et enkelt, rent udtryk eller en mere visuel præsentationsmappe.

Upload en trykklar fil med logo, farver og eventuelle grafiske elementer placeret, så fals, lommer og flap passer til skabelonen. Så får du en salgsmappe, der er nem at bruge i hverdagen og samtidig løfter præsentationen markant.`,
  },
  {
    tenant: 'salgsmapper',
    slug: 'salgsmapper-med-uv-spotlak',
    name: 'Salgsmapper med UV spotlak',
  },
  {
    tenant: 'onlinetryksager',
    slug: 'standard-postcards',
    name: 'Postkort',
  },
  {
    tenant: 'onlinetryksager',
    slug: 'standard-plakater',
    name: 'Plakater',
  },
  {
    tenant: 'master',
    slug: 'salgsmapper-med-kachering',
    name: 'Salgsmapper med laminering',
    description: 'Salgsmapper med laminering - ekstra holdbar og flot overflade.',
  },
  {
    tenant: 'master',
    slug: 'salgsmapper-med-kachering-3-laschen',
    name: 'Salgsmapper med laminering og 3 lommer',
    description: 'Laminerede salgsmapper med 3 lommer - premium kvalitet.',
  },
];

const productTextReplacements = [
  {
    tenant: 'master',
    slug: 'visit-card',
    fields: ['about_description'],
    replacements: [['soft-touch kachering', 'soft-touch laminering']],
  },
  {
    tenant: 'master',
    slug: 'new-flyer-test',
    fields: ['description', 'about_description'],
    replacements: [
      ['UV-lak, kachering', 'UV-lak, laminering'],
      ['mat kachering', 'mat laminering'],
      ['gloss kachering', 'blank laminering'],
      ['Mat kachering', 'Mat laminering'],
      ['Gloss kachering', 'Blank laminering'],
    ],
  },
  {
    tenant: 'salgsmapper',
    slug: 'standard-sales-mapper-kopi-2',
    fields: ['about_description'],
    replacements: [
      ['Foliekachering', 'Folielaminering'],
      ['foliekachering', 'folielaminering'],
    ],
  },
  {
    tenant: 'master',
    slug: 'premium-rollups',
    fields: ['about_description'],
    replacements: [
      ['Fineart canvas-leinen', 'Fineart canvas-lærred'],
      ['polyester-gewebe', 'polyestertekstil'],
      ['tekstilgewebe', 'tekstil'],
    ],
  },
];

const groupTranslations = new Map([
  ['Motive', 'Antal motiver'],
  ['Kachering', 'Laminering'],
  ['Gloss Caching', 'Blank laminering'],
  ['Cover', 'Dækblad'],
  ['Pages', 'Antal sider'],
  ['Sheet size', 'Arkstørrelse'],
  ['Formatter', 'Format'],
  ['Lamination', 'Laminering'],
  ['Special finish - front', 'Specialfinish forside'],
  ['Special finish - back', 'Specialfinish bagside'],
  ['Production optimisation', 'Produktionsoptimering'],
  ['Crease lines parallel', 'Parallel big'],
  ['Parallel perforation', 'Parallel perforering'],
  ['Personalise (max. 1 design)', 'Personalisering'],
  ['Contour', 'Konturskæring'],
  ['Drill holes', 'Borehuller'],
  ['Rounded corners', 'Afrundede hjørner'],
  ['Pallet delivery', 'Pallelevering'],
  ['Sealed', 'Forsegling'],
  ['Urgency', 'Produktionstid'],
  ['Maximum weight boxes (see delivery costs)', 'Maks. kassevægt'],
  ['Standard bundle', 'Standardbundt'],
  ['Cross bundle', 'Krydsbundt'],
  ['Printing method', 'Trykmetode'],
  ['box_delivery', 'Kasselevering'],
]);

const valueTranslations = new Map([
  [
    '0,30 mm starkes Bilderdruckpapier matt 300g, einfache Steifigkeit',
    '300g mat billedtrykpapir, 0,30 mm - enkel stivhed',
  ],
  [
    '0,36 mm starkes Bilderdruckpapier 350g matt (zertifiziert mit FSC-Siegel), mittlere Steifigkeit',
    '350g mat billedtrykpapir, 0,36 mm - medium stivhed (FSC-certificeret)',
  ],
  [
    '0,40 mm starker Postkarten-Chromokarton 260g (Vorderseite: weiß, Rückseite: matt und beschreibbar), hohe Steifigkeit mit 1,4 fachem Volumen',
    '260g postkort-chromokarton, 0,40 mm - hvid forside, mat skrivbar bagside',
  ],
  [
    '0,46 mm starker Postkarten-Chromokarton 300g (Vorderseite: weiß, Rückseite: matt und beschreibbar), maximale Steifigkeit mit 1,4 fachem Volumen',
    '300g postkort-chromokarton, 0,46 mm - hvid forside, mat skrivbar bagside',
  ],
  [
    '0,54 mm starker Postkarten-Chromokarton 450g beidseitig matt, maximale Steifigkeit mit 1,2 fachem Volumen',
    '450g postkort-chromokarton, 0,54 mm - mat på begge sider',
  ],
  [
    '80g/qm Naturpapier weiß (beschreib- und bestempelbar, PEFC)',
    '80g naturpapir, hvidt - skrive- og stempelbart (PEFC)',
  ],
  [
    '120g/qm Naturpapier weiß (beschreib- und bestempelbar, PEFC)',
    '120g naturpapir, hvidt - skrive- og stempelbart (PEFC)',
  ],
  [
    '80g/qm Recyclingpapier weiß (1,25-faches Volumen, 100% recycling, Blauer Engel, PEFC)',
    '80g genbrugspapir, hvidt - 100% genbrug, ekstra volumen (Blauer Engel, PEFC)',
  ],
  ['350 g/m² hochwertiger Qualitätsdruck matt', '350g mat kvalitetskarton'],
  [
    '400 g/m² hochwertiger Qualitätsdruck auf Premium-Naturkarton Munken Polar hochweiß (1,13-faches Volumen, holzfrei, FSC-zertifiziert)',
    '400g premium naturkarton Munken Polar, højhvid - træfri og FSC-certificeret',
  ],
  ['300 g/m² hochwertiger Qualitätsdruck auf Recyclingkarton weiß', '300g genbrugskarton, hvid'],
  [
    '283 g/m² hochwertiger Qualitätsdruck auf Kraftkarton braun mit glatter Vorderseite',
    '283g brunt kraftpap med glat forside',
  ],
  [
    'Offset: 80g Qualitätsdruck auf Offsetpapier (beschreibbar, Inkjet- und Laserdruck geeignet)',
    'Offset: 80g kvalitetstryk på offsetpapir (skrivebart, egnet til inkjet og laserprint)',
  ],
  [
    'Naturpapier: 90 g/qm Offsetpapier weiß (Standard-Papier, Preprint, FSC-Zertifiziert, mit Laser- und Inkjet-Garantie)',
    'Naturpapir: 90g hvidt offsetpapir (standardpapir, preprint, FSC-certificeret og egnet til laser/inkjet)',
  ],
  [
    'Naturpapier: 120 g/qm Offsetpapier weiß (extra starkes Papier, Preprint, FSC-Zertifiziert, mit Laser- und Inkjet-Garantie)',
    'Naturpapir: 120g hvidt offsetpapir (ekstra kraftigt, preprint, FSC-certificeret og egnet til laser/inkjet)',
  ],
  ['Inhalt: 115 g/m² Bilderdruck matt', 'Indhold: 115g mat billedtrykpapir'],
  [
    '0,36 mm starker Bilderdruckkarton 350g matt für 5mm',
    '350g mat billedtrykskarton, 0,36 mm - til 5 mm ryg',
  ],
  [
    '0,40 mm starker Chromokarton 255g für 1mm Mappen-Füllhöhe',
    '255g chromokarton, 0,40 mm - til 1 mm fyldhøjde',
  ],
  [
    '0,36 mm starker Recyclingkarton 300g weiß für 1mm Mappen-Füllhöhe',
    '300g hvid genbrugskarton, 0,36 mm - til 1 mm fyldhøjde',
  ],
  [
    '0,36 mm starker Bilderdruckkarton 350g matt für 1mm Mappen-Füllhöhe (zertifiziert mit FSC-Siegel), mittlere Steifigkeit',
    '350g mat billedtrykskarton, 0,36 mm - til 1 mm fyldhøjde (FSC-certificeret), medium stivhed',
  ],
  [
    '0,36 mm starker Naturkarton 300g hochweiß für 5mm',
    '300g højhvid naturkarton, 0,36 mm - til 5 mm ryg',
  ],
  [
    'Hochwertiger Plattendirektdruck auf 3mm starker Hohlkammerplatte (Wellenstruktur) weiß',
    'Direktetryk i høj kvalitet på 3 mm hvid kanalplade (bølgestruktur)',
  ],
  [
    'Hochwertiger Plattendirektdruck auf 3mm starker Hohlkammerplatte mit 50% Recyclinganteil (Wellenstruktur)',
    'Direktetryk i høj kvalitet på 3 mm kanalplade med 50% genbrugsindhold (bølgestruktur)',
  ],
  [
    'Alle Roll-ups gleiches Motiv: Qualitätsdruck auf 135 g/m² PP-Film matt (PVC-frei) 4/0-farbig (Vorderseite: farbig / Rückseite: unbedruckt)',
    'Alle roll-ups med samme motiv: kvalitetstryk på 135g mat PP-film (PVC-fri), 4/0-farvet med utrykt bagside',
  ],
  [
    'Alle Roll-ups gleiches Motiv: Qualitätsdruck auf 510 g/m² Frontlit-PVC-Banner Budget (B1-zertifiziert - schwer entflammbar)',
    'Alle roll-ups med samme motiv: kvalitetstryk på 510g Frontlit PVC-banner Budget (B1-certificeret, brandhæmmende)',
  ],
  [
    'Alle Rollups gleiches Motiv: Qualitätsdruck auf 260 g/m² exklusivem Fineart-Canvas-Leinenstoff',
    'Alle roll-ups med samme motiv: kvalitetstryk på 260g eksklusivt Fineart canvas-lærred',
  ],
  [
    'Alle Rollups gleiches Motiv: Qualitätsdruck auf 195 g/m² STONE DISPLAY Rollup-Film mit Blockoutschicht und Sandstrahloberfläche',
    'Alle roll-ups med samme motiv: kvalitetstryk på 195g STONE DISPLAY roll-up-film med blockout og sandblæst overflade',
  ],
  [
    'Alle Rollups gleiches Motiv: Qualitätsdruck auf 300 g/m² Polyester-Gewebe mit blickdichter grauer Rückseite (B1 zertifiziert - schwer entflammbar)',
    'Alle roll-ups med samme motiv: kvalitetstryk på 300g polyestertekstil med uigennemsigtig grå bagside (B1-certificeret, brandhæmmende)',
  ],
  [
    'Alle Rollups gleiches Motiv: Qualitätsdruck auf 240 g/m² PP-Banner Rollup-Film, blickdicht, reißfest und PVC-frei (ideal geeignet für brillanten Farbdruck in höchster Qualität)',
    'Alle roll-ups med samme motiv: kvalitetstryk på 240g PP-banner roll-up-film, uigennemsigtig, rivefast og PVC-fri',
  ],
  [
    'Alle Rollups gleiches Motiv: Qualitätsdruck auf 510 g/m² Frontlit PVC-Banner (B1 zertifiziert - schwer entflammbar)',
    'Alle roll-ups med samme motiv: kvalitetstryk på 510g Frontlit PVC-banner (B1-certificeret, brandhæmmende)',
  ],
  [
    'Alle Rollups gleiches Motiv: Qualitätsdruck auf 250 g/m² hochwertigem Textilgewebe mit erstklassiger Bedruckbarkeit',
    'Alle roll-ups med samme motiv: kvalitetstryk på 250g kvalitetstekstil med flot trykflade',
  ],
  [
    'Jedes Rollup anderes Motiv: Qualitätsdruck auf 240 g/m² PP-Banner Rollup-Film, blickdicht, reißfest und PVC-frei (ideal geeignet für brillanten Farbdruck in höchster Qualität)',
    'Hver roll-up med forskelligt motiv: kvalitetstryk på 240g PP-banner roll-up-film, uigennemsigtig, rivefast og PVC-fri',
  ],
  [
    'Alle Rollups gleiches Motiv: Qualitätsdruck auf 180 g/m² PP-Banner Rollup-Film, blickdicht, reißfest und PVC-frei (ideal geeignet für brillanten Farbdruck in höchster Qualität)',
    'Alle roll-ups med samme motiv: kvalitetstryk på 180g PP-banner roll-up-film, uigennemsigtig, rivefast og PVC-fri',
  ],
  ['283g brun kraftkarton med glat forside', '283g brunt kraftpap med glat forside'],
  ['Chromokarton', 'Chromo-karton'],
  ['Chromo mappekarton', 'Chromo-karton til mapper'],
  ['350g Matsilk papir', '350g mat silk-papir'],
  ['300g Naturkarton', '300g naturkarton'],
  ['300g Genbrugskarton', '300g genbrugskarton'],
  ['130g gloss papir', '130g blankt papir'],
  ['170g gloss papir', '170g blankt papir'],
  ['250g gloss papir', '250g blankt papir'],
  ['135g matt', '135g mat papir'],
  ['120g Blueback', '120g blueback-plakatpapir'],
  ['170g Recycling', '170g genbrugspapir'],
  ['80g naturligt hvidt offset papir ( skrivebart )', '80g naturligt hvidt offsetpapir (skrivebart)'],
  ['120g Naturligt offset papir. ( Skrivebart )', '120g naturligt hvidt offsetpapir (skrivebart)'],
  ['80g 100% genbrugspapir ( skrivbart )', '80g 100% genbrugspapir (skrivebart)'],
  ['Mattfolie', 'Mat folie'],
  ['Glanzfolie', 'Blank folie'],
  ['Softfeel-Folie', 'Softfeel-folie'],
  ['Folienkaschiert', 'Folielamineret'],
  ['Ingen kachering', 'Ingen laminering'],
  ['A4 salgsmappe med Kachering', 'A4 salgsmappe med laminering'],
  ['A5 salgsmappe med Kachering', 'A5 salgsmappe med laminering'],
  ['A6 salgsmappe med Kachering', 'A6 salgsmappe med laminering'],
  ['DIN Lang salgsmappe med Kachering', 'DIN lang salgsmappe med laminering'],
  ['21x21 salgsmappe med Kachering', '21 x 21 salgsmappe med laminering'],
  ['A4 salgsmappe med Kachering 3-laschen', 'A4 salgsmappe med laminering 3-laschen'],
  ['A5 salgsmappe med Kachering 3-laschen', 'A5 salgsmappe med laminering 3-laschen'],
  ['A6 salgsmappe med Kachering 3-laschen', 'A6 salgsmappe med laminering 3-laschen'],
  ['DIN Lang salgsmappe med Kachering 3-laschen', 'DIN lang salgsmappe med laminering 3-laschen'],
  ['21x21 salgsmappe med Kachering 3-laschen', '21 x 21 salgsmappe med laminering 3-laschen'],
  ['DIN Lang salgsmappe med præg 3-laschen', 'DIN lang salgsmappe med præg 3-laschen'],
  ['21x21 salgsmappe med præg 3-laschen', '21 x 21 salgsmappe med præg 3-laschen'],
  ['DIN Lang salgsmappe 3-laschen', 'DIN lang salgsmappe 3-laschen'],
  ['21x21 salgsmappe 3-laschen', '21 x 21 salgsmappe 3-laschen'],
  ['A4 salgsmappe med UV lak', 'A4 salgsmappe med UV-lak'],
  ['A5 salgsmappe med UV lak', 'A5 salgsmappe med UV-lak'],
  ['A6 salgsmappe med UV lak', 'A6 salgsmappe med UV-lak'],
  ['DIN Lang salgsmappe med UV lak', 'DIN lang salgsmappe med UV-lak'],
  ['21x21 salgsmappe med UV lak', '21 x 21 salgsmappe med UV-lak'],
  ['A4 salgsmappe med UV Spotlak', 'A4 salgsmappe med UV spotlak'],
  ['A5 salgsmappe med UV Spotlak', 'A5 salgsmappe med UV spotlak'],
  ['A6 salgsmappe med UV Spotlak', 'A6 salgsmappe med UV spotlak'],
  ['DIN Lang salgsmappe med UV Spotlak', 'DIN lang salgsmappe med UV spotlak'],
  ['21x21 salgsmappe med UV Spotlak', '21 x 21 salgsmappe med UV spotlak'],
  ['DIN A6', 'A6'],
  ['DIN A5', 'A5'],
  ['DIN A4', 'A4'],
  ['DIN lang', 'M65 / DIN lang'],
  ['DIN Lang salgsmappe', 'DIN lang salgsmappe'],
  ['21x21 salgsmappe', '21 x 21 salgsmappe'],
  ['A6 105 × 148 mm', 'A6 - 105 x 148 mm'],
  ['A5 148 × 210 mm', 'A5 - 148 x 210 mm'],
  ['A4 210 × 297 mm', 'A4 - 210 x 297 mm'],
  ['M65 105 X 210mm', 'M65 - 105 x 210 mm'],
  ['Bottom', 'Bund'],
  ['Left', 'Venstre'],
  ['Right', 'Højre'],
  ['10 pages', '10 sider'],
  ['25 pages', '25 sider'],
  ['50 pages', '50 sider'],
  ['100 pages', '100 sider'],
  ['Cover', 'Med dækblad'],
  ['Uden cover', 'Uden dækblad'],
  ['HP Indigo digital', 'HP Indigo digitaltryk'],
  ['No', 'Nej'],
  ['no', 'Nej'],
  ['Box max weight 15 kg', 'Maks. 15 kg pr. kasse'],
  ['Do not seal', 'Ingen forsegling'],
  ['None', 'Ingen'],
  ['No perforation', 'Ingen perforering'],
  ['No creasing', 'Ingen big'],
  ['Do not allow', 'Tillad ikke'],
  ['Small indigo sheet', 'Lille Indigo-ark'],
  ['large indigo sheet', 'Stort Indigo-ark'],
  ['4+0 print på 1 side', '4+0 tryk på én side'],
  ['4+4 print på begge sider', '4+4 tryk på begge sider'],
]);

function translateValueName(name) {
  const exact = valueTranslations.get(name);
  if (exact) return exact;

  let translated = name;

  translated = translated.replace(
    /^(\d+)g hochwertiger Qualitätsdruck matt$/,
    '$1g mat kvalitetstryk',
  );
  translated = translated.replace(
    /^(\d+)g hochwertiger Qualitätsdruck glänzend$/,
    '$1g blankt kvalitetstryk',
  );
  translated = translated.replace(
    /^(\d+)g hochwertiger Qualitätsdruck$/,
    '$1g kvalitetstryk',
  );
  translated = translated.replace(/^(\d+) pages$/, '$1 sider');
  translated = translated.replace(/^DIN (A\d+)$/, '$1');
  translated = translated.replace(/^DIN Lang$/, 'M65 / DIN lang');
  translated = translated.replace(/^DIN Lang salgsmappe med UV lak 3-laschen$/, 'DIN lang salgsmappe med UV-lak 3-laschen');
  translated = translated.replace(/^21x21 salgsmappe med UV lak 3-laschen$/, '21 x 21 salgsmappe med UV-lak 3-laschen');
  translated = translated.replace(/^([A]\d) salgsmappe med UV lak 3-laschen$/, '$1 salgsmappe med UV-lak 3-laschen');
  translated = translated.replace(
    /^Recycling: (\d+)g Qualitätsdruck auf hochwertigem Recyclingpapier weiß$/,
    'Genbrug: $1g kvalitetstryk på hvidt genbrugspapir',
  );
  translated = translated.replace(
    /^Recycling: (\d+)g hochwertiger Qualitätsdruck auf Recyclingpapier weiß matt$/,
    'Genbrug: $1g mat kvalitetstryk på hvidt genbrugspapir',
  );
  translated = translated.replace(
    /^Recycling: (\d+)g hochwertiger Qualitätsdruck auf Recyclingkarton weiß matt$/,
    'Genbrug: $1g mat kvalitetstryk på hvidt genbrugskarton',
  );
  translated = translated.replace(
    /^(\d+)g Qualitätsdruck auf hochwertigem Recyclingpapier weiß$/,
    '$1g kvalitetstryk på hvidt genbrugspapir',
  );
  translated = translated.replace(
    /^(\d+)g Recyclingpapier weiß matt$/,
    '$1g mat hvidt genbrugspapir',
  );
  translated = translated.replace(
    /^Mat Kachering 1 side$/,
    'Mat laminering, 1 side',
  );
  translated = translated.replace(
    /^Gloss Kachering 1 side$/,
    'Blank laminering, 1 side',
  );
  translated = translated.replace(
    /^Mat Kachering 2 sider$/,
    'Mat laminering, 2 sider',
  );
  translated = translated.replace(
    /^Gloss Kachering 2 sider$/,
    'Blank laminering, 2 sider',
  );
  translated = translated.replace(
    /^Mat kachering front$/,
    'Mat laminering på forsiden',
  );
  translated = translated.replace(
    /^Mat kachering front og bag$/,
    'Mat laminering forside og bagside',
  );
  translated = translated.replace(
    /^Gloss kachering front$/,
    'Blank laminering på forsiden',
  );
  translated = translated.replace(
    /^Gloss kachering front og bag$/,
    'Blank laminering forside og bagside',
  );
  translated = translated.replace(
    /^0,40 mm starker Chromokarton 255g für 5mm$/,
    '255g chromokarton, 0,40 mm - til 5 mm ryg',
  );
  translated = translated.replace(
    /^0,36 mm starker Recyclingkarton 300g weiß$/,
    '300g hvid genbrugskarton, 0,36 mm',
  );
  translated = translated.replace(
    /^Bilderdruckkarton 350g$/,
    '350g billedtrykskarton',
  );
  translated = translated.replace(
    /^Chromokarton 255g$/,
    '255g chromokarton',
  );
  translated = translated.replace(
    /^Naturkarton 300g$/,
    '300g naturkarton',
  );
  translated = translated.replace(
    /^Recyclingkarton 300g$/,
    '300g genbrugskarton',
  );

  return translated === name ? null : translated;
}

async function updateProductTexts() {
  for (const entry of productTextUpdates) {
    const tenant_id = TENANTS[entry.tenant];
    const payload = Object.fromEntries(
      Object.entries(entry).filter(([key]) => !['tenant', 'slug'].includes(key)),
    );

    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('id, technical_specs')
      .eq('tenant_id', tenant_id)
      .eq('slug', entry.slug)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      console.log(`MISS product ${entry.tenant}/${entry.slug}`);
      continue;
    }

    if (entry.about_description) {
      payload.technical_specs = {
        ...(existing.technical_specs || {}),
        product_details_da: entry.about_description,
        product_details_updated_at: '2026-05-12',
      };
    }

    if (dryRun) {
      console.log(`DRY product ${entry.tenant}/${entry.slug} -> ${JSON.stringify(payload)}`);
      continue;
    }

    const { error } = await supabase.from('products').update(payload).eq('id', existing.id);
    if (error) throw error;
    console.log(`UPDATED product ${entry.tenant}/${entry.slug}`);
  }
}

async function updateProductTextReplacements() {
  for (const entry of productTextReplacements) {
    const tenant_id = TENANTS[entry.tenant];
    const selectFields = ['id', 'technical_specs', ...entry.fields].join(', ');

    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select(selectFields)
      .eq('tenant_id', tenant_id)
      .eq('slug', entry.slug)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      console.log(`MISS product replacement ${entry.tenant}/${entry.slug}`);
      continue;
    }

    const payload = {};

    for (const field of entry.fields) {
      let nextValue = existing[field];
      if (typeof nextValue !== 'string') continue;

      for (const [from, to] of entry.replacements) {
        nextValue = nextValue.split(from).join(to);
      }

      if (nextValue !== existing[field]) {
        payload[field] = nextValue;
      }
    }

    const productDetails = existing.technical_specs?.product_details_da;
    if (typeof productDetails === 'string') {
      let nextDetails = productDetails;
      for (const [from, to] of entry.replacements) {
        nextDetails = nextDetails.split(from).join(to);
      }

      if (nextDetails !== productDetails) {
        payload.technical_specs = {
          ...(existing.technical_specs || {}),
          product_details_da: nextDetails,
          product_details_updated_at: '2026-05-12',
        };
      }
    }

    if (Object.keys(payload).length === 0) continue;

    if (dryRun) {
      console.log(`DRY product text replacement ${entry.tenant}/${entry.slug} -> ${JSON.stringify(payload)}`);
      continue;
    }

    const { error } = await supabase.from('products').update(payload).eq('id', existing.id);
    if (error) throw error;
    console.log(`UPDATED product text replacement ${entry.tenant}/${entry.slug}`);
  }
}

async function updateGroups() {
  const tenantIds = Object.values(TENANTS);
  const data = await fetchAllRows(
    'product_attribute_groups',
    'id, tenant_id, product_id, name, products(slug)',
    tenantIds,
  );

  for (const group of data) {
    const translated = groupTranslations.get(group.name);
    if (!translated || translated === group.name) continue;

    if (dryRun) {
      console.log(`DRY group ${group.products?.slug}/${group.name} -> ${translated}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('product_attribute_groups')
      .update({ name: translated })
      .eq('id', group.id);

    if (updateError) throw updateError;
    console.log(`UPDATED group ${group.products?.slug}/${group.name} -> ${translated}`);
  }
}

async function updateValues() {
  const tenantIds = Object.values(TENANTS);
  const data = await fetchAllRows(
    'product_attribute_values',
    'id, tenant_id, product_id, name, products(slug), product_attribute_groups(name)',
    tenantIds,
  );

  for (const value of data) {
    const translated = translateValueName(value.name);
    if (!translated || translated === value.name) continue;

    if (dryRun) {
      console.log(
        `DRY value ${value.products?.slug}/${value.product_attribute_groups?.name}/${value.name} -> ${translated}`,
      );
      continue;
    }

    const { error: updateError } = await supabase
      .from('product_attribute_values')
      .update({ name: translated })
      .eq('id', value.id);

    if (updateError) throw updateError;
    console.log(
      `UPDATED value ${value.products?.slug}/${value.product_attribute_groups?.name}/${value.name} -> ${translated}`,
    );
  }
}

await updateProductTexts();
await updateProductTextReplacements();
await updateGroups();
await updateValues();
