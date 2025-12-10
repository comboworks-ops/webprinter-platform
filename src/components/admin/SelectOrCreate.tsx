import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface SelectOrCreateProps {
  label: string;
  tableName: string;
  columnName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function SelectOrCreate({
  label,
  tableName,
  columnName,
  value,
  onChange,
  placeholder = "Vælg eller opret ny",
  required = false,
}: SelectOrCreateProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    fetchOptions();
  }, [tableName, columnName]);

  const fetchOptions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(tableName as any)
        .select(columnName);

      if (error) throw error;

      // Extract unique values
      const uniqueValues = [...new Set(data?.map((item: any) => item[columnName]).filter(Boolean))];
      setOptions(uniqueValues as string[]);
    } catch (error) {
      console.error('Error fetching options:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Indlæser...</span>
        </div>
      </div>
    );
  }

  if (isCreatingNew) {
    return (
      <div className="space-y-2">
        <Label>{label} (Ny)</Label>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Indtast ny ${label.toLowerCase()}`}
            required={required}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setIsCreatingNew(false);
              onChange('');
            }}
            className="px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Annuller
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(val) => {
          if (val === '__create_new__') {
            setIsCreatingNew(true);
            onChange('');
          } else {
            onChange(val);
          }
        }}
        required={required}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value="__create_new__" className="text-primary font-medium">
            ➕ Opret ny...
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
