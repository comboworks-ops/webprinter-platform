import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
    Paintbrush,
    Calculator,
    Printer,
    Building2,
    Palette,
    Share2,
    ArrowRight,
    Sparkles,
    Lock,
    CheckCircle2,
    Clock,
    Zap,
    Play,
    Crown,
    Gift,
    ExternalLink
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface ShopModule {
    id: string;
    name: string;
    description: string;
    longDescription: string;
    icon: React.ReactNode;
    status: 'active' | 'inactive' | 'coming_soon';
    tier: 'free' | 'premium';
    route?: string;
    features: string[];
    color: string;
    previewImage?: string;
    previewVideo?: string;
    price?: string;
}

const SHOP_MODULES: ShopModule[] = [
    {
        id: 'print-designer',
        name: 'Print Designer',
        description: 'Online designværktøj til tryksager',
        longDescription: 'Giv dine kunder mulighed for at designe deres egne tryksager direkte i browseren. Upload billeder, tilføj tekst, og eksporter print-klare PDF-filer med korrekte bleed og skæremærker.',
        icon: <Paintbrush className="h-8 w-8" />,
        status: 'active',
        tier: 'free',
        route: '/admin/designer-templates',
        features: [
            'Drag & drop editor',
            'Billede upload & redigering',
            'Soft proof med ICC profiler',
            'PDF eksport med bleed',
            'Skabeloner & design bibliotek'
        ],
        color: 'from-purple-500 to-pink-500',
        previewImage: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=450&fit=crop',
    },
    {
        id: 'site-design',
        name: 'Site Design',
        description: 'Branding og temaindstillinger',
        longDescription: 'Tilpas din webshop med dit eget logo, farver, skrifttyper og layout. Skab en unik oplevelse der matcher din virksomheds identitet.',
        icon: <Palette className="h-8 w-8" />,
        status: 'active',
        tier: 'free',
        route: '/admin/branding-v2',
        features: [
            'Logo & favicons',
            'Farvetemaer',
            'Typografi',
            'Bannere & billeder',
            'Navigation'
        ],
        color: 'from-indigo-500 to-violet-500',
        previewImage: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=450&fit=crop',
    },
    {
        id: 'machine-pricing',
        name: 'Maskin-beregning',
        description: 'Automatisk prisberegning baseret på maskiner',
        longDescription: 'Beregn automatisk produktpriser baseret på dine maskiner, materialeomkostninger og produktionstid. Perfekt til trykkerier der vil have præcise og dynamiske priser.',
        icon: <Calculator className="h-8 w-8" />,
        status: 'active',
        tier: 'premium',
        route: '/admin/machine-pricing',
        features: [
            'Maskinprofiler',
            'Materialeomkostninger',
            'Produktionstidsberegning',
            'Avanceberegning',
            'Automatisk prisopdatering'
        ],
        color: 'from-blue-500 to-cyan-500',
        previewImage: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=450&fit=crop',
        price: 'Fra 299 kr/md',
    },
    {
        id: 'print-on-demand',
        name: 'Print on Demand',
        description: 'Dropshipping af tryksager',
        longDescription: 'Sælg produkter uden at have dem på lager. Når en kunde bestiller, sendes ordren automatisk til produktion hos en partner, der printer og sender direkte til kunden.',
        icon: <Printer className="h-8 w-8" />,
        status: 'active',
        tier: 'premium',
        route: '/admin/pod-katalog',
        features: [
            'POD produktkatalog',
            'Automatisk ordrebehandling',
            'Direkte levering til kunde',
            'Integration med produktion',
            'Øget avance'
        ],
        color: 'from-green-500 to-emerald-500',
        previewImage: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&h=450&fit=crop',
        price: 'Fra 499 kr/md',
    },
    {
        id: 'company-hub',
        name: 'Company Hub',
        description: 'B2B portal for erhvervskunder',
        longDescription: 'Giv dine erhvervskunder en dedikeret portal med specialpriser, godkendelsesflows, og centraliseret ordrestyring. Perfekt til virksomheder med gentagende ordrer.',
        icon: <Building2 className="h-8 w-8" />,
        status: 'active',
        tier: 'premium',
        route: '/admin/companyhub',
        features: [
            'Virksomhedsprofiler',
            'Specialpriser per kunde',
            'Godkendelsesworkflows',
            'Ordrehistorik',
            'Budgetkontrol'
        ],
        color: 'from-orange-500 to-amber-500',
        previewImage: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=450&fit=crop',
        price: 'Fra 399 kr/md',
    },
    {
        id: 'social-hub',
        name: 'Social Hub',
        description: 'Social medie integration',
        longDescription: 'Integrer din webshop med sociale medier. Del produkter, saml anmeldelser, og skab engagement med dine kunder på tværs af platforme.',
        icon: <Share2 className="h-8 w-8" />,
        status: 'coming_soon',
        tier: 'premium',
        features: [
            'Facebook & Instagram integration',
            'Produktdeling',
            'Kundeanmeldelser',
            'Social login',
            'Influencer samarbejde'
        ],
        color: 'from-rose-500 to-pink-500',
        previewImage: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop',
        price: 'Pris annonceres snart',
    }
];

export function ShopModules() {
    const navigate = useNavigate();
    const [previewModule, setPreviewModule] = useState<ShopModule | null>(null);

    const getStatusBadge = (status: ShopModule['status']) => {
        switch (status) {
            case 'active':
                return (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Aktiv
                    </Badge>
                );
            case 'inactive':
                return (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <Lock className="h-3 w-3 mr-1" />
                        Inaktiv
                    </Badge>
                );
            case 'coming_soon':
                return (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100">
                        <Clock className="h-3 w-3 mr-1" />
                        Kommer snart
                    </Badge>
                );
        }
    };

    const getTierBadge = (tier: ShopModule['tier']) => {
        if (tier === 'free') {
            return (
                <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
                    <Gift className="h-3 w-3 mr-1" />
                    Gratis
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                <Crown className="h-3 w-3 mr-1" />
                Premium
            </Badge>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Zap className="h-8 w-8 text-primary" />
                        Shop Moduler
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Udforsk de forskellige moduler der er tilgængelige til din webshop.
                        Nogle moduler er inkluderet gratis, mens andre kræver et abonnement.
                    </p>
                </div>
            </div>

            {/* Free Modules Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-green-600" />
                    <h2 className="text-xl font-semibold">Inkluderet i dit abonnement</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    {SHOP_MODULES.filter(m => m.tier === 'free').map((module) => (
                        <ModuleCard
                            key={module.id}
                            module={module}
                            onPreview={() => setPreviewModule(module)}
                            onNavigate={() => module.route && navigate(module.route)}
                            getStatusBadge={getStatusBadge}
                            getTierBadge={getTierBadge}
                        />
                    ))}
                </div>
            </div>

            {/* Premium Modules Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-600" />
                    <h2 className="text-xl font-semibold">Premium Moduler</h2>
                    <span className="text-sm text-muted-foreground">(Tilkøb)</span>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                    {SHOP_MODULES.filter(m => m.tier === 'premium').map((module) => (
                        <ModuleCard
                            key={module.id}
                            module={module}
                            onPreview={() => setPreviewModule(module)}
                            onNavigate={() => module.route && navigate(module.route)}
                            getStatusBadge={getStatusBadge}
                            getTierBadge={getTierBadge}
                        />
                    ))}
                </div>
            </div>

            {/* Info Banner */}
            <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
                <CardContent className="flex flex-col md:flex-row items-center gap-6 py-6">
                    <div className="p-4 bg-primary/10 rounded-full">
                        <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-lg font-semibold">Har du brug for hjælp til at vælge?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Kontakt os for en uforpligtende snak om hvilke moduler der passer til din forretning.
                            Vi tilbyder også skræddersyede løsninger.
                        </p>
                    </div>
                    <Button variant="outline" className="shrink-0">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Kontakt os
                    </Button>
                </CardContent>
            </Card>

            {/* Preview Dialog */}
            <Dialog open={!!previewModule} onOpenChange={() => setPreviewModule(null)}>
                <DialogContent className="max-w-4xl">
                    {previewModule && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${previewModule.color} text-white`}>
                                        {previewModule.icon}
                                    </div>
                                    {previewModule.name}
                                    {getTierBadge(previewModule.tier)}
                                </DialogTitle>
                                <DialogDescription>
                                    {previewModule.description}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Preview Image/Video */}
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                                {previewModule.previewVideo ? (
                                    <video
                                        src={previewModule.previewVideo}
                                        controls
                                        className="w-full h-full object-cover"
                                        poster={previewModule.previewImage}
                                    />
                                ) : previewModule.previewImage ? (
                                    <img
                                        src={previewModule.previewImage}
                                        alt={previewModule.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <Play className="h-16 w-16 text-muted-foreground" />
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <p className="text-muted-foreground">
                                {previewModule.longDescription}
                            </p>

                            {/* Features */}
                            <div className="grid grid-cols-2 gap-2">
                                {previewModule.features.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                {previewModule.price && (
                                    <div className="text-lg font-semibold text-primary">
                                        {previewModule.price}
                                    </div>
                                )}
                                <div className="flex gap-2 ml-auto">
                                    <Button variant="outline" onClick={() => setPreviewModule(null)}>
                                        Luk
                                    </Button>
                                    {previewModule.route && previewModule.status !== 'coming_soon' && (
                                        <Button onClick={() => {
                                            navigate(previewModule.route!);
                                            setPreviewModule(null);
                                        }}>
                                            {previewModule.tier === 'premium' ? 'Prøv nu' : 'Åbn modul'}
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Separate card component for cleaner code
function ModuleCard({
    module,
    onPreview,
    onNavigate,
    getStatusBadge,
    getTierBadge
}: {
    module: ShopModule;
    onPreview: () => void;
    onNavigate: () => void;
    getStatusBadge: (status: ShopModule['status']) => React.ReactNode;
    getTierBadge: (tier: ShopModule['tier']) => React.ReactNode;
}) {
    return (
        <Card
            className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl ${module.status === 'coming_soon' ? 'opacity-80' : ''
                }`}
        >
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-5 group-hover:opacity-10 transition-opacity`} />

            {/* Preview Image */}
            {module.previewImage && (
                <div
                    className="relative h-40 overflow-hidden cursor-pointer group/preview"
                    onClick={onPreview}
                >
                    <img
                        src={module.previewImage}
                        alt={module.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                            <Play className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    {/* Tier badge on image */}
                    <div className="absolute top-3 right-3">
                        {getTierBadge(module.tier)}
                    </div>
                </div>
            )}

            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${module.color} text-white shadow-lg`}>
                        {module.icon}
                    </div>
                    {getStatusBadge(module.status)}
                </div>
                <CardTitle className="mt-4 text-xl">{module.name}</CardTitle>
                <CardDescription className="text-sm">
                    {module.description}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Price indicator for premium */}
                {module.tier === 'premium' && module.price && (
                    <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        {module.price}
                    </div>
                )}

                {/* Features List - Condensed */}
                <ul className="space-y-1.5">
                    {module.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                            <Sparkles className="h-3 w-3 text-primary shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                    {module.features.length > 3 && (
                        <li className="text-xs text-muted-foreground ml-5">
                            +{module.features.length - 3} flere...
                        </li>
                    )}
                </ul>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={onPreview}
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Se preview
                    </Button>

                    {module.route && module.status !== 'coming_soon' ? (
                        <Button
                            size="sm"
                            className="flex-1"
                            onClick={onNavigate}
                        >
                            {module.tier === 'premium' ? 'Tilføj' : 'Åbn'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : module.status === 'coming_soon' ? (
                        <Button variant="secondary" size="sm" className="flex-1" disabled>
                            <Clock className="mr-2 h-4 w-4" />
                            Kommer snart
                        </Button>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

export default ShopModules;
