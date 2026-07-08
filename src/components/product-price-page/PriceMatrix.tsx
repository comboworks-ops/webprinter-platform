import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { getMatrixStyleVars } from "@/lib/branding/matrix";

type PriceMatrixProps = {
  rows: string[];
  columns: number[];
  cells: Record<string, Record<number, number>>;
  onCellClick: (row: string, column: number, basePrice: number, displayPrice: number) => void;
  selectedCell?: { row: string; column: number } | null;
  columnUnit?: string; // e.g., "stk", "m²"
  customArea?: number; // For area-based products - multiplier for price calculation
  basePricePerSqm?: Record<string, number>; // Base price per m² for each material (row)
  computeExtras?: (quantity: number, area?: number) => number; // Optional extra pricing (e.g., tilvalg)
  rowHeaderLabel?: string;
  matrixBox?: {
    backgroundColor?: string;
    borderRadiusPx?: number;
    borderWidthPx?: number;
    borderColor?: string;
    paddingPx?: number;
  } | null;
};

export function PriceMatrix({
  rows,
  columns,
  cells,
  onCellClick,
  selectedCell,
  columnUnit = "stk",
  customArea,
  basePricePerSqm,
  computeExtras,
  rowHeaderLabel,
  matrixBox,
}: PriceMatrixProps) {
  const settings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const activeBranding = (isPreviewMode && previewBranding)
    ? previewBranding
    : settings.data?.branding;
  const matrixStyleVars = getMatrixStyleVars(activeBranding, matrixBox);
  const isAreaBased = customArea !== undefined && basePricePerSqm !== undefined;

  // Calculate base and display price for a cell
  const getPrices = (row: string, col: number): { base: number; display: number } => {
    const rawBase = isAreaBased && basePricePerSqm?.[row]
      ? basePricePerSqm[row] * (customArea ?? 1) * col
      : (cells[row]?.[col] ?? 0);
    const baseValue = Number(rawBase) || 0;
    const extras = computeExtras ? computeExtras(col, customArea) : 0;
    const displayValue = baseValue + extras;
    return {
      base: Math.round(baseValue),
      display: Math.round(displayValue)
    };
  };
  const [columnOffset, setColumnOffset] = useState(0);
  const [columnsPerPage, setColumnsPerPage] = useState(8);
  // const [isUpdating, setIsUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only reset column offset if selected cell is not visible in current view
  useEffect(() => {
    if (selectedCell) {
      const selectedColumnIndex = columns.indexOf(selectedCell.column);
      if (selectedColumnIndex !== -1) {
        const isInView = selectedColumnIndex >= columnOffset &&
          selectedColumnIndex < columnOffset + columnsPerPage;

        if (!isInView) {
          // Scroll to show the selected cell
          const newOffset = Math.max(0, selectedColumnIndex - Math.floor(columnsPerPage / 2));
          setColumnOffset(Math.min(newOffset, Math.max(0, columns.length - columnsPerPage)));
        }
      }
    }
  }, [selectedCell, columns, columnsPerPage]);

  /* Removed visual feedback to prevent flickering
  useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 200);
    return () => clearTimeout(timer);
  }, [rows, columns, cells]);
  */

  useEffect(() => {
    const updateColumnsPerPage = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // Estimate: ~100px per column + 150px for row headers
        const availableWidth = width - 150;
        const cols = Math.floor(availableWidth / 100);
        setColumnsPerPage(Math.max(4, Math.min(cols, columns.length)));
      }
    };

    updateColumnsPerPage();
    window.addEventListener("resize", updateColumnsPerPage);
    return () => window.removeEventListener("resize", updateColumnsPerPage);
  }, [columns.length]);

  const visibleColumns = columns.slice(columnOffset, columnOffset + columnsPerPage);
  const canGoPrev = columnOffset > 0;
  const canGoNext = columnOffset + columnsPerPage < columns.length;

  const handlePrev = () => {
    setColumnOffset(Math.max(0, columnOffset - columnsPerPage));
  };

  const handleNext = () => {
    setColumnOffset(Math.min(columns.length - columnsPerPage, columnOffset + columnsPerPage));
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: string, col: number) => {
    const currentRowIndex = rows.indexOf(row);
    const currentColIndex = columns.indexOf(col);

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (currentRowIndex > 0) {
          const newRow = rows[currentRowIndex - 1];
          const { base, display } = getPrices(newRow, col);
          onCellClick(newRow, col, base, display);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (currentRowIndex < rows.length - 1) {
          const newRow = rows[currentRowIndex + 1];
          const { base, display } = getPrices(newRow, col);
          onCellClick(newRow, col, base, display);
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (currentColIndex > 0) {
          const newCol = columns[currentColIndex - 1];
          const { base, display } = getPrices(row, newCol);
          onCellClick(row, newCol, base, display);
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        if (currentColIndex < columns.length - 1) {
          const newCol = columns[currentColIndex + 1];
          const { base, display } = getPrices(row, newCol);
          onCellClick(row, newCol, base, display);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        const { base, display } = getPrices(row, col);
        onCellClick(row, col, base, display);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className="space-y-4 [font-family:var(--matrix-font)]"
      style={matrixStyleVars}
      data-branding-id="productPage.matrix"
    >
      {/* Navigation buttons */}
      {columns.length > columnsPerPage && (
        <div className="flex items-center justify-between" data-site-design-target="productPage.matrix.buttons">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label="Forrige kolonner"
            className="!border-[var(--matrix-nav-button-border)] !bg-[var(--matrix-nav-button-bg)] !text-[var(--matrix-nav-button-text)] hover:!border-[var(--matrix-nav-button-hover-border)] hover:!bg-[var(--matrix-nav-button-hover-bg)] hover:!text-[var(--matrix-nav-button-hover-text)]"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Forrige
          </Button>
          <span className="text-sm" style={{ color: "var(--matrix-row-header-text)" }}>
            Viser {columnOffset + 1}-{Math.min(columnOffset + columnsPerPage, columns.length)} af {columns.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label="Næste kolonner"
            className="!border-[var(--matrix-nav-button-border)] !bg-[var(--matrix-nav-button-bg)] !text-[var(--matrix-nav-button-text)] hover:!border-[var(--matrix-nav-button-hover-border)] hover:!bg-[var(--matrix-nav-button-hover-bg)] hover:!text-[var(--matrix-nav-button-hover-text)]"
          >
            Næste
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Matrix */}
      <div 
        className="overflow-x-auto rounded-[var(--matrix-box-radius)] border-[var(--matrix-box-border-width)] border-[var(--matrix-box-border-color)] bg-[var(--matrix-box-bg)] p-[var(--matrix-box-padding)] transition-opacity duration-200"
        data-branding-id="productPage.matrix.box"
        data-site-design-target="productPage.matrix.box"
      >
        <div role="grid" aria-label="Prismatrix" className="min-w-full">
          {/* Header row */}
          <div role="row" className="flex border-b border-[var(--matrix-border)] bg-[var(--matrix-header-bg)] text-[var(--matrix-header-text)]" data-site-design-target="productPage.matrix.topRow">
            <div className="sticky left-0 w-32 flex-shrink-0 border-r border-[var(--matrix-border)] bg-[var(--matrix-header-bg)] p-3 text-sm font-semibold md:w-40">
              {rowHeaderLabel || "Materiale / Antal"}
            </div>
            {visibleColumns.map((col) => (
              <div
                key={col}
                role="columnheader"
                className="w-24 flex-shrink-0 border-l border-[var(--matrix-border)] p-3 text-center text-sm font-semibold first:border-l-0"
              >
                {col} {columnUnit}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {rows.map((row) => (
            <div key={row} role="row" className="flex border-b border-[var(--matrix-border)] last:border-b-0">
              <div className="sticky left-0 w-32 flex-shrink-0 border-r border-[var(--matrix-border)] bg-[var(--matrix-row-header-bg)] p-3 text-sm font-medium text-[var(--matrix-row-header-text)] md:w-40" data-site-design-target="productPage.matrix.vertical">
                {row}
              </div>
              {visibleColumns.map((col) => {
                const { base, display } = getPrices(row, col);
                const isSelected = selectedCell?.row === row && selectedCell?.column === col;

                return (
                  <button
                    key={`${row}-${col}`}
                    role="gridcell"
                    tabIndex={isSelected ? 0 : -1}
                    aria-label={`${row}, ${col} ${columnUnit}, ${display} kr`}
                    aria-selected={isSelected}
                    onClick={() => onCellClick(row, col, base, display)}
                    onKeyDown={(e) => handleKeyDown(e, row, col)}
                    data-site-design-target="productPage.matrix.pricing"
                    className={`w-24 flex-shrink-0 border-l border-[var(--matrix-border)] p-3 text-center text-sm tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--matrix-selected-bg)] focus:ring-inset ${isSelected
                      ? "bg-[var(--matrix-selected-bg)] font-semibold text-[var(--matrix-selected-text)]"
                      : "cursor-pointer bg-[var(--matrix-cell-bg)] text-[var(--matrix-cell-text)] hover:bg-[var(--matrix-cell-hover-bg)] hover:text-[var(--matrix-cell-hover-text)]"
                      }`}
                  >
                    {display > 0 ? `${display} kr` : "-"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile hint */}
      <p className="text-center text-xs md:hidden" style={{ color: "var(--matrix-row-header-text)" }}>
        Swipe for at se flere priser
      </p>
    </div>
  );
}
