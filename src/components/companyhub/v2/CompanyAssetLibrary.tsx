import { useRef, useState } from "react";
import { Archive, Building2, Download, FileImage, FileText, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyAsset, CompanyAssetUploadInput, CompanyOffice } from "@/lib/company-hub";

interface CompanyAssetLibraryProps {
  assets: CompanyAsset[];
  offices: CompanyOffice[];
  canUpload: boolean;
  canArchive?: boolean;
  isSaving: boolean;
  onUpload: (input: CompanyAssetUploadInput) => Promise<unknown>;
  onOpen: (asset: CompanyAsset) => Promise<void>;
  onArchive?: (assetId: string) => Promise<unknown>;
}

const assetLabels: Record<CompanyAsset["asset_type"], string> = {
  logo: "Logo",
  image: "Billede",
  source_pdf: "Original PDF",
  approved_artwork: "Godkendt trykfil",
  supporting_document: "Bilag",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "Ukendt størrelse";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("da-DK", { maximumFractionDigits: 1 })} MB`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Filen kunne ikke behandles.";
}

export function CompanyAssetLibrary({
  assets,
  offices,
  canUpload,
  canArchive = false,
  isSaving,
  onUpload,
  onOpen,
  onArchive,
}: CompanyAssetLibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [officeId, setOfficeId] = useState("shared");
  const [assetType, setAssetType] = useState<CompanyAsset["asset_type"]>("source_pdf");
  const officeById = new Map(offices.map((office) => [office.id, office]));

  const reset = () => {
    setFile(null);
    setName("");
    setOfficeId("shared");
    setAssetType("source_pdf");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const upload = async () => {
    if (!file) {
      toast.error("Vælg en fil først.");
      return;
    }
    try {
      await onUpload({
        file,
        name: name || file.name,
        officeId: officeId === "shared" ? null : officeId,
        assetType,
      });
      toast.success("Filen er lagt i firmaets bibliotek");
      setDialogOpen(false);
      reset();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section aria-labelledby="company-assets-heading" className="py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Privat filbibliotek</p>
          <h2 id="company-assets-heading" className="text-lg font-semibold">Filer og trykmateriale</h2>
          <p className="mt-1 text-sm text-muted-foreground">PDF'er, logoer og godkendte trykfiler deles sikkert med firmaets brugere.</p>
        </div>
        {canUpload && (
          <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Upload fil
          </Button>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => {
          const isImage = asset.mime_type.startsWith("image/");
          const office = asset.office_id ? officeById.get(asset.office_id) : null;
          return (
            <article key={asset.id} className="flex min-h-32 flex-col justify-between rounded-md border bg-background p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {isImage ? <FileImage className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold" title={asset.name}>{asset.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{assetLabels[asset.asset_type]} · {formatBytes(asset.file_size_bytes)}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {office?.name || "Alle kontorer"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => onOpen(asset)}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Åbn
                </Button>
                {canArchive && onArchive && (
                  <Button variant="ghost" size="icon" title="Arkivér fil" onClick={() => onArchive(asset.id)} disabled={isSaving}>
                    <Archive className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!assets.length && (
        <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed text-center">
          <Upload className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium">Ingen filer i biblioteket endnu</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload den første PDF, trykfil eller logofil.</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) reset(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload til firmaets bibliotek</DialogTitle>
            <DialogDescription>Filen er privat og kan kun åbnes af firmaets medlemmer og Webprinter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="company-asset-file">Fil</Label>
              <Input
                ref={fileInputRef}
                id="company-asset-file"
                type="file"
                accept=".pdf,.ai,.eps,.ps,.svg,.jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  setFile(nextFile);
                  if (nextFile && !name) setName(nextFile.name);
                }}
              />
              <p className="text-xs text-muted-foreground">PDF, AI, EPS, SVG, JPG, PNG eller WebP. Maks. 25 MB.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-asset-name">Visningsnavn</Label>
              <Input id="company-asset-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Fx Godkendt visitkort" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Filtype</Label>
                <Select value={assetType} onValueChange={(value) => setAssetType(value as CompanyAsset["asset_type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(assetLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Synlighed</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">Alle kontorer</SelectItem>
                    {offices.map((office) => <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuller</Button>
            <Button onClick={upload} disabled={isSaving || !file}>Upload fil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
