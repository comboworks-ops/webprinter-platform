import { BUTTON_EFFECTS, sharedButtonAttributes, type ButtonEffect } from '@/lib/branding/sharedButtons';
import { resolveProductOptionAppearance } from '@/lib/branding/productOptionAppearance';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import '@/styles/sharedButtons.css';
/**
 * ProductOptionButtonEditor - Contextual editor for a single product option button
 *
 * Shows only the specific settings for one button:
 * - Button color (background)
 * - Hover color
 * - Text
 * - Text color
 */

import { useState, useEffect, useCallback, useRef, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save, ArrowLeft, MousePointer2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { Switch } from "@/components/ui/switch";
import { updateProductOptionValueSetting } from "@/lib/pricing/productOptionSettings";
import { persistProductStylingPatches, removeSavedStylingPatches, valueStylingPatches, type ProductStylingChange, type ProductStylingPreview, type ProductStylingPatch } from "@/lib/preview/productStylingSave";
import {
    THUMBNAIL_CUSTOM_PX_MAX,
    THUMBNAIL_CUSTOM_PX_MIN,
    THUMBNAIL_CUSTOM_PX_STEP,
    normalizeThumbnailCustomPx,
} from "@/lib/pricing/thumbnailSizes";

interface ProductOptionButtonEditorProps {
    branding?: BrandingData;
    onEditSharedButtons?: () => void;
    tenantId: string;
    pricingPreview?: ProductStylingPreview | null;
    persistedStyling?: ProductStylingChange | null;
    productId: string;
    sectionId: string;
    valueId: string;
    valueName: string;
    savedSwatches: string[];
    onSaveSwatch: (color: string) => void;
    onRemoveSwatch: (color: string) => void;
    onPricingStructureChange?: (change: ProductStylingChange) => void;
    onBack: () => void;
}

interface ButtonSettings {
    lockFromSharedButtons: boolean;
    selectedBackgroundColor: string;
    selectedTextColor: string;
    buttonEffect: ButtonEffect;
    idleMotion: boolean;
    // Appearance
    backgroundColor: string;
    hoverBackgroundColor: string;
    borderColor: string;
    hoverBorderColor: string;
    borderRadiusPx: number;
    borderWidthPx: number;
    // Text
    displayName: string;
    textColor: string;
    hoverTextColor: string;
    fontSizePx: number;
    // Size
    paddingPx: number;
    minHeightPx: number;
    // Picture
    showThumbnail: boolean;
    customImage: string | null;
    hoverImage: string | null;
    imageSizePx: number;
}

const DEFAULT_SETTINGS: ButtonSettings = {
    lockFromSharedButtons: false,
    selectedBackgroundColor: "#087FC5", selectedTextColor: "#FFFFFF", buttonEffect: "none", idleMotion: false,
    backgroundColor: "#FFFFFF",
    hoverBackgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    hoverBorderColor: "#0EA5E9",
    borderRadiusPx: 8,
    borderWidthPx: 1,
    displayName: "",
    textColor: "#1F2937",
    hoverTextColor: "#0EA5E9",
    fontSizePx: 14,
    paddingPx: 12,
    minHeightPx: 44,
    showThumbnail: false,
    customImage: null,
    hoverImage: null,
    imageSizePx: 48,
};

function ButtonColorField({ disabled, ...props }: ComponentProps<typeof ColorPickerWithSwatches> & { disabled?: boolean }) {
    return <fieldset disabled={disabled} className="min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium">{props.label}</span>
            <div className="flex shrink-0 items-center gap-2">
                <code className="text-[11px] text-muted-foreground">{props.value}</code>
                <ColorPickerWithSwatches {...props} compact showFullSwatches={false} />
            </div>
        </div>
    </fieldset>;
}

const buildValueSettingUpdate = (
    settings: ButtonSettings,
    includeImageSize: boolean,
): Record<string, unknown> => ({
    lockFromSharedButtons: settings.lockFromSharedButtons,
    selectedBackgroundColor: settings.selectedBackgroundColor, selectedTextColor: settings.selectedTextColor, buttonEffect: settings.buttonEffect, idleMotion: settings.idleMotion,
    displayName: settings.displayName,
    backgroundColor: settings.backgroundColor,
    hoverBackgroundColor: settings.hoverBackgroundColor,
    borderColor: settings.borderColor,
    hoverBorderColor: settings.hoverBorderColor,
    borderRadiusPx: settings.borderRadiusPx,
    borderWidthPx: settings.borderWidthPx,
    textColor: settings.textColor,
    hoverTextColor: settings.hoverTextColor,
    fontSizePx: settings.fontSizePx,
    paddingPx: settings.paddingPx,
    minHeightPx: settings.minHeightPx,
    showThumbnail: settings.showThumbnail,
    customImage: settings.customImage,
    hoverImage: settings.hoverImage,
    ...(includeImageSize ? { imageSizePx: settings.imageSizePx } : {}),
});

export function ProductOptionButtonEditor({
    branding,
    onEditSharedButtons,
    tenantId,
    pricingPreview,
    persistedStyling,
    productId,
    sectionId,
    valueId,
    valueName,
    savedSwatches,
    onSaveSwatch,
    onRemoveSwatch,
    onPricingStructureChange,
    onBack,
}: ProductOptionButtonEditorProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<ButtonSettings>(DEFAULT_SETTINGS);
    const [productName, setProductName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadTarget, setUploadTarget] = useState<"customImage" | "hoverImage" | null>(null);
    const [previewHovered, setPreviewHovered] = useState(false);
    const [productPricingStructure, setProductPricingStructure] = useState<Record<string, unknown> | null>(null);
    const [hasImageSizeChange, setHasImageSizeChange] = useState(false);
    const [localAppearance, setLocalAppearance] = useState<Record<string, unknown>>({});
    const [previewState, setPreviewState] = useState<'normal' | 'hover' | 'selected'>('normal');
    const appearance = resolveProductOptionAppearance(branding, productPricingStructure, productId, sectionId, valueId, localAppearance);
    const effectiveSettings = { ...settings, ...appearance };
    const inheritsShared = appearance.source === 'shared';

    const pricingPreviewRef = useRef(pricingPreview);
    pricingPreviewRef.current = pricingPreview;
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    const emittedSettingsRef = useRef<ButtonSettings>(DEFAULT_SETTINGS);
    const pendingPatchesRef = useRef<ProductStylingPatch[]>([]);
    const acknowledgePersistedStyling = useCallback((saved: ProductStylingChange | null | undefined) => {
        if (saved?.productId !== productId) return;
        pendingPatchesRef.current = removeSavedStylingPatches(pendingPatchesRef.current, saved.patches);
    }, [productId]);

    useEffect(() => {
        acknowledgePersistedStyling(persistedStyling);
    }, [acknowledgePersistedStyling, persistedStyling]);

    // Load current settings
    useEffect(() => {
        let cancelled = false;
        async function loadSettings() {
            setLoading(true);

            // Load product info
            const { data: product } = await supabase
                .from('products')
                .select('name, pricing_structure')
                .eq('id', productId)
                .eq('tenant_id', tenantId)
                .single();

            if (cancelled) return;
            if (product) {
                setProductName(product.name);
                const rawStructure = pricingPreviewRef.current?.productId === productId
                    ? pricingPreviewRef.current.pricingStructure : product.pricing_structure;
                const structure = (rawStructure && typeof rawStructure === 'object' && !Array.isArray(rawStructure)
                    ? rawStructure : {}) as { vertical_axis?: { sectionId?: string; valueSettings?: Record<string, Partial<ButtonSettings>> }; layout_rows?: Array<{ columns?: Array<{ id?: string; valueSettings?: Record<string, Partial<ButtonSettings>> }> }> };
                setProductPricingStructure(structure);

                // Extract value settings from pricing_structure
                const layoutRows = structure.layout_rows || [];
                const verticalAxis = structure.vertical_axis;

                // Find the section and value settings
                let valueSettings: any = {};
                let foundValueSettings = false;

                // Check the clicked section only.
                if (verticalAxis?.sectionId === sectionId && verticalAxis?.valueSettings?.[valueId]) {
                    valueSettings = verticalAxis.valueSettings[valueId];
                    foundValueSettings = true;
                }

                // Check layout rows
                for (const row of layoutRows) {
                    for (const col of row.columns || []) {
                        if (col.id === sectionId && col.valueSettings?.[valueId]) {
                            valueSettings = col.valueSettings[valueId];
                            foundValueSettings = true;
                            break;
                        }
                    }
                }

                if (!foundValueSettings) {
                    const { data: storformatConfig } = await supabase
                        .from("storformat_configs")
                        .select("vertical_axis, layout_rows")
                        .eq("product_id", productId)
                        .maybeSingle();

                    const storformatVerticalAxis = (storformatConfig as any)?.vertical_axis;
                    if (storformatVerticalAxis?.id === sectionId && storformatVerticalAxis?.valueSettings?.[valueId]) {
                        valueSettings = storformatVerticalAxis.valueSettings[valueId];
                        foundValueSettings = true;
                    }

                    for (const row of ((storformatConfig as any)?.layout_rows || [])) {
                        for (const section of row.sections || []) {
                            if (section.id === sectionId && section.valueSettings?.[valueId]) {
                                valueSettings = section.valueSettings[valueId];
                                foundValueSettings = true;
                                break;
                            }
                        }
                    }
                }

                if (cancelled) return;
                const loadedSettings: ButtonSettings = {
                    ...DEFAULT_SETTINGS,
                    lockFromSharedButtons: valueSettings.lockFromSharedButtons === true,
                    selectedBackgroundColor: valueSettings.selectedBackgroundColor || DEFAULT_SETTINGS.selectedBackgroundColor,
                    selectedTextColor: valueSettings.selectedTextColor || DEFAULT_SETTINGS.selectedTextColor,
                    buttonEffect: BUTTON_EFFECTS.some(effect => effect.id === valueSettings.buttonEffect) ? valueSettings.buttonEffect : 'none',
                    idleMotion: valueSettings.idleMotion === true,
                    displayName: valueSettings.displayName || valueName,
                    backgroundColor: valueSettings.backgroundColor || DEFAULT_SETTINGS.backgroundColor,
                    hoverBackgroundColor: valueSettings.hoverBackgroundColor || DEFAULT_SETTINGS.hoverBackgroundColor,
                    borderColor: valueSettings.borderColor || DEFAULT_SETTINGS.borderColor,
                    hoverBorderColor: valueSettings.hoverBorderColor || DEFAULT_SETTINGS.hoverBorderColor,
                    borderRadiusPx: valueSettings.borderRadiusPx ?? DEFAULT_SETTINGS.borderRadiusPx,
                    borderWidthPx: valueSettings.borderWidthPx ?? DEFAULT_SETTINGS.borderWidthPx,
                    textColor: valueSettings.textColor || DEFAULT_SETTINGS.textColor,
                    hoverTextColor: valueSettings.hoverTextColor || DEFAULT_SETTINGS.hoverTextColor,
                    fontSizePx: valueSettings.fontSizePx ?? DEFAULT_SETTINGS.fontSizePx,
                    paddingPx: valueSettings.paddingPx ?? DEFAULT_SETTINGS.paddingPx,
                    minHeightPx: valueSettings.minHeightPx ?? DEFAULT_SETTINGS.minHeightPx,
                    showThumbnail: valueSettings.showThumbnail || false,
                    customImage: valueSettings.customImage || null,
                    hoverImage: valueSettings.hoverImage || null,
                    imageSizePx: normalizeThumbnailCustomPx(valueSettings.imageSizePx) ?? DEFAULT_SETTINGS.imageSizePx,
                };
                setSettings(loadedSettings);
                setLocalAppearance(valueSettings);
                emittedSettingsRef.current = loadedSettings;
                pendingPatchesRef.current = pricingPreviewRef.current?.productId === productId
                    ? pricingPreviewRef.current.patches.filter(patch => patch.sectionId === sectionId && patch.path[0] === 'valueSettings' && patch.path[1] === valueId) : [];
                setHasImageSizeChange(false);
            }

            setLoading(false);
        }

        void loadSettings();
        return () => { cancelled = true; };
    }, [productId, sectionId, tenantId, valueId, valueName]);

    const emitPricingPreview = useCallback((
        nextSettings: ButtonSettings,
        includeImageSize: boolean,
    ) => {
        const previous = buildValueSettingUpdate(emittedSettingsRef.current, true);
        const changed = Object.fromEntries(Object.entries(buildValueSettingUpdate(nextSettings, includeImageSize))
            .filter(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value)));
        emittedSettingsRef.current = nextSettings;
        const patches = valueStylingPatches(sectionId, valueId, changed);
        pendingPatchesRef.current = [...new Map([...pendingPatchesRef.current, ...patches].map(patch => [JSON.stringify(patch.path), patch])).values()];
        if (!productPricingStructure || !onPricingStructureChange || !patches.length) return;
        const previewUpdate = updateProductOptionValueSetting(
            productPricingStructure,
            sectionId,
            valueId,
            changed,
        );
        if (!previewUpdate.updated) return;

        onPricingStructureChange({
            productId,
            pricingStructure: previewUpdate.pricingStructure,
            patches,
            isDirty: true,
        });
    }, [
        onPricingStructureChange,
        productId,
        productPricingStructure,
        sectionId,
        valueId,
    ]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        const submittedPatches = [...pendingPatchesRef.current];

        // Get current pricing_structure
        const { data: product, error: productLoadError } = await supabase
            .from('products')
            .select('pricing_structure')
            .eq('id', productId)
            .eq('tenant_id', tenantId)
            .single();

        if (productLoadError || !product) {
            console.error('Error loading tenant-owned product button settings:', productLoadError);
            toast.error('Kunne ikke finde produktet i denne shop');
            setSaving(false);
            return;
        }

        const structure = (product?.pricing_structure || { mode: 'matrix_layout_v1', version: 1 }) as Record<string, unknown>;
        const valueSettingUpdate = Object.fromEntries(submittedPatches.map(patch => [patch.path[patch.path.length - 1], patch.value]));
        const productUpdate = updateProductOptionValueSetting(structure, sectionId, valueId, valueSettingUpdate);

        let error: any = null;
        let savedProductPricingStructure: Record<string, unknown> | null = null;
        const patches = submittedPatches;
        if (productUpdate.updated) {
            try {
                savedProductPricingStructure = await persistProductStylingPatches(supabase, tenantId, productId, patches);
            } catch (saveError) { error = saveError; }
        } else {
            const { data: storformatConfig, error: loadError } = await supabase
                .from("storformat_configs")
                .select("vertical_axis, layout_rows")
                .eq("product_id", productId)
                .maybeSingle();

            if (loadError || !storformatConfig) {
                error = loadError || new Error("Storformat-konfiguration blev ikke fundet");
            } else {
                const updatedVerticalAxis = { ...((storformatConfig as any).vertical_axis || {}) };
                const updatedLayoutRows = (((storformatConfig as any).layout_rows || []) as any[]).map((row) => ({
                    ...row,
                    sections: (row.sections || []).map((section: any) => ({ ...section })),
                }));
                let updatedStorformatConfig = false;

                if (updatedVerticalAxis.id === sectionId) {
                    updatedVerticalAxis.valueSettings = updatedVerticalAxis.valueSettings || {};
                    updatedVerticalAxis.valueSettings[valueId] = {
                        ...updatedVerticalAxis.valueSettings[valueId],
                        ...valueSettingUpdate,
                    };
                    updatedStorformatConfig = true;
                }

                for (const row of updatedLayoutRows) {
                    for (const section of row.sections || []) {
                        if (section.id !== sectionId) continue;
                        section.valueSettings = section.valueSettings || {};
                        section.valueSettings[valueId] = {
                            ...section.valueSettings[valueId],
                            ...valueSettingUpdate,
                        };
                        updatedStorformatConfig = true;
                    }
                }

                if (!updatedStorformatConfig) {
                    error = new Error("Kunne ikke finde den valgte knap i produktets konfiguration");
                } else {
                    const result = await supabase
                        .from("storformat_configs")
                        .update({
                            vertical_axis: updatedVerticalAxis,
                            layout_rows: updatedLayoutRows,
                        } as any)
                        .eq("product_id", productId)
                        .select('product_id').maybeSingle();
                    error = result.error || (!result.data ? new Error('Storformat-indstillingerne blev ikke opdateret') : null);
                }
            }
        }

        if (error) {
            console.error('Error saving button settings:', error);
            toast.error('Kunne ikke gemme indstillinger');
        } else {
            pendingPatchesRef.current = pendingPatchesRef.current.filter(patch => !patches.some(saved =>
                JSON.stringify(saved.path) === JSON.stringify(patch.path) && JSON.stringify(saved.value) === JSON.stringify(patch.value)));
            if (savedProductPricingStructure) {
                setProductPricingStructure(savedProductPricingStructure);
                if (settingsRef.current === settings) setHasImageSizeChange(false);
                onPricingStructureChange?.({
                    productId,
                    pricingStructure: savedProductPricingStructure,
                    patches,
                    isDirty: false,
                });
            }
            toast.success('Knap-indstillinger gemt');
        }

        setSaving(false);
    }, [hasImageSizeChange, onPricingStructureChange, productId, sectionId, settings, tenantId, valueId]);

    const handleImageUpload = useCallback(async (file: File, target: "customImage" | "hoverImage") => {
        setUploading(true);
        setUploadTarget(target);

        try {
            const fileExt = file.name.split('.').pop();
            const suffix = target === "hoverImage" ? "hover" : "primary";
            const fileName = `product-option-${productId}-${sectionId}-${valueId}-${suffix}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);

            const nextSettings = { ...settings, [target]: publicUrl, showThumbnail: true };
            setSettings(nextSettings);
            emitPricingPreview(nextSettings, hasImageSizeChange);
            toast.success('Billede uploadet');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Kunne ikke uploade billede');
        }

        setUploading(false);
        setUploadTarget(null);
    }, [emitPricingPreview, hasImageSizeChange, productId, sectionId, settings, valueId]);

    const updateSetting = <K extends keyof ButtonSettings>(key: K, value: ButtonSettings[K]) => {
        // Lock the visible appearance, rather than a stale set of local defaults.
        const captured = key === 'lockFromSharedButtons' && value === true ? {
            backgroundColor: appearance.backgroundColor, hoverBackgroundColor: appearance.hoverBackgroundColor,
            textColor: appearance.textColor, hoverTextColor: appearance.hoverTextColor,
            selectedBackgroundColor: appearance.selectedBackgroundColor, selectedTextColor: appearance.selectedTextColor,
            borderColor: appearance.borderColor, hoverBorderColor: appearance.hoverBorderColor,
            borderRadiusPx: appearance.borderRadiusPx, borderWidthPx: appearance.borderWidthPx,
            paddingPx: appearance.paddingPx, fontSizePx: appearance.fontSizePx,
            buttonEffect: appearance.buttonEffect, idleMotion: appearance.idleMotion,
        } : {};
        const nextSettings = { ...settings, ...captured, [key]: value };
        setLocalAppearance(previous => ({ ...previous, ...captured, [key]: value }));
        const nextHasImageSizeChange = hasImageSizeChange || key === "imageSizePx";
        setSettings(nextSettings);
        setHasImageSizeChange(nextHasImageSizeChange);
        emitPricingPreview(nextSettings, nextHasImageSizeChange);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4 px-3 pb-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    Tilbage
                </Button>
            </div>

            {/* Title */}
            <div className="flex items-center gap-2">
                <MousePointer2 className="h-5 w-5 text-orange-600" />
                <div>
                    <h3 className="text-sm font-medium">Rediger knap</h3>
                    <p className="text-xs text-muted-foreground">{productName} • {valueName}</p>
                </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border bg-slate-50 p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={settings.lockFromSharedButtons} onChange={event => updateSetting('lockFromSharedButtons', event.target.checked)} />
                <span><strong>Lås fra Fælles knapper</strong><span className="mt-1 block text-xs text-muted-foreground">Lås for at bevare de viste farver og tilpasse kun denne knap. Uden lås følger den Fælles knapper, når valgknapper er aktiveret der.</span></span>
            </label>
            <div className="space-y-2 text-xs text-muted-foreground" role="status">
                <p>{inheritsShared ? 'Farver og form kommer fra Fælles knapper → Valgknapper og følger ændringer i farvesystemet.' : settings.lockFromSharedButtons ? 'Denne knap bruger sit eget låste design.' : 'De viste farver følger shoppens, produktets og sektionens design. Lås knappen for at ændre farverne for dette valg alene.'}</p>
                {inheritsShared && onEditSharedButtons && <Button type="button" variant="outline" size="sm" onClick={onEditSharedButtons}>Åbn Fælles knapper</Button>}
            </div>
            {settings.lockFromSharedButtons && <div className="grid gap-3 rounded-lg border p-3">
                <label className="grid gap-2 text-xs">Særlig effekt<select className="h-10 rounded-md border px-2" value={settings.buttonEffect} onChange={event => updateSetting('buttonEffect', event.target.value as ButtonEffect)}>{BUTTON_EFFECTS.map(effect => <option value={effect.id} key={effect.id}>{effect.name}</option>)}</select></label>
                <label className="flex gap-2 text-xs"><input type="checkbox" checked={settings.idleMotion} onChange={event => updateSetting('idleMotion', event.target.checked)} />Diskret bevægelse uden hover for lysstrejf, nordlys, lyskreds og åndedrag</label>
            </div>}
            {/* Text / Label */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Tekst</CardTitle>
                    <CardDescription className="text-xs">
                        Knappens visningsnavn
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Visningsnavn</Label>
                        <Input
                            value={settings.displayName}
                            onChange={(e) => updateSetting('displayName', e.target.value)}
                            placeholder={valueName}
                        />
                        <p className="text-xs text-muted-foreground">
                            Lad være tom for at bruge standardnavnet
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Colors */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Farver</CardTitle>
                    <CardDescription className="text-xs">
                        Normal: uden markering. Hover: når musen er over knappen. Valgt: det aktive produktvalg.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <fieldset disabled={inheritsShared} className="space-y-4">
                    <div className="grid gap-4">
                        <ButtonColorField
                            label="Baggrund · normal"
                            value={effectiveSettings.backgroundColor}
                            onChange={(color) => updateSetting('backgroundColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ButtonColorField
                            label="Baggrund · hover"
                            value={effectiveSettings.hoverBackgroundColor}
                            onChange={(color) => updateSetting('hoverBackgroundColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ButtonColorField
                            label="Tekst · normal"
                            value={effectiveSettings.textColor}
                            onChange={(color) => updateSetting('textColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ButtonColorField
                            label="Tekst · hover"
                            value={effectiveSettings.hoverTextColor}
                            onChange={(color) => updateSetting('hoverTextColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ButtonColorField
                            label="Baggrund · valgt"
                            value={effectiveSettings.selectedBackgroundColor}
                            onChange={(color) => updateSetting('selectedBackgroundColor', color)}
                            disabled={!settings.lockFromSharedButtons}
                            savedSwatches={savedSwatches} onSaveSwatch={onSaveSwatch} onRemoveSwatch={onRemoveSwatch}
                        />
                        <ButtonColorField
                            label="Tekst · valgt"
                            value={effectiveSettings.selectedTextColor}
                            onChange={(color) => updateSetting('selectedTextColor', color)}
                            disabled={!settings.lockFromSharedButtons}
                            savedSwatches={savedSwatches} onSaveSwatch={onSaveSwatch} onRemoveSwatch={onRemoveSwatch}
                        />
                    </div>
                </fieldset>
                </CardContent>
            </Card>

            {/* Shape */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Form</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <fieldset disabled={inheritsShared} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Hjørnerunding</Label>
                            <span className="text-xs text-muted-foreground">{effectiveSettings.borderRadiusPx}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={48}
                            step={1}
                            disabled={inheritsShared}
                            value={[effectiveSettings.borderRadiusPx]}
                            onValueChange={([value]) => updateSetting('borderRadiusPx', value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Kantbredde</Label>
                            <span className="text-xs text-muted-foreground">{effectiveSettings.borderWidthPx}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={4}
                            step={1}
                            disabled={Boolean(appearance.sharedStyle)}
                            value={[effectiveSettings.borderWidthPx]}
                            onValueChange={([value]) => updateSetting('borderWidthPx', value)}
                        />
                    </div>

                    {appearance.sharedStyle && <p className="text-xs text-muted-foreground">Fælles og låste knapper har en kant på 1 px. Hover-kanten følger hover-baggrunden.</p>}
                    <div className="grid gap-4">
                        <ButtonColorField
                            label="Kant · normal"
                            value={effectiveSettings.borderColor}
                            onChange={(color) => updateSetting('borderColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                        <ButtonColorField
                            label="Kant · hover"
                            value={effectiveSettings.hoverBorderColor}
                            onChange={(color) => updateSetting(appearance.sharedStyle ? 'hoverBackgroundColor' : 'hoverBorderColor', color)}
                            savedSwatches={savedSwatches}
                            onSaveSwatch={onSaveSwatch}
                            onRemoveSwatch={onRemoveSwatch}
                            compact
                            showFullSwatches={false}
                        />
                    </div>
                </fieldset>
                </CardContent>
            </Card>

            {/* Picture */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Billede</CardTitle>
                    <CardDescription className="text-xs">
                        Brug et normalt billede og evt. et separat hover-billede.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Vis miniaturebillede</Label>
                        <Switch
                            checked={settings.showThumbnail}
                            onCheckedChange={(checked) => updateSetting('showThumbnail', checked)}
                        />
                    </div>

                    {settings.showThumbnail && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Billedstørrelse</Label>
                                    <span className="text-xs text-muted-foreground">{settings.imageSizePx}px</span>
                                </div>
                                <Slider
                                    min={THUMBNAIL_CUSTOM_PX_MIN}
                                    max={THUMBNAIL_CUSTOM_PX_MAX}
                                    step={THUMBNAIL_CUSTOM_PX_STEP}
                                    value={[settings.imageSizePx]}
                                    onValueChange={([value]) => updateSetting('imageSizePx', value)}
                                />
                            </div>

                            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                                <Label>Normalt billede</Label>
                                {settings.customImage ? (
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={settings.customImage}
                                            alt="Button thumbnail"
                                            className="rounded-lg object-cover border"
                                            style={{ width: settings.imageSizePx, height: settings.imageSizePx }}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateSetting('customImage', null)}
                                        >
                                            Fjern
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file, "customImage");
                                            }}
                                            disabled={uploading}
                                        />
                                        {uploading && uploadTarget === "customImage" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                                <Label>Hover-billede</Label>
                                <p className="text-xs text-muted-foreground">
                                    Vises kun når kunden holder musen over knappen.
                                </p>
                                {settings.hoverImage ? (
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={settings.hoverImage}
                                            alt="Button hover thumbnail"
                                            className="rounded-lg object-cover border"
                                            style={{ width: settings.imageSizePx, height: settings.imageSizePx }}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateSetting('hoverImage', null)}
                                        >
                                            Fjern
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file, "hoverImage");
                                            }}
                                            disabled={uploading}
                                        />
                                        {uploading && uploadTarget === "hoverImage" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Preview */}
            <Card>
                <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm">Forhåndsvisning</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Knappens tilstand">
                        {(['normal', 'hover', 'selected'] as const).map(state => <Button key={state} type="button" variant={previewState === state ? 'secondary' : 'outline'} size="sm" aria-pressed={previewState === state} onClick={() => setPreviewState(state)}>{state === 'normal' ? 'Normal' : state === 'hover' ? 'Hover' : 'Valgt'}</Button>)}
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/25">
                        <button
                            className="transition-all duration-200"
                            type="button"
                            {...sharedButtonAttributes(appearance.sharedStyle, 'selection')}
                            data-preview-state={previewState}
                            aria-pressed={previewState === 'selected'}
                            style={{
                                ...sharedButtonAttributes(appearance.sharedStyle, 'selection').style,
                                backgroundColor: previewState === 'selected' ? effectiveSettings.selectedBackgroundColor : previewState === 'hover' || previewHovered ? effectiveSettings.hoverBackgroundColor : effectiveSettings.backgroundColor,
                                color: previewState === 'selected' ? effectiveSettings.selectedTextColor : previewState === 'hover' || previewHovered ? effectiveSettings.hoverTextColor : effectiveSettings.textColor,
                                borderRadius: `${effectiveSettings.borderRadiusPx}px`,
                                borderWidth: `${effectiveSettings.borderWidthPx}px`,
                                borderStyle: 'solid',
                                borderColor: previewState === 'selected' ? effectiveSettings.selectedBackgroundColor : previewState === 'hover' || previewHovered ? effectiveSettings.hoverBorderColor : effectiveSettings.borderColor,
                                padding: `${effectiveSettings.paddingPx}px ${effectiveSettings.paddingPx * 1.5}px`,
                                fontSize: `${effectiveSettings.fontSizePx}px`,
                                minHeight: `${effectiveSettings.minHeightPx}px`,
                            }}
                            onMouseEnter={(e) => {
                                setPreviewHovered(true);
                            }}
                            onMouseLeave={(e) => {
                                setPreviewHovered(false);
                            }}
                        >
                            {settings.showThumbnail && (previewHovered && settings.hoverImage ? settings.hoverImage : settings.customImage) && (
                                <img
                                    src={(previewHovered && settings.hoverImage ? settings.hoverImage : settings.customImage) || ""}
                                    alt=""
                                    className="mr-2 inline-block object-cover align-middle"
                                    style={{
                                        width: settings.imageSizePx,
                                        height: settings.imageSizePx,
                                        borderRadius: `${Math.max(2, effectiveSettings.borderRadiusPx / 2)}px`,
                                    }}
                                />
                            )}
                            {settings.displayName || valueName}
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end pt-2">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2"
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Gem knap
                </Button>
            </div>
        </div>
    );
}
