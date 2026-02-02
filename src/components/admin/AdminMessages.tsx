import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircle, Send, User, Clock, CheckCheck, Search, Package, LifeBuoy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Users, Globe, ChevronDown, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

interface Message {
    id: string;
    order_id: string;
    content: string;
    sender_type: 'customer' | 'admin';
    sender_id: string;
    is_read: boolean;
    created_at: string;
}

interface OrderWithMessages {
    order_id: string;
    order_number: string;
    product_name: string;
    customer_email: string;
    customer_name: string;
    messages: Message[];
    unread_count: number;
    last_message_at: string;
}

export default function AdminMessages() {
    const [orders, setOrders] = useState<OrderWithMessages[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [platformMessages, setPlatformMessages] = useState<any[]>([]);
    const [allTenants, setAllTenants] = useState<any[]>([]);
    const [sectionsOpen, setSectionsOpen] = useState({ orders: true, support: true });
    const [searchParams] = useSearchParams();
    const [supportInput, setSupportInput] = useState('');
    const [isMaster, setIsMaster] = useState(false);
    const [myTenantId, setMyTenantId] = useState<string | null>(null);
    const orderMessagesEndRef = useRef<HTMLDivElement | null>(null);
    const supportMessagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const orderId = searchParams.get('orderId');
        const tenantId = searchParams.get('tenantId');

        if (orderId) {
            setSelectedOrderId(orderId);
            setSelectedTenantId(null);
        }
        if (tenantId) {
            setSelectedTenantId(tenantId);
            setSelectedOrderId(null);
        }
    }, [searchParams]);

    useEffect(() => {
        checkRole();
        fetchOrdersWithMessages();
        if (isMaster) {
            fetchAllTenants();
        }
    }, [isMaster]);

    const fetchAllTenants = async () => {
        try {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('id, name')
                .order('name');
            if (error) throw error;
            setAllTenants(data || []);
        } catch (e) {
            console.error('Error fetching all tenants:', e);
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;

        fetchPlatformMessages();
        markSupportMessagesAsRead();

        interval = setInterval(() => {
            fetchPlatformMessages();
            markSupportMessagesAsRead();
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedTenantId, isMaster, myTenantId]);

    const markSupportMessagesAsRead = async () => {
        try {
            const targetSenderRole = isMaster ? 'tenant' : 'master';

            // Update all unread messages sent BY the other party
            let query = supabase
                .from('platform_messages' as any)
                .update({ is_read: true })
                .eq('sender_role', targetSenderRole)
                .eq('is_read', false);

            if (isMaster && selectedTenantId) {
                query = query.eq('tenant_id', selectedTenantId);
            } else if (!isMaster && myTenantId) {
                query = query.eq('tenant_id', myTenantId);
            } else if (isMaster && !selectedTenantId) {
                // If master but no tenant selected, don't mark anything as read
                return;
            }

            await query;
        } catch (e) {
            console.error("Failed to mark support messages as read", e);
        }
    };

    const checkRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if I am master
        const { data: masterTenant } = await supabase
            .from('tenants' as any)
            .select('id')
            .eq('id', '00000000-0000-0000-0000-000000000000')
            .eq('owner_id', user.id)
            .maybeSingle();

        setIsMaster(!!masterTenant);

        if (!masterTenant) {
            // First check user_roles (works for both owners and staff)
            const { data: roleData } = await supabase
                .from('user_roles' as any)
                .select('tenant_id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (roleData && (roleData as any).tenant_id) {
                setMyTenantId((roleData as any).tenant_id);
            } else {
                // Fallback: Check if owner directly (if user_roles missing for some reason)
                const { data: myTenant } = await supabase
                    .from('tenants' as any)
                    .select('id')
                    .eq('owner_id', user.id)
                    .maybeSingle();

                if (myTenant) setMyTenantId((myTenant as any).id);
            }
        }
    };

    const fetchPlatformMessages = async () => {
        try {
            let query = supabase
                .from('platform_messages' as any)
                .select(`
                    *,
                    tenants (name)
                `)
                .order('created_at', { ascending: true });

            if (!isMaster && myTenantId) {
                query = query.eq('tenant_id', myTenantId);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }
            setPlatformMessages(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const sendSupportMessage = async () => {
        if (!supportInput.trim()) return;
        setSending(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            // Determine tenant_id target
            let targetTenantId = isMaster ? selectedTenantId : myTenantId;

            if (!targetTenantId && isMaster && platformMessages.length > 0) {
                // Fallback: Find last message from a tenant (not master)
                const lastTenantMsg = [...platformMessages].reverse().find(m => m.sender_role === 'tenant');
                if (lastTenantMsg) {
                    targetTenantId = lastTenantMsg.tenant_id;
                }
            }

            if (!targetTenantId) {
                if (isMaster) {
                    toast.error("Fejl: Ingen aktiv samtale valgt at svare på.");
                } else {
                    toast.error("Fejl: Kunne ikke identificere din shop.");
                }
                setSending(false);
                return;
            }

            // If master, we need to know WHICH tenant we are replying to. 
            // Ideally we select a conversation first. 
            // For MVP simplification: If Tenant -> Send to self. If Master -> This logic needs a 'selectedThread'.
            // Let's assume Master selects a tenant from the list.

            // Refined Logic for Master:
            // We need to group platform messages by Tenant ID just like orders.

            const { error } = await supabase.from('platform_messages' as any).insert({
                tenant_id: targetTenantId, // TODO: Fix for master reply
                content: supportInput,
                sender_role: isMaster ? 'master' : 'tenant',
                sender_user_id: user?.id
            });

            if (error) {
                console.error("Supabase Insert Error:", error);
                throw error;
            }

            toast.success('Besked sendt til support!');
            setSupportInput('');
            fetchPlatformMessages();
        } catch (e: any) {
            console.error("Catch Error:", e);
            toast.error(`Kunne ikke sende besked: ${e.message || 'Ukendt fejl'}`);
        } finally {
            setSending(false);
        }
    };

    const fetchOrdersWithMessages = async () => {
        try {
            // First get all messages grouped by order
            // First get all messages grouped by order
            const { data: messagesData, error: messagesError } = await supabase
                .from('order_messages' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (messagesError) throw messagesError;

            const messages = messagesData as any[];

            // Get unique order IDs
            const orderIds = [...new Set(messages.map((m: any) => m.order_id))];

            if (orderIds.length === 0) {
                setOrders([]);
                setLoading(false);
                return;
            }

            // Fetch order details
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders' as any)
                .select('id, order_number, product_name, user_id')
                .in('id', orderIds);

            if (ordersError) throw ordersError;

            // Fetch customer profiles
            const userIds = [...new Set((ordersData as any[])?.map(o => o.user_id) || [])];
            const { data: profiles } = await (supabase as any)
                .from('profiles')
                .select('id, first_name, last_name')
                .in('id', userIds);

            // Get user emails from auth
            const { data: authData } = await supabase.auth.admin?.listUsers?.() || { data: null };

            // Group messages by order
            const ordersWithMessages: OrderWithMessages[] = (ordersData as any[])?.map(order => {
                const orderMessages = (messages as Message[])?.filter(m => m.order_id === order.id) || [];
                const profile = (profiles as any[])?.find(p => p.id === order.user_id);
                const customerName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Ukendt';

                return {
                    order_id: order.id,
                    order_number: order.order_number,
                    product_name: order.product_name,
                    customer_email: '', // Will be filled if needed
                    customer_name: customerName || 'Kunde',
                    messages: orderMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
                    unread_count: orderMessages.filter(m => m.sender_type === 'customer' && !m.is_read).length,
                    last_message_at: orderMessages[0]?.created_at || order.created_at,
                };
            }).sort((a, b) => {
                // Sort by unread count first, then by last message date
                if (a.unread_count !== b.unread_count) {
                    return b.unread_count - a.unread_count;
                }
                return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
            }) || [];

            setOrders(ordersWithMessages);
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Kunne ikke hente beskeder');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOrder = async (orderId: string) => {
        setSelectedOrderId(orderId);

        // Mark messages as read
        try {
            await supabase
                .from('order_messages' as any)
                .update({ is_read: true })
                .eq('order_id', orderId)
                .eq('sender_type', 'customer');

            // Update local state
            setOrders(prev => prev.map(o =>
                o.order_id === orderId
                    ? { ...o, unread_count: 0, messages: o.messages.map(m => ({ ...m, is_read: true })) }
                    : o
            ));
        } catch (e) {
            // Silently handle - not critical if marking as read fails
        }
    };

    const handleSendMessage = async () => {
        if (!selectedOrderId || !newMessage.trim()) return;

        setSending(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase.from('order_messages' as any).insert({
                order_id: selectedOrderId,
                sender_id: user?.id,
                sender_type: 'admin',
                content: newMessage.trim(),
                is_read: false,
            });

            if (error) throw error;

            toast.success('Besked sendt!');
            setNewMessage('');

            // Refresh messages
            fetchOrdersWithMessages();
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Kunne ikke sende besked');
        } finally {
            setSending(false);
        }
    };

    const formatMessageTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return format(date, 'HH:mm', { locale: da });
        } else if (diffDays === 1) {
            return 'I går ' + format(date, 'HH:mm', { locale: da });
        } else if (diffDays < 7) {
            return format(date, 'EEEE HH:mm', { locale: da });
        }
        return format(date, 'd. MMM HH:mm', { locale: da });
    };

    const selectedOrder = orders.find(o => o.order_id === selectedOrderId);

    const filteredOrders = orders.filter(order =>
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleSection = (section: 'orders' | 'support') => {
        setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleSelectTenant = (id: string) => {
        setSelectedTenantId(id);
        setSelectedOrderId(null);
    };

    const handleSelectOrderLocal = (id: string) => {
        handleSelectOrder(id);
        setSelectedTenantId(null);
    };

    const activeView = selectedOrderId ? 'order' : (selectedTenantId ? 'support' : 'selection');
    const platformThreadMessages = isMaster
        ? platformMessages.filter(m => m.tenant_id === selectedTenantId)
        : platformMessages;

    useEffect(() => {
        if (activeView !== 'order') return;
        if (!selectedOrder || !selectedOrder.messages.length) return;
        orderMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [activeView, selectedOrderId, selectedOrder?.messages.length]);

    useEffect(() => {
        if (activeView !== 'support') return;
        if (!platformThreadMessages.length) return;
        supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [activeView, selectedTenantId, platformThreadMessages.length]);

    const supportThreads = Object.values(
        platformMessages.reduce((acc: any, msg: any) => {
            const tid = msg.tenant_id;
            if (!acc[tid]) {
                acc[tid] = {
                    tenant_id: tid,
                    tenant_name: msg.tenants?.name || 'Ukendt Shop',
                    last_message: msg.content,
                    last_message_at: msg.created_at,
                    unread_count: 0
                };
            }
            if (msg.sender_role === 'tenant' && !msg.is_read) {
                acc[tid].unread_count++;
            }
            if (new Date(msg.created_at) >= new Date(acc[tid].last_message_at)) {
                acc[tid].last_message = msg.content;
                acc[tid].last_message_at = msg.created_at;
            }
            return acc;
        }, {})
    ).sort((a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Beskeder</h1>
                <p className="text-muted-foreground">Kommuniker med kunder og support</p>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <Card className="lg:col-span-1 flex flex-col min-h-0 overflow-hidden">
                    <CardHeader className="pb-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Søg i beskeder..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-2 space-y-4">
                        {/* Support Section */}
                        <div className="space-y-1">
                            <button
                                onClick={() => toggleSection('support')}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:bg-muted/50 rounded-md transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <LifeBuoy className="h-3.5 w-3.5" />
                                    {isMaster ? 'Shop Support' : 'Support'}
                                </span>
                                {sectionsOpen.support ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>

                            {sectionsOpen.support && (
                                <div className="space-y-1 mt-1">
                                    {isMaster ? (
                                        supportThreads.length === 0 ? (
                                            <p className="text-[10px] text-center py-4 text-muted-foreground opacity-50">Ingen aktive samtaler</p>
                                        ) : (
                                            supportThreads.map((thread: any) => (
                                                <button
                                                    key={thread.tenant_id}
                                                    onClick={() => handleSelectTenant(thread.tenant_id)}
                                                    className={cn(
                                                        "w-full text-left p-2.5 rounded-lg transition-all border border-transparent",
                                                        selectedTenantId === thread.tenant_id
                                                            ? "bg-primary text-primary-foreground shadow-md"
                                                            : "hover:bg-muted"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="font-semibold text-sm truncate">{thread.tenant_name}</span>
                                                        {thread.unread_count > 0 && (
                                                            <Badge className="bg-red-500 text-white h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px]">
                                                                {thread.unread_count}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className={cn(
                                                        "text-[10px] truncate opacity-80",
                                                        selectedTenantId === thread.tenant_id ? "text-primary-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {thread.last_message}
                                                    </p>
                                                </button>
                                            ))
                                        )
                                    ) : (
                                        <button
                                            onClick={() => handleSelectTenant(myTenantId || '')}
                                            className={cn(
                                                "w-full text-left p-2.5 rounded-lg transition-all border border-transparent",
                                                selectedTenantId === myTenantId
                                                    ? "bg-primary text-primary-foreground shadow-md"
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <LifeBuoy className="h-4 w-4" />
                                                <span className="font-semibold text-sm">Kontakt Support</span>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Orders Section */}
                        <div className="space-y-1">
                            <button
                                onClick={() => toggleSection('orders')}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:bg-muted/50 rounded-md transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Package className="h-3.5 w-3.5" />
                                    Kunder & Ordrer
                                </span>
                                {sectionsOpen.orders ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>

                            {sectionsOpen.orders && (
                                <div className="space-y-1 mt-1">
                                    {filteredOrders.length === 0 ? (
                                        <p className="text-[10px] text-center py-4 text-muted-foreground opacity-50">Ingen beskeder endnu</p>
                                    ) : (
                                        filteredOrders.map((order) => (
                                            <button
                                                key={order.order_id}
                                                onClick={() => handleSelectOrderLocal(order.order_id)}
                                                className={cn(
                                                    "w-full text-left p-2.5 rounded-lg transition-all border border-transparent",
                                                    selectedOrderId === order.order_id
                                                        ? "bg-primary text-primary-foreground shadow-md"
                                                        : "hover:bg-muted"
                                                )}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-sm truncate">
                                                                {order.customer_name}
                                                            </p>
                                                            {order.unread_count > 0 && (
                                                                <Badge className="bg-red-500 text-white h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px]">
                                                                    {order.unread_count}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className={cn(
                                                            "text-[10px] truncate",
                                                            selectedOrderId === order.order_id ? "text-primary-foreground/70" : "text-muted-foreground"
                                                        )}>
                                                            #{order.order_number} - {order.product_name}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Main View Area */}
                <Card className="lg:col-span-3 flex flex-col min-h-0 overflow-hidden">
                    {activeView === 'order' && selectedOrder ? (
                        <>
                            <CardHeader className="border-b px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-primary/10 p-2 rounded-full">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">{selectedOrder.customer_name}</CardTitle>
                                            <CardDescription className="flex items-center gap-2">
                                                <Package className="h-3.5 w-3.5" />
                                                Ordre #{selectedOrder.order_number} - {selectedOrder.product_name}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={`/admin/kunder`}>Se ordre</a>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5">
                                {selectedOrder.messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "max-w-[75%] p-4 rounded-2xl shadow-sm",
                                            msg.sender_type === 'admin'
                                                ? "bg-primary text-primary-foreground ml-auto rounded-tr-none"
                                                : "bg-card border mr-auto rounded-tl-none"
                                        )}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        <div className={cn(
                                            "flex items-center gap-1 mt-2 text-[10px]",
                                            msg.sender_type === 'admin' ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"
                                        )}>
                                            <Clock className="h-3 w-3" />
                                            {formatMessageTime(msg.created_at)}
                                            {msg.sender_type === 'admin' && (
                                                <CheckCheck className={cn(
                                                    "h-3 w-3 ml-1",
                                                    msg.is_read ? "text-blue-300" : "text-gray-400"
                                                )} />
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={orderMessagesEndRef} className="h-1" />
                            </CardContent>
                            <div className="p-4 border-t bg-card">
                                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                    <Textarea
                                        placeholder="Skriv dit svar her..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="flex-1 min-h-[44px] max-h-[200px] resize-none border-none bg-muted/40 focus-visible:ring-1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={sending || !newMessage.trim()}
                                        size="icon"
                                        className="h-11 w-11 shrink-0 rounded-full"
                                    >
                                        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : activeView === 'support' && (selectedTenantId || !isMaster) ? (
                        <>
                            <CardHeader className="border-b px-6 py-4">
                                <div className="flex items-center gap-4">
                                    <div className="bg-primary/10 p-2 rounded-full">
                                        <LifeBuoy className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">
                                            {isMaster ? (
                                                platformMessages.find(m => m.tenant_id === selectedTenantId)?.tenants?.name || 'Shop Support'
                                            ) : (
                                                'Support Samtale'
                                            )}
                                        </CardTitle>
                                        <CardDescription>
                                            {isMaster ? 'Direkte dialog med shop ejeren' : 'Kontakt vores support team'}
                                        </CardDescription>
                                    </div>
                                    {isMaster && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedTenantId(null)}
                                            className="ml-auto text-muted-foreground hover:text-primary"
                                        >
                                            Skift Shop
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5">
                                {platformThreadMessages.map(msg => (
                                    <div key={msg.id} className={cn(
                                        "max-w-[75%] p-4 rounded-2xl shadow-sm",
                                        (msg.sender_role === 'tenant' && !isMaster) || (msg.sender_role === 'master' && isMaster)
                                            ? "bg-primary text-primary-foreground ml-auto rounded-tr-none"
                                            : "bg-card border mr-auto rounded-tl-none"
                                    )}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        <div className={cn(
                                            "flex items-center gap-1 mt-2 text-[10px] opacity-70",
                                            (msg.sender_role === 'tenant' && !isMaster) || (msg.sender_role === 'master' && isMaster) ? "justify-end" : ""
                                        )}>
                                            <Clock className="h-3 w-3" />
                                            {formatMessageTime(msg.created_at)}
                                            {isMaster && msg.sender_role === 'tenant' && (
                                                <span className="ml-1 border-l pl-1">fra Shop</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {platformThreadMessages.length === 0 && (
                                    <div className="text-center text-muted-foreground py-20">
                                        <LifeBuoy className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                        <p className="text-lg font-medium opacity-50">Ingen beskeder endnu</p>
                                        <p className="text-sm opacity-40">Skriv den første besked nedenfor for at starte samtalen</p>
                                    </div>
                                )}
                                <div ref={supportMessagesEndRef} className="h-1" />
                            </CardContent>
                            <div className="p-4 border-t bg-card">
                                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                    <Textarea
                                        value={supportInput}
                                        onChange={e => setSupportInput(e.target.value)}
                                        placeholder={isMaster ? "Skriv svar til tenant..." : "Skriv til support..."}
                                        className="flex-1 min-h-[44px] max-h-[200px] resize-none border-none bg-muted/40 focus-visible:ring-1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendSupportMessage();
                                            }
                                        }}
                                    />
                                    <Button
                                        onClick={sendSupportMessage}
                                        disabled={sending || !supportInput.trim()}
                                        size="icon"
                                        className="h-11 w-11 shrink-0 rounded-full"
                                    >
                                        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-muted/5">
                            {isMaster && activeView === 'selection' ? (
                                <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="mb-10 text-center">
                                        <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                            <Users className="h-10 w-10 text-primary" />
                                        </div>
                                        <h2 className="text-3xl font-bold tracking-tight mb-2">Vælg en shop at kontakte</h2>
                                        <p className="text-lg text-muted-foreground">Her kan du starte eller fortsætte en dialog med dine lejere</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {allTenants.map(tenant => (
                                            <button
                                                key={tenant.id}
                                                onClick={() => handleSelectTenant(tenant.id)}
                                                className="flex items-center justify-between p-5 rounded-2xl border bg-card hover:bg-accent hover:border-primary/50 transition-all group text-left shadow-sm hover:shadow-md"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-lg">{tenant.name}</span>
                                                    {tenant.domain && (
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                                            <Globe className="h-3.5 w-3.5" />
                                                            {tenant.domain}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="bg-primary/5 group-hover:bg-primary/15 p-3 rounded-xl transition-colors">
                                                    <MessageCircle className="h-5 w-5 text-primary" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-md animate-in fade-in zoom-in duration-500">
                                    <div className="bg-muted/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <MessageCircle className="h-12 w-12 text-muted-foreground opacity-40" />
                                    </div>
                                    <h3 className="text-2xl font-semibold mb-2">Vælg en samtale</h3>
                                    <p className="text-muted-foreground">
                                        Vælg en kunde eller en support-tråd fra menuen til venstre for at se beskeder
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
