
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MarginProfileFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    profile?: any;
    tenantId: string;
    onSuccess: () => void;
}

export function MarginProfileForm({ open, onOpenChange, profile: initialProfile, tenantId, onSuccess }: MarginProfileFormProps) {
    const [formData, setFormData] = useState({
        name: initialProfile?.name || "",
        mode: initialProfile?.mode || "TARGET_MARGIN",
        rounding_step: initialProfile?.rounding_step || 1,
        tier_basis: initialProfile?.tier_basis || "QUANTITY",
    });

    const [tiers, setTiers] = useState<any[]>([]);

    // Reset form data when profile prop changes
    useEffect(() => {
        setFormData({
            name: initialProfile?.name || "",
            mode: initialProfile?.mode || "TARGET_MARGIN",
            rounding_step: initialProfile?.rounding_step || 1,
            tier_basis: initialProfile?.tier_basis || "QUANTITY",
        });

        if (initialProfile?.id) {
            fetchTiers(initialProfile.id);
        } else {
            setTiers([{ qty_from: 1, qty_to: null, value: 30 }]);
        }
    }, [initialProfile, open]);

    const fetchTiers = async (profileId: string) => {
        const { data } = await supabase.from('margin_profile_tiers' as any).select('*').eq('margin_profile_id', profileId).order('qty_from');
        if (data) setTiers(data);
    };

    const addTier = () => {
        const lastTier = tiers[tiers.length - 1];
        const newFrom = lastTier ? (lastTier.qty_to || lastTier.qty_from + 100) : 1;
        setTiers([...tiers, { qty_from: newFrom, qty_to: null, value: 20 }]);
    };

    const removeTier = (index: number) => {
        setTiers(tiers.filter((_, i) => i !== index));
    };

    const updateTier = (index: number, field: string, value: any) => {
        const newTiers = [...tiers];
        newTiers[index][field] = value;
        setTiers(newTiers);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const profileData = { ...formData, tenant_id: tenantId };
            let profileId = initialProfile?.id;

            if (profileId) {
                await supabase.from('margin_profiles' as any).update(profileData).eq('id', profileId);
            } else {
                const { data } = await supabase.from('margin_profiles' as any).insert(profileData).select().single();
                profileId = data.id;
            }

            // Sync Tiers: Simplest is Delete all and re-insert
            await supabase.from('margin_profile_tiers' as any).delete().eq('margin_profile_id', profileId);
            await supabase.from('margin_profile_tiers' as any).insert(
                tiers.map((t, i) => ({
                    ...t,
                    margin_profile_id: profileId,
                    tenant_id: tenantId,
                    sort_order: i
                }))
            );

            toast.success("Margin-profil gemt");
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error("Fejl: " + err.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{initialProfile?.id ? "Rediger Margin-profil" : "Ny Margin-profil"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label>Profil-navn</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Metode</Label>
                            <Select value={formData.mode} onValueChange={v => setFormData({ ...formData, mode: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TARGET_MARGIN">Target Margin (%)</SelectItem>
                                    <SelectItem value="MARKUP">Markup (%)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Afrunding (trin)</Label>
                            <Input type="number" step="0.01" value={formData.rounding_step} onChange={e => setFormData({ ...formData, rounding_step: parseFloat(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Trin-basis</Label>
                            <Select value={formData.tier_basis} onValueChange={v => setFormData({ ...formData, tier_basis: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="QUANTITY">Antal (stk)</SelectItem>
                                    <SelectItem value="AREA">Areal (m²)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-lg">Pris-trapper (Mængde-baseret)</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addTier} className="gap-2">
                                <Plus className="h-4 w-4" /> Tilføj Trin
                            </Button>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{formData.tier_basis === 'QUANTITY' ? 'Antal fra' : 'Areal fra (m²)'}</TableHead>
                                    <TableHead>{formData.tier_basis === 'QUANTITY' ? 'Antal til' : 'Areal til (m²)'}</TableHead>
                                    <TableHead>{formData.mode === 'TARGET_MARGIN' ? 'Margin %' : 'Markup %'}</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tiers.map((tier, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell><Input type="number" className="h-8" value={tier.qty_from} onChange={e => updateTier(idx, 'qty_from', parseInt(e.target.value))} /></TableCell>
                                        <TableCell><Input type="number" className="h-8" value={tier.qty_to || ""} onChange={e => updateTier(idx, 'qty_to', e.target.value ? parseInt(e.target.value) : null)} placeholder="∞" /></TableCell>
                                        <TableCell><Input type="number" className="h-8" value={tier.value} onChange={e => updateTier(idx, 'value', parseFloat(e.target.value))} /></TableCell>
                                        <TableCell>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeTier(idx)} disabled={tiers.length === 1}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter>
                        <Button type="submit">Gem Profil</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
