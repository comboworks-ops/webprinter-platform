import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductCloneDialogProps {
    isOpen: boolean;
    onClose: () => void;
    product: { id: string; name: string } | null;
}

interface Tenant {
    id: string;
    name: string;
}

export function ProductCloneDialog({ isOpen, onClose, product }: ProductCloneDialogProps) {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [cloning, setCloning] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTenants();
            setSelectedTenantId("");
        }
    }, [isOpen]);

    const fetchTenants = async () => {
        setLoading(true);
        try {
            // Fetch tenants excluding Master (00...00)
            const { data, error } = await supabase
                .from("tenants" as any)
                .select("id, name")
                .neq("id", "00000000-0000-0000-0000-000000000000")
                .order("name");

            if (error) throw error;
            setTenants(data || []);
        } catch (error) {
            console.error("Error fetching tenants:", error);
            toast.error("Kunne ikke hente lejere");
        } finally {
            setLoading(false);
        }
    };

    const handleClone = async () => {
        if (!product || !selectedTenantId) return;

        setCloning(true);
        try {
            // Call the RPC function we created in migration
            const { data, error } = await supabase.rpc("clone_product", {
                source_product_id: product.id,
                target_tenant_id: selectedTenantId,
            });

            if (error) throw error;

            toast.success(`Produkt "${product.name}" kopieret til lejer`);
            onClose();
        } catch (error: any) {
            console.error("Error cloning product:", error);
            toast.error(`Fejl ved kopiering: ${error.message}`);
        } finally {
            setCloning(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Kopier til Lejer</DialogTitle>
                    <DialogDescription>
                        Opret en uafhængig kopi af "{product?.name}" hos en specifik lejer.
                        Lejeren vil kunne ændre priser og indstillinger uden at påvirke originalen.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tenant" className="text-right">
                            Lejer
                        </Label>
                        <div className="col-span-3">
                            {loading ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm h-10">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Henter lejere...
                                </div>
                            ) : (
                                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Vælg lejer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tenants.map((tenant) => (
                                            <SelectItem key={tenant.id} value={tenant.id}>
                                                {tenant.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={cloning}>
                        Annuller
                    </Button>
                    <Button onClick={handleClone} disabled={!selectedTenantId || cloning || loading}>
                        {cloning ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Kopierer...
                            </>
                        ) : (
                            <>
                                <Copy className="mr-2 h-4 w-4" />
                                Kopier
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
