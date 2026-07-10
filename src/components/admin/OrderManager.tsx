import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Package, Truck, CheckCircle, AlertCircle, Clock, Eye, FileText, Search, FileDown, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { downloadInvoice } from '@/lib/invoiceGenerator';
import { resolveAdminTenant } from '@/lib/adminTenant';
import { Link } from 'react-router-dom';

interface Order {
    id: string;
    order_number: string;
    user_id: string | null;
    customer_email: string;
    customer_name: string | null;
    customer_phone: string | null;
    product_name: string;
    product_configuration?: string | null;
    quantity: number;
    total_price: number;
    status: string;
    status_note: string | null;
    tracking_number: string | null;
    estimated_delivery: string | null;
    has_problem: boolean;
    problem_description: string | null;
    requires_file_reupload: boolean;
    created_at: string;
    delivery_address: string | null;
    delivery_city: string | null;
    delivery_zip: string | null;
    delivery_type: string | null;
    tenant_id?: string | null;
}

/**
 * Parse `[TAG] value` entries from the order's `status_note`.
 * Checkout writes recipient / delivery / billing / sender info as tagged
 * lines so admin views can reconstruct them. Returns value or null.
 */
const readOrderTag = (note: string | null | undefined, tag: string): string | null => {
    const src = String(note || "");
    const re = new RegExp(`\\[${tag}\\]\\s*([^\\n]+)`, "i");
    const m = src.match(re);
    return m?.[1]?.trim() || null;
};

interface OrderFile {
    id: string;
    order_id?: string | null;
    file_name: string;
    file_url: string;
    file_type: string | null;
    notes?: string | null;
    uploaded_at: string;
    is_current: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Afventer', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    processing: { label: 'Behandles', color: 'bg-blue-100 text-blue-800', icon: Package },
    production: { label: 'Under produktion', color: 'bg-purple-100 text-purple-800', icon: Package },
    shipped: { label: 'Afsendt', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
    delivered: { label: 'Leveret', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    cancelled: { label: 'Annulleret', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
    problem: { label: 'Problem', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

type ProductionFlowKind = 'designer' | 'upload' | 'template' | 'missing' | 'untracked' | 'other';
type ProductionFlowFilter = 'all' | ProductionFlowKind;
type ProductionReadinessKind = 'problem' | 'reupload' | 'in-production' | 'closed' | 'file-ready' | 'awaiting-file' | 'missing-file' | 'untracked';
type ProductionReadinessFilter = 'all' | ProductionReadinessKind;
type OrderFileSummary = {
    totalCount: number;
    currentCount: number;
    currentNotes: string[];
};

export function OrderManager() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orderFiles, setOrderFiles] = useState<OrderFile[]>([]);
    const [orderFileSummaryByOrderId, setOrderFileSummaryByOrderId] = useState<Record<string, OrderFileSummary>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [flowFilter, setFlowFilter] = useState<ProductionFlowFilter>('all');
    const [readinessFilter, setReadinessFilter] = useState<ProductionReadinessFilter>('all');
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [companyProfile, setCompanyProfile] = useState<{
        name: string;
        address: string;
        city: string;
        zip: string;
        country: string;
        cvr: string;
        phone: string;
        email: string;
        bankName?: string;
        bankAccount?: string;
    } | null>(null);

    // Edit form state
    const [editStatus, setEditStatus] = useState('');
    const [editStatusNote, setEditStatusNote] = useState('');
    const [editTrackingNumber, setEditTrackingNumber] = useState('');
    const [editEstimatedDelivery, setEditEstimatedDelivery] = useState('');
    const [editHasProblem, setEditHasProblem] = useState(false);
    const [editProblemDescription, setEditProblemDescription] = useState('');
    const [editRequiresReupload, setEditRequiresReupload] = useState(false);
    const [editDeliveryType, setEditDeliveryType] = useState('');

    useEffect(() => {
        fetchOrders();
        fetchCompanyProfile();
    }, []);

    const fetchCompanyProfile = async () => {
        try {
            const { tenantId } = await resolveAdminTenant();
            if (!tenantId) return;

            const { data, error } = await supabase
                .from('tenants' as any)
                .select('name, settings')
                .eq('id', tenantId)
                .maybeSingle();

            if (error) throw error;

            const settings = (data as any)?.settings || {};
            const company = settings.company || {};

            setCompanyProfile({
                name: company.name || (data as any)?.name || 'WebPrinter',
                address: company.address || '',
                city: company.city || '',
                zip: company.zip || '',
                country: company.country || 'Danmark',
                cvr: company.cvr || '',
                phone: company.phone || '',
                email: company.email || '',
                bankName: company.bank_name || company.bankName || undefined,
                bankAccount: company.bank_account || company.bankAccount || undefined,
            });
        } catch (error) {
            console.error('Error fetching company profile:', error);
        }
    };

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            const fetchedOrders = data || [];
            setOrders(fetchedOrders);
            await fetchOrderFileSummary(fetchedOrders.map((order: any) => order.id).filter(Boolean));
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrderFileSummaryByOrderId({});
            toast.error('Kunne ikke hente ordrer');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderFileSummary = async (orderIds: string[]) => {
        if (orderIds.length === 0) {
            setOrderFileSummaryByOrderId({});
            return;
        }

        try {
            const { data, error } = await supabase
                .from('order_files' as any)
                .select('order_id, is_current, notes')
                .in('order_id', orderIds);

            if (error) throw error;

            const summary = (data || []).reduce<Record<string, OrderFileSummary>>((acc, file: any) => {
                const orderId = String(file.order_id || '');
                if (!orderId) return acc;

                if (!acc[orderId]) {
                    acc[orderId] = { totalCount: 0, currentCount: 0, currentNotes: [] };
                }

                acc[orderId].totalCount += 1;
                if (file.is_current) {
                    acc[orderId].currentCount += 1;
                    if (file.notes) {
                        acc[orderId].currentNotes.push(String(file.notes));
                    }
                }

                return acc;
            }, {});

            setOrderFileSummaryByOrderId(summary);
        } catch (error) {
            console.error('Error fetching order file summary:', error);
            setOrderFileSummaryByOrderId({});
        }
    };

    const fetchOrderFiles = async (orderId: string) => {
        try {
            const { data, error } = await supabase
                .from('order_files' as any)
                .select('*')
                .eq('order_id', orderId)
                .order('uploaded_at', { ascending: false });

            if (error) throw error;
            setOrderFiles(data || []);
        } catch (error) {
            console.error('Error fetching order files:', error);
        }
    };

    const openOrderDetails = (order: Order) => {
        setSelectedOrder(order);
        setEditStatus(order.status);
        setEditStatusNote(order.status_note || '');
        setEditTrackingNumber(order.tracking_number || '');
        setEditEstimatedDelivery(order.estimated_delivery || '');
        setEditHasProblem(order.has_problem);
        setEditProblemDescription(order.problem_description || '');
        setEditRequiresReupload(order.requires_file_reupload);
        // Prefer the explicit delivery_type column; fall back to the
        // [LEVERINGSMETODE] tag in status_note for older orders.
        setEditDeliveryType(
            order.delivery_type || readOrderTag(order.status_note, "LEVERINGSMETODE") || ""
        );
        fetchOrderFiles(order.id);
        setDialogOpen(true);
    };

    const handleSaveOrder = async () => {
        if (!selectedOrder) return;

        setSaving(true);
        try {
            // Keep the [LEVERINGSMETODE] tag in status_note in sync with any
            // edited delivery_type so downstream readers (POD jobs, emails,
            // etc. that scan status_note) stay consistent.
            const syncedStatusNote = (() => {
                const base = editStatusNote || '';
                if (!editDeliveryType) {
                    return base.replace(/\[LEVERINGSMETODE\][^\n]*\n?/gi, '').trim() || null;
                }
                const tagLine = `[LEVERINGSMETODE] ${editDeliveryType}`;
                if (/\[LEVERINGSMETODE\]/i.test(base)) {
                    return base.replace(/\[LEVERINGSMETODE\][^\n]*/i, tagLine);
                }
                return base ? `${base}\n${tagLine}` : tagLine;
            })();

            const updates: any = {
                status: editStatus,
                status_note: syncedStatusNote || null,
                tracking_number: editTrackingNumber || null,
                estimated_delivery: editEstimatedDelivery || null,
                has_problem: editHasProblem,
                problem_description: editHasProblem ? editProblemDescription : null,
                requires_file_reupload: editRequiresReupload,
                delivery_type: editDeliveryType || null,
            };

            // Set shipped_at if status changed to shipped
            if (editStatus === 'shipped' && selectedOrder.status !== 'shipped') {
                updates.shipped_at = new Date().toISOString();
            }

            // Set delivered_at if status changed to delivered
            if (editStatus === 'delivered' && selectedOrder.status !== 'delivered') {
                updates.delivered_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('orders' as any)
                .update(updates)
                .eq('id', selectedOrder.id);

            if (error) throw error;

            // Log status change and send email notification
            if (editStatus !== selectedOrder.status) {
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('order_status_history' as any).insert({
                    order_id: selectedOrder.id,
                    old_status: selectedOrder.status,
                    new_status: editStatus,
                    changed_by: user?.id,
                    note: editStatusNote,
                });

                // Send email notification (non-blocking)
                import('@/lib/emailService').then(({ sendStatusChangeEmail, sendProblemNotification }) => {
                    const shopEmailContext = {
                        name: companyProfile.name || 'Webprinter',
                        supportEmail: companyProfile.email || 'info@webprinter.dk',
                        orderUrl: `${window.location.origin}/mine-ordrer`,
                        adminOrderUrl: `${window.location.origin}/admin/ordrer`,
                        homepageUrl: window.location.origin,
                    };

                    if (editHasProblem && !selectedOrder.has_problem) {
                        // New problem - send problem notification
                        sendProblemNotification({
                            order_number: selectedOrder.order_number,
                            product_name: selectedOrder.product_name,
                            quantity: selectedOrder.quantity,
                            total_price: selectedOrder.total_price,
                            problem_description: editProblemDescription,
                            customer_email: selectedOrder.customer_email,
                            customer_name: selectedOrder.customer_name || 'Kunde',
                            shop: shopEmailContext,
                        });
                    } else {
                        // Regular status change
                        sendStatusChangeEmail({
                            order_number: selectedOrder.order_number,
                            product_name: selectedOrder.product_name,
                            quantity: selectedOrder.quantity,
                            total_price: selectedOrder.total_price,
                            status: editStatus,
                            tracking_number: editTrackingNumber || undefined,
                            estimated_delivery: editEstimatedDelivery || undefined,
                            customer_email: selectedOrder.customer_email,
                            customer_name: selectedOrder.customer_name || 'Kunde',
                            shop: shopEmailContext,
                        });
                    }
                }).catch(console.error);
            }

            toast.success('Ordre opdateret');
            setDialogOpen(false);
            fetchOrders();
        } catch (error) {
            console.error('Error saving order:', error);
            toast.error('Kunne ikke opdatere ordre');
        } finally {
            setSaving(false);
        }
    };

    const getOrderProductionFlow = (order: Order) => {
        return readOrderTag(order.status_note, 'PRODUKTIONSFLOW');
    };

    const getOrderProductionFlowKind = (order: Order): ProductionFlowKind => {
        const productionFlow = getOrderProductionFlow(order);
        const normalized = String(productionFlow || '').toLowerCase();

        if (!productionFlow) {
            return 'untracked';
        }
        if (normalized.includes('designer')) {
            return 'designer';
        }
        if (normalized.includes('upload')) {
            return 'upload';
        }
        if (normalized.includes('skabelon') || normalized.includes('template')) {
            return 'template';
        }
        if (normalized.includes('ingen')) {
            return 'missing';
        }

        return 'other';
    };

    const getOrderProductionFlowMeta = (order: Order) => {
        const productionFlow = getOrderProductionFlow(order);
        const kind = getOrderProductionFlowKind(order);

        if (kind === 'designer') {
            return { label: 'Designer', color: 'bg-indigo-100 text-indigo-800' };
        }
        if (kind === 'upload') {
            return { label: 'Upload', color: 'bg-emerald-100 text-emerald-800' };
        }
        if (kind === 'template') {
            return { label: 'Skabelon', color: 'bg-amber-100 text-amber-800' };
        }
        if (kind === 'missing') {
            return { label: 'Ingen fil', color: 'bg-red-100 text-red-800' };
        }
        if (kind === 'untracked') {
            return { label: 'Ikke sporet', color: 'bg-slate-100 text-slate-600' };
        }

        return {
            label: productionFlow || 'Andet',
            color: 'bg-slate-100 text-slate-800',
        };
    };

    const getOrderFileSummary = (orderId: string): OrderFileSummary => {
        return orderFileSummaryByOrderId[orderId] || { totalCount: 0, currentCount: 0, currentNotes: [] };
    };

    const getOrderProductionReadinessKind = (order: Order): ProductionReadinessKind => {
        const fileSummary = getOrderFileSummary(order.id);
        const flowKind = getOrderProductionFlowKind(order);

        if (order.has_problem || order.status === 'problem') {
            return 'problem';
        }
        if (order.requires_file_reupload) {
            return 'reupload';
        }
        if (order.status === 'shipped' || order.status === 'delivered' || order.status === 'cancelled') {
            return 'closed';
        }
        if (order.status === 'production') {
            return 'in-production';
        }
        if (fileSummary.currentCount > 0) {
            return 'file-ready';
        }
        if (flowKind === 'template') {
            return 'awaiting-file';
        }
        if (flowKind === 'missing') {
            return 'missing-file';
        }

        return 'untracked';
    };

    const getOrderProductionReadinessMeta = (order: Order) => {
        const kind = getOrderProductionReadinessKind(order);

        if (kind === 'problem') {
            return { label: 'Problem', color: 'bg-red-100 text-red-800' };
        }
        if (kind === 'reupload') {
            return { label: 'Ny fil kræves', color: 'bg-orange-100 text-orange-800' };
        }
        if (kind === 'in-production') {
            return { label: 'I produktion', color: 'bg-purple-100 text-purple-800' };
        }
        if (kind === 'closed') {
            return { label: 'Afsluttet', color: 'bg-slate-100 text-slate-700' };
        }
        if (kind === 'file-ready') {
            return { label: 'Fil klar', color: 'bg-green-100 text-green-800' };
        }
        if (kind === 'awaiting-file') {
            return { label: 'Afventer kundens fil', color: 'bg-amber-100 text-amber-800' };
        }
        if (kind === 'missing-file') {
            return { label: 'Mangler fil', color: 'bg-red-100 text-red-800' };
        }

        return { label: 'Mangler kontrol', color: 'bg-slate-100 text-slate-600' };
    };

    const getOrderProductionNextAction = (order: Order) => {
        const kind = getOrderProductionReadinessKind(order);

        if (kind === 'problem') {
            return 'Læs problembeskrivelsen, afklar fil eller ordredata, og behold ordren uden for produktion indtil problemet er lukket.';
        }
        if (kind === 'reupload') {
            return 'Afvent kundens nye fil. Når en ny aktuel fil er modtaget, fjernes genupload-kravet og filen kontrolleres.';
        }
        if (kind === 'in-production') {
            return 'Følg produktion, leveringsdato og tracking. Filgrundlaget er ikke næste flaskehals.';
        }
        if (kind === 'closed') {
            return 'Ordren er afsluttet eller annulleret. Brug den kun som historik eller salgsbevis.';
        }
        if (kind === 'file-ready') {
            return 'Kontroller den aktuelle produktionsfil og flyt ordren videre til behandling eller produktion, hvis alt er godkendt.';
        }
        if (kind === 'awaiting-file') {
            return 'Kunden har valgt skabelon/eget design. Afvent filupload eller kontakt kunden, før ordren sendes videre.';
        }
        if (kind === 'missing-file') {
            return 'Der er ingen produktionsfil på ordren. Kontakt kunden eller bed om upload, før ordren behandles.';
        }

        return 'Kontroller ordre, prisvalg og filgrundlag manuelt, før den flyttes videre i produktion.';
    };

    const getProductionStatusWarning = (order: Order): string | null => {
        const kind = getOrderProductionReadinessKind(order);

        if (kind === 'file-ready' || kind === 'in-production') {
            return null;
        }
        if (kind === 'problem') {
            return 'Ordren er markeret som problem. Løs problemet før den sættes under produktion.';
        }
        if (kind === 'reupload') {
            return 'Kunden skal uploade en ny fil. Sæt først ordren under produktion når en ny aktuel fil er modtaget og kontrolleret.';
        }
        if (kind === 'awaiting-file') {
            return 'Kunden har valgt skabelon/eget design, men der er endnu ingen aktuel produktionsfil på ordren.';
        }
        if (kind === 'missing-file') {
            return 'Der mangler en produktionsfil. Kontroller eller indhent fil før produktion.';
        }
        if (kind === 'closed') {
            return 'Ordren er afsluttet eller annulleret. Kontroller hvorfor den skal genåbnes før produktion.';
        }

        return 'Ordren mangler manuel kontrol af filgrundlag, før den sættes under produktion.';
    };

    const filteredOrders = orders.filter(order => {
        const productionFlow = getOrderProductionFlow(order);
        const productionFlowMeta = getOrderProductionFlowMeta(order);
        const productionFlowKind = getOrderProductionFlowKind(order);
        const readinessMeta = getOrderProductionReadinessMeta(order);
        const readinessKind = getOrderProductionReadinessKind(order);
        const matchesSearch =
            order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            order.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            productionFlowMeta.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            readinessMeta.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (productionFlow?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        const matchesFlow = flowFilter === 'all' || productionFlowKind === flowFilter;
        const matchesReadiness = readinessFilter === 'all' || readinessKind === readinessFilter;

        return matchesSearch && matchesStatus && matchesFlow && matchesReadiness;
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('da-DK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('da-DK', {
            style: 'currency',
            currency: 'DKK',
        }).format(price);
    };

    const getOrderConfigurationText = (order: Order) => {
        const fromColumn = String(order.product_configuration || "").trim();
        if (fromColumn) return fromColumn;
        const statusNote = String(order.status_note || "").trim();
        const prefix = "[SIZE-DISTRIBUTION]";
        if (statusNote.startsWith(prefix)) {
            return statusNote.slice(prefix.length).trim();
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <a href="/admin" className="hover:text-foreground transition-colors">
                    ← Tilbage til Admin
                </a>
                <span>/</span>
                <span className="text-foreground font-medium">Kunder & Ordrer</span>
            </nav>

            <div>
                <h1 className="text-3xl font-bold">Kunder & Ordrer</h1>
                <p className="text-muted-foreground">Administrer kundeordrer og leveringsstatus</p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{orders.length}</div>
                        <p className="text-xs text-muted-foreground">Totalt ordrer</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-yellow-600">
                            {orders.filter(o => o.status === 'pending').length}
                        </div>
                        <p className="text-xs text-muted-foreground">Afventer</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-purple-600">
                            {orders.filter(o => o.status === 'production').length}
                        </div>
                        <p className="text-xs text-muted-foreground">I produktion</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">
                            {orders.filter(o => getOrderProductionReadinessKind(o) === 'file-ready').length}
                        </div>
                        <p className="text-xs text-muted-foreground">Fil klar</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-red-600">
                            {orders.filter(o => o.has_problem).length}
                        </div>
                        <p className="text-xs text-muted-foreground">Med problemer</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Søg i ordrer..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle status</SelectItem>
                                <SelectItem value="pending">Afventer</SelectItem>
                                <SelectItem value="processing">Behandles</SelectItem>
                                <SelectItem value="production">Under produktion</SelectItem>
                                <SelectItem value="shipped">Afsendt</SelectItem>
                                <SelectItem value="delivered">Leveret</SelectItem>
                                <SelectItem value="problem">Problem</SelectItem>
                                <SelectItem value="cancelled">Annulleret</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={flowFilter} onValueChange={(value) => setFlowFilter(value as ProductionFlowFilter)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter flow" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle flow</SelectItem>
                                <SelectItem value="designer">Designer</SelectItem>
                                <SelectItem value="upload">Upload</SelectItem>
                                <SelectItem value="template">Skabelon</SelectItem>
                                <SelectItem value="missing">Ingen fil</SelectItem>
                                <SelectItem value="untracked">Ikke sporet</SelectItem>
                                <SelectItem value="other">Andet</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={readinessFilter} onValueChange={(value) => setReadinessFilter(value as ProductionReadinessFilter)}>
                            <SelectTrigger className="w-[210px]">
                                <SelectValue placeholder="Filter klarhed" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle klarheder</SelectItem>
                                <SelectItem value="file-ready">Fil klar</SelectItem>
                                <SelectItem value="awaiting-file">Afventer kundens fil</SelectItem>
                                <SelectItem value="missing-file">Mangler fil</SelectItem>
                                <SelectItem value="reupload">Ny fil kræves</SelectItem>
                                <SelectItem value="problem">Problem</SelectItem>
                                <SelectItem value="in-production">I produktion</SelectItem>
                                <SelectItem value="closed">Afsluttet</SelectItem>
                                <SelectItem value="untracked">Mangler kontrol</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Orders table */}
            <Card>
                <CardHeader>
                    <CardTitle>Ordrer ({filteredOrders.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ordre #</TableHead>
                                <TableHead>Kunde</TableHead>
                                <TableHead>Produkt</TableHead>
                                <TableHead>Flow</TableHead>
                                <TableHead>Klarhed</TableHead>
                                <TableHead>Beløb</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Dato</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.map((order) => {
                                const status = statusConfig[order.status] || statusConfig.pending;
                                const productionFlow = getOrderProductionFlowMeta(order);
                                const productionReadiness = getOrderProductionReadinessMeta(order);
                                return (
                                    <TableRow key={order.id} className={order.has_problem ? 'bg-red-50' : ''}>
                                        <TableCell className="font-medium">
                                            {order.order_number}
                                            {order.has_problem && (
                                                <AlertCircle className="inline ml-1 h-4 w-4 text-red-500" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div>{order.customer_name || 'Ukendt'}</div>
                                            <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div>{order.product_name}</div>
                                            <div className="text-xs text-muted-foreground">x{order.quantity}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`${productionFlow.color} whitespace-nowrap`}>
                                                {productionFlow.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`${productionReadiness.color} whitespace-nowrap`}>
                                                {productionReadiness.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{formatPrice(order.total_price)}</TableCell>
                                        <TableCell>
                                            <Badge className={status.color}>{status.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDate(order.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => openOrderDetails(order)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredOrders.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                        Ingen ordrer fundet
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Order details dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selectedOrder && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    Ordre #{selectedOrder.order_number}
                                    {selectedOrder.has_problem && (
                                        <Badge variant="destructive">Problem</Badge>
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    Bestilt {formatDate(selectedOrder.created_at)}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-6">
                                {/* Customer info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-muted-foreground">Kunde</Label>
                                        <p className="font-medium">{selectedOrder.customer_name || 'Ukendt'}</p>
                                        <p className="text-sm">{selectedOrder.customer_email}</p>
                                        {selectedOrder.customer_phone && (
                                            <p className="text-sm">{selectedOrder.customer_phone}</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Leveringsadresse</Label>
                                        {(() => {
                                            const note = selectedOrder.status_note;
                                            const recipient = readOrderTag(note, 'MODTAGER');
                                            const recipientCompany = readOrderTag(note, 'MODTAGER-FIRMA');
                                            const delivery = readOrderTag(note, 'LEVERING');
                                            const billing = readOrderTag(note, 'FAKTURERING');
                                            const senderTag = readOrderTag(note, 'AFSENDER');
                                            const blindTag = readOrderTag(note, 'BLIND_SHIPPING');
                                            const method = selectedOrder.delivery_type
                                                || readOrderTag(note, 'LEVERINGSMETODE');

                                            // Build a short address from columns if tags missing.
                                            const columnAddress = [
                                                selectedOrder.delivery_address,
                                                [selectedOrder.delivery_zip, selectedOrder.delivery_city].filter(Boolean).join(' '),
                                            ].filter(Boolean).join(', ');
                                            const address = delivery || columnAddress;

                                            if (!address && !recipient && !method) {
                                                return <p className="text-sm text-muted-foreground">Ikke angivet</p>;
                                            }

                                            return (
                                                <div className="text-sm space-y-1">
                                                    {(recipient || recipientCompany) && (
                                                        <p className="font-medium">
                                                            {recipient}
                                                            {recipient && recipientCompany ? ' · ' : ''}
                                                            {recipientCompany}
                                                        </p>
                                                    )}
                                                    {address && <p>{address}</p>}
                                                    {method && (
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="font-medium">Metode:</span> {method}
                                                        </p>
                                                    )}
                                                    {(blindTag?.toLowerCase() === 'ja' || (senderTag && senderTag !== 'Standard WebPrinter-afsender')) && (
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="font-medium">Afsender:</span>{' '}
                                                            {blindTag?.toLowerCase() === 'ja' ? 'Blind forsendelse' : senderTag}
                                                        </p>
                                                    )}
                                                    {billing && billing !== (delivery || '') && (
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="font-medium">Faktura:</span> {billing}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Order info */}
                                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                                    <div>
                                        <Label className="text-muted-foreground">Produkt</Label>
                                        <p className="font-medium">{selectedOrder.product_name}</p>
                                        <p className="text-sm">Antal: {selectedOrder.quantity}</p>
                                        {getOrderConfigurationText(selectedOrder) && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {getOrderConfigurationText(selectedOrder)}
                                            </p>
                                        )}
                                        {(() => {
                                            const note = selectedOrder.status_note;
                                            const productionFlow = readOrderTag(note, 'PRODUKTIONSFLOW');
                                            const template = readOrderTag(note, 'SKABELON');
                                            const templateDownload = readOrderTag(note, 'SKABELON-DOWNLOAD');

                                            if (!productionFlow && !template && !templateDownload) return null;

                                            return (
                                                <div className="mt-3 space-y-1 rounded-md border border-slate-200 bg-white/70 p-3 text-xs text-slate-700">
                                                    {productionFlow && (
                                                        <p>
                                                            <span className="font-semibold">Produktionsflow:</span> {productionFlow}
                                                        </p>
                                                    )}
                                                    {template && (
                                                        <p>
                                                            <span className="font-semibold">Skabelon:</span> {template}
                                                        </p>
                                                    )}
                                                    {templateDownload && (
                                                        <p>
                                                            <span className="font-semibold">Skabelon hentet:</span> {templateDownload}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Beløb</Label>
                                        <p className="text-xl font-bold">{formatPrice(selectedOrder.total_price)}</p>
                                    </div>
                                </div>

                                {(() => {
                                    const flow = getOrderProductionFlowMeta(selectedOrder);
                                    const readiness = getOrderProductionReadinessMeta(selectedOrder);
                                    const fileSummary = getOrderFileSummary(selectedOrder.id);
                                    const currentDetailFiles = orderFiles.filter((file) => file.is_current).length;
                                    const currentFileCount = Math.max(fileSummary.currentCount, currentDetailFiles);

                                    return (
                                        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Label className="text-muted-foreground mr-1">Produktionsklarhed</Label>
                                                <Badge className={`${flow.color} whitespace-nowrap`}>
                                                    {flow.label}
                                                </Badge>
                                                <Badge className={`${readiness.color} whitespace-nowrap`}>
                                                    {readiness.label}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Aktuelle filer</p>
                                                    <p className="font-medium">{currentFileCount}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Alle filer</p>
                                                    <p className="font-medium">{Math.max(fileSummary.totalCount, orderFiles.length)}</p>
                                                </div>
                                            </div>
                                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                                                <span className="font-medium">Næste handling:</span>{' '}
                                                {getOrderProductionNextAction(selectedOrder)}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Status editing */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Status</Label>
                                            <Select value={editStatus} onValueChange={setEditStatus}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Afventer</SelectItem>
                                                    <SelectItem value="processing">Behandles</SelectItem>
                                                    <SelectItem value="production">Under produktion</SelectItem>
                                                    <SelectItem value="shipped">Afsendt</SelectItem>
                                                    <SelectItem value="delivered">Leveret</SelectItem>
                                                    <SelectItem value="problem">Problem</SelectItem>
                                                    <SelectItem value="cancelled">Annulleret</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Tracking nummer</Label>
                                            <Input
                                                value={editTrackingNumber}
                                                onChange={(e) => setEditTrackingNumber(e.target.value)}
                                                placeholder="Indtast tracking nummer"
                                            />
                                        </div>
                                    </div>

                                    {editStatus === 'production' && (() => {
                                        const warning = getProductionStatusWarning(selectedOrder);
                                        if (!warning) return null;

                                        return (
                                            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                <div>
                                                    <p className="font-medium">Kontroller produktionsklarhed</p>
                                                    <p>{warning}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Forventet levering</Label>
                                            <Input
                                                type="date"
                                                value={editEstimatedDelivery}
                                                onChange={(e) => setEditEstimatedDelivery(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Leveringsmetode</Label>
                                            <Input
                                                value={editDeliveryType}
                                                onChange={(e) => setEditDeliveryType(e.target.value)}
                                                placeholder="Kundens valg pre-udfyldt — kan ændres hvis nødvendigt"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label>Statusnotat</Label>
                                        <Textarea
                                            value={editStatusNote}
                                            onChange={(e) => setEditStatusNote(e.target.value)}
                                            placeholder="Tilføj en note til denne ordre..."
                                            rows={2}
                                        />
                                    </div>

                                    {/* Problem section */}
                                    <div className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="hasProblem"
                                                checked={editHasProblem}
                                                onChange={(e) => setEditHasProblem(e.target.checked)}
                                                className="rounded"
                                            />
                                            <Label htmlFor="hasProblem" className="text-red-600 font-medium cursor-pointer">
                                                Marker som problem
                                            </Label>
                                        </div>

                                        {editHasProblem && (
                                            <>
                                                <Textarea
                                                    value={editProblemDescription}
                                                    onChange={(e) => setEditProblemDescription(e.target.value)}
                                                    placeholder="Beskriv problemet..."
                                                    rows={2}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="requiresReupload"
                                                        checked={editRequiresReupload}
                                                        onChange={(e) => setEditRequiresReupload(e.target.checked)}
                                                        className="rounded"
                                                    />
                                                    <Label htmlFor="requiresReupload" className="cursor-pointer">
                                                        Kunden skal uploade ny fil
                                                    </Label>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Files */}
                                {orderFiles.length > 0 && (
                                    <div>
                                        <Label className="text-muted-foreground mb-2 block">Uploadede filer</Label>
                                        <div className="space-y-2">
                                            {orderFiles.map((file) => (
                                                <div
                                                    key={file.id}
                                                    className={`flex items-center justify-between p-3 rounded-lg border ${file.is_current ? 'bg-green-50 border-green-200' : 'bg-muted/30'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4" />
                                                        <div>
                                                            <span className="text-sm">{file.file_name}</span>
                                                            {file.notes && (
                                                                <p className="text-xs text-muted-foreground">{file.notes}</p>
                                                            )}
                                                        </div>
                                                        {file.is_current && (
                                                            <Badge variant="secondary" className="text-xs">Aktuel</Badge>
                                                        )}
                                                    </div>
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                                            Vis
                                                        </a>
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="flex-col sm:flex-row gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (!selectedOrder) return;
                                        if (!companyProfile) {
                                            toast.error('Virksomhedsoplysninger mangler. Udfyld dem i Indstillinger.');
                                            return;
                                        }
                                        const taxRate = 25;
                                        const subtotal = selectedOrder.total_price / (1 + taxRate / 100);
                                        const taxAmount = selectedOrder.total_price - subtotal;

                                        downloadInvoice({
                                            invoiceNumber: `INV-${selectedOrder.order_number}`,
                                            orderNumber: selectedOrder.order_number,
                                            date: new Date(selectedOrder.created_at),
                                            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                                            customer: {
                                                name: selectedOrder.customer_name || 'Kunde',
                                                email: selectedOrder.customer_email,
                                                phone: selectedOrder.customer_phone || undefined,
                                                address: selectedOrder.delivery_address || undefined,
                                                city: selectedOrder.delivery_city || undefined,
                                                zip: selectedOrder.delivery_zip || undefined,
                                            },
                                            company: companyProfile,
                                            items: [{
                                                description: selectedOrder.product_name,
                                                quantity: selectedOrder.quantity,
                                                unitPrice: subtotal / selectedOrder.quantity,
                                                total: subtotal,
                                            }],
                                            subtotal: subtotal,
                                            taxRate: taxRate,
                                            taxAmount: taxAmount,
                                            total: selectedOrder.total_price,
                                            currency: 'DKK',
                                        });
                                        toast.success('Faktura downloaded!');
                                    }}
                                >
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Download Faktura
                                </Button>
                                <Button
                                    variant="outline"
                                    asChild
                                >
                                    <Link to={`/admin/beskeder?orderId=${selectedOrder.id}`}>
                                        <MessageCircle className="mr-2 h-4 w-4" />
                                        Gå til besked
                                    </Link>
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                        Annuller
                                    </Button>
                                    <Button onClick={handleSaveOrder} disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Gem ændringer
                                    </Button>
                                </div>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
