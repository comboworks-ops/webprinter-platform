import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Copy, Loader2 } from "lucide-react";
import { SelectOrCreate } from "./SelectOrCreate";

interface AddPriceRowProps {
  productId: string;
  productSlug: string;
  tableName: string;
  onPriceAdded: () => void;
  existingPrice?: any;
  isGeneric?: boolean;
}

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: 'number' | 'boolean';
  is_required: boolean;
}

export function AddPriceRow({ productId, productSlug, tableName, onPriceAdded, existingPrice, isGeneric = false }: AddPriceRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Initialize with empty object - only populate when duplicating
  const [formData, setFormData] = useState<any>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (isOpen && productId) {
      fetchCustomFields();
    }
  }, [isOpen, productId]);

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isTieredAreaPricing = ['skilte', 'bannere', 'folie'].includes(productSlug);

      // Frontend validation for tiered area pricing (skilte/bannere/folie)
      if (isTieredAreaPricing) {
        const { material, from_sqm, to_sqm, price_per_sqm } = formData;
        if (!material || material.trim() === '' || [from_sqm, to_sqm, price_per_sqm].some((n: any) => n === undefined || n === null || isNaN(n))) {
          toast.error('Udfyld materiale, fra m², til m² og pris per m²');
          setSaving(false);
          return;
        }
        if (to_sqm <= from_sqm) {
          toast.error('Til m² skal være større end Fra m²');
          setSaving(false);
          return;
        }
      }

      // For generic pricing, add product_id
      const dataToInsert: any = isGeneric 
        ? { ...formData, product_id: productId }
        : { ...formData };

      // Ensure optional numeric fields have safe defaults
      if (isTieredAreaPricing && dataToInsert.discount_percent === undefined) {
        dataToInsert.discount_percent = 0;
      }

      // Insert price row
      const { data: priceData, error: priceError } = await supabase
        .from(tableName as any)
        .insert([dataToInsert])
        .select()
        .single();

      if (priceError) throw priceError;

      // Insert custom field values if any
      if (customFields.length > 0 && priceData && 'id' in priceData) {
        const customFieldInserts = customFields
          .filter(field => customFieldValues[field.id] !== undefined)
          .map(field => ({
            custom_field_id: field.id,
            table_name: tableName,
            record_id: priceData.id as string,
            value: customFieldValues[field.id]
          }));

        if (customFieldInserts.length > 0) {
          const { error: valuesError } = await supabase
            .from('custom_field_values')
            .insert(customFieldInserts);

          if (valuesError) throw valuesError;
        }
      }

      toast.success('Pris tilføjet');
      setIsOpen(false);
      setFormData({});
      setCustomFieldValues({});
      onPriceAdded();
    } catch (error) {
      console.error('Error adding price:', error);
      const message = error instanceof Error ? error.message : 'Kunne ikke tilføje pris';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = () => {
    if (existingPrice) {
      const { id, updated_at, updated_by, created_at, ...rest } = existingPrice;
      setFormData(rest);
      setIsOpen(true);
    }
  };

  const getFormFields = () => {
    switch (productSlug) {
      case 'foldere':
        return (
          <>
            <div className="space-y-2">
              <Label>Format</Label>
              <Input
                value={formData.format || ''}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                placeholder="f.eks. M65, A5, A4"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Papir</Label>
              <Input
                value={formData.paper || ''}
                onChange={(e) => setFormData({ ...formData, paper: e.target.value })}
                placeholder="f.eks. 130g, 170g"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Falsetype</Label>
              <Input
                value={formData.fold_type || ''}
                onChange={(e) => setFormData({ ...formData, fold_type: e.target.value })}
                placeholder="f.eks. midterfals, rullefals"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Antal</Label>
              <Input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_dkk || ''}
                onChange={(e) => setFormData({ ...formData, price_dkk: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      case 'flyers':
        return (
          <>
            <div className="space-y-2">
              <Label>Format</Label>
              <Input
                value={formData.format || ''}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Papir</Label>
              <Input
                value={formData.paper || ''}
                onChange={(e) => setFormData({ ...formData, paper: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Handle</Label>
              <Input
                value={formData.handle || ''}
                onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Antal</Label>
              <Input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_dkk || ''}
                onChange={(e) => setFormData({ ...formData, price_dkk: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Listepris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.list_price_dkk || ''}
                onChange={(e) => setFormData({ ...formData, list_price_dkk: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      case 'visitkort':
        return (
          <>
            <div className="space-y-2">
              <Label>Papir</Label>
              <Input
                value={formData.paper || ''}
                onChange={(e) => setFormData({ ...formData, paper: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Antal</Label>
              <Input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_dkk || ''}
                onChange={(e) => setFormData({ ...formData, price_dkk: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      case 'plakater':
        return (
          <>
            <SelectOrCreate
              label="Format"
              tableName="poster_prices"
              columnName="format"
              value={formData.format || ''}
              onChange={(val) => setFormData({ ...formData, format: val })}
              placeholder="f.eks. A2, A3, 500x700mm"
              required
            />
            <SelectOrCreate
              label="Papir"
              tableName="poster_prices"
              columnName="paper"
              value={formData.paper || ''}
              onChange={(val) => setFormData({ ...formData, paper: val })}
              placeholder="Vælg papirtype"
              required
            />
            <div className="space-y-2">
              <Label>Antal</Label>
              <Input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                placeholder="f.eks. 1, 10, 50, 100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris per styk (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_dkk || ''}
                onChange={(e) => setFormData({ ...formData, price_dkk: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      case 'klistermærker':
        return (
          <>
            <SelectOrCreate
              label="Format"
              tableName="sticker_rates"
              columnName="format"
              value={formData.format || ''}
              onChange={(val) => setFormData({ ...formData, format: val })}
              placeholder="Vælg format"
              required
            />
            <SelectOrCreate
              label="Material"
              tableName="sticker_rates"
              columnName="material"
              value={formData.material || ''}
              onChange={(val) => setFormData({ ...formData, material: val })}
              placeholder="Vælg materialetype"
              required
            />
            <div className="space-y-2">
              <Label>Antal</Label>
              <Input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                placeholder="f.eks. 100, 250, 500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_dkk || ''}
                onChange={(e) => setFormData({ ...formData, price_dkk: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      case 'skilte':
      case 'bannere':
      case 'folie':
        return (
          <>
            <SelectOrCreate
              label="Material"
              tableName={tableName}
              columnName="material"
              value={formData.material || ''}
              onChange={(val) => setFormData({ ...formData, material: val })}
              placeholder="Vælg materialetype"
              required
            />
            <div className="space-y-2">
              <Label>Fra m²</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.from_sqm || ''}
                onChange={(e) => setFormData({ ...formData, from_sqm: parseFloat(e.target.value) })}
                placeholder="f.eks. 0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Til m²</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.to_sqm || ''}
                onChange={(e) => setFormData({ ...formData, to_sqm: parseFloat(e.target.value) })}
                placeholder="f.eks. 5"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris per m² (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_per_sqm || ''}
                onChange={(e) => setFormData({ ...formData, price_per_sqm: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Rabat % (valgfrit)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.discount_percent || ''}
                onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })}
                placeholder="f.eks. 10 for 10% rabat"
              />
            </div>
          </>
        );
      case 'beachflag':
        return (
          <>
            <SelectOrCreate
              label="Størrelse"
              tableName="beachflag_prices"
              columnName="size"
              value={formData.size || ''}
              onChange={(val) => setFormData({ ...formData, size: val })}
              placeholder="f.eks. S (60x180cm), M (75x250cm)"
              required
            />
            <SelectOrCreate
              label="System"
              tableName="beachflag_prices"
              columnName="system"
              value={formData.system || ''}
              onChange={(val) => setFormData({ ...formData, system: val })}
              placeholder="f.eks. Cross, Spike"
              required
            />
            <div className="space-y-2">
              <Label>Antal</Label>
              <Input
                type="number"
                value={formData.quantity || 1}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                placeholder="f.eks. 1, 2, 5, 10"
                min="1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.base_price || ''}
                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      case 'hæfter':
        return (
          <>
            <SelectOrCreate
              label="Format"
              tableName="booklet_rates"
              columnName="format"
              value={formData.format || ''}
              onChange={(val) => setFormData({ ...formData, format: val })}
              placeholder="Vælg format"
              required
            />
            <SelectOrCreate
              label="Papir"
              tableName="booklet_rates"
              columnName="paper"
              value={formData.paper || ''}
              onChange={(val) => setFormData({ ...formData, paper: val })}
              placeholder="Vælg papirtype"
              required
            />
            <div className="space-y-2">
              <Label>Antal sider</Label>
              <Input
                value={formData.pages || ''}
                onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                placeholder="f.eks. 16, 24, 32"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Basispris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.base_price || ''}
                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris per enhed (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_per_unit || ''}
                onChange={(e) => setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      case 'salgsmapper':
        return (
          <>
            <SelectOrCreate
              label="Format"
              tableName="salesfolder_rates"
              columnName="format"
              value={formData.format || ''}
              onChange={(val) => setFormData({ ...formData, format: val })}
              placeholder="f.eks. M65, A4"
              required
            />
            <SelectOrCreate
              label="Papir"
              tableName="salesfolder_rates"
              columnName="paper"
              value={formData.paper || ''}
              onChange={(val) => setFormData({ ...formData, paper: val })}
              placeholder="Vælg papirtype"
              required
            />
            <SelectOrCreate
              label="Sidetype"
              tableName="salesfolder_rates"
              columnName="side_type"
              value={formData.side_type || ''}
              onChange={(val) => setFormData({ ...formData, side_type: val })}
              placeholder="f.eks. Kun forside, For og bagside"
              required
            />
            <div className="space-y-2">
              <Label>Basispris (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.base_price || ''}
                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pris per enhed (DKK)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_per_unit || ''}
                onChange={(e) => setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );
      default:
        // Generic pricing form for products without specific price tables
        if (isGeneric) {
          return (
            <>
              <div className="space-y-2">
                <Label>Variant navn (f.eks. "Størrelse", "Materiale")</Label>
                <Input
                  value={formData.variant_name || ''}
                  onChange={(e) => setFormData({ ...formData, variant_name: e.target.value })}
                  placeholder="f.eks. Størrelse, Farve, Type"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Variant værdi (f.eks. "Large", "Bomuld")</Label>
                <Input
                  value={formData.variant_value || ''}
                  onChange={(e) => setFormData({ ...formData, variant_value: e.target.value })}
                  placeholder="f.eks. Small, Medium, Large"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Antal</Label>
                <Input
                  type="number"
                  value={formData.quantity || 1}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  min="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Pris (DKK)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price_dkk || ''}
                  onChange={(e) => setFormData({ ...formData, price_dkk: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </>
          );
        }
        return <p className="text-muted-foreground">Prisformular ikke tilgængelig for dette produkt endnu</p>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => setIsOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Tilføj ny pris
        </Button>
        {existingPrice && (
          <Button onClick={handleDuplicate} variant="outline" size="sm">
            <Copy className="mr-2 h-4 w-4" />
            Dupliker eksisterende
          </Button>
        )}
      </div>

      {isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Tilføj ny pris</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {getFormFields()}
              
              {/* Custom Fields */}
              {customFields.length > 0 && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Brugerdefinerede Felter</h4>
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label>
                        {field.field_label}
                        {field.is_required && <span className="text-destructive"> *</span>}
                      </Label>
                      {field.field_type === 'number' ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => setCustomFieldValues({
                            ...customFieldValues,
                            [field.id]: parseFloat(e.target.value) || 0
                          })}
                          required={field.is_required}
                        />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={customFieldValues[field.id] || false}
                            onCheckedChange={(checked) => setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: checked
                            })}
                          />
                          <Label className="font-normal">
                            {customFieldValues[field.id] ? 'Ja' : 'Nej'}
                          </Label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Gem pris
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Annuller
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
