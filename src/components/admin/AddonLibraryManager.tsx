/**
 * Addon Library Manager
 *
 * Admin component for managing the shared add-on library.
 * Add-ons created here can be imported into any product (Tryksager or Storformat).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Trash2, Plus, Edit2, Save, X, ChevronDown, ChevronRight, Package, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useAddonLibrary } from '@/hooks/useAddonLibrary';
import { useShopSettings } from '@/hooks/useShopSettings';
import type {
  AddonCategory,
  AddonDisplayType,
  AddonPricingMode,
  AddonLibraryGroupWithItems,
  AddonLibraryItem,
} from '@/lib/addon-library/types';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

// Category labels in Danish
const CATEGORY_LABELS: Record<AddonCategory, string> = {
  addon: 'Tilvalg',
  finish: 'Efterbehandling',
  accessory: 'Tilbehør',
  service: 'Service',
  material: 'Materiale',
};

// Display type labels in Danish
const DISPLAY_TYPE_LABELS: Record<AddonDisplayType, string> = {
  buttons: 'Knapper',
  icon_grid: 'Ikongitter',
  dropdown: 'Dropdown',
  checkboxes: 'Afkrydsning',
};

// Pricing mode labels in Danish
const PRICING_MODE_LABELS: Record<AddonPricingMode, string> = {
  fixed: 'Fast pris',
  per_quantity: 'Pr. stk',
  per_area: 'Pr. m²',
  tiered: 'Prisstige',
};

export function AddonLibraryManager() {
  const settings = useShopSettings();
  const tenantId = settings.data?.id;
  const library = useAddonLibrary(tenantId);

  // New group form state
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    display_label: '',
    description: '',
    category: 'addon' as AddonCategory,
    display_type: 'buttons' as AddonDisplayType,
  });

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Editing states
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // New item form state (per group)
  const [addingItemToGroup, setAddingItemToGroup] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    display_label: '',
    description: '',
    pricing_mode: 'fixed' as AddonPricingMode,
    base_price: 0,
  });

  // Temporary edit state
  const [editGroup, setEditGroup] = useState<Partial<AddonLibraryGroupWithItems>>({});
  const [editItem, setEditItem] = useState<Partial<AddonLibraryItem>>({});

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Create new group
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim() || !newGroup.display_label.trim()) {
      toast.error('Udfyld navn og label');
      return;
    }

    const result = await library.createGroup({
      name: newGroup.name.toLowerCase().replace(/\s+/g, '_'),
      display_label: newGroup.display_label,
      description: newGroup.description || null,
      category: newGroup.category,
      display_type: newGroup.display_type,
    });

    if (result) {
      setShowAddGroup(false);
      setNewGroup({
        name: '',
        display_label: '',
        description: '',
        category: 'addon',
        display_type: 'buttons',
      });
      // Expand the new group
      setExpandedGroups(new Set([...expandedGroups, result.id]));
    }
  };

  // Start editing group
  const startEditGroup = (group: AddonLibraryGroupWithItems) => {
    setEditingGroupId(group.id);
    setEditGroup({
      display_label: group.display_label,
      description: group.description,
      category: group.category,
      display_type: group.display_type,
    });
  };

  // Save group edit
  const saveGroupEdit = async (groupId: string) => {
    await library.updateGroup(groupId, {
      display_label: editGroup.display_label,
      description: editGroup.description,
      category: editGroup.category,
      display_type: editGroup.display_type,
    });
    setEditingGroupId(null);
    setEditGroup({});
  };

  // Delete group
  const handleDeleteGroup = async (groupId: string) => {
    if (confirm('Er du sikker? Alle tilvalg i gruppen slettes også.')) {
      await library.deleteGroup(groupId);
    }
  };

  // Create new item
  const handleCreateItem = async (groupId: string) => {
    if (!newItem.name.trim() || !newItem.display_label.trim()) {
      toast.error('Udfyld navn og label');
      return;
    }

    const result = await library.createItem({
      group_id: groupId,
      name: newItem.name.toLowerCase().replace(/\s+/g, '_'),
      display_label: newItem.display_label,
      description: newItem.description || null,
      pricing_mode: newItem.pricing_mode,
      base_price: newItem.base_price,
    });

    if (result) {
      setAddingItemToGroup(null);
      setNewItem({
        name: '',
        display_label: '',
        description: '',
        pricing_mode: 'fixed',
        base_price: 0,
      });
    }
  };

  // Start editing item
  const startEditItem = (item: AddonLibraryItem) => {
    setEditingItemId(item.id);
    setEditItem({
      display_label: item.display_label,
      description: item.description,
      pricing_mode: item.pricing_mode,
      base_price: item.base_price,
      enabled: item.enabled,
    });
  };

  // Save item edit
  const saveItemEdit = async (itemId: string) => {
    await library.updateItem(itemId, {
      display_label: editItem.display_label,
      description: editItem.description,
      pricing_mode: editItem.pricing_mode,
      base_price: editItem.base_price,
      enabled: editItem.enabled,
    });
    setEditingItemId(null);
    setEditItem({});
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Er du sikker?')) {
      await library.deleteItem(itemId);
    }
  };

  if (library.loading) {
    return <div className="p-6 text-center text-muted-foreground">Indlæser bibliotek...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tilvalgsbibliotek</h2>
          <p className="text-muted-foreground">
            Opret tilvalg her og importer dem til produkter i Format eller Storformat.
          </p>
        </div>
        <Button onClick={() => setShowAddGroup(true)} disabled={showAddGroup}>
          <Plus className="h-4 w-4 mr-2" />
          Ny gruppe
        </Button>
      </div>

      {/* Add new group form */}
      {showAddGroup && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Opret ny tilvalgsgruppe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Internt navn</Label>
                <Input
                  placeholder="f.eks. laminering"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Visningsnavn</Label>
                <Input
                  placeholder="f.eks. Laminering"
                  value={newGroup.display_label}
                  onChange={(e) => setNewGroup({ ...newGroup, display_label: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={newGroup.category}
                  onValueChange={(v) => setNewGroup({ ...newGroup, category: v as AddonCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visningstype</Label>
                <Select
                  value={newGroup.display_type}
                  onValueChange={(v) => setNewGroup({ ...newGroup, display_type: v as AddonDisplayType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DISPLAY_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beskrivelse (valgfri)</Label>
              <Textarea
                placeholder="Hjælpetekst til kunderne..."
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateGroup}>Opret gruppe</Button>
              <Button variant="ghost" onClick={() => setShowAddGroup(false)}>
                Annuller
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups list */}
      {library.groups.length === 0 && !showAddGroup ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Ingen tilvalgsgrupper endnu. Opret din første gruppe for at komme i gang.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {library.groups.map((group) => (
            <Collapsible
              key={group.id}
              open={expandedGroups.has(group.id)}
              onOpenChange={() => toggleGroup(group.id)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{group.display_label}</span>
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_LABELS[group.category]}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {group.items.length} tilvalg
                            </Badge>
                            {group.usage_count && group.usage_count > 0 && (
                              <Badge className="text-xs">
                                Bruges af {group.usage_count} produkt(er)
                              </Badge>
                            )}
                          </div>
                          {group.description && (
                            <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditGroup(group)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteGroup(group.id)}
                          disabled={group.usage_count && group.usage_count > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    {/* Edit group form */}
                    {editingGroupId === group.id && (
                      <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Visningsnavn</Label>
                            <Input
                              value={editGroup.display_label || ''}
                              onChange={(e) =>
                                setEditGroup({ ...editGroup, display_label: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Visningstype</Label>
                            <Select
                              value={editGroup.display_type}
                              onValueChange={(v) =>
                                setEditGroup({ ...editGroup, display_type: v as AddonDisplayType })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(DISPLAY_TYPE_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Beskrivelse</Label>
                          <Textarea
                            value={editGroup.description || ''}
                            onChange={(e) =>
                              setEditGroup({ ...editGroup, description: e.target.value })
                            }
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveGroupEdit(group.id)}>
                            <Save className="h-4 w-4 mr-1" />
                            Gem
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingGroupId(null);
                              setEditGroup({});
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Annuller
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Items list */}
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          {editingItemId === item.id ? (
                            // Edit item form
                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Visningsnavn</Label>
                                  <Input
                                    value={editItem.display_label || ''}
                                    onChange={(e) =>
                                      setEditItem({ ...editItem, display_label: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Pristype</Label>
                                  <Select
                                    value={editItem.pricing_mode}
                                    onValueChange={(v) =>
                                      setEditItem({ ...editItem, pricing_mode: v as AddonPricingMode })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(PRICING_MODE_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Basispris</Label>
                                  <Input
                                    type="number"
                                    value={editItem.base_price || 0}
                                    onChange={(e) =>
                                      setEditItem({ ...editItem, base_price: parseFloat(e.target.value) || 0 })
                                    }
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={editItem.enabled !== false}
                                    onCheckedChange={(checked) =>
                                      setEditItem({ ...editItem, enabled: checked })
                                    }
                                  />
                                  <Label className="text-xs">Aktiv</Label>
                                </div>
                                <Button size="sm" onClick={() => saveItemEdit(item.id)}>
                                  <Save className="h-3 w-3 mr-1" />
                                  Gem
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingItemId(null);
                                    setEditItem({});
                                  }}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Annuller
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // Display item
                            <>
                              <div className="flex items-center gap-3">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <span className={item.enabled ? '' : 'text-muted-foreground line-through'}>
                                    {item.display_label}
                                  </span>
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    {item.base_price > 0 && (
                                      <>
                                        {item.base_price} kr
                                        {item.pricing_mode !== 'fixed' && (
                                          <span className="ml-1">({PRICING_MODE_LABELS[item.pricing_mode]})</span>
                                        )}
                                      </>
                                    )}
                                    {item.base_price === 0 && 'Gratis'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => startEditItem(item)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Add new item form */}
                      {addingItemToGroup === group.id ? (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Internt navn</Label>
                              <Input
                                placeholder="f.eks. mat_laminering"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Visningsnavn</Label>
                              <Input
                                placeholder="f.eks. Mat laminering"
                                value={newItem.display_label}
                                onChange={(e) => setNewItem({ ...newItem, display_label: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Pristype</Label>
                              <Select
                                value={newItem.pricing_mode}
                                onValueChange={(v) =>
                                  setNewItem({ ...newItem, pricing_mode: v as AddonPricingMode })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(PRICING_MODE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Basispris (kr)</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={newItem.base_price || ''}
                                onChange={(e) =>
                                  setNewItem({ ...newItem, base_price: parseFloat(e.target.value) || 0 })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleCreateItem(group.id)}>
                              Tilføj tilvalg
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAddingItemToGroup(null);
                                setNewItem({
                                  name: '',
                                  display_label: '',
                                  description: '',
                                  pricing_mode: 'fixed',
                                  base_price: 0,
                                });
                              }}
                            >
                              Annuller
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setAddingItemToGroup(group.id)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Tilføj tilvalg
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
