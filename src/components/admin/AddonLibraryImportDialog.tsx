/**
 * Addon Library Import Dialog
 *
 * Dialog for importing add-on groups from the library into a product.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Check, Library } from 'lucide-react';
import { useAddonLibrary } from '@/hooks/useAddonLibrary';
import { useProductAddons } from '@/hooks/useProductAddons';
import type { AddonCategory, AddonLibraryGroupWithItems } from '@/lib/addon-library/types';

// Category labels in Danish
const CATEGORY_LABELS: Record<AddonCategory, string> = {
  addon: 'Tilvalg',
  finish: 'Efterbehandling',
  accessory: 'Tilbehør',
  service: 'Service',
  material: 'Materiale',
};

interface AddonLibraryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  tenantId: string;
  /** Called after successful import */
  onImportComplete?: () => void;
}

export function AddonLibraryImportDialog({
  open,
  onOpenChange,
  productId,
  tenantId,
  onImportComplete,
}: AddonLibraryImportDialogProps) {
  const library = useAddonLibrary(tenantId);
  const productAddons = useProductAddons({ productId, tenantId });

  // Selected groups to import
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  // Per-group required setting
  const [requiredSettings, setRequiredSettings] = useState<Record<string, boolean>>({});
  // Loading state
  const [importing, setImporting] = useState(false);

  // Filter out groups that are already imported
  const importedGroupIds = new Set(productAddons.imports.map((i) => i.addon_group_id));
  const availableGroups = library.groups.filter((g) => !importedGroupIds.has(g.id));

  // Toggle group selection
  const toggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  // Toggle required setting
  const toggleRequired = (groupId: string, required: boolean) => {
    setRequiredSettings((prev) => ({
      ...prev,
      [groupId]: required,
    }));
  };

  // Handle import
  const handleImport = async () => {
    if (selectedGroups.size === 0) return;

    setImporting(true);

    try {
      // Import each selected group
      for (const groupId of selectedGroups) {
        await productAddons.importGroup({
          addon_group_id: groupId,
          is_required: requiredSettings[groupId] ?? false,
        });
      }

      // Reset and close
      setSelectedGroups(new Set());
      setRequiredSettings({});
      onOpenChange(false);
      onImportComplete?.();
    } finally {
      setImporting(false);
    }
  };

  // Reset on close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedGroups(new Set());
      setRequiredSettings({});
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Import fra tilvalgsbibliotek
          </DialogTitle>
          <DialogDescription>
            Vælg tilvalgsgrupper at tilføje til dette produkt. Ændringer i biblioteket opdateres automatisk.
          </DialogDescription>
        </DialogHeader>

        {library.loading ? (
          <div className="py-8 text-center text-muted-foreground">Indlæser bibliotek...</div>
        ) : availableGroups.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {library.groups.length === 0
                ? 'Ingen tilvalgsgrupper i biblioteket. Opret grupper i Tilvalgsbibliotek først.'
                : 'Alle tilvalgsgrupper er allerede importeret.'}
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-3">
                {availableGroups.map((group) => (
                  <GroupSelectItem
                    key={group.id}
                    group={group}
                    selected={selectedGroups.has(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    isRequired={requiredSettings[group.id] ?? false}
                    onRequiredChange={(required) => toggleRequired(group.id, required)}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedGroups.size} gruppe(r) valgt
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Annuller
                </Button>
                <Button onClick={handleImport} disabled={selectedGroups.size === 0 || importing}>
                  {importing ? 'Importerer...' : 'Importer'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Individual group selection item
interface GroupSelectItemProps {
  group: AddonLibraryGroupWithItems;
  selected: boolean;
  onToggle: () => void;
  isRequired: boolean;
  onRequiredChange: (required: boolean) => void;
}

function GroupSelectItem({
  group,
  selected,
  onToggle,
  isRequired,
  onRequiredChange,
}: GroupSelectItemProps) {
  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{group.display_label}</span>
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[group.category]}
            </Badge>
          </div>
          {group.description && (
            <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {group.items.slice(0, 5).map((item) => (
              <Badge key={item.id} variant="secondary" className="text-xs">
                {item.display_label}
              </Badge>
            ))}
            {group.items.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{group.items.length - 5} mere
              </Badge>
            )}
          </div>

          {/* Required toggle - only shown when selected */}
          {selected && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <Switch
                id={`required-${group.id}`}
                checked={isRequired}
                onCheckedChange={onRequiredChange}
              />
              <Label htmlFor={`required-${group.id}`} className="text-sm">
                Påkrævet valg
              </Label>
            </div>
          )}
        </div>
        {selected && <Check className="h-5 w-5 text-primary shrink-0" />}
      </div>
    </div>
  );
}
