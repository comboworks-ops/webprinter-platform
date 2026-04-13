import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  CheckCircle2,
  Crown,
  FolderOpen,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { useIconStudioAccess } from "@/hooks/useIconStudioAccess";
import {
  ICON_STUDIO_BRAND_FINISHES,
  ICON_STUDIO_OUTPUT_FORMATS,
  ICON_STUDIO_OUTPUT_SIZES,
  ICON_STUDIO_PRODUCTS,
  ICON_STUDIO_STYLES,
  ICON_STUDIO_VARIANTS,
  getIconStudioPlacementPresets,
  getIconStudioStyleLabel,
  type IconStudioBrandFinishKey,
  type IconStudioOutputFormat,
  type IconStudioOutputSize,
  type IconStudioProductKey,
  type IconStudioStyleKey,
  type IconStudioVariantKey,
} from "@/lib/icon-studio/catalog";
import {
  ICON_STUDIO_PROVIDER_OPTIONS,
  type IconStudioProviderPreference,
} from "@/lib/icon-studio/provider";
import {
  approveIconStudioOutput,
  createIconStudioJob,
  deleteIconStudioBrandAsset,
  deleteIconStudioReferenceAsset,
  listIconStudioBrandAssets,
  listIconStudioJobs,
  listIconStudioReferenceAssets,
  resolveBestMatchingReferenceAssets,
  uploadIconStudioBrandAsset,
  uploadIconStudioReferenceAsset,
} from "@/lib/icon-studio/service";
import { buildIconStudioPayload, type IconStudioBrandAssetRow, type IconStudioJobWithOutputs, type IconStudioReferenceAssetRow } from "@/lib/icon-studio/types";

type ReferenceStyleSelectValue = IconStudioStyleKey | "any";
type ReferenceVariantSelectValue = IconStudioVariantKey | "any";
type ReferenceFinishSelectValue = IconStudioBrandFinishKey | "any";
type BrandAssetRole = "logo" | "symbol" | "seal" | "mark";

function LabelWithInfo({ label, info }: { label: string; info: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      <InfoTooltip content={info} />
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("da-DK");
}

function parseUsageTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function IconStudioPage() {
  const access = useIconStudioAccess();
  const tenantId = access.tenantId;

  const [activeTab, setActiveTab] = useState("generate");
  const [referenceAssets, setReferenceAssets] = useState<IconStudioReferenceAssetRow[]>([]);
  const [brandAssets, setBrandAssets] = useState<IconStudioBrandAssetRow[]>([]);
  const [jobs, setJobs] = useState<IconStudioJobWithOutputs[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [uploadingBrandAsset, setUploadingBrandAsset] = useState(false);
  const [submittingJob, setSubmittingJob] = useState(false);
  const [approvingOutputId, setApprovingOutputId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const [productKey, setProductKey] = useState<IconStudioProductKey>("presentation_folder");
  const [styleKey, setStyleKey] = useState<IconStudioStyleKey>("soft_3d");
  const [variantKey, setVariantKey] = useState<IconStudioVariantKey>("angled_front");
  const [providerPreference, setProviderPreference] = useState<IconStudioProviderPreference>("auto");
  const [brandOverlayEnabled, setBrandOverlayEnabled] = useState(true);
  const [selectedBrandAssetId, setSelectedBrandAssetId] = useState<string | null>(null);
  const [placementPreset, setPlacementPreset] = useState<string | null>(null);
  const [finishKey, setFinishKey] = useState<IconStudioBrandFinishKey>("embossed_light");
  const [format, setFormat] = useState<IconStudioOutputFormat>("png");
  const [size, setSize] = useState<IconStudioOutputSize>(1024);

  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceName, setReferenceName] = useState("");
  const [referenceProductKey, setReferenceProductKey] = useState<IconStudioProductKey>("presentation_folder");
  const [referenceStyleKey, setReferenceStyleKey] = useState<ReferenceStyleSelectValue>("any");
  const [referenceVariantKey, setReferenceVariantKey] = useState<ReferenceVariantSelectValue>("any");
  const [referenceFinishKey, setReferenceFinishKey] = useState<ReferenceFinishSelectValue>("any");
  const [referenceUsageTags, setReferenceUsageTags] = useState("");
  const [referencePriority, setReferencePriority] = useState("10");
  const [referenceIsActive, setReferenceIsActive] = useState(true);

  const [brandFile, setBrandFile] = useState<File | null>(null);
  const [brandName, setBrandName] = useState("");
  const [brandRole, setBrandRole] = useState<BrandAssetRole>("logo");
  const [brandIsDefault, setBrandIsDefault] = useState(true);

  const availablePlacements = useMemo(
    () => getIconStudioPlacementPresets(productKey, variantKey),
    [productKey, variantKey],
  );

  useEffect(() => {
    if (brandAssets.length === 0) {
      setSelectedBrandAssetId(null);
      return;
    }

    if (!selectedBrandAssetId || !brandAssets.some((asset) => asset.id === selectedBrandAssetId)) {
      const preferred = brandAssets.find((asset) => asset.is_default) || brandAssets[0];
      setSelectedBrandAssetId(preferred?.id || null);
    }
  }, [brandAssets, selectedBrandAssetId]);

  useEffect(() => {
    if (!availablePlacements.some((placement) => placement.key === placementPreset)) {
      setPlacementPreset(availablePlacements[0]?.key ?? null);
    }
  }, [availablePlacements, placementPreset]);

  useEffect(() => {
    if (providerPreference !== "mock" && format === "svg") {
      setFormat("png");
    }
  }, [format, providerPreference]);

  const payloadPreview = useMemo(() => {
    if (!tenantId) return null;

    try {
      return buildIconStudioPayload({
        tenantId,
        productKey,
        styleKey,
        variantKey,
        brandOverlayEnabled,
        brandAssetId: selectedBrandAssetId,
        placementPreset: placementPreset as any,
        finishKey,
        format,
        size,
      });
    } catch {
      return null;
    }
  }, [
    brandOverlayEnabled,
    finishKey,
    format,
    placementPreset,
    productKey,
    selectedBrandAssetId,
    size,
    styleKey,
    tenantId,
    variantKey,
  ]);

  const matchingReferenceAssets = useMemo(() => {
    if (!payloadPreview) return [];
    return resolveBestMatchingReferenceAssets({
      assets: referenceAssets,
      payload: payloadPreview,
    });
  }, [payloadPreview, referenceAssets]);

  const referenceBankSummaries = useMemo(() => {
    const grouped = new Map<IconStudioStyleKey | "shared", IconStudioReferenceAssetRow[]>();

    ICON_STUDIO_STYLES.forEach((style) => {
      grouped.set(style.key, []);
    });
    grouped.set("shared", []);

    referenceAssets.forEach((asset) => {
      const bankKey = asset.style_key ?? "shared";
      const current = grouped.get(bankKey) || [];
      current.push(asset);
      grouped.set(bankKey, current);
    });

    const sortAssets = (assets: IconStudioReferenceAssetRow[]) =>
      [...assets].sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));

    return [
      ...ICON_STUDIO_STYLES.map((style) => ({
        key: style.key,
        label: style.label,
        assets: sortAssets(grouped.get(style.key) || []),
        isSelected: style.key === styleKey,
      })),
      {
        key: "shared" as const,
        label: "Shared / fallback",
        assets: sortAssets(grouped.get("shared") || []),
        isSelected: false,
      },
    ];
  }, [referenceAssets, styleKey]);

  const selectedBankSummary = useMemo(
    () => referenceBankSummaries.find((entry) => entry.key === styleKey) || null,
    [referenceBankSummaries, styleKey],
  );

  const populatedBankCount = useMemo(
    () => referenceBankSummaries.filter((entry) => entry.key !== "shared" && entry.assets.length > 0).length,
    [referenceBankSummaries],
  );

  const refreshData = useCallback(async () => {
    if (!tenantId || !access.hasAccess) return;

    setLoadingData(true);
    try {
      const [nextReferences, nextBrandAssets, nextJobs] = await Promise.all([
        listIconStudioReferenceAssets(tenantId),
        listIconStudioBrandAssets(tenantId),
        listIconStudioJobs(tenantId),
      ]);

      setReferenceAssets(nextReferences);
      setBrandAssets(nextBrandAssets);
      setJobs(nextJobs);
    } catch (error) {
      console.error("Failed to load Icon Studio data", error);
      toast.error("Kunne ikke hente Icon Studio data.");
    } finally {
      setLoadingData(false);
    }
  }, [access.hasAccess, tenantId]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const handleReferenceUpload = async () => {
    if (!tenantId) return;
    if (!referenceFile) {
      toast.error("Vælg en referencefil først.");
      return;
    }
    if (!referenceName.trim()) {
      toast.error("Indtast et navn til reference-asset.");
      return;
    }

    setUploadingReference(true);
    try {
      const created = await uploadIconStudioReferenceAsset({
        tenantId,
        file: referenceFile,
        name: referenceName.trim(),
        productKey: referenceProductKey,
        styleKey: referenceStyleKey === "any" ? null : referenceStyleKey,
        variantKey: referenceVariantKey === "any" ? null : referenceVariantKey,
        finishKey: referenceFinishKey === "any" ? null : referenceFinishKey,
        usageTags: parseUsageTags(referenceUsageTags),
        priority: Number(referencePriority) || 0,
        isActive: referenceIsActive,
      });

      setReferenceAssets((current) => [created, ...current]);
      setReferenceFile(null);
      setReferenceName("");
      setReferenceUsageTags("");
      setReferencePriority("10");
      setReferenceStyleKey("any");
      setReferenceVariantKey("any");
      setReferenceFinishKey("any");
      toast.success("Reference asset uploadet.");
    } catch (error) {
      console.error(error);
      toast.error("Kunne ikke uploade reference asset.");
    } finally {
      setUploadingReference(false);
    }
  };

  const handleBrandUpload = async () => {
    if (!tenantId) return;
    if (!brandFile) {
      toast.error("Vælg et brand-asset først.");
      return;
    }
    if (!brandName.trim()) {
      toast.error("Indtast et navn til brand-asset.");
      return;
    }

    setUploadingBrandAsset(true);
    try {
      const created = await uploadIconStudioBrandAsset({
        tenantId,
        file: brandFile,
        name: brandName.trim(),
        assetRole: brandRole,
        isDefault: brandIsDefault,
      });

      setBrandAssets((current) => [created, ...current.filter((asset) => !brandIsDefault || !asset.is_default)]);
      setSelectedBrandAssetId(created.id);
      setBrandFile(null);
      setBrandName("");
      setBrandRole("logo");
      setBrandIsDefault(true);
      toast.success("Brand-asset uploadet.");
      await refreshData();
    } catch (error) {
      console.error(error);
      toast.error("Kunne ikke uploade brand-asset.");
    } finally {
      setUploadingBrandAsset(false);
    }
  };

  const handleCreateJob = async () => {
    if (!tenantId) return;

    setSubmittingJob(true);
    try {
      await createIconStudioJob({
        tenantId,
        productKey,
        styleKey,
        variantKey,
        providerPreference,
        brandOverlayEnabled,
        brandAssetId: selectedBrandAssetId,
        placementPreset,
        finishKey,
        format,
        size,
        referenceAssets,
        brandAssets,
      });

      toast.success("Icon Studio job oprettet.");
      setActiveTab("jobs");
      await refreshData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Kunne ikke oprette job.");
    } finally {
      setSubmittingJob(false);
    }
  };

  const handleApproveOutput = async (jobId: string, outputId: string) => {
    if (!tenantId) return;

    setApprovingOutputId(outputId);
    try {
      await approveIconStudioOutput({ tenantId, jobId, outputId });
      toast.success("Output godkendt som final asset.");
      await refreshData();
    } catch (error) {
      console.error(error);
      toast.error("Kunne ikke godkende output.");
    } finally {
      setApprovingOutputId(null);
    }
  };

  const handleDeleteReference = async (asset: IconStudioReferenceAssetRow) => {
    setDeletingAssetId(asset.id);
    try {
      await deleteIconStudioReferenceAsset(asset);
      setReferenceAssets((current) => current.filter((row) => row.id !== asset.id));
      toast.success("Reference asset slettet.");
    } catch (error) {
      console.error(error);
      toast.error("Kunne ikke slette reference asset.");
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleDeleteBrandAsset = async (asset: IconStudioBrandAssetRow) => {
    setDeletingAssetId(asset.id);
    try {
      await deleteIconStudioBrandAsset(asset);
      setBrandAssets((current) => current.filter((row) => row.id !== asset.id));
      if (selectedBrandAssetId === asset.id) {
        setSelectedBrandAssetId(null);
      }
      toast.success("Brand-asset slettet.");
    } catch (error) {
      console.error(error);
      toast.error("Kunne ikke slette brand-asset.");
    } finally {
      setDeletingAssetId(null);
    }
  };

  if (access.isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!access.hasAccess) {
    return <Navigate to="/admin/moduler" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Icon Studio</h1>
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              <Crown className="mr-1 h-3.5 w-3.5" />
              Premium
            </Badge>
            {access.isMasterContext && <Badge variant="secondary">Master context</Badge>}
          </div>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Kontrolleret ikonstudio for trykprodukter. Fem faste style banks styrer looket, og hver bank kan få sine egne
            referencebilleder. Produkt, bank, view, logo-placering og finish styres via faste enums og et strikt payload.
          </p>
        </div>

        <Button variant="outline" onClick={() => void refreshData()} disabled={loadingData}>
          {loadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Opdater
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reference Assets</CardTitle>
            <CardDescription>{populatedBankCount}/5 style banks har referencebibliotek</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-semibold">{referenceAssets.length}</span>
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Brand Assets</CardTitle>
            <CardDescription>Tenant logoer og symboler</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-semibold">{brandAssets.length}</span>
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Jobs</CardTitle>
            <CardDescription>Genereringer og godkendelser</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-semibold">{jobs.length}</span>
            <WandSparkles className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="brand-assets">Brand Assets</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Strict Job Builder
                </CardTitle>
                <CardDescription>
                  Faste dropdowns bygger payloaden. Den valgte style bank styrer hvilke referencebilleder der må bruges.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <LabelWithInfo
                      label="Produkt"
                      info="Det trykprodukt der skal vises som ikon, for eksempel præsentationsmappe, flyer, plakat eller konvolut."
                    />
                    <Select value={productKey} onValueChange={(value) => setProductKey(value as IconStudioProductKey)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_STUDIO_PRODUCTS.map((product) => (
                          <SelectItem key={product.key} value={product.key}>
                            {product.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <LabelWithInfo
                      label="Style Bank"
                      info="En af de fem faste visuelle banker. Banken bestemmer hvilket referencebibliotek der bruges for at holde samme look på tværs af produkter. Hvis du vælger Shared / fallback ved upload, bruges assetet kun når den valgte bank ikke har sine egne references."
                    />
                    <Select value={styleKey} onValueChange={(value) => setStyleKey(value as IconStudioStyleKey)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_STUDIO_STYLES.map((style) => (
                          <SelectItem key={style.key} value={style.key}>
                            {style.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <LabelWithInfo
                      label="Provider"
                      info="Hvilken billedmotor der skal generere udkastene. Auto foretrækker OpenAI først og falder derefter tilbage til Gemini eller Mock afhængigt af opsætningen."
                    />
                    <Select
                      value={providerPreference}
                      onValueChange={(value) => setProviderPreference(value as IconStudioProviderPreference)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_STUDIO_PROVIDER_OPTIONS.map((provider) => (
                          <SelectItem key={provider.key} value={provider.key}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <LabelWithInfo
                      label="View / Variant"
                      info="Den faste produktvinkel eller præsentation. Eksempler er front, angled front, stacked, open eller standing."
                    />
                    <Select value={variantKey} onValueChange={(value) => setVariantKey(value as IconStudioVariantKey)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_STUDIO_VARIANTS.map((variant) => (
                          <SelectItem key={variant.key} value={variant.key}>
                            {variant.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-base">Brand overlay</Label>
                        <InfoTooltip content="Når dette er aktivt, lægges tenantens eget logo eller symbol på bagefter via faste ankerpunkter. Logoet må ikke tegnes frit af AI." />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Placeringen styres af faste anchors. Logoet renderes deterministisk, ikke via fri AI-fortolkning.
                      </p>
                    </div>
                    <Switch checked={brandOverlayEnabled} onCheckedChange={setBrandOverlayEnabled} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <LabelWithInfo
                        label="Brand asset"
                        info="Det uploadede tenant-logo eller symbol der skal bruges som overlay på det færdige ikon."
                      />
                      <Select
                        value={selectedBrandAssetId || "none"}
                        onValueChange={(value) => setSelectedBrandAssetId(value === "none" ? null : value)}
                        disabled={!brandOverlayEnabled}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg brand asset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ingen valgt</SelectItem>
                          {brandAssets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <LabelWithInfo
                        label="Placement preset"
                        info="Et fast ankerpunkt på produktet, for eksempel front upper right eller spine center. V1 bruger kun disse faste placeringer."
                      />
                      <Select
                        value={placementPreset || "none"}
                        onValueChange={(value) => setPlacementPreset(value === "none" ? null : value)}
                        disabled={!brandOverlayEnabled}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg anker" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePlacements.map((placement) => (
                            <SelectItem key={placement.key} value={placement.key}>
                              {placement.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <LabelWithInfo
                        label="Finish"
                        info="Det kontrollerede look for brand-overlayet, for eksempel flat, embossed light eller gloss surface."
                      />
                      <Select
                        value={finishKey}
                        onValueChange={(value) => setFinishKey(value as IconStudioBrandFinishKey)}
                        disabled={!brandOverlayEnabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ICON_STUDIO_BRAND_FINISHES.map((finish) => (
                            <SelectItem key={finish.key} value={finish.key}>
                              {finish.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <LabelWithInfo
                      label="Output format"
                      info="PNG er den normale produktionssti for AI-udkast. SVG er kun tilgængelig for Mock i V1."
                    />
                    <Select value={format} onValueChange={(value) => setFormat(value as IconStudioOutputFormat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_STUDIO_OUTPUT_FORMATS.map((outputFormat) => (
                          <SelectItem
                            key={outputFormat}
                            value={outputFormat}
                            disabled={providerPreference !== "mock" && outputFormat === "svg"}
                          >
                            {outputFormat.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <LabelWithInfo
                      label="Output størrelse"
                      info="Den kvadratiske eksportstørrelse for udkastet. Større størrelser giver mere detalje, men kan også koste mere hos providerne."
                    />
                    <Select value={String(size)} onValueChange={(value) => setSize(Number(value) as IconStudioOutputSize)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_STUDIO_OUTPUT_SIZES.map((outputSize) => (
                          <SelectItem key={outputSize} value={String(outputSize)}>
                            {outputSize}px
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-medium">Selected Style Bank References</p>
                    <InfoTooltip content="Dette er de references som jobbet faktisk vil bruge. Når den valgte bank har egne assets, bruges kun dem. Shared fallback bruges kun hvis banken er tom." />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Banken <span className="font-medium">{getIconStudioStyleLabel(styleKey)}</span> bruger op til 5 referencebilleder
                    pr. job. Hvis banken har egne assets, bruges kun dem. Shared fallback bruges kun når banken er tom.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {selectedBankSummary?.assets.length || 0}/5 bank references
                    </Badge>
                    {selectedBankSummary?.assets.length ? (
                      <Badge variant="outline">Bank populated</Badge>
                    ) : (
                      <Badge variant="outline">Using shared fallback until bank is populated</Badge>
                    )}
                  </div>
                  {providerPreference !== "mock" && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      AI providers kører server-side som PNG-drafts i V1. Hvis <span className="font-medium">Auto</span> ikke
                      finder en konfigureret provider, falder jobbet tilbage til Mock.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {matchingReferenceAssets.length > 0 ? (
                      matchingReferenceAssets.map((asset) => (
                        <Badge key={asset.id} variant="secondary">
                          {asset.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">Ingen reference assets matcher endnu</Badge>
                    )}
                  </div>
                </div>

                <Button onClick={() => void handleCreateJob()} disabled={submittingJob || !payloadPreview}>
                  {submittingJob ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                  Generer udkast
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payload Preview</CardTitle>
                <CardDescription>Strikt JSON payload som lagres på jobbet.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="max-h-[540px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-50">
                  {payloadPreview
                    ? JSON.stringify(
                        {
                          ...payloadPreview,
                          references: {
                            ...payloadPreview.references,
                            referenceAssetIds: matchingReferenceAssets.map((asset) => asset.id),
                          },
                        },
                        null,
                        2,
                      )
                    : "Payload er ikke gyldigt endnu. Vælg et brand-asset eller slå overlay fra."}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="references" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Reference Asset</CardTitle>
              <CardDescription>
                Hver af de fem style banks kan have sit eget referencebibliotek. De bruges kun i Icon Studio og påvirker ingen andre systemer.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <LabelWithInfo
                  label="Fil"
                  info="Referencebilledet der skal lægges ind i banken. Det bruges kun i Icon Studio og påvirker ikke produktbilleder andre steder."
                />
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => setReferenceFile(event.target.files?.[0] || null)}
                />
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Navn"
                  info="Et internt navn så du kan genkende referenceassetet i banken og i jobmatching."
                />
                <Input value={referenceName} onChange={(event) => setReferenceName(event.target.value)} placeholder="Folder 3D reference 01" />
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Produkt"
                  info="Hvilket trykprodukt denne reference passer til. Matching starter altid på produkttypen."
                />
                <Select value={referenceProductKey} onValueChange={(value) => setReferenceProductKey(value as IconStudioProductKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_STUDIO_PRODUCTS.map((product) => (
                      <SelectItem key={product.key} value={product.key}>
                        {product.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Style Bank"
                  info="Vælg hvilken af de fem banker assetet tilhører. Shared / fallback er kun til generelle references, som må bruges hvis en bank endnu ikke er fyldt op."
                />
                <Select value={referenceStyleKey} onValueChange={(value) => setReferenceStyleKey(value as ReferenceStyleSelectValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Shared / fallback</SelectItem>
                    {ICON_STUDIO_STYLES.map((style) => (
                      <SelectItem key={style.key} value={style.key}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Variant"
                  info="Den visning eller vinkel referencebilledet passer til. Hvis den står til Alle, kan referenceassetet bruges på tværs af flere visninger."
                />
                <Select value={referenceVariantKey} onValueChange={(value) => setReferenceVariantKey(value as ReferenceVariantSelectValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Alle</SelectItem>
                    {ICON_STUDIO_VARIANTS.map((variant) => (
                      <SelectItem key={variant.key} value={variant.key}>
                        {variant.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Finish"
                  info="Et ekstra tag der matcher referenceassetet med den ønskede overflade- eller brand-finish."
                />
                <Select value={referenceFinishKey} onValueChange={(value) => setReferenceFinishKey(value as ReferenceFinishSelectValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Alle</SelectItem>
                    {ICON_STUDIO_BRAND_FINISHES.map((finish) => (
                      <SelectItem key={finish.key} value={finish.key}>
                        {finish.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <LabelWithInfo
                  label="Usage tags"
                  info="Frivillige nøgleord til finmatching, for eksempel premium, fold, soft-shadow eller paper-texture."
                />
                <Input
                  value={referenceUsageTags}
                  onChange={(event) => setReferenceUsageTags(event.target.value)}
                  placeholder="premium, fold, print-material"
                />
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Prioritet"
                  info="Højere prioritet betyder at assetet vælges før andre lignende assets i samme bank."
                />
                <Input value={referencePriority} onChange={(event) => setReferencePriority(event.target.value)} inputMode="numeric" />
              </div>
              <div className="lg:col-span-3 flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-base">Aktiv til matching</Label>
                    <InfoTooltip content="Kun aktive assets må bruges i jobs. Inaktive assets bliver liggende i banken, men ignoreres ved generering." />
                  </div>
                  <p className="text-sm text-muted-foreground">Inaktive assets gemmes stadig, men bruges ikke i jobs.</p>
                </div>
                <Switch checked={referenceIsActive} onCheckedChange={setReferenceIsActive} />
              </div>
              <div className="lg:col-span-3">
                <Button onClick={() => void handleReferenceUpload()} disabled={uploadingReference}>
                  {uploadingReference ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
                  Upload reference asset
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {referenceBankSummaries
              .filter((bank) => bank.key !== "shared")
              .map((bank) => (
                <Card key={bank.key} className={bank.isSelected ? "border-primary/40" : undefined}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{bank.label}</p>
                      {bank.isSelected && <Badge>Aktiv</Badge>}
                    </div>
                    <div className="text-3xl font-semibold">{bank.assets.length}</div>
                    <p className="text-sm text-muted-foreground">
                      {Math.min(bank.assets.length, 5)}/5 anbefalede referencebilleder til banken
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>

          <div className="space-y-6">
            {referenceBankSummaries
              .filter((bank) => bank.assets.length > 0)
              .map((bank) => (
                <div key={bank.key} className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{bank.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {bank.key === "shared"
                          ? "Fallback references, som kun bruges når en style bank ikke har sine egne assets endnu."
                          : "Isoleret referencebank for denne style. Disse assets bruges til at holde looket konsistent på tværs af produkter."}
                      </p>
                    </div>
                    <Badge variant="outline">{bank.assets.length} assets</Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {bank.assets.map((asset) => (
                      <Card key={asset.id}>
                        <CardContent className="space-y-4 p-4">
                          <div className="aspect-square overflow-hidden rounded-lg border bg-muted/30">
                            {asset.preview_url ? (
                              <img src={asset.preview_url} alt={asset.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Ingen preview</div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">{asset.product_key}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">P{asset.priority}</Badge>
                            {asset.style_key && <Badge variant="outline">{asset.style_key}</Badge>}
                            {asset.variant_key && <Badge variant="outline">{asset.variant_key}</Badge>}
                            {asset.finish_key && <Badge variant="outline">{asset.finish_key}</Badge>}
                          </div>
                          {asset.usage_tags.length > 0 && (
                            <p className="text-xs text-muted-foreground">{asset.usage_tags.join(", ")}</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => void handleDeleteReference(asset)}
                            disabled={deletingAssetId === asset.id}
                          >
                            {deletingAssetId === asset.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Slet
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

            {referenceAssets.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center p-10 text-sm text-muted-foreground">
                  Ingen reference assets endnu.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="brand-assets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Brand Asset</CardTitle>
              <CardDescription>
                Brug logoer eller symboler som programmatisk overlay. Brand-asset redigeres ikke af AI i mock pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <LabelWithInfo
                  label="Fil"
                  info="Logo, symbol eller mærke der kan lægges deterministisk ovenpå det genererede ikon."
                />
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => setBrandFile(event.target.files?.[0] || null)}
                />
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Navn"
                  info="Internt navn på brandassetet, for eksempel Primær logo eller Ikon-symbol."
                />
                <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Primær logo" />
              </div>
              <div className="space-y-2">
                <LabelWithInfo
                  label="Rolle"
                  info="Hvordan assetet skal forstås i systemet, for eksempel fuldt logo eller rent symbol."
                />
                <Select value={brandRole} onValueChange={(value) => setBrandRole(value as BrandAssetRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logo">Logo</SelectItem>
                    <SelectItem value="symbol">Symbol</SelectItem>
                    <SelectItem value="seal">Seal</SelectItem>
                    <SelectItem value="mark">Mark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-3 flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-base">Sæt som standard</Label>
                    <InfoTooltip content="Standardassetet vælges automatisk i nye jobs, men kan stadig ændres per job." />
                  </div>
                  <p className="text-sm text-muted-foreground">Det valgte asset foreslås automatisk i nye jobs.</p>
                </div>
                <Switch checked={brandIsDefault} onCheckedChange={setBrandIsDefault} />
              </div>
              <div className="lg:col-span-3">
                <Button onClick={() => void handleBrandUpload()} disabled={uploadingBrandAsset}>
                  {uploadingBrandAsset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                  Upload brand-asset
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {brandAssets.map((asset) => (
              <Card key={asset.id}>
                <CardContent className="p-4 space-y-4">
                  <div className="aspect-video overflow-hidden rounded-lg border bg-muted/30">
                    {asset.preview_url ? (
                      <img src={asset.preview_url} alt={asset.name} className="h-full w-full object-contain p-4" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Ingen preview</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-sm text-muted-foreground">{asset.asset_role}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {asset.is_default && <Badge>Standard</Badge>}
                    <Badge variant="outline">{asset.file_name}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => void handleDeleteBrandAsset(asset)}
                    disabled={deletingAssetId === asset.id}
                  >
                    {deletingAssetId === asset.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Slet
                  </Button>
                </CardContent>
              </Card>
            ))}

            {brandAssets.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="flex items-center justify-center p-10 text-sm text-muted-foreground">
                  Ingen brand assets endnu.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>{job.job_name || job.id}</CardTitle>
                    <CardDescription>
                      {job.product_key} • {job.style_key} • {job.variant_key} • oprettet {formatDate(job.created_at)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={job.status === "approved" ? "default" : "secondary"}>{job.status}</Badge>
                    <Badge variant="outline">{job.provider_key}</Badge>
                    <Badge variant="outline">{job.resolved_reference_asset_ids.length} refs</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {job.error_message && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    {job.error_message}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {job.outputs.map((output) => (
                    <Card key={output.id} className={job.approved_output_id === output.id ? "border-emerald-300" : undefined}>
                      <CardContent className="p-4 space-y-4">
                        <div className="aspect-square overflow-hidden rounded-lg border bg-muted/30">
                          {output.preview_url ? (
                            <img src={output.preview_url} alt={output.label} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Ingen preview</div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">{output.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {output.kind} • {output.mime_type}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {job.approved_output_id === output.id && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Approved
                            </Badge>
                          )}
                          <Badge variant="outline">{output.width_px}x{output.height_px}</Badge>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => void handleApproveOutput(job.id, output.id)}
                          disabled={job.approved_output_id === output.id || approvingOutputId === output.id}
                        >
                          {approvingOutputId === output.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Godkend som final
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <details className="rounded-lg border bg-muted/20 p-4">
                  <summary className="cursor-pointer text-sm font-medium">Vis payload</summary>
                  <Textarea
                    value={JSON.stringify(job.payload, null, 2)}
                    readOnly
                    className="mt-3 min-h-[220px] font-mono text-xs"
                  />
                </details>
              </CardContent>
            </Card>
          ))}

          {jobs.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Ingen jobs endnu. Opret dit første job fra generate-fanen.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-medium text-foreground">Fase 1 status</p>
            <p>
              Access control, tenant scoping, payload builder, style banks, asset libraries, provider adapter, job persistence
              og approve flow er live. Hver style bank kan nu få sine egne referencebilleder.
            </p>
          </div>
          <Badge variant="outline">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Premium isolated module
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
