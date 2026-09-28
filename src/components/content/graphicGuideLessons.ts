import { Crop, FileText, Image, Palette, Scan } from "lucide-react";

/** Educational examples only. Product templates own the actual print specification. */
export const graphicGuideLessons = [
  {
    id: "beskaering", label: "Beskæring", icon: Crop,
    title: "Lad baggrunden gå helt til kanten.",
    description: "Læg ekstra baggrund uden for skærelinjen, så du undgår hvide kanter.",
    image: "bleed-comparison.png",
    imageAlt: "Til venstre får flyeren en hvid kant. Til højre fortsætter baggrunden 3 mm uden for skærelinjen; det ekstra stykke skæres væk.",
    labels: ["Uden ekstra baggrund", "Med ekstra baggrund"],
    comparison: true,
    tips: [
      { title: "Uden for skærelinjen", text: "Lad billeder og baggrund fortsætte ud i bleed på alle fire sider." },
      { title: "Det ekstra skæres væk", text: "Skærelinjen viser det færdige format. Placér aldrig vigtig tekst i bleed." },
    ],
    note: "Illustreret eksempel: 3 mm bleed. Følg altid produktets skabelon og de angivne mål.",
  },
  {
    id: "sikkerhedsafstand", label: "Sikker afstand", icon: Scan,
    title: "Giv tekst og logo lidt luft til kanten.",
    description: "Hold vigtigt indhold inden for sikkerhedszonen, så det ikke bliver skåret af.",
    image: "safety-comparison.png",
    imageAlt: "Til venstre står teksten for tæt på kanten og bliver beskåret. Til højre ligger tekst og logo inden for den grønne sikkerhedszone, 3 mm inden for skærelinjen.",
    labels: ["For tæt på kanten", "God afstand til kanten"],
    comparison: true,
    tips: [
      { title: "3 mm indenfor", text: "I dette eksempel holdes tekst og logo mindst 3 mm inde fra skærelinjen på alle sider." },
      { title: "Baggrund må gå helt ud", text: "Kun vigtigt indhold skal holdes inde. Baggrund og billeder fortsætter ud i bleed." },
    ],
    note: "Designeren bruger som udgangspunkt 3 mm sikkerhedsafstand. Nogle produkter kræver mere; følg skabelonen. Illustrationen er ikke målfast.",
  },
  {
    id: "billedkvalitet", label: "Billedkvalitet", icon: Image,
    title: "Brug billeder, der også er skarpe på papir.",
    description: "Tjek billedet i den størrelse, det skal trykkes. Små billeder bliver uskarpe, når de forstørres.",
    image: "image-quality-comparison.png",
    imageAlt: "Det samme billede af en bygning: til venstre ses grove pixels i forstørrelsen; til højre står murværk og vinduer skarpt.",
    labels: ["For lav opløsning", "Skarpt til tryk"],
    comparison: true,
    tips: [
      { title: "Sigt efter 300 dpi", text: "Til almindelige tryksager gælder det ved den færdige størrelse. Brug den originale billedfil." },
      { title: "Bevar logoer som vektorer", text: "Vektorgrafik og tekst forbliver skarpt ved skalering. At ændre dpi-tallet alene giver ikke flere detaljer." },
    ],
    note: "Storformat kan have andre krav afhængigt af størrelse og betragtningsafstand. Se produktets filvejledning.",
  },
  {
    id: "farver", label: "Farver", icon: Palette,
    title: "Skærm og papir viser farver forskelligt.",
    description: "Skærmen lyser. Papiret reflekterer lys. Derfor kan farverne på tryk virke mere afdæmpede.",
    image: "color-comparison.png",
    imageAlt: "Samme farverige motiv på en RGB-skærm og et CMYK-tryk. Skærmen viser stærkere farver; den trykte illustration viser mere afdæmpede nuancer.",
    labels: ["RGB · til skærm", "CMYK · til papirtryk"],
    comparison: false,
    tips: [
      { title: "Brug produktets farveprofil", text: "Til almindelige tryksager bruges normalt CMYK. Vælg den profil, der er angivet for produktet." },
      { title: "Et farvepreview er vejledende", text: "Det simulerer trykket, men garanterer ikke et farvematch. Til lille sort tekst bruges normalt kun sort (100 % K)." },
    ],
    note: "Illustrationen er ikke et farvebevis. Tekstiltryk og andre trykmetoder kan kræve RGB; følg altid produktets filkrav.",
  },
  {
    id: "pdf", label: "Gem som PDF", icon: FileText,
    title: "Saml dit design i en PDF til tryk.",
    description: "Eksportér i trykkvalitet, og åbn den færdige PDF for et sidste visuelt tjek.",
    image: "pdf-export.png",
    imageAlt: "Et færdigt flyerdesign eksporteres til en PDF med korrekt format, bleed og indlejrede skrifter. Det færdige dokument gennemgås side for side.",
    labels: ["Dit færdige design", "Din PDF til tryk"],
    comparison: false,
    tips: [
      { title: "Vælg PDF i trykkvalitet", text: "PDF/X-4 anbefales, når dit program og produktets filkrav understøtter det. Eksportér sider enkeltvis, medmindre andet er angivet." },
      { title: "Tag bleed og skrifter med", text: "Brug produktets mål og bleed. Indlejr skrifter eller konvertér dem til kurver. Tilføj kun skæremærker, hvis de efterspørges." },
    ],
    note: "Kontrollér format, sideantal, billeder og tekst i den eksporterede PDF. Se filen igennem side for side.",
  },
] as const;

export function getGraphicGuideIndex(hash: string): number {
  const id = hash.replace(/^#/, "");
  const aliases: Record<string, string> = { "cmyk-rgb": "farver", "pdf-eksport": "pdf", "offsettryk": "beskaering" };
  const index = graphicGuideLessons.findIndex((lesson) => lesson.id === (aliases[id] || id));
  return index < 0 ? 0 : index;
}
