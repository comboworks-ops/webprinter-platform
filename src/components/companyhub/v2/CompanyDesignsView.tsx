import { useState } from "react";
import { FileText, LockKeyhole, PenLine } from "lucide-react";
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
import type {
  CompanyMembership,
  CompanyOffice,
  CompanyTemplateBindingWithFields,
  CompanyTemplateField,
  HubItem,
} from "@/lib/company-hub";

interface CompanyDesignsViewProps {
  company: CompanyMembership;
  office: CompanyOffice | null;
  items: HubItem[];
  bindings: CompanyTemplateBindingWithFields[];
  canPersonalize: boolean;
  isSaving: boolean;
  onCreateWorkingDesign: (bindingId: string, values: Record<string, unknown>) => Promise<string>;
  onContinue: (item: HubItem, designId: string) => void;
}

function defaultValueForField(
  field: CompanyTemplateField,
  company: CompanyMembership,
  office: CompanyOffice | null,
): string {
  switch (field.default_source) {
    case "company.name": return company.name || "";
    case "company.contact_email": return company.contact_email || "";
    case "office.name": return office?.name || "";
    case "office.email": return office?.email || "";
    case "office.phone": return office?.phone || "";
    default: return String(field.default_value ?? "");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Den personlige version kunne ikke oprettes.";
}

export function CompanyDesignsView({
  company,
  office,
  items,
  bindings,
  canPersonalize,
  isSaving,
  onCreateWorkingDesign,
  onContinue,
}: CompanyDesignsViewProps) {
  const [activeBinding, setActiveBinding] = useState<CompanyTemplateBindingWithFields | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const itemById = new Map(items.map((item) => [item.id, item]));

  const openBinding = (binding: CompanyTemplateBindingWithFields) => {
    setActiveBinding(binding);
    setValues(Object.fromEntries(binding.fields.map((field) => [
      field.field_key,
      defaultValueForField(field, company, office),
    ])));
  };

  const createDesign = async () => {
    if (!activeBinding) return;
    const item = itemById.get(activeBinding.item_id);
    if (!item?.product_slug) {
      toast.error("Produktet er ikke længere tilgængeligt.");
      return;
    }
    try {
      const designId = await onCreateWorkingDesign(activeBinding.id, values);
      toast.success("Din personlige version er klar");
      setActiveBinding(null);
      onContinue(item, designId);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section aria-labelledby="company-designs-heading" className="space-y-5 py-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Godkendt design</p>
        <h2 id="company-designs-heading" className="text-lg font-semibold">Design og skabeloner</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tilpas de godkendte tekstfelter uden at ændre firmaets layout, farver eller fonte.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bindings.map((binding) => {
          const item = itemById.get(binding.item_id);
          if (!item) return null;
          return (
            <article key={binding.id} className="overflow-hidden rounded-md border bg-background">
              <div className="flex aspect-[16/9] items-center justify-center overflow-hidden border-b bg-muted/20">
                {binding.preview_url || item.thumbnail_url ? (
                  <img src={binding.preview_url || item.thumbnail_url || ""} alt={binding.name} className="h-full w-full object-contain p-3" />
                ) : (
                  <FileText className="h-9 w-9 text-muted-foreground/50" aria-hidden="true" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{binding.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{item.title} · {binding.fields.length} felter</p>
                  </div>
                </div>
                <Button className="mt-4 w-full gap-2" variant="outline" onClick={() => openBinding(binding)} disabled={!canPersonalize}>
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  {canPersonalize ? "Tilpas design" : "Kun visning"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {!bindings.length && (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium">Ingen kontrollerede skabeloner endnu</p>
        </div>
      )}

      <Dialog open={Boolean(activeBinding)} onOpenChange={(open) => !open && setActiveBinding(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeBinding?.name}</DialogTitle>
            <DialogDescription>Udfyld felterne nedenfor. Designets øvrige elementer er låst.</DialogDescription>
          </DialogHeader>
          {activeBinding && (
            <div className="grid gap-6 py-2 sm:grid-cols-[14rem_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-md border bg-muted/20">
                {activeBinding.preview_url ? (
                  <img src={activeBinding.preview_url} alt={activeBinding.name} className="aspect-[4/3] w-full object-contain p-3" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center"><FileText className="h-8 w-8 text-muted-foreground/50" /></div>
                )}
              </div>
              <div className="space-y-4">
                {activeBinding.fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`company-field-${field.id}`}>{field.label}{field.is_required ? " *" : ""}</Label>
                    {field.field_type === "select" ? (
                      <Select value={values[field.field_key] || ""} onValueChange={(value) => setValues({ ...values, [field.field_key]: value })}>
                        <SelectTrigger id={`company-field-${field.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{field.allowed_values.map((value) => <SelectItem key={String(value)} value={String(value)}>{String(value)}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`company-field-${field.id}`}
                        type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
                        maxLength={field.max_length || undefined}
                        value={values[field.field_key] || ""}
                        onChange={(event) => setValues({ ...values, [field.field_key]: event.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveBinding(null)}>Annuller</Button>
            <Button onClick={createDesign} disabled={isSaving}>Opret personlig version</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
