import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, UploadCloud, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface SystemUpdate {
    id: string;
    version: string;
    description: string;
    created_at: string;
    changes: any;
}

export function AdminUpdates() {
    const [updates, setUpdates] = useState<SystemUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [pushing, setPushing] = useState(false);
    const [open, setOpen] = useState(false);

    // Form state
    const [version, setVersion] = useState("");
    const [description, setDescription] = useState("");

    useEffect(() => {
        fetchUpdates();
    }, []);

    async function fetchUpdates() {
        try {
            const { data, error } = await supabase
                .from('system_updates' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUpdates((data as any) || []);
        } catch (error) {
            console.error('Error fetching updates:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handlePushUpdate() {
        if (!version || !description) {
            toast.error("Udfyld venligst version og beskrivelse");
            return;
        }

        setPushing(true);
        try {
            // 1. Create the update record
            const { data, error } = await supabase
                .from('system_updates' as any)
                .insert({
                    version,
                    description,
                    changes: { type: 'full_sync', timestamp: new Date().toISOString() }
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Notify tenants? 
            // In a real system we'd create 'tenant_update_status' rows here.
            // But for now, the "Pull" logic on tenant side just looks for new updates.

            toast.success("Opdatering udgivet succesfuldt!");
            setOpen(false);
            setVersion("");
            setDescription("");
            fetchUpdates();
        } catch (error: any) {
            console.error('Error pushing update:', error);
            toast.error("Fejl ved udgivelse: " + error.message);
        } finally {
            setPushing(false);
        }
    }

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Opdateringer</h2>
                    <p className="text-muted-foreground">Administrer versioner og push opdateringer til lejere.</p>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Push Ny Opdatering
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Udgiv System Opdatering</DialogTitle>
                            <DialogDescription>
                                Dette vil gøre nye produkter og priser tilgængelige for alle lejere.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="version">Version (f.eks. 1.2.0)</Label>
                                <Input
                                    id="version"
                                    placeholder="1.2.0"
                                    value={version}
                                    onChange={(e) => setVersion(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc">Beskrivelse</Label>
                                <Textarea
                                    id="desc"
                                    placeholder="Hvad er nyt i denne opdatering?"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>Annuller</Button>
                            <Button onClick={handlePushUpdate} disabled={pushing}>
                                {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                Udgiv Nu
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Versionshistorik</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Version</TableHead>
                                <TableHead>Beskrivelse</TableHead>
                                <TableHead>Udgivet</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {updates.map((update) => (
                                <TableRow key={update.id}>
                                    <TableCell className="font-medium">
                                        <Badge variant="outline">{update.version}</Badge>
                                    </TableCell>
                                    <TableCell>{update.description}</TableCell>
                                    <TableCell>{format(new Date(update.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell>
                                        <Badge className="bg-green-50 text-green-700 hover:bg-green-100">Udgivet</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {updates.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        Ingen opdateringer fundet. Opret den første opdatering for at starte.
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
