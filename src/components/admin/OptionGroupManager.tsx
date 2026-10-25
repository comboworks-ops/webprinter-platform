import { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GripVertical, Upload, Edit2, Save, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { createProductOptionGroup, detachProductOptionGroup } from "@/lib/products/optionGroupSafety";

// Legacy generated types omit tenant_id on these tables; runtime schema includes it.
const optionClient = supabase as unknown as SupabaseClient;

interface OptionGroup {
  id: string;
  tenant_id: string;
  name: string;
  label: string;
  display_type: string;
  description?: string | null;
}

interface ProductOption {
  id: string;
  group_id: string;
  name: string;
  label: string;
  description?: string | null;
  icon_url: string | null;
  extra_price: number;
  price_mode?: "fixed" | "per_quantity" | "per_area";
  sort_order: number;
}

interface OptionGroupManagerProps {
  productId: string;
  tenantId?: string;
}

export function OptionGroupManager({ productId, tenantId }: OptionGroupManagerProps) {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<Record<string, ProductOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupDisplayType, setNewGroupDisplayType] = useState<string>("buttons");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingOptionData, setEditingOptionData] = useState<Partial<ProductOption>>({});
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupDescription, setEditingGroupDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [previewOptionId, setPreviewOptionId] = useState<string | null>(null);
  const selectedGroup = groups.find(group => group.id === selectedGroupId) || groups[0];

  useEffect(() => {
    fetchData();
  }, [productId, tenantId]);

  function canEditGroup(groupId: string) {
    if (!tenantId || groups.find(group => group.id === groupId)?.tenant_id !== tenantId) {
      toast.error("Gruppen tilhører en anden shop. Kopiér gruppen til din shop før redigering.");
      return false;
    }
    return true;
  }

  async function fetchData() {
    setLoading(true);
    setEditingOption(null);
    setEditingGroupId(null);
    if (!tenantId) {
      setGroups([]);
      setOptions({});
      setLoading(false);
      return;
    }

    // Only fetch option groups that are assigned to THIS product
    const { data: assignments } = await optionClient
      .from('product_option_group_assignments')
      .select('option_group_id, sort_order')
      .eq('product_id', productId)
      .eq('tenant_id', tenantId)
      .order('sort_order');

    if (!assignments || assignments.length === 0) {
      setGroups([]);
      setOptions({});
      setLoading(false);
      return;
    }

    const groupIds = assignments.map(a => a.option_group_id);

    // Fetch only the assigned groups
    const { data: groupsData } = await optionClient
      .from('product_option_groups')
      .select('*')
      .in('id', groupIds);

    if (groupsData) {
      // Sort by assignment order
      const sortedGroups = (groupsData as OptionGroup[]).sort((a, b) => {
        const aOrder = assignments.find(x => x.option_group_id === a.id)?.sort_order || 0;
        const bOrder = assignments.find(x => x.option_group_id === b.id)?.sort_order || 0;
        return aOrder - bOrder;
      });
      setGroups(sortedGroups);

      // Fetch options for each group
      const optionsMap: Record<string, ProductOption[]> = {};
      for (const group of sortedGroups) {
        const { data: optionsData } = await supabase
          .from('product_options')
          .select('*')
          .eq('group_id', group.id)
          .order('sort_order');

        if (optionsData) {
          optionsMap[group.id] = optionsData as ProductOption[];
        }
      }
      setOptions(optionsMap as Record<string, ProductOption[]>);
    }

    setLoading(false);
  }

  async function handleCreateGroup() {
    if (creatingGroup) return;
    setCreatingGroup(true);
    try {
      const result = await createProductOptionGroup(supabase, {
        productId, tenantId, name: newGroupName, label: newGroupLabel,
        displayType: newGroupDisplayType, description: newGroupDescription,
        sortOrder: groups.length,
      });
      toast.success(result.reused ? "Eksisterende gruppe tilføjet uden ændringer" : "Gruppe oprettet og tilføjet");
      setNewGroupName("");
      setNewGroupLabel("");
      setNewGroupDescription("");
      setShowAddGroup(false);
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke tilføje gruppen. Prøv igen.");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!tenantId) return;
    if (!confirm("Fjern gruppen fra dette produkt? Gruppen og dens valgmuligheder bevares, så andre produkter ikke ændres.")) return;
    try {
      await detachProductOptionGroup(supabase, tenantId, productId, groupId);
      toast.success("Gruppe fjernet fra produktet");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke fjerne gruppen.");
    }
  }

  async function handleAddOption(groupId: string) {
    if (!canEditGroup(groupId)) return;
    const baseOption = {
      group_id: groupId,
      name: `option_${Date.now()}`,
      label: "Ny valgmulighed",
      extra_price: 0,
      sort_order: (options[groupId]?.length || 0),
      tenant_id: tenantId
    };

    const payload = { ...baseOption, price_mode: "fixed" as const } as any;

    const { data, error } = await (supabase.from('product_options') as any)
      .insert(payload)
      .select()
      .single();

    if (error) {
      toast.error("Fejl ved oprettelse: " + error.message);
      return;
    }

    if (data) {
      setOptions(prev => ({
        ...prev,
        [groupId]: [...(prev[groupId] || []), data as ProductOption]
      }));
      setEditingOption(data.id);
      setEditingOptionData(data as ProductOption);
    }
  }

  async function handleDeleteOption(optionId: string, groupId: string) {
    if (!canEditGroup(groupId)) return;
    const { error } = await optionClient
      .from('product_options')
      .delete()
      .eq('id', optionId)
      .eq('group_id', groupId)
      .eq('tenant_id', tenantId);

    if (error) {
      toast.error("Fejl: " + error.message);
      return;
    }

    setOptions(prev => ({
      ...prev,
      [groupId]: prev[groupId].filter(o => o.id !== optionId)
    }));
    toast.success("Valgmulighed slettet");
  }

  async function handleSaveOption() {
    if (!editingOption || !editingOptionData) return;
    if (!editingOptionData.group_id || !canEditGroup(editingOptionData.group_id)) return;

    const updatePayload: any = {
      name: editingOptionData.name,
      label: editingOptionData.label,
      description: editingOptionData.description || null,
      extra_price: editingOptionData.extra_price || 0,
      icon_url: editingOptionData.icon_url,
      price_mode: editingOptionData.price_mode || "fixed"
    };

    const { error } = await (supabase
      .from('product_options') as any)
      .update(updatePayload)
      .eq('id', editingOption)
      .eq('group_id', editingOptionData.group_id)
      .eq('tenant_id', tenantId);

    if (error) {
      toast.error("Fejl: " + error.message + (error.message?.toLowerCase().includes("price_mode") ? " (kør NOTIFY pgrst, 'reload schema')" : ""));
      return;
    }

    // Update local state
    const groupId = editingOptionData.group_id;
    if (groupId) {
      setOptions(prev => ({
        ...prev,
        [groupId]: prev[groupId].map(o =>
          o.id === editingOption ? { ...o, ...editingOptionData } : o
        )
      }));
    }

    setEditingOption(null);
    setEditingOptionData({});
    toast.success("Gemt");
  }

  async function handleIconUpload(optionId: string, groupId: string, file: File) {
    if (!canEditGroup(groupId)) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `option-icons/${optionId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload fejlede: " + uploadError.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    const { error: updateError } = await optionClient
      .from('product_options')
      .update({ icon_url: publicUrl })
      .eq('id', optionId)
      .eq('group_id', groupId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      toast.error("Fejl ved opdatering: " + updateError.message);
      return;
    }

    setOptions(prev => ({
      ...prev,
      [groupId]: prev[groupId].map(o =>
        o.id === optionId ? { ...o, icon_url: publicUrl } : o
      )
    }));

    if (editingOption === optionId) {
      setEditingOptionData(prev => ({ ...prev, icon_url: publicUrl }));
    }

    toast.success("Ikon uploadet");
  }

  async function handleUpdateDisplayType(groupId: string, displayType: string) {
    if (!canEditGroup(groupId)) return;
    const { error } = await optionClient
      .from('product_option_groups')
      .update({ display_type: displayType })
      .eq('id', groupId)
      .eq('tenant_id', tenantId);

    if (error) {
      toast.error("Fejl: " + error.message);
      return;
    }

    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, display_type: displayType } : g
    ));
    toast.success("Visningstype opdateret");
  }

  async function handleCopyGroup(group: OptionGroup) {
    if (!tenantId) return;
    try {
      // Generate unique name
      const baseName = group.name + '_kopi';
      let uniqueName = baseName;
      let counter = 1;

      // Check for existing names
      const { data: existing } = await supabase
        .from('product_option_groups')
        .select('name')
        .like('name', baseName + '%');

      if (existing && existing.length > 0) {
        const existingNames = new Set(existing.map(e => e.name));
        while (existingNames.has(uniqueName)) {
          uniqueName = baseName + '_' + counter++;
        }
      }

      // Create new group
      const { data: newGroup, error: groupError } = await (supabase
        .from('product_option_groups') as any)
        .insert({
          name: uniqueName,
          label: group.label + ' (kopi)',
          display_type: group.display_type,
          description: group.description,
          tenant_id: tenantId
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Copy all options
      const groupOptions = options[group.id] || [];
      for (const opt of groupOptions) {
        const { error: optionError } = await (supabase.from('product_options') as any)
          .insert({
            group_id: newGroup.id,
            name: opt.name + '_kopi',
            label: opt.label,
            description: opt.description,
            icon_url: opt.icon_url,
            extra_price: opt.extra_price,
            price_mode: opt.price_mode || 'fixed',
            sort_order: opt.sort_order,
            tenant_id: tenantId
          });
        if (optionError) throw optionError;
      }

      // Assign to this product
      const { error: assignmentError } = await optionClient
        .from('product_option_group_assignments')
        .insert({
          product_id: productId,
          option_group_id: newGroup.id,
          sort_order: groups.length,
          tenant_id: tenantId
        });
      if (assignmentError) throw assignmentError;

      toast.success('Gruppe kopieret');
      fetchData();
    } catch (e: any) {
      toast.error('Fejl ved kopiering: ' + e.message);
    }
  }

  async function handleCopyOption(option: ProductOption, groupId: string) {
    if (!canEditGroup(groupId)) return;
    try {
      const { data, error } = await (supabase.from('product_options') as any)
        .insert({
          group_id: groupId,
          name: option.name + '_kopi_' + Date.now(),
          label: option.label + ' (kopi)',
          description: option.description,
          icon_url: option.icon_url,
          extra_price: option.extra_price,
          price_mode: option.price_mode || 'fixed',
          sort_order: (options[groupId]?.length || 0),
          tenant_id: tenantId
        })
        .select()
        .single();

      if (error) throw error;

      setOptions(prev => ({
        ...prev,
        [groupId]: [...(prev[groupId] || []), data as ProductOption]
      }));
      toast.success('Værdi kopieret');
    } catch (e: any) {
      toast.error('Fejl: ' + e.message);
    }
  }

  if (loading) {
    return <div className="p-4">Indlæser...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Valgmuligheder for dette produkt</h3>
          <p className="text-sm text-muted-foreground">Opret og administrer valgmuligheder der vises på produktsiden</p>
        </div>
        <Button onClick={() => setShowAddGroup(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Opret ny gruppe
        </Button>
      </div>

      {showAddGroup && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">Opret ny valggruppe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Internt navn (unikt)</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="f.eks. tryk_type"
                />
              </div>
              <div>
                <Label>Visningsnavn (vises til kunden)</Label>
                <Input
                  value={newGroupLabel}
                  onChange={(e) => setNewGroupLabel(e.target.value)}
                  placeholder="f.eks. Vælg tryktype"
                />
              </div>
            </div>
            <div>
              <Label>Beskrivelse (valgfri)</Label>
              <textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Forklarende tekst der vises under valgmulighederne"
                className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
              />
            </div>
            <div>
              <Label>Visningstype</Label>
              <Select value={newGroupDisplayType} onValueChange={setNewGroupDisplayType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buttons">Knapper</SelectItem>
                  <SelectItem value="icon_grid">Ikon-grid</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="checkboxes">Afkrydsningsfelter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateGroup} disabled={creatingGroup || !tenantId}>{creatingGroup ? "Tilføjer..." : "Opret"}</Button>
              <Button variant="outline" disabled={creatingGroup} onClick={() => setShowAddGroup(false)}>Annuller</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && !showAddGroup && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Ingen valgmuligheder oprettet for dette produkt.</p>
            <p className="text-sm mt-1">Klik "Opret ny gruppe" for at tilføje valgmuligheder.</p>
          </CardContent>
        </Card>
      )}

      <div className="admin-options-workspace">
        <nav className="admin-options-groups" aria-label="Valggrupper">
          <h3 className="mb-4 font-semibold">Grupper</h3>
          {groups.map(group => <button key={group.id} type="button" className="admin-options-group" aria-pressed={selectedGroup?.id === group.id} onClick={() => { setSelectedGroupId(group.id); setPreviewOptionId(null); }}>
            <span>{group.label}</span><span className="text-xs text-muted-foreground">{options[group.id]?.length || 0} valg</span>
          </button>)}
        </nav>
      <div className="admin-options-editor space-y-4">
        {groups.filter(group => group.id === selectedGroup?.id).map(group => (
          <Card key={group.id} className="border-primary">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle className="text-base">{group.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{group.name}</p>
                    {editingGroupId === group.id ? (
                      <div className="mt-2">
                        <textarea
                          value={editingGroupDescription}
                          onChange={(e) => setEditingGroupDescription(e.target.value)}
                          placeholder="Beskrivelse (valgfri)"
                          className="w-full min-h-[60px] px-2 py-1 text-xs rounded border border-input bg-background"
                        />
                        <div className="flex gap-1 mt-1">
                          <Button size="sm" variant="ghost" onClick={async () => {
                            if (!canEditGroup(group.id)) return;
                            const { error } = await (supabase
                              .from('product_option_groups') as any)
                              .update({ description: editingGroupDescription.trim() || null })
                              .eq('id', group.id)
                              .eq('tenant_id', tenantId);
                            if (error) {
                              toast.error("Fejl: " + error.message);
                            } else {
                              setGroups(prev => prev.map(g => g.id === group.id ? { ...g, description: editingGroupDescription.trim() || null } : g));
                              setEditingGroupId(null);
                              toast.success("Beskrivelse opdateret");
                            }
                          }}>
                            <Save className="w-3 h-3 mr-1" /> Gem
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingGroupId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      group.description && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{group.description}</p>
                      )
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingGroupId !== group.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={group.tenant_id !== tenantId}
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setEditingGroupDescription(group.description || "");
                      }}
                    >
                      <Edit2 className="w-3 h-3 mr-1" /> Beskrivelse
                    </Button>
                  )}
                  <Select
                    value={group.display_type}
                    disabled={group.tenant_id !== tenantId}
                    onValueChange={(v) => handleUpdateDisplayType(group.id, v)}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buttons">Knapper</SelectItem>
                      <SelectItem value="icon_grid">Ikon-grid</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="checkboxes">Afkrydsningsfelter</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyGroup(group)}
                    title="Kopiér gruppe"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteGroup(group.id)}
                    title="Fjern gruppe fra produktet"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {options[group.id]?.map(option => (
                  <div
                    key={option.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    {/* Icon preview/upload */}
                    <div className="w-10 h-10 flex-shrink-0 border rounded bg-background flex items-center justify-center overflow-hidden">
                      {option.icon_url ? (
                        <img src={option.icon_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <label className="cursor-pointer w-full h-full flex items-center justify-center hover:bg-muted">
                          <Upload className="w-4 h-4 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleIconUpload(option.id, group.id, file);
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {editingOption === option.id ? (
                      <>
                        <Input
                          value={editingOptionData.label || ""}
                          onChange={(e) => setEditingOptionData(prev => ({ ...prev, label: e.target.value }))}
                          placeholder="Label"
                          className="flex-1"
                        />
                        <Input
                          value={editingOptionData.name || ""}
                          onChange={(e) => setEditingOptionData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Navn (id)"
                          className="w-32"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editingOptionData.extra_price || 0}
                            onChange={(e) => setEditingOptionData(prev => ({ ...prev, extra_price: parseFloat(e.target.value) || 0 }))}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">kr</span>
                        </div>
                        <Select
                          value={editingOptionData.price_mode || "fixed"}
                          onValueChange={(val) => setEditingOptionData(prev => ({ ...prev, price_mode: val as "fixed" | "per_quantity" | "per_area" }))}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Pris-type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fast tillæg</SelectItem>
                            <SelectItem value="per_quantity">Tillæg pr. stk</SelectItem>
                            <SelectItem value="per_area">Tillæg pr. m²</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={editingOptionData.description || ""}
                          onChange={(e) => setEditingOptionData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Beskrivelse (valgfri)"
                          className="w-48"
                        />
                        <Button aria-label={`Gem ændringer til ${option.label}`} size="icon" variant="ghost" onClick={handleSaveOption}>
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button aria-label={`Annuller redigering af ${option.label}`} size="icon" variant="ghost" onClick={() => setEditingOption(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">({option.name})</span>
                          {option.description && (
                            <p className="text-xs text-muted-foreground italic">{option.description}</p>
                          )}
                        </div>
                        {option.extra_price > 0 && (
                          <span className="text-sm text-primary font-medium">
                            +{option.extra_price} kr{option.price_mode === "per_quantity" ? "/stk" : ""}
                          </span>
                        )}
                        <Button
                          aria-label={`Rediger ${option.label}`}
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingOption(option.id);
                            setEditingOptionData(option);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyOption(option, group.id)}
                          title="Kopiér værdi"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          aria-label={`Slet ${option.label}`}
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteOption(option.id, group.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleAddOption(group.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tilføj valgmulighed
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
        <aside className="admin-options-preview">
          <h3 className="font-semibold">Valgvisning</h3>
          <p className="mt-2 text-sm text-muted-foreground">Afprøv gruppens indhold. Valg her ændrer ikke produktet.</p>
          {selectedGroup && <div className="mt-6 space-y-3">
            <h4 className="font-medium">{selectedGroup.label}</h4>
            {selectedGroup.description && <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>}
            {(options[selectedGroup.id] || []).map(option => {
              const preview = editingOption === option.id ? { ...option, ...editingOptionData } : option;
              return <button type="button" key={option.id} className="admin-option-preview" aria-pressed={previewOptionId === option.id} onClick={() => setPreviewOptionId(option.id)}>
                {preview.icon_url && <img src={preview.icon_url} alt="" className="h-16 w-16 shrink-0 rounded object-contain" />}
                <span className="min-w-0"><strong className="block text-sm">{preview.label}</strong>{preview.description && <span className="mt-1 block text-xs text-muted-foreground">{preview.description}</span>}{preview.extra_price > 0 && <span className="mt-2 block text-xs">+{preview.extra_price} kr{preview.price_mode === 'per_quantity' ? '/stk' : preview.price_mode === 'per_area' ? '/m²' : ''}</span>}</span>
              </button>;
            })}
          </div>}
        </aside>
      </div>
    </div>
  );
}
