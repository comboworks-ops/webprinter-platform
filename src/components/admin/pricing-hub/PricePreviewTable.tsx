/**
 * PricePreviewTable - Shows combined price data from all imports
 * Standalone component for Pricing Hub
 */

import { useMemo, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricePreviewTableProps {
    data: any[];
    detectedAttributes?: {
        formats?: string[];
        materials?: string[];
        finishes?: string[];
    };
}

export function PricePreviewTable({ data, detectedAttributes }: PricePreviewTableProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 25;

    // Get all unique columns from the data
    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];
        const allKeys = new Set<string>();
        data.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
        });
        return Array.from(allKeys);
    }, [data]);

    // Filter and sort data
    const processedData = useMemo(() => {
        let filtered = data || [];

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(row =>
                Object.values(row).some(val =>
                    String(val).toLowerCase().includes(term)
                )
            );
        }

        // Sort
        if (sortColumn) {
            filtered = [...filtered].sort((a, b) => {
                const aVal = a[sortColumn] ?? "";
                const bVal = b[sortColumn] ?? "";

                // Try numeric comparison first
                const aNum = parseFloat(String(aVal).replace(/[^\d.-]/g, ""));
                const bNum = parseFloat(String(bVal).replace(/[^\d.-]/g, ""));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
                }

                // Fallback to string comparison
                const comparison = String(aVal).localeCompare(String(bVal));
                return sortDirection === "asc" ? comparison : -comparison;
            });
        }

        return filtered;
    }, [data, searchTerm, sortColumn, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(processedData.length / pageSize);
    const paginatedData = processedData.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    // Handle sort toggle
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    // Export to CSV
    const exportCSV = () => {
        if (!data || data.length === 0) return;

        const headers = columns.join(";");
        const rows = processedData.map(row =>
            columns.map(col => {
                const val = row[col] ?? "";
                // Quote values containing semicolons or quotes
                if (String(val).includes(";") || String(val).includes('"')) {
                    return `"${String(val).replace(/"/g, '""')}"`;
                }
                return val;
            }).join(";")
        );

        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "prisliste_eksport.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p>Ingen prisdata at vise</p>
                <p className="text-xs mt-1">Importer en CSV-fil for at se data her</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Detected Attributes Summary */}
            {detectedAttributes && (
                <div className="flex flex-wrap gap-2">
                    {detectedAttributes.formats && detectedAttributes.formats.length > 0 && (
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Formater:</span>
                            {detectedAttributes.formats.slice(0, 3).map(f => (
                                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                            ))}
                            {detectedAttributes.formats.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{detectedAttributes.formats.length - 3}</Badge>
                            )}
                        </div>
                    )}
                    {detectedAttributes.materials && detectedAttributes.materials.length > 0 && (
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Materialer:</span>
                            {detectedAttributes.materials.slice(0, 3).map(m => (
                                <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                            ))}
                            {detectedAttributes.materials.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{detectedAttributes.materials.length - 3}</Badge>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Søg i prisliste..."
                        value={searchTerm}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        {processedData.length} rækker
                    </span>
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Eksporter CSV
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg">
                <ScrollArea className="h-[400px]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                {columns.map(col => (
                                    <TableHead
                                        key={col}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort(col)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col}
                                            <ArrowUpDown className={cn(
                                                "h-3 w-3",
                                                sortColumn === col ? "opacity-100" : "opacity-30"
                                            )} />
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.map((row, idx) => (
                                <TableRow key={idx}>
                                    {columns.map(col => (
                                        <TableCell key={col} className="font-mono text-xs">
                                            {row[col] ?? ""}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        Side {currentPage} af {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PricePreviewTable;
