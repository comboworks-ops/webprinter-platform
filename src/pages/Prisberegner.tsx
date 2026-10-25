import { StorefrontContentPage } from "@/components/storefront/StorefrontContentPage";
import { useShopSettings } from "@/hooks/useShopSettings";
import Shop from "./Shop";

// This approved page belongs to Onlinetryksager; other shops keep their existing route.
const ONLINETRYKSAGER_TENANT_ID = "7cb851f5-c792-40b1-a79a-1f7c7b5f668c";

export default function Prisberegner() {
  const { data: settings } = useShopSettings();

  if (settings?.id !== ONLINETRYKSAGER_TENANT_ID) return <Shop />;

  return (
    <StorefrontContentPage mainClassName="flex-1 py-10 sm:py-14">
      <article className="container mx-auto max-w-5xl space-y-6 px-4 leading-relaxed [&_h1]:text-3xl [&_h1]:font-bold sm:[&_h1]:text-4xl [&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:text-xl [&_h3]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6">
        <h1>Priser på tryksager – vælg produkt og se din pris</h1>
        <p>Hvad koster dine tryksager? Start med at vælge flyers, blokke eller plakater. På produktsiden vælger du format, papir og antal og ser prisen på din konkrete kombination. Levering vises som et særskilt valg.</p>
        <h2>Vælg din tryksag</h2>
        <ul><li><strong>Flyers</strong> til kampagner, events og information. Vælg format, papir og tryk på én eller begge sider. <a href="https://www.onlinetryksager.dk/produkt/flyer-demand">Beregn pris på flyers</a>.</li><li><strong>Blokke</strong> til kontoret, mødet og messen. Vælg format, papir, sideantal, dækblad og limning. <a href="https://www.onlinetryksager.dk/produkt/blokke">Beregn pris på blokke</a>.</li><li><strong>Plakater</strong> til butikker, events og opslag. Vælg format, papir, antal og tryk. <a href="https://www.onlinetryksager.dk/produkt/standard-plakater">Beregn pris på plakater</a>.</li></ul>
        <h2>Priseksempler på flyers, blokke og plakater</h2>
        <p>Eksemplerne er kontrolleret den <strong>20. oktober 2026</strong>. Alle beløb er <strong>ekskl. moms</strong>, og standardlevering er valgt.</p>
        <div role="region" aria-label="Priseksempler" tabIndex={0} className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-left text-sm [&_th]:p-3 [&_td]:p-3 [&_tr]:border-b">
        <thead><tr><th scope="col">Produkt og specifikationer</th><th scope="col">Antal</th><th scope="col">Produktpris</th><th scope="col">Standardlevering</th><th scope="col">I alt ekskl. moms</th></tr></thead>
        <tbody><tr><td>Flyers: A5, tryk på én side (4+0), 130 g blankt papir</td><td>50 stk.</td><td>111 kr.</td><td>49 kr.</td><td>160 kr.</td></tr><tr><td>Blokke: A6, 25 sider, 80 g naturligt hvidt offsetpapir, uden dækblad, limning i top</td><td>10 blokke</td><td>194 kr.</td><td>49 kr.</td><td>243 kr.</td></tr><tr><td>Plakater: A3, 4+0, 135 g mat papir</td><td>10 stk.</td><td>157 kr.</td><td>49 kr.</td><td>206 kr.</td></tr></tbody>
        </table>
        </div>
        <p>Priser og leveringsvalg kan ændre sig. Eksemplerne gælder de viste konfigurationer og er ikke generelle fra-priser. Se den aktuelle pris på produktsiden, og kontrollér moms, levering og det endelige beløb, før du bestiller.</p>
        <h2>Hvad påvirker prisen på tryksager?</h2>
        <p>Format, papir og oplag er centrale valg. For flyers og plakater vælger du også tryk; for blokke spiller blandt andet sideantal og dækblad ind.</p>
        <p>Sammenlign samme specifikationer, når du vurderer to priser. Husk også at skelne mellem antallet af blokke og antallet af sider i hver blok. Se både produktpris og levering, så du sammenligner hele bestillingen.</p>
        <h2>Sådan går du fra pris til bestilling</h2>
        <ol><li>Åbn den tryksag, du vil bestille.</li><li>Vælg format, papir, antal og de øvrige produktvalg.</li><li>Gennemgå konfiguration, levering og samlet pris.</li><li>Fortsæt på produktsiden med din trykfil.</li></ol>
        <h2>Spørgsmål om pris, levering og trykfiler</h2>
        <h3>Er moms og levering med i eksemplerne?</h3>
        <p>Tabellen viser produktpris, standardlevering og samlet pris hver for sig. Alle beløb er ekskl. moms. Kontrollér altid moms og leveringsomkostning for din konkrete bestilling.</p>
        <h3>Hvornår kan mine tryksager leveres?</h3>
        <p>Se de aktuelle leveringsvalg, frister og datoer på produktsiden. Har du en bestemt deadline, kan du kontakte os, før du bestiller.</p>
        <h3>Hvordan gør jeg min trykfil klar?</h3>
        <p>Følg produktets mål og skabelon, og kontrollér beskæring, sikker afstand, billedkvalitet og PDF. <a href="https://www.onlinetryksager.dk/grafisk-vejledning">Se den grafiske vejledning</a>.</p>
        <p>Har du brug for hjælp til dit projekt? <a href="https://www.onlinetryksager.dk/kontakt">Kontakt os</a>, ring på <a href="tel:71991110">71 99 11 10</a>, eller skriv til <a href="mailto:support@onlinetryksager.dk">support@onlinetryksager.dk</a>.</p>
      </article>
    </StorefrontContentPage>
  );
}
