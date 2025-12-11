
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
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import { format, subDays, subMonths, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { da } from "date-fns/locale";

export function Dashboard() {
    const navigate = useNavigate();
    const settings = useShopSettings();
    const [rawOrders, setRawOrders] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
    const [stats, setStats] = useState({
        revenue: 0,
        ordersCount: 0,
        customersCount: 0,
        pendingOrders: 0
    });

    const [chartData, setChartData] = useState<{ name: string, total: number }[]>([]);

    useEffect(() => {
        // Determine tenant ID to fetch stats for
        const tenantId = settings.data?.id;
        if (tenantId) fetchStats(tenantId);
    }, [settings.data?.id]);

    useEffect(() => {
        // if (!rawOrders.length) return; // Removed this to allow rendering chart even with 0 orders

        const processData = () => {
            const now = new Date();
            let dataPoints: { name: string, total: number }[] = [];

            if (timeRange === 'week') {
                // Last 7 days
                dataPoints = Array.from({ length: 7 }, (_, i) => {
                    const d = subDays(now, 6 - i);
                    return { date: d, name: format(d, 'EEE', { locale: da }) };
                }).map(point => {
                    const total = rawOrders
                        .filter(o => isSameDay(new Date(o.created_at), point.date))
                        .reduce((sum, o) => sum + (o.total_price || 0), 0);
                    return { name: point.name.charAt(0).toUpperCase() + point.name.slice(1), total };
                });
            } else if (timeRange === 'month') {
                // Last 30 days
                dataPoints = Array.from({ length: 30 }, (_, i) => {
                    const d = subDays(now, 29 - i);
                    return { date: d, name: format(d, 'd/M', { locale: da }) };
                }).map(point => {
                    const total = rawOrders
                        .filter(o => isSameDay(new Date(o.created_at), point.date))
                        .reduce((sum, o) => sum + (o.total_price || 0), 0);
                    return { name: point.name, total };
                });
            } else if (timeRange === 'year') {
                // Last 12 months
                dataPoints = Array.from({ length: 12 }, (_, i) => {
                    const d = subMonths(now, 11 - i);
                    return { date: d, name: format(d, 'MMM yy', { locale: da }) };
                }).map(point => {
                    const total = rawOrders
                        .filter(o => isSameMonth(new Date(o.created_at), point.date))
                        .reduce((sum, o) => sum + (o.total_price || 0), 0);
                    return { name: point.name.charAt(0).toUpperCase() + point.name.slice(1), total };
                });
            }

            setChartData(dataPoints);
        };

        processData();
    }, [rawOrders, timeRange]);

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
                .select('created_at, total_price, customer_email') // Added created_at
                .eq('tenant_id', tenantId);

            const realOrders = (orders || []) as any[];
            setRawOrders(realOrders); // Store raw data

            const totalRevenue = realOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);

            // Distinct Customers
            const uniqueCustomers = new Set(realOrders.map(o => o.customer_email)).size;

            setStats({
                revenue: totalRevenue,
                ordersCount: realOrders.length,
                customersCount: uniqueCustomers,
                pendingOrders: pending || 0
            });

            // Initial chart data logic moved to useEffect
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
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(stats.revenue)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total omsætning i shoppen
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nye Ordrer</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.ordersCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Ordrer totalt
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktive Kunder</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.customersCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Unikke kunder
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
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Omsætning</CardTitle>
                            <CardDescription>
                                Dine indtjening over tid.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                            <Button
                                variant={timeRange === 'week' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setTimeRange('week')}
                            >
                                Uge
                            </Button>
                            <Button
                                variant={timeRange === 'month' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setTimeRange('month')}
                            >
                                Måned
                            </Button>
                            <Button
                                variant={timeRange === 'year' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setTimeRange('year')}
                            >
                                År
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}
                                    margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        angle={-45}
                                        textAnchor="end"
                                        dy={10} // Push text down a bit
                                        interval={timeRange === 'month' ? 3 : 0} // Less crowded month view
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value} kr`}
                                        domain={[0, (dataMax: number) => (dataMax === 0 || dataMax < 5000) ? 5000 : 'auto']}
                                        allowDataOverflow={false}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [`${value} kr`, 'Omsætning']}
                                        labelStyle={{ color: '#000' }}
                                        contentStyle={{ borderRadius: '8px' }}
                                    />
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
