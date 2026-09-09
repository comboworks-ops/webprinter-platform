import { useId } from "react";
import {
  ChevronDown,
  Download,
  FileCheck2,
  FileType2,
  Image,
  Info,
  ListOrdered,
  Palette,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TemplateGuideGeometry, TemplateGuidePage } from "@/lib/designer/productTemplateLinks";

export type ProductFormatGuideData = {
  productName: string;
  productImageUrl?: string | null;
  formatLabel: string;
  finishedWidthMm: number;
  finishedHeightMm: number;
  dataWidthMm?: number;
  dataHeightMm?: number;
  bleedMm: number;
  safeAreaMm: number;
  minDpi?: number;
  layoutKind?: "flat" | "folded";
  printSideLabel?: string | null;
  foldTypeLabel?: string | null;
  pageCountLabel?: string | null;
  foldGeometry?: TemplateGuideGeometry | null;
  template?: {
    name: string;
    url: string;
  } | null;
};

export function ProductFormatGuideGraphic({
  data,
  className,
}: {
  data: ProductFormatGuideData;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start justify-center", className)}>
      {data.layoutKind === "folded" && data.foldGeometry?.pages.length ? (
        <ExactFoldGeometryGraphic
          geometry={data.foldGeometry}
          bleedMm={data.bleedMm}
          safeAreaMm={data.safeAreaMm}
          formatLabel={data.formatLabel}
        />
      ) : data.layoutKind === "folded" ? (
        <FoldedFormatGraphic
          finishedWidthMm={data.finishedWidthMm}
          finishedHeightMm={data.finishedHeightMm}
          bleedMm={data.bleedMm}
          safeAreaMm={data.safeAreaMm}
          formatLabel={data.formatLabel}
        />
      ) : (
        <FlatFormatGraphic
          finishedWidthMm={data.finishedWidthMm}
          finishedHeightMm={data.finishedHeightMm}
          bleedMm={data.bleedMm}
          safeAreaMm={data.safeAreaMm}
          formatLabel={data.formatLabel}
        />
      )}
    </div>
  );
}

function ExactFoldPageGraphic({
  page,
  bleedMm,
  safeAreaMm,
  formatLabel,
}: {
  page: TemplateGuidePage;
  bleedMm: number;
  safeAreaMm: number;
  formatLabel: string;
}) {
  const maxWidth = 264;
  const maxHeight = 92;
  const scale = Math.min(maxWidth / page.widthMm, maxHeight / page.heightMm);
  const width = page.widthMm * scale;
  const height = page.heightMm * scale;
  const x = (300 - width) / 2;
  const y = 25 + (maxHeight - height) / 2;
  const trimInset = Math.max(1.2, bleedMm * scale);
  const safeInset = Math.max(trimInset + 1.2, (bleedMm + safeAreaMm) * scale);
  const foldDescription = page.foldLines
    .map((line) => `${line.axis === "vertical" ? "lodret" : "vandret"} ved ${formatMm(line.positionMm)} millimeter`)
    .join(", ");

  return (
    <svg
      viewBox="0 0 300 145"
      role="img"
      aria-label={`${formatLabel}, ${page.label || `side ${page.page}`}: dataformat ${formatMm(page.widthMm)} gange ${formatMm(page.heightMm)} millimeter. Foldelinjer ${foldDescription}.`}
      className="h-auto w-full max-w-[300px]"
    >
      <rect width="300" height="145" rx="6" fill="hsl(var(--muted) / 0.38)" />
      <text x="150" y="14" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">
        {page.label || `Side ${page.page}`}
      </text>
      <rect x={x} y={y} width={width} height={height} fill="#e2f8fd" stroke="#10bce6" strokeWidth="1.8" />
      <rect
        x={x + trimInset}
        y={y + trimInset}
        width={Math.max(1, width - trimInset * 2)}
        height={Math.max(1, height - trimInset * 2)}
        fill="hsl(var(--background))"
        stroke="#e51583"
        strokeDasharray="4 2"
        strokeWidth="1.4"
      />
      <rect
        x={x + safeInset}
        y={y + safeInset}
        width={Math.max(1, width - safeInset * 2)}
        height={Math.max(1, height - safeInset * 2)}
        fill="none"
        stroke="#2563eb"
        strokeDasharray="4 3"
        strokeWidth="1.25"
      />
      {page.foldLines.map((line, index) => (
        line.axis === "vertical" ? (
          <line
            key={`${line.axis}-${line.positionMm}-${index}`}
            x1={x + line.positionMm * scale}
            y1={y}
            x2={x + line.positionMm * scale}
            y2={y + height}
            stroke="#075985"
            strokeDasharray="5 2.5"
            strokeWidth="1.65"
          />
        ) : (
          <line
            key={`${line.axis}-${line.positionMm}-${index}`}
            x1={x}
            y1={y + line.positionMm * scale}
            x2={x + width}
            y2={y + line.positionMm * scale}
            stroke="#075985"
            strokeDasharray="5 2.5"
            strokeWidth="1.65"
          />
        )
      ))}
      <text x="150" y="132" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">
        {formatMm(page.widthMm)} × {formatMm(page.heightMm)} mm · {page.foldLines.length} foldelinjer
      </text>
    </svg>
  );
}

function ExactFoldGeometryGraphic({
  geometry,
  bleedMm,
  safeAreaMm,
  formatLabel,
}: {
  geometry: TemplateGuideGeometry;
  bleedMm: number;
  safeAreaMm: number;
  formatLabel: string;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
      {geometry.pages.map((page) => (
        <ExactFoldPageGraphic
          key={`${page.page}-${page.label || "page"}`}
          page={page}
          bleedMm={bleedMm}
          safeAreaMm={safeAreaMm}
          formatLabel={formatLabel}
        />
      ))}
    </div>
  );
}

type ProductFormatGuideContentProps = {
  data: ProductFormatGuideData;
  compact?: boolean;
};

const formatMm = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("da-DK");
};

const cleanFormatLabel = (value: string) => String(value || "").trim() || "valgt format";

const isDinLangFourPageGuide = (data: ProductFormatGuideData) => (
  data.layoutKind === "folded"
  && Math.abs(data.finishedWidthMm - 99) < 0.6
  && Math.abs(data.finishedHeightMm - 210) < 0.6
  && Math.abs((data.dataWidthMm ?? 0) - 204) < 0.6
  && Math.abs((data.dataHeightMm ?? 0) - 216) < 0.6
);

const isDinLangSixPageGuide = (data: ProductFormatGuideData) => (
  data.layoutKind === "folded"
  && Math.abs(data.finishedWidthMm - 99) < 0.6
  && Math.abs(data.finishedHeightMm - 210) < 0.6
  && Math.abs((data.dataWidthMm ?? 0) - 303) < 0.6
  && Math.abs((data.dataHeightMm ?? 0) - 216) < 0.6
  && /6\s*sider/i.test(data.pageCountLabel || "")
  && /(rulle|zigzag)/i.test(data.foldTypeLabel || "")
);

function DinLangFourPageDiagram({ side }: { side: "outside" | "inside" }) {
  const isOutside = side === "outside";

  return (
    <figure className="min-w-0 rounded-md border bg-muted/20 p-2">
      <figcaption className="mb-1 text-center text-xs font-semibold text-foreground">
        {isOutside ? "Yderside" : "Inderside"}
      </figcaption>
      <svg
        viewBox="0 0 240 230"
        role="img"
        aria-label={isOutside
          ? "Yderside med bagside til venstre, forside til højre og midterfals"
          : "Inderside med to indersider og midterfals"}
        className="mx-auto h-auto w-full max-w-[220px]"
      >
        <defs>
          <pattern id={`bleed-hatch-${side}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>

        <line x1="40" y1="12" x2="200" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
        <line x1="40" y1="8" x2="40" y2="16" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
        <line x1="200" y1="8" x2="200" y2="16" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
        <text x="120" y="9" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">204 mm</text>

        <line x1="42.4" y1="24" x2="197.6" y2="24" stroke="#e51583" strokeWidth="1" />
        <line x1="42.4" y1="20" x2="42.4" y2="28" stroke="#e51583" strokeWidth="1" />
        <line x1="197.6" y1="20" x2="197.6" y2="28" stroke="#e51583" strokeWidth="1" />
        <text x="120" y="21" textAnchor="middle" fontSize="8" fontWeight="700" fill="#c40f6d">198 mm</text>

        <line x1="18" y1="36" x2="18" y2="205" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
        <line x1="14" y1="36" x2="22" y2="36" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
        <line x1="14" y1="205" x2="22" y2="205" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
        <text x="11" y="121" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" transform="rotate(-90 11 121)">216 mm</text>

        <line x1="30" y1="38.4" x2="30" y2="202.6" stroke="#e51583" strokeWidth="1" />
        <text x="27" y="121" textAnchor="middle" fontSize="8" fontWeight="700" fill="#c40f6d" transform="rotate(-90 27 121)">210 mm</text>

        <rect x="40" y="36" width="160" height="169" fill={`url(#bleed-hatch-${side})`} stroke="#10bce6" strokeWidth="1.6" />
        <rect x="42.4" y="38.4" width="155.2" height="164.2" fill="hsl(var(--background))" stroke="#e51583" strokeDasharray="4 2" strokeWidth="1.4" />
        <rect x="44.7" y="40.7" width="150.6" height="159.6" fill="none" stroke="#2563eb" strokeWidth="1.2" />
        <line x1="120" y1="38.4" x2="120" y2="202.6" stroke="#e51583" strokeDasharray="5 3" strokeWidth="1.4" />

        <text x="81" y="116" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">
          {isOutside ? "Bagside" : "Inderside"}
        </text>
        <text x="159" y="116" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">
          {isOutside ? "Forside" : "Inderside"}
        </text>
        {isOutside ? (
          <text x="159" y="129" textAnchor="middle" fontSize="7.5" fill="currentColor" opacity="0.64">Titelpanel</text>
        ) : null}

        <line x1="42.4" y1="217" x2="120" y2="217" stroke="#e51583" strokeWidth="1" />
        <line x1="120" y1="217" x2="197.6" y2="217" stroke="#e51583" strokeWidth="1" />
        <line x1="42.4" y1="213" x2="42.4" y2="221" stroke="#e51583" strokeWidth="1" />
        <line x1="120" y1="213" x2="120" y2="221" stroke="#e51583" strokeWidth="1" />
        <line x1="197.6" y1="213" x2="197.6" y2="221" stroke="#e51583" strokeWidth="1" />
        <text x="81" y="228" textAnchor="middle" fontSize="8" fontWeight="700" fill="#c40f6d">99 mm</text>
        <text x="159" y="228" textAnchor="middle" fontSize="8" fontWeight="700" fill="#c40f6d">99 mm</text>
      </svg>
    </figure>
  );
}

function DinLangFourPageGuideContent({ data }: { data: ProductFormatGuideData }) {
  const tips = [
    {
      icon: Image,
      title: "Baggrund til kant",
      text: "Lad billeder, farver og grafik gå helt ud til dataformatets kant.",
    },
    {
      icon: Palette,
      title: "Farver i CMYK",
      text: "Aflever trykfilen i CMYK. RGB kan give synlige farveændringer.",
    },
    {
      icon: ShieldCheck,
      title: "Mindst 300 ppi",
      text: "Brug højopløselige billeder, så trykket ikke bliver pixeleret.",
    },
    {
      icon: FileType2,
      title: "Gem som PDF",
      text: "Integrer skrifter og reducer transparenser, hvor det er muligt.",
    },
    {
      icon: ListOrdered,
      title: "Korrekt siderækkefølge",
      text: "Yderside som side 1 og inderside som side 2 i samme PDF.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">DIN Lang · 4 sider · midterfalset</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">To lige brede paneler på 99 × 210 mm</p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Linjeklaring">
              <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-cyan-500" />Dataformat</span>
              <span className="inline-flex items-center gap-1"><span className="w-4 border-t border-dashed border-fuchsia-600" />Snit/fold</span>
              <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-blue-600" />Sikkerhed</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DinLangFourPageDiagram side="outside" />
            <DinLangFourPageDiagram side="inside" />
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          <dl className="divide-y">
            <div className="px-3 py-2.5">
              <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Dataformat</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">204 × 216 mm</dd>
              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">Inkluderer 3 mm beskæring på alle sider.</p>
            </div>
            <div className="px-3 py-2.5">
              <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Færdigt udfoldet format</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">198 × 210 mm</dd>
            </div>
            <div className="px-3 py-2.5">
              <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Lukket format</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">99 × 210 mm</dd>
            </div>
            <div className="px-3 py-2.5">
              <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Sikkerhedsafstand</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">6 mm fra datakanten</dd>
              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">Det svarer til 3 mm inden for den færdige skærelinje.</p>
            </div>
          </dl>
        </div>
      </div>

      <section aria-labelledby="din-lang-file-rules" className="border-t pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 id="din-lang-file-rules" className="text-sm font-semibold text-foreground">5 regler for en trykklar fil</h4>
          {data.template ? (
            <Button asChild size="sm" variant="outline" className="h-9 shrink-0 gap-2 bg-background">
              <a href={data.template.url} download={data.template.name} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Download skabelon
              </a>
            </Button>
          ) : null}
        </div>
        <ul className="grid gap-x-5 sm:grid-cols-2">
          {tips.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex min-w-0 gap-2 border-t py-2 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        {!data.template ? (
          <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Der er endnu ikke knyttet en teknisk PDF til hele dette valg.</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DinLangSixPageDiagram({
  side,
  foldType,
}: {
  side: "outside" | "inside";
  foldType: "rullefalset" | "zigzag";
}) {
  const foldPositions = foldType === "rullefalset"
    ? (side === "outside" ? [100, 200] : [103, 203])
    : [102, 201];
  const x = 18;
  const y = 20;
  const width = 264;
  const height = 188;
  const scaleX = width / 303;
  const scaleY = height / 216;
  const trimInsetX = 3 * scaleX;
  const trimInsetY = 3 * scaleY;
  const safeInsetX = 6 * scaleX;
  const safeInsetY = 6 * scaleY;
  const labels = foldType === "rullefalset"
    ? (side === "outside" ? ["Inderflap", "Bagside", "Forside"] : ["Inderside", "Inderside", "Inderside"])
    : (side === "outside" ? ["Inderside", "Inderside", "Forside"] : ["Bagside", "Inderside", "Inderside"]);
  const boundaries = [3, ...foldPositions, 300];

  return (
    <figure className="min-w-0 rounded-md border bg-muted/20 p-2">
      <figcaption className="mb-1 text-center text-xs font-semibold text-foreground">
        {side === "outside" ? "Yderside" : "Inderside"}
      </figcaption>
      <svg
        viewBox="0 0 300 230"
        role="img"
        aria-label={`${side === "outside" ? "Yderside" : "Inderside"} med dataformat 303 gange 216 millimeter og foldelinjer ved ${foldPositions.join(" og ")} millimeter`}
        className="mx-auto h-auto w-full max-w-[300px]"
      >
        <rect x={x} y={y} width={width} height={height} fill="#e2f8fd" stroke="#10bce6" strokeWidth="1.5" />
        <rect
          x={x + trimInsetX}
          y={y + trimInsetY}
          width={width - trimInsetX * 2}
          height={height - trimInsetY * 2}
          fill="hsl(var(--background))"
          stroke="#e51583"
          strokeDasharray="4 2"
          strokeWidth="1.4"
        />
        <rect
          x={x + safeInsetX}
          y={y + safeInsetY}
          width={width - safeInsetX * 2}
          height={height - safeInsetY * 2}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.1"
        />
        {foldPositions.map((position) => (
          <line
            key={position}
            x1={x + position * scaleX}
            y1={y}
            x2={x + position * scaleX}
            y2={y + height}
            stroke="#e51583"
            strokeDasharray="5 3"
            strokeWidth="1.4"
          />
        ))}
        {labels.map((label, index) => {
          const centerMm = (boundaries[index] + boundaries[index + 1]) / 2;
          return (
            <text
              key={`${label}-${index}`}
              x={x + centerMm * scaleX}
              y={y + height / 2}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="currentColor"
            >
              {label}
            </text>
          );
        })}
        <text x="150" y="220" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">
          303 × 216 mm · fold {foldPositions.join(" / ")} mm
        </text>
      </svg>
    </figure>
  );
}

function DinLangSixPageGuideContent({ data }: { data: ProductFormatGuideData }) {
  const foldType = /zigzag/i.test(data.foldTypeLabel || "") ? "zigzag" : "rullefalset";
  const foldLabel = foldType === "zigzag" ? "Zigzagfalset" : "Rullefalset";

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">DIN Lang · 6 sider · {foldLabel}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Tre paneler i udfoldet format · lukket mål 99 × 210 mm</p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Linjeklaring">
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-cyan-500" />Dataformat</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 border-t border-dashed border-fuchsia-600" />Snit/fold</span>
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-blue-600" />Sikkerhed</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DinLangSixPageDiagram side="outside" foldType={foldType} />
          <DinLangSixPageDiagram side="inside" foldType={foldType} />
        </div>
      </div>

      <div className="grid overflow-hidden rounded-md border bg-background sm:grid-cols-4 sm:divide-x">
        <div className="px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Dataformat</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">303 × 216 mm</p>
        </div>
        <div className="border-t px-3 py-2.5 sm:border-t-0">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Udfoldet format</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">297 × 210 mm</p>
        </div>
        <div className="border-t px-3 py-2.5 sm:border-t-0">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Lukket format</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">99 × 210 mm</p>
        </div>
        <div className="border-t px-3 py-2.5 sm:border-t-0">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Beskæring</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">3 mm</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="max-w-xl text-xs leading-5 text-muted-foreground">
          Hold tekst og logoer mindst 6 mm fra dataformatets kant. Skabelonen indeholder separate yderside- og indersidesider med foldelinjer, der passer til det valgte fals.
        </p>
        {data.template ? (
          <Button asChild size="sm" variant="outline" className="h-9 shrink-0 gap-2 bg-background">
            <a href={data.template.url} download={data.template.name} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Download korrekt skabelon
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GuideLegend() {
  return (
    <g transform="translate(17 188)">
      <line x1="0" y1="0" x2="20" y2="0" stroke="#10bce6" strokeWidth="2" />
      <text x="25" y="3" fontSize="7.5" fill="currentColor">Dataformat</text>
      <line x1="80" y1="0" x2="100" y2="0" stroke="#e51583" strokeDasharray="4 2" strokeWidth="2" />
      <text x="105" y="3" fontSize="7.5" fill="currentColor">Skærelinje</text>
      <line x1="164" y1="0" x2="184" y2="0" stroke="#2563eb" strokeDasharray="4 3" strokeWidth="2" />
      <text x="189" y="3" fontSize="7.5" fill="currentColor">Sikker</text>
    </g>
  );
}

function FlatFormatGraphic({
  finishedWidthMm,
  finishedHeightMm,
  bleedMm,
  safeAreaMm,
  formatLabel,
}: Pick<
  ProductFormatGuideData,
  "finishedWidthMm" | "finishedHeightMm" | "bleedMm" | "safeAreaMm" | "formatLabel"
>) {
  const dataWidthMm = finishedWidthMm + bleedMm * 2;
  const dataHeightMm = finishedHeightMm + bleedMm * 2;
  const scale = Math.min(152 / dataWidthMm, 132 / dataHeightMm);
  const dataWidth = dataWidthMm * scale;
  const dataHeight = dataHeightMm * scale;
  const x = (260 - dataWidth) / 2;
  const y = 35;
  const trimInset = bleedMm * scale;
  const safeInset = (bleedMm + safeAreaMm) * scale;
  const safeDistanceFromData = bleedMm + safeAreaMm;
  const trimX = x + trimInset;
  const trimY = y + trimInset;
  const trimWidth = Math.max(1, dataWidth - trimInset * 2);
  const trimHeight = Math.max(1, dataHeight - trimInset * 2);

  return (
    <svg
      viewBox="0 0 260 220"
      role="img"
      aria-label={`${formatLabel}: dataformat ${formatMm(dataWidthMm)} gange ${formatMm(dataHeightMm)} millimeter, ${formatMm(bleedMm)} millimeter beskæring, færdigt format ${formatMm(finishedWidthMm)} gange ${formatMm(finishedHeightMm)} millimeter`}
      className="h-auto w-full max-w-[260px]"
    >
      <rect width="260" height="220" rx="6" fill="hsl(var(--muted) / 0.38)" />

      <line x1={x} y1={y - 12} x2={x + dataWidth} y2={y - 12} stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <line x1={x} y1={y - 15} x2={x} y2={y - 9} stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <line x1={x + dataWidth} y1={y - 15} x2={x + dataWidth} y2={y - 9} stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <text x="130" y={y - 17} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor">
        {formatMm(dataWidthMm)} mm
      </text>

      <line x1={x - 12} y1={y} x2={x - 12} y2={y + dataHeight} stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <line x1={x - 15} y1={y} x2={x - 9} y2={y} stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <line x1={x - 15} y1={y + dataHeight} x2={x - 9} y2={y + dataHeight} stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <text
        x={x - 18}
        y={y + dataHeight / 2}
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="currentColor"
        transform={`rotate(-90 ${x - 18} ${y + dataHeight / 2})`}
      >
        {formatMm(dataHeightMm)} mm
      </text>

      <rect x={x} y={y} width={dataWidth} height={dataHeight} fill="#e2f8fd" stroke="#10bce6" strokeWidth="2" />
      <rect
        x={trimX}
        y={trimY}
        width={trimWidth}
        height={trimHeight}
        fill="hsl(var(--background))"
        stroke="#e51583"
        strokeDasharray="4 2"
        strokeWidth="1.5"
      />
      <rect
        x={x + safeInset}
        y={y + safeInset}
        width={Math.max(1, dataWidth - safeInset * 2)}
        height={Math.max(1, dataHeight - safeInset * 2)}
        fill="none"
        stroke="#2563eb"
        strokeDasharray="4 3"
        strokeWidth="1.4"
      />

      <line x1={x + dataWidth + 3} y1={y} x2={x + dataWidth + 3} y2={trimY} stroke="#10bce6" strokeWidth="1" />
      <line x1={x + dataWidth} y1={y} x2={x + dataWidth + 6} y2={y} stroke="#10bce6" strokeWidth="1" />
      <line x1={x + dataWidth} y1={trimY} x2={x + dataWidth + 6} y2={trimY} stroke="#10bce6" strokeWidth="1" />
      <text x={x + dataWidth + 9} y={trimY + 2} fontSize="7.5" fontWeight="700" fill="#087ea4">
        {formatMm(bleedMm)} mm udfald
      </text>

      <text x="130" y={y + dataHeight / 2 - 3} textAnchor="middle" fontSize="14" fontWeight="800" fill="currentColor">
        {cleanFormatLabel(formatLabel).split(" - ")[0]}
      </text>
      <text x="130" y={y + dataHeight / 2 + 12} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.72">
        {formatMm(finishedWidthMm)} × {formatMm(finishedHeightMm)} mm
      </text>

      <GuideLegend />
      <text x="130" y="210" textAnchor="middle" fontSize="7.5" fill="currentColor" opacity="0.65">
        Sikkerhedszone: {formatMm(safeDistanceFromData)} mm fra dataformatets kant
      </text>
    </svg>
  );
}

function FoldedFormatGraphic({
  finishedWidthMm,
  finishedHeightMm,
  dataWidthMm,
  dataHeightMm,
  bleedMm,
  safeAreaMm,
  formatLabel,
}: Pick<
  ProductFormatGuideData,
  "finishedWidthMm" | "finishedHeightMm" | "dataWidthMm" | "dataHeightMm" | "bleedMm" | "safeAreaMm" | "formatLabel"
>) {
  const resolvedDataWidthMm = dataWidthMm ?? finishedWidthMm * 2 + bleedMm * 2;
  const resolvedDataHeightMm = dataHeightMm ?? finishedHeightMm + bleedMm * 2;
  const ratio = Math.max(0.55, Math.min(1.6, finishedWidthMm / finishedHeightMm));
  const panelHeight = 112;
  const panelWidth = Math.min(72, panelHeight * ratio);
  const totalWidth = panelWidth * 2;
  const x = (260 - totalWidth) / 2;
  const y = 35;
  const bleedInset = Math.max(4, Math.min(7, bleedMm * 1.5));
  const safeInset = Math.max(bleedInset + 5, (bleedMm + safeAreaMm) * 1.5);

  return (
    <svg
      viewBox="0 0 260 220"
      role="img"
      aria-label={`${formatLabel}: dataformat ${formatMm(resolvedDataWidthMm)} gange ${formatMm(resolvedDataHeightMm)} millimeter med skærelinje, sikkerhedszone og foldelinje. Lukket format ${formatMm(finishedWidthMm)} gange ${formatMm(finishedHeightMm)} millimeter.`}
      className="h-auto w-full max-w-[260px]"
    >
      <rect width="260" height="220" rx="6" fill="hsl(var(--muted) / 0.38)" />
      <rect x={x} y={y} width={totalWidth} height={panelHeight} fill="#e2f8fd" stroke="#10bce6" strokeWidth="2" />
      <rect
        x={x + bleedInset}
        y={y + bleedInset}
        width={totalWidth - bleedInset * 2}
        height={panelHeight - bleedInset * 2}
        fill="hsl(var(--background))"
        stroke="#e51583"
        strokeDasharray="4 2"
        strokeWidth="1.5"
      />
      <rect
        x={x + safeInset}
        y={y + safeInset}
        width={Math.max(1, totalWidth - safeInset * 2)}
        height={Math.max(1, panelHeight - safeInset * 2)}
        fill="none"
        stroke="#2563eb"
        strokeDasharray="4 3"
        strokeWidth="1.4"
      />
      <line
        x1={x + panelWidth}
        y1={y + bleedInset}
        x2={x + panelWidth}
        y2={y + panelHeight - bleedInset}
        stroke="#10bce6"
        strokeDasharray="5 3"
        strokeWidth="1.6"
      />
      <text x="130" y={y + panelHeight / 2 - 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="currentColor">
        {cleanFormatLabel(formatLabel).split(" - ")[0]}
      </text>
      <text x="130" y={y + panelHeight / 2 + 12} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.72">
        lukket: {formatMm(finishedWidthMm)} × {formatMm(finishedHeightMm)} mm
      </text>
      <GuideLegend />
      <text x="130" y="202" textAnchor="middle" fontSize="7.5" fill="currentColor" opacity="0.68">
        Dataformat: {formatMm(resolvedDataWidthMm)} × {formatMm(resolvedDataHeightMm)} mm
      </text>
      <text x="130" y="213" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.58">
        Skematisk visning – brug den tilknyttede PDF
      </text>
    </svg>
  );
}

export function ProductFormatGuideContent({ data, compact = false }: ProductFormatGuideContentProps) {
  if (!data.foldGeometry?.pages.length && isDinLangFourPageGuide(data)) {
    return <DinLangFourPageGuideContent data={data} />;
  }

  if (!data.foldGeometry?.pages.length && isDinLangSixPageGuide(data)) {
    return <DinLangSixPageGuideContent data={data} />;
  }

  const isFolded = data.layoutKind === "folded";
  const dataWidthMm = data.dataWidthMm
    ?? (isFolded ? data.finishedWidthMm * 2 + data.bleedMm * 2 : data.finishedWidthMm + data.bleedMm * 2);
  const dataHeightMm = data.dataHeightMm ?? data.finishedHeightMm + data.bleedMm * 2;
  const safetyDistanceFromDataMm = data.bleedMm + data.safeAreaMm;
  const minDpi = data.minDpi || 300;

  const checks = isFolded
    ? [
        `Lad baggrund og billeder gå ${formatMm(data.bleedMm)} mm ud over den magenta skærelinje.`,
        `Hold tekst og logoer ${formatMm(data.safeAreaMm)} mm inden for skærelinjen.`,
        `Brug den PDF, der matcher format, foldetype, sideantal og retning. CMYK · mindst ${minDpi} ppi.`,
      ]
    : [
        `Lad baggrund og grafik gå helt ud til den cyan datakant på ${formatMm(dataWidthMm)} × ${formatMm(dataHeightMm)} mm.`,
        `Hold tekst og logoer inden for den blå sikkerhedszone. CMYK · mindst ${minDpi} ppi.`,
        data.printSideLabel?.includes("4+4")
          ? "Aflever forside og bagside i én PDF i korrekt rækkefølge."
          : "Aflever som én PDF-side med indlejrede skrifter.",
      ];

  return (
    <div className={cn(
      "grid items-start gap-4 md:grid-cols-[230px_minmax(0,1fr)]",
      compact && "md:grid-cols-[210px_minmax(0,1fr)]",
    )}>
      <ProductFormatGuideGraphic data={data} />

      <div className="min-w-0 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {cleanFormatLabel(data.formatLabel)} · trykfil
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isFolded
              ? "PDF'en bruger det udfoldede dataformat. Det lukkede mål vises separat, så fold og beskæring ikke forveksles."
              : "Yderste linje er dataformatet; den magenta linje er det færdige snit."}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y py-2 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted-foreground">
              Dataformat
            </dt>
            <dd className="mt-0.5 text-sm font-bold text-foreground">
              {formatMm(dataWidthMm)} × {formatMm(dataHeightMm)} mm
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted-foreground">
              {isFolded ? "Lukket format" : "Færdigt format"}
            </dt>
            <dd className="mt-0.5 text-sm font-bold text-foreground">
              {formatMm(data.finishedWidthMm)} × {formatMm(data.finishedHeightMm)} mm
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Beskæring</dt>
            <dd className="mt-0.5 text-sm font-bold text-foreground">{formatMm(data.bleedMm)} mm</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Sikkerhed</dt>
            <dd className="mt-0.5 text-sm font-bold text-foreground">
              {isFolded ? `${formatMm(data.safeAreaMm)} mm` : `${formatMm(safetyDistanceFromDataMm)} mm`}
            </dd>
          </div>
        </dl>

        <div className="space-y-1">
          {checks.map((check) => (
            <p key={check} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <span>{check}</span>
            </p>
          ))}
        </div>

        {data.template ? (
          <Button asChild size="sm" variant="outline" className="h-9 gap-2 bg-background">
            <a href={data.template.url} download={data.template.name} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Download korrekt skabelon
            </a>
          </Button>
        ) : (
          <div className="flex items-start gap-2 text-xs leading-5 text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Der er endnu ikke knyttet en teknisk PDF til hele dette valg.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductFormatGuidePanel({
  data,
  className,
  defaultOpen = false,
}: {
  data: ProductFormatGuideData;
  className?: string;
  defaultOpen?: boolean;
}) {
  const headingId = useId();

  return (
    <section id="trykfil-og-maal" aria-labelledby={headingId} className={cn("scroll-mt-24", className)}>
      <details className="group overflow-hidden rounded-md border bg-card" open={defaultOpen || undefined}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 marker:hidden hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileCheck2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span id={headingId} className="block text-sm font-semibold text-foreground">Trykfil og mål</span>
            <span className="block truncate text-xs text-muted-foreground">
              {cleanFormatLabel(data.formatLabel)} · {formatMm(data.finishedWidthMm)} × {formatMm(data.finishedHeightMm)} mm
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-3 sm:p-4">
          <ProductFormatGuideContent data={data} />
        </div>
      </details>
    </section>
  );
}

export function ProductFormatGuideDialog({ data }: { data: ProductFormatGuideData }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
          <Ruler className="h-3.5 w-3.5" />
          Se mål og filguide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trykfil og mål</DialogTitle>
          <DialogDescription>
            Informationen følger det format og de valg, der er aktive i prisberegneren.
          </DialogDescription>
        </DialogHeader>
        <ProductFormatGuideContent data={data} compact />
      </DialogContent>
    </Dialog>
  );
}
