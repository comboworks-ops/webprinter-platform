// POD Orders - Tenant view of POD fulfillment jobs

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, AlertCircle, Clock, Package, CreditCard } from "lucide-react";
import { usePodFulfillmentJobs, usePodApproveAndCharge, usePodTenantBilling, usePodCreateJobsForOrder } from "@/lib/pod/hooks";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { POD_JOB_STATUS_LABELS, POD_JOB_STATUS_COLORS, type PodFulfillmentJob } from "@/lib/pod/types";
import { toast } from "sonner";

export function PodOrdrer() {
    const [tenantId, setTenantId] = useState<string | null>(null);

    useEffect(() => {
        resolveAdminTenant().then(({ tenantId: tid }) => setTenantId(tid));
    }, []);

    const { data: jobs, isLoading, refetch } = usePodFulfillmentJobs(tenantId || undefined);
    const { data: billing } = usePodTenantBilling(tenantId || undefined);
    const approveAndCharge = usePodApproveAndCharge();
    const createJobs = usePodCreateJobsForOrder();

    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; job: PodFulfillmentJob | null }>({
        open: false,
        job: null,
    });
    const [createJobDialog, setCreateJobDialog] = useState(false);
    const [orderId, setOrderId] = useState("");

    const pendingJobs = jobs?.filter((j) => j.status === "awaiting_approval") || [];
    const processingJobs = jobs?.filter((j) => ["payment_pending", "paid", "submitted"].includes(j.status)) || [];
    const completedJobs = jobs?.filter((j) => ["completed", "failed"].includes(j.status)) || [];

    const handleApprove = async () => {
        if (!confirmDialog.job) return;

        try {
            await approveAndCharge.mutateAsync(confirmDialog.job.id);
            setConfirmDialog({ open: false, job: null });
            refetch();
        } catch (e) {
            // Error handled by hook
        }
    };

    const handleCreateJobs = async () => {
        if (!orderId.trim()) {
            toast.error("Indtast ordre ID");
            return;
        }

        try {
            await createJobs.mutateAsync(orderId.trim());
            setCreateJobDialog(false);
            setOrderId("");
            refetch();
        } catch (e) {
            // Error handled by hook
        }
    };

    const billingReady = billing?.is_ready && billing?.default_payment_method_id;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">POD Ordrer</h1>
                    <p className="text-muted-foreground">
                        Administrer Print on Demand jobs og godkendelser
                    </p>
                </div>
                <Button onClick={() => setCreateJobDialog(true)}>
                    <Package className="h-4 w-4 mr-2" />
                    Opret POD Job fra Ordre
                </Button>
            </div>

            {/* Billing Status Warning */}
            {!billingReady && (
                <Card className="border-yellow-500/50 bg-yellow-50/50">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                            <div className="flex-1">
                                <p className="font-medium text-yellow-800">Betalingsmetode ikke konfigureret</p>
                                <p className="text-sm text-yellow-700">
                                    Du skal konfigurere en betalingsmetode for at kunne godkende POD jobs.
                                </p>
                            </div>
                            <Button variant="outline" asChild>
                                <a href="/admin/pod-betaling">Konfigurer betaling</a>
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
                <div className="space-y-6">
                    {/* Pending Approval */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-yellow-600" />
                                Afventer godkendelse
                                {pendingJobs.length > 0 && (
                                    <Badge variant="secondary">{pendingJobs.length}</Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Jobs der afventer din godkendelse og betaling
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pendingJobs.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Job ID</TableHead>
                                            <TableHead>Ordre</TableHead>
                                            <TableHead>Variant</TableHead>
                                            <TableHead>Antal</TableHead>
                                            <TableHead>Din pris</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Handling</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingJobs.map((job) => (
                                            <TableRow key={job.id}>
                                                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                                                <TableCell className="font-mono text-xs">{job.order_id.slice(0, 8)}</TableCell>
                                                <TableCell className="text-sm">{job.variant_signature || "-"}</TableCell>
                                                <TableCell>{job.qty} stk</TableCell>
                                                <TableCell className="font-medium">
                                                    {job.tenant_cost.toFixed(2)} {job.currency}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={POD_JOB_STATUS_COLORS[job.status]}>
                                                        {POD_JOB_STATUS_LABELS[job.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        disabled={!billingReady || approveAndCharge.isPending}
                                                        onClick={() => setConfirmDialog({ open: true, job })}
                                                    >
                                                        <CreditCard className="h-3 w-3 mr-1" />
                                                        Godkend & Betal
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center py-8 text-muted-foreground">
                                    Ingen jobs afventer godkendelse
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Processing */}
                    {processingJobs.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                    Under behandling
                                    <Badge variant="secondary">{processingJobs.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Job ID</TableHead>
                                            <TableHead>Ordre</TableHead>
                                            <TableHead>Antal</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Opdateret</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {processingJobs.map((job) => (
                                            <TableRow key={job.id}>
                                                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                                                <TableCell className="font-mono text-xs">{job.order_id.slice(0, 8)}</TableCell>
                                                <TableCell>{job.qty} stk</TableCell>
                                                <TableCell>
                                                    <Badge className={POD_JOB_STATUS_COLORS[job.status]}>
                                                        {POD_JOB_STATUS_LABELS[job.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(job.updated_at).toLocaleString("da-DK")}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Completed */}
                    {completedJobs.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                    Afsluttet
                                    <Badge variant="secondary">{completedJobs.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Job ID</TableHead>
                                            <TableHead>Ordre</TableHead>
                                            <TableHead>Antal</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Afsluttet</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {completedJobs.slice(0, 10).map((job) => (
                                            <TableRow key={job.id}>
                                                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                                                <TableCell className="font-mono text-xs">{job.order_id.slice(0, 8)}</TableCell>
                                                <TableCell>{job.qty} stk</TableCell>
                                                <TableCell>
                                                    <Badge className={POD_JOB_STATUS_COLORS[job.status]}>
                                                        {POD_JOB_STATUS_LABELS[job.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(job.updated_at).toLocaleString("da-DK")}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty state */}
                    {jobs?.length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="font-medium text-lg">Ingen POD jobs endnu</h3>
                                <p className="text-muted-foreground mt-2">
                                    Når kunder bestiller POD produkter, vil jobs vises her.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Confirm Approval Dialog */}
            <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Godkend og betal POD job</DialogTitle>
                        <DialogDescription>
                            Din betalingsmetode debiteres med det angivne beløb.
                        </DialogDescription>
                    </DialogHeader>

                    {confirmDialog.job && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Job ID</p>
                                    <p className="font-mono">{confirmDialog.job.id.slice(0, 8)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Antal</p>
                                    <p>{confirmDialog.job.qty} stk</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Variant</p>
                                    <p>{confirmDialog.job.variant_signature || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Din pris</p>
                                    <p className="font-bold text-lg">
                                        {confirmDialog.job.tenant_cost.toFixed(2)} {confirmDialog.job.currency}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog({ open: false, job: null })}
                        >
                            Annuller
                        </Button>
                        <Button
                            onClick={handleApprove}
                            disabled={approveAndCharge.isPending}
                        >
                            {approveAndCharge.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <CreditCard className="h-4 w-4 mr-2" />
                            )}
                            Godkend & Betal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Job Dialog */}
            <Dialog open={createJobDialog} onOpenChange={setCreateJobDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Opret POD Jobs fra Ordre</DialogTitle>
                        <DialogDescription>
                            Indtast ordre ID for at oprette POD fulfillment jobs for POD-produkter i ordren.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <input
                            type="text"
                            value={orderId}
                            onChange={(e) => setOrderId(e.target.value)}
                            placeholder="Ordre ID (UUID)"
                            className="w-full px-3 py-2 border rounded-md"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateJobDialog(false)}>
                            Annuller
                        </Button>
                        <Button onClick={handleCreateJobs} disabled={createJobs.isPending}>
                            {createJobs.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Package className="h-4 w-4 mr-2" />
                            )}
                            Opret Jobs
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default PodOrdrer;
