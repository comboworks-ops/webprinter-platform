
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InkSetFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inkSet?: any;
    tenantId: string;
    onSuccess: () => void;
}

const getDefaultFormData = (inkSet?: any) => ({
    name: inkSet?.name || "",
    price_per_ml: inkSet?.price_per_ml || 0,
    ml_per_m2_at_100pct: inkSet?.ml_per_m2_at_100pct || 15,
    default_coverage_pct: inkSet?.default_coverage_pct || 10,
    tolerance_pct: inkSet?.tolerance_pct || 0,
});

export function InkSetForm({ open, onOpenChange, inkSet, tenantId, onSuccess }: InkSetFormProps) {
    const [formData, setFormData] = useState(getDefaultFormData(inkSet));

    // Reset form data when inkSet prop changes
    useEffect(() => {
        setFormData(getDefaultFormData(inkSet));
    }, [inkSet, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = { ...formData, tenant_id: tenantId };
            let error;
            if (inkSet?.id) {
                ({ error } = await supabase.from('ink_sets' as any).update(data).eq('id', inkSet.id));
            } else {
                ({ error } = await supabase.from('ink_sets' as any).insert(data));
            }

            if (error) throw error;
            toast.success(inkSet?.id ? "Blæksæt opdateret" : "Blæksæt oprettet");
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
                    <DialogTitle>{inkSet?.id ? "Rediger Blæksæt" : "Tilføj Nyt Blæksæt"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Navn</Label>
                        <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="f.ex. CMYK Standard" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">Pris per ml (kr)</Label>
                            <Input id="price" type="number" step="0.01" value={formData.price_per_ml} onChange={e => setFormData({ ...formData, price_per_ml: parseFloat(e.target.value) })} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mlm2">ml per m² (v. 100%)</Label>
                            <Input id="mlm2" type="number" step="0.1" value={formData.ml_per_m2_at_100pct} onChange={e => setFormData({ ...formData, ml_per_m2_at_100pct: parseFloat(e.target.value) })} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="coverage">Std. Dækning (%)</Label>
                            <Input id="coverage" type="number" value={formData.default_coverage_pct} onChange={e => setFormData({ ...formData, default_coverage_pct: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tol">Tolerance (%)</Label>
                            <Input id="tol" type="number" value={formData.tolerance_pct} onChange={e => setFormData({ ...formData, tolerance_pct: parseInt(e.target.value) })} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuller</Button>
                        <Button type="submit">Gem Blæksæt</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
