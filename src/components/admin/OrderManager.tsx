import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, AlertCircle, FileText, Search, FileDown, MessageCircle, ChevronRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { downloadInvoice } from '@/lib/invoiceGenerator';
import { resolveAdminTenant } from '@/lib/adminTenant';
import { Link, useSearchParams } from 'react-router-dom';
import { OrderStatus, WorkspaceDate, orderDate, useOrderWorkspaceLink } from './workspace/orderPresentation';
import './workspace/orderWorkspace.css';

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
    const workspaceLink = useOrderWorkspaceLink();
    const [searchParams, setSearchParams] = useSearchParams();
    const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [fileSummaryError, setFileSummaryError] = useState(false);
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesError, setFilesError] = useState(false);
    const filesRequest = useRef(0);
    const detailSession = useRef(0);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; detailSession.current += 1; filesRequest.current += 1; };
    }, []);
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
    }, [searchParams.get('force_domain')]);

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

    const fetchOrders = async (quiet = false) => {
        if (!quiet) setLoading(true);
        setLoadError(false);
        try {
            const { tenantId } = await resolveAdminTenant();
            if (!tenantId) throw new Error('Ingen aktiv shop');
            const fetchedOrders: Order[] = [];
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase.from('orders' as any).select('*')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false }).order('id', { ascending: false })
                    .range(offset, offset + 499);
                if (error) throw error;
                const page = (data || []) as unknown as Order[];
                fetchedOrders.push(...page);
                if (page.length < 500) break;
            }
            setOrders(fetchedOrders);
            await fetchOrderFileSummary(fetchedOrders.map(order => order.id));
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders([]);
            setOrderFileSummaryByOrderId({});
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderFileSummary = async (orderIds: string[]) => {
        setFileSummaryError(false);
        if (orderIds.length === 0) {
            setOrderFileSummaryByOrderId({});
            return;
        }

        try {
            const files: any[] = [];
            for (let index = 0; index < orderIds.length; index += 100) {
                for (let offset = 0; ; offset += 500) {
                    const { data, error } = await supabase.from('order_files' as any)
                        .select('order_id, is_current, notes').in('order_id', orderIds.slice(index, index + 100))
                        .order('id').range(offset, offset + 499);
                    if (error) throw error;
                    const page = data || [];
                    files.push(...page);
                    if (page.length < 500) break;
                }
            }

            const summary = files.reduce<Record<string, OrderFileSummary>>((acc, file: any) => {
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
            setFileSummaryError(true);
        }
    };

    const fetchOrderFiles = async (orderId: string) => {
        const requestId = ++filesRequest.current;
        setOrderFiles([]);
        setFilesLoading(true);
        setFilesError(false);
        try {
            const files: OrderFile[] = [];
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase.from('order_files' as any).select('*')
                    .eq('order_id', orderId).order('uploaded_at', { ascending: false }).order('id')
                    .range(offset, offset + 499);
                if (error) throw error;
                const page = (data || []) as unknown as OrderFile[];
                files.push(...page);
                if (page.length < 500) break;
            }
            if (filesRequest.current === requestId) {
                setOrderFiles(files);
                setOrderFileSummaryByOrderId(previous => ({ ...previous, [orderId]: {
                    totalCount: files.length,
                    currentCount: files.filter(file => file.is_current).length,
                    currentNotes: files.filter(file => file.is_current && file.notes).map(file => file.notes!),
                } }));
            }
        } catch (error) {
            console.error('Error fetching order files:', error);
            if (filesRequest.current === requestId) setFilesError(true);
        } finally {
            if (filesRequest.current === requestId) setFilesLoading(false);
        }
    };

    const closeOrderDetails = () => {
        detailSession.current += 1;
        setDialogOpen(false);
        const params = new URLSearchParams(searchParams);
        params.delete('orderId');
        setSearchParams(params);
    };

    const openOrderDetails = (order: Order) => {
        detailSession.current += 1;
        setSelectedOrder(order);
        setEditStatus(order.status);
        setEditStatusNote(order.status_note || '');
        setEditTrackingNumber(order.tracking_number || '');
        setEditEstimatedDelivery(order.estimated_delivery?.slice(0, 10) || '');
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
        if (searchParams.get('orderId') !== order.id) {
            const params = new URLSearchParams(searchParams);
            params.set('orderId', order.id);
            setSearchParams(params);
        }
    };

    useEffect(() => {
        const orderId = searchParams.get('orderId');
        if (!orderId) { detailSession.current += 1; setDialogOpen(false); return; }
        if (loading || (dialogOpen && selectedOrder?.id === orderId)) return;
        const order = orders.find(item => item.id === orderId);
        if (order) openOrderDetails(order);
    }, [searchParams, orders, loading]);

    const handleSaveOrder = async () => {
        if (!selectedOrder || saving) return;
        if (!selectedOrder.tenant_id) { toast.error('Ordren mangler shoptilknytning. Genindlæs og prøv igen.'); return; }

        const savingDetailSession = detailSession.current;
        let orderPersisted = false;
        let historyFailed = false;
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

            const { data: savedOrder, error } = await supabase
                .from('orders' as any)
                .update(updates)
                .eq('id', selectedOrder.id)
                .eq('tenant_id', selectedOrder.tenant_id)
                .select('id')
                .single();

            if (error) throw error;
            if ((savedOrder as unknown as { id?: string } | null)?.id !== selectedOrder.id) {
                throw new Error('Ordren kunne ikke bekræftes gemt');
            }
            orderPersisted = true;

            // Log status change and send email notification
            if (editStatus !== selectedOrder.status) {
                try {
                    const { data: { user }, error: userError } = await supabase.auth.getUser();
                    if (userError) throw userError;
                    const { error: historyError } = await supabase.from('order_status_history' as any).insert({
                        order_id: selectedOrder.id,
                        old_status: selectedOrder.status,
                        new_status: editStatus,
                        changed_by: user?.id,
                        note: editStatusNote,
                    });
                    if (historyError) throw historyError;
                } catch (historyError) {
                    // The order is already persisted. Do not retry the update or report a rollback.
                    historyFailed = true;
                    console.error('Order saved, but status history failed:', historyError);
                }
            }

            if (editStatus !== selectedOrder.status || (editHasProblem && !selectedOrder.has_problem)) {
                // Send email notification (non-blocking)
                import('@/lib/emailService').then(async ({ sendStatusChangeEmail, sendProblemNotification }) => {
                    let emailAccepted: boolean;
                    if (editHasProblem && !selectedOrder.has_problem) {
                        // New problem - send problem notification
                        emailAccepted = await sendProblemNotification({
                            id: selectedOrder.id,
                            tenant_id: selectedOrder.tenant_id,
                        });
                    } else {
                        // Regular status change
                        emailAccepted = await sendStatusChangeEmail({
                            id: selectedOrder.id,
                            tenant_id: selectedOrder.tenant_id,
                        });
                    }
                    if (!emailAccepted) toast.warning('Ordren er gemt, men emailen kunne ikke bekræftes sendt.');
                }).catch(() => toast.warning('Ordren er gemt, men emailen kunne ikke bekræftes sendt.'));
            }

            if (historyFailed) {
                toast.warning('Ordren er gemt, men ændringen mangler i statushistorikken.');
            } else {
                toast.success('Ordre opdateret');
            }
            if (mounted.current) {
                // A completed request must not close a different order opened meanwhile.
                if (detailSession.current === savingDetailSession) closeOrderDetails();
                void fetchOrders(true);
            }
        } catch (error) {
            console.error('Error saving order:', error);
            if (orderPersisted) {
                toast.warning('Ordren er gemt, men visningen kunne ikke opdateres. Genindlæs for at se den gemte ordre.');
            } else {
                toast.error('Kunne ikke opdatere ordre. Genindlæs og kontrollér din adgang.');
            }
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
            String(order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(order.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            String(order.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            productionFlowMeta.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            readinessMeta.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (productionFlow?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        const matchesFlow = flowFilter === 'all' || productionFlowKind === flowFilter;
        const matchesReadiness = readinessFilter === 'all' || readinessKind === readinessFilter;

        return matchesSearch && matchesStatus && matchesFlow && matchesReadiness;
    });

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

    const previewOrder = filteredOrders.find(order => order.id === previewOrderId) || filteredOrders[0];
    const hasFilters = Boolean(searchTerm || statusFilter !== 'all' || flowFilter !== 'all' || readinessFilter !== 'all');
    const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); setFlowFilter('all'); setReadinessFilter('all'); };

    if (loading) return <div className="ow-state" role="status"><Loader2 className="animate-spin" /><p>Henter ordrer og filstatus…</p></div>;

    if (loadError) return <div className="ow-state ow-error" role="alert"><AlertCircle /><div><h2>Ordrerne kunne ikke hentes</h2><p>Prøv igen for at se den valgte shops ordrer.</p></div><Button variant="outline" onClick={() => fetchOrders()}>Prøv igen</Button></div>;

    if (dialogOpen && selectedOrder) return (
        <div className="ow-order-detail">
            <nav className="ow-breadcrumb" aria-label="Brødkrumme"><button onClick={closeOrderDetails}><ArrowLeft />Ordrer</button><span>/</span><span>{selectedOrder.order_number}</span></nav>
            <header className="ow-page-heading"><div><h1>Ordredetaljer</h1><p>Her kan du behandle ordren og opdatere status.</p></div><WorkspaceDate /></header>
            <div className="ow-order-detail-grid">
                <div className="ow-detail-main">
                    <dl className="ow-order-facts">
                        <div><dt>Ordre</dt><dd>{selectedOrder.order_number}</dd></div><div><dt>Kunde</dt><dd>{selectedOrder.customer_name || selectedOrder.customer_email}</dd></div>
                        <div><dt>Ordredato</dt><dd>{orderDate(selectedOrder.created_at)}</dd></div><div><dt>Ordrebeløb</dt><dd>{formatPrice(selectedOrder.total_price)}</dd></div>
                        <div><dt>Ordrestatus</dt><dd><OrderStatus status={selectedOrder.status} /></dd></div><div><dt>Filstatus</dt><dd>{filesLoading ? 'Henter…' : filesError ? 'Kan ikke hentes' : getOrderProductionReadinessMeta(selectedOrder).label}</dd></div>
                    </dl>
                    <div className="ow-detail-edit-columns">
                        <section className="ow-detail-fields"><h2>Ordreoplysninger</h2>
                                {/* Status editing */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="order-status">Status</Label>
                                            <Select value={editStatus} onValueChange={setEditStatus}>
                                                <SelectTrigger id="order-status">
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
                                            <Label htmlFor="order-tracking">Tracking nummer</Label>
                                            <Input
                                                id="order-tracking" value={editTrackingNumber}
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
                                            <Label htmlFor="order-delivery-date">Forventet levering</Label>
                                            <Input
                                                type="date"
                                                id="order-delivery-date" value={editEstimatedDelivery}
                                                onChange={(e) => setEditEstimatedDelivery(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="order-delivery-method">Leveringsmetode</Label>
                                            <Input
                                                id="order-delivery-method" value={editDeliveryType}
                                                onChange={(e) => setEditDeliveryType(e.target.value)}
                                                placeholder="Kundens valg pre-udfyldt — kan ændres hvis nødvendigt"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="order-note">Statusnotat</Label>
                                        <Textarea
                                            id="order-note" value={editStatusNote}
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
                                                    aria-label="Problembeskrivelse" value={editProblemDescription}
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


                        </section>
                        <section className="ow-detail-files"><h2>Filer</h2>
                            {filesLoading ? <p className="ow-file-state" role="status"><Loader2 className="animate-spin" />Henter filer…</p> : filesError ? <div className="ow-file-state" role="alert"><p>Filerne kunne ikke hentes.</p><Button variant="outline" size="sm" onClick={() => fetchOrderFiles(selectedOrder.id)}>Prøv igen</Button></div> : orderFiles.length === 0 ? <div className="ow-empty ow-empty-compact"><FileText /><h3>Ingen filer uploadet</h3><p>Kundens produktionsfiler vises her, når de er modtaget.</p></div> : <div className="ow-file-list">{orderFiles.map(file => <article key={file.id} className="ow-file-card"><FileText aria-hidden="true" /><div><h3>{file.file_name}</h3><p>{orderDate(file.uploaded_at, true)} · {file.is_current ? 'Aktuel fil' : 'Tidligere fil'}</p>{file.notes && <p>{file.notes}</p>}</div><a href={file.file_url} target="_blank" rel="noopener noreferrer">Se fil<ChevronRight className="h-4 w-4" /></a></article>)}</div>}
                                {(() => {
                                    const flow = getOrderProductionFlowMeta(selectedOrder);
                                    const readiness = getOrderProductionReadinessMeta(selectedOrder);
                                    const fileSummary = getOrderFileSummary(selectedOrder.id);
                                    const currentDetailFiles = orderFiles.filter((file) => file.is_current).length;
                                    const currentFileCount = filesLoading || filesError ? fileSummary.currentCount : currentDetailFiles;

                                    return (
                                        <div className="ow-readiness-note space-y-3">
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
                                                    <p className="font-medium">{filesError ? 'Ukendt' : filesLoading ? '…' : currentFileCount}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Alle filer</p>
                                                    <p className="font-medium">{filesError ? 'Ukendt' : filesLoading ? '…' : orderFiles.length}</p>
                                                </div>
                                            </div>
                                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                                                <span className="font-medium">Næste handling:</span>{' '}
                                                {getOrderProductionNextAction(selectedOrder)}
                                            </div>
                                        </div>
                                    );
                                })()}


                        </section>
                    </div>
                </div>
                <aside className="ow-order-aside"><h2>Ordrevisning</h2>
                                {/* Order info */}
                                <div className="space-y-5">
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

                                {/* Customer info */}
                                <div className="space-y-7">
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


                </aside>
            </div>
            <footer className="ow-detail-footer">
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

                <Button variant="outline" asChild><Link to={workspaceLink(`/admin/beskeder?orderId=${selectedOrder.id}`)}><MessageCircle className="mr-2 h-4 w-4" />Gå til besked</Link></Button>
                <div className="ow-detail-save"><Button variant="outline" onClick={closeOrderDetails} disabled={saving}>Annuller</Button><Button onClick={handleSaveOrder} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gem ændringer</Button></div>
            </footer>
        </div>
    );

    return (
        <div className="ow-orders">
            <header className="ow-page-heading"><div><h1>Ordrer</h1><p>Få overblik over ordrer, status og filer.</p></div><WorkspaceDate /></header>
            {searchParams.get('orderId') && !orders.some(order => order.id === searchParams.get('orderId')) && <div className="ow-inline-notice" role="status">Ordren blev ikke fundet i den valgte shop.<button onClick={closeOrderDetails}>Vis ordreoversigten</button></div>}
            <div className="ow-order-filterbar">
                <div className="ow-search"><Search aria-hidden="true" /><Input aria-label="Søg på ordre, kunde eller produkt" placeholder="Søg på ordre, kunde eller produkt" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]" aria-label="Ordrestatus">
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
                            <SelectTrigger className="w-[180px]" aria-label="Produktionsflow">
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
                            <SelectTrigger className="w-[210px]" aria-label="Filstatus">
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

                {hasFilters && <Button variant="ghost" onClick={resetFilters}><RotateCcw className="h-4 w-4 mr-2" />Nulstil</Button>}
            </div>
            <div className="ow-register-count" aria-live="polite">{filteredOrders.length} af {orders.length} ordrer</div>
            {fileSummaryError && <div className="ow-inline-notice" role="alert">Filstatus kunne ikke hentes. Åbn ordren for at hente dens filer igen.<button onClick={() => fetchOrderFileSummary(orders.map(order => order.id))}>Prøv igen</button></div>}
            <div className="ow-order-split">
                <section className="ow-order-register" aria-label="Ordreoversigt"><div className="ow-table-scroll"><table className="ow-table ow-orders-table">
                    <thead><tr><th>Ordre</th><th>Dato</th><th>Kunde</th><th>Produkt</th><th>Beløb</th><th>Ordrestatus</th><th>Filer</th><th><span className="sr-only">Handlinger</span></th></tr></thead>
                    <tbody>{filteredOrders.map(order => <tr key={order.id} className={previewOrder?.id === order.id ? 'ow-row-selected' : ''} onClick={() => setPreviewOrderId(order.id)}>
                        <td><button className="ow-order-number" onClick={() => setPreviewOrderId(order.id)} aria-label={`Vis overblik for ordre ${order.order_number}`} aria-pressed={previewOrder?.id === order.id}>{order.order_number}</button></td>
                        <td>{orderDate(order.created_at)}</td><td>{order.customer_name || order.customer_email || 'Kunde'}</td><td>{order.product_name}<span className="ow-table-subline ow-muted">{order.quantity} stk.</span></td><td>{formatPrice(order.total_price)}</td><td><OrderStatus status={order.status} /></td><td><span className="ow-file-status" data-kind={getOrderProductionReadinessKind(order)}>{fileSummaryError ? 'Kan ikke hentes' : getOrderProductionReadinessMeta(order).label}</span></td>
                        <td><Button variant="ghost" size="icon" aria-label={`Åbn ordre ${order.order_number}`} onClick={event => { event.stopPropagation(); openOrderDetails(order); }}><ChevronRight className="h-4 w-4" /></Button></td>
                    </tr>)}
                    {filteredOrders.length === 0 && <tr><td colSpan={8}><div className="ow-empty"><Package /><h3>{orders.length ? 'Ingen ordrer matcher din søgning' : 'Ingen ordrer endnu'}</h3><p>{orders.length ? 'Prøv en anden søgning eller nulstil dine filtre.' : 'Når kunderne bestiller, kan du behandle deres ordrer her.'}</p>{hasFilters && <Button variant="outline" onClick={resetFilters}>Nulstil filtre</Button>}</div></td></tr>}
                    </tbody>
                </table></div></section>
                {previewOrder && <aside className="ow-order-preview" aria-label={`Overblik for ordre ${previewOrder.order_number}`}>
                    <div className="ow-preview-heading"><div><h2>{previewOrder.order_number}</h2><OrderStatus status={previewOrder.status} /></div><Button onClick={() => openOrderDetails(previewOrder)}>Åbn ordre</Button></div>
                    <dl className="ow-preview-facts"><div><dt>Dato</dt><dd>{orderDate(previewOrder.created_at)}</dd></div><div><dt>Kunde</dt><dd>{previewOrder.customer_name || previewOrder.customer_email}</dd></div><div><dt>Produkt</dt><dd>{previewOrder.product_name}</dd></div><div><dt>Beløb</dt><dd>{formatPrice(previewOrder.total_price)}</dd></div></dl>
                    <section><h3>Ordrestatus</h3><OrderStatus status={previewOrder.status} />{previewOrder.problem_description && <p>{previewOrder.problem_description}</p>}</section>
                    <section><h3>Filer</h3><span className="ow-file-status" data-kind={getOrderProductionReadinessKind(previewOrder)}>{fileSummaryError ? 'Filstatus kunne ikke hentes' : getOrderProductionReadinessMeta(previewOrder).label}</span><p>{getOrderProductionNextAction(previewOrder)}</p></section>
                    <section><h3>Detaljer</h3><dl className="ow-preview-details"><div><dt>Antal</dt><dd>{previewOrder.quantity} stk.</dd></div><div><dt>Leveringsmetode</dt><dd>{previewOrder.delivery_type || readOrderTag(previewOrder.status_note, 'LEVERINGSMETODE') || 'Ikke angivet'}</dd></div><div><dt>Leveringsadresse</dt><dd>{readOrderTag(previewOrder.status_note, 'LEVERING') || [previewOrder.delivery_address, previewOrder.delivery_zip, previewOrder.delivery_city].filter(Boolean).join(', ') || 'Ikke angivet'}</dd></div>{previewOrder.estimated_delivery && <div><dt>Forventet levering</dt><dd>{orderDate(previewOrder.estimated_delivery)}</dd></div>}{previewOrder.tracking_number && <div><dt>Tracking</dt><dd>{previewOrder.tracking_number}</dd></div>}</dl></section>
                    <section><h3>Noter</h3><p className="ow-preview-note">{previewOrder.status_note || 'Ingen noter til denne ordre.'}</p><Link to={workspaceLink(`/admin/beskeder?orderId=${previewOrder.id}`)}>Åbn beskeder<ChevronRight className="h-4 w-4" /></Link></section>
                </aside>}
            </div>
        </div>
    );
}
