import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Package, MapPin, LayoutDashboard, Clock, Truck, CheckCircle, AlertCircle, ArrowRight, Plus, Settings, MessageCircle, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Order {
    id: string;
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    status: string;
    created_at: string;
    unread_count?: number;
    has_replies?: boolean;
}

interface Address {
    id: string;
    label: string | null;
    first_name: string;
    last_name: string;
    street_address: string;
    postal_code: string;
    city: string;
    is_default: boolean;
}

interface ProfileData {
    first_name: string;
    last_name: string;
    phone: string;
    company: string;
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

const sidebarItems = [
    { path: '/min-konto', label: 'Oversigt', icon: LayoutDashboard, end: true },
    { path: '/min-konto/ordrer', label: 'Mine Ordrer', icon: Package },
    { path: '/min-konto/adresser', label: 'Leveringsadresser', icon: MapPin },
    { path: '/min-konto/indstillinger', label: 'Indstillinger', icon: Settings },
];

export default function MyAccount() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        totalSpent: 0,
    });

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/auth?redirect=/min-konto');
            return;
        }
        setUser(user);
        await Promise.all([
            fetchProfile(user.id),
            fetchOrders(user.id),
            fetchAddresses(user.id),
        ]);
        setLoading(false);
    };

    const fetchProfile = async (userId: string) => {
        try {
            const { data } = await (supabase as any)
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (data) {
                setProfile({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    phone: data.phone || '',
                    company: data.company || '',
                });
            }
        } catch (e) {
            console.debug('Profile not loaded');
        }
    };

    const fetchOrders = async (userId: string) => {
        try {
            const { data } = await supabase
                .from('orders' as any)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            let orders = (data as Order[]) || [];

            // Fetch message counts for orders
            if (orders.length > 0) {
                const orderIds = orders.map(o => o.id);
                const { data: messages } = await supabase
                    .from('order_messages' as any)
                    .select('order_id, sender_type, is_read')
                    .in('order_id', orderIds);

                if (messages) {
                    orders = orders.map(order => {
                        const orderMessages = (messages as any[]).filter(m => m.order_id === order.id);
                        const unreadCount = orderMessages.filter(m => m.sender_type === 'admin' && !m.is_read).length;
                        const hasReplies = orderMessages.some(m => m.sender_type === 'admin');
                        return { ...order, unread_count: unreadCount, has_replies: hasReplies };
                    });
                }
            }

            setRecentOrders(orders.slice(0, 5));

            // Calculate stats
            const totalOrders = orders.length;
            const pendingOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
            const totalSpent = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
            setStats({ totalOrders, pendingOrders, totalSpent });
        } catch (e) {
            console.debug('Orders not available');
        }
    };

    const fetchAddresses = async (userId: string) => {
        try {
            const { data } = await supabase
                .from('customer_addresses' as any)
                .select('*')
                .eq('user_id', userId)
                .order('is_default', { ascending: false });

            setAddresses((data as Address[]) || []);
        } catch (e) {
            console.debug('Addresses not available yet');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('da-DK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
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

    const defaultAddress = addresses.find(a => a.is_default);

    return (
        <div className="min-h-screen flex flex-col">
            <Header />

            <main className="flex-1 bg-background">
                <div className="container mx-auto px-4 py-8">
                    {/* Page Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold">
                            Velkommen{profile?.first_name ? `, ${profile.first_name}` : ''}!
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Her kan du se dine ordrer, administrere dine adresser og opdatere dine oplysninger.
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
                        <div className="flex-1 space-y-6">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total ordrer</p>
                                                <p className="text-3xl font-bold">{stats.totalOrders}</p>
                                            </div>
                                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Package className="h-6 w-6 text-primary" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Aktive ordrer</p>
                                                <p className="text-3xl font-bold">{stats.pendingOrders}</p>
                                            </div>
                                            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                                                <Clock className="h-6 w-6 text-yellow-600" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total forbrug</p>
                                                <p className="text-2xl font-bold">{formatPrice(stats.totalSpent)}</p>
                                            </div>
                                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                                                <CheckCircle className="h-6 w-6 text-green-600" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Recent Orders */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Package className="h-5 w-5" />
                                                Seneste Ordrer
                                            </CardTitle>
                                            <CardDescription>Dine seneste bestillinger</CardDescription>
                                        </div>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to="/min-konto/ordrer">
                                                Se alle
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {recentOrders.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                            <p>Du har ingen ordrer endnu</p>
                                            <Button variant="link" asChild className="mt-2">
                                                <Link to="/">Se produkter</Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {recentOrders.map((order) => {
                                                const status = statusConfig[order.status] || statusConfig.pending;
                                                const StatusIcon = status.icon;
                                                return (
                                                    <Link
                                                        key={order.id}
                                                        to="/min-konto/ordrer"
                                                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {/* iOS-style Message Icon */}
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-500 text-white flex-shrink-0">
                                                                        <MessageCircle className="h-4 w-4" />
                                                                        {/* Unread count badge */}
                                                                        {(order.unread_count || 0) > 0 && (
                                                                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border-2 border-white">
                                                                                {order.unread_count}
                                                                            </span>
                                                                        )}
                                                                        {/* Read receipt - blue checkmarks when replied and read */}
                                                                        {order.has_replies && !order.unread_count && (
                                                                            <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center bg-white rounded-full p-0.5">
                                                                                <CheckCheck className="h-2.5 w-2.5 text-blue-500" />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right" className="bg-gray-900 text-white border-0">
                                                                    <p className="font-medium text-xs">
                                                                        {(order.unread_count || 0) > 0
                                                                            ? `${order.unread_count} ny besked`
                                                                            : order.has_replies
                                                                                ? 'Svar modtaget'
                                                                                : 'Send besked'}
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <div>
                                                                <p className="font-medium text-sm">#{order.order_number}</p>
                                                                <p className="text-xs text-muted-foreground">{order.product_name}</p>
                                                                <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <Badge className={status.color}>
                                                                <StatusIcon className="h-3 w-3 mr-1" />
                                                                {status.label}
                                                            </Badge>
                                                            <p className="text-sm font-medium mt-1">{formatPrice(order.total_price)}</p>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Addresses Section */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <MapPin className="h-5 w-5" />
                                                Leveringsadresser
                                            </CardTitle>
                                            <CardDescription>Dine gemte adresser til hurtigere checkout</CardDescription>
                                        </div>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to="/min-konto/adresser">
                                                Administrer
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {addresses.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                            <p>Du har ingen gemte adresser endnu</p>
                                            <Button variant="link" asChild className="mt-2">
                                                <Link to="/min-konto/adresser">
                                                    <Plus className="h-4 w-4 mr-1" />
                                                    Tilføj adresse
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {addresses.slice(0, 2).map((address) => (
                                                <div
                                                    key={address.id}
                                                    className={cn(
                                                        "p-4 rounded-lg border transition-colors",
                                                        address.is_default && "border-primary bg-primary/5"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <p className="font-medium">
                                                            {address.label || 'Leveringsadresse'}
                                                        </p>
                                                        {address.is_default && (
                                                            <Badge variant="secondary">Standard</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {address.first_name} {address.last_name}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {address.street_address}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {address.postal_code} {address.city}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Quick Profile Info */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <User className="h-5 w-5" />
                                                Kontooplysninger
                                            </CardTitle>
                                            <CardDescription>Dine personlige oplysninger</CardDescription>
                                        </div>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to="/min-konto/indstillinger">
                                                Rediger
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Navn</p>
                                            <p className="font-medium">
                                                {profile?.first_name || profile?.last_name
                                                    ? `${profile.first_name} ${profile.last_name}`.trim()
                                                    : 'Ikke angivet'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Email</p>
                                            <p className="font-medium">{user?.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Telefon</p>
                                            <p className="font-medium">{profile?.phone || 'Ikke angivet'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Virksomhed</p>
                                            <p className="font-medium">{profile?.company || 'Ikke angivet'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
