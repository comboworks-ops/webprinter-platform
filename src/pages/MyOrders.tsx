import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Package, Truck, CheckCircle, AlertCircle, Upload, FileText, Clock, MessageCircle, Send, ChevronDown, ChevronUp, FileDown, MapPin, LayoutDashboard, Settings, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Order {
    id: string;
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    status: string;
    status_note: string | null;
    delivery_type: string | null;
    tracking_number: string | null;
    estimated_delivery: string | null;
    has_problem: boolean;
    problem_description: string | null;
    requires_file_reupload: boolean;
    created_at: string;
    shipped_at: string | null;
    delivered_at: string | null;
}

interface Message {
    id: string;
    content: string;
    sender_type: 'customer' | 'admin';
    created_at: string;
    is_read: boolean;
}

interface TrackingEvent {
    id: string;
    event_type: string;
    location: string | null;
    description: string | null;
    occurred_at: string;
}

interface Invoice {
    id: string;
    invoice_number: string;
    total: number;
    status: string;
    pdf_url: string | null;
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

const trackingEventLabels: Record<string, string> = {
    order_placed: 'Ordre modtaget',
    processing: 'Behandles',
    in_production: 'I produktion',
    quality_check: 'Kvalitetskontrol',
    packed: 'Pakket',
    picked_up: 'Afhentet af fragtfirma',
    in_transit: 'Undervejs',
    out_for_delivery: 'Ude til levering',
    delivered: 'Leveret',
};

const sidebarItems = [
    { path: '/min-konto', label: 'Oversigt', icon: LayoutDashboard, end: true },
    { path: '/min-konto/ordrer', label: 'Mine Ordrer', icon: Package },
    { path: '/min-konto/adresser', label: 'Leveringsadresser', icon: MapPin },
    { path: '/min-konto/indstillinger', label: 'Indstillinger', icon: Settings },
];

export default function MyOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [newMessage, setNewMessage] = useState<Record<string, string>>({});
    const [sendingMessage, setSendingMessage] = useState<string | null>(null);
    const [trackingEvents, setTrackingEvents] = useState<Record<string, TrackingEvent[]>>({});
    const [invoices, setInvoices] = useState<Record<string, Invoice | null>>({});

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/auth?redirect=/mine-ordrer');
            return;
        }
        setUser(user);
        fetchOrders(user.id);
    };

    const fetchOrders = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('orders' as any)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const ordersData = (data as any[]) || [];
            setOrders(ordersData);

            // Fetch message counts for all orders to show badges correctly
            if (ordersData.length > 0) {
                const orderIds = ordersData.map(o => o.id);
                const { data: messagesData } = await supabase
                    .from('order_messages' as any)
                    .select('order_id, sender_type, is_read')
                    .in('order_id', orderIds);

                if (messagesData) {
                    // Group messages by order_id to set initial state
                    const messagesByOrder: Record<string, any[]> = {};
                    (messagesData as any[]).forEach(msg => {
                        if (!messagesByOrder[msg.order_id]) {
                            messagesByOrder[msg.order_id] = [];
                        }
                        messagesByOrder[msg.order_id].push(msg);
                    });
                    setMessages(messagesByOrder);
                }
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Kunne ikke hente ordrer');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderDetails = async (orderId: string) => {
        // Fetch messages
        try {
            const { data: messagesData } = await supabase
                .from('order_messages' as any)
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true });

            setMessages(prev => ({ ...prev, [orderId]: (messagesData as any[]) || [] }));
        } catch (e) {
            console.debug('Messages not available yet');
        }

        // Fetch tracking events
        try {
            const { data: trackingData } = await supabase
                .from('delivery_tracking' as any)
                .select('*')
                .eq('order_id', orderId)
                .order('occurred_at', { ascending: false });

            setTrackingEvents(prev => ({ ...prev, [orderId]: (trackingData as any[]) || [] }));
        } catch (e) {
            console.debug('Tracking not available yet');
        }

        // Fetch invoice
        try {
            const { data: invoiceData } = await supabase
                .from('order_invoices' as any)
                .select('*')
                .eq('order_id', orderId)
                .single();

            setInvoices(prev => ({ ...prev, [orderId]: invoiceData as any }));
        } catch (e) {
            console.debug('Invoice not available yet');
        }
    };

    const toggleOrderExpanded = async (orderId: string) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
        } else {
            setExpandedOrderId(orderId);
            fetchOrderDetails(orderId);

            // Mark messages from admin as read when customer views them
            try {
                await supabase
                    .from('order_messages' as any)
                    .update({ is_read: true })
                    .eq('order_id', orderId)
                    .eq('sender_type', 'admin')
                    .eq('is_read', false);

                // Update local state to reflect read status
                setMessages(prev => ({
                    ...prev,
                    [orderId]: (prev[orderId] || []).map(m =>
                        m.sender_type === 'admin' ? { ...m, is_read: true } : m
                    )
                }));
            } catch (e) {
                console.debug('Could not mark messages as read');
            }
        }
    };

    const handleSendMessage = async (orderId: string) => {
        const content = newMessage[orderId]?.trim();
        if (!content) return;

        setSendingMessage(orderId);
        try {
            const { error } = await supabase.from('order_messages' as any).insert({
                order_id: orderId,
                sender_id: user?.id,
                sender_type: 'customer',
                content,
            });

            if (error) throw error;

            setNewMessage(prev => ({ ...prev, [orderId]: '' }));
            toast.success('Besked sendt!');
            fetchOrderDetails(orderId);
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Kunne ikke sende besked');
        } finally {
            setSendingMessage(null);
        }
    };

    const handleFileUpload = async (orderId: string, file: File) => {
        setUploadingOrderId(orderId);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${orderId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('order-files')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('order-files')
                .getPublicUrl(fileName);

            await supabase
                .from('order_files' as any)
                .update({ is_current: false })
                .eq('order_id', orderId);

            await supabase.from('order_files' as any).insert({
                order_id: orderId,
                file_name: file.name,
                file_url: publicUrl,
                file_type: fileExt,
                file_size: file.size,
                uploaded_by: user?.id,
            });

            await supabase
                .from('orders' as any)
                .update({ requires_file_reupload: false })
                .eq('id', orderId);

            toast.success('Fil uploadet succesfuldt!');
            fetchOrders(user.id);
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Kunne ikke uploade fil');
        } finally {
            setUploadingOrderId(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('da-DK', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatDateTime = (dateString: string) => {
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
            <div className="min-h-screen flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header />

            <main className="flex-1 bg-background">
                <div className="container mx-auto px-4 py-8">
                    {/* Page Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold">Min Konto</h1>
                        <p className="text-muted-foreground mt-1">
                            Administrer dine oplysninger og indstillinger
                        </p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Sidebar */}
                        <aside className="lg:w-64 flex-shrink-0">
                            <nav className="space-y-1 sticky top-24">
                                {sidebarItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = item.end
                                        ? location.pathname === item.path
                                        : location.pathname.startsWith(item.path);

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                                                isActive
                                                    ? "bg-primary text-primary-foreground"
                                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="h-5 w-5" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </aside>

                        {/* Main Content */}
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold mb-2">Mine Ordrer</h2>
                            <p className="text-muted-foreground mb-6">Se status på dine bestillinger og kontakt os</p>

                            {orders.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-semibold mb-2">Ingen ordrer endnu</h3>
                                        <p className="text-muted-foreground mb-4">
                                            Du har ikke afgivet nogen ordrer endnu.
                                        </p>
                                        <Button onClick={() => navigate('/produkter')}>
                                            Se produkter
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map((order) => {
                                        const status = statusConfig[order.status] || statusConfig.pending;
                                        const StatusIcon = status.icon;
                                        const isExpanded = expandedOrderId === order.id;
                                        const orderMessages = messages[order.id] || [];
                                        const orderTracking = trackingEvents[order.id] || [];
                                        const orderInvoice = invoices[order.id];

                                        return (
                                            <Card key={order.id} className={order.has_problem ? 'border-red-300' : ''}>
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <CardTitle className="text-lg flex items-center gap-2">
                                                                Ordre #{order.order_number}
                                                                {order.has_problem && (
                                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                                )}
                                                            </CardTitle>
                                                            <CardDescription>
                                                                Bestilt {formatDate(order.created_at)}
                                                            </CardDescription>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={status.color}>
                                                                <StatusIcon className="h-3 w-3 mr-1" />
                                                                {status.label}
                                                            </Badge>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => toggleOrderExpanded(order.id)}
                                                                        className={cn(
                                                                            "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                                                                            isExpanded
                                                                                ? "bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/40 scale-110"
                                                                                : "bg-gradient-to-br from-green-400 to-green-500 text-white hover:from-green-500 hover:to-green-600 hover:shadow-lg hover:shadow-green-500/30 hover:scale-105"
                                                                        )}
                                                                    >
                                                                        <MessageCircle className="h-5 w-5" />
                                                                        {/* iOS-style notification badge */}
                                                                        {orderMessages.filter(m => m.sender_type === 'admin' && !m.is_read).length > 0 && (
                                                                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-[11px] font-bold text-white shadow-md border-2 border-white">
                                                                                {orderMessages.filter(m => m.sender_type === 'admin' && !m.is_read).length}
                                                                            </span>
                                                                        )}
                                                                        {/* Read receipt indicator */}
                                                                        {orderMessages.some(m => m.sender_type === 'admin') && orderMessages.filter(m => m.sender_type === 'admin' && !m.is_read).length === 0 && (
                                                                            <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center bg-white rounded-full p-0.5">
                                                                                <CheckCheck className="h-3 w-3 text-blue-500" />
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left" className="bg-gray-900 text-white border-0">
                                                                    <p className="font-medium">
                                                                        {orderMessages.filter(m => m.sender_type === 'admin' && !m.is_read).length > 0
                                                                            ? `${orderMessages.filter(m => m.sender_type === 'admin' && !m.is_read).length} ny besked`
                                                                            : orderMessages.some(m => m.sender_type === 'admin')
                                                                                ? 'Svar modtaget'
                                                                                : 'Send besked'}
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                </CardHeader>

                                                <CardContent className="space-y-4">
                                                    {/* Order details */}
                                                    <div className="flex justify-between items-center py-2 border-b">
                                                        <div>
                                                            <p className="font-medium">{order.product_name}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                Antal: {order.quantity}
                                                            </p>
                                                        </div>
                                                        <p className="font-semibold">{formatPrice(order.total_price)}</p>
                                                    </div>

                                                    {/* Tracking info */}
                                                    {order.tracking_number && (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Truck className="h-4 w-4" />
                                                            <span>Tracking: {order.tracking_number}</span>
                                                        </div>
                                                    )}

                                                    {order.estimated_delivery && (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Clock className="h-4 w-4" />
                                                            <span>Forventet levering: {formatDate(order.estimated_delivery)}</span>
                                                        </div>
                                                    )}

                                                    {/* Status timeline */}
                                                    <div className="pt-2">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <div className={`w-2.5 h-2.5 rounded-full ${order.status === 'pending' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                                            <span className={order.status === 'pending' ? 'font-medium' : 'text-muted-foreground'}>Modtaget</span>
                                                            <div className="flex-1 h-0.5 bg-muted" />
                                                            <div className={`w-2.5 h-2.5 rounded-full ${['processing', 'production', 'shipped', 'delivered'].includes(order.status) ? 'bg-green-500' : 'bg-muted'}`} />
                                                            <span className={order.status === 'processing' ? 'font-medium' : 'text-muted-foreground'}>Behandles</span>
                                                            <div className="flex-1 h-0.5 bg-muted" />
                                                            <div className={`w-2.5 h-2.5 rounded-full ${['production', 'shipped', 'delivered'].includes(order.status) ? 'bg-green-500' : 'bg-muted'}`} />
                                                            <span className={order.status === 'production' ? 'font-medium' : 'text-muted-foreground'}>Produktion</span>
                                                            <div className="flex-1 h-0.5 bg-muted" />
                                                            <div className={`w-2.5 h-2.5 rounded-full ${['shipped', 'delivered'].includes(order.status) ? 'bg-green-500' : 'bg-muted'}`} />
                                                            <span className={order.status === 'shipped' ? 'font-medium' : 'text-muted-foreground'}>Afsendt</span>
                                                            <div className="flex-1 h-0.5 bg-muted" />
                                                            <div className={`w-2.5 h-2.5 rounded-full ${order.status === 'delivered' ? 'bg-green-500' : 'bg-muted'}`} />
                                                            <span className={order.status === 'delivered' ? 'font-medium' : 'text-muted-foreground'}>Leveret</span>
                                                        </div>
                                                    </div>

                                                    {/* Problem alert */}
                                                    {order.has_problem && (
                                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                            <div className="flex items-start gap-2">
                                                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="font-medium text-red-800">Der er et problem med din ordre</p>
                                                                    {order.problem_description && (
                                                                        <p className="text-sm text-red-700 mt-1">{order.problem_description}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* File reupload section */}
                                                    {order.requires_file_reupload && (
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                            <div className="flex items-start gap-2">
                                                                <Upload className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-yellow-800">Upload ny fil</p>
                                                                    <p className="text-sm text-yellow-700 mt-1 mb-3">
                                                                        Vi har brug for en ny fil til denne ordre.
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            type="file"
                                                                            accept=".pdf,.jpg,.jpeg,.png,.ai,.eps"
                                                                            disabled={uploadingOrderId === order.id}
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) handleFileUpload(order.id, file);
                                                                            }}
                                                                            className="max-w-xs"
                                                                        />
                                                                        {uploadingOrderId === order.id && (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Expanded content */}
                                                    {isExpanded && (
                                                        <div className="border-t pt-4 space-y-6">
                                                            {/* Invoice section */}
                                                            {orderInvoice && (
                                                                <div className="bg-muted/30 rounded-lg p-4">
                                                                    <h4 className="font-medium flex items-center gap-2 mb-2">
                                                                        <FileText className="h-4 w-4" />
                                                                        Faktura
                                                                    </h4>
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <p className="text-sm">#{orderInvoice.invoice_number}</p>
                                                                            <p className="text-lg font-bold">{formatPrice(orderInvoice.total)}</p>
                                                                        </div>
                                                                        <Badge className={
                                                                            orderInvoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                                                orderInvoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                                    'bg-gray-100 text-gray-800'
                                                                        }>
                                                                            {orderInvoice.status === 'paid' ? 'Betalt' :
                                                                                orderInvoice.status === 'pending' ? 'Afventer' : orderInvoice.status}
                                                                        </Badge>
                                                                    </div>
                                                                    {orderInvoice.pdf_url && (
                                                                        <Button variant="outline" size="sm" className="mt-2" asChild>
                                                                            <a href={orderInvoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                                                                <FileDown className="h-4 w-4 mr-2" />
                                                                                Download PDF
                                                                            </a>
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Detailed tracking */}
                                                            {orderTracking.length > 0 && (
                                                                <div>
                                                                    <h4 className="font-medium flex items-center gap-2 mb-3">
                                                                        <Truck className="h-4 w-4" />
                                                                        Leveringssporing
                                                                    </h4>
                                                                    <div className="space-y-3">
                                                                        {orderTracking.map((event, idx) => (
                                                                            <div key={event.id} className="flex gap-3">
                                                                                <div className="flex flex-col items-center">
                                                                                    <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-green-500' : 'bg-muted'}`} />
                                                                                    {idx < orderTracking.length - 1 && (
                                                                                        <div className="w-0.5 h-8 bg-muted" />
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex-1 pb-3">
                                                                                    <p className="font-medium text-sm">
                                                                                        {trackingEventLabels[event.event_type] || event.event_type}
                                                                                    </p>
                                                                                    {event.location && (
                                                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                                            <MapPin className="h-3 w-3" />
                                                                                            {event.location}
                                                                                        </p>
                                                                                    )}
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        {formatDateTime(event.occurred_at)}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Messages */}
                                                            <div>
                                                                <h4 className="font-medium flex items-center gap-2 mb-3">
                                                                    <MessageCircle className="h-4 w-4" />
                                                                    Beskeder ({orderMessages.length})
                                                                </h4>

                                                                {/* Message list */}
                                                                <div className="bg-muted/30 rounded-lg p-3 max-h-64 overflow-y-auto mb-3 space-y-3">
                                                                    {orderMessages.length === 0 ? (
                                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                                            Ingen beskeder endnu. Send en besked hvis du har spørgsmål.
                                                                        </p>
                                                                    ) : (
                                                                        orderMessages.map((msg) => (
                                                                            <div
                                                                                key={msg.id}
                                                                                className={`p-3 rounded-lg ${msg.sender_type === 'customer'
                                                                                    ? 'bg-primary text-primary-foreground ml-8'
                                                                                    : 'bg-background mr-8 border'
                                                                                    }`}
                                                                            >
                                                                                <p className="text-sm">{msg.content}</p>
                                                                                <p className={`text-xs mt-1 ${msg.sender_type === 'customer' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                                                                    }`}>
                                                                                    {msg.sender_type === 'customer' ? 'Dig' : 'Kundeservice'} • {formatDateTime(msg.created_at)}
                                                                                </p>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>

                                                                {/* New message input */}
                                                                <div className="flex gap-2">
                                                                    <Textarea
                                                                        placeholder="Skriv en besked..."
                                                                        value={newMessage[order.id] || ''}
                                                                        onChange={(e) => setNewMessage(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                                        rows={2}
                                                                        className="flex-1"
                                                                    />
                                                                    <Button
                                                                        onClick={() => handleSendMessage(order.id)}
                                                                        disabled={sendingMessage === order.id || !newMessage[order.id]?.trim()}
                                                                    >
                                                                        {sendingMessage === order.id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Send className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
