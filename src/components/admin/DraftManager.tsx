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
    FileText, Loader2, ChevronRight, Trash2, Palette,
    LayoutTemplate
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import type { BrandingHistoryEntry, BrandingData, SavedDesign } from "@/lib/branding";

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

    /** Saved designs (user-named) */
    savedDesigns?: SavedDesign[];
    /** Callback to load saved designs */
    onLoadSavedDesigns?: () => Promise<void>;
    /** Callback to load a saved design */
    onLoadDesign?: (id: string) => Promise<void>;
    /** Callback to delete a saved design */
    onDeleteSavedDesign?: (id: string) => Promise<void>;
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
    savedDesigns = [],
    onLoadSavedDesigns,
    onLoadDesign,
    onDeleteSavedDesign,
}: DraftManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [activeTab, setActiveTab] = useState<'save' | 'load' | 'history'>('save');
    const [selectedVersion, setSelectedVersion] = useState<BrandingHistoryEntry | null>(null);
    const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
    const [isDeleteDesignOpen, setIsDeleteDesignOpen] = useState(false);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [isRestoreHistoryOpen, setIsRestoreHistoryOpen] = useState(false);
    const [isLoadDesignOpen, setIsLoadDesignOpen] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingDesigns, setIsLoadingDesigns] = useState(false);

    // Initial load
    useEffect(() => {
        if (isOpen) {
            // Load designs first if available
            if (onLoadSavedDesigns && savedDesigns.length === 0) {
                setIsLoadingDesigns(true);
                onLoadSavedDesigns().finally(() => setIsLoadingDesigns(false));
            }

            // Only load history if explicitly requested or if we're on history tab
            if (activeTab === 'history' && history.length === 0) {
                setIsLoadingHistory(true);
                onLoadHistory().finally(() => setIsLoadingHistory(false));
            }
        }
    }, [isOpen, activeTab, onLoadSavedDesigns, onLoadHistory]);

    const handleSaveDraft = async () => {
        if (!draftName.trim()) return;

        await onSaveDraft(draftName);
        setDraftName("");
        // Switch to load tab to see the saved design
        setActiveTab('load');
    };

    const handleLoadDesign = async () => {
        if (selectedDesign && onLoadDesign) {
            await onLoadDesign(selectedDesign.id);
            setIsLoadDesignOpen(false);
            setIsOpen(false); // Close main dialog after loading
        }
    };

    const handleDeleteDesign = async () => {
        if (selectedDesign && onDeleteSavedDesign) {
            await onDeleteSavedDesign(selectedDesign.id);
            setSelectedDesign(null);
            setIsDeleteDesignOpen(false);
        }
    };

    const handleRestoreVersion = async () => {
        if (selectedVersion) {
            await onRestoreVersion(selectedVersion.id);
            setSelectedVersion(null);
            setIsRestoreHistoryOpen(false);
            setIsOpen(false);
        }
    };

    const handleResetToDefault = async () => {
        await onResetToDefault();
        setIsResetDialogOpen(false);
        setIsOpen(false);
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
                    <Button variant="outline" className="gap-2 border-dashed">
                        <LayoutTemplate className="h-4 w-4" />
                        Gemte Designs
                        {hasUnsavedChanges && (
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-100">
                                Ikke gemt
                            </Badge>
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Palette className="h-5 w-5" />
                            Design & Historik
                        </DialogTitle>
                        <DialogDescription>
                            Gem dine designs, indlæs tidligere setups, eller fortryd ændringer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Custom Tabs */}
                        <div className="flex items-center px-6 border-b">
                            <button
                                onClick={() => setActiveTab('save')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'save'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Gem Design
                            </button>
                            <button
                                onClick={() => setActiveTab('load')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'load'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Gemte Designs
                                <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-[10px]">
                                    {savedDesigns.length}
                                </Badge>
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Fortryd / Historik
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-muted/5">

                            {/* TAB: SAVE DESIGN */}
                            {activeTab === 'save' && (
                                <div className="space-y-6 max-w-md mx-auto py-4">
                                    <div className="text-center space-y-2 mb-6">
                                        <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Save className="h-6 w-6 text-primary" />
                                        </div>
                                        <h3 className="font-semibold text-lg">Gem dit nuværende design</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Giv dit design et navn, så du nemt kan finde det og skifte tilbage til det senere.
                                        </p>
                                    </div>

                                    <Card>
                                        <CardContent className="pt-6 space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="design-name">Navngiv dit design</Label>
                                                <Input
                                                    id="design-name"
                                                    placeholder="F.eks. 'Sommer Kampagne' eller 'Black Friday'"
                                                    value={draftName}
                                                    onChange={(e) => setDraftName(e.target.value)}
                                                    className="text-base"
                                                    autoFocus
                                                />
                                            </div>

                                            <Button
                                                onClick={handleSaveDraft}
                                                className="w-full"
                                                disabled={isSaving || !draftName.trim()}
                                            >
                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                Gem Design
                                            </Button>

                                            {!hasUnsavedChanges && (
                                                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1 pt-2">
                                                    <Check className="h-3 w-3 text-green-600" />
                                                    Dine ændringer er allerede gemt i kladden
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* TAB: LOAD SAVED DESIGNS */}
                            {activeTab === 'load' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                            Dine gemte designs
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => {
                                                setIsLoadingDesigns(true);
                                                onLoadSavedDesigns && onLoadSavedDesigns().finally(() => setIsLoadingDesigns(false));
                                            }}
                                            disabled={isLoadingDesigns}
                                        >
                                            <RotateCcw className={`h-3 w-3 mr-1 ${isLoadingDesigns ? 'animate-spin' : ''}`} />
                                            Opdater
                                        </Button>
                                    </div>

                                    {isLoadingDesigns ? (
                                        <div className="text-center py-12">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">Henter designs...</p>
                                        </div>
                                    ) : savedDesigns.length === 0 ? (
                                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                                            <LayoutTemplate className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                                            <h4 className="text-sm font-medium">Ingen gemte designs endnu</h4>
                                            <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                                                Gå til fanen "Gem Design" for at gemme dit første design.
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-4"
                                                onClick={() => setActiveTab('save')}
                                            >
                                                Opret nyt design
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {savedDesigns.map((design) => (
                                                <div
                                                    key={design.id}
                                                    className="group flex items-center justify-between p-4 bg-card hover:bg-accent/5 rounded-lg border transition-all hover:shadow-sm"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-md ${design.isAutoSave ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'}`}>
                                                            {design.isAutoSave ? <RotateCcw className="h-5 w-5" /> : <Palette className="h-5 w-5" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-medium text-sm">{design.name}</h4>
                                                                {design.isAutoSave && (
                                                                    <Badge variant="outline" className="text-[10px] h-5 px-1 font-normal text-orange-600 border-orange-200 bg-orange-50">
                                                                        Auto-gem
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {formatDate(design.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            className="h-8 text-xs"
                                                            onClick={() => {
                                                                setSelectedDesign(design);
                                                                setIsLoadDesignOpen(true);
                                                            }}
                                                        >
                                                            Indlæs
                                                        </Button>

                                                        {onDeleteSavedDesign && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                onClick={() => {
                                                                    setSelectedDesign(design);
                                                                    setIsDeleteDesignOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: HISTORY/UNDE-UNDO */}
                            {activeTab === 'history' && (
                                <div className="space-y-6">
                                    {/* Default Actions */}
                                    <Card className="border-orange-200 bg-orange-50/30">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-medium text-orange-900">Nulstil alt?</h4>
                                                <p className="text-xs text-orange-700/80">
                                                    Vi laver en automatisk sikkerhedskopi før du nulstiller.
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-orange-700 border-orange-300 hover:bg-orange-50 hover:text-orange-800"
                                                onClick={() => setIsResetDialogOpen(true)}
                                            >
                                                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                                Nulstil til standard
                                            </Button>
                                        </CardContent>
                                    </Card>

                                    <Separator />

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                                Udgivelses-historik
                                            </h3>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={() => {
                                                    setIsLoadingHistory(true);
                                                    onLoadHistory().finally(() => setIsLoadingHistory(false));
                                                }}
                                                disabled={isLoadingHistory}
                                            >
                                                <RotateCcw className={`h-3 w-3 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                                                Hent historik
                                            </Button>
                                        </div>

                                        {isLoadingHistory ? (
                                            <div className="text-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">Henter historik...</p>
                                            </div>
                                        ) : history.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                                                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">Ingen historik fundet</p>
                                                <p className="text-xs mt-1">Udgiv dine ændringer for at se dem her</p>
                                            </div>
                                        ) : (
                                            <div className="relative pl-4 border-l-2 border-muted space-y-6">
                                                {history.map((entry, index) => (
                                                    <div key={entry.id} className="relative">
                                                        <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background ${index === 0 ? 'bg-green-500' : 'bg-muted-foreground'}`} />

                                                        <div className="flex items-start justify-between group">
                                                            <div>
                                                                <p className="text-sm font-medium">{entry.label}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {formatDate(entry.timestamp)}
                                                                    {entry.publishedBy && <span> • {entry.publishedBy}</span>}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="opacity-0 group-hover:opacity-100 h-7 text-xs"
                                                                onClick={() => {
                                                                    setSelectedVersion(entry);
                                                                    setIsRestoreHistoryOpen(true);
                                                                }}
                                                            >
                                                                Gendan
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-muted/10 border-t flex justify-between items-center text-xs text-muted-foreground">
                            <span>{hasUnsavedChanges ? 'Du har ændringer der ikke er gemt' : 'Alt er gemt'}</span>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Luk
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Load Design Confirm Dialog */}
            <AlertDialog open={isLoadDesignOpen} onOpenChange={setIsLoadDesignOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Indlæs design?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Du er ved at indlæse: <strong>{selectedDesign?.name}</strong>
                            <br /><br />
                            Dette vil overskrive din nuværende kladde. Sørg for at gemme dit nuværende arbejde først,
                            hvis du vil beholde det.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedDesign(null)}>Annuller</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLoadDesign}>
                            Indlæs Design
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Design Confirm Dialog */}
            <AlertDialog open={isDeleteDesignOpen} onOpenChange={setIsDeleteDesignOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Slet design?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Er du sikker på, at du vil slette <strong>{selectedDesign?.name}</strong>?
                            <br />
                            Dette kan ikke fortrydes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedDesign(null)}>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteDesign}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Slet
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Restore Version Confirm Dialog */}
            <AlertDialog open={isRestoreHistoryOpen} onOpenChange={setIsRestoreHistoryOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Gendan denne version?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                Du er ved at gendanne versionen: <strong>{selectedVersion?.label}</strong>
                            </p>
                            <p>
                                Dette vil erstatte din nuværende kladde.
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
                            <br /><br />
                            <strong>Automatisk sikkerhedskopi:</strong> Vi gemmer dit nuværende design automatisk før vi nulstiller,
                            så du kan fortryde senere under "Gemte Designs".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleResetToDefault}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Nulstil og Gem Backup
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
