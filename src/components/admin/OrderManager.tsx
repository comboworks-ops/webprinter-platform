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
import { Loader2, Package, Truck, CheckCircle, AlertCircle, Clock, Eye, FileText, Search, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { downloadInvoice } from '@/lib/invoiceGenerator';

interface Order {
    id: string;
    order_number: string;
    user_id: string | null;
    customer_email: string;
    customer_name: string | null;
    customer_phone: string | null;
    product_name: string;
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
}

interface OrderFile {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string | null;
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

export function OrderManager() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orderFiles, setOrderFiles] = useState<OrderFile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Edit form state
    const [editStatus, setEditStatus] = useState('');
    const [editStatusNote, setEditStatusNote] = useState('');
    const [editTrackingNumber, setEditTrackingNumber] = useState('');
    const [editEstimatedDelivery, setEditEstimatedDelivery] = useState('');
    const [editHasProblem, setEditHasProblem] = useState(false);
    const [editProblemDescription, setEditProblemDescription] = useState('');
    const [editRequiresReupload, setEditRequiresReupload] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Kunne ikke hente ordrer');
        } finally {
            setLoading(false);
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
        fetchOrderFiles(order.id);
        setDialogOpen(true);
    };

    const handleSaveOrder = async () => {
        if (!selectedOrder) return;

        setSaving(true);
        try {
            const updates: any = {
                status: editStatus,
                status_note: editStatusNote || null,
                tracking_number: editTrackingNumber || null,
                estimated_delivery: editEstimatedDelivery || null,
                has_problem: editHasProblem,
                problem_description: editHasProblem ? editProblemDescription : null,
                requires_file_reupload: editRequiresReupload,
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

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            order.product_name.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

        return matchesSearch && matchesStatus;
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                <TableHead>Beløb</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Dato</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.map((order) => {
                                const status = statusConfig[order.status] || statusConfig.pending;
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
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                                        <p className="text-sm">
                                            {selectedOrder.delivery_address || 'Ikke angivet'}<br />
                                            {selectedOrder.delivery_zip} {selectedOrder.delivery_city}
                                        </p>
                                    </div>
                                </div>

                                {/* Order info */}
                                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                                    <div>
                                        <Label className="text-muted-foreground">Produkt</Label>
                                        <p className="font-medium">{selectedOrder.product_name}</p>
                                        <p className="text-sm">Antal: {selectedOrder.quantity}</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Beløb</Label>
                                        <p className="text-xl font-bold">{formatPrice(selectedOrder.total_price)}</p>
                                    </div>
                                </div>

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

                                    <div>
                                        <Label>Forventet levering</Label>
                                        <Input
                                            type="date"
                                            value={editEstimatedDelivery}
                                            onChange={(e) => setEditEstimatedDelivery(e.target.value)}
                                        />
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
                                                        <span className="text-sm">{file.file_name}</span>
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
                                            company: {
                                                name: 'WebPrint Danmark',
                                                address: 'Printervej 123',
                                                city: 'København',
                                                zip: '2100',
                                                country: 'Danmark',
                                                cvr: '12345678',
                                                phone: '+45 12 34 56 78',
                                                email: 'info@webprint.dk',
                                                bankName: 'Danske Bank',
                                                bankAccount: '1234 5678901234',
                                            },
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
