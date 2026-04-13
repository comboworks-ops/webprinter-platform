import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_TENANT_ID, getTemplateCategoryLabel, isAttributeTemplateType } from "@/lib/designer/templateLibrary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type ValueSetting = {
  displayName?: string;
  linkedTemplateId?: string | null;
};

type ConnectableValue = {
  id: string;
  name: string;
};

type TemplateOption = {
  id: string;
  name: string;
  category: string | null;
  tenant_id: string | null;
  is_public: boolean;
  template_type: string | null;
  width_mm: number | null;
  height_mm: number | null;
};

type TemplateConnectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  sectionTitle?: string;
  values: ConnectableValue[];
  valueSettings?: Record<string, ValueSetting | undefined>;
  onTemplateChange: (valueId: string, templateId: string | null) => void;
};

const NONE_TEMPLATE_VALUE = "__none__";

export function TemplateConnectDialog({
  open,
  onOpenChange,
  tenantId,
  sectionTitle,
  values,
  valueSettings,
  onTemplateChange,
}: TemplateConnectDialogProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) return;

    let active = true;
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("designer_templates" as any)
          .select("id, name, category, tenant_id, is_public, template_type, width_mm, height_mm")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("category", { ascending: true })
          .order("name", { ascending: true });

        if (error) throw error;
        if (!active) return;

        const filtered = (data || []).filter((template: any) => {
          if (isAttributeTemplateType(template.template_type)) return false;
          const isTenantTemplate = template.tenant_id === tenantId;
          const isSharedMasterTemplate = template.tenant_id === MASTER_TENANT_ID && template.is_public;
          return isTenantTemplate || isSharedMasterTemplate;
        });

        setTemplates(filtered as TemplateOption[]);
      } catch (error) {
        console.error("[TemplateConnectDialog] Failed to load templates", error);
        if (active) setTemplates([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTemplates();
    return () => {
      active = false;
    };
  }, [open, tenantId]);

  const templatesById = useMemo(() => {
    return new Map(templates.map((template) => [template.id, template]));
  }, [templates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Template Connect</DialogTitle>
          <DialogDescription>
            Knyt en bestemt designer-template til hver værdi i sektionen{sectionTitle ? ` "${sectionTitle}"` : ""}.
            Når kunden klikker på Design online, bruges den valgte template automatisk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Henter templates...
            </div>
          ) : null}

          {!loading && templates.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Ingen aktive templates fundet for denne tenant endnu.
            </div>
          ) : null}

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {values.map((value) => {
              const templateId = valueSettings?.[value.id]?.linkedTemplateId || null;
              const selectedTemplate = templateId ? templatesById.get(templateId) : null;
              const displayName = valueSettings?.[value.id]?.displayName?.trim() || value.name;

              return (
                <div key={value.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      {selectedTemplate ? (
                        <Badge variant="secondary" className="shrink-0">
                          Tilknyttet
                        </Badge>
                      ) : null}
                    </div>
                    {selectedTemplate ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedTemplate.name}
                        {selectedTemplate.category ? ` • ${getTemplateCategoryLabel(selectedTemplate.category)}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Ingen template valgt endnu.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Designer-template</Label>
                    <Select
                      value={templateId || NONE_TEMPLATE_VALUE}
                      onValueChange={(nextValue) => onTemplateChange(value.id, nextValue === NONE_TEMPLATE_VALUE ? null : nextValue)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Vælg template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_TEMPLATE_VALUE}>Ingen template</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                            {template.width_mm && template.height_mm
                              ? ` (${template.width_mm}×${template.height_mm} mm)`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
