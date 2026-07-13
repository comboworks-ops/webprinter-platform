import { useMemo, useState } from "react";
import { Check, FileText, LockKeyhole, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  extractControlledFieldCandidates,
  type CompanyTemplateBindingWithFields,
  type CompanyTemplateCandidate,
  type CreateCompanyTemplateBindingInput,
  type HubItem,
} from "@/lib/company-hub";

interface AdminCompanyTemplatesProps {
  items: HubItem[];
  candidates: CompanyTemplateCandidate[];
  bindings: CompanyTemplateBindingWithFields[];
  isSaving: boolean;
  onCreateBinding: (input: CreateCompanyTemplateBindingInput) => Promise<void>;
}

interface FieldDraft {
  selected: boolean;
  fabricObjectId: string;
  label: string;
  currentValue: string;
  defaultSource: string;
  isRequired: boolean;
}

const defaultSources = [
  { value: "manual", label: "Udfyldes manuelt" },
  { value: "company.name", label: "Firmanavn" },
  { value: "company.contact_email", label: "Firmaets e-mail" },
  { value: "office.name", label: "Kontornavn" },
  { value: "office.email", label: "Kontorets e-mail" },
  { value: "office.phone", label: "Kontorets telefon" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Skabelonen kunne ikke gemmes.";
}

export function AdminCompanyTemplates({
  items,
  candidates,
  bindings,
  isSaving,
  onCreateBinding,
}: AdminCompanyTemplatesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const activeBindings = bindings.filter((binding) => binding.status === "active");
  const activeBindingByItem = new Map(activeBindings.map((binding) => [binding.item_id, binding]));

  const selectedSource = candidates.find((candidate) => `${candidate.kind}:${candidate.id}` === sourceId) || null;
  const visibleCandidates = useMemo(() => {
    const normalized = sourceSearch.trim().toLocaleLowerCase("da-DK");
    return candidates.filter((candidate) => !normalized
      || candidate.name.toLocaleLowerCase("da-DK").includes(normalized)
      || candidate.description?.toLocaleLowerCase("da-DK").includes(normalized));
  }, [candidates, sourceSearch]);

  const openNew = () => {
    setItemId("");
    setSourceId("");
    setSourceSearch("");
    setName("");
    setFields([]);
    setDialogOpen(true);
  };

  const chooseSource = (candidate: CompanyTemplateCandidate) => {
    setSourceId(`${candidate.kind}:${candidate.id}`);
    setName(candidate.name);
    setFields(extractControlledFieldCandidates(candidate.editorJson).map((field) => ({
      selected: true,
      fabricObjectId: field.fabricObjectId,
      label: field.suggestedLabel,
      currentValue: field.currentValue,
      defaultSource: "manual",
      isRequired: true,
    })));
  };

  const updateField = (index: number, change: Partial<FieldDraft>) => {
    setFields((current) => current.map((field, fieldIndex) => (
      fieldIndex === index ? { ...field, ...change } : field
    )));
  };

  const save = async () => {
    if (!itemId || !selectedSource) {
      toast.error("Vælg både produkt og design.");
      return;
    }
    const selectedFields = fields.filter((field) => field.selected);
    if (!selectedFields.length) {
      toast.error("Vælg mindst ét tekstfelt, kunden må ændre.");
      return;
    }
    try {
      await onCreateBinding({
        itemId,
        sourceKind: selectedSource.kind,
        sourceId: selectedSource.id,
        name: name || selectedSource.name,
        previewUrl: selectedSource.previewUrl,
        outputMode: "designer_pdf",
        status: "active",
        fields: selectedFields.map((field, index) => ({
          fabricObjectId: field.fabricObjectId,
          fieldKey: field.label || `felt_${index + 1}`,
          label: field.label || `Felt ${index + 1}`,
          fieldType: field.defaultSource.includes("email") ? "email" : field.defaultSource.includes("phone") ? "phone" : "text",
          isRequired: field.isRequired,
          defaultSource: field.defaultSource === "manual" ? null : field.defaultSource,
          defaultValue: field.currentValue,
          maxLength: 120,
        })),
      });
      toast.success("Den kontrollerede skabelon er aktiveret");
      setDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section aria-labelledby="admin-company-templates-heading" className="py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Brandstyring</p>
          <h2 id="admin-company-templates-heading" className="text-lg font-semibold">Kontrollerede skabeloner</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kunden ændrer kun de tekstfelter, du vælger. Layout, farver og fonte forbliver låst.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tilknyt skabelon
        </Button>
      </div>

      <div className="mt-5 divide-y border-y bg-background">
        {items.map((item) => {
          const binding = activeBindingByItem.get(item.id);
          return (
            <div key={item.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-contain" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.product_name || "Tryksag"}</p>
                </div>
              </div>
              {binding ? (
                <div className="flex items-center gap-3 sm:w-72">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{binding.name}</p>
                    <p className="text-xs text-muted-foreground">Version {binding.version} · {binding.fields.length} redigerbare felter</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground sm:w-72">Ingen skabelon tilknyttet</p>
              )}
            </div>
          );
        })}
      </div>
      {!items.length && <p className="border-b py-10 text-center text-sm text-muted-foreground">Tilføj først et produkt til firmaets katalog.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tilknyt kontrolleret skabelon</DialogTitle>
            <DialogDescription>Vælg et produkt, et godkendt design og præcis de tekstlag, kunden må udfylde.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Firmaprodukt</Label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger><SelectValue placeholder="Vælg produkt" /></SelectTrigger>
                  <SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="binding-name">Navn</Label>
                <Input id="binding-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              {selectedSource?.previewUrl && (
                <div className="overflow-hidden rounded-md border bg-muted/20">
                  <img src={selectedSource.previewUrl} alt={selectedSource.name} className="aspect-[4/3] w-full object-contain p-3" />
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-5">
              <div className="space-y-3">
                <Label>Godkendt design</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Søg i designs og skabeloner" className="pl-9" />
                </div>
                <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {visibleCandidates.map((candidate) => {
                    const selected = sourceId === `${candidate.kind}:${candidate.id}`;
                    return (
                      <button key={`${candidate.kind}:${candidate.id}`} type="button" className={`flex items-center gap-3 rounded-md border p-3 text-left ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40"}`} onClick={() => chooseSource(candidate)}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {candidate.previewUrl ? <img src={candidate.previewUrl} alt="" className="h-full w-full object-contain" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{candidate.name}</span><span className="block text-xs text-muted-foreground">{candidate.kind === "design" ? "Gemt design" : "Skabelon"}</span></span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedSource && (
                <div className="space-y-3">
                  <div>
                    <Label>Redigerbare tekstfelter</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Alle andre elementer låses i kundens personlige kopi.</p>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {fields.map((field, index) => (
                      <div key={field.fabricObjectId} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[auto_minmax(0,1fr)_12rem] sm:items-center">
                        <Checkbox checked={field.selected} onCheckedChange={(checked) => updateField(index, { selected: checked === true })} aria-label={`Tillad ændring af ${field.label}`} />
                        <div className="space-y-1">
                          <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} disabled={!field.selected} aria-label="Feltnavn" />
                          <p className="truncate text-xs text-muted-foreground">Nuværende tekst: {field.currentValue || "Tom"}</p>
                        </div>
                        <Select value={field.defaultSource} onValueChange={(defaultSource) => updateField(index, { defaultSource })} disabled={!field.selected}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{defaultSources.map((source) => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  {!fields.length && (
                    <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
                      Designet har ingen klargjorte tekstlag. Åbn og gem designet igen i designeren først.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuller</Button>
            <Button onClick={save} disabled={isSaving}>Aktivér skabelon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
