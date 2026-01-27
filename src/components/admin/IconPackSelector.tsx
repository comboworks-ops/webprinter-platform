import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Check, FileText, FolderOpen, Bookmark, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon Pack Interface - Premium-ready structure
export interface IconPack {
    id: string;
    name: string;
    description: string;
    author: string;
    isPremium: boolean;
    price?: number; // DKK, null/undefined for free
    icons: {
        flyers: React.ReactNode;
        folders: React.ReactNode;
        salesFolders: React.ReactNode;
        posters: React.ReactNode;
        booklets: React.ReactNode;
        banners: React.ReactNode;
    };
    preview: string; // CSS class for preview styling
}

// Sample Icon Packs
export const ICON_PACKS: IconPack[] = [
    {
        id: "classic",
        name: "Classic",
        description: "Simpel og ren linjestil",
        author: "Webprinter",
        isPremium: false,
        icons: {
            flyers: <FileText className="w-full h-full" />,
            folders: <FolderOpen className="w-full h-full" />,
            salesFolders: <Bookmark className="w-full h-full" />,
            posters: <ImageIcon className="w-full h-full" />,
            booklets: <FileText className="w-full h-full" />,
            banners: <ImageIcon className="w-full h-full" />,
        },
        preview: "text-slate-600",
    },
    {
        id: "modern",
        name: "Modern",
        description: "Fyldte ikoner med bløde hjørner",
        author: "Webprinter",
        isPremium: false,
        icons: {
            flyers: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <rect x="7" y="5" width="10" height="2" fill="white" opacity="0.5" />
                    <rect x="7" y="9" width="6" height="1" fill="white" opacity="0.3" />
                    <rect x="7" y="12" width="8" height="1" fill="white" opacity="0.3" />
                </svg>
            ),
            folders: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M4 4h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
            ),
            salesFolders: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M4 4h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    <circle cx="16" cy="14" r="3" fill="white" opacity="0.5" />
                </svg>
            ),
            posters: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <rect x="3" y="2" width="18" height="20" rx="2" />
                    <circle cx="12" cy="10" r="4" fill="white" opacity="0.4" />
                    <rect x="6" y="16" width="12" height="2" fill="white" opacity="0.3" />
                </svg>
            ),
            booklets: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M4 4h7v16H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    <path d="M13 4h7a2 2 0 012 2v12a2 2 0 01-2 2h-7V4z" opacity="0.7" />
                </svg>
            ),
            banners: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <rect x="5" y="9" width="8" height="2" fill="white" opacity="0.4" />
                    <rect x="5" y="13" width="4" height="1" fill="white" opacity="0.3" />
                </svg>
            ),
        },
        preview: "text-primary",
    },
    {
        id: "gradient",
        name: "Gradient",
        description: "Farverige gradientikoner",
        author: "Webprinter",
        isPremium: true,
        price: 49,
        icons: {
            flyers: (
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                    </defs>
                    <rect x="4" y="2" width="16" height="20" rx="2" fill="url(#grad1)" />
                </svg>
            ),
            folders: (
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <defs>
                        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                    </defs>
                    <path d="M4 4h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" fill="url(#grad2)" />
                </svg>
            ),
            salesFolders: (
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <defs>
                        <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#EF4444" />
                        </linearGradient>
                    </defs>
                    <path d="M4 4h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" fill="url(#grad3)" />
                </svg>
            ),
            posters: (
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <defs>
                        <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#EC4899" />
                            <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                    </defs>
                    <rect x="3" y="2" width="18" height="20" rx="2" fill="url(#grad4)" />
                </svg>
            ),
            booklets: (
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <defs>
                        <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06B6D4" />
                            <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                    </defs>
                    <rect x="2" y="4" width="20" height="16" rx="2" fill="url(#grad5)" />
                </svg>
            ),
            banners: (
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <defs>
                        <linearGradient id="grad6" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#14B8A6" />
                            <stop offset="100%" stopColor="#22C55E" />
                        </linearGradient>
                    </defs>
                    <rect x="2" y="6" width="20" height="12" rx="2" fill="url(#grad6)" />
                </svg>
            ),
        },
        preview: "text-purple-500",
    },
    {
        id: "outline",
        name: "Outline Pro",
        description: "Tynde, elegante linjer",
        author: "Webprinter",
        isPremium: true,
        price: 29,
        icons: {
            flyers: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <line x1="7" y1="6" x2="17" y2="6" />
                    <line x1="7" y1="10" x2="14" y2="10" />
                    <line x1="7" y1="14" x2="12" y2="14" />
                </svg>
            ),
            folders: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                    <path d="M4 4h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
            ),
            salesFolders: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                    <path d="M4 4h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    <path d="M14 11l2 2 4-4" />
                </svg>
            ),
            posters: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                    <rect x="3" y="2" width="18" height="20" rx="2" />
                    <circle cx="12" cy="10" r="3" />
                    <line x1="6" y1="16" x2="18" y2="16" />
                </svg>
            ),
            booklets: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                    <path d="M2 6a2 2 0 012-2h7v16H4a2 2 0 01-2-2V6z" />
                    <path d="M13 4h7a2 2 0 012 2v12a2 2 0 01-2 2h-7V4z" />
                </svg>
            ),
            banners: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <line x1="6" y1="10" x2="14" y2="10" />
                    <line x1="6" y1="14" x2="10" y2="14" />
                </svg>
            ),
        },
        preview: "text-gray-700",
    },
];

interface IconPackSelectorProps {
    selectedPackId: string;
    onChange: (packId: string) => void;
}

export function IconPackSelector({ selectedPackId, onChange }: IconPackSelectorProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Ikon Pakker
                </CardTitle>
                <CardDescription>
                    Vælg et ikontema til dine produktkategorier
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                    {ICON_PACKS.map((pack) => {
                        const isSelected = selectedPackId === pack.id;
                        const isLocked = pack.isPremium; // For now, premium packs are still selectable

                        return (
                            <div
                                key={pack.id}
                                onClick={() => onChange(pack.id)}
                                className={cn(
                                    "relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md",
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

                                {/* Pack Info */}
                                <div>
                                    <h4 className="font-semibold text-sm">{pack.name}</h4>
                                    <p className="text-xs text-muted-foreground">{pack.description}</p>
                                </div>
                            </div>
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
