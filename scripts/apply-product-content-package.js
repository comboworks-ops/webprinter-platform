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
  onlinetryksager: '7cb851f5-c792-40b1-a79a-1f7c7b5f668c',
  salgsmapper: '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba',
};

const UPDATED_AT = '2026-05-12';
const SOURCE_NOTE =
  'AI Danish rewrite from fetched supplier product context, adjusted toward Danish webshop product-page style.';

const products = [
  {
    tenant: 'salgsmapper',
    slug: 'salgsmapper-med-kachering',
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
    slug: 'salgsmapper-med-uv-lak',
    description:
      'Salgsmapper med højglans UV-lak giver et markant og slidstærkt udtryk til tilbud, præsentationer og salgsmateriale.',
    about_title: 'Salgsmapper med UV-lak',
    about_description: `Salgsmapper med UV-lak har en blank og mere beskyttende overflade, som får designet til at virke skarpere og mere levende. Det er et godt valg, når mappen skal skille sig ud og samtidig kunne tåle at blive brugt igen og igen.

Den blanke lak fungerer særligt godt til mapper med stærke farver, billeder, mørke flader eller et design, hvor du gerne vil have ekstra dybde i trykket. Resultatet er en præsentationsmappe med et mere poleret look, uden at den bliver besværlig at bruge i den daglige salgsproces.

Mapperne egner sig til tilbud, kataloger, brochurer, kontrakter, messemateriale og kundemapper. Du kan typisk vælge mellem forskellige formater, papirtyper og tryk på én eller begge sider, så mappen passer til både indholdet og den måde, den skal præsenteres på.

Sørg for at bruge den rigtige skabelon til formatet, så logo, billeder, tekster og foldelinjer ligger korrekt. Så får du en mappe, der både ser professionel ud og fungerer praktisk, når materialet skal afleveres til kunden.`,
  },
  {
    tenant: 'salgsmapper',
    slug: 'salgsmapper-med-uv-spotlak',
    description:
      'Salgsmapper med UV spotlak fremhæver udvalgte detaljer som logo, mønstre eller billeder med en eksklusiv blank effekt.',
    about_title: 'Salgsmapper med UV spotlak',
    about_description: `Salgsmapper med UV spotlak er en elegant løsning, når du vil give bestemte dele af designet ekstra opmærksomhed. I stedet for at gøre hele overfladen blank kan spotlakken placeres på logo, grafiske detaljer, billeder eller mønstre, så der opstår en flot kontrast mellem mat og blank.

Effekten er diskret, men tydelig, og den passer godt til virksomheder, der vil have en mere gennemarbejdet præsentationsmappe uden at gøre designet for tungt. Den fungerer især godt på mørke flader, enkle layouts og designs med tydelige branddetaljer.

Mapperne kan bruges til salgsmateriale, tilbud, præsentationer, konferencer, onboarding og kundemøder. Spotlakken giver mappen et mere eksklusivt præg, samtidig med at den stadig er praktisk til papirer, brochurer og andet trykt materiale.

Når du laver filen, skal spotlakken normalt leveres som et separat lag eller en tydeligt defineret specialfarve i trykfilen. På den måde rammer lakken præcist de elementer, der skal fremhæves.`,
  },
  {
    tenant: 'salgsmapper',
    slug: 'visit-card',
    description:
      'Visitkort med tryk i klassisk 85 x 55 mm format - vælg mellem mat karton, premium naturkarton, genbrugskarton eller brunt kraftpap.',
    about_title: 'Visitkort med tryk',
    about_description: `Visitkort er stadig en af de nemmeste måder at efterlade et professionelt indtryk på. De er små, direkte og praktiske, men de siger meget om virksomheden, når papir, layout og farver føles rigtige.

Her kan du lave visitkort i klassisk format med tryk på den ene eller begge sider. Vælg en enkel mat karton til et rent og moderne udtryk, en mere eksklusiv naturkarton til et blødere premium look, genbrugskarton til en mere ansvarlig profil eller brunt kraftpap, hvis kortet gerne må have en mere rå og taktil karakter.

Visitkortene passer til medarbejdere, messer, netværksmøder, pakker, gavekort, loyalitetskort og små informationskort. De kan holdes helt minimalistiske med navn og kontaktdata eller bruges mere aktivt med QR-kode, kort budskab, ikoner og grafiske elementer.

Upload en trykklar fil med god kontrast og nok luft omkring kanterne. Små detaljer betyder meget på et visitkort, så hold teksten læsbar og placer logo og kontaktdata, så kortet er nemt at afkode på få sekunder.`,
  },
  {
    tenant: 'salgsmapper',
    slug: 'blokke',
    description:
      'Blokke uden dækblad med tryk på arkene - praktiske til møder, tilbud, noter og daglig branding.',
    about_title: 'Blokke uden dækblad',
    about_description: `Blokke uden dækblad er en enkel og brugbar tryksag, som hurtigt bliver en fast del af hverdagen. De fungerer godt til møder, kundebesøg, kurser, receptioner og kontorer, hvor der altid skal være papir ved hånden.

Du kan bruge blokkene til logo, kontaktoplysninger, små budskaber, linjer, felter eller diskret grafik. Det giver en rolig form for branding, fordi blokken bliver brugt igen og igen uden at føles som reklame.

Blokkene kan laves i forskellige formater og sideantal, så de passer til alt fra korte mødenoter til mere fyldige arbejdsblokke. Uden dækblad får du en mere direkte og prisvenlig løsning, hvor fokus er på selve skrivefladen.

Hold designet rent og praktisk. Giv plads til noter, sørg for god kontrast, og lad logo og kontaktdata ligge diskret, så blokken er behagelig at bruge i praksis.`,
  },
  {
    tenant: 'salgsmapper',
    slug: 'blokke-2',
    description:
      'Blokke med tryk til kontor, events og kundemøder - en enkel måde at gøre hverdagsmateriale mere professionelt.',
    about_title: 'Blokke med tryk',
    about_description: `Blokke med tryk er oplagte, når du vil kombinere noget praktisk med en rolig form for branding. De kan bruges på kontoret, til kundemøder, messer, kurser, workshops og som en del af salgsmateriale.

Designet kan være helt enkelt med logo og kontaktdata eller mere funktionelt med linjer, afkrydsningsfelter, mødenoter, små beskeder eller grafiske brandelementer. Det vigtigste er, at blokken stadig er nem at skrive på og ikke bliver for tung i udtrykket.

Du kan vælge format og opbygning efter behov, så blokken passer til den måde, den skal bruges på. Mindre formater er gode til korte noter og uddeling, mens større formater giver mere plads til skitser, dagsordener og mødenotater.

En god blok føles ikke som pynt. Den bliver brugt. Derfor er det værd at lave et design, der både ser professionelt ud og fungerer i en travl hverdag.`,
  },
  {
    tenant: 'onlinetryksager',
    slug: 'blokke',
    description:
      'Blokke med tryk til møder, kontor og events - praktiske skriveblokke med logo, budskab og en professionel finish.',
    about_title: 'Blokke med tryk',
    about_description: `Blokke med tryk er en af de tryksager, der bliver brugt igen og igen. De passer perfekt til kontoret, kundemøder, messer, kurser, konferencer og som en del af en velkomstpakke eller præsentationsmappe.

Du kan lave blokkene med logo, kontaktoplysninger, linjer, felter eller små grafiske elementer, så de både er praktiske og understøtter virksomhedens visuelle identitet. Et godt blokdesign er enkelt, overskueligt og behageligt at skrive på.

Vælg format og sideantal efter brugssituationen. Små blokke er nemme at dele ud, mens større blokke giver mere plads til noter, skitser og mødeoversigter. Uanset format får du en tryksag, der er nem at forstå og nem at bruge.

Hold gerne designet luftigt, så modtageren faktisk har lyst til at skrive på blokken. Logo og farver må gerne være tydelige, men skrivefladen skal stadig være hovedpersonen.`,
  },
  {
    tenant: 'onlinetryksager',
    slug: 'flyer-demand',
    description:
      'Flyers med tryk til kampagner, events og lokal markedsføring - en fleksibel tryksag med hurtig og tydelig kommunikation.',
    about_title: 'Flyers med tryk',
    about_description: `Flyers er et stærkt valg, når budskabet skal hurtigt ud og være nemt at tage med. De fungerer til kampagner, åbningstilbud, events, messer, take-away menuer, informationsark, produktlanceringer og lokal markedsføring.

Du kan holde flyeren helt enkel med et skarpt tilbud og en tydelig handling, eller du kan bruge den som en lille præsentation med billeder, tekst, priser og kontaktinfo. Det vigtigste er, at modtageren hurtigt forstår, hvad du tilbyder, og hvad næste skridt er.

Flyers kan laves i flere formater, papirkvaliteter og oplag, så de passer til både korte kampagner og mere gennemarbejdede præsentationer. Et lettere papir er oplagt til uddeling, mens en kraftigere kvalitet kan give et mere eksklusivt indtryk.

Brug klare overskrifter, god kontrast og en tydelig call-to-action. En flyer skal kunne afkodes på få sekunder, men stadig føles gennemtænkt nok til at repræsentere dit brand ordentligt.`,
  },
  {
    tenant: 'onlinetryksager',
    slug: 'standard-plakater',
    description:
      'Plakater med tryk i klare farver til kampagner, butikker, events og opslag - fra små oplag til større produktioner.',
    about_title: 'Plakater med tryk',
    about_description: `Plakater er oplagte, når dit budskab skal ses på afstand. De kan bruges i butikker, på kontorer, til events, messer, kampagner, menukort, opslagstavler, undervisning og udendørs information, afhængigt af papir og placering.

Et godt plakatdesign arbejder med tydelig kontrast, få stærke budskaber og billeder, der hurtigt fanger øjet. Plakaten skal ikke forklare alt. Den skal skabe opmærksomhed og gøre det nemt at forstå næste skridt.

Du kan vælge mellem forskellige formater og papirkvaliteter, alt efter om plakaten skal hænge kort tid, bruges til en kampagne eller være en del af en mere fast visuel løsning. Til udendørs brug bør design og materialevalg tænkes ekstra robust.

Upload en trykklar fil i høj opløsning, og sørg for at tekst og logo ikke ligger for tæt på kanten. Så får du en plakat, der står skarpt og virker professionel, både tæt på og på afstand.`,
  },
  {
    tenant: 'onlinetryksager',
    slug: 'standard-postcards',
    description:
      'Postkort med tryk til kampagner, invitationer, gavekort og direct mail - i solide papirkvaliteter med flot farvegengivelse.',
    about_title: 'Postkort med tryk',
    about_description: `Postkort er en enkel og personlig tryksag, som kan bruges til langt mere end feriepost. De fungerer godt til kampagner, invitationer, rabatkort, gavekort, takkekort, direct mail, produktkort og små informationskort.

Forsiden kan bruges til et stærkt billede, en kampagne eller et brandudtryk, mens bagsiden giver plads til tekst, adressefelt, QR-kode, kontaktinfo eller et kort budskab. Det gør postkortet nemt at bruge både som reklame, hilsen og praktisk informationskort.

Vælg papirkvalitet efter udtrykket. En kraftigere kvalitet føles mere solid, mens en enklere løsning kan være perfekt til større udsendelser. Postkort er især gode, når du vil have noget fysisk, der er hurtigt at forstå og nemt at gemme.

Hold budskabet kort, og brug et layout med god luft. Når postkortet er overskueligt, virker det mere professionelt og bliver lettere for modtageren at reagere på.`,
  },
];

const dryRun = process.argv.includes('--dry-run');

for (const entry of products) {
  const tenant_id = TENANTS[entry.tenant];
  if (!tenant_id) throw new Error(`Unknown tenant ${entry.tenant}`);

  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('id, tenant_id, slug, name, technical_specs')
    .eq('tenant_id', tenant_id)
    .eq('slug', entry.slug)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) {
    console.log(`MISS ${entry.tenant}/${entry.slug}`);
    continue;
  }

  const technical_specs = {
    ...(existing.technical_specs || {}),
    product_details_da: entry.about_description,
    product_details_source: SOURCE_NOTE,
    product_details_updated_at: UPDATED_AT,
  };

  const payload = {
    description: entry.description,
    about_title: entry.about_title,
    about_description: entry.about_description,
    technical_specs,
  };

  if (dryRun) {
    console.log(`DRY ${entry.tenant}/${entry.slug} -> ${existing.id}`);
    continue;
  }

  const { error: updateError } = await supabase
    .from('products')
    .update(payload)
    .eq('id', existing.id);

  if (updateError) throw updateError;
  console.log(`UPDATED ${entry.tenant}/${entry.slug} -> ${existing.id}`);
}
