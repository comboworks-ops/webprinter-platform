import { useEffect, useMemo, useState } from "react";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import { supabase } from "@/integrations/supabase/client";
import { usePodAllFulfillmentJobs, usePodApproveAndCharge, usePodCreateJobsForOrder, usePodFulfillmentJobs, usePodMasterForwardJob, usePodTenantBilling } from "@/lib/pod2/hooks";
import { POD_JOB_STATUS_COLORS, POD_JOB_STATUS_LABELS, type PodFulfillmentJob } from "@/lib/pod2/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Clock, CreditCard, Package, Send, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function Pod2Ordrer() {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [isMasterContext, setIsMasterContext] = useState(false);
    const [tenantLabels, setTenantLabels] = useState<Record<string, string>>({});
    const [createJobDialogOpen, setCreateJobDialogOpen] = useState(false);
    const [orderId, setOrderId] = useState("");
    const [approveDialog, setApproveDialog] = useState<PodFulfillmentJob | null>(null);
    const [forwardDialog, setForwardDialog] = useState<PodFulfillmentJob | null>(null);
    const [providerJobRef, setProviderJobRef] = useState("");
    const [masterNotes, setMasterNotes] = useState("");

    useEffect(() => {
        resolveAdminTenant().then(({ tenantId: resolvedTenantId, isMasterAdmin }) => {
            setTenantId(resolvedTenantId);
            setIsMasterContext(Boolean(isMasterAdmin && resolvedTenantId === MASTER_TENANT_ID));
        });
    }, []);

    const tenantJobsQuery = usePodFulfillmentJobs(tenantId || undefined);
    const allJobsQuery = usePodAllFulfillmentJobs();
    const billingQuery = usePodTenantBilling(!isMasterContext ? tenantId || undefined : undefined);
    const approveAndCharge = usePodApproveAndCharge();
    const createJobs = usePodCreateJobsForOrder();
    const forwardJob = usePodMasterForwardJob();

    const jobs = useMemo(
        () => (isMasterContext ? allJobsQuery.data || [] : tenantJobsQuery.data || []),
        [isMasterContext, allJobsQuery.data, tenantJobsQuery.data],
    );

    useEffect(() => {
        const uniqueTenantIds = Array.from(new Set((jobs || []).map((job) => job.tenant_id).filter(Boolean)));
        if (!isMasterContext || uniqueTenantIds.length === 0) return;

        (async () => {
            const { data, error } = await (supabase
                .from("tenants" as any)
                .select("id, name, domain")
                .in("id", uniqueTenantIds));
            if (error || !data) return;

            const nextLabels: Record<string, string> = {};
            for (const row of data as Array<{ id: string; name?: string; domain?: string }>) {
                nextLabels[row.id] = row.domain || row.name || row.id.slice(0, 8);
            }
            setTenantLabels(nextLabels);
        })();
    }, [jobs, isMasterContext]);

    const isLoading = isMasterContext ? allJobsQuery.isLoading : tenantJobsQuery.isLoading;
    const billingReady = Boolean(billingQuery.data?.is_ready && billingQuery.data?.default_payment_method_id);

    const pendingApproval = jobs.filter((job) => job.status === "awaiting_approval");
    const awaitingMaster = jobs.filter((job) => job.status === "paid");
    const processingJobs = jobs.filter((job) => ["payment_pending", "submitted"].includes(job.status));
    const finishedJobs = jobs.filter((job) => ["failed", "completed"].includes(job.status));

    const handleCreateJobs = async () => {
        if (!orderId.trim()) {
            toast.error("Indtast ordre ID.");
            return;
        }

        try {
            await createJobs.mutateAsync(orderId.trim());
            setCreateJobDialogOpen(false);
            setOrderId("");
        } catch {
            // handled in hook
        }
    };

    const handleApprove = async () => {
        if (!approveDialog) return;
        try {
            await approveAndCharge.mutateAsync(approveDialog.id);
            setApproveDialog(null);
        } catch {
            // handled in hook
        }
    };

    const handleForward = async () => {
        if (!forwardDialog) return;
        try {
            await forwardJob.mutateAsync({
                jobId: forwardDialog.id,
                providerJobRef,
                masterNotes,
            });
            setForwardDialog(null);
            setProviderJobRef("");
            setMasterNotes("");
        } catch {
            // handled in hook
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">POD v2 Ordrer</h1>
                    <p className="text-muted-foreground">
                        {isMasterContext
                            ? "Master-forwarding af betalte POD v2 jobs til print-huset."
                            : "Godkend og betal POD v2 jobs i din tenant, før master videresender dem."}
                    </p>
                </div>

                {!isMasterContext && (
                    <Button onClick={() => setCreateJobDialogOpen(true)}>
                        <Package className="mr-2 h-4 w-4" />
                        Opret job fra ordre
                    </Button>
                )}
            </div>

            {!isMasterContext && !billingReady && (
                <Card className="border-yellow-500/40 bg-yellow-50/50">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-700" />
                            <div className="flex-1">
                                <p className="font-medium text-yellow-900">POD v2 betaling mangler</p>
                                <p className="text-sm text-yellow-800">
                                    Gem en betalingsmetode under <span className="font-medium">POD v2 Betaling</span>, før du kan godkende jobs.
                                </p>
                            </div>
                            <Button variant="outline" asChild>
                                <a href="/admin/pod2-betaling">Åbn betaling</a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {!isMasterContext && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-yellow-600" />
                                    Afventer tenant-godkendelse
                                    {pendingApproval.length > 0 && <Badge variant="secondary">{pendingApproval.length}</Badge>}
                                </CardTitle>
                                <CardDescription>Jobs der er oprettet fra ordrer og skal betales af tenant, før master kan overtage.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {pendingApproval.length === 0 ? (
                                    <p className="py-8 text-center text-muted-foreground">Ingen jobs afventer godkendelse.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Job</TableHead>
                                                <TableHead>Produkt</TableHead>
                                                <TableHead>Variant</TableHead>
                                                <TableHead>Modtager</TableHead>
                                                <TableHead>Pris</TableHead>
                                                <TableHead className="text-right">Handling</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingApproval.map((job) => (
                                                <TableRow key={job.id}>
                                                    <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{job.product_name || "-"}</div>
                                                        <div className="text-xs text-muted-foreground">{job.order_id.slice(0, 8)}</div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{job.variant_signature}</TableCell>
                                                    <TableCell className="text-sm">
                                                        <div>{job.recipient_name || "-"}</div>
                                                        {job.delivery_summary && <div className="text-xs text-muted-foreground">{job.delivery_summary}</div>}
                                                    </TableCell>
                                                    <TableCell className="font-medium">{Number(job.tenant_cost).toFixed(2)} {job.currency}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            disabled={!billingReady || approveAndCharge.isPending}
                                                            onClick={() => setApproveDialog(job)}
                                                        >
                                                            <CreditCard className="mr-2 h-3 w-3" />
                                                            Godkend & betal
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {isMasterContext ? <Send className="h-5 w-5 text-sky-600" /> : <Clock className="h-5 w-5 text-green-600" />}
                                {isMasterContext ? "Afventer master-videresendelse" : "Betalt - afventer master"}
                                {awaitingMaster.length > 0 && <Badge variant="secondary">{awaitingMaster.length}</Badge>}
                            </CardTitle>
                            <CardDescription>
                                {isMasterContext
                                    ? "Disse jobs er betalt af tenant og skal nu videresendes til print-huset."
                                    : "Jobs er betalt og venter nu på master-behandling."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {awaitingMaster.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">Ingen jobs i denne fase.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Job</TableHead>
                                            {isMasterContext && <TableHead>Tenant</TableHead>}
                                            <TableHead>Produkt</TableHead>
                                            <TableHead>Levering</TableHead>
                                            <TableHead>Afsender</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Handling</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {awaitingMaster.map((job) => (
                                            <TableRow key={job.id}>
                                                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                                                {isMasterContext && <TableCell className="text-sm">{tenantLabels[job.tenant_id] || job.tenant_id.slice(0, 8)}</TableCell>}
                                                <TableCell>
                                                    <div className="font-medium">{job.product_name || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">{job.variant_signature}</div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div>{job.recipient_name || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">{job.shipping_method || "-"}</div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {job.sender_mode === "custom" ? job.sender_name || "Custom" : job.sender_mode === "blind" ? "Blind shipping" : "Standard"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={POD_JOB_STATUS_COLORS[job.status]}>{POD_JOB_STATUS_LABELS[job.status]}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {isMasterContext ? (
                                                        <Button size="sm" onClick={() => setForwardDialog(job)}>
                                                            <Send className="mr-2 h-3 w-3" />
                                                            Videresend
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Afventer master</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {(processingJobs.length > 0 || finishedJobs.length > 0) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-slate-600" />
                                    Historik
                                </CardTitle>
                                <CardDescription>Jobs der allerede er videresendt, afsluttet eller fejlet.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Job</TableHead>
                                            {isMasterContext && <TableHead>Tenant</TableHead>}
                                            <TableHead>Produkt</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Provider ref</TableHead>
                                            <TableHead>Opdateret</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...processingJobs, ...finishedJobs].slice(0, 25).map((job) => (
                                            <TableRow key={job.id}>
                                                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                                                {isMasterContext && <TableCell className="text-sm">{tenantLabels[job.tenant_id] || job.tenant_id.slice(0, 8)}</TableCell>}
                                                <TableCell className="text-sm">{job.product_name || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge className={POD_JOB_STATUS_COLORS[job.status]}>{POD_JOB_STATUS_LABELS[job.status]}</Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{job.provider_job_ref || "-"}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{new Date(job.updated_at).toLocaleString("da-DK")}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <Dialog open={createJobDialogOpen} onOpenChange={setCreateJobDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Opret POD v2 job fra ordre</DialogTitle>
                        <DialogDescription>
                            Angiv ordre-ID for et produkt der er koblet til POD v2. Der oprettes ét fulfillment-job per ordre.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="orderId">Ordre ID</Label>
                        <Input id="orderId" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="UUID fra orders.id" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateJobDialogOpen(false)}>Annuller</Button>
                        <Button onClick={handleCreateJobs} disabled={createJobs.isPending}>
                            {createJobs.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Opret job
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(approveDialog)} onOpenChange={(open) => !open && setApproveDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Godkend og betal tenant-omkostning</DialogTitle>
                        <DialogDescription>
                            Jobbet bliver debiteret tenantens gemte kort og overgår derefter til master-forwarding.
                        </DialogDescription>
                    </DialogHeader>
                    {approveDialog && (
                        <div className="space-y-3 text-sm">
                            <div className="rounded-lg border p-3">
                                <div className="font-medium">{approveDialog.product_name || "-"}</div>
                                <div className="text-muted-foreground">{approveDialog.variant_signature}</div>
                                <div className="mt-2 font-medium">{Number(approveDialog.tenant_cost).toFixed(2)} {approveDialog.currency}</div>
                            </div>
                            {!billingReady && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                                    Gem en betalingsmetode under POD v2 Betaling først.
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApproveDialog(null)}>Annuller</Button>
                        <Button onClick={handleApprove} disabled={!billingReady || approveAndCharge.isPending}>
                            {approveAndCharge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Godkend & betal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(forwardDialog)} onOpenChange={(open) => {
                if (!open) {
                    setForwardDialog(null);
                    setProviderJobRef("");
                    setMasterNotes("");
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Videresend POD v2 job fra master</DialogTitle>
                        <DialogDescription>
                            Registrer eventuelt print-hus reference og notat. Jobbet markeres derefter som videresendt.
                        </DialogDescription>
                    </DialogHeader>
                    {forwardDialog && (
                        <div className="space-y-4">
                            <div className="rounded-lg border p-3 text-sm">
                                <div className="font-medium">{forwardDialog.product_name || "-"}</div>
                                <div className="text-muted-foreground">{forwardDialog.variant_signature}</div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                    Tenant: {tenantLabels[forwardDialog.tenant_id] || forwardDialog.tenant_id.slice(0, 8)}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="providerJobRef">Provider reference</Label>
                                <Input id="providerJobRef" value={providerJobRef} onChange={(event) => setProviderJobRef(event.target.value)} placeholder="Valgfri reference hos print-huset" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="masterNotes">Master notat</Label>
                                <Textarea id="masterNotes" value={masterNotes} onChange={(event) => setMasterNotes(event.target.value)} placeholder="Internt notat om videresendelsen" />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForwardDialog(null)}>Annuller</Button>
                        <Button onClick={handleForward} disabled={forwardJob.isPending}>
                            {forwardJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Marker som videresendt
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default Pod2Ordrer;
