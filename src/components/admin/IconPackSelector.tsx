import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Check, FileText, FolderOpen, Bookmark, BookOpen, RectangleHorizontal, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon Pack Interface - Premium-ready structure
export type { IconPack } from '@/components/icons/legacyProductPacks';
import { LEGACY_ICON_PACKS, type IconPack } from '@/components/icons/legacyProductPacks';
import { ICON_FAMILIES } from '@/lib/icons/registry';
import { IconPackProvider } from '@/components/icons/IconFamily';
import { User, Search, Settings, Languages, Package } from 'lucide-react';
export const ICON_PACKS: IconPack[] = [...LEGACY_ICON_PACKS, ...ICON_FAMILIES.map(family => ({
    ...family, isPremium: false, preview: 'text-primary', icons: {
        flyers: <IconPackProvider packId={family.id}><FileText className="h-full w-full" /></IconPackProvider>,
        folders: <IconPackProvider packId={family.id}><FolderOpen className="h-full w-full" /></IconPackProvider>,
        salesFolders: <IconPackProvider packId={family.id}><Bookmark className="h-full w-full" /></IconPackProvider>,
        posters: <IconPackProvider packId={family.id}><ImageIcon className="h-full w-full" /></IconPackProvider>,
        booklets: <IconPackProvider packId={family.id}><BookOpen className="h-full w-full" /></IconPackProvider>,
        banners: <IconPackProvider packId={family.id}><RectangleHorizontal className="h-full w-full" /></IconPackProvider>,
    },
}))];

interface IconPackSelectorProps {
    selectedPackId: string;
    onChange: (packId: string) => void;
}

export function IconPackSelector({ selectedPackId, onChange }: IconPackSelectorProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Ikoner til hele shoppen
                </CardTitle>
                <CardDescription>
                    Ét valg til menuer, produkter, knapper, konto og bestilling. Farverne følger dit design.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                    {ICON_PACKS.map((pack) => {
                        const isSelected = selectedPackId === pack.id;
                        const isLocked = pack.isPremium; // For now, premium packs are still selectable

                        return (
                            <button
                                type="button"
                                aria-pressed={isSelected}
                                aria-label={`Vælg ikonsæt ${pack.name}`}
                                key={pack.id}
                                onClick={() => onChange(pack.id)}
                                className={cn(
                                    "relative text-left p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md",
                                    isSelected
                                        ? "border-primary bg-primary/5 shadow-sm"
                                        : "border-muted hover:border-primary/50",
                                    isLocked && "opacity-90"
                                )}
                            >
                                {/* Selection Indicator */}
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}

                                {/* Premium Badge */}
                                {pack.isPremium && (
                                    <Badge
                                        variant="secondary"
                                        className="absolute top-2 left-2 gap-1 text-xs"
                                    >
                                        <Lock className="w-3 h-3" />
                                        {pack.price} DKK
                                    </Badge>
                                )}

                                {/* Icon Preview Grid */}
                                <div className={cn("grid grid-cols-3 gap-2 mb-3 mt-4", pack.preview)}>
                                    <div className="w-8 h-8">{pack.icons.flyers}</div>
                                    <div className="w-8 h-8">{pack.icons.folders}</div>
                                    <div className="w-8 h-8">{pack.icons.posters}</div>
                                    <div className="w-8 h-8">{pack.icons.salesFolders}</div>
                                    <div className="w-8 h-8">{pack.icons.booklets}</div>
                                    <div className="w-8 h-8">{pack.icons.banners}</div>
                                </div>

                                <IconPackProvider packId={pack.id}>
                                    <span className="mb-3 flex items-center gap-3 text-muted-foreground" aria-hidden="true">
                                        <User className="h-5 w-5" /><Search className="h-5 w-5" /><Settings className="h-5 w-5" /><Languages className="h-5 w-5" /><Package className="h-5 w-5" />
                                    </span>
                                </IconPackProvider>
                                {/* Pack Info */}
                                <div>
                                    <h4 className="font-semibold text-sm">{pack.name}</h4>
                                    <p className="text-xs text-muted-foreground">{pack.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// Helper to get icon for a product type from a pack
export function getProductIcon(
    productType: keyof IconPack["icons"],
    packId: string = "classic"
): React.ReactNode {
    const pack = ICON_PACKS.find((p) => p.id === packId) || ICON_PACKS[0];
    return pack.icons[productType] || pack.icons.flyers;
}
