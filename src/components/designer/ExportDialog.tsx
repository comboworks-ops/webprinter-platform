/**
 * Export Dialog Component
 * 
 * Modal for choosing export mode (Print PDF, Proof PDF, Vector PDF, Original PDF)
 */

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileDown, Printer, Eye, FileText, Sparkles } from 'lucide-react';
import { ExportMode, ExportOptions, ExportModeOption } from '@/lib/designer/export/types';
import { isOriginalPdfAvailable } from '@/lib/designer/export/exportActions';

interface ExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onExport: (options: ExportOptions) => Promise<void>;
    isExporting: boolean;
    hasBleed: boolean;
    pdfSourceMeta?: { originalUrl: string; originalFilename: string; uploadedAt: string } | null;
    hasChanges: boolean;
    hasPdfBackground?: boolean;  // True if a PDF was imported as background
}

export function ExportDialog({
    open,
    onOpenChange,
    onExport,
    isExporting,
    hasBleed,
    pdfSourceMeta,
    hasChanges,
    hasPdfBackground = false
}: ExportDialogProps) {
    const [mode, setMode] = useState<ExportMode>('print_pdf');
    const [includeBleed, setIncludeBleed] = useState(true);

    const showOriginalPdf = isOriginalPdfAvailable(pdfSourceMeta, hasChanges);

    const exportModes: ExportModeOption[] = [
        {
            id: 'print_pdf',
            label: 'Print PDF',
            description: 'Produktions-PDF med korrekt størrelse og beskæring. Til trykkerier.',
            recommended: !hasPdfBackground,  // Recommend if no PDF background
        },
        {
            id: 'vector_pdf',
            label: 'Vektor PDF',
            description: 'Bevar importeret PDF som vektor (tekst forbliver skarp ved zoom). Anbefalet til uploadede PDF-filer.',
            recommended: hasPdfBackground,  // Recommend if PDF background present
            hidden: !hasPdfBackground,
        },
        {
            id: 'proof_pdf',
            label: 'Proof PDF',
            description: 'Visuelt proof med simuleret CMYK-udseende. Til kundegodkendelse.',
        },
        {
            id: 'original_pdf',
            label: 'Original PDF',
            description: 'Send din originale PDF uændret. Kun tilgængelig hvis du ikke har redigeret.',
            hidden: !showOriginalPdf,
        },
    ];

    const visibleModes = exportModes.filter(m => !m.hidden);

    const handleExport = async () => {
        await onExport({
            mode,
            includeBleed: mode === 'original_pdf' ? false : includeBleed,
        });
    };

    const getModeIcon = (modeId: ExportMode) => {
        switch (modeId) {
            case 'print_pdf':
                return <Printer className="h-5 w-5" />;
            case 'proof_pdf':
                return <Eye className="h-5 w-5" />;
            case 'original_pdf':
                return <FileText className="h-5 w-5" />;
            case 'vector_pdf':
                return <Sparkles className="h-5 w-5" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-primary" />
                        Eksportér Design
                    </DialogTitle>
                    <DialogDescription>
                        Vælg hvordan du vil eksportere dit design som PDF.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <RadioGroup
                        value={mode}
                        onValueChange={(v) => setMode(v as ExportMode)}
                        className="space-y-3"
                    >
                        {visibleModes.map((option) => (
                            <div
                                key={option.id}
                                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${mode === option.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                                onClick={() => setMode(option.id)}
                            >
                                <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        {getModeIcon(option.id)}
                                        <Label
                                            htmlFor={option.id}
                                            className="font-medium cursor-pointer"
                                        >
                                            {option.label}
                                        </Label>
                                        {option.recommended && (
                                            <Badge variant="secondary" className="text-xs">
                                                Anbefalet
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {option.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </RadioGroup>

                    {/* Bleed option - only show for print_pdf and proof_pdf, and if document has bleed */}
                    {hasBleed && mode !== 'original_pdf' && mode !== 'vector_pdf' && (
                        <div className="flex items-center space-x-2 pt-2 border-t">
                            <Checkbox
                                id="includeBleed"
                                checked={includeBleed}
                                onCheckedChange={(checked) => setIncludeBleed(checked === true)}
                            />
                            <Label
                                htmlFor="includeBleed"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Inkluder beskæring (bleed)
                            </Label>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isExporting}
                    >
                        Annuller
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting}>
                        {isExporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Eksporterer...
                            </>
                        ) : (
                            <>
                                <FileDown className="h-4 w-4 mr-2" />
                                Eksportér
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
