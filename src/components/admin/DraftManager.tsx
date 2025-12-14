/**
 * Draft & History Manager Component
 * 
 * Provides UI for:
 * - Saving drafts with custom names
 * - Viewing a list of saved drafts/versions
 * - Switching between saved drafts
 * - Restoring previous published versions
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    History, Save, RotateCcw, Clock, Check, Upload,
    FileText, Loader2, ChevronRight, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import type { BrandingHistoryEntry, BrandingData } from "@/lib/branding";

interface DraftManagerProps {
    /** Current draft data */
    draft: BrandingData;
    /** Whether there are unsaved changes */
    hasUnsavedChanges: boolean;
    /** Whether currently saving */
    isSaving: boolean;
    /** Previous versions/history */
    history: BrandingHistoryEntry[];
    /** Callback to load history */
    onLoadHistory: () => Promise<void>;
    /** Callback to save draft with optional name */
    onSaveDraft: (name?: string) => Promise<void>;
    /** Callback to restore a version */
    onRestoreVersion: (versionId: string) => Promise<void>;
    /** Callback to reset to default */
    onResetToDefault: () => Promise<void>;
    /** Mode (master or tenant) */
    mode: 'master' | 'tenant';
}

export function DraftManager({
    draft,
    hasUnsavedChanges,
    isSaving,
    history,
    onLoadHistory,
    onSaveDraft,
    onRestoreVersion,
    onResetToDefault,
}: DraftManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<BrandingHistoryEntry | null>(null);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Load history when panel opens
    useEffect(() => {
        if (isOpen && history.length === 0) {
            setIsLoadingHistory(true);
            onLoadHistory().finally(() => setIsLoadingHistory(false));
        }
    }, [isOpen, history.length, onLoadHistory]);

    const handleSaveDraft = async () => {
        await onSaveDraft(draftName || undefined);
        setDraftName("");
        setIsSaveDialogOpen(false);
    };

    const handleRestoreVersion = async () => {
        if (selectedVersion) {
            await onRestoreVersion(selectedVersion.id);
            setSelectedVersion(null);
            setIsRestoreDialogOpen(false);
        }
    };

    const handleResetToDefault = async () => {
        await onResetToDefault();
        setIsResetDialogOpen(false);
    };

    const formatDate = (timestamp: string) => {
        try {
            return format(new Date(timestamp), "d. MMM yyyy 'kl.' HH:mm", { locale: da });
        } catch {
            return timestamp;
        }
    };

    return (
        <>
            {/* Trigger Button */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <History className="h-4 w-4" />
                        Versioner
                        {hasUnsavedChanges && (
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                                Ikke gemt
                            </Badge>
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Versioner & Historik
                        </DialogTitle>
                        <DialogDescription>
                            Gem kladder, se historik, og gendan tidligere versioner
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Save Draft Section */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Save className="h-4 w-4" />
                                    Gem nuværende kladde
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Giv kladden et navn (valgfrit)..."
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleSaveDraft}
                                        disabled={isSaving || !hasUnsavedChanges}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4" />
                                        )}
                                        <span className="ml-2">Gem</span>
                                    </Button>
                                </div>
                                {!hasUnsavedChanges && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Check className="h-3 w-3 text-green-600" />
                                        Alle ændringer er gemt
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Separator />

                        {/* Version History */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Tidligere versioner
                                </h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setIsLoadingHistory(true);
                                        onLoadHistory().finally(() => setIsLoadingHistory(false));
                                    }}
                                    disabled={isLoadingHistory}
                                >
                                    {isLoadingHistory ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RotateCcw className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            <ScrollArea className="h-[250px] rounded-md border">
                                {isLoadingHistory ? (
                                    <div className="flex items-center justify-center h-full p-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                        <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">
                                            Ingen tidligere versioner endnu
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Publicer for at gemme i historikken
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-1">
                                        {history.map((entry, index) => (
                                            <button
                                                key={entry.id}
                                                onClick={() => {
                                                    setSelectedVersion(entry);
                                                    setIsRestoreDialogOpen(true);
                                                }}
                                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                                            >
                                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                                                    {index === 0 ? (
                                                        <Check className="h-4 w-4" />
                                                    ) : (
                                                        history.length - index
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {entry.label}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(entry.timestamp)}
                                                        {entry.publishedBy && (
                                                            <span className="ml-2">
                                                                af {entry.publishedBy}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                {index === 0 && (
                                                    <Badge variant="default" className="text-[10px]">
                                                        Aktiv
                                                    </Badge>
                                                )}
                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        <Separator />

                        {/* Reset to Default */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Nulstil til standard</p>
                                <p className="text-xs text-muted-foreground">
                                    Fjern alle tilpasninger og brug standarddesignet
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setIsResetDialogOpen(true)}
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Nulstil
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Restore Version Confirm Dialog */}
            <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Gendan denne version?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                Du er ved at gendanne versionen: <strong>{selectedVersion?.label}</strong>
                            </p>
                            <p>
                                Dette vil erstatte din nuværende kladde. Din nuværende kladde gemmes automatisk,
                                så du kan vende tilbage til den senere.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedVersion(null)}>
                            Annuller
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreVersion}>
                            Gendan version
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reset to Default Confirm Dialog */}
            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Nulstil til standarddesign?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dette vil fjerne alle dine branding-tilpasninger og gendanne standardindstillingerne.
                            Den nuværende version gemmes i historikken, så du kan gendanne den senere.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleResetToDefault}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Nulstil til standard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
