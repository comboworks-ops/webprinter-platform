
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingProfileFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    profile?: any;
    tenantId: string;
    machines: any[];
    inkSets: any[];
    onSuccess: () => void;
}

const getDefaultFormData = (profile?: any) => ({
    name: profile?.name || "",
    machine_id: profile?.machine_id || "",
    ink_set_id: profile?.ink_set_id || "",
    default_bleed_mm: profile?.default_bleed_mm || 3,
    default_gap_mm: profile?.default_gap_mm || 2,
    include_bleed_in_ink: profile?.include_bleed_in_ink ?? true,
});

export function PricingProfileForm({ open, onOpenChange, profile, tenantId, machines, inkSets, onSuccess }: PricingProfileFormProps) {
    const [formData, setFormData] = useState(getDefaultFormData(profile));

    // Reset form data when profile prop changes
    useEffect(() => {
        setFormData(getDefaultFormData(profile));
    }, [profile, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.machine_id || !formData.ink_set_id) {
            toast.error("Vælg venligst både maskine og blæksæt");
            return;
        }

        try {
            const data = { ...formData, tenant_id: tenantId };
            let error;
            if (profile?.id) {
                ({ error } = await supabase.from('pricing_profiles' as any).update(data).eq('id', profile.id));
            } else {
                ({ error } = await supabase.from('pricing_profiles' as any).insert(data));
            }

            if (error) throw error;
            toast.success(profile?.id ? "Profil opdateret" : "Profil oprettet");
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
                    <DialogTitle>{profile?.id ? "Rediger Pris-profil" : "Ny Pris-profil"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Profil-navn</Label>
                        <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="f.ex. Offset Standard" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Primær Maskine</Label>
                            <Select value={formData.machine_id} onValueChange={v => setFormData({ ...formData, machine_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Vælg maskine" /></SelectTrigger>
                                <SelectContent>
                                    {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Blæk-opsætning</Label>
                            <Select value={formData.ink_set_id} onValueChange={v => setFormData({ ...formData, ink_set_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Vælg blæk" /></SelectTrigger>
                                <SelectContent>
                                    {inkSets.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="bleed">Standard Bleed (mm)</Label>
                            <Input id="bleed" type="number" value={formData.default_bleed_mm} onChange={e => setFormData({ ...formData, default_bleed_mm: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gap">Standard Gap (mm)</Label>
                            <Input id="gap" type="number" value={formData.default_gap_mm} onChange={e => setFormData({ ...formData, default_gap_mm: parseInt(e.target.value) })} />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 border-t pt-4">
                        <Switch id="inkbleed" checked={formData.include_bleed_in_ink} onCheckedChange={v => setFormData({ ...formData, include_bleed_in_ink: v })} />
                        <Label htmlFor="inkbleed">Medregn bleed i blæk-omkostning</Label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuller</Button>
                        <Button type="submit">Gem Profil</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
