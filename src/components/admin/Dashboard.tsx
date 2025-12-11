
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
    ShoppingBag,
    Users,
    TrendingUp,
    CreditCard,
    ArrowRight,
    Package,
    ExternalLink
} from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";

export function Dashboard() {
    const navigate = useNavigate();
    const settings = useShopSettings();
    const [stats, setStats] = useState({
        revenue: 0,
        ordersCount: 0,
        customersCount: 0,
        pendingOrders: 0
    });

    // Mock data for the chart until we have real analytics
    const chartData = [
        { name: "Man", total: 1200 },
        { name: "Tir", total: 2100 },
        { name: "Ons", total: 1800 },
        { name: "Tor", total: 2400 },
        { name: "Fre", total: 3200 },
        { name: "Lør", total: 1500 },
        { name: "Søn", total: 1900 },
    ];

    useEffect(() => {
        // Determine tenant ID to fetch stats for
        const tenantId = settings.data?.id;
        if (tenantId) fetchStats(tenantId);
    }, [settings.data?.id]);

    const fetchStats = async (tenantId: string) => {
        try {
            // 1. Pending Orders
            const { count: pending } = await supabase
                .from('orders' as any)
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .eq('status', 'pending');

            // 2. Fetch all orders for revenue and count
            const { data: orders } = await supabase
                .from('orders' as any)
                .select('total_price, customer_email')
                .eq('tenant_id', tenantId);

            const realOrders = (orders || []) as any[];
            const totalRevenue = realOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);

            // Distinct Customers
            const uniqueCustomers = new Set(realOrders.map(o => o.customer_email)).size;

            setStats({
                revenue: totalRevenue,
                ordersCount: realOrders.length,
                customersCount: uniqueCustomers,
                pendingOrders: pending || 0
            });
        } catch (e) {
            console.error("Error fetching stats", e);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Hej, {settings.data?.tenant_name || "Shop Ejer"} 👋
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Her er overblikket over din forretning i dag.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => window.open('/shop', '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Se Shop
                    </Button>
                    <Button onClick={() => navigate('/admin/create-product')}>
                        <Package className="mr-2 h-4 w-4" />
                        Nyt Produkt
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Omsætning</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">128.500 kr.</div>
                        <p className="text-xs text-muted-foreground">
                            +20.1% fra sidste måned
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nye Ordrer</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.ordersCount}</div>
                        <p className="text-xs text-muted-foreground">
                            +12 siden i går
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktive Kunder</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.customersCount}</div>
                        <p className="text-xs text-muted-foreground">
                            +2 nye kunder i dag
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Afventer Handling</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.pendingOrders}</div>
                        <p className="text-xs text-muted-foreground">
                            Ordrer der skal behandles
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts & Activity */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Omsætning</CardTitle>
                        <CardDescription>
                            Dine indtjening de sidste 7 dage med sammenligning.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}
                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} kr`} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Hurtige Handlinger</CardTitle>
                        <CardDescription>
                            Kom godt i gang med dagens opgaver
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => navigate('/admin/create-product')}>
                            <div className="bg-primary/10 p-2 rounded-full mr-4">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">Opret Produkt</div>
                                <div className="text-xs text-muted-foreground">Tilføj en ny vare til shoppen</div>
                            </div>
                            <ArrowRight className="ml-auto h-4 w-4" />
                        </Button>

                        <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => navigate('/admin/branding')}>
                            <div className="bg-blue-100 p-2 rounded-full mr-4">
                                <ExternalLink className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">Design Shop</div>
                                <div className="text-xs text-muted-foreground">Ret logo og farver</div>
                            </div>
                            <ArrowRight className="ml-auto h-4 w-4" />
                        </Button>

                        <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => navigate('/admin/kunder')}>
                            <div className="bg-orange-100 p-2 rounded-full mr-4">
                                <ShoppingBag className="h-5 w-5 text-orange-600" />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">Se Ordrer</div>
                                <div className="text-xs text-muted-foreground">{stats.pendingOrders} ordrer venter</div>
                            </div>
                            <ArrowRight className="ml-auto h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
