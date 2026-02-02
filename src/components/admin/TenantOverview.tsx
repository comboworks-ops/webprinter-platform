import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ExternalLink, MessageCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Tenant {
    id: string;
    name: string;
    domain: string | null;
    created_at: string;
}

export function TenantOverview() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createDomain, setCreateDomain] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchTenants();
    }, []);

    async function fetchTenants() {
        try {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTenants((data as any) || []);
        } catch (error) {
            console.error('Error fetching tenants:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleCreateTenant = async () => {
        if (!createName.trim()) {
            toast.error("Indtast et shopnavn.");
            return;
        }

        setCreating(true);
        try {
            const payload: any = {
                name: createName.trim(),
                settings: { type: "tenant" },
            };

            if (createDomain.trim()) {
                payload.domain = createDomain.trim();
            }

            const { error } = await supabase
                .from("tenants" as any)
                .insert(payload);

            if (error) throw error;

            toast.success("Shop oprettet.");
            setCreateOpen(false);
            setCreateName("");
            setCreateDomain("");
            fetchTenants();
        } catch (error: any) {
            console.error("Error creating tenant:", error);
            toast.error(error?.message || "Kunne ikke oprette shop.");
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Lejere (Tenants)</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => fetchTenants()}>Opdater Liste</Button>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Opret shop
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Aktive Shops</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn</TableHead>
                                <TableHead>Domæne</TableHead>
                                <TableHead>Oprettet</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Handling</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tenants.map((tenant) => (
                                <TableRow key={tenant.id}>
                                    <TableCell className="font-medium">
                                        {tenant.name}
                                        {tenant.id === '00000000-0000-0000-0000-000000000000' && <Badge className="ml-2" variant="secondary">Master</Badge>}
                                    </TableCell>
                                    <TableCell>{tenant.domain || '-'}</TableCell>
                                    <TableCell>{format(new Date(tenant.created_at), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aktiv</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link to={`/admin/beskeder?tab=support&tenantId=${tenant.id}`}>
                                                <MessageCircle className="h-4 w-4 mr-2" />
                                                Besked
                                            </Link>
                                        </Button>
                                        {tenant.domain && (
                                            <Button variant="ghost" size="sm" asChild>
                                                <a href={`https://${tenant.domain}`} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    Besøg
                                                </a>
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {tenants.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Ingen lejere fundet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Opret ny shop</DialogTitle>
                        <DialogDescription>
                            Opret en ny tenant-shop. Du kan tilføje domæne senere.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="tenant-name">Shopnavn</Label>
                            <Input
                                id="tenant-name"
                                value={createName}
                                onChange={(event) => setCreateName(event.target.value)}
                                placeholder="F.eks. Mit Trykkeri"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tenant-domain">Domæne (valgfri)</Label>
                            <Input
                                id="tenant-domain"
                                value={createDomain}
                                onChange={(event) => setCreateDomain(event.target.value)}
                                placeholder="mitdomæne.dk"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                                Annuller
                            </Button>
                            <Button onClick={handleCreateTenant} disabled={creating}>
                                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Opret shop
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
