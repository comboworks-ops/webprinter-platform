import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrandingHistory, type BrandingVersion } from "@/hooks/useBrandingHistory";
import { History, RotateCcw, Trash2, Loader2, Calendar, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";

interface BrandingHistoryProps {
    tenantId: string | null;
    onRestore: () => void; // Callback to refetch branding after restore
}

export function BrandingHistory({ tenantId, onRestore }: BrandingHistoryProps) {
    const [open, setOpen] = useState(false);
    const { versions, isLoading, isRestoring, restoreVersion, deleteVersion } = useBrandingHistory(tenantId);

    const handleRestore = async (versionId: string) => {
        await restoreVersion(versionId);
        onRestore();
        setOpen(false);
    };

    const formatDate = (dateString: string) => {
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: da });
        } catch {
            return dateString;
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <History className="w-4 h-4" />
                    Historik
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Branding Historik
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                    </div>
                ) : versions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Ingen tidligere versioner</p>
                        <p className="text-sm">Versioner oprettes når du publicerer ændringer</p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[400px] pr-4">
                        <div className="space-y-3">
                            {versions.map((version) => (
                                <VersionCard
                                    key={version.id}
                                    version={version}
                                    formatDate={formatDate}
                                    isRestoring={isRestoring}
                                    onRestore={() => handleRestore(version.id)}
                                    onDelete={() => deleteVersion(version.id)}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}

interface VersionCardProps {
    version: BrandingVersion;
    formatDate: (date: string) => string;
    isRestoring: boolean;
    onRestore: () => void;
    onDelete: () => void;
}

function VersionCard({ version, formatDate, isRestoring, onRestore, onDelete }: VersionCardProps) {
    return (
        <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate">
                            {version.label || "Unavngivet version"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(version.created_at)}</span>
                        {version.type === "auto_save" && (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Auto</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onRestore}
                        disabled={isRestoring}
                        title="Gendan denne version"
                    >
                        {isRestoring ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RotateCcw className="w-4 h-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={onDelete}
                        title="Slet version"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Mini preview of what was in this version */}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                {version.data.logo_url && (
                    <img
                        src={version.data.logo_url}
                        alt="Logo"
                        className="h-4 w-auto object-contain"
                    />
                )}
                <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: version.data.colors?.primary || "#0EA5E9" }}
                    title="Primær farve"
                />
                <span>{version.data.fonts?.heading || "Poppins"}</span>
            </div>
        </div>
    );
}
