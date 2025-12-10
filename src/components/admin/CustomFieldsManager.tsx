import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Save, Trash2, Loader2 } from "lucide-react";

interface CustomFieldsManagerProps {
  productId: string;
  onFieldsUpdate?: () => void;
}

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: 'number' | 'boolean';
  is_required: boolean;
  default_value?: any;
}

export function CustomFieldsManager({ productId, onFieldsUpdate }: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newField, setNewField] = useState({
    field_name: '',
    field_label: '',
    field_type: 'number' as 'number' | 'boolean',
    is_required: false,
    default_value: null
  });

  useEffect(() => {
    fetchFields();
  }, [productId]);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      toast.error('Kunne ikke hente brugerdefinerede felter');
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async () => {
    if (!newField.field_name || !newField.field_label) {
      toast.error('Feltnavn og label er påkrævet');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_fields')
        .insert([{
          product_id: productId,
          field_name: newField.field_name.toLowerCase().replace(/\s+/g, '_'),
          field_label: newField.field_label,
          field_type: newField.field_type,
          is_required: newField.is_required,
          default_value: newField.default_value
        }]);

      if (error) throw error;

      toast.success('Felt tilføjet');
      setIsAdding(false);
      setNewField({
        field_name: '',
        field_label: '',
        field_type: 'number',
        is_required: false,
        default_value: null
      });
      await fetchFields();
      onFieldsUpdate?.();
    } catch (error: any) {
      console.error('Error adding field:', error);
      if (error.code === '23505') {
        toast.error('Et felt med dette navn eksisterer allerede');
      } else {
        toast.error('Kunne ikke tilføje felt');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Er du sikker på, at du vil slette dette felt? Alle tilknyttede værdier vil også blive slettet.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      toast.success('Felt slettet');
      await fetchFields();
      onFieldsUpdate?.();
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error('Kunne ikke slette felt');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brugerdefinerede Felter</CardTitle>
        <CardDescription>
          Tilføj ekstra felter som kan bruges i prisberegninger (tal og ja/nej felter)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 && !isAdding ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Ingen brugerdefinerede felter endnu</p>
            <p className="text-sm mt-2">Tilføj felter som Finishing, Lamination, Mounting, etc.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Feltnavn</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Påkrævet</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.field_label}</TableCell>
                  <TableCell className="font-mono text-sm">{field.field_name}</TableCell>
                  <TableCell>
                    {field.field_type === 'number' ? 'Tal' : 'Ja/Nej'}
                  </TableCell>
                  <TableCell>
                    {field.is_required ? 'Ja' : 'Nej'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {isAdding && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-lg">Tilføj nyt felt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Felt Label *</Label>
                  <Input
                    value={newField.field_label}
                    onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
                    placeholder="f.eks. Lamination, Finishing"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Feltnavn (internt) *</Label>
                  <Input
                    value={newField.field_name}
                    onChange={(e) => setNewField({ ...newField, field_name: e.target.value })}
                    placeholder="f.eks. lamination, finishing"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Felttype</Label>
                <Select
                  value={newField.field_type}
                  onValueChange={(value: 'number' | 'boolean') => 
                    setNewField({ ...newField, field_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Tal (numerisk input)</SelectItem>
                    <SelectItem value="boolean">Ja/Nej (toggle)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="required"
                  checked={newField.is_required}
                  onCheckedChange={(checked) => 
                    setNewField({ ...newField, is_required: checked })
                  }
                />
                <Label htmlFor="required">Påkrævet felt</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddField} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Gem Felt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setNewField({
                      field_name: '',
                      field_label: '',
                      field_type: 'number',
                      is_required: false,
                      default_value: null
                    });
                  }}
                >
                  Annuller
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isAdding && (
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tilføj Brugerdefineret Felt
          </Button>
        )}
      </CardContent>
    </Card>
  );
}