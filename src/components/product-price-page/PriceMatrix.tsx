import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  rowHeaderLabel
}: PriceMatrixProps) {
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
    <div ref={containerRef} className="space-y-4">
      {/* Navigation buttons */}
      {columns.length > columnsPerPage && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label="Forrige kolonner"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Forrige
          </Button>
          <span className="text-sm text-muted-foreground">
            Viser {columnOffset + 1}-{Math.min(columnOffset + columnsPerPage, columns.length)} af {columns.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label="Næste kolonner"
          >
            Næste
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Matrix */}
      <div className={`overflow-x-auto border rounded-lg bg-card transition-opacity duration-200`}>
        <div role="grid" aria-label="Prismatrix" className="min-w-full">
          {/* Header row */}
          <div role="row" className="flex border-b bg-muted/50">
            <div className="w-32 md:w-40 p-3 font-semibold text-sm flex-shrink-0 sticky left-0 bg-muted/50 border-r">
              {rowHeaderLabel || "Materiale / Antal"}
            </div>
            {visibleColumns.map((col) => (
              <div
                key={col}
                role="columnheader"
                className="w-24 p-3 font-semibold text-sm text-center flex-shrink-0"
              >
                {col} {columnUnit}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {rows.map((row) => (
            <div key={row} role="row" className="flex border-b last:border-b-0 hover:bg-muted/30">
              <div className="w-32 md:w-40 p-3 font-medium text-sm flex-shrink-0 sticky left-0 bg-card border-r">
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
                    className={`w-24 p-3 text-sm text-center flex-shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset ${isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-primary/10 cursor-pointer"
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
      <p className="text-xs text-muted-foreground text-center md:hidden">
        Swipe for at se flere priser
      </p>
    </div>
  );
}
