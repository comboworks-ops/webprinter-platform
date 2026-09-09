
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { OrderStatus, WorkspaceDate, useOrderWorkspaceLink } from "./workspace/orderPresentation";
import "./workspace/orderWorkspace.css";
import {
    ArrowRight,
    Package,
    ChevronLeft,
    ChevronRight,
    FileText,
    Mail,
    Loader2,
    AlertCircle,
    Plus,
    Store
} from "lucide-react";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { dashboardContextQueryOptions } from "./workspace/dashboardContext";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import {
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    startOfWeek,
    endOfWeek,
    addWeeks,
    addMonths,
    addYears,
    startOfYear,
    endOfYear,
    eachMonthOfInterval,
    getYear
} from "date-fns";
import { da } from "date-fns/locale";

const EMPTY_ORDERS: any[] = [];

export function Dashboard() {
    const location = useLocation();
    const contextKey = new URLSearchParams(location.search).get("force_domain") || "default";
    const shopQuery = useQuery(dashboardContextQueryOptions(contextKey, {
        resolveTenant: resolveAdminTenant,
        readTenant: async (tenantId) => {
            const { data, error } = await (supabase as any).from('tenants')
                .select('id, name, settings')
                .eq('id', tenantId)
                .maybeSingle();
            return { data, error };
        },
    }));
    const workspaceLink = useOrderWorkspaceLink();
    const shop = shopQuery.isSuccess ? shopQuery.data : null;
    const tenantId = shop?.tenantId;
    const ordersQuery = useQuery({
        queryKey: ['workspace-dashboard-orders', tenantId],
        enabled: Boolean(tenantId),
        queryFn: async () => {
            const allOrders: any[] = [];
            // Read every page so the summary cannot silently stop at the API row limit.
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase.from('orders' as any)
                    .select('id, order_number, product_name, customer_name, customer_email, created_at, total_price, status, has_problem, requires_file_reupload')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false }).order('id', { ascending: false })
                    .range(offset, offset + 499);
                if (error) throw error;
                const page = (data || []) as any[];
                allOrders.push(...page);
                if (page.length < 500) return allOrders;
            }
        },
    });
    const rawOrders = ordersQuery.data || EMPTY_ORDERS;
    const loading = shopQuery.isPending || (Boolean(tenantId) && ordersQuery.isPending);
    const loadError = shopQuery.error || (tenantId ? ordersQuery.error : null);
    const stats = {
        revenue: rawOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0),
        ordersCount: rawOrders.length,
        customersCount: new Set(rawOrders.map(order => order.customer_email?.trim().toLowerCase()).filter(Boolean)).size,
        pendingOrders: rawOrders.filter(order => order.status === 'pending').length,
    };
    const problemOrders = rawOrders.filter(order => order.has_problem || order.status === 'problem');
    const attentionOrder = problemOrders[0] || rawOrders.find(order => order.status === 'pending');
    const attentionCount = problemOrders.length || stats.pendingOrders;
    const shopName = shop?.name || 'Din webshop';
    const logoUrl = shop?.logoUrl;
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    const greeting = hour < 10 ? 'Godmorgen.' : hour < 18 ? 'Goddag.' : 'Godaften.';
    const [analyticsOpen, setAnalyticsOpen] = useState(false);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
    const [currentDate, setCurrentDate] = useState(new Date()); // Anchor date for view
    const [chartData, setChartData] = useState<{ name: string, total: number }[]>([]);
    const cardClassName = "rounded-none border-0 bg-white shadow-none";

    useEffect(() => {
        // if (!rawOrders.length) return; 

        const processData = () => {
            let dataPoints: { name: string, total: number, date: Date }[] = [];

            if (timeRange === 'week') {
                // Calendar Week (Mon-Sun) containing currentDate
                const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
                const end = endOfWeek(currentDate, { weekStartsOn: 1 });

                const days = eachDayOfInterval({ start, end });

                dataPoints = days.map(d => ({
                    date: d,
                    name: format(d, 'EEE', { locale: da }), // Man, Tir...
                    total: 0
                }));
            } else if (timeRange === 'month') {
                // Calendar Month (1st - End)
                const start = startOfMonth(currentDate);
                const end = endOfMonth(currentDate);
                const days = eachDayOfInterval({ start, end });

                dataPoints = days.map(d => ({
                    date: d,
                    name: format(d, 'd', { locale: da }), // 1, 2, 3...
                    total: 0
                }));
            } else if (timeRange === 'year') {
                // Calendar Year (Jan - Dec)
                const start = startOfYear(currentDate);
                const end = endOfYear(currentDate);
                const months = eachMonthOfInterval({ start, end });

                dataPoints = months.map(d => ({
                    date: d,
                    name: format(d, 'MMM', { locale: da }), // Jan, Feb...
                    total: 0
                }));
            }

            // Fill Data
            const filledData = dataPoints.map(point => {
                let total = 0;
                if (timeRange === 'year') {
                    // Match Month
                    total = rawOrders
                        .filter(o => isSameMonth(new Date(o.created_at), point.date))
                        .reduce((sum, o) => sum + (o.total_price || 0), 0);
                } else {
                    // Match Day
                    total = rawOrders
                        .filter(o => isSameDay(new Date(o.created_at), point.date))
                        .reduce((sum, o) => sum + (o.total_price || 0), 0);
                }

                // Capitalize name
                const capName = point.name.charAt(0).toUpperCase() + point.name.slice(1);
                return { name: capName, total };
            });

            setChartData(filledData);
        };

        processData();
    }, [rawOrders, timeRange, currentDate]);

    const handleNavigate = (direction: 'prev' | 'next') => {
        const modifier = direction === 'next' ? 1 : -1;

        let newDate = new Date(currentDate);
        if (timeRange === 'week') newDate = addWeeks(newDate, modifier);
        if (timeRange === 'month') newDate = addMonths(newDate, modifier);
        if (timeRange === 'year') newDate = addYears(newDate, modifier);

        // Prevent going before 2025
        if (getYear(newDate) < 2025) return;

        setCurrentDate(newDate);
    };

    const periodLabel = () => {
        if (timeRange === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            if (isSameMonth(start, end)) {
                return `${format(start, 'MMMM yyyy', { locale: da })}`; // December 2025
            }
            return `${format(start, 'MMM', { locale: da })} - ${format(end, 'MMM yyyy', { locale: da })}`;
        }
        if (timeRange === 'month') return format(currentDate, 'MMMM yyyy', { locale: da });
        if (timeRange === 'year') return format(currentDate, 'yyyy', { locale: da });
    };

    return (
        <div className="ow-dashboard">
            <header className="ow-page-heading">
                <div><h1>{greeting}</h1><p>Dit overblik over {shopName}.</p></div>
                <WorkspaceDate />
            </header>

            {loadError ? (
                <div className="ow-state ow-error" role="alert"><AlertCircle /><div><h2>Overblikket kunne ikke hentes</h2><p>Prøv igen for at se shoppens aktuelle ordrer.</p></div><Button variant="outline" onClick={() => { if (shopQuery.isError) void shopQuery.refetch(); else if (tenantId) void ordersQuery.refetch(); }}>Prøv igen</Button></div>
            ) : loading ? (
                <div className="ow-state" role="status"><Loader2 className="animate-spin" /><p>Henter dit ordreoverblik…</p></div>
            ) : !tenantId ? (
                <div className="ow-state" role="status"><Store /><p>Vælg en shop for at se ordrer.</p></div>
            ) : <>
                <section className="ow-task-banner" aria-labelledby="daily-task-heading">
                    <span className="ow-task-icon"><FileText aria-hidden="true" /></span>
                    <div><h2 id="daily-task-heading">{attentionCount > 0 ? `${attentionCount} ${attentionCount === 1 ? 'ordre' : 'ordrer'} ${problemOrders.length ? 'har brug for din opmærksomhed' : 'afventer behandling'}` : 'Du er ajour med ventende ordrer'}</h2><p>{attentionCount > 0 ? 'Gennemgå ordren og filerne, så arbejdet kan komme videre.' : 'Se de seneste ordrer, eller arbejd videre med din webshop.'}</p></div>
                    <Button asChild><Link to={workspaceLink(attentionOrder ? `/admin/kunder?orderId=${attentionOrder.id}` : '/admin/kunder')}>{attentionOrder ? 'Gennemgå ordre' : 'Se ordrer'}<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
                </section>

                <div className="ow-dashboard-columns">
                    <section className="ow-recent-orders">
                        <div className="ow-section-heading"><h2>Seneste ordrer</h2><Link to={workspaceLink('/admin/kunder')}>Se alle ordrer</Link></div>
                        <div className="ow-table-scroll"><table className="ow-table"><thead><tr><th>Ordre / Produkt</th><th>Kunde</th><th>Status</th></tr></thead><tbody>
                            {rawOrders.slice(0, 5).map(order => <tr key={order.id}><td><Link to={workspaceLink(`/admin/kunder?orderId=${order.id}`)}>{order.order_number.startsWith('#') ? order.order_number : `#${order.order_number}`}</Link><span className="ow-table-subline">{order.product_name}</span></td><td>{order.customer_name || order.customer_email || 'Kunde'}</td><td><OrderStatus status={order.status} /></td></tr>)}
                            {rawOrders.length === 0 && <tr><td colSpan={3}><div className="ow-empty"><Package /><h3>Ingen ordrer endnu</h3><p>Nye ordrer vises her, når kunderne bestiller.</p></div></td></tr>}
                        </tbody></table></div>
                    </section>
                    <aside className="ow-shop-panel">
                        <h2>Din webshop</h2>
                        <div className="ow-shop-identity">{logoUrl ? <img src={logoUrl} alt={shopName} onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Store aria-hidden="true" />}<span>{shopName}</span></div>
                        <div className="ow-shop-links">
                            <Link to={workspaceLink('/admin/site-design-v2')}>Redigér Site Design<ChevronRight /></Link>
                            <Link to={workspaceLink('/admin/products')}>Administrér produkter<ChevronRight /></Link>
                            <Link to={workspaceLink('/admin/ressourcer/designs')}>Design Bibliotek<ChevronRight /></Link>
                            <Link to={workspaceLink('/admin/create-product')}>Opret produkt<Plus /></Link>
                        </div>
                        <Link className="ow-message-shortcut" to={workspaceLink('/admin/beskeder')}><span className="ow-task-icon"><Mail /></span><span>Kundedialog<span className="ow-table-subline">Åbn beskeder</span></span><ChevronRight /></Link>
                    </aside>
                </div>

                <details className="ow-analytics" onToggle={event => setAnalyticsOpen(event.currentTarget.open)}><summary>Ordrestatistik <span>{stats.ordersCount} ordrer i alt</span><ChevronRight /></summary>
                    {analyticsOpen && <>
                    <div className="ow-metric-strip">
                        <div><span>Samlet ordreværdi</span><strong>{new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(stats.revenue)}</strong><small>Summen af registrerede ordrer, inklusive annullerede</small></div>
                        <div><span>Ordrer i alt</span><strong>{stats.ordersCount}</strong></div>
                        <div><span>Unikke kundemails</span><strong>{stats.customersCount}</strong></div>
                        <div><span>Afventer behandling</span><strong>{stats.pendingOrders}</strong></div>
                    </div>
            {/* Charts & Activity */}
            <div className="grid gap-4">
                <Card className={`${cardClassName} `}>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <CardTitle>Ordreværdi</CardTitle>
                                <CardDescription className="capitalize">
                                    {periodLabel()}
                                </CardDescription>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Forrige periode" onClick={() => handleNavigate('prev')}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="mx-2 text-xs font-medium min-w-[80px] text-center capitalize">
                                        {timeRange === 'week' ? `Uge ${format(currentDate, 'w', { weekStartsOn: 1 })}` : periodLabel()}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Næste periode" onClick={() => handleNavigate('next')}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                                    <Button
                                        variant={timeRange === 'week' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => { setTimeRange('week'); setCurrentDate(new Date()); }}
                                    >
                                        Uge
                                    </Button>
                                    <Button
                                        variant={timeRange === 'month' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => { setTimeRange('month'); setCurrentDate(new Date()); }}
                                    >
                                        Måned
                                    </Button>
                                    <Button
                                        variant={timeRange === 'year' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => { setTimeRange('year'); setCurrentDate(new Date()); }}
                                    >
                                        År
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}
                                    margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#087FC5" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#087FC5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        interval={timeRange === 'month' ? 4 : 0} // Show every 5th day for flat alignment
                                        height={30}
                                        tickMargin={10}
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
                                        formatter={(value: number) => [`${value} kr`, 'Ordreværdi']}
                                        labelStyle={{ color: '#000' }}
                                        contentStyle={{ borderRadius: '8px' }}
                                    />
                                    <Area type="monotone" dataKey="total" stroke="#087FC5" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

            </div>
                </>}
                </details>
            </>}
        </div>
    );
}
