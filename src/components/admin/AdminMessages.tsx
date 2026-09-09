import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircle, Send, User, Clock, CheckCheck, Search, Package, LifeBuoy, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link, useSearchParams } from 'react-router-dom';
import { resolveAdminTenant } from '@/lib/adminTenant';
import { OrderStatus, WorkspaceDate, orderDate, useOrderWorkspaceLink } from './workspace/orderPresentation';
import { markSupportConversationRead } from './workspace/supportReadReceipts';
import { loadSupportMessages, loadSupportTenants, resolveSupportWorkspace, sendSupportConversationMessage, supportConversationTarget } from './workspace/supportWorkspace';
import './workspace/orderWorkspace.css';
import { Plus, Users, Globe, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const PLATFORM_LEAD_PREFIX = '[PLATFORM LEAD]';

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
    status: string;
    quantity: number;
    created_at: string;
    estimated_delivery: string | null;
    product_configuration: string | null;
    messages: Message[];
    unread_count: number;
    last_message_at: string;
}

interface ParsedPlatformLead {
    id: string;
    subject: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    hostname: string | null;
    pathname: string | null;
    message: string;
    createdAt: string;
    isRead: boolean;
}

const isPlatformLeadMessage = (msg: any) =>
    typeof msg?.content === 'string' && msg.content.startsWith(PLATFORM_LEAD_PREFIX);

const readLeadField = (lines: string[], label: string) => {
    const prefix = `${label}:`;
    return lines.find(line => line.startsWith(prefix))?.slice(prefix.length).trim() || null;
};

const parsePlatformLeadMessage = (msg: any): ParsedPlatformLead => {
    const content = String(msg?.content || '');
    const lines = content.split('\n');
    const blankIndex = lines.findIndex(line => line.trim() === '');
    const detailLines = blankIndex >= 0 ? lines.slice(0, blankIndex) : lines;
    const message = blankIndex >= 0 ? lines.slice(blankIndex + 1).join('\n').trim() : '';

    return {
        id: String(msg?.id || ''),
        subject: lines[0]?.replace(PLATFORM_LEAD_PREFIX, '').trim() || 'Platformhenvendelse',
        name: readLeadField(detailLines, 'Navn'),
        email: readLeadField(detailLines, 'Email'),
        phone: readLeadField(detailLines, 'Telefon'),
        company: readLeadField(detailLines, 'Virksomhed'),
        hostname: readLeadField(detailLines, 'Hostname'),
        pathname: readLeadField(detailLines, 'Side'),
        message,
        createdAt: String(msg?.created_at || ''),
        isRead: Boolean(msg?.is_read),
    };
};

export default function AdminMessages() {
    const [searchParams] = useSearchParams();
    // A workspace change clears its data, selection and drafts before the next render.
    return <AdminMessagesWorkspace key={searchParams.get('force_domain') || ''} />;
}

function AdminMessagesWorkspace() {
    const [orders, setOrders] = useState<OrderWithMessages[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [platformMessages, setPlatformMessages] = useState<any[]>([]);
    const [allTenants, setAllTenants] = useState<any[]>([]);
    const workspaceLink = useOrderWorkspaceLink();
    const [inboxSection, setInboxSection] = useState<'customers' | 'support'>('customers');
    const [conversationFilter, setConversationFilter] = useState('all');
    const [loadError, setLoadError] = useState(false);
    const [supportError, setSupportError] = useState(false);
    const [roleReady, setRoleReady] = useState(false);
    const [searchParams] = useSearchParams();
    const [supportInput, setSupportInput] = useState('');
    const [isMaster, setIsMaster] = useState(false);
    const [myTenantId, setMyTenantId] = useState<string | null>(null);
    const [contextError, setContextError] = useState(false);
    const activeWorkspace = useRef(true);
    const supportFetchVersion = useRef(0);
    const ordersFetchVersion = useRef(0);
    const orderMessagesEndRef = useRef<HTMLDivElement | null>(null);
    const supportMessagesEndRef = useRef<HTMLDivElement | null>(null);
    const orderComposer = useRef({ orderId: selectedOrderId, text: newMessage });
    const supportComposer = useRef({ tenantId: isMaster ? selectedTenantId : myTenantId, text: supportInput });
    orderComposer.current = { orderId: selectedOrderId, text: newMessage };
    supportComposer.current = { tenantId: isMaster ? selectedTenantId : myTenantId, text: supportInput };

    useLayoutEffect(() => {
        activeWorkspace.current = true;
        return () => { activeWorkspace.current = false; };
    }, []);

    useEffect(() => {
        const orderId = searchParams.get('orderId');
        const tenantId = searchParams.get('tenantId');

        if (orderId) {
            setInboxSection('customers');
            setSelectedOrderId(orderId);
            setSelectedTenantId(null);
        }
        if (tenantId) {
            setInboxSection('support');
            setSelectedTenantId(isMaster ? tenantId : null);
            setSelectedOrderId(null);
        }
    }, [searchParams, isMaster]);

    useEffect(() => { void checkRole(); }, [searchParams.get('force_domain')]);
    useEffect(() => {
        void fetchOrdersWithMessages();
    }, [searchParams.get('force_domain'), searchParams.get('orderId')]);
    useEffect(() => { if (roleReady && isMaster) void fetchAllTenants(); }, [roleReady, isMaster]);

    const fetchAllTenants = async () => {
        try {
            const data = await loadSupportTenants(supabase as any, { roleReady, isMaster, myTenantId }, () => activeWorkspace.current);
            if (data) setAllTenants(data);
        } catch (e) {
            console.error('Error fetching all tenants:', e);
        }
    };

    useEffect(() => {
        if (!roleReady) return;
        void fetchPlatformMessages();
        if (inboxSection === 'support') void markSupportMessagesAsRead();
        const interval = setInterval(() => {
            void fetchPlatformMessages();
            if (inboxSection === 'support') void markSupportMessagesAsRead();
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedTenantId, isMaster, myTenantId, roleReady, inboxSection]);

    const markSupportMessagesAsRead = async () => {
        if (!activeWorkspace.current) return;
        try {
            await markSupportConversationRead(supabase as any, { roleReady, isMaster, selectedTenantId, myTenantId });
        } catch (e) {
            console.error("Failed to mark support messages as read", e);
        }
    };

    const checkRole = async () => {
        setRoleReady(false);
        setContextError(false);
        try {
            const context = resolveSupportWorkspace(await resolveAdminTenant());
            if (!activeWorkspace.current) return;
            setIsMaster(context.isMaster);
            setMyTenantId(context.myTenantId);
            setRoleReady(context.roleReady);
            setContextError(!context.roleReady);
        } catch (error) {
            if (!activeWorkspace.current) return;
            console.error('Could not resolve message workspace:', error);
            setContextError(true);
        }
    };

    const fetchPlatformMessages = async () => {
        const version = ++supportFetchVersion.current;
        const isCurrent = () => activeWorkspace.current && supportFetchVersion.current === version;
        try {
            const messages = await loadSupportMessages(supabase as any, { roleReady, isMaster, myTenantId }, isCurrent);
            if (!messages || !isCurrent()) return;
            setPlatformMessages(messages);
            setSupportError(false);
        } catch (e) {
            if (!isCurrent()) return;
            console.error(e);
            setSupportError(true);
        }
    };

    const sendSupportMessage = async () => {
        const context = { roleReady, isMaster, myTenantId, selectedTenantId };
        const targetTenantId = supportConversationTarget(context);
        if (!targetTenantId || !supportInput.trim() || sending || !activeWorkspace.current) return;
        const sentDraft = supportInput;
        setSending(true);
        try {
            const result = await sendSupportConversationMessage(supabase as any, context, sentDraft,
                platformMessages.some(isPlatformLeadMessage), () => activeWorkspace.current);
            if (result !== 'sent' || !activeWorkspace.current) return;
            toast.success('Besked sendt til support!');
            if (supportComposer.current.tenantId === targetTenantId && supportComposer.current.text === sentDraft) {
                setSupportInput('');
            }
            fetchPlatformMessages();
        } catch (e: any) {
            if (!activeWorkspace.current) return;
            console.error("Catch Error:", e);
            toast.error(`Kunne ikke sende besked: ${e.message || 'Ukendt fejl'}`);
        } finally {
            if (activeWorkspace.current) setSending(false);
        }
    };

    const fetchOrdersWithMessages = async () => {
        const version = ++ordersFetchVersion.current;
        const isCurrent = () => activeWorkspace.current && ordersFetchVersion.current === version;
        setLoadError(false);
        try {
            const { tenantId } = await resolveAdminTenant();
            if (!isCurrent()) return;
            if (!tenantId) throw new Error('Ingen aktiv shop');
            const tenantOrders: any[] = [];
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase.from('orders' as any)
                    .select('id, order_number, product_name, product_configuration, customer_name, customer_email, status, quantity, created_at, estimated_delivery')
                    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).order('id', { ascending: false })
                    .range(offset, offset + 499);
                if (!isCurrent()) return;
                if (error) throw error;
                const page = (data || []) as any[];
                tenantOrders.push(...page);
                if (page.length < 500) break;
            }
            const messages: Message[] = [];
            // Query only IDs from the active tenant; batch to keep request URLs bounded.
            for (let index = 0; index < tenantOrders.length; index += 100) {
                const orderIds = tenantOrders.slice(index, index + 100).map(order => order.id);
                for (let offset = 0; ; offset += 500) {
                    const { data, error } = await supabase.from('order_messages' as any).select('*')
                        .in('order_id', orderIds).order('created_at', { ascending: false }).order('id', { ascending: false })
                        .range(offset, offset + 499);
                    if (!isCurrent()) return;
                    if (error) throw error;
                    const page = (data || []) as unknown as Message[];
                    messages.push(...page);
                    if (page.length < 500) break;
                }
            }
            const byOrder = new Map<string, Message[]>();
            for (const message of messages) {
                const list = byOrder.get(message.order_id) || [];
                list.push(message);
                byOrder.set(message.order_id, list);
            }
            const requestedOrderId = searchParams.get('orderId');
            const grouped: OrderWithMessages[] = tenantOrders.map(order => {
                const orderMessages = (byOrder.get(order.id) || [])
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                return {
                    ...order, order_id: order.id,
                    customer_name: order.customer_name || order.customer_email || 'Kunde',
                    customer_email: order.customer_email || '',
                    messages: orderMessages,
                    unread_count: orderMessages.filter(message => message.sender_type === 'customer' && !message.is_read).length,
                    last_message_at: orderMessages[orderMessages.length - 1]?.created_at || order.created_at,
                };
            }).filter(order => order.messages.length > 0 || order.order_id === requestedOrderId)
                .sort((a, b) => b.unread_count - a.unread_count || new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
            setOrders(grouped);
        } catch (error) {
            if (!isCurrent()) return;
            console.error('Error fetching messages:', error);
            setLoadError(true);
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };

    const handleSelectOrder = async (orderId: string) => {
        if (!roleReady || !activeWorkspace.current || !orders.some(order => order.order_id === orderId)) return;
        setSelectedOrderId(orderId);

        // Mark messages as read
        try {
            const { error } = await supabase
                .from('order_messages' as any)
                .update({ is_read: true })
                .eq('order_id', orderId)
                .eq('sender_type', 'customer');
            if (error) throw error;

            // Update local state
            setOrders(prev => prev.map(o =>
                o.order_id === orderId
                    ? { ...o, unread_count: 0, messages: o.messages.map(m => m.sender_type === 'customer' ? { ...m, is_read: true } : m) }
                    : o
            ));
        } catch (e) {
            console.debug('Could not mark messages as read');
        }
    };

    const handleSendMessage = async () => {
        if (!roleReady || !selectedOrderId || !orders.some(order => order.order_id === selectedOrderId) || !newMessage.trim() || sending || !activeWorkspace.current) return;

        const sentOrderId = selectedOrderId;
        const sentDraft = newMessage;
        setSending(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!activeWorkspace.current) return;

            const { error } = await supabase.from('order_messages' as any).insert({
                order_id: sentOrderId,
                sender_id: user?.id,
                sender_type: 'admin',
                content: sentDraft.trim(),
                is_read: false,
            });

            if (error) throw error;

            if (!activeWorkspace.current) return;

            toast.success('Besked sendt!');
            // Preserve a newer draft, including one started in a different conversation.
            if (orderComposer.current.orderId === sentOrderId && orderComposer.current.text === sentDraft) {
                setNewMessage('');
            }

            // Refresh messages
            fetchOrdersWithMessages();
        } catch (error) {
            if (!activeWorkspace.current) return;
            console.error('Error sending message:', error);
            toast.error('Kunne ikke sende besked');
        } finally {
            if (activeWorkspace.current) setSending(false);
        }
    };

    const formatMessageTime = (dateString: string) => {
        const date = new Date(dateString);
        if (!Number.isFinite(date.getTime())) return 'Ukendt tidspunkt';
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

    const filteredOrders = orders.filter(order => {
        const search = searchTerm.trim().toLowerCase();
        return (conversationFilter === 'all' || order.unread_count > 0) &&
            [order.order_number, order.customer_name, order.customer_email, order.product_name, ...order.messages.map(message => message.content)]
                .some(value => String(value || '').toLowerCase().includes(search));
    });

    const handleSelectTenant = (id: string) => {
        if (!roleReady || (!isMaster && id !== myTenantId)) return;
        setSelectedTenantId(id);
        setSelectedOrderId(null);
        setInboxSection('support');
        setSupportInput('');
    };

    const handleSelectOrderLocal = (id: string) => {
        handleSelectOrder(id);
        setSelectedTenantId(null);
        setInboxSection('customers');
        setNewMessage('');
    };

    const activeView = inboxSection === 'customers' ? (selectedOrderId ? 'order' : 'selection') : ((selectedTenantId || !isMaster) ? 'support' : 'selection');
    const platformThreadMessages = platformMessages.filter(m => m.tenant_id === (isMaster ? selectedTenantId : myTenantId));
    const selectedPlatformThreadHasLeads = platformThreadMessages.some((msg: any) =>
        isPlatformLeadMessage(msg)
    );
    const selectedPlatformLeads = platformThreadMessages
        .filter(isPlatformLeadMessage)
        .map(parsePlatformLeadMessage)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestPlatformLead = selectedPlatformLeads[0] || null;
    const unreadPlatformLeadCount = selectedPlatformLeads.filter(lead => !lead.isRead).length;
    const latestPlatformLeadMailto = latestPlatformLead?.email
        ? `mailto:${encodeURIComponent(latestPlatformLead.email)}?subject=${encodeURIComponent(`Svar fra Webprinter: ${latestPlatformLead.subject}`)}`
        : null;

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
                const isPlatformLeadThread = tid === MASTER_TENANT_ID
                    && isPlatformLeadMessage(msg);
                acc[tid] = {
                    tenant_id: tid,
                    is_platform_lead_thread: isPlatformLeadThread,
                    tenant_name: isPlatformLeadThread ? 'Platform henvendelser' : msg.tenants?.name || 'Ukendt Shop',
                    last_message: msg.content,
                    last_message_at: msg.created_at,
                    unread_count: 0,
                    lead_count: 0,
                    unread_lead_count: 0,
                };
            }
            if (tid === MASTER_TENANT_ID && isPlatformLeadMessage(msg)) {
                acc[tid].is_platform_lead_thread = true;
                acc[tid].tenant_name = 'Platform henvendelser';
                acc[tid].lead_count++;
                if (!msg.is_read) {
                    acc[tid].unread_lead_count++;
                }
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
    const filteredSupportThreads = (supportThreads as any[]).filter((thread: any) =>
        String(thread.tenant_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(thread.last_message || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).filter((thread: any) => conversationFilter === 'all' || thread.unread_count > 0);

    if (contextError) return <div className="ow-state" role="alert"><LifeBuoy /><p>Den aktive shop kunne ikke findes. Vælg en shop eller prøv igen.</p><Button onClick={() => { void checkRole(); void fetchOrdersWithMessages(); }}>Prøv igen</Button></div>;
    if (loading || !roleReady) return <div className="ow-state" role="status"><Loader2 className="animate-spin" /><p>Henter samtaler…</p></div>;

    return (
        <div className="ow-messages">
            <header className="ow-page-heading"><div><h1>Beskeder</h1><p>Hold styr på kundedialog og support.</p></div><WorkspaceDate /></header>
            <div className="ow-inbox-tabs" aria-label="Beskedområde">
                <button aria-pressed={inboxSection === 'customers'} aria-controls="workspace-inbox" onClick={() => setInboxSection('customers')}>Kunder{orders.some(order => order.unread_count > 0) && <span>{orders.reduce((sum, order) => sum + order.unread_count, 0)}</span>}</button>
                <button aria-pressed={inboxSection === 'support'} aria-controls="workspace-inbox" onClick={() => setInboxSection('support')}>Support</button>
            </div>
            <div className="ow-inbox-filterbar"><div className="ow-search"><Search aria-hidden="true" /><Input aria-label="Søg i beskeder" placeholder="Søg i beskeder" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></div><Select value={conversationFilter} onValueChange={setConversationFilter}><SelectTrigger aria-label="Filtrér samtaler"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle samtaler</SelectItem><SelectItem value="unread">Ulæste samtaler</SelectItem></SelectContent></Select></div>
            {(inboxSection === 'customers' ? loadError : supportError) && <div className="ow-inline-notice" role="alert">Beskederne kunne ikke opdateres.<button onClick={() => inboxSection === 'customers' ? fetchOrdersWithMessages() : fetchPlatformMessages()}>Prøv igen</button></div>}
            {selectedOrderId && !selectedOrder && !loadError && inboxSection === 'customers' && <div className="ow-inline-notice" role="status">Ordren blev ikke fundet i den valgte shop.<button onClick={() => setSelectedOrderId(null)}>Vis samtaler</button></div>}
            <div id="workspace-inbox" className={`ow-inbox-grid ${selectedOrder && activeView === 'order' ? 'ow-inbox-has-context' : ''} ${activeView !== 'selection' ? 'ow-inbox-selected' : ''}`}>
                <aside className="ow-conversations" aria-label="Samtaler">
                    {inboxSection === 'customers' ? <>
                        {filteredOrders.map(order => <button className={`ow-conversation ${selectedOrderId === order.order_id ? 'is-selected' : ''}`} key={order.order_id} aria-pressed={selectedOrderId === order.order_id} onClick={() => handleSelectOrderLocal(order.order_id)}>
                            <span className={`ow-conversation-dot ${order.unread_count ? 'is-unread' : ''}`} aria-label={order.unread_count ? `${order.unread_count} ulæste` : 'Læst'} /><span className="ow-conversation-content"><span className="ow-conversation-top"><strong>{order.customer_name}</strong><time>{formatMessageTime(order.last_message_at)}</time></span><span className="ow-conversation-order">{order.order_number} · {order.product_name}</span><span className="ow-conversation-snippet">{order.messages[order.messages.length - 1]?.content || 'Start en samtale om ordren'}</span></span>
                        </button>)}
                        {!filteredOrders.length && <div className="ow-empty ow-empty-compact"><MessageCircle /><h3>{searchTerm || conversationFilter !== 'all' ? 'Ingen samtaler matcher' : 'Ingen kundebeskeder endnu'}</h3><p>{searchTerm || conversationFilter !== 'all' ? 'Prøv en anden søgning eller vælg alle samtaler.' : 'Kundernes ordrebeskeder vises her.'}</p></div>}
                    </> : <>
                        {isMaster ? <>{filteredSupportThreads.map((thread: any) => <button key={thread.tenant_id} onClick={() => handleSelectTenant(thread.tenant_id)} className={`ow-conversation ${selectedTenantId === thread.tenant_id ? 'is-selected' : ''}`} aria-pressed={selectedTenantId === thread.tenant_id}><span className={`ow-conversation-dot ${thread.unread_count ? 'is-unread' : ''}`} /><span className="ow-conversation-content"><span className="ow-conversation-top"><strong>{thread.tenant_name}</strong><time>{formatMessageTime(thread.last_message_at)}</time></span>{thread.is_platform_lead_thread && <span className="ow-conversation-order">{thread.lead_count} henvendelser · {thread.unread_lead_count} ulæste</span>}<span className="ow-conversation-snippet">{thread.last_message}</span></span></button>)}<Button variant="ghost" className="ow-new-support" onClick={() => { setSelectedTenantId(null); setSelectedOrderId(null); }}><Plus className="h-4 w-4 mr-2" />Kontakt en shop</Button></> : <button className="ow-conversation" onClick={() => handleSelectTenant(myTenantId || '')} disabled={!myTenantId}><LifeBuoy className="h-5 w-5" /><span className="ow-conversation-content"><strong>Webprinter support</strong><span className="ow-conversation-snippet">Hjælp til din webshop</span></span></button>}
                    </>}
                </aside>

                {/* Main View Area */}
                <Card className="ow-chat-panel flex flex-col min-h-0 overflow-hidden">
                    <Button className="ow-inbox-back" variant="ghost" onClick={() => { setSelectedOrderId(null); setSelectedTenantId(null); }}><ArrowLeft className="h-4 w-4 mr-2" />Alle samtaler</Button>
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
                                                Ordre {selectedOrder.order_number} - {selectedOrder.product_name}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link to={workspaceLink(`/admin/kunder?orderId=${selectedOrder.order_id}`)}>Se ordre</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="ow-chat-messages flex-1 overflow-y-auto p-6 space-y-4">
                                {selectedOrder.messages.length === 0 && <div className="ow-empty"><MessageCircle /><h3>Start en samtale om ordren</h3><p>Din besked bliver tilgængelig for kunden på ordren.</p></div>}
                                {selectedOrder.messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "ow-chat-bubble",
                                            msg.sender_type === 'admin'
                                                ? "ow-chat-sent ml-auto"
                                                : "ow-chat-received mr-auto"
                                        )}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        <div className={cn(
                                            "flex items-center gap-1 mt-2 text-[10px]",
                                            msg.sender_type === 'admin' ? "text-muted-foreground justify-end" : "text-muted-foreground"
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
                            <div className="ow-chat-composer p-4 border-t bg-card">
                                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                    <Textarea
                                        aria-label="Skriv din besked til kunden" placeholder="Skriv din besked…"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="flex-1 min-h-[44px] max-h-[200px] resize-none border-none bg-muted/40 focus-visible:ring-1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={sending || !newMessage.trim()}
                                        className="ow-send-message"
                                    >
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span>Send besked</span>
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
                                                selectedPlatformThreadHasLeads
                                                    ? 'Platform henvendelser'
                                                    : platformMessages.find(m => m.tenant_id === selectedTenantId)?.tenants?.name || 'Shop Support'
                                            ) : (
                                                'Support Samtale'
                                            )}
                                        </CardTitle>
                                        <CardDescription>
                                            {isMaster
                                                ? selectedPlatformThreadHasLeads
                                                    ? 'Eksterne platformhenvendelser fra Webprinter-kontaktsiden'
                                                    : 'Direkte dialog med shop ejeren'
                                                : 'Kontakt vores support team'}
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
                            <CardContent className="ow-chat-messages flex-1 overflow-y-auto p-6 space-y-4">
                                {isMaster && selectedPlatformThreadHasLeads && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge className="bg-amber-600 text-white">Platformhenvendelse</Badge>
                                                    <Badge variant="outline" className="border-amber-300 bg-white/60 text-amber-900">
                                                        {selectedPlatformLeads.length} henvendelser
                                                    </Badge>
                                                    <Badge variant="outline" className="border-amber-300 bg-white/60 text-amber-900">
                                                        {unreadPlatformLeadCount} ulæste
                                                    </Badge>
                                                </div>
                                                <h3 className="mt-3 font-semibold">
                                                    {latestPlatformLead?.subject || 'Nyeste platformhenvendelse'}
                                                </h3>
                                                <p className="mt-1 text-sm leading-6">
                                                    {latestPlatformLead?.name || 'Ukendt navn'}
                                                    {latestPlatformLead?.company ? ` fra ${latestPlatformLead.company}` : ''}
                                                    {latestPlatformLead?.email ? ` · ${latestPlatformLead.email}` : ''}
                                                    {latestPlatformLead?.phone ? ` · ${latestPlatformLead.phone}` : ''}
                                                </p>
                                                <p className="mt-1 text-xs text-amber-800">
                                                    Seneste: {latestPlatformLead?.createdAt ? formatMessageTime(latestPlatformLead.createdAt) : 'ukendt'}
                                                    {latestPlatformLead?.hostname ? ` · ${latestPlatformLead.hostname}` : ''}
                                                    {latestPlatformLead?.pathname ? ` · ${latestPlatformLead.pathname}` : ''}
                                                </p>
                                            </div>
                                            {latestPlatformLeadMailto && (
                                                <Button asChild variant="outline" size="sm" className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
                                                    <a href={latestPlatformLeadMailto}>Svar via e-mail</a>
                                                </Button>
                                            )}
                                        </div>
                                        {latestPlatformLead?.message && (
                                            <p className="mt-3 line-clamp-3 rounded-lg bg-white/70 p-3 text-sm leading-6 text-amber-950">
                                                {latestPlatformLead.message}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {platformThreadMessages.map(msg => (
                                    <div key={msg.id} className={cn(
                                        "ow-chat-bubble",
                                        (msg.sender_role === 'tenant' && !isMaster) || (msg.sender_role === 'master' && isMaster)
                                            ? "ow-chat-sent ml-auto"
                                            : "ow-chat-received mr-auto"
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
                            <div className="ow-chat-composer p-4 border-t bg-card">
                                {isMaster && selectedPlatformThreadHasLeads ? (
                                    <div className="mx-auto max-w-4xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                                        Platformhenvendelser vises som en log fra kontaktsiden. Svar kunden via e-mail med knappen ovenfor.
                                    </div>
                                ) : (
                                    <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                        <Textarea
                                            value={supportInput}
                                            onChange={e => setSupportInput(e.target.value)}
                                            aria-label="Skriv en supportbesked" placeholder={isMaster ? "Skriv svar til shoppen…" : "Skriv til support…"}
                                            className="flex-1 min-h-[44px] max-h-[200px] resize-none border-none bg-muted/40 focus-visible:ring-1"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                                                    e.preventDefault();
                                                    sendSupportMessage();
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={sendSupportMessage}
                                            disabled={sending || !supportInput.trim()}
                                            className="ow-send-message"
                                        >
                                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span>Send besked</span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-muted/5">
                            {isMaster && inboxSection === 'support' && activeView === 'selection' ? (
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
                {selectedOrder && activeView === 'order' && <aside className="ow-conversation-context" aria-label="Ordre- og samtaledetaljer">
                    <Link className="ow-context-order-link" to={workspaceLink(`/admin/kunder?orderId=${selectedOrder.order_id}`)}>Ordre {selectedOrder.order_number}</Link><OrderStatus status={selectedOrder.status} />
                    <section><h3>Kunde</h3><p>{selectedOrder.customer_name}</p>{selectedOrder.customer_email && <a href={`mailto:${selectedOrder.customer_email}`}>{selectedOrder.customer_email}</a>}</section>
                    <section><h3>Ordredetaljer</h3><dl><div><dt>Produkt</dt><dd>{selectedOrder.product_name}</dd></div>{selectedOrder.product_configuration && <div><dt>Valg</dt><dd>{selectedOrder.product_configuration}</dd></div>}<div><dt>Antal</dt><dd>{selectedOrder.quantity} stk.</dd></div>{selectedOrder.estimated_delivery && <div><dt>Forventet levering</dt><dd>{orderDate(selectedOrder.estimated_delivery)}</dd></div>}</dl><Link to={workspaceLink(`/admin/kunder?orderId=${selectedOrder.order_id}`)}>Se ordre<ChevronRight className="h-4 w-4" /></Link></section>
                    <section><h3>Samtaledetaljer</h3><dl><div><dt>Beskeder</dt><dd>{selectedOrder.messages.length}</dd></div><div><dt>Seneste besked</dt><dd>{selectedOrder.messages.length ? orderDate(selectedOrder.last_message_at, true) : 'Ingen beskeder endnu'}</dd></div></dl></section>
                </aside>}
            </div>
        </div>
    );
}
