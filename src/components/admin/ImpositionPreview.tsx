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
  /** Use the same orientation and grid as the cost simulation when available. */
  layout?: { orientation: 0 | 90; columns: number; rows: number };
  sheetLabel?: string;
  countLabel?: string;
  className?: string;
}

const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const formatMm = (value: number) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);

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
  layout,
  sheetLabel = "Råformat",
  countLabel = "emner pr. ark",
  className,
}: ImpositionPreviewProps) {
  const safeSheetWidth = nonNegative(sheetWidthMm);
  const safeSheetHeight = nonNegative(sheetHeightMm);
  const safeMarginLeft = nonNegative(marginLeftMm);
  const safeMarginTop = nonNegative(marginTopMm);
  const safeBleed = nonNegative(bleedMm);
  const safeGap = nonNegative(gapMm);
  const printableWidth = Math.max(0, safeSheetWidth - safeMarginLeft - nonNegative(marginRightMm));
  const printableHeight = Math.max(0, safeSheetHeight - safeMarginTop - nonNegative(marginBottomMm));
  const validDimensions = safeSheetWidth > 0 && safeSheetHeight > 0 &&
    nonNegative(itemWidthMm) > 0 && nonNegative(itemHeightMm) > 0;
  const rotated = layout?.orientation === 90;
  const outerWidth = nonNegative(rotated ? itemHeightMm : itemWidthMm) + safeBleed * 2;
  const outerHeight = nonNegative(rotated ? itemWidthMm : itemHeightMm) + safeBleed * 2;
  const stepX = outerWidth + safeGap;
  const stepY = outerHeight + safeGap;

  const columns = !validDimensions ? 0 : layout
    ? Math.floor(nonNegative(layout.columns))
    : printableWidth > 0 ? Math.floor((printableWidth + safeGap) / Math.max(stepX, 1)) : 0;
  const rows = !validDimensions ? 0 : layout
    ? Math.floor(nonNegative(layout.rows))
    : printableHeight > 0 ? Math.floor((printableHeight + safeGap) / Math.max(stepY, 1)) : 0;
  const totalCells = columns * rows;
  const visibleCellCount = Math.min(totalCells, 200);

  const usedWidth = columns > 0 ? columns * outerWidth + (columns - 1) * safeGap : 0;
  const usedHeight = rows > 0 ? rows * outerHeight + (rows - 1) * safeGap : 0;
  const leftoverWidth = Math.max(0, printableWidth - usedWidth);
  const leftoverHeight = Math.max(0, printableHeight - usedHeight);

  const printableLeftPct = safeSheetWidth > 0 ? (safeMarginLeft / safeSheetWidth) * 100 : 0;
  const printableTopPct = safeSheetHeight > 0 ? (safeMarginTop / safeSheetHeight) * 100 : 0;
  const printableWidthPct = safeSheetWidth > 0 ? (printableWidth / safeSheetWidth) * 100 : 0;
  const printableHeightPct = safeSheetHeight > 0 ? (printableHeight / safeSheetHeight) * 100 : 0;
  // Constrain the preview's size, never the paper's proportions.
  const previewWidth = validDimensions ? Math.min(300, 340 * safeSheetWidth / safeSheetHeight) : 300;

  if (!validDimensions) {
    return (
      <div className={cn("border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm leading-relaxed text-slate-500", className)} data-imposition-empty>
        Angiv arkets bredde og højde, og vælg et emneformat for at se placeringen.
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 space-y-[var(--ui-space-4)]", className)} data-imposition-preview data-imposition-count={totalCells}>
      <div className="rounded-[4px] border border-slate-200 bg-slate-50 p-[var(--ui-space-5)]">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500">
          <span>{sheetLabel}</span>
          <span className="font-medium tabular-nums text-slate-700">{formatMm(safeSheetWidth)} × {formatMm(safeSheetHeight)} mm</span>
        </div>
        <div className="mx-auto flex w-full items-center justify-center">
          <div
            className="relative w-full flex-none overflow-hidden rounded-none bg-white shadow-sm outline outline-1 outline-slate-400"
            style={{ aspectRatio: `${safeSheetWidth} / ${safeSheetHeight}`, maxWidth: previewWidth, minHeight: 0 }}
            data-imposition-sheet
            data-sheet-width-mm={safeSheetWidth}
            data-sheet-height-mm={safeSheetHeight}
            data-orientation={rotated ? 90 : 0}
            role="img"
            aria-label={`${formatMm(safeSheetWidth)} gange ${formatMm(safeSheetHeight)} mm, ${totalCells} ${countLabel}, ${columns} kolonner og ${rows} rækker${rotated ? ", emner drejet 90 grader" : ""}`}
          >
            <div
              className="absolute rounded-none border border-dashed border-slate-400 bg-slate-50"
              style={{
                left: `${printableLeftPct}%`,
                top: `${printableTopPct}%`,
                width: `${printableWidthPct}%`,
                height: `${printableHeightPct}%`,
              }}
            />

            {totalCells > 0 ? (
              Array.from({ length: visibleCellCount }, (_, index) => {
                const row = Math.floor(index / columns);
                const column = index % columns;
                const leftMm = safeMarginLeft + column * stepX;
                const topMm = safeMarginTop + row * stepY;
                const outerLeftPct = safeSheetWidth > 0 ? (leftMm / safeSheetWidth) * 100 : 0;
                const outerTopPct = safeSheetHeight > 0 ? (topMm / safeSheetHeight) * 100 : 0;
                const outerWidthPct = safeSheetWidth > 0 ? (outerWidth / safeSheetWidth) * 100 : 0;
                const outerHeightPct = safeSheetHeight > 0 ? (outerHeight / safeSheetHeight) * 100 : 0;
                const trimInsetX = outerWidth > 0 ? (safeBleed / outerWidth) * 100 : 0;
                const trimInsetY = outerHeight > 0 ? (safeBleed / outerHeight) * 100 : 0;

                return (
                  <div
                    key={`${row}-${column}`}
                    className="absolute overflow-hidden rounded-none border border-blue-300 bg-blue-100"
                    data-imposition-cell
                    style={{
                      left: `${outerLeftPct}%`,
                      top: `${outerTopPct}%`,
                      width: `${outerWidthPct}%`,
                      height: `${outerHeightPct}%`,
                    }}
                  >
                    <div
                      className="absolute rounded-none border border-blue-500 bg-blue-50"
                      style={{
                        left: `${trimInsetX}%`,
                        top: `${trimInsetY}%`,
                        width: `${Math.max(0, 100 - trimInsetX * 2)}%`,
                        height: `${Math.max(0, 100 - trimInsetY * 2)}%`,
                      }}
                    />
                    {columns <= 5 && rows <= 6 ? (
                      <div className="absolute inset-0 flex items-center justify-center px-1 text-center text-[9px] font-medium leading-tight text-blue-900">
                        {formatMm(itemWidthMm)} × {formatMm(itemHeightMm)}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              null
            )}
          </div>
        </div>

        {totalCells === 0 ? (
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-600">Ingen emner passer med det nuværende format, beskæring og mellemrum.</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 border border-slate-400 bg-white" />
            Råformat
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 border border-dashed border-slate-400 bg-slate-50" />
            Printbart felt
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 border border-blue-300 bg-blue-100" />
            Celle inkl. bleed
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 border border-blue-500 bg-blue-50" />
            Trimstørrelse
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3" aria-live="polite">
        <div className="text-sm text-slate-600"><strong className="text-2xl font-semibold tabular-nums text-slate-900">{totalCells}</strong> {countLabel}</div>
        <span className="text-xs text-slate-500">{columns} kolonner × {rows} rækker{rotated ? " · Drejet 90°" : ""}</span>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <dt className="text-slate-500">Emne inkl. bleed</dt>
          <dd className="mt-1 font-medium tabular-nums text-slate-800">{formatMm(outerWidth)} × {formatMm(outerHeight)} mm</dd>
        </div>
        <div>
          <dt className="text-slate-500">Printbart felt</dt>
          <dd className="mt-1 font-medium tabular-nums text-slate-800">{formatMm(printableWidth)} × {formatMm(printableHeight)} mm</dd>
        </div>
        <div>
          <dt className="text-slate-500">Restbredde</dt>
          <dd className="mt-1 font-medium tabular-nums text-slate-800">{formatMm(leftoverWidth)} mm</dd>
        </div>
        <div>
          <dt className="text-slate-500">Resthøjde</dt>
          <dd className="mt-1 font-medium tabular-nums text-slate-800">{formatMm(leftoverHeight)} mm</dd>
        </div>
      </dl>

      {totalCells > visibleCellCount ? (
        <div className="border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          Previewet viser {visibleCellCount} af {totalCells} emner for at holde oversigten læselig.
        </div>
      ) : null}
    </div>
  );
}
