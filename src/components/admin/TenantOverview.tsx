import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Tenant {
    id: string;
    name: string;
    domain: string | null;
    created_at: string;
}

export function TenantOverview() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Lejere (Tenants)</h2>
                <Button onClick={() => fetchTenants()}>Opdater Liste</Button>
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
        </div>
    );
}
