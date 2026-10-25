import { StudioSaveToLibrary } from '@/components/admin/icon-studio/StudioSaveToLibrary';
import { StudioProductImageLibrary } from '@/components/admin/icon-studio/StudioProductImageLibrary';
import { StudioReferencePackImport } from '@/components/admin/icon-studio/StudioReferencePackImport';
import { IconStudioComposer } from "@/components/admin/icon-studio/IconStudioComposer";
import { STUDIO_STYLES, STUDIO_VIEWS } from "../../../supabase/functions/_shared/iconStudioRecipe.ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  CheckCircle2,
  FolderOpen,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IconStudioOutputActions } from "@/components/admin/icon-studio/IconStudioOutputActions";

import { useIconStudioAccess } from "@/hooks/useIconStudioAccess";
import {
  ICON_STUDIO_BRAND_FINISHES,
  ICON_STUDIO_PRODUCTS,
  ICON_STUDIO_STYLES,
  ICON_STUDIO_VARIANTS,
  getIconStudioProductLabel,
  getIconStudioStyleLabel,
  getIconStudioVariantLabel,
  type IconStudioBrandFinishKey,
  type IconStudioProductKey,
  type IconStudioStyleKey,
  type IconStudioVariantKey,
} from "@/lib/icon-studio/catalog";
import {
  approveIconStudioOutput,
  deleteIconStudioBrandAsset,
  deleteIconStudioReferenceAsset,
  listIconStudioBrandAssets,
  listIconStudioJobs,
  listIconStudioProductTargets,
  listIconStudioReferenceAssets,
  uploadIconStudioBrandAsset,
  uploadIconStudioReferenceAsset,
} from "@/lib/icon-studio/service";
import { type IconStudioBrandAssetRow, type IconStudioJobWithOutputs, type IconStudioProductTarget, type IconStudioReferenceAssetRow } from "@/lib/icon-studio/types";

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

function getJobStatusLabel(status: IconStudioJobWithOutputs["status"]) {
  const labels: Record<IconStudioJobWithOutputs["status"], string> = {
    draft: "Kladde",
    processing: "Behandler",
    ready_for_review: "Klar til valg",
    approved: "Godkendt",
    failed: "Fejlet",
  };
  return labels[status];
}

function IconStudioWorkspace({ access }: { access: ReturnType<typeof useIconStudioAccess> }) {
  const tenantId = access.tenantId;

  const [libraryOpenRequest, setLibraryOpenRequest] = useState(0);
  const [libraryView, setLibraryView] = useState<'folders'|'generated'>('folders');
  const [activeTab, setActiveTab] = useState("generate");
  const [librarySelection, setLibrarySelection] = useState<{id:string; nonce:number} | null>(null);
  const [referenceAssets, setReferenceAssets] = useState<IconStudioReferenceAssetRow[]>([]);
  const [brandAssets, setBrandAssets] = useState<IconStudioBrandAssetRow[]>([]);
  const [jobs, setJobs] = useState<IconStudioJobWithOutputs[]>([]);
  const [productTargets, setProductTargets] = useState<IconStudioProductTarget[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [uploadingBrandAsset, setUploadingBrandAsset] = useState(false);
  const [submittingJob, setSubmittingJob] = useState(false);
  const [approvingOutputId, setApprovingOutputId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

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

  const referenceBankSummaries = useMemo(() => {
    const grouped = new Map<IconStudioStyleKey | "shared" | "onlinetryksager", IconStudioReferenceAssetRow[]>();

    ICON_STUDIO_STYLES.forEach((style) => {
      grouped.set(style.key, []);
    });
    grouped.set("shared", []);

    referenceAssets.forEach((asset) => {
      if (asset.metadata?.productImageLibrary === true) return;
      const bankKey = asset.metadata?.referencePackId === "onlinetryksager-v1" ? "onlinetryksager" : asset.style_key ?? "shared";
      const current = grouped.get(bankKey) || [];
      current.push(asset);
      grouped.set(bankKey, current);
    });

    const sortAssets = (assets: IconStudioReferenceAssetRow[]) =>
      [...assets].sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));

    return [
      {key:"onlinetryksager" as const,label:"Onlinetryksager",assets:sortAssets(grouped.get("onlinetryksager") || []),isSelected:false},
      ...ICON_STUDIO_STYLES.map((style) => ({
        key: style.key,
        label: style.label,
        assets: sortAssets(grouped.get(style.key) || []),
        isSelected: false,
      })),
      {
        key: "shared" as const,
        label: "Fælles standard",
        assets: sortAssets(grouped.get("shared") || []),
        isSelected: false,
      },
    ];
  }, [referenceAssets]);

  const refreshData = useCallback(async () => {
    if (!tenantId || !access.hasAccess) return;

    setLoadingData(true);
    try {
      const [nextReferences, nextBrandAssets, nextJobs, nextProductTargets] = await Promise.all([
        listIconStudioReferenceAssets(tenantId),
        listIconStudioBrandAssets(tenantId),
        listIconStudioJobs(tenantId),
        listIconStudioProductTargets(tenantId),
      ]);

      setReferenceAssets(nextReferences);
      setBrandAssets(nextBrandAssets);
      setJobs(nextJobs);
      setProductTargets(nextProductTargets);
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
      toast.error("Indtast et navn til stilreferencen.");
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
      toast.success("Stilreferencen er uploadet.");
    } catch (error) {
      console.error(error);
      toast.error("Stilreferencen kunne ikke uploades.");
    } finally {
      setUploadingReference(false);
    }
  };

  const handleBrandUpload = async () => {
    if (!tenantId) return;
    if (!brandFile) {
      toast.error("Vælg et logo eller mærke først.");
      return;
    }
    if (!brandName.trim()) {
      toast.error("Indtast et navn til logoet eller mærket.");
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
      setBrandFile(null);
      setBrandName("");
      setBrandRole("logo");
      setBrandIsDefault(true);
      toast.success("Logoet eller mærket er uploadet.");
      await refreshData();
    } catch (error) {
      console.error(error);
      toast.error("Logoet eller mærket kunne ikke uploades.");
    } finally {
      setUploadingBrandAsset(false);
    }
  };

  const handleApproveOutput = async (jobId: string, outputId: string) => {
    if (!tenantId) return;

    setApprovingOutputId(outputId);
    try {
      await approveIconStudioOutput({ tenantId, jobId, outputId });
      toast.success("Billedet er godkendt.");
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
      toast.success("Stilreferencen er slettet.");
    } catch (error) {
      console.error(error);
      toast.error("Stilreferencen kunne ikke slettes.");
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleDeleteBrandAsset = async (asset: IconStudioBrandAssetRow) => {
    setDeletingAssetId(asset.id);
    try {
      await deleteIconStudioBrandAsset(asset);
      setBrandAssets((current) => current.filter((row) => row.id !== asset.id));
      toast.success("Logoet eller mærket er slettet.");
    } catch (error) {
      console.error(error);
      toast.error("Logoet eller mærket kunne ikke slettes.");
    } finally {
      setDeletingAssetId(null);
    }
  };

  const renderJob = (job: IconStudioJobWithOutputs) => (

            <Card key={job.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>{getIconStudioProductLabel(job.product_key)}</CardTitle>
                    <CardDescription>
                      {STUDIO_STYLES.find(style=>style.id===job.payload.recipe?.styleId)?.label || getIconStudioStyleLabel(job.style_key)} · {STUDIO_VIEWS.find(view=>view.id===job.payload.recipe?.viewId)?.label || getIconStudioVariantLabel(job.variant_key)}
                      {activeTab==="jobs" && ` · ${formatDate(job.created_at)}`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={job.status === "approved" ? "default" : "secondary"}>{getJobStatusLabel(job.status)}</Badge>
                    {['mock','mock-icon-studio-v1'].includes(job.provider_key)&&<Badge variant="outline">Testbillede · ikke AI</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {job.error_message && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    {job.error_message}
                  </div>
                )}

                <div className="workspace-shelf">
                  {job.outputs.map((output) => (
                    <Card key={output.id} className={job.approved_output_id === output.id ? "border-emerald-300" : undefined}>
                      <CardContent className="p-4 space-y-4">
                        <div className="studio-alpha-grid aspect-square overflow-hidden rounded-lg border">
                          {output.preview_url ? (
                            <img src={output.preview_url} alt={output.label} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Ingen preview</div>
                          )}
                        </div>
                        {job.outputs.length>1 && <p className="font-medium">{output.label}</p>}
                        <div className="flex flex-wrap gap-2">
                          {job.approved_output_id === output.id && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Godkendt
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
                          Godkend billede
                        </Button>
                        {tenantId && ['ready_for_review','approved'].includes(job.status) && ['openai-image-v1','gemini-image-v1'].includes(job.provider_key) && ['active','approved'].includes(output.status) && output.mime_type==='image/png' && <StudioSaveToLibrary
                          tenantId={tenantId} outputId={output.id}
                          suggestedName={`${getIconStudioProductLabel(job.product_key)} · ${STUDIO_STYLES.find(style=>style.id===job.payload.recipe?.styleId)?.label || getIconStudioStyleLabel(job.style_key)}`}
                          saved={referenceAssets.some(asset=>asset.id===output.id && asset.metadata?.productImageLibrary===true)}
                          onSaved={refreshData} openLibrary={()=>{setLibraryView('generated');setLibraryOpenRequest(n=>n+1);setActiveTab('jobs');}}
                        />}
                        {job.approved_output_id === output.id && tenantId && (
                          <IconStudioOutputActions
                            tenantId={tenantId}
                            output={output}
                            products={productTargets}
                            onProductImageApplied={(productId, imageUrl) => {
                              setProductTargets((current) => current.map((product) => (
                                product.id === productId ? { ...product, image_url: imageUrl } : product
                              )));
                            }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <details className="rounded-lg border bg-muted/20 p-4">
                  <summary className="cursor-pointer text-sm font-medium">Detaljer</summary>
                  <p className="mt-3 text-sm text-muted-foreground">{job.provider_key} · {job.resolved_reference_asset_ids.length} referencer</p>
                  <Textarea
                    value={JSON.stringify(job.payload, null, 2)}
                    readOnly
                    className="mt-3 min-h-[220px] font-mono text-xs"
                  />
                </details>
              </CardContent>
            </Card>
  );

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
    <div className="studio-page space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Produktbilleder</h1>

          </div>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Vælg et produkt og en stil. Skab dit billede med AI.
          </p>
        </div>

        <Button variant="ghost" size="icon" className="shrink-0" aria-label="Opdater billeder" title="Opdater billeder" onClick={() => void refreshData()} disabled={loadingData}>
          {loadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="studio-page-tabs grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger disabled={submittingJob} value="generate">Opret billede</TabsTrigger>
          <TabsTrigger disabled={submittingJob} value="references">Stilreferencer</TabsTrigger>
          <TabsTrigger disabled={submittingJob} value="brand-assets">Logoer</TabsTrigger>
          <TabsTrigger disabled={submittingJob} value="jobs">Mine billeder</TabsTrigger>
        </TabsList>

        <TabsContent forceMount value="generate" className={activeTab === "generate" ? "space-y-6" : "hidden"}>
          {tenantId && <IconStudioComposer key={tenantId} tenantId={tenantId} jobs={jobs} references={referenceAssets} brandAssets={brandAssets} refresh={refreshData} renderJob={renderJob} openReferences={() => setActiveTab("references")} onBusyChange={setSubmittingJob} librarySelection={librarySelection} openLibrary={() => {setLibraryOpenRequest(n=>n+1);setActiveTab("jobs");}} />}
        </TabsContent>

        <TabsContent value="references" className="space-y-6">
          {tenantId && <StudioReferencePackImport key={tenantId} tenantId={tenantId} references={referenceAssets} refresh={refreshData} onBusyChange={setSubmittingJob} />}
          <Card>
            <CardHeader>
              <CardTitle>Upload stilreference</CardTitle>
              <CardDescription>
                Hver visuel stil kan have sine egne eksempler. De bruges kun til billedforslag og ændrer ikke eksisterende produkter.
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
                  label="Visuel stil"
                  info="Vælg hvilken visuel stil referencen tilhører. Fælles standard bruges, når en stil endnu ikke har egne referencer."
                />
                <Select value={referenceStyleKey} onValueChange={(value) => setReferenceStyleKey(value as ReferenceStyleSelectValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Fælles standard</SelectItem>
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
                  Upload stilreference
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {referenceBankSummaries
              .filter((bank) => bank.key !== "shared" && bank.key !== "onlinetryksager")
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
                        {bank.key === "onlinetryksager" ? "Bruges kun, når Onlinetryksager-pakken vælges i generatoren. Originalens logo og farver kan erstattes." : bank.key === "shared"
                          ? "Fallback references, som kun bruges når en style bank ikke har sine egne assets endnu."
                          : "Isoleret referencebank for denne style. Disse assets bruges til at holde looket konsistent på tværs af produkter."}
                      </p>
                    </div>
                    <Badge variant="outline">{bank.assets.length} assets</Badge>
                  </div>

                  <div className="workspace-shelf">
                    {bank.assets.map((asset) => (
                      <Card key={asset.id}>
                        <CardContent className="space-y-4 p-4">
                          <div className="aspect-square overflow-hidden rounded-lg border bg-muted/30">
                            {asset.preview_url ? (
                              <img src={asset.preview_url} alt={asset.name} loading="lazy" className="h-full w-full object-contain" />
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
                  Ingen stilreferencer endnu.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="brand-assets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload logo eller mærke</CardTitle>
              <CardDescription>
                Logoer placeres præcist oven på det færdige billede og bliver ikke tegnet om af AI.
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
                  Upload logo eller mærke
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="workspace-shelf">
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
                  Ingen logoer eller mærker endnu.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6">
          <StudioProductImageLibrary openRequest={libraryOpenRequest} initialView={libraryView} assets={referenceAssets} onUseReference={asset => { setLibrarySelection({id:asset.id, nonce:Date.now()}); setActiveTab("generate"); }} />
          {jobs.map(renderJob)}

          {jobs.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Ingen billedforslag endnu. Opret de første forslag under Opret billeder.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}

export default function IconStudioPage() {
  const access = useIconStudioAccess();
  return <IconStudioWorkspace key={access.tenantId || "resolving"} access={access} />;
}
