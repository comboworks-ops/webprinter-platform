
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MachineFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    machine?: any;
    tenantId: string;
    onSuccess: () => void;
}

const getDefaultFormData = (machine?: any) => ({
    name: machine?.name || "",
    mode: machine?.mode || "SHEET",
    sheet_width_mm: machine?.sheet_width_mm || 0,
    sheet_height_mm: machine?.sheet_height_mm || 0,
    roll_width_mm: machine?.roll_width_mm || 0,
    margin_left_mm: machine?.margin_left_mm || 0,
    margin_right_mm: machine?.margin_right_mm || 0,
    margin_top_mm: machine?.margin_top_mm || 0,
    margin_bottom_mm: machine?.margin_bottom_mm || 0,
    duplex_supported: machine?.duplex_supported || false,
    setup_waste_sheets: machine?.setup_waste_sheets || 0,
    run_waste_pct: machine?.run_waste_pct || 0,
    setup_time_min: machine?.setup_time_min || 0,
    sheets_per_hour: machine?.sheets_per_hour || 0,
    m2_per_hour: machine?.m2_per_hour || 0,
    machine_rate_per_hour: machine?.machine_rate_per_hour || 0,
});

export function MachineForm({ open, onOpenChange, machine, tenantId, onSuccess }: MachineFormProps) {
    const [formData, setFormData] = useState(getDefaultFormData(machine));

    // Reset form data when machine prop changes (for editing vs creating)
    useEffect(() => {
        setFormData(getDefaultFormData(machine));
    }, [machine, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = { ...formData, tenant_id: tenantId };
            let error;
            if (machine?.id) {
                ({ error } = await supabase.from('machines' as any).update(data).eq('id', machine.id));
            } else {
                ({ error } = await supabase.from('machines' as any).insert(data));
            }

            if (error) throw error;
            toast.success(machine?.id ? "Maskine opdateret" : "Maskine oprettet");
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error("Kunne ikke gemme: " + err.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{machine?.id ? "Rediger Maskine" : "Tilføj Ny Maskine"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="name">Maskin-navn</Label>
                            <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="f.ex. HP Indigo 7900" required />
                        </div>

                        <div className="space-y-2">
                            <Label>Handling</Label>
                            <Select value={formData.mode} onValueChange={v => setFormData({ ...formData, mode: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SHEET">Ark (Sheet-fed)</SelectItem>
                                    <SelectItem value="ROLL">Rulle (Web/Roll-fed)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="rate">Timepris (kr/t)</Label>
                            <Input id="rate" type="number" value={formData.machine_rate_per_hour} onChange={e => setFormData({ ...formData, machine_rate_per_hour: parseFloat(e.target.value) })} required />
                        </div>

                        {formData.mode === 'SHEET' ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="sw">Ark-bredde (mm)</Label>
                                    <Input id="sw" type="number" value={formData.sheet_width_mm} onChange={e => setFormData({ ...formData, sheet_width_mm: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sh">Ark-højde (mm)</Label>
                                    <Input id="sh" type="number" value={formData.sheet_height_mm} onChange={e => setFormData({ ...formData, sheet_height_mm: parseInt(e.target.value) })} />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="rw">Rulle-bredde (mm)</Label>
                                <Input id="rw" type="number" value={formData.roll_width_mm} onChange={e => setFormData({ ...formData, roll_width_mm: parseInt(e.target.value) })} />
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="font-semibold mb-3">Margener & Gribekant (mm)</h3>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="ml">Venstre</Label>
                                <Input id="ml" type="number" value={formData.margin_left_mm} onChange={e => setFormData({ ...formData, margin_left_mm: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mr">Højre</Label>
                                <Input id="mr" type="number" value={formData.margin_right_mm} onChange={e => setFormData({ ...formData, margin_right_mm: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mt">Top</Label>
                                <Input id="mt" type="number" value={formData.margin_top_mm} onChange={e => setFormData({ ...formData, margin_top_mm: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mb">Bund</Label>
                                <Input id="mb" type="number" value={formData.margin_bottom_mm} onChange={e => setFormData({ ...formData, margin_bottom_mm: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="font-semibold mb-3">Kapacitet & Spild</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="sph">Ark i timen</Label>
                                <Input id="sph" type="number" value={formData.sheets_per_hour} onChange={e => setFormData({ ...formData, sheets_per_hour: parseFloat(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="m2h">m² i timen</Label>
                                <Input id="m2h" type="number" value={formData.m2_per_hour} onChange={e => setFormData({ ...formData, m2_per_hour: parseFloat(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="swaste">Opstarts-spild (ark)</Label>
                                <Input id="swaste" type="number" value={formData.setup_waste_sheets} onChange={e => setFormData({ ...formData, setup_waste_sheets: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rwaste">Kørsels-spild (%)</Label>
                                <Input id="rwaste" type="number" value={formData.run_waste_pct} onChange={e => setFormData({ ...formData, run_waste_pct: parseFloat(e.target.value) })} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 border-t pt-4">
                        <Switch id="duplex" checked={formData.duplex_supported} onCheckedChange={v => setFormData({ ...formData, duplex_supported: v })} />
                        <Label htmlFor="duplex">Understøtter Duplex (4+4)</Label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuller</Button>
                        <Button type="submit">Gem Maskine</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
