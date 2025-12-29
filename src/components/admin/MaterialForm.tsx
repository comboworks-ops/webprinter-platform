
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MaterialFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    material?: any;
    tenantId: string;
    onSuccess: () => void;
}

const getDefaultFormData = (material?: any) => ({
    name: material?.name || "",
    material_type: material?.material_type || "PAPER",
    pricing_mode: material?.pricing_mode || "PER_SHEET",
    price_per_sheet: material?.price_per_sheet || 0,
    price_per_m2: material?.price_per_m2 || 0,
    sheet_width_mm: material?.sheet_width_mm || 0,
    sheet_height_mm: material?.sheet_height_mm || 0,
});

export function MaterialForm({ open, onOpenChange, material, tenantId, onSuccess }: MaterialFormProps) {
    const [formData, setFormData] = useState(getDefaultFormData(material));

    // Reset form data when material prop changes
    useEffect(() => {
        setFormData(getDefaultFormData(material));
    }, [material, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = { ...formData, tenant_id: tenantId };
            let error;
            if (material?.id) {
                ({ error } = await supabase.from('materials' as any).update(data).eq('id', material.id));
            } else {
                ({ error } = await supabase.from('materials' as any).insert(data));
            }

            if (error) throw error;
            toast.success(material?.id ? "Materiale opdateret" : "Materiale oprettet");
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error("Kunne ikke gemme: " + err.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{material?.id ? "Rediger Materiale" : "Tilføj Nyt Materiale"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Navn</Label>
                        <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="f.ex. 300g Silk" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={formData.material_type} onValueChange={v => setFormData({ ...formData, material_type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PAPER">Papir</SelectItem>
                                    <SelectItem value="FOIL">Folie</SelectItem>
                                    <SelectItem value="VINYL">Vinyl</SelectItem>
                                    <SelectItem value="OTHER">Andet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Pris-model</Label>
                            <Select value={formData.pricing_mode} onValueChange={v => setFormData({ ...formData, pricing_mode: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PER_SHEET">Per Ark</SelectItem>
                                    <SelectItem value="PER_M2">Per m²</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {formData.pricing_mode === 'PER_SHEET' ? (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pps">Pris/Ark</Label>
                                <Input id="pps" type="number" step="0.01" value={formData.price_per_sheet} onChange={e => setFormData({ ...formData, price_per_sheet: parseFloat(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sw">Bredde (mm)</Label>
                                <Input id="sw" type="number" value={formData.sheet_width_mm} onChange={e => setFormData({ ...formData, sheet_width_mm: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sh">Højde (mm)</Label>
                                <Input id="sh" type="number" value={formData.sheet_height_mm} onChange={e => setFormData({ ...formData, sheet_height_mm: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="pm2">Pris per m² (kr)</Label>
                            <Input id="pm2" type="number" step="0.01" value={formData.price_per_m2} onChange={e => setFormData({ ...formData, price_per_m2: parseFloat(e.target.value) })} />
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuller</Button>
                        <Button type="submit">Gem Materiale</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
