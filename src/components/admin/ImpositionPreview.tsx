import { cn } from "@/lib/utils";

export type ImpositionPreset = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  shortLabel: string;
};

export const IMPOSITION_PRESETS: ImpositionPreset[] = [
  { id: "a6", name: "A6 flyer", widthMm: 105, heightMm: 148, shortLabel: "A6" },
  { id: "a5", name: "A5 flyer", widthMm: 148, heightMm: 210, shortLabel: "A5" },
  { id: "a4", name: "A4 flyer", widthMm: 210, heightMm: 297, shortLabel: "A4" },
  { id: "dl", name: "DL menu", widthMm: 99, heightMm: 210, shortLabel: "DL" },
  { id: "card", name: "Business card", widthMm: 85, heightMm: 55, shortLabel: "Card" },
];

interface ImpositionPreviewProps {
  sheetWidthMm: number;
  sheetHeightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  itemWidthMm: number;
  itemHeightMm: number;
  bleedMm?: number;
  gapMm?: number;
  className?: string;
}

export function ImpositionPreview({
  sheetWidthMm,
  sheetHeightMm,
  marginTopMm,
  marginRightMm,
  marginBottomMm,
  marginLeftMm,
  itemWidthMm,
  itemHeightMm,
  bleedMm = 0,
  gapMm = 0,
  className,
}: ImpositionPreviewProps) {
  const safeSheetWidth = Math.max(0, sheetWidthMm);
  const safeSheetHeight = Math.max(0, sheetHeightMm);
  const printableWidth = Math.max(0, safeSheetWidth - Math.max(0, marginLeftMm) - Math.max(0, marginRightMm));
  const printableHeight = Math.max(0, safeSheetHeight - Math.max(0, marginTopMm) - Math.max(0, marginBottomMm));
  const outerWidth = Math.max(0, itemWidthMm + bleedMm * 2);
  const outerHeight = Math.max(0, itemHeightMm + bleedMm * 2);
  const stepX = outerWidth + Math.max(0, gapMm);
  const stepY = outerHeight + Math.max(0, gapMm);

  const columns = printableWidth > 0 && outerWidth > 0 ? Math.floor((printableWidth + gapMm) / Math.max(stepX, 1)) : 0;
  const rows = printableHeight > 0 && outerHeight > 0 ? Math.floor((printableHeight + gapMm) / Math.max(stepY, 1)) : 0;
  const totalCells = Math.max(0, columns) * Math.max(0, rows);

  const visibleColumns = Math.min(columns, 5);
  const visibleRows = Math.min(rows, 4);
  const visibleCellCount = visibleColumns * visibleRows;

  const usedWidth = columns > 0 ? columns * outerWidth + (columns - 1) * gapMm : 0;
  const usedHeight = rows > 0 ? rows * outerHeight + (rows - 1) * gapMm : 0;
  const leftoverWidth = Math.max(0, printableWidth - usedWidth);
  const leftoverHeight = Math.max(0, printableHeight - usedHeight);

  const printableLeftPct = safeSheetWidth > 0 ? (marginLeftMm / safeSheetWidth) * 100 : 0;
  const printableTopPct = safeSheetHeight > 0 ? (marginTopMm / safeSheetHeight) * 100 : 0;
  const printableWidthPct = safeSheetWidth > 0 ? (printableWidth / safeSheetWidth) * 100 : 0;
  const printableHeightPct = safeSheetHeight > 0 ? (printableHeight / safeSheetHeight) * 100 : 0;
  const previewRatio = safeSheetWidth > 0 && safeSheetHeight > 0
    ? Math.min(1.9, Math.max(0.55, safeSheetHeight / safeSheetWidth))
    : 0.7;

  const showCells = totalCells > 0 && visibleCellCount > 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-[30px] border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm">
        <div className="mx-auto flex w-full max-w-[240px] items-center justify-center">
          <div
            className="relative w-full overflow-hidden rounded-[24px] border-[3px] border-amber-300 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]"
            style={{ aspectRatio: `1 / ${previewRatio}` }}
          >
            <div
              className="absolute rounded-[18px] border-2 border-dashed border-rose-300 bg-rose-50/35"
              style={{
                left: `${printableLeftPct}%`,
                top: `${printableTopPct}%`,
                width: `${printableWidthPct}%`,
                height: `${printableHeightPct}%`,
              }}
            />

            {showCells ? (
              Array.from({ length: visibleCellCount }, (_, index) => {
                const row = Math.floor(index / visibleColumns);
                const column = index % visibleColumns;
                const leftMm = marginLeftMm + column * stepX;
                const topMm = marginTopMm + row * stepY;
                const outerLeftPct = safeSheetWidth > 0 ? (leftMm / safeSheetWidth) * 100 : 0;
                const outerTopPct = safeSheetHeight > 0 ? (topMm / safeSheetHeight) * 100 : 0;
                const outerWidthPct = safeSheetWidth > 0 ? (outerWidth / safeSheetWidth) * 100 : 0;
                const outerHeightPct = safeSheetHeight > 0 ? (outerHeight / safeSheetHeight) * 100 : 0;
                const trimInsetX = outerWidth > 0 ? (bleedMm / outerWidth) * 100 : 0;
                const trimInsetY = outerHeight > 0 ? (bleedMm / outerHeight) * 100 : 0;

                return (
                  <div
                    key={`${row}-${column}`}
                    className="absolute rounded-[12px] border border-cyan-300 bg-cyan-50/60"
                    style={{
                      left: `${outerLeftPct}%`,
                      top: `${outerTopPct}%`,
                      width: `${outerWidthPct}%`,
                      height: `${outerHeightPct}%`,
                    }}
                  >
                    <div
                      className="absolute rounded-[9px] border border-fuchsia-300 bg-white/80"
                      style={{
                        left: `${trimInsetX}%`,
                        top: `${trimInsetY}%`,
                        width: `${Math.max(0, 100 - trimInsetX * 2)}%`,
                        height: `${Math.max(0, 100 - trimInsetY * 2)}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center px-1 text-center text-[9px] font-medium leading-tight text-slate-500">
                      {itemWidthMm} x {itemHeightMm}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="absolute inset-[18%] flex items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center text-xs leading-relaxed text-slate-500">
                Ingen celler passer med nuvaerende format, bleed og gap.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            Raaformat
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-300" />
            Printbart felt
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-cyan-300" />
            Celle inkl. bleed
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-fuchsia-300" />
            Trimstoerrelse
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Up layout</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">
            {columns} x {rows}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {totalCells} emner pr. ark
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Celle</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">
            {outerWidth} x {outerHeight} mm
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Trim {itemWidthMm} x {itemHeightMm} mm
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Restbredde</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{leftoverWidth.toFixed(0)} mm</div>
          <div className="mt-1 text-xs text-slate-500">Efter columns og gap</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Resthoejde</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{leftoverHeight.toFixed(0)} mm</div>
          <div className="mt-1 text-xs text-slate-500">Efter rows og gap</div>
        </div>
      </div>

      {totalCells > visibleCellCount ? (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs leading-relaxed text-cyan-900">
          Previewet viser {visibleCellCount} af {totalCells} celler for at holde oversigten laeselig.
        </div>
      ) : null}
    </div>
  );
}
