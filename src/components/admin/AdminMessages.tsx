import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircle, Send, User, Clock, CheckCheck, Search, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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

    useEffect(() => {
        fetchOrdersWithMessages();
    }, []);

    const fetchOrdersWithMessages = async () => {
        try {
            // First get all messages grouped by order
            const { data: messages, error: messagesError } = await supabase
                .from('order_messages' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (messagesError) throw messagesError;

            // Get unique order IDs
            const orderIds = [...new Set((messages as Message[])?.map(m => m.order_id) || [])];

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
            console.debug('Could not mark messages as read');
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Beskeder</h1>
                <p className="text-muted-foreground">Kommuniker med kunder om deres ordrer</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
                {/* Conversation List */}
                <Card className="lg:col-span-1 flex flex-col">
                    <CardHeader className="pb-3">
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
                    <CardContent className="flex-1 overflow-y-auto p-2">
                        {filteredOrders.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Ingen beskeder endnu</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredOrders.map((order) => (
                                    <button
                                        key={order.order_id}
                                        onClick={() => handleSelectOrder(order.order_id)}
                                        className={cn(
                                            "w-full text-left p-3 rounded-lg transition-colors",
                                            selectedOrderId === order.order_id
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-muted"
                                        )}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium truncate">
                                                        {order.customer_name}
                                                    </p>
                                                    {order.unread_count > 0 && (
                                                        <Badge className="bg-red-500 text-white h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                                                            {order.unread_count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className={cn(
                                                    "text-xs truncate",
                                                    selectedOrderId === order.order_id ? "text-primary-foreground/70" : "text-muted-foreground"
                                                )}>
                                                    #{order.order_number} - {order.product_name}
                                                </p>
                                                {order.messages.length > 0 && (
                                                    <p className={cn(
                                                        "text-xs truncate mt-1",
                                                        selectedOrderId === order.order_id ? "text-primary-foreground/70" : "text-muted-foreground"
                                                    )}>
                                                        {order.messages[order.messages.length - 1].content.substring(0, 40)}...
                                                    </p>
                                                )}
                                            </div>
                                            <span className={cn(
                                                "text-xs whitespace-nowrap ml-2",
                                                selectedOrderId === order.order_id ? "text-primary-foreground/70" : "text-muted-foreground"
                                            )}>
                                                {formatMessageTime(order.last_message_at)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Message Thread */}
                <Card className="lg:col-span-2 flex flex-col">
                    {selectedOrder ? (
                        <>
                            <CardHeader className="border-b">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <User className="h-5 w-5" />
                                            {selectedOrder.customer_name}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            <Package className="h-3 w-3" />
                                            Ordre #{selectedOrder.order_number} - {selectedOrder.product_name}
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={`/admin/kunder`}>Se ordre</a>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                                {selectedOrder.messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "max-w-[80%] p-3 rounded-lg",
                                            msg.sender_type === 'admin'
                                                ? "bg-primary text-primary-foreground ml-auto"
                                                : "bg-muted mr-auto"
                                        )}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <div className={cn(
                                            "flex items-center gap-1 mt-1 text-xs",
                                            msg.sender_type === 'admin' ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
                                        )}>
                                            <Clock className="h-3 w-3" />
                                            {formatMessageTime(msg.created_at)}
                                            {msg.sender_type === 'admin' && (
                                                <CheckCheck className={cn(
                                                    "h-3 w-3 ml-1",
                                                    msg.is_read ? "text-blue-300" : "text-gray-300"
                                                )} />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                            <div className="p-4 border-t">
                                <div className="flex gap-2">
                                    <Textarea
                                        placeholder="Skriv et svar..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        rows={2}
                                        className="flex-1 resize-none"
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
                                        className="self-end"
                                    >
                                        {sending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">Vælg en samtale</p>
                                <p className="text-sm">Vælg en kunde fra listen for at se beskeder</p>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
