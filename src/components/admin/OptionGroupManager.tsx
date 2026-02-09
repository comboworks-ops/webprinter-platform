import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, GripVertical, Upload, Edit2, Save, X, Copy, Library } from "lucide-react";
import { toast } from "sonner";
import { AddonLibraryImportDialog } from "./AddonLibraryImportDialog";
import { useProductAddons } from "@/hooks/useProductAddons";

interface OptionGroup {
  id: string;
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
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingOptionData, setEditingOptionData] = useState<Partial<ProductOption>>({});
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupDescription, setEditingGroupDescription] = useState("");

  // Library import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Library-imported add-ons
  const productAddons = useProductAddons({ productId, tenantId: tenantId || "" });

  useEffect(() => {
    fetchData();
    // Also fetch library-imported add-ons
    productAddons.fetchResolvedAddons();
  }, [productId]);

  async function fetchData() {
    setLoading(true);

    // Only fetch option groups that are assigned to THIS product
    const { data: assignments } = await supabase
      .from('product_option_group_assignments')
      .select('option_group_id, sort_order')
      .eq('product_id', productId)
      .order('sort_order');

    if (!assignments || assignments.length === 0) {
      setGroups([]);
      setOptions({});
      setLoading(false);
      return;
    }

    const groupIds = assignments.map(a => a.option_group_id);

    // Fetch only the assigned groups
    const { data: groupsData } = await supabase
      .from('product_option_groups')
      .select('*')
      .in('id', groupIds);

    if (groupsData) {
      // Sort by assignment order
      const sortedGroups = groupsData.sort((a, b) => {
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
          optionsMap[group.id] = optionsData;
        }
      }
      setOptions(optionsMap as Record<string, ProductOption[]>);
    }

    setLoading(false);
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim() || !newGroupLabel.trim()) {
      toast.error("Udfyld både navn og label");
      return;
    }

    const normalizedName = newGroupName.toLowerCase().replace(/\s+/g, '_');

    // 1. Check if group with this NAME already exists (global unique constraint)
    const { data: existingGroup, error: findError } = await (supabase
      .from('product_option_groups') as any)
      .select('*')
      .eq('name', normalizedName)
      .maybeSingle();

    if (findError) {
      toast.error("Kunne ikke søge efter eksisterende gruppe: " + findError.message);
      return;
    }

    let groupToAssign = existingGroup;

    // 2. If it doesn't exist, CREATE it
    if (!groupToAssign) {
      const { data: newGroup, error: createError } = await (supabase
        .from('product_option_groups') as any)
        .insert({
          name: normalizedName,
          label: newGroupLabel,
          display_type: newGroupDisplayType,
          tenant_id: tenantId
        })
        .select()
        .single();

      if (createError) {
        toast.error("Fejl ved oprettelse: " + createError.message);
        return;
      }
      groupToAssign = newGroup;

      // Update description separately if needed
      if (newGroupDescription.trim() && groupToAssign) {
        await (supabase.from('product_option_groups') as any)
          .update({ description: newGroupDescription.trim() })
          .eq('id', groupToAssign.id);
      }
    } else {
      console.log("Reusing existing group:", groupToAssign.name);
      // Optionally update label/type if they differ? 
      // User might expect the new values to take effect if they manually typed them.
      await (supabase.from('product_option_groups') as any)
        .update({
          label: newGroupLabel,
          display_type: newGroupDisplayType
        })
        .eq('id', groupToAssign.id);
    }

    // 3. Check if already assigned to this product
    if (groupToAssign) {
      const { data: existingAssignment } = await supabase
        .from('product_option_group_assignments')
        .select('*')
        .eq('product_id', productId)
        .eq('option_group_id', groupToAssign.id)
        .maybeSingle();

      if (existingAssignment) {
        toast.error("Denne gruppe er allerede tilføjet til produktet");
        setShowAddGroup(false);
        setNewGroupName("");
        setNewGroupLabel("");
        setNewGroupDescription("");
        return;
      }

      // 4. Assign to this product
      const { error: assignError } = await supabase
        .from('product_option_group_assignments')
        .insert({
          product_id: productId,
          option_group_id: groupToAssign.id,
          sort_order: groups.length
        });

      if (assignError) {
        toast.error("Fejl ved tildeling: " + assignError.message);
        return;
      }
    }


    toast.success("Gruppe oprettet og tilføjet");
    setNewGroupName("");
    setNewGroupLabel("");
    setNewGroupDescription("");
    setShowAddGroup(false);
    fetchData();
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm("Er du sikker på at du vil slette denne gruppe og alle dens valgmuligheder fra dette produkt?")) return;

    // Remove assignment first
    await supabase
      .from('product_option_group_assignments')
      .delete()
      .eq('product_id', productId)
      .eq('option_group_id', groupId);

    // Delete all options in the group
    await supabase
      .from('product_options')
      .delete()
      .eq('group_id', groupId);

    // Delete the group itself
    const { error } = await supabase
      .from('product_option_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      toast.error("Fejl ved sletning: " + error.message);
      return;
    }

    toast.success("Gruppe slettet");
    fetchData();
  }

  async function handleAddOption(groupId: string) {
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
    const { error } = await supabase
      .from('product_options')
      .delete()
      .eq('id', optionId);

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
      .eq('id', editingOption);

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

    const { error: updateError } = await supabase
      .from('product_options')
      .update({ icon_url: publicUrl })
      .eq('id', optionId);

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
    const { error } = await supabase
      .from('product_option_groups')
      .update({ display_type: displayType })
      .eq('id', groupId);

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
        await (supabase.from('product_options') as any)
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
      }

      // Assign to this product
      await supabase
        .from('product_option_group_assignments')
        .insert({
          product_id: productId,
          option_group_id: newGroup.id,
          sort_order: groups.length
        });

      toast.success('Gruppe kopieret');
      fetchData();
    } catch (e: any) {
      toast.error('Fejl ved kopiering: ' + e.message);
    }
  }

  async function handleCopyOption(option: ProductOption, groupId: string) {
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
        <div className="flex gap-2">
          <Button onClick={() => setShowImportDialog(true)} size="sm" variant="outline">
            <Library className="w-4 h-4 mr-2" />
            Import fra bibliotek
          </Button>
          <Button onClick={() => setShowAddGroup(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Opret ny gruppe
          </Button>
        </div>
      </div>

      {/* Library Import Dialog */}
      {tenantId && (
        <AddonLibraryImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          productId={productId}
          tenantId={tenantId}
          onImportComplete={() => productAddons.refresh()}
        />
      )}

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
                  <SelectItem value="small">Billeder S (40px)</SelectItem>
                  <SelectItem value="medium">Billeder M (64px)</SelectItem>
                  <SelectItem value="large">Billeder L (96px)</SelectItem>
                  <SelectItem value="xl">Billeder XL (128px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateGroup}>Opret</Button>
              <Button variant="outline" onClick={() => setShowAddGroup(false)}>Annuller</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && productAddons.resolvedGroups.length === 0 && !showAddGroup && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Ingen valgmuligheder oprettet for dette produkt.</p>
            <p className="text-sm mt-1">Klik "Opret ny gruppe" eller "Import fra bibliotek" for at tilføje valgmuligheder.</p>
          </CardContent>
        </Card>
      )}

      {/* Library-imported groups */}
      {productAddons.resolvedGroups.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Library className="w-4 h-4" />
            Importeret fra bibliotek
          </h4>
          {productAddons.resolvedGroups.map((group) => (
            <Card key={group.id} className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{group.display_label}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          Fra bibliotek
                        </Badge>
                        {group.is_required && (
                          <Badge variant="outline" className="text-xs">
                            Påkrævet
                          </Badge>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const imp = productAddons.imports.find(i => i.addon_group_id === group.library_group_id);
                      if (imp && confirm('Fjern denne tilvalgsgruppe fra produktet?')) {
                        productAddons.removeImport(imp.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/50"
                    >
                      {item.icon_url && (
                        <div className="w-10 h-10 flex-shrink-0 border rounded bg-background flex items-center justify-center overflow-hidden">
                          <img src={item.icon_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1">
                        <span className="font-medium">{item.display_label}</span>
                        {item.description && (
                          <p className="text-xs text-muted-foreground italic">{item.description}</p>
                        )}
                      </div>
                      {item.base_price > 0 && (
                        <span className="text-sm text-primary font-medium">
                          +{item.base_price} kr
                          {item.pricing_mode === "per_quantity" && "/stk"}
                          {item.pricing_mode === "per_area" && "/m²"}
                        </span>
                      )}
                      {item.has_override && (
                        <Badge variant="outline" className="text-xs">
                          Override
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {groups.map(group => (
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
                            const { error } = await (supabase
                              .from('product_option_groups') as any)
                              .update({ description: editingGroupDescription.trim() || null })
                              .eq('id', group.id);
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
                    onValueChange={(v) => handleUpdateDisplayType(group.id, v)}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buttons">Knapper</SelectItem>
                      <SelectItem value="icon_grid">Ikon-grid</SelectItem>
                      <SelectItem value="small">Billeder S (40px)</SelectItem>
                      <SelectItem value="medium">Billeder M (64px)</SelectItem>
                      <SelectItem value="large">Billeder L (96px)</SelectItem>
                      <SelectItem value="xl">Billeder XL (128px)</SelectItem>
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
                        <Button size="icon" variant="ghost" onClick={handleSaveOption}>
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingOption(null)}>
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
    </div>
  );
}
