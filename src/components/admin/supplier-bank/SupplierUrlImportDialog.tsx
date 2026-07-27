import { useEffect, useState } from "react";
import { DatabaseZap, ExternalLink, Link2, Loader2, Search } from "lucide-react";
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
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setPreview(null);
    setPreviewUrl(null);
    setError(null);
    setAnalyzing(false);
    setSaving(false);
  }, [open]);

  async function invokeUrlImport(action: "preview" | "save") {
    const { data, error: functionError } = await supabase.functions.invoke("supplier-bank-url-import", {
      body: {
        action,
        url: url.trim(),
        nameDa: nameDa.trim() || null,
        productFamily,
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

  async function analyzeUrl() {
    if (!url.trim()) {
      setError("Indtast en produkt-URL.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const result = await invokeUrlImport("preview");
      setPreview(result.preview);
      setPreviewUrl(url.trim());
      if (!nameDa.trim()) setNameDa(result.preview.nameDa);
      toast({
        title: "URL analyseret",
        description: result.preview.needsDynamicExtraction
          ? "Produktet blev fundet. Dynamiske priser kræver et udtræk i køen."
          : `${result.preview.totalPriceRows} prislinjer blev fundet.`,
      });
    } catch (caughtError) {
      setPreview(null);
      setPreviewUrl(null);
      setError(caughtError instanceof Error ? caughtError.message : "URL'en kunne ikke analyseres.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveDraft() {
    if (!preview || previewUrl !== url.trim()) return;
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

  const previewIsCurrent = Boolean(preview && previewUrl === url.trim());

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
                  setUrl(event.target.value);
                  setError(null);
                }}
                placeholder="https://www.wir-machen-druck.de/produkt.html"
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={analyzeUrl} disabled={analyzing || saving || !url.trim()}>
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
                onChange={(event) => setProductFamily(event.target.value as SupplierBankProductFamily)}
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
