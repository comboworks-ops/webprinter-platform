
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Loader2, Save, RotateCcw, Send, Trash2, List,
    X, ChevronRight, Layout, Type, Palette, Sparkles, Image as ImageIcon, FileText,
    ExternalLink, Monitor, Smartphone, Tablet, FolderUp, LayoutTemplate, ShoppingCart, Mail, Users,
    Pencil, Eye, EyeOff, Check, History
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { da } from "date-fns/locale";

import { BrandingPreviewFrame } from "@/components/admin/BrandingPreviewFrame";
import { FontSelector } from "@/components/admin/FontSelector";
import { IconPackSelector } from "@/components/admin/IconPackSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Slider } from "@/components/ui/slider";
import { ProductAssetsSection } from "@/components/admin/ProductAssetsSection";
import { HeaderSection } from "@/components/admin/HeaderSection";
import { FooterSection } from "@/components/admin/FooterSection";
import { BannerEditor } from "@/components/admin/BannerEditor";
import { LogoSection } from "@/components/admin/LogoSection";
import { FaviconEditor } from "@/components/admin/FaviconEditor";
import { ContentBlocksSection } from "@/components/admin/ContentBlocksSection";
import { Banner2Section } from "@/components/admin/Banner2Section";
import { LowerInfoSection } from "@/components/admin/LowerInfoSection";
import { PendingPurchasesDialog, PendingPurchasesBadge } from "@/components/admin/PendingPurchasesDialog";
import { ThemeSelector } from "@/components/admin/ThemeSelector";
import { supabase } from "@/integrations/supabase/client";
import { usePaidItems } from "@/hooks/usePaidItems";
import { DEFAULT_BRANDING } from "@/hooks/useBrandingDraft";

import {
    type BrandingStorageAdapter,
    type BrandingCapabilities,
    useBrandingEditor,
} from "@/lib/branding";

interface BrandingEditorV2Props {
    adapter: BrandingStorageAdapter;
    capabilities: BrandingCapabilities;
    onSwitchVersion?: () => void;
}

type PreviewPageLink = {
    label: string;
    path: string;
    action?: 'first-product';
};

const PREVIEW_PAGE_LINKS: PreviewPageLink[] = [
    { label: "Forside", path: "/" },
    { label: "Bestilling", path: "/produkter", action: "first-product" },
    { label: "Grafisk vejledning", path: "/grafisk-vejledning" },
    { label: "Kontakt", path: "/kontakt" },
    { label: "Om os", path: "/om-os" },
];

const slugifyPageName = (value: string) => {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "aa")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return normalized || "side";
};

const makeUniquePath = (basePath: string, existingPaths: Set<string>) => {
    if (!existingPaths.has(basePath)) return basePath;
    let counter = 2;
    let candidate = `${basePath}-${counter}`;
    while (existingPaths.has(candidate)) {
        counter += 1;
        candidate = `${basePath}-${counter}`;
    }
    return candidate;
};

export function BrandingEditorV2({ adapter, capabilities, onSwitchVersion }: BrandingEditorV2Props) {
    const editor = useBrandingEditor({ adapter, capabilities });
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [currentPreviewPage, setCurrentPreviewPage] = useState<string>('/');

    // Paid items management (only for tenants)
    const paidItems = usePaidItems(editor.mode === 'tenant' ? editor.entityId : null);
    const [showPendingPurchasesDialog, setShowPendingPurchasesDialog] = useState(false);

    // Dialog States
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [publishLabel, setPublishLabel] = useState("");
    const [showSaveDesignDialog, setShowSaveDesignDialog] = useState(false);
    const [saveDesignName, setSaveDesignName] = useState("");
    const [showSavedDesignsDialog, setShowSavedDesignsDialog] = useState(false);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [showNewPageDialog, setShowNewPageDialog] = useState(false);
    const [showNewSubpageDialog, setShowNewSubpageDialog] = useState(false);
    const [newPageName, setNewPageName] = useState("");
    const [newSubpageName, setNewSubpageName] = useState("");
    const [newSubpageParentPath, setNewSubpageParentPath] = useState<string>("");

    // Premade Designs feature
    const [showSaveToResourcesDialog, setShowSaveToResourcesDialog] = useState(false);
    const [resourceDesignName, setResourceDesignName] = useState("");
    const [resourceDesignDescription, setResourceDesignDescription] = useState("");
    const [resourceDesignPrice, setResourceDesignPrice] = useState(0);
    const [resourceDesignVisible, setResourceDesignVisible] = useState(true);
    const [showPremadeDesignsDialog, setShowPremadeDesignsDialog] = useState(false);
    const [availablePremadeDesigns, setAvailablePremadeDesigns] = useState<any[]>([]);
    const [loadingPremadeDesigns, setLoadingPremadeDesigns] = useState(false);
    const [capturingThumbnail, setCapturingThumbnail] = useState(false);

    // Saved Premade Designs management (Master)
    const [showSavedPremadeDesignsDialog, setShowSavedPremadeDesignsDialog] = useState(false);
    const [savedPremadeDesigns, setSavedPremadeDesigns] = useState<any[]>([]);
    const [loadingSavedDesigns, setLoadingSavedDesigns] = useState(false);
    const [tenantList, setTenantList] = useState<any[]>([]);

    // Edit premade design state
    const [editingDesign, setEditingDesign] = useState<{
        id: string;
        name: string;
        description: string;
        price: number;
        is_visible: boolean;
        thumbnail_url?: string;
    } | null>(null);
    const [savingDesignEdit, setSavingDesignEdit] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
    const [grafiskUploadingItem, setGrafiskUploadingItem] = useState<string | null>(null);
    const [contactMapUploading, setContactMapUploading] = useState(false);
    const [aboutMediaUploading, setAboutMediaUploading] = useState(false);
    const [aboutGalleryUploading, setAboutGalleryUploading] = useState(false);
    const [aboutFeatureUploading, setAboutFeatureUploading] = useState<string | null>(null);

    // Ref for screenshot capture promise resolution
    const screenshotResolverRef = useRef<{ resolve: (url: string | null) => void; reject: (err: any) => void } | null>(null);

    // Listen for click events from preview AND screenshot responses
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'EDIT_SECTION') {
                const { sectionId } = event.data;
                console.log("Branding Editor received click:", sectionId);

                // Map branding IDs to internal sections
                if (sectionId === 'header.logo') {
                    setActiveSection('logo');
                } else if (sectionId === 'header' || sectionId === 'header.menu') {
                    setActiveSection('header');
                } else if (sectionId === 'forside.hero') {
                    setActiveSection('banner');
                } else if (sectionId === 'footer') {
                    setActiveSection('footer');
                } else if (sectionId === 'banner2') {
                    setActiveSection('banner2');
                } else if (sectionId === 'lower-info') {
                    setActiveSection('lower-info');
                } else if (sectionId === 'content' || sectionId.startsWith('block-')) {
                    setActiveSection('content');
                    if (sectionId.startsWith('block-')) {
                        setFocusedBlockId(sectionId);
                    }
                } else {
                    // Fallback or generic handling
                    setActiveSection(sectionId);
                }

                setSidebarOpen(true);
            }
            if (event.data?.type === 'PREVIEW_PAGE_CHANGED') {
                const path = typeof event.data.path === 'string' ? event.data.path : '/';
                setCurrentPreviewPage(path);
                if (!path.startsWith('/produkt')) {
                    setActiveSection(null);
                }
            }

            // Handle screenshot capture response
            if (event.data?.type === 'SCREENSHOT_CAPTURED' && screenshotResolverRef.current) {
                screenshotResolverRef.current.resolve(event.data.dataUrl);
                screenshotResolverRef.current = null;
            }
            if (event.data?.type === 'SCREENSHOT_ERROR' && screenshotResolverRef.current) {
                console.error('Screenshot error:', event.data.error);
                screenshotResolverRef.current.resolve(null); // Resolve with null instead of rejecting
                screenshotResolverRef.current = null;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Capture and upload a thumbnail from the preview iframe
    const capturePreviewThumbnail = useCallback(async (): Promise<string | null> => {
        setCapturingThumbnail(true);
        try {
            // Find the preview iframe
            const iframe = document.querySelector('iframe[title="Branding Preview"]') as HTMLIFrameElement;
            if (!iframe || !iframe.contentWindow) {
                console.warn('Preview iframe not found');
                return null;
            }

            // Request screenshot from iframe
            const requestId = Date.now().toString();
            const screenshotPromise = new Promise<string | null>((resolve, reject) => {
                screenshotResolverRef.current = { resolve, reject };

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (screenshotResolverRef.current) {
                        screenshotResolverRef.current.resolve(null);
                        screenshotResolverRef.current = null;
                    }
                }, 10000);
            });

            iframe.contentWindow.postMessage({ type: 'CAPTURE_SCREENSHOT', requestId }, '*');

            const dataUrl = await screenshotPromise;
            if (!dataUrl) {
                console.warn('Screenshot capture failed or timed out');
                return null;
            }

            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // Upload to Supabase storage
            const fileName = `premade-thumb-${Date.now()}.jpg`;
            const filePath = `premade-designs/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, blob, { contentType: 'image/jpeg' });

            if (uploadError) {
                console.error('Thumbnail upload error:', uploadError);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error capturing thumbnail:', error);
            return null;
        } finally {
            setCapturingThumbnail(false);
        }
    }, []);

    const navigatePreviewTo = useCallback((path: string) => {
        const iframe = document.querySelector('iframe[title="Branding Preview"]') as HTMLIFrameElement | null;
        if (!iframe?.contentWindow) {
            toast.error("Preview er ikke klar endnu");
            return;
        }
        setCurrentPreviewPage(path);
        iframe.contentWindow.postMessage({ type: 'NAVIGATE_TO', path }, '*');
    }, []);

    const navigatePreviewToFirstProduct = useCallback(() => {
        const iframe = document.querySelector('iframe[title="Branding Preview"]') as HTMLIFrameElement | null;
        if (!iframe?.contentWindow) {
            toast.error("Preview er ikke klar endnu");
            return;
        }
        setCurrentPreviewPage('/produkt');
        iframe.contentWindow.postMessage({ type: 'NAVIGATE_TO_FIRST_PRODUCT' }, '*');
    }, []);

    const handleCreatePage = () => {
        const name = newPageName.trim();
        if (!name) {
            toast.error("Giv siden et navn");
            return;
        }
        const slug = slugifyPageName(name);
        const existingPaths = new Set([
            ...PREVIEW_PAGE_LINKS.map((page) => page.path),
            ...customPages.map((page) => page.path),
        ]);
        const basePath = `/side/${slug}`;
        const path = makeUniquePath(basePath, existingPaths);
        const newPage = {
            id: `page-${Date.now()}`,
            title: name,
            path,
            type: "page" as const,
            parentPath: null,
            createdAt: new Date().toISOString(),
        };
        const nextPages = [...customPages, newPage];

        const navItems = editor.draft.header.navItems || [];
        const nextNavItems = navItems.some((item) => item.href === path)
            ? navItems
            : [
                ...navItems,
                {
                    id: `custom-${newPage.id}`,
                    label: newPage.title,
                    href: newPage.path,
                    isVisible: true,
                    order: (navItems.reduce((max, item) => Math.max(max, item.order), -1) + 1),
                },
            ];

        editor.updateDraft({
            pages: { items: nextPages },
            header: { navItems: nextNavItems },
        });
        setNewPageName("");
        setShowNewPageDialog(false);
        navigatePreviewTo(path);
        toast.success("Side oprettet");
    };

    const handleCreateSubpage = () => {
        const name = newSubpageName.trim();
        if (!name) {
            toast.error("Giv undersiden et navn");
            return;
        }
        if (!newSubpageParentPath) {
            toast.error("Vælg en overordnet side");
            return;
        }
        const slug = slugifyPageName(name);
        const parentBase = newSubpageParentPath.replace(/\/$/, "");
        const existingPaths = new Set([
            ...PREVIEW_PAGE_LINKS.map((page) => page.path),
            ...customPages.map((page) => page.path),
        ]);
        const basePath = `${parentBase}/${slug}`;
        const path = makeUniquePath(basePath, existingPaths);
        const newPage = {
            id: `page-${Date.now()}`,
            title: name,
            path,
            type: "subpage" as const,
            parentPath: newSubpageParentPath,
            createdAt: new Date().toISOString(),
        };
        const nextPages = [...customPages, newPage];

        editor.updateDraft({
            pages: { items: nextPages },
        });
        setNewSubpageName("");
        setNewSubpageParentPath("");
        setShowNewSubpageDialog(false);
        navigatePreviewTo(path);
        toast.success("Underside oprettet");
    };

    const resetGlobalText = () => {
        editor.updateDraft({
            fonts: { ...DEFAULT_BRANDING.fonts },
            colors: {
                titleText: DEFAULT_BRANDING.colors.titleText,
                subtitleText: DEFAULT_BRANDING.colors.subtitleText,
                headingText: DEFAULT_BRANDING.colors.headingText,
                bodyText: DEFAULT_BRANDING.colors.bodyText,
                systemText: DEFAULT_BRANDING.colors.systemText,
                buttonText: DEFAULT_BRANDING.colors.buttonText,
            },
        });
        toast.success("Tekst nulstillet");
    };

    const resetGlobalColors = async () => {
        const nextColors = { ...DEFAULT_BRANDING.colors };
        const nextDraft = { ...editor.draft, colors: nextColors };
        editor.updateDraft({ colors: nextColors });
        try {
            await editor.saveDraftSnapshot(nextDraft, { toast: false });
        } catch (error) {
            console.error('Auto-save after global reset failed:', error);
        }
        toast.success("Farver nulstillet");
    };

    const resetOrderButtons = () => {
        editor.updateDraft({
            productPage: {
                ...(editor.draft.productPage || {}),
                orderButtons: DEFAULT_BRANDING.productPage.orderButtons,
            },
        });
        toast.success("Bestillingsknapper nulstillet");
    };

    const resetMatrixStyles = () => {
        editor.updateDraft({
            productPage: {
                ...(editor.draft.productPage || {}),
                matrix: DEFAULT_BRANDING.productPage.matrix,
            },
        });
        toast.success("Matrix nulstillet");
    };


    const uploadGrafiskImageFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return null;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Billede må højst være 5MB');
            return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `grafisk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
        const filePath = `branding/${editor.entityId || 'master'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrl;
    }, [editor.entityId]);

    const uploadContactMapImageFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return null;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Billede må højst være 5MB');
            return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `contact-map-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
        const filePath = `branding/${editor.entityId || 'master'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrl;
    }, [editor.entityId]);

    const uploadAboutImageFile = useCallback(async (file: File, prefix: string) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return null;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Billede må højst være 5MB');
            return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
        const filePath = `branding/${editor.entityId || 'master'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrl;
    }, [editor.entityId]);

    // ... existing publish/save handlers ...

    // Handle Publish - checks for pending paid items first
    const handlePublish = async () => {
        // If tenant has pending paid items, show payment dialog instead
        if (editor.mode === 'tenant' && paidItems.hasPendingItems) {
            setShowPublishDialog(false);
            setShowPendingPurchasesDialog(true);
            return;
        }

        if (editor.hasUnsavedChanges) {
            await editor.saveDraft();
        }
        await editor.publish(publishLabel || undefined);
        setShowPublishDialog(false);
        setPublishLabel("");
    };

    // Handle publish after payment is complete
    const handlePublishAfterPayment = async () => {
        if (editor.hasUnsavedChanges) {
            await editor.saveDraft();
        }
        await editor.publish(publishLabel || undefined);
        setPublishLabel("");
    };

    // Handle Save Design
    const handleSaveDesign = async () => {
        if (!saveDesignName.trim()) {
            toast.error("Giv venligst dit design et navn");
            return;
        }
        await editor.saveDesign(saveDesignName);
        setSaveDesignName("");
        setShowSaveDesignDialog(false);
    };

    const formatDate = (timestamp: string) => {
        try {
            return format(new Date(timestamp), "d. MMM yyyy", { locale: da });
        } catch {
            return timestamp;
        }
    };

    const hasGlobal = capabilities.sections.typography || capabilities.sections.colors;
    const customPages = editor.draft.pages?.items || [];
    const allowedSections = useMemo(() => {
        const set = new Set<string>();
        // Theme selector is always available
        set.add('theme');
        if (hasGlobal) set.add('global');
        const isProductPage = currentPreviewPage.startsWith('/produkt');
        if (isProductPage) {
            if (capabilities.sections.logo) set.add('logo');
            if (capabilities.sections.header) set.add('header');
            if (capabilities.sections.footer) set.add('footer');
            set.add('product-page');
            set.add('product-page-matrix');
            set.add('page-extras');
            return set;
        }
        const isHomePage = currentPreviewPage === '/' || currentPreviewPage === '/shop' || currentPreviewPage === '/produkter' || currentPreviewPage === '/prisberegner';
        if (isHomePage) {
            if (capabilities.sections.logo) set.add('logo');
            if (capabilities.sections.header) set.add('header');
            set.add('banner');
            set.add('products');
            set.add('banner2');
            set.add('content');
            set.add('lower-info');
            if (capabilities.sections.footer) set.add('footer');
            if (capabilities.sections.iconPacks) set.add('icons');
            return set;
        }
        const isGrafiskPage = currentPreviewPage === '/grafisk-vejledning';
        if (isGrafiskPage) {
            set.add('grafisk-vejledning');
            set.add('page-extras');
        }
        const isContactPage = currentPreviewPage === '/kontakt';
        if (isContactPage) {
            set.add('contact');
            set.add('page-extras');
        }
        const isAboutPage = currentPreviewPage === '/om-os';
        if (isAboutPage) {
            set.add('about');
            set.add('page-extras');
        }
        if (capabilities.sections.logo) set.add('logo');
        if (capabilities.sections.header) set.add('header');
        if (capabilities.sections.footer) set.add('footer');
        return set;
    }, [currentPreviewPage, hasGlobal, capabilities.sections.footer, capabilities.sections.header, capabilities.sections.iconPacks, capabilities.sections.logo]);
    const parentPageOptions = useMemo(() => {
        const systemParents = PREVIEW_PAGE_LINKS
            .filter((page) => page.path !== "/" && !page.path.startsWith("/produkt/") && page.action !== "first-product")
            .map((page) => ({ label: page.label, path: page.path, source: "system" as const }));
        const customParents = customPages
            .filter((page) => page.type === "page")
            .map((page) => ({ label: page.title, path: page.path, source: "custom" as const }));
        return [...systemParents, ...customParents];
    }, [customPages]);

    const pageExtrasKey = useMemo(() => {
        if (currentPreviewPage.startsWith('/produkt') && !currentPreviewPage.startsWith('/produkter')) return 'product';
        if (currentPreviewPage === '/kontakt') return 'contact';
        if (currentPreviewPage === '/grafisk-vejledning') return 'grafisk';
        if (currentPreviewPage === '/om-os') return 'about';
        return null;
    }, [currentPreviewPage]);

    const pageExtrasLabel = useMemo(() => {
        switch (pageExtrasKey) {
            case 'product':
                return 'Bestilling';
            case 'contact':
                return 'Kontakt';
            case 'grafisk':
                return 'Grafisk vejledning';
            case 'about':
                return 'Om os';
            default:
                return '';
        }
    }, [pageExtrasKey]);

    useEffect(() => {
        if (activeSection && !allowedSections.has(activeSection)) {
            setActiveSection(null);
        }
    }, [activeSection, allowedSections]);

    if (editor.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const renderSidebarContent = () => {
        if (!activeSection) {
            return (
                <div className="space-y-2 p-3">
                    <h2 className="font-extrabold text-2xl text-foreground pb-4 px-1">
                        Vælg sektion:
                    </h2>
                    <div className="grid gap-2">
                        {allowedSections.has('global') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-teal-100 text-teal-900 hover:bg-teal-50/50 hover:border-teal-200 group"
                                onClick={() => setActiveSection('global')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-teal-100/50 flex items-center justify-center text-teal-600 group-hover:bg-teal-100 transition-colors">
                                    <Palette className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Global</span>
                            </button>
                        )}
                        {/* Theme Selector */}
                        <button
                            className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-violet-100 text-violet-900 hover:bg-violet-50/50 hover:border-violet-200 group"
                            onClick={() => setActiveSection('theme')}
                        >
                            <div className="h-8 w-8 rounded-lg bg-violet-100/50 flex items-center justify-center text-violet-600 group-hover:bg-violet-100 transition-colors">
                                <LayoutTemplate className="h-4 w-4" />
                            </div>
                            <span className="font-semibold">Tema</span>
                        </button>
                        <div className="rounded-xl border bg-white/90 px-3 py-2 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground">Sider</span>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[11px] font-semibold text-muted-foreground">Eksisterende</span>
                                <div className="flex flex-wrap gap-2">
                                    {PREVIEW_PAGE_LINKS.map((page) => (
                                        <Button
                                            key={page.path}
                                            variant="secondary"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => {
                                                if (page.action === "first-product") {
                                                    navigatePreviewToFirstProduct();
                                                    setActiveSection(null);
                                                } else {
                                                    navigatePreviewTo(page.path);
                                                    setActiveSection(null);
                                                }
                                            }}
                                        >
                                            {page.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            {customPages.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-[11px] font-semibold text-muted-foreground">Nye sider</span>
                                    <div className="flex flex-wrap gap-2">
                                        {[...customPages]
                                            .sort((a, b) => (a.type === b.type ? 0 : a.type === 'page' ? -1 : 1))
                                            .map((page) => {
                                                const isSubpage = page.type === 'subpage';
                                                return (
                                                    <Button
                                                        key={page.id}
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-[11px]"
                                                        onClick={() => {
                                                            navigatePreviewTo(page.path);
                                                            setActiveSection(null);
                                                        }}
                                                    >
                                                        {isSubpage ? `↳ ${page.title}` : page.title}
                                                    </Button>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-dashed bg-white/70 px-3 py-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground">Opret side</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setShowNewPageDialog(true)}
                                >
                                    + Ny side
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setShowNewSubpageDialog(true)}
                                    disabled={parentPageOptions.length === 0}
                                >
                                    + Ny underside
                                </Button>
                            </div>
                            {parentPageOptions.length === 0 && (
                                <p className="text-[11px] text-muted-foreground">Opret en side først</p>
                            )}
                        </div>
                        <Separator />
                        {allowedSections.has('logo') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-indigo-100 text-indigo-900 hover:bg-indigo-50/50 hover:border-indigo-200 group"
                                onClick={() => setActiveSection('logo')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-indigo-100/50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                    <ImageIcon className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Logo & Favicon</span>
                            </button>
                        )}
                        {allowedSections.has('header') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-slate-100 text-slate-900 hover:bg-slate-50/50 hover:border-slate-200 group"
                                onClick={() => setActiveSection('header')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-slate-100/50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 transition-colors">
                                    <Layout className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Header & Menu</span>
                            </button>
                        )}
                        {allowedSections.has('grafisk-vejledning') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-indigo-100 text-indigo-900 hover:bg-indigo-50/50 hover:border-indigo-200 group"
                                onClick={() => setActiveSection('grafisk-vejledning')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-indigo-100/50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Grafisk vejledning</span>
                            </button>
                        )}
                        {allowedSections.has('contact') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/50 hover:border-emerald-200 group"
                                onClick={() => setActiveSection('contact')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Kontakt</span>
                            </button>
                        )}
                        {allowedSections.has('about') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-fuchsia-100 text-fuchsia-900 hover:bg-fuchsia-50/50 hover:border-fuchsia-200 group"
                                onClick={() => setActiveSection('about')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-fuchsia-100/50 flex items-center justify-center text-fuchsia-600 group-hover:bg-fuchsia-100 transition-colors">
                                    <Users className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Om os</span>
                            </button>
                        )}
                        {allowedSections.has('page-extras') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-amber-100 text-amber-900 hover:bg-amber-50/50 hover:border-amber-200 group"
                                onClick={() => setActiveSection('page-extras')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-amber-100/50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                                    <List className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Ekstra indhold</span>
                            </button>
                        )}
                        {allowedSections.has('banner') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-blue-100 text-blue-900 hover:bg-blue-50/50 hover:border-blue-200 group"
                                onClick={() => setActiveSection('banner')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-blue-100/50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    <ImageIcon className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Banner (Hero)</span>
                            </button>
                        )}
                        {allowedSections.has('products') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-sky-100 text-sky-900 hover:bg-sky-50/50 hover:border-sky-200 group"
                                onClick={() => setActiveSection('products')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-sky-100/50 flex items-center justify-center text-sky-600 group-hover:bg-sky-100 transition-colors">
                                    <ShoppingCart className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Forside produkter</span>
                            </button>
                        )}
                        {allowedSections.has('product-page') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-amber-100 text-amber-900 hover:bg-amber-50/50 hover:border-amber-200 group"
                                onClick={() => {
                                    setActiveSection('product-page');
                                    navigatePreviewToFirstProduct();
                                }}
                            >
                                <div className="h-8 w-8 rounded-lg bg-amber-100/50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                                    <LayoutTemplate className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Bestilling</span>
                            </button>
                        )}
                        {allowedSections.has('product-page-matrix') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-rose-100 text-rose-900 hover:bg-rose-50/50 hover:border-rose-200 group"
                                onClick={() => setActiveSection('product-page-matrix')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-rose-100/50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors">
                                    <List className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Matrix system</span>
                            </button>
                        )}
                        {allowedSections.has('banner2') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-cyan-100 text-cyan-900 hover:bg-cyan-50/50 hover:border-cyan-200 group"
                                onClick={() => setActiveSection('banner2')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-cyan-100/50 flex items-center justify-center text-cyan-600 group-hover:bg-cyan-100 transition-colors">
                                    <Layout className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Banner 2</span>
                            </button>
                        )}
                        {allowedSections.has('content') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-violet-100 text-violet-900 hover:bg-violet-50/50 hover:border-violet-200 group"
                                onClick={() => setActiveSection('content')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-violet-100/50 flex items-center justify-center text-violet-600 group-hover:bg-violet-100 transition-colors">
                                    <Layout className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Indholdsblokke</span>
                            </button>
                        )}
                        {allowedSections.has('lower-info') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/50 hover:border-emerald-200 group"
                                onClick={() => setActiveSection('lower-info')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                                    <Layout className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Nedre info</span>
                            </button>
                        )}
                        {allowedSections.has('footer') && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-slate-100 text-slate-900 hover:bg-slate-50/50 hover:border-slate-200 group"
                                onClick={() => setActiveSection('footer')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-slate-100/50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 transition-colors">
                                    <Layout className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Footer</span>
                            </button>
                        )}
                        {allowedSections.has('icons') && capabilities.sections.iconPacks && (
                            <button
                                className="menu-btn-item flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all hover:shadow-md bg-white border-emerald-100 text-emerald-900 hover:bg-emerald-50/50 hover:border-emerald-200 group"
                                onClick={() => setActiveSection('icons')}
                            >
                                <div className="h-8 w-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">Produktbilleder (Ikoner)</span>
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        switch (activeSection) {
            case 'theme':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Tema</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <ThemeSelector
                            selectedThemeId={editor.draft.themeId || 'classic'}
                            onThemeChange={(themeId) => {
                                editor.updateDraft({ themeId });
                            }}
                            themeSettings={editor.draft.themeSettings}
                            onThemeSettingsChange={(themeSettings) => {
                                editor.updateDraft({ themeSettings });
                            }}
                        />
                    </div>
                );
            case 'logo':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Logo & Favicon</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <LogoSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />

                        {/* Favicon Editor */}
                        <FaviconEditor
                            favicon={editor.draft.favicon}
                            onChange={(favicon) => editor.updateDraft({ favicon })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                            tenantId={editor.entityId}
                        />
                    </div>
                );
            case 'header':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Header</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <HeaderSection
                            header={editor.draft.header}
                            onChange={(header) => editor.updateDraft({ header })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'global': {
                const colors = editor.draft.colors;
                const backgroundType = colors.backgroundType || "solid";
                const gradientType = colors.backgroundGradientType || "linear";
                const gradientAngle = typeof colors.backgroundGradientAngle === "number"
                    ? colors.backgroundGradientAngle
                    : 135;
                const gradientStart = colors.backgroundGradientStart || colors.background || "#F8FAFC";
                const gradientEnd = colors.backgroundGradientEnd || colors.secondary || "#E2E8F0";
                const useMiddle = colors.backgroundGradientUseMiddle ?? false;
                const gradientMiddle = colors.backgroundGradientMiddle || gradientStart;
                const gradientStops = useMiddle
                    ? `${gradientStart}, ${gradientMiddle}, ${gradientEnd}`
                    : `${gradientStart}, ${gradientEnd}`;
                const gradientPreview = gradientType === "radial"
                    ? `radial-gradient(circle, ${gradientStops})`
                    : `linear-gradient(${gradientAngle}deg, ${gradientStops})`;

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Global</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <div className="space-y-4 pt-2">
                            {capabilities.sections.typography && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Type className="h-4 w-4 text-muted-foreground" />
                                            <h4 className="text-sm font-semibold">Tekst (global)</h4>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetGlobalText}>Nulstil</Button>
                                    </div>
                                    <div className="space-y-2">
                                        <FontSelector
                                            label="Titel"
                                            inline
                                            value={editor.draft.fonts.title || editor.draft.fonts.heading}
                                            onChange={(v) => editor.updateDraft({
                                                fonts: { ...editor.draft.fonts, title: v, heading: v }
                                            })}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Titel farve"
                                            inline
                                            value={editor.draft.colors.titleText || editor.draft.colors.headingText || "#1F2937"}
                                            onChange={(color) => editor.updateDraft({
                                                colors: { ...editor.draft.colors, titleText: color }
                                            })}
                                            compact={true}
                                            showFullSwatches={false}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <FontSelector
                                            label="Overskrifter"
                                            inline
                                            value={editor.draft.fonts.subtitle || editor.draft.fonts.heading}
                                            onChange={(v) => editor.updateDraft({
                                                fonts: { ...editor.draft.fonts, subtitle: v }
                                            })}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Overskrift farve"
                                            inline
                                            value={editor.draft.colors.subtitleText || editor.draft.colors.headingText || "#1F2937"}
                                            onChange={(color) => editor.updateDraft({
                                                colors: { ...editor.draft.colors, subtitleText: color }
                                            })}
                                            compact={true}
                                            showFullSwatches={false}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <FontSelector
                                            label="Beskrivelse"
                                            inline
                                            value={editor.draft.fonts.description || editor.draft.fonts.body}
                                            onChange={(v) => editor.updateDraft({
                                                fonts: { ...editor.draft.fonts, description: v }
                                            })}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Beskrivelse farve"
                                            inline
                                            value={editor.draft.colors.bodyText}
                                            onChange={(color) => editor.updateDraft({
                                                colors: { ...editor.draft.colors, bodyText: color }
                                            })}
                                            compact={true}
                                            showFullSwatches={false}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <FontSelector
                                            label="System tekst"
                                            inline
                                            value={editor.draft.fonts.system || editor.draft.fonts.body}
                                            onChange={(v) => editor.updateDraft({
                                                fonts: { ...editor.draft.fonts, system: v, body: v }
                                            })}
                                        />
                                        <ColorPickerWithSwatches
                                            label="System tekst farve"
                                            inline
                                            value={editor.draft.colors.systemText || "#1F2937"}
                                            onChange={(color) => editor.updateDraft({
                                                colors: { ...editor.draft.colors, systemText: color }
                                            })}
                                            compact={true}
                                            showFullSwatches={false}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <FontSelector
                                            label="Knap tekst"
                                            inline
                                            value={editor.draft.fonts.button || editor.draft.fonts.body}
                                            onChange={(v) => editor.updateDraft({
                                                fonts: { ...editor.draft.fonts, button: v }
                                            })}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Knap tekst farve"
                                            inline
                                            value={editor.draft.colors.buttonText || "#FFFFFF"}
                                            onChange={(color) => editor.updateDraft({
                                                colors: { ...editor.draft.colors, buttonText: color }
                                            })}
                                            compact={true}
                                            showFullSwatches={false}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <FontSelector
                                        label="Pris-tal"
                                        inline
                                        value={editor.draft.fonts.pricing}
                                        onChange={(v) => editor.updateDraft({
                                            fonts: { ...editor.draft.fonts, pricing: v }
                                        })}
                                    />
                                </div>
                            )}
                            {capabilities.sections.typography && capabilities.sections.colors && (
                                <Separator />
                            )}
                            {capabilities.sections.colors && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Palette className="h-4 w-4 text-muted-foreground" />
                                            <h4 className="text-sm font-semibold">Farver (global)</h4>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetGlobalColors}>Nulstil</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Background</p>
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs text-muted-foreground">Type</Label>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant={backgroundType === "solid" ? "secondary" : "ghost"}
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => editor.updateDraft({
                                                            colors: { ...colors, backgroundType: "solid" }
                                                        })}
                                                    >
                                                        Farve
                                                    </Button>
                                                    <Button
                                                        variant={backgroundType === "gradient" ? "secondary" : "ghost"}
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => editor.updateDraft({
                                                            colors: { ...colors, backgroundType: "gradient" }
                                                        })}
                                                    >
                                                        Gradient
                                                    </Button>
                                                </div>
                                            </div>
                                            <ColorPickerWithSwatches
                                                label="Baggrundsfarve"
                                                inline
                                                value={colors.background}
                                                onChange={(color) => editor.updateDraft({
                                                    colors: { ...colors, background: color }
                                                })}
                                                compact={true}
                                                showFullSwatches={false}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            {backgroundType === "gradient" && (
                                                <div className="space-y-3 pt-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs text-muted-foreground">Gradient type</Label>
                                                        <Select
                                                            value={gradientType}
                                                            onValueChange={(value) => editor.updateDraft({
                                                                colors: { ...colors, backgroundGradientType: value as "linear" | "radial" }
                                                            })}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs w-32">
                                                                <SelectValue placeholder="Vælg type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="linear">Linear</SelectItem>
                                                                <SelectItem value="radial">Radial</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {gradientType === "linear" && (
                                                        <div className="flex items-center gap-3">
                                                            <Label className="text-xs text-muted-foreground w-14">Vinkel</Label>
                                                            <Slider
                                                                value={[gradientAngle]}
                                                                min={0}
                                                                max={360}
                                                                step={5}
                                                                onValueChange={(value) => editor.updateDraft({
                                                                    colors: { ...colors, backgroundGradientAngle: value[0] }
                                                                })}
                                                                className="flex-1"
                                                            />
                                                            <span className="text-xs w-10 text-right text-muted-foreground">{gradientAngle}°</span>
                                                        </div>
                                                    )}
                                                    <ColorPickerWithSwatches
                                                        label="Gradient start"
                                                        inline
                                                        value={gradientStart}
                                                        onChange={(color) => editor.updateDraft({
                                                            colors: { ...colors, backgroundGradientStart: color }
                                                        })}
                                                        compact={true}
                                                        showFullSwatches={false}
                                                        savedSwatches={editor.draft.savedSwatches}
                                                        onSaveSwatch={(color) => {
                                                            const swatches = editor.draft.savedSwatches || [];
                                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                            }
                                                        }}
                                                        onRemoveSwatch={(color) => {
                                                            editor.updateDraft({
                                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                            });
                                                        }}
                                                    />
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs text-muted-foreground">Midterfarve</Label>
                                                        <Switch
                                                            checked={useMiddle}
                                                            onCheckedChange={(checked) => editor.updateDraft({
                                                                colors: { ...colors, backgroundGradientUseMiddle: checked }
                                                            })}
                                                        />
                                                    </div>
                                                    {useMiddle && (
                                                        <ColorPickerWithSwatches
                                                            label="Gradient midte"
                                                            inline
                                                            value={gradientMiddle}
                                                            onChange={(color) => editor.updateDraft({
                                                                colors: { ...colors, backgroundGradientMiddle: color }
                                                            })}
                                                            compact={true}
                                                            showFullSwatches={false}
                                                            savedSwatches={editor.draft.savedSwatches}
                                                            onSaveSwatch={(color) => {
                                                                const swatches = editor.draft.savedSwatches || [];
                                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                                }
                                                            }}
                                                            onRemoveSwatch={(color) => {
                                                                editor.updateDraft({
                                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                                });
                                                            }}
                                                        />
                                                    )}
                                                    <ColorPickerWithSwatches
                                                        label="Gradient slut"
                                                        inline
                                                        value={gradientEnd}
                                                        onChange={(color) => editor.updateDraft({
                                                            colors: { ...colors, backgroundGradientEnd: color }
                                                        })}
                                                        compact={true}
                                                        showFullSwatches={false}
                                                        savedSwatches={editor.draft.savedSwatches}
                                                        onSaveSwatch={(color) => {
                                                            const swatches = editor.draft.savedSwatches || [];
                                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                            }
                                                        }}
                                                        onRemoveSwatch={(color) => {
                                                            editor.updateDraft({
                                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                            });
                                                        }}
                                                    />
                                                    <div
                                                        className="h-10 rounded-md border"
                                                        style={{ backgroundImage: gradientPreview, backgroundColor: colors.background }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">UI bokse</p>
                                            <ColorPickerWithSwatches
                                                label="UI bokse"
                                                inline
                                                value={editor.draft.colors.card}
                                                onChange={(color) => editor.updateDraft({
                                                    colors: { ...editor.draft.colors, card: color, dropdown: color }
                                                })}
                                                compact={true}
                                                showFullSwatches={false}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Knapper</p>
                                            <ColorPickerWithSwatches
                                                label="Knap farve"
                                                inline
                                                value={editor.draft.colors.primary}
                                                onChange={(color) => editor.updateDraft({
                                                    colors: { ...editor.draft.colors, primary: color }
                                                })}
                                                compact={true}
                                                showFullSwatches={false}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Faner (produkter)</p>
                                            <ColorPickerWithSwatches
                                                label="Fane (ikke valgt)"
                                                inline
                                                value={editor.draft.colors.tabInactiveBg || "#F1F5F9"}
                                                onChange={(color) => editor.updateDraft({
                                                    colors: { ...editor.draft.colors, tabInactiveBg: color }
                                                })}
                                                compact={true}
                                                showFullSwatches={false}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Hover (ikke valgt)"
                                                inline
                                                value={editor.draft.colors.tabInactiveHoverBg || "#E2E8F0"}
                                                onChange={(color) => editor.updateDraft({
                                                    colors: { ...editor.draft.colors, tabInactiveHoverBg: color }
                                                })}
                                                compact={true}
                                                showFullSwatches={false}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Hover (valgt)"
                                                inline
                                                value={editor.draft.colors.tabActiveHoverBg || editor.draft.colors.hover || "#0284C7"}
                                                onChange={(color) => editor.updateDraft({
                                                    colors: { ...editor.draft.colors, tabActiveHoverBg: color }
                                                })}
                                                compact={true}
                                                showFullSwatches={false}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!capabilities.sections.typography && !capabilities.sections.colors && (
                                <p className="text-sm text-muted-foreground">Ingen globale indstillinger tilgængelige.</p>
                            )}
                        </div>
                    </div>
                );
            }
            case 'banner':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Banner (Hero)</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <BannerEditor
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'banner2':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Banner 2</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <Banner2Section
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'content':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Indholdsblokke</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <ContentBlocksSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                            focusedBlockId={focusedBlockId}
                        />
                    </div>
                );
            case 'lower-info':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Nedre info</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <LowerInfoSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'products': {
                const forside = editor.draft.forside;
                const productsSection = forside.productsSection || { enabled: true, columns: 4 };
                const layoutStyle = productsSection.layoutStyle || 'cards';
                const buttonConfig = productsSection.button || {
                    style: 'default',
                    bgColor: '#0EA5E9',
                    hoverBgColor: '#0284C7',
                    textColor: '#FFFFFF',
                    hoverTextColor: '#FFFFFF',
                    font: 'Poppins',
                    animation: 'none'
                };
                const backgroundConfig = productsSection.background || {
                    type: 'solid',
                    color: '#FFFFFF',
                    gradientStart: '#FFFFFF',
                    gradientEnd: '#F1F5F9',
                    gradientAngle: 135,
                    opacity: 1,
                };
                const updateProductsSection = (updates: Partial<typeof productsSection>) => {
                    editor.updateDraft({
                        forside: {
                            ...forside,
                            productsSection: { ...productsSection, ...updates },
                        },
                    });
                };
                const updateButtonConfig = (updates: Partial<typeof buttonConfig>) => {
                    updateProductsSection({
                        button: { ...buttonConfig, ...updates },
                    });
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Forside produkter</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Produktbokse på forsiden</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Vælg hvor mange produktbokse der skal vises pr. række.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Vis forside produkter</Label>
                                    <Switch
                                        checked={productsSection.enabled}
                                        onCheckedChange={(checked) => updateProductsSection({ enabled: checked })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kolonner pr. række</Label>
                                    <Select
                                        value={String(productsSection.columns)}
                                        onValueChange={(value) => updateProductsSection({ columns: Number(value) as 3 | 4 | 5 })}
                                        disabled={!productsSection.enabled}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Vælg layout" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="3">3 kolonner</SelectItem>
                                            <SelectItem value="4">4 kolonner</SelectItem>
                                            <SelectItem value="5">5 kolonner</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Forside produkt layout</Label>
                                    <Select
                                        value={layoutStyle}
                                        onValueChange={(value) => updateProductsSection({ layoutStyle: value as typeof layoutStyle })}
                                        disabled={!productsSection.enabled}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Vælg layout" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cards">Standard (separate bokse)</SelectItem>
                                            <SelectItem value="flat">Ingen ramme</SelectItem>
                                            <SelectItem value="grouped">En samlet ramme</SelectItem>
                                            <SelectItem value="slim">Slim horisontal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Vis kategori knap</Label>
                                        <p className="text-xs text-muted-foreground">Skjuler fanen “Storformat print”</p>
                                    </div>
                                    <Switch
                                        checked={productsSection.showStorformatTab ?? true}
                                        onCheckedChange={(checked) => updateProductsSection({ showStorformatTab: checked })}
                                        disabled={!productsSection.enabled}
                                    />
                                </div>
                                <div className="space-y-3 border-t pt-4">
                                    <Label className="text-sm font-semibold">Knap design</Label>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Knap type</Label>
                                            <Select
                                                value={buttonConfig.style}
                                                onValueChange={(value) => updateButtonConfig({ style: value as typeof buttonConfig.style })}
                                                disabled={!productsSection.enabled}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="default">Standard (som nu)</SelectItem>
                                                    <SelectItem value="bar">Bund-bjælke</SelectItem>
                                                    <SelectItem value="center">Stor centreret</SelectItem>
                                                    <SelectItem value="hidden">Skjul knap</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Animation</Label>
                                            <Select
                                                value={buttonConfig.animation}
                                                onValueChange={(value) => updateButtonConfig({ animation: value as typeof buttonConfig.animation })}
                                                disabled={!productsSection.enabled}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Ingen</SelectItem>
                                                    <SelectItem value="lift">Løft</SelectItem>
                                                    <SelectItem value="glow">Glow</SelectItem>
                                                    <SelectItem value="pulse">Pulse</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <FontSelector
                                        label="Knap skrifttype"
                                        value={buttonConfig.font}
                                        onChange={(value) => updateButtonConfig({ font: value })}
                                        description="Vælger font for knapteksten"
                                    />
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        <ColorPickerWithSwatches
                                            label="Knap farve"
                                            value={buttonConfig.bgColor}
                                            onChange={(value) => updateButtonConfig({ bgColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover farve"
                                            value={buttonConfig.hoverBgColor}
                                            onChange={(value) => updateButtonConfig({ hoverBgColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst farve"
                                            value={buttonConfig.textColor}
                                            onChange={(value) => updateButtonConfig({ textColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-3 border-t pt-4">
                                        <Label className="text-sm font-semibold">Hover tekst</Label>
                                        <ColorPickerWithSwatches
                                            label="Hover tekstfarve"
                                            value={buttonConfig.hoverTextColor}
                                            onChange={(value) => updateButtonConfig({ hoverTextColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-3 border-t pt-4">
                                        <Label className="text-sm font-semibold">Produkt-baggrund</Label>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Baggrundstype</Label>
                                                <Select
                                                    value={backgroundConfig.type}
                                                    onValueChange={(value) => updateProductsSection({
                                                        background: { ...backgroundConfig, type: value as typeof backgroundConfig.type }
                                                    })}
                                                    disabled={!productsSection.enabled}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="solid">Farve</SelectItem>
                                                        <SelectItem value="gradient">Gradient</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Opacitet</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {Math.round(backgroundConfig.opacity * 100)}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[backgroundConfig.opacity * 100]}
                                                    onValueChange={([value]) => updateProductsSection({
                                                        background: { ...backgroundConfig, opacity: value / 100 }
                                                    })}
                                                    min={0}
                                                    max={100}
                                                    step={5}
                                                    className="py-1"
                                                />
                                            </div>
                                        </div>
                                        {backgroundConfig.type === 'solid' ? (
                                            <ColorPickerWithSwatches
                                                label="Baggrundsfarve"
                                                value={backgroundConfig.color}
                                                onChange={(value) => updateProductsSection({
                                                    background: { ...backgroundConfig, color: value }
                                                })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <ColorPickerWithSwatches
                                                        label="Gradient start"
                                                        value={backgroundConfig.gradientStart}
                                                        onChange={(value) => updateProductsSection({
                                                            background: { ...backgroundConfig, gradientStart: value }
                                                        })}
                                                        savedSwatches={editor.draft.savedSwatches}
                                                        onSaveSwatch={(color) => {
                                                            const swatches = editor.draft.savedSwatches || [];
                                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                            }
                                                        }}
                                                        onRemoveSwatch={(color) => {
                                                            editor.updateDraft({
                                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                            });
                                                        }}
                                                    />
                                                    <ColorPickerWithSwatches
                                                        label="Gradient slut"
                                                        value={backgroundConfig.gradientEnd}
                                                        onChange={(value) => updateProductsSection({
                                                            background: { ...backgroundConfig, gradientEnd: value }
                                                        })}
                                                        savedSwatches={editor.draft.savedSwatches}
                                                        onSaveSwatch={(color) => {
                                                            const swatches = editor.draft.savedSwatches || [];
                                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                            }
                                                        }}
                                                        onRemoveSwatch={(color) => {
                                                            editor.updateDraft({
                                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                            });
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Gradient vinkel</Label>
                                                        <span className="text-xs text-muted-foreground">
                                                            {backgroundConfig.gradientAngle}°
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        value={[backgroundConfig.gradientAngle]}
                                                        onValueChange={([value]) => updateProductsSection({
                                                            background: { ...backgroundConfig, gradientAngle: value }
                                                        })}
                                                        min={0}
                                                        max={360}
                                                        step={5}
                                                        className="py-1"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'product-page': {
                const productPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                const orderButtons = productPage.orderButtons || DEFAULT_BRANDING.productPage.orderButtons;

                const updateOrderButtons = (updates: Partial<typeof orderButtons>) => {
                    const next = {
                        ...orderButtons,
                        ...updates,
                        primary: {
                            ...orderButtons.primary,
                            ...(updates.primary || {}),
                        },
                        secondary: {
                            ...orderButtons.secondary,
                            ...(updates.secondary || {}),
                        },
                        selected: {
                            ...orderButtons.selected,
                            ...(updates.selected || {}),
                        },
                    };
                    editor.updateDraft({
                        productPage: {
                            ...productPage,
                            orderButtons: next,
                        },
                    });
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Bestilling</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <Card>
                            <CardHeader className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <CardTitle className="text-sm">Bestillingsknapper</CardTitle>
                                            <InfoTooltip content="Indstillinger for knappernes udseende i prisberegneren på produktsiden. Her kan du style primær, sekundær og valgt tilstand." />
                                        </div>
                                        <CardDescription className="text-xs text-muted-foreground">
                                            Gælder for knapperne i prisberegneren.
                                        </CardDescription>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetOrderButtons}>Nulstil</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <FontSelector
                                        label="Knap skrifttype"
                                        value={orderButtons.font}
                                        onChange={(value) => updateOrderButtons({ font: value })}
                                        description="Font for bestillingsknapper"
                                    />
                                    <div className="space-y-2">
                                        <Label>Animation</Label>
                                        <Select
                                            value={orderButtons.animation}
                                            onValueChange={(value) => updateOrderButtons({ animation: value as typeof orderButtons.animation })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Ingen</SelectItem>
                                                <SelectItem value="lift">Løft</SelectItem>
                                                <SelectItem value="glow">Glow</SelectItem>
                                                <SelectItem value="pulse">Pulse</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-sm font-semibold">Primær knap</Label>
                                        <InfoTooltip content="Hovedknappen i prisberegneren, fx 'Læg i kurv' eller 'Bestil'. Bruges til den primære handling." />
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={orderButtons.primary.bgColor}
                                            onChange={(value) => updateOrderButtons({ primary: { bgColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={orderButtons.primary.hoverBgColor}
                                            onChange={(value) => updateOrderButtons({ primary: { hoverBgColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={orderButtons.primary.textColor}
                                            onChange={(value) => updateOrderButtons({ primary: { textColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={orderButtons.primary.hoverTextColor}
                                            onChange={(value) => updateOrderButtons({ primary: { hoverTextColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-sm font-semibold">Sekundær knap</Label>
                                        <InfoTooltip content="Alternativ knap med mindre fremhævelse, fx 'Gem tilbud' eller 'Se produkter'. Bruges til sekundære handlinger." />
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={orderButtons.secondary.bgColor}
                                            onChange={(value) => updateOrderButtons({ secondary: { bgColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={orderButtons.secondary.hoverBgColor}
                                            onChange={(value) => updateOrderButtons({ secondary: { hoverBgColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={orderButtons.secondary.textColor}
                                            onChange={(value) => updateOrderButtons({ secondary: { textColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={orderButtons.secondary.hoverTextColor}
                                            onChange={(value) => updateOrderButtons({ secondary: { hoverTextColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <ColorPickerWithSwatches
                                            label="Kant"
                                            value={orderButtons.secondary.borderColor || orderButtons.secondary.textColor}
                                            onChange={(value) => updateOrderButtons({ secondary: { borderColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover kant"
                                            value={orderButtons.secondary.hoverBorderColor || orderButtons.secondary.hoverBgColor}
                                            onChange={(value) => updateOrderButtons({ secondary: { hoverBorderColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-sm font-semibold">Valgt knap</Label>
                                        <InfoTooltip content="Udseende når en knap er aktiv/valgt, fx når brugeren har valgt en option i prismatrixen." />
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={orderButtons.selected.bgColor}
                                            onChange={(value) => updateOrderButtons({ selected: { bgColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={orderButtons.selected.hoverBgColor}
                                            onChange={(value) => updateOrderButtons({ selected: { hoverBgColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={orderButtons.selected.textColor}
                                            onChange={(value) => updateOrderButtons({ selected: { textColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={orderButtons.selected.hoverTextColor}
                                            onChange={(value) => updateOrderButtons({ selected: { hoverTextColor: value } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'product-page-matrix': {
                const productPage = editor.draft.productPage || DEFAULT_BRANDING.productPage;
                const matrix = productPage.matrix || DEFAULT_BRANDING.productPage.matrix;

                const updateMatrix = (updates: Partial<typeof matrix>) => {
                    editor.updateDraft({
                        productPage: {
                            ...productPage,
                            matrix: { ...matrix, ...updates },
                        },
                    });
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Matrix system</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <Card>
                            <CardHeader className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-sm">Matrix system</CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground">
                                            Farver og skrifttyper til prismatrixen.
                                        </CardDescription>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetMatrixStyles}>Nulstil</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <FontSelector
                                        label="Matrix skrifttype"
                                        value={matrix.font}
                                        onChange={(value) => updateMatrix({ font: value })}
                                    />
                                </div>
                                <div className="space-y-3 border-t pt-4">
                                    <Label className="text-sm font-semibold">Header</Label>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={matrix.headerBg}
                                            onChange={(value) => updateMatrix({ headerBg: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={matrix.headerText}
                                            onChange={(value) => updateMatrix({ headerText: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3 border-t pt-4">
                                    <Label className="text-sm font-semibold">Række labels</Label>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={matrix.rowHeaderBg}
                                            onChange={(value) => updateMatrix({ rowHeaderBg: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={matrix.rowHeaderText}
                                            onChange={(value) => updateMatrix({ rowHeaderText: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3 border-t pt-4">
                                    <Label className="text-sm font-semibold">Celler</Label>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={matrix.cellBg}
                                            onChange={(value) => updateMatrix({ cellBg: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={matrix.cellText}
                                            onChange={(value) => updateMatrix({ cellText: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover baggrund"
                                            value={matrix.cellHoverBg}
                                            onChange={(value) => updateMatrix({ cellHoverBg: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Hover tekst"
                                            value={matrix.cellHoverText}
                                            onChange={(value) => updateMatrix({ cellHoverText: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3 border-t pt-4">
                                    <Label className="text-sm font-semibold">Valgt celle</Label>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <ColorPickerWithSwatches
                                            label="Baggrund"
                                            value={matrix.selectedBg}
                                            onChange={(value) => updateMatrix({ selectedBg: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Tekst"
                                            value={matrix.selectedText}
                                            onChange={(value) => updateMatrix({ selectedText: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3 border-t pt-4">
                                    <Label className="text-sm font-semibold">Kanter</Label>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <ColorPickerWithSwatches
                                            label="Kantfarve"
                                            value={matrix.borderColor}
                                            onChange={(value) => updateMatrix({ borderColor: value })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'grafisk-vejledning': {
                const grafisk = editor.draft.grafiskVejledning || DEFAULT_BRANDING.grafiskVejledning;
                const tocItems = grafisk.toc.items || [];

                const updateGrafisk = (updates: Partial<typeof grafisk>) => {
                    editor.updateDraft({
                        grafiskVejledning: {
                            ...grafisk,
                            ...updates,
                        },
                    });
                };

                const updateHeader = (updates: Partial<typeof grafisk.header>) => {
                    updateGrafisk({ header: { ...grafisk.header, ...updates } });
                };

                const updateChecklist = (updates: Partial<typeof grafisk.checklist>) => {
                    updateGrafisk({ checklist: { ...grafisk.checklist, ...updates } });
                };

                const updateToc = (updates: Partial<typeof grafisk.toc>) => {
                    updateGrafisk({ toc: { ...grafisk.toc, ...updates } });
                };

                const updateTocItem = (itemId: string, updates: Partial<typeof tocItems[number]>) => {
                    updateToc({
                        items: tocItems.map((item) => item.id === itemId ? { ...item, ...updates } : item),
                    });
                };

                const handleChecklistItemChange = (index: number, value: string) => {
                    const nextItems = grafisk.checklist.items.map((item, i) => i === index ? value : item);
                    updateChecklist({ items: nextItems });
                };

                const addChecklistItem = () => {
                    updateChecklist({ items: [...grafisk.checklist.items, ''] });
                };

                const removeChecklistItem = (index: number) => {
                    updateChecklist({ items: grafisk.checklist.items.filter((_, i) => i !== index) });
                };

                const handleTocImagesUpload = async (itemId: string, files: FileList | null) => {
                    if (!files || files.length === 0) return;
                    const item = tocItems.find((tocItem) => tocItem.id === itemId);
                    const existing = item?.images || [];
                    const remaining = 3 - existing.length;

                    if (remaining <= 0) {
                        toast.error('Maks 3 billeder pr. sektion');
                        return;
                    }

                    const selectedFiles = Array.from(files).slice(0, remaining);
                    setGrafiskUploadingItem(itemId);
                    try {
                        const uploaded: string[] = [];
                        for (const file of selectedFiles) {
                            const publicUrl = await uploadGrafiskImageFile(file);
                            if (publicUrl) uploaded.push(publicUrl);
                        }
                        if (uploaded.length > 0) {
                            updateTocItem(itemId, { images: [...existing, ...uploaded] });
                            toast.success('Billeder uploadet');
                        }
                    } catch (error) {
                        console.error('Error uploading images:', error);
                        toast.error('Kunne ikke uploade billeder');
                    } finally {
                        setGrafiskUploadingItem(null);
                    }
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Grafisk vejledning</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Sektion 1</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Rediger overskrift, titel og teksten under.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2">
                                    <Label>Header (lille)</Label>
                                    <Input
                                        value={grafisk.header.headerLabel}
                                        onChange={(e) => updateHeader({ headerLabel: e.target.value })}
                                        placeholder="Valgfri lille header"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Titel</Label>
                                    <Input
                                        value={grafisk.header.title}
                                        onChange={(e) => updateHeader({ title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tekst under</Label>
                                    <Textarea
                                        value={grafisk.header.description}
                                        onChange={(e) => updateHeader({ description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Tjekliste</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Rediger punkterne i tjeklisten.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Titel</Label>
                                    <Input
                                        value={grafisk.checklist.title}
                                        onChange={(e) => updateChecklist({ title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Punkter</Label>
                                        <Button size="sm" variant="outline" onClick={addChecklistItem}>+ Tilføj punkt</Button>
                                    </div>
                                    <div className="space-y-2">
                                        {grafisk.checklist.items.map((item, index) => (
                                            <div key={`checklist-${index}`} className="flex gap-2">
                                                <Input
                                                    value={item}
                                                    onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => removeChecklistItem(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Indholdsfortegnelse</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Rediger tekst, billeder, farver og font.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Titel</Label>
                                        <Input
                                            value={grafisk.toc.title}
                                            onChange={(e) => updateToc({ title: e.target.value })}
                                        />
                                    </div>
                                    <FontSelector
                                        label="Font"
                                        value={grafisk.toc.font}
                                        onChange={(value) => updateToc({ font: value })}
                                    />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <ColorPickerWithSwatches
                                        label="Boks baggrund"
                                        value={grafisk.toc.boxBackground}
                                        onChange={(value) => updateToc({ boxBackground: value })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Boks tekst"
                                        value={grafisk.toc.boxTextColor}
                                        onChange={(value) => updateToc({ boxTextColor: value })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>

                                <div className="space-y-3">
                                    {tocItems.map((item) => {
                                        const images = item.images || [];
                                        const inputId = `grafisk-toc-${item.id}`;
                                        return (
                                            <div key={item.id} className="rounded-lg border border-dashed p-3 space-y-2">
                                                <div className="space-y-1">
                                                    <Label>Tekst</Label>
                                                    <Input
                                                        value={item.label}
                                                        onChange={(e) => updateTocItem(item.id, { label: e.target.value })}
                                                    />
                                                    <p className="text-[11px] text-muted-foreground">#{item.anchor}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Billeder ({images.length}/3)</Label>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={grafiskUploadingItem === item.id || images.length >= 3}
                                                                onClick={() => document.getElementById(inputId)?.click()}
                                                            >
                                                                {grafiskUploadingItem === item.id ? 'Uploader...' : 'Upload'}
                                                            </Button>
                                                            <input
                                                                id={inputId}
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    handleTocImagesUpload(item.id, e.target.files);
                                                                    e.currentTarget.value = '';
                                                                }}
                                                                disabled={grafiskUploadingItem === item.id || images.length >= 3}
                                                            />
                                                        </div>
                                                    </div>
                                                    {images.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {images.map((url, index) => (
                                                                <div key={`${item.id}-img-${index}`} className="relative h-16 w-16 border rounded overflow-hidden">
                                                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                                                    <button
                                                                        type="button"
                                                                        className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow"
                                                                        onClick={() => updateTocItem(item.id, { images: images.filter((_, i) => i !== index) })}
                                                                    >
                                                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">Ingen billeder tilføjet</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'about': {
                const about = editor.draft.aboutPage || DEFAULT_BRANDING.aboutPage;
                const featureItems = about.features.items || [];

                const updateAbout = (updates: Partial<typeof about>) => {
                    const next = {
                        ...about,
                        ...updates,
                        media: updates.media ? { ...about.media, ...updates.media } : about.media,
                        features: updates.features
                            ? {
                                ...about.features,
                                ...updates.features,
                                items: updates.features.items ?? about.features.items,
                            }
                            : about.features,
                    };
                    editor.updateDraft({ aboutPage: next });
                };

                const updateFeatureItem = (id: string, updates: Partial<typeof featureItems[number]>) => {
                    const nextItems = featureItems.map((item) => item.id === id ? { ...item, ...updates } : item);
                    updateAbout({ features: { ...about.features, items: nextItems } });
                };

                const addFeatureItem = () => {
                    if (featureItems.length >= 4) {
                        toast.error('Maksimalt 4 bokse tilladt');
                        return;
                    }
                    const newItem = {
                        id: `about-feature-${Date.now()}`,
                        title: '',
                        description: '',
                        iconType: 'icon' as const,
                        iconName: 'award',
                        linkUrl: '',
                        openInNewTab: false,
                    };
                    updateAbout({ features: { ...about.features, items: [...featureItems, newItem] } });
                };

                const removeFeatureItem = (id: string) => {
                    updateAbout({ features: { ...about.features, items: featureItems.filter((item) => item.id !== id) } });
                };

                const handleAboutMediaUpload = async (files: FileList | null) => {
                    if (!files || files.length === 0) return;
                    setAboutMediaUploading(true);
                    try {
                        const publicUrl = await uploadAboutImageFile(files[0], 'about-media');
                        if (publicUrl) {
                            updateAbout({ media: { ...about.media, imageUrl: publicUrl } });
                            toast.success('Billede uploadet');
                        }
                    } catch (error) {
                        console.error('Error uploading about image:', error);
                        toast.error('Kunne ikke uploade billede');
                    } finally {
                        setAboutMediaUploading(false);
                    }
                };

                const handleAboutGalleryUpload = async (files: FileList | null) => {
                    if (!files || files.length === 0) return;
                    setAboutGalleryUploading(true);
                    try {
                        const uploaded: string[] = [];
                        for (const file of Array.from(files)) {
                            const publicUrl = await uploadAboutImageFile(file, 'about-gallery');
                            if (publicUrl) uploaded.push(publicUrl);
                        }
                        if (uploaded.length > 0) {
                            updateAbout({ media: { ...about.media, gallery: [...about.media.gallery, ...uploaded] } });
                            toast.success('Galleri opdateret');
                        }
                    } catch (error) {
                        console.error('Error uploading about gallery:', error);
                        toast.error('Kunne ikke uploade billeder');
                    } finally {
                        setAboutGalleryUploading(false);
                    }
                };

                const handleFeatureImageUpload = async (itemId: string, files: FileList | null) => {
                    if (!files || files.length === 0) return;
                    setAboutFeatureUploading(itemId);
                    try {
                        const publicUrl = await uploadAboutImageFile(files[0], 'about-feature');
                        if (publicUrl) {
                            updateFeatureItem(itemId, { iconType: 'image', imageUrl: publicUrl });
                            toast.success('Ikon uploadet');
                        }
                    } catch (error) {
                        console.error('Error uploading feature image:', error);
                        toast.error('Kunne ikke uploade ikon');
                    } finally {
                        setAboutFeatureUploading(null);
                    }
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Om os</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Titel & beskrivelse</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2">
                                    <Label>Titel</Label>
                                    <Input
                                        value={about.title}
                                        onChange={(e) => updateAbout({ title: e.target.value })}
                                        placeholder="Titel"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Beskrivelse</Label>
                                    <Textarea
                                        value={about.description}
                                        onChange={(e) => updateAbout({ description: e.target.value })}
                                        rows={4}
                                        placeholder="Beskrivelse"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Justering</Label>
                                    <Select
                                        value={about.textAlign}
                                        onValueChange={(value) => updateAbout({ textAlign: value as typeof about.textAlign })}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="left">Venstre</SelectItem>
                                            <SelectItem value="center">Centreret</SelectItem>
                                            <SelectItem value="right">Højre</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Billeder</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Vælg enkelt billede eller galleri.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                        value={about.media.type}
                                        onValueChange={(value) => updateAbout({ media: { ...about.media, type: value as typeof about.media.type } })}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Ingen</SelectItem>
                                            <SelectItem value="single">Enkelt billede</SelectItem>
                                            <SelectItem value="gallery">Galleri</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {about.media.type === 'single' && (
                                    <div className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Placering</Label>
                                                <Select
                                                    value={about.media.position}
                                                    onValueChange={(value) => updateAbout({ media: { ...about.media, position: value as typeof about.media.position } })}
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="above">Over tekst</SelectItem>
                                                        <SelectItem value="left">Venstre</SelectItem>
                                                        <SelectItem value="right">Højre</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Effekt</Label>
                                                <Select
                                                    value={about.media.imageStyle}
                                                    onValueChange={(value) => updateAbout({ media: { ...about.media, imageStyle: value as typeof about.media.imageStyle } })}
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="plain">Ingen</SelectItem>
                                                        <SelectItem value="rounded">Afrundet</SelectItem>
                                                        <SelectItem value="shadow">Skygge</SelectItem>
                                                        <SelectItem value="border">Kant</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Upload billede</Label>
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleAboutMediaUpload(e.target.files)}
                                                disabled={aboutMediaUploading}
                                            />
                                            {about.media.imageUrl && (
                                                <div className="flex items-center gap-3">
                                                    <img src={about.media.imageUrl} alt="" className="h-16 w-24 rounded object-cover border" />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => updateAbout({ media: { ...about.media, imageUrl: '' } })}
                                                    >
                                                        Fjern
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {about.media.type === 'gallery' && (
                                    <div className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Layout</Label>
                                                <Select
                                                    value={about.media.galleryLayout}
                                                    onValueChange={(value) => updateAbout({ media: { ...about.media, galleryLayout: value as typeof about.media.galleryLayout } })}
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="grid">Gitter</SelectItem>
                                                        <SelectItem value="masonry">Mosaik</SelectItem>
                                                        <SelectItem value="carousel">Slider</SelectItem>
                                                        <SelectItem value="stacked">Stakket</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Effekt</Label>
                                                <Select
                                                    value={about.media.imageStyle}
                                                    onValueChange={(value) => updateAbout({ media: { ...about.media, imageStyle: value as typeof about.media.imageStyle } })}
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="plain">Ingen</SelectItem>
                                                        <SelectItem value="rounded">Afrundet</SelectItem>
                                                        <SelectItem value="shadow">Skygge</SelectItem>
                                                        <SelectItem value="border">Kant</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Upload galleri</Label>
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={(e) => handleAboutGalleryUpload(e.target.files)}
                                                disabled={aboutGalleryUploading}
                                            />
                                            {about.media.gallery.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {about.media.gallery.map((url, index) => (
                                                        <div key={`${url}-${index}`} className="relative h-16 w-16 border rounded overflow-hidden">
                                                            <img src={url} alt="" className="h-full w-full object-cover" />
                                                            <button
                                                                type="button"
                                                                className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow"
                                                                onClick={() => updateAbout({ media: { ...about.media, gallery: about.media.gallery.filter((_, idx) => idx !== index) } })}
                                                            >
                                                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Bokse</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Rediger bokse og links.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Vis bokse</Label>
                                    <Switch
                                        checked={about.features.enabled}
                                        onCheckedChange={(checked) => updateAbout({ features: { ...about.features, enabled: checked } })}
                                    />
                                </div>

                                {about.features.enabled && (
                                    <div className="space-y-4">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <ColorPickerWithSwatches
                                                label="Boks baggrund"
                                                inline
                                                value={about.features.cardBackground}
                                                onChange={(color) => updateAbout({ features: { ...about.features, cardBackground: color } })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Boks tekst"
                                                inline
                                                value={about.features.cardTextColor}
                                                onChange={(color) => updateAbout({ features: { ...about.features, cardTextColor: color } })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Hover baggrund"
                                                inline
                                                value={about.features.hoverBackground}
                                                onChange={(color) => updateAbout({ features: { ...about.features, hoverBackground: color } })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                            <ColorPickerWithSwatches
                                                label="Hover tekst"
                                                inline
                                                value={about.features.hoverTextColor}
                                                onChange={(color) => updateAbout({ features: { ...about.features, hoverTextColor: color } })}
                                                savedSwatches={editor.draft.savedSwatches}
                                                onSaveSwatch={(color) => {
                                                    const swatches = editor.draft.savedSwatches || [];
                                                    if (!swatches.includes(color) && swatches.length < 20) {
                                                        editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                    }
                                                }}
                                                onRemoveSwatch={(color) => {
                                                    editor.updateDraft({
                                                        savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                    });
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Hover effekt</Label>
                                            <Select
                                                value={about.features.hoverEffect}
                                                onValueChange={(value) => updateAbout({ features: { ...about.features, hoverEffect: value as typeof about.features.hoverEffect } })}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Ingen</SelectItem>
                                                    <SelectItem value="lift">Løft</SelectItem>
                                                    <SelectItem value="shadow">Skygge</SelectItem>
                                                    <SelectItem value="glow">Glow</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-3">
                                            {featureItems.map((item) => (
                                                <div key={item.id} className="rounded-lg border border-dashed p-3 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Boks</Label>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive"
                                                            onClick={() => removeFeatureItem(item.id)}
                                                            disabled={featureItems.length <= 1}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>Titel</Label>
                                                            <Input
                                                                value={item.title}
                                                                onChange={(e) => updateFeatureItem(item.id, { title: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Beskrivelse</Label>
                                                            <Textarea
                                                                value={item.description}
                                                                onChange={(e) => updateFeatureItem(item.id, { description: e.target.value })}
                                                                rows={2}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>Ikon type</Label>
                                                            <Select
                                                                value={item.iconType}
                                                                onValueChange={(value) => updateFeatureItem(item.id, { iconType: value as typeof item.iconType })}
                                                            >
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="icon">SVG ikon</SelectItem>
                                                                    <SelectItem value="image">PNG/SVG billede</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {item.iconType === 'icon' ? (
                                                            <div className="space-y-2">
                                                                <Label>Vælg ikon</Label>
                                                                <Select
                                                                    value={item.iconName}
                                                                    onValueChange={(value) => updateFeatureItem(item.id, { iconName: value })}
                                                                >
                                                                    <SelectTrigger className="h-9">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="award">Award</SelectItem>
                                                                        <SelectItem value="users">Users</SelectItem>
                                                                        <SelectItem value="leaf">Leaf</SelectItem>
                                                                        <SelectItem value="clock">Clock</SelectItem>
                                                                        <SelectItem value="star">Star</SelectItem>
                                                                        <SelectItem value="heart">Heart</SelectItem>
                                                                        <SelectItem value="shield">Shield</SelectItem>
                                                                        <SelectItem value="sparkles">Sparkles</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <Label>Upload ikon</Label>
                                                                <Input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleFeatureImageUpload(item.id, e.target.files)}
                                                                    disabled={aboutFeatureUploading === item.id}
                                                                />
                                                                {item.imageUrl && (
                                                                    <div className="flex items-center gap-3">
                                                                        <img src={item.imageUrl} alt="" className="h-12 w-12 rounded object-contain border" />
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => updateFeatureItem(item.id, { imageUrl: '' })}
                                                                        >
                                                                            Fjern
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>Link (valgfrit)</Label>
                                                            <Input
                                                                value={item.linkUrl || ''}
                                                                onChange={(e) => updateFeatureItem(item.id, { linkUrl: e.target.value })}
                                                                placeholder="/produkter"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between pt-6">
                                                            <Label>Åbn i ny fane</Label>
                                                            <Switch
                                                                checked={item.openInNewTab ?? false}
                                                                onCheckedChange={(checked) => updateFeatureItem(item.id, { openInNewTab: checked })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={addFeatureItem}
                                                className="w-full"
                                                disabled={featureItems.length >= 4}
                                            >
                                                + Tilføj boks
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'page-extras': {
                if (!pageExtrasKey) {
                    return (
                        <div className="space-y-3 px-3 pb-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">Ekstra indhold</h3>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                            </div>
                            <p className="text-sm text-muted-foreground">Vælg en side først.</p>
                        </div>
                    );
                }

                const extras = editor.draft.pageExtras?.[pageExtrasKey] || DEFAULT_BRANDING.pageExtras[pageExtrasKey];

                const updateExtras = (updates: Partial<typeof extras>) => {
                    const next = {
                        ...extras,
                        ...updates,
                        lowerInfo: updates.lowerInfo
                            ? {
                                ...extras.lowerInfo,
                                ...updates.lowerInfo,
                                background: updates.lowerInfo.background
                                    ? { ...extras.lowerInfo.background, ...updates.lowerInfo.background }
                                    : extras.lowerInfo.background,
                                items: updates.lowerInfo.items ?? extras.lowerInfo.items,
                                layout: updates.lowerInfo.layout ?? extras.lowerInfo.layout,
                            }
                            : extras.lowerInfo,
                        contentBlocks: updates.contentBlocks ?? extras.contentBlocks,
                    };

                    editor.updateDraft({
                        pageExtras: {
                            ...(editor.draft.pageExtras || DEFAULT_BRANDING.pageExtras),
                            [pageExtrasKey]: next,
                        },
                    });
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Ekstra indhold {pageExtrasLabel ? `— ${pageExtrasLabel}` : ''}</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <ContentBlocksSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            contentBlocks={extras.contentBlocks}
                            onChangeContentBlocks={(blocks) => updateExtras({ contentBlocks: blocks })}
                            showPlacement={false}
                            maxBlocks={4}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                        <Separator />
                        <LowerInfoSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            lowerInfo={extras.lowerInfo}
                            onChangeLowerInfo={(lowerInfo) => updateExtras({ lowerInfo })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            }
            case 'contact': {
                const contact = editor.draft.contactPage || DEFAULT_BRANDING.contactPage;

                const updateContact = (updates: Partial<typeof contact>) => {
                    const next = {
                        ...contact,
                        ...updates,
                        formBox: updates.formBox ? { ...contact.formBox, ...updates.formBox } : contact.formBox,
                        map: updates.map ? { ...contact.map, ...updates.map } : contact.map,
                        contactInfo: updates.contactInfo ? { ...contact.contactInfo, ...updates.contactInfo } : contact.contactInfo,
                    };
                    editor.updateDraft({ contactPage: next });
                };

                const handleMapUpload = async (files: FileList | null) => {
                    if (!files || files.length === 0) return;
                    setContactMapUploading(true);
                    try {
                        const file = files[0];
                        const publicUrl = await uploadContactMapImageFile(file);
                        if (publicUrl) {
                            updateContact({
                                map: {
                                    ...contact.map,
                                    imageUrl: publicUrl,
                                    enabled: true,
                                },
                            });
                            toast.success('Kortbillede uploadet');
                        }
                    } catch (error) {
                        console.error('Error uploading map image:', error);
                        toast.error('Kunne ikke uploade kortbillede');
                    } finally {
                        setContactMapUploading(false);
                    }
                };

                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Kontakt</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Kontaktinformation (global)</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Tomme felter bruger butikkens standardoplysninger.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Telefon</Label>
                                        <Input
                                            value={contact.contactInfo.phone}
                                            onChange={(e) => updateContact({ contactInfo: { ...contact.contactInfo, phone: e.target.value } })}
                                            placeholder="+45 XX XX XX XX"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>E-mail</Label>
                                        <Input
                                            value={contact.contactInfo.email}
                                            onChange={(e) => updateContact({ contactInfo: { ...contact.contactInfo, email: e.target.value } })}
                                            placeholder="support@ditdomæne.dk"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Firma / Navn</Label>
                                        <Input
                                            value={contact.contactInfo.name}
                                            onChange={(e) => updateContact({ contactInfo: { ...contact.contactInfo, name: e.target.value } })}
                                            placeholder="Virksomhed"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>CVR</Label>
                                        <Input
                                            value={contact.contactInfo.cvr}
                                            onChange={(e) => updateContact({ contactInfo: { ...contact.contactInfo, cvr: e.target.value } })}
                                            placeholder="12345678"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Adresse</Label>
                                    <Textarea
                                        value={contact.contactInfo.address}
                                        onChange={(e) => updateContact({ contactInfo: { ...contact.contactInfo, address: e.target.value } })}
                                        rows={3}
                                        placeholder="Adresse"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Formular modtager</Label>
                                    <Input
                                        value={contact.formRecipientEmail}
                                        onChange={(e) => updateContact({ formRecipientEmail: e.target.value })}
                                        placeholder="support@ditdomæne.dk"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Angiv hvilken e-mail der skal modtage kontaktformularen.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Typografi & farver</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Juster skrifttyper og farver for kontakt-siden.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <FontSelector
                                        label="Overskrift font"
                                        inline
                                        value={contact.headingFont}
                                        onChange={(value) => updateContact({ headingFont: value })}
                                    />
                                    <FontSelector
                                        label="Brødtekst font"
                                        inline
                                        value={contact.bodyFont}
                                        onChange={(value) => updateContact({ bodyFont: value })}
                                    />
                                    <FontSelector
                                        label="Formular font"
                                        inline
                                        value={contact.formFont}
                                        onChange={(value) => updateContact({ formFont: value })}
                                    />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ColorPickerWithSwatches
                                        label="Overskrift farve"
                                        inline
                                        value={contact.headingColor}
                                        onChange={(color) => updateContact({ headingColor: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Brødtekst farve"
                                        inline
                                        value={contact.bodyTextColor}
                                        onChange={(color) => updateContact({ bodyTextColor: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Formular tekst farve"
                                        inline
                                        value={contact.formTextColor}
                                        onChange={(color) => updateContact({ formTextColor: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>
                                <Separator />
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>Brug egen baggrund</Label>
                                        <Switch
                                            checked={contact.backgroundEnabled}
                                            onCheckedChange={(checked) => updateContact({ backgroundEnabled: checked })}
                                        />
                                    </div>
                                    {contact.backgroundEnabled && (
                                        <ColorPickerWithSwatches
                                            label="Baggrundsfarve"
                                            inline
                                            value={contact.backgroundColor}
                                            onChange={(color) => updateContact({ backgroundColor: color })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    )}
                                </div>
                                <Separator />
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ColorPickerWithSwatches
                                        label="UI boks baggrund"
                                        inline
                                        value={contact.infoBoxBackground}
                                        onChange={(color) => updateContact({ infoBoxBackground: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="UI boks tekst"
                                        inline
                                        value={contact.infoBoxTextColor}
                                        onChange={(color) => updateContact({ infoBoxTextColor: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="UI boks kant"
                                        inline
                                        value={contact.infoBoxBorderColor}
                                        onChange={(color) => updateContact({ infoBoxBorderColor: color })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Kontaktformular boks</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Vælg om formularen skal ligge i en boks.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Aktiver boks</Label>
                                    <Switch
                                        checked={contact.formBox.enabled}
                                        onCheckedChange={(checked) => updateContact({ formBox: { ...contact.formBox, enabled: checked } })}
                                    />
                                </div>
                                {contact.formBox.enabled && (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <ColorPickerWithSwatches
                                            label="Boks baggrund"
                                            inline
                                            value={contact.formBox.backgroundColor}
                                            onChange={(color) => updateContact({ formBox: { ...contact.formBox, backgroundColor: color } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                        <ColorPickerWithSwatches
                                            label="Boks kant"
                                            inline
                                            value={contact.formBox.borderColor}
                                            onChange={(color) => updateContact({ formBox: { ...contact.formBox, borderColor: color } })}
                                            savedSwatches={editor.draft.savedSwatches}
                                            onSaveSwatch={(color) => {
                                                const swatches = editor.draft.savedSwatches || [];
                                                if (!swatches.includes(color) && swatches.length < 20) {
                                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                                }
                                            }}
                                            onRemoveSwatch={(color) => {
                                                editor.updateDraft({
                                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                                });
                                            }}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm">Kort (billede)</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Upload et kortbillede og vælg placering.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Placering</Label>
                                    <Select
                                        value={contact.map.placement}
                                        onValueChange={(value) => updateContact({ map: { ...contact.map, placement: value as typeof contact.map.placement } })}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Vælg placering" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="inline">Under adresse (boks)</SelectItem>
                                            <SelectItem value="fullWidth">Fuld bredde under kontakt</SelectItem>
                                            <SelectItem value="hidden">Skjul kort</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Upload kortbillede</Label>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleMapUpload(e.target.files)}
                                        disabled={contactMapUploading}
                                    />
                                    {contact.map.imageUrl && (
                                        <div className="flex items-center gap-3">
                                            <img src={contact.map.imageUrl} alt="Kort" className="h-16 w-24 rounded object-cover border" />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => updateContact({ map: { ...contact.map, imageUrl: '', enabled: false } })}
                                            >
                                                Fjern
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ColorPickerWithSwatches
                                        label="Kort boks baggrund"
                                        inline
                                        value={contact.map.boxBackground}
                                        onChange={(color) => updateContact({ map: { ...contact.map, boxBackground: color } })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Kort boks kant"
                                        inline
                                        value={contact.map.boxBorderColor}
                                        onChange={(color) => updateContact({ map: { ...contact.map, boxBorderColor: color } })}
                                        savedSwatches={editor.draft.savedSwatches}
                                        onSaveSwatch={(color) => {
                                            const swatches = editor.draft.savedSwatches || [];
                                            if (!swatches.includes(color) && swatches.length < 20) {
                                                editor.updateDraft({ savedSwatches: [...swatches, color] });
                                            }
                                        }}
                                        onRemoveSwatch={(color) => {
                                            editor.updateDraft({
                                                savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                            });
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            }
            case 'footer':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Footer</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <FooterSection
                            footer={editor.draft.footer}
                            onChange={(footer) => editor.updateDraft({ footer })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'icons':
                return (
                    <div className="space-y-3 px-3 pb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Produktbilleder</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <ProductAssetsSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            onAddPaidItem={editor.mode === 'tenant' ? paidItems.addPendingItem : undefined}
                            isItemPurchased={editor.mode === 'tenant' ? paidItems.isItemPurchased : undefined}
                            isItemPending={editor.mode === 'tenant' ? paidItems.isItemPending : undefined}
                        />
                    </div>
                );
            default:
                return <div>Ukendt sektion: {activeSection}</div>;
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative min-h-0">
                {/* Left Sidebar - Collapsible */}
                <div
                    className={`
                        absolute inset-y-0 left-0 z-10 w-96 flex-shrink-0 bg-background border-r transform transition-transform duration-300 ease-in-out
                        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                        lg:relative lg:translate-x-0
                        overflow-hidden
                        branding-sidebar
                    `}
                >
                    <div className="h-full flex flex-col">
                        <div className="px-3 py-2.5 border-b flex items-center justify-between bg-muted/20">
                            <h2 className="font-extrabold text-2xl text-foreground px-1">
                                {activeSection ? 'Redigerer' : 'Værktøjer'}
                            </h2>
                            <Button variant="ghost" size="icon" className="h-6 w-6 lg:hidden" onClick={() => setSidebarOpen(false)}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="py-2">
                                {renderSidebarContent()}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Main Preview Area */}
                <div className="flex-1 bg-muted/10 relative flex flex-col">
                    {/* Toggle Sidebar Button (visible when closed on mobile) */}
                    {!sidebarOpen && (
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-4 left-4 z-20 lg:hidden shadow-md"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}

                    <div className="flex-1 p-8 overflow-hidden flex flex-col">
                        {/* ACTION BAR - aligned with preview frame */}
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-card border rounded-t-lg mb-0">
                            {/* 1. Gem design */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowSaveDesignDialog(true)}
                                disabled={editor.isSaving}
                                className="gap-2"
                            >
                                <Save className="h-4 w-4" />
                                Gem design
                            </Button>

                            {/* 2. Gemte designs */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.loadSavedDesigns();
                                    setShowSavedDesignsDialog(true);
                                }}
                                disabled={editor.isSaving}
                                className="gap-2"
                            >
                                <List className="h-4 w-4" />
                                Gemte designs
                            </Button>

                            {/* 3. Premade Designs - Master: Save to resources + View saved, Tenant: Browse designs */}
                            {editor.mode === 'master' ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowSaveToResourcesDialog(true)}
                                        disabled={editor.isSaving}
                                        className="gap-2"
                                    >
                                        <FolderUp className="h-4 w-4" />
                                        Gem som skabelon
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setShowSavedPremadeDesignsDialog(true);
                                            setLoadingSavedDesigns(true);
                                            // Fetch saved designs and tenants
                                            Promise.all([
                                                supabase.from('premade_designs' as any).select('*').order('created_at', { ascending: false }),
                                                supabase.from('tenants' as any).select('id, name').neq('id', '00000000-0000-0000-0000-000000000000')
                                            ]).then(([designsRes, tenantsRes]) => {
                                                if (!designsRes.error) setSavedPremadeDesigns(designsRes.data || []);
                                                if (!tenantsRes.error) setTenantList(tenantsRes.data || []);
                                                setLoadingSavedDesigns(false);
                                            });
                                        }}
                                        className="gap-2"
                                    >
                                        <LayoutTemplate className="h-4 w-4" />
                                        Mine skabeloner
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowPremadeDesignsDialog(true);
                                        // Fetch designs when button is clicked
                                        setLoadingPremadeDesigns(true);
                                        supabase
                                            .from('premade_designs' as any)
                                            .select('*')
                                            .eq('is_visible', true)
                                            .order('created_at', { ascending: false })
                                            .then(({ data, error }) => {
                                                console.log('Premade designs fetch result:', { data, error });
                                                if (error) {
                                                    console.error('Error fetching premade designs:', error);
                                                    toast.error('Kunne ikke hente designs');
                                                }
                                                if (data) {
                                                    setAvailablePremadeDesigns(data);
                                                }
                                                setLoadingPremadeDesigns(false);
                                            });
                                    }}
                                    disabled={editor.isSaving}
                                    className="gap-2"
                                >
                                    <LayoutTemplate className="h-4 w-4" />
                                    Premade Designs
                                </Button>
                            )}

                            {/* Pending Purchases Badge (Tenant only) */}
                            {editor.mode === 'tenant' && paidItems.hasPendingItems && (
                                <PendingPurchasesBadge
                                    count={paidItems.pendingItems.length}
                                    totalCost={paidItems.totalPendingCost}
                                    onClick={() => setShowPendingPurchasesDialog(true)}
                                />
                            )}

                            <div className="flex-1" />

                            {/* 3. Fortryd */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.discardDraft()}
                                disabled={!editor.hasUnsavedChanges || editor.isSaving}
                                className="gap-2 text-muted-foreground hover:text-foreground"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Fortryd
                            </Button>

                            {/* 4. Publicér */}
                            <Button
                                size="sm"
                                onClick={() => setShowPublishDialog(true)}
                                disabled={editor.isSaving}
                                className="gap-2"
                            >
                                <Send className="h-4 w-4" />
                                Publicér
                            </Button>
                        </div>

                        {/* Preview Frame */}
                        <div className="flex-1 w-full bg-white rounded-b-lg border border-t-0 overflow-hidden">
                            <BrandingPreviewFrame
                                branding={editor.draft}
                                previewUrl={`/preview-shop?draft=1&tenantId=${editor.entityId}`}
                                tenantName={editor.entityName}
                                onSaveDraft={editor.saveDraft}
                                onResetDesign={() => setShowResetDialog(true)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- DIALOGS (Copied from V1) --- */}
            {/* 1. Save Design Modal */}
            <Dialog open={showSaveDesignDialog} onOpenChange={setShowSaveDesignDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gem design</DialogTitle>
                        <DialogDescription>
                            Giv dit nuværende design et navn for at gemme det.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Navn på design <span className="text-destructive">*</span></Label>
                            <Input
                                id="name"
                                value={saveDesignName}
                                onChange={(e) => setSaveDesignName(e.target.value)}
                                placeholder="F.eks. Sommer Kampagne"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDesignDialog(false)}>Annuller</Button>
                        <Button onClick={handleSaveDesign} disabled={!saveDesignName.trim() || editor.isSaving}>
                            Gem
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Page Modal */}
            <Dialog
                open={showNewPageDialog}
                onOpenChange={(open) => {
                    setShowNewPageDialog(open);
                    if (!open) setNewPageName("");
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ny side</DialogTitle>
                        <DialogDescription>Opret en ny side i menuen.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="new-page-name">Navn</Label>
                            <Input
                                id="new-page-name"
                                value={newPageName}
                                onChange={(e) => setNewPageName(e.target.value)}
                                placeholder="F.eks. Levering"
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground">
                                Sti: <span className="font-mono">/side/{slugifyPageName(newPageName || "side")}</span>
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewPageDialog(false)}>Annuller</Button>
                        <Button onClick={handleCreatePage}>Gem side</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Subpage Modal */}
            <Dialog
                open={showNewSubpageDialog}
                onOpenChange={(open) => {
                    setShowNewSubpageDialog(open);
                    if (!open) {
                        setNewSubpageName("");
                        setNewSubpageParentPath("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ny underside</DialogTitle>
                        <DialogDescription>Opret en underside under en eksisterende side.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Overordnet side</Label>
                            <Select
                                value={newSubpageParentPath}
                                onValueChange={(value) => setNewSubpageParentPath(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Vælg side" />
                                </SelectTrigger>
                                <SelectContent>
                                    {parentPageOptions.map((option) => (
                                        <SelectItem key={option.path} value={option.path}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new-subpage-name">Navn</Label>
                            <Input
                                id="new-subpage-name"
                                value={newSubpageName}
                                onChange={(e) => setNewSubpageName(e.target.value)}
                                placeholder="F.eks. FAQ"
                            />
                            {newSubpageParentPath && (
                                <p className="text-xs text-muted-foreground">
                                    Sti: <span className="font-mono">
                                        {newSubpageParentPath.replace(/\/$/, "")}/{slugifyPageName(newSubpageName || "side")}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewSubpageDialog(false)}>Annuller</Button>
                        <Button onClick={handleCreateSubpage} disabled={!newSubpageParentPath}>
                            Gem underside
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. Saved Designs List Modal */}
            <Dialog open={showSavedDesignsDialog} onOpenChange={setShowSavedDesignsDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Gemte designs</DialogTitle>
                        <DialogDescription>
                            Klik 'Indlæs' for at anvende et design. Dette vil overskrive din nuværende kladde.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4 minimal-scrollbar">
                        {editor.savedDesigns.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Ingen gemte designs fundet.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {editor.savedDesigns.map((design) => (
                                    <div
                                        key={design.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <Palette className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm">{design.name}</h4>
                                                <p className="text-xs text-muted-foreground">{formatDate(design.createdAt)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={async () => {
                                                    await editor.loadDesign(design.id);
                                                    setShowSavedDesignsDialog(false);
                                                }}
                                            >
                                                Indlæs
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => {
                                                    if (confirm('Er du sikker på at du vil slette dette design?')) {
                                                        editor.deleteSavedDesign(design.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* 3. Reset Dialog */}
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Nulstil til standard?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dette vil fjerne alle dine branding-tilpasninger og gendanne standardindstillingerne.
                            <br /><br />
                            Vi gemmer en automatisk sikkerhedskopi før vi nulstiller.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                await editor.resetToDefault();
                                // Also clear any pending paid items since we're resetting to default
                                if (editor.mode === 'tenant' && paidItems.hasPendingItems) {
                                    await paidItems.clearPendingItems();
                                    toast.success('Design nulstillet og indkøbskurv ryddet');
                                }
                                setShowResetDialog(false);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Nulstil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Publish Dialog */}
            <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-primary" />
                            Publicér branding?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                                <strong>Bemærk:</strong> Publicering vil ændre din live hjemmeside øjeblikkeligt.
                            </div>

                            {/* Recent Publishes Section */}
                            {editor.history.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seneste udgivelser</Label>
                                    <div className="space-y-1 max-h-[120px] overflow-y-auto minimal-scrollbar px-1">
                                        {editor.history.slice(0, 3).map((v) => (
                                            <button
                                                key={v.id}
                                                onClick={() => setPublishLabel(v.label)}
                                                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent border border-transparent hover:border-accent transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <History className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                                                    <span className="text-sm font-medium truncate">{v.label}</span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                                    {format(new Date(v.timestamp), 'd. MMM HH:mm', { locale: da })}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <Separator className="my-2" />
                                </div>
                            )}

                            <div className="space-y-2 pt-1">
                                <Label htmlFor="publish-label">Navngiv denne version (valgfrit)</Label>
                                <div className="relative">
                                    <Input
                                        id="publish-label"
                                        placeholder="F.eks. 'Nyt logo design'"
                                        value={publishLabel}
                                        onChange={(e) => setPublishLabel(e.target.value)}
                                        className="pr-10"
                                    />
                                    {publishLabel && (
                                        <button
                                            onClick={() => setPublishLabel("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Tip: Klik på en seneste udgave ovenfor for at genbruge navnet.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePublish} disabled={editor.isSaving}>
                            Publicér nu
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 4. Save to Resources Dialog (Master Only) */}
            <Dialog open={showSaveToResourcesDialog} onOpenChange={setShowSaveToResourcesDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderUp className="h-5 w-5 text-primary" />
                            Gem til ressourcer
                        </DialogTitle>
                        <DialogDescription>
                            Gem dette design som en premade design skabelon, der kan tildeles til lejere.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="resource-design-name">Navn *</Label>
                            <Input
                                id="resource-design-name"
                                placeholder="F.eks. 'Moderne Trykkeri Design'"
                                value={resourceDesignName}
                                onChange={(e) => setResourceDesignName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="resource-design-desc">Beskrivelse</Label>
                            <Input
                                id="resource-design-desc"
                                placeholder="Kort beskrivelse af designet..."
                                value={resourceDesignDescription}
                                onChange={(e) => setResourceDesignDescription(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="resource-design-price">Pris (kr)</Label>
                                <Input
                                    id="resource-design-price"
                                    type="number"
                                    min="0"
                                    placeholder="0 = Gratis"
                                    value={resourceDesignPrice}
                                    onChange={(e) => setResourceDesignPrice(Number(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Synlighed</Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        checked={resourceDesignVisible}
                                        onChange={(e) => setResourceDesignVisible(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <span className="text-sm">{resourceDesignVisible ? 'Synlig for alle lejere' : 'Skjult'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowSaveToResourcesDialog(false)}>
                            Annuller
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!resourceDesignName.trim()) {
                                    toast.error("Indtast et navn for designet");
                                    return;
                                }
                                try {
                                    // Capture thumbnail from preview
                                    toast.loading('Opretter thumbnail fra preview...', { id: 'save-design' });
                                    const thumbnailUrl = await capturePreviewThumbnail();

                                    const { data: { user } } = await supabase.auth.getUser();

                                    toast.loading('Gemmer design...', { id: 'save-design' });
                                    const { error } = await supabase
                                        .from('premade_designs' as any)
                                        .insert({
                                            name: resourceDesignName.trim(),
                                            description: resourceDesignDescription.trim() || null,
                                            thumbnail_url: thumbnailUrl,
                                            branding_data: editor.draft,
                                            is_visible: resourceDesignVisible,
                                            price: resourceDesignPrice,
                                            created_by: user?.id,
                                        });

                                    if (error) throw error;

                                    toast.success(`Design "${resourceDesignName}" gemt til ressourcer! ${resourceDesignVisible ? 'Synlig for lejere.' : 'Skjult indtil publiceret.'}`, { id: 'save-design' });
                                    setResourceDesignName("");
                                    setResourceDesignDescription("");
                                    setResourceDesignPrice(0);
                                    setResourceDesignVisible(true);
                                    setShowSaveToResourcesDialog(false);
                                } catch (error: any) {
                                    console.error('Error saving premade design:', error);
                                    toast.error(error.message || 'Kunne ikke gemme design', { id: 'save-design' });
                                }
                            }}
                            disabled={!resourceDesignName.trim() || capturingThumbnail}
                        >
                            {capturingThumbnail ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <FolderUp className="h-4 w-4 mr-2" />
                            )}
                            {capturingThumbnail ? 'Opretter thumbnail...' : 'Gem design'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 5. Premade Designs Browser Dialog (Tenant Only) */}
            <Dialog
                open={showPremadeDesignsDialog}
                onOpenChange={(open) => {
                    setShowPremadeDesignsDialog(open);
                    if (open) {
                        // Fetch designs when dialog opens
                        setLoadingPremadeDesigns(true);
                        supabase
                            .from('premade_designs' as any)
                            .select('*')
                            .eq('is_visible', true)
                            .order('created_at', { ascending: false })
                            .then(({ data, error }) => {
                                console.log('Premade designs fetch result:', { data, error });
                                if (error) {
                                    console.error('Error fetching premade designs:', error);
                                    toast.error('Kunne ikke hente designs');
                                }
                                if (data) {
                                    setAvailablePremadeDesigns(data);
                                }
                                setLoadingPremadeDesigns(false);
                            });
                    }
                }}
            >
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutTemplate className="h-5 w-5 text-primary" />
                            Premade Designs
                        </DialogTitle>
                        <DialogDescription>
                            Vælg et forudlavet design at anvende på din hjemmeside. Dit nuværende design erstattes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {loadingPremadeDesigns ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : availablePremadeDesigns.length === 0 ? (
                            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                                <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Ingen premade designs tilgængelige</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {availablePremadeDesigns.map((design) => (
                                    <Card key={design.id} className="overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group">
                                        <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden">
                                            {design.thumbnail_url ? (
                                                <img src={design.thumbnail_url} alt={design.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <LayoutTemplate className="w-16 h-16 text-primary/30" />
                                            )}
                                            {design.price > 0 && (
                                                <Badge className="absolute top-2 right-2">{design.price} kr</Badge>
                                            )}
                                            {design.price === 0 && (
                                                <Badge variant="secondary" className="absolute top-2 right-2">Gratis</Badge>
                                            )}
                                        </div>
                                        <CardContent className="p-4">
                                            <h4 className="font-semibold mb-1">{design.name}</h4>
                                            {design.description && (
                                                <p className="text-sm text-muted-foreground mb-3">{design.description}</p>
                                            )}
                                            <Button
                                                className="w-full"
                                                onClick={async () => {
                                                    if (design.branding_data) {
                                                        // Apply the design to current draft
                                                        editor.updateDraft(design.branding_data);

                                                        // If design has a price, add to pending purchases
                                                        if (design.price > 0 && !paidItems.isItemPurchased('premade_design', design.id)) {
                                                            await paidItems.addPendingItem({
                                                                type: 'premade_design',
                                                                itemId: design.id,
                                                                name: design.name,
                                                                price: design.price,
                                                                thumbnailUrl: design.thumbnail_url,
                                                            });
                                                            toast.success(
                                                                `Design "${design.name}" anvendt! Husk: ${design.price} kr skal betales ved publicering.`,
                                                                { duration: 5000 }
                                                            );
                                                        } else if (paidItems.isItemPurchased('premade_design', design.id)) {
                                                            toast.success(`Design "${design.name}" anvendt! (Allerede købt)`);
                                                        } else {
                                                            toast.success(`Design "${design.name}" anvendt!`);
                                                        }

                                                        setShowPremadeDesignsDialog(false);
                                                    } else {
                                                        toast.error('Design data ikke tilgængelig');
                                                    }
                                                }}
                                            >
                                                {design.price > 0 && !paidItems.isItemPurchased('premade_design', design.id) ? (
                                                    <>Anvend design ({design.price} kr)</>
                                                ) : paidItems.isItemPurchased('premade_design', design.id) ? (
                                                    <>Anvend design ✓</>
                                                ) : (
                                                    <>Anvend design</>
                                                )}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowPremadeDesignsDialog(false)}>
                            Luk
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 6. Saved Premade Designs Management Dialog (Master Only) */}
            <Dialog
                open={showSavedPremadeDesignsDialog}
                onOpenChange={(open) => {
                    setShowSavedPremadeDesignsDialog(open);
                    if (open) {
                        setLoadingSavedDesigns(true);
                        supabase
                            .from('premade_designs' as any)
                            .select('*')
                            .order('created_at', { ascending: false })
                            .then(({ data, error }) => {
                                if (data) setSavedPremadeDesigns(data);
                                if (error) console.error('Error fetching master premade designs:', error);
                                setLoadingSavedDesigns(false);
                            });
                    }
                }}
            >
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutTemplate className="h-5 w-5 text-primary" />
                            Mine Gemte Skabeloner
                        </DialogTitle>
                        <DialogDescription>
                            Administrer dine gemte premade designs. Rediger, slet, eller tildel til lejere.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {loadingSavedDesigns ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : savedPremadeDesigns.length === 0 ? (
                            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                                <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Ingen gemte skabeloner endnu</p>
                                <p className="text-xs mt-1">Brug "Gem som skabelon" for at gemme dit nuværende design</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {savedPremadeDesigns.map((design) => (
                                    <Card key={design.id} className="overflow-hidden">
                                        {/* View Mode */}
                                        {editingDesign?.id !== design.id ? (
                                            <div className="p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-28 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {design.thumbnail_url ? (
                                                            <img src={design.thumbnail_url} alt={design.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <LayoutTemplate className="w-10 h-10 text-primary/30" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <h4 className="font-semibold text-lg">{design.name}</h4>
                                                                {design.description && (
                                                                    <p className="text-sm text-muted-foreground mt-1">{design.description}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 ml-4">
                                                                <Badge variant={design.is_visible ? "default" : "secondary"}>
                                                                    {design.is_visible ? (
                                                                        <><Eye className="w-3 h-3 mr-1" /> Synlig</>
                                                                    ) : (
                                                                        <><EyeOff className="w-3 h-3 mr-1" /> Skjult</>
                                                                    )}
                                                                </Badge>
                                                                <Badge variant="outline" className="font-mono">
                                                                    {design.price > 0 ? `${design.price} kr` : 'Gratis'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-3">
                                                            {/* Edit button */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setEditingDesign({
                                                                    id: design.id,
                                                                    name: design.name,
                                                                    description: design.description || '',
                                                                    price: design.price || 0,
                                                                    is_visible: design.is_visible ?? true,
                                                                    thumbnail_url: design.thumbnail_url,
                                                                })}
                                                                className="gap-1"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                                Rediger
                                                            </Button>
                                                            {/* Load into editor */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (design.branding_data) {
                                                                        editor.updateDraft(design.branding_data);
                                                                        toast.success(`Design "${design.name}" indlæst i editor`);
                                                                        setShowSavedPremadeDesignsDialog(false);
                                                                    }
                                                                }}
                                                            >
                                                                Indlæs i editor
                                                            </Button>
                                                            {/* Assign to specific tenant */}
                                                            {tenantList.length > 0 && (
                                                                <select
                                                                    className="h-8 px-2 text-sm border rounded-md bg-background"
                                                                    defaultValue=""
                                                                    onChange={async (e) => {
                                                                        const tenantId = e.target.value;
                                                                        if (tenantId) {
                                                                            const { data: { user } } = await supabase.auth.getUser();
                                                                            await supabase
                                                                                .from('tenant_premade_designs' as any)
                                                                                .upsert({
                                                                                    tenant_id: tenantId,
                                                                                    design_id: design.id,
                                                                                    granted_by: user?.id
                                                                                });
                                                                            const tenant = tenantList.find(t => t.id === tenantId);
                                                                            toast.success(`Tildelt til ${tenant?.name || 'lejer'}`);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Tildel til...</option>
                                                                    {tenantList.map((tenant) => (
                                                                        <option key={tenant.id} value={tenant.id}>
                                                                            {tenant.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                            {/* Delete */}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive ml-auto"
                                                                onClick={() => setShowDeleteConfirm(design.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Edit Mode */
                                            <div className="p-4 bg-muted/30 border-l-4 border-primary">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-28 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {editingDesign.thumbnail_url ? (
                                                            <img src={editingDesign.thumbnail_url} alt={editingDesign.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <LayoutTemplate className="w-10 h-10 text-primary/30" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <Label htmlFor="edit-name" className="text-xs">Navn</Label>
                                                                <Input
                                                                    id="edit-name"
                                                                    value={editingDesign.name}
                                                                    onChange={(e) => setEditingDesign(prev => prev ? { ...prev, name: e.target.value } : null)}
                                                                    className="h-9"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label htmlFor="edit-price" className="text-xs">Pris (kr)</Label>
                                                                <Input
                                                                    id="edit-price"
                                                                    type="number"
                                                                    min="0"
                                                                    value={editingDesign.price}
                                                                    onChange={(e) => setEditingDesign(prev => prev ? { ...prev, price: Number(e.target.value) || 0 } : null)}
                                                                    className="h-9"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="edit-desc" className="text-xs">Beskrivelse</Label>
                                                            <Input
                                                                id="edit-desc"
                                                                value={editingDesign.description}
                                                                onChange={(e) => setEditingDesign(prev => prev ? { ...prev, description: e.target.value } : null)}
                                                                placeholder="Kort beskrivelse af dette design..."
                                                                className="h-9"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editingDesign.is_visible}
                                                                    onChange={(e) => setEditingDesign(prev => prev ? { ...prev, is_visible: e.target.checked } : null)}
                                                                    className="h-4 w-4 rounded"
                                                                />
                                                                <span className="text-sm">
                                                                    {editingDesign.is_visible ? (
                                                                        <span className="text-green-600 flex items-center gap-1">
                                                                            <Eye className="w-4 h-4" /> Synlig for alle lejere
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground flex items-center gap-1">
                                                                            <EyeOff className="w-4 h-4" /> Skjult for lejere
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </label>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditingDesign(null)}
                                                                    disabled={savingDesignEdit}
                                                                >
                                                                    Annuller
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        if (!editingDesign.name.trim()) {
                                                                            toast.error('Navn er påkrævet');
                                                                            return;
                                                                        }
                                                                        setSavingDesignEdit(true);
                                                                        try {
                                                                            const { error } = await supabase
                                                                                .from('premade_designs' as any)
                                                                                .update({
                                                                                    name: editingDesign.name.trim(),
                                                                                    description: editingDesign.description.trim() || null,
                                                                                    price: editingDesign.price,
                                                                                    is_visible: editingDesign.is_visible,
                                                                                })
                                                                                .eq('id', editingDesign.id);

                                                                            if (error) throw error;

                                                                            // Update local state
                                                                            setSavedPremadeDesigns(prev =>
                                                                                prev.map(d => d.id === editingDesign.id ? {
                                                                                    ...d,
                                                                                    name: editingDesign.name.trim(),
                                                                                    description: editingDesign.description.trim() || null,
                                                                                    price: editingDesign.price,
                                                                                    is_visible: editingDesign.is_visible,
                                                                                } : d)
                                                                            );
                                                                            toast.success('Skabelon opdateret');
                                                                            setEditingDesign(null);
                                                                        } catch (error: any) {
                                                                            console.error('Error updating design:', error);
                                                                            toast.error(error.message || 'Kunne ikke opdatere');
                                                                        } finally {
                                                                            setSavingDesignEdit(false);
                                                                        }
                                                                    }}
                                                                    disabled={savingDesignEdit || !editingDesign.name.trim()}
                                                                    className="gap-1"
                                                                >
                                                                    {savingDesignEdit ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Check className="h-4 w-4" />
                                                                    )}
                                                                    Gem ændringer
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            setShowSavedPremadeDesignsDialog(false);
                            setEditingDesign(null);
                        }}>
                            Luk
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Slet skabelon?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Er du sikker på at du vil slette denne skabelon? Denne handling kan ikke fortrydes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                                if (!showDeleteConfirm) return;
                                try {
                                    await supabase
                                        .from('premade_designs' as any)
                                        .delete()
                                        .eq('id', showDeleteConfirm);
                                    setSavedPremadeDesigns(prev => prev.filter(d => d.id !== showDeleteConfirm));
                                    toast.success('Skabelon slettet');
                                } catch (error) {
                                    toast.error('Kunne ikke slette skabelon');
                                }
                                setShowDeleteConfirm(null);
                            }}
                        >
                            Slet
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 7. Pending Purchases Dialog (Tenant Only) */}
            {editor.mode === 'tenant' && (
                <PendingPurchasesDialog
                    open={showPendingPurchasesDialog}
                    onOpenChange={setShowPendingPurchasesDialog}
                    pendingItems={paidItems.pendingItems}
                    totalCost={paidItems.totalPendingCost}
                    onRemoveItem={paidItems.removePendingItem}
                    onConfirmPurchase={paidItems.processPurchase}
                    onPublish={handlePublishAfterPayment}
                    isPublishing={editor.isSaving}
                />
            )}
        </div>
    );
}
