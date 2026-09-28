import { useEffect, useRef, useState } from "react";
import { DatabaseZap, ExternalLink, Link2, Loader2, Search, Sparkles } from "lucide-react";
import type { SupplierJevResult } from "../../../../supabase/functions/_shared/supplierJev";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SUPPLIER_BANK_PRODUCT_FAMILIES,
  getSupplierBankProductFamilyLabelDa,
  type SupplierBankProductFamily,
} from "@/lib/supplier-bank";

type UrlImportPriceRow = {
  quantity: number;
  supplierCurrency: string;
  supplierPrice: number;
  proposedPriceDkk: number;
  selections?: Record<string, string>;
};

type UrlImportPreview = {
  supplier: { id: string; name: string; slug: string; currency: string };
  sourceUrl: string;
  supplierProductKey: string;
  productFamily: SupplierBankProductFamily;
  nameOriginal: string;
  nameDa: string;
  descriptionOriginal?: string | null;
  warnings: string[];
  needsDynamicExtraction: boolean;
  extractionMode: "playwright_required" | "static_price_rows";
  pricingSummary: {
    rows: number;
    quantityMin: number | null;
    quantityMax: number | null;
    priceMinDkk: number | null;
    priceMaxDkk: number | null;
  };
  priceRows: UrlImportPriceRow[];
  totalPriceRows: number;
  assistanceAvailable?: boolean;
};

type SupplierUrlImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (bankProductId: string) => void;
};

async function getFunctionError(error: unknown, fallback: string) {
  const response = (error as { context?: Response } | null)?.context;
  if (response && typeof response.clone === "function") {
    const payload = await response.clone().json().catch(() => null) as { error?: string } | null;
    if (payload?.error) return payload.error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(value)
    : "-";

export function SupplierUrlImportDialog({ open, onOpenChange, onSaved }: SupplierUrlImportDialogProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [nameDa, setNameDa] = useState("");
  const [productFamily, setProductFamily] = useState<SupplierBankProductFamily>("other");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<UrlImportPreview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFamily, setPreviewFamily] = useState<SupplierBankProductFamily | null>(null);
  const [assistance, setAssistance] = useState<SupplierJevResult | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const requestVersion = useRef(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    requestVersion.current += 1;
    setPreview(null);
    setPreviewUrl(null);
    setPreviewFamily(null);
    setAssistance(null);
    setSuggesting(false);
    setError(null);
    setAnalyzing(false);
    setSaving(false);
  }, [open]);

  useEffect(() => () => { requestVersion.current += 1; }, []);

  function invalidatePreview() {
    requestVersion.current += 1;
    setAssistance(null);
    setSuggesting(false);
    setAnalyzing(false);
    setPreviewUrl(null);
  }

  async function invokeUrlImport(action: "preview" | "save", family = productFamily) {
    const { data, error: functionError } = await supabase.functions.invoke("supplier-bank-url-import", {
      body: {
        action,
        url: url.trim(),
        nameDa: nameDa.trim() || null,
        productFamily: family,
        note: note.trim() || null,
        confirmDraftWrite: action === "save",
      },
    });
    if (functionError) throw new Error(await getFunctionError(functionError, "URL-importen kunne ikke gennemføres."));
    if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
    return data as {
      ok: boolean;
      preview: UrlImportPreview;
      saved?: { bankProductId: string; refreshQueued: boolean; snapshotId: string | null };
    };
  }

  async function analyzeUrl(family: SupplierBankProductFamily = productFamily) {
    if (!url.trim()) {
      setError("Indtast en produkt-URL.");
      return;
    }
    setAnalyzing(true);
    setAssistance(null);
    setSuggesting(false);
    const version = ++requestVersion.current;
    const requestedUrl = url.trim();
    setError(null);
    try {
      const result = await invokeUrlImport("preview", family);
      if (version !== requestVersion.current) return;
      setPreview(result.preview);
      setPreviewUrl(requestedUrl);
      setPreviewFamily(family);
      setNameDa((current) => current.trim() ? current : result.preview.nameDa);
      toast({
        title: "URL analyseret",
        description: result.preview.needsDynamicExtraction
          ? "Produktet blev fundet. Dynamiske priser kræver et udtræk i køen."
          : `${result.preview.totalPriceRows} prislinjer blev fundet.`,
      });
    } catch (caughtError) {
      if (version !== requestVersion.current) return;
      setPreview(null);
      setPreviewUrl(null);
      setError(caughtError instanceof Error ? caughtError.message : "URL'en kunne ikke analyseres.");
    } finally {
      if (version === requestVersion.current) setAnalyzing(false);
    }
  }

  async function requestSuggestions() {
    if (!previewIsCurrent || suggesting || !preview?.assistanceAvailable) return;
    const version = requestVersion.current;
    setSuggesting(true);
    setAssistance(null);
    try {
      const { data, error: suggestionError } = await supabase.functions.invoke("supplier-bank-url-import", {
        body: { action: "suggest", url: url.trim() },
      });
      if (version !== requestVersion.current) return;
      setAssistance(suggestionError || !data?.assistance ? { status: "unavailable" } : data.assistance);
    } catch {
      if (version === requestVersion.current) setAssistance({ status: "unavailable" });
    } finally {
      if (version === requestVersion.current) setSuggesting(false);
    }
  }

  function useSuggestedCategory() {
    const category = assistance?.category;
    if (!category || category.review !== "suggestion" || !SUPPLIER_BANK_PRODUCT_FAMILIES.includes(category.value as SupplierBankProductFamily)) return;
    const family = category.value as SupplierBankProductFamily;
    setProductFamily(family);
    // Family is part of the pricing preview identity. Re-run the existing importer.
    void analyzeUrl(family);
  }

  async function saveDraft() {
    if (!previewIsCurrent) return;
    setSaving(true);
    setError(null);
    try {
      const result = await invokeUrlImport("save");
      const bankProductId = result.saved?.bankProductId;
      if (!bankProductId) throw new Error("Bankdraften blev ikke returneret efter lagring.");
      toast({
        title: "Gemt i produktbanken",
        description: result.saved?.refreshQueued
          ? "Produktet er gemt som draft, og dynamisk prisudtræk er sat i kø."
          : "Produkt og pris-snapshot er gemt som draft til gennemgang.",
      });
      onOpenChange(false);
      onSaved(bankProductId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Bankdraften kunne ikke gemmes.");
    } finally {
      setSaving(false);
    }
  }

  const previewIsCurrent = Boolean(preview && previewUrl === url.trim() && previewFamily === productFamily);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Importér produkt fra URL
          </DialogTitle>
          <DialogDescription>
            Analysér først. Gem derefter som upubliceret bankdraft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-product-url">Produkt-URL</Label>
            <div className="flex gap-2">
              <Input
                id="supplier-product-url"
                type="url"
                value={url}
                onChange={(event) => {
                  invalidatePreview();
                  setUrl(event.target.value);
                  setError(null);
                }}
                placeholder="https://www.wir-machen-druck.de/produkt.html"
                autoComplete="off"
                disabled={saving}
              />
              <Button type="button" variant="outline" onClick={() => void analyzeUrl()} disabled={analyzing || saving || !url.trim()}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Analysér</span>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-product-name-da">Dansk produktnavn</Label>
              <Input
                id="supplier-product-name-da"
                value={nameDa}
                onChange={(event) => setNameDa(event.target.value)}
                placeholder="Udfyldes automatisk eller skriv dit eget"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-product-family">Produkttype</Label>
              <select
                id="supplier-product-family"
                value={productFamily}
                onChange={(event) => { invalidatePreview(); setProductFamily(event.target.value as SupplierBankProductFamily); }}
                disabled={saving}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SUPPLIER_BANK_PRODUCT_FAMILIES.map((family) => (
                  <option key={family} value={family}>{getSupplierBankProductFamilyLabelDa(family)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-product-note">Note</Label>
            <Textarea
              id="supplier-product-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Fx ønsket papir, efterbehandling eller hvordan produktet skal bruges"
              className="min-h-20 resize-y"
            />
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {preview && previewIsCurrent ? (
            <div className="space-y-4 border-t pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{preview.supplier.name}</Badge>
                    <Badge variant={preview.needsDynamicExtraction ? "secondary" : "default"}>
                      {preview.needsDynamicExtraction ? "Prisudtræk i kø" : `${preview.totalPriceRows} prislinjer`}
                    </Badge>
                  </div>
                  <p className="mt-3 font-semibold">{nameDa.trim() || preview.nameDa}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{preview.nameOriginal}</p>
                </div>
                <Button asChild type="button" size="icon" variant="ghost" title="Åbn leverandørsiden">
                  <a href={preview.sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-4">
                <span className="text-muted-foreground">Prislinjer</span>
                <span className="text-right font-medium">{formatNumber(preview.pricingSummary.rows)}</span>
                <span className="text-muted-foreground">Oplag</span>
                <span className="text-right font-medium">
                  {formatNumber(preview.pricingSummary.quantityMin)}-{formatNumber(preview.pricingSummary.quantityMax)}
                </span>
                <span className="text-muted-foreground">Pris fra</span>
                <span className="text-right font-medium">{formatNumber(preview.pricingSummary.priceMinDkk)} DKK</span>
                <span className="text-muted-foreground">Pris til</span>
                <span className="text-right font-medium">{formatNumber(preview.pricingSummary.priceMaxDkk)} DKK</span>
              </div>

              {preview.priceRows.length > 0 ? (
                <div className="overflow-hidden rounded-md border">
                  <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span>Oplag</span>
                    <span className="text-right">Leverandør</span>
                    <span className="text-right">Foreslået DKK</span>
                  </div>
                  {preview.priceRows.slice(0, 8).map((row, index) => (
                    <div key={`${row.quantity}-${row.supplierPrice}-${index}`} className="grid grid-cols-3 border-t px-3 py-2 text-sm">
                      <span>{formatNumber(row.quantity)}</span>
                      <span className="text-right">{formatNumber(row.supplierPrice)} {row.supplierCurrency}</span>
                      <span className="text-right font-medium">{formatNumber(row.proposedPriceDkk)} DKK</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {preview.warnings.length > 0 ? (
                <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}

              <section className="space-y-3 rounded-md border p-3" aria-label="Produktforslag">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">Forslag til kategori og egenskaber</p>
                  <Button type="button" size="sm" variant="outline" onClick={requestSuggestions}
                    disabled={!preview.assistanceAvailable || suggesting || saving || analyzing}>
                    {suggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {suggesting ? "Finder forslag…" : "Find forslag"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {preview.assistanceAvailable
                    ? "Leverandørens produktnavn og beskrivelse vurderes af Jev. Kontrollér forslagene mod leverandørsiden."
                    : "Produktforslag er ikke tilsluttet endnu. Du kan fortsætte importen manuelt."}
                </p>
                <div aria-live="polite">
                  {assistance && assistance.status !== "ready" ? (
                    <p className="text-sm text-muted-foreground">Forslag er ikke tilgængelige lige nu. Den almindelige import virker stadig.</p>
                  ) : null}
                  {assistance?.status === "ready" && assistance.category ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>Kategori: {getSupplierBankProductFamilyLabelDa(assistance.category.value)}</span>
                        <Badge variant="outline">{assistance.category.review === "uncertain" ? "Usikkert – vælg manuelt" : "Forslag til gennemgang"}</Badge>
                        {assistance.category.review === "suggestion" && assistance.category.value !== productFamily ? (
                          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={useSuggestedCategory}>Brug kategori og genanalysér</Button>
                        ) : null}
                      </div>
                      {assistance.properties?.length ? (
                        <ul className="space-y-1 text-sm">
                          {assistance.properties.map((property) => (
                            <li key={property.key}>{property.label}: {property.valueLabel}{property.review === "uncertain" ? " · Usikkert" : " · Kontrollér"}</li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-muted-foreground">Ingen entydige egenskaber fundet i den læste tekst.</p>}
                      {assistance.properties?.some((property) => property.review === "suggestion") ? (
                        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => {
                          const text = "Egenskaber til gennemgang: " + assistance.properties!.filter((property) => property.review === "suggestion").map((property) => `${property.label}: ${property.valueLabel}`).join("; ");
                          setNote((current) => current.includes(text) ? current : [current.trim(), text].filter(Boolean).join("\n"));
                        }}>Tilføj egenskaber til note</Button>
                      ) : null}
                      <p className="text-xs text-muted-foreground">Egenskaberne er forslag og ændrer ikke produktets prisvalg.</p>
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Vis teksten bag forslagene</summary>
                        <p className="mt-2">{assistance.source?.title}</p>
                        <p>{assistance.source?.description || "Ingen produktbeskrivelse fundet."}</p>
                      </details>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuller
          </Button>
          <Button type="button" onClick={saveDraft} disabled={!previewIsCurrent || saving || analyzing}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
            Gem som bankdraft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
