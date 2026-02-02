import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Eye, TrendingUp } from 'lucide-react';

interface VisitorStats {
    activeNow: number;
    today: number;
    thisWeek: number;
    loading: boolean;
}

export function VisitorStatsWidget() {
    const [stats, setStats] = useState<VisitorStats>({
        activeNow: 0,
        today: 0,
        thisWeek: 0,
        loading: true,
    });

    useEffect(() => {
        fetchStats();

        // Refresh stats every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const now = new Date();

            // Active now (last 5 minutes)
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

            // Today (start of day)
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

            // This week (start of week - Monday)
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).toISOString();

            // Fetch counts - using distinct visitor_id for unique visitors
            const [activeResult, todayResult, weekResult] = await Promise.all([
                // Active now - unique visitors in last 5 min
                supabase
                    .from('page_views' as any)
                    .select('visitor_id')
                    .gte('created_at', fiveMinutesAgo),

                // Today - unique visitors today
                supabase
                    .from('page_views' as any)
                    .select('visitor_id')
                    .gte('created_at', startOfDay),

                // This week - unique visitors this week
                supabase
                    .from('page_views' as any)
                    .select('visitor_id')
                    .gte('created_at', startOfWeek),
            ]);

            // Count unique visitors
            const uniqueActive = new Set((activeResult.data || []).map((r: any) => r.visitor_id)).size;
            const uniqueToday = new Set((todayResult.data || []).map((r: any) => r.visitor_id)).size;
            const uniqueWeek = new Set((weekResult.data || []).map((r: any) => r.visitor_id)).size;

            setStats({
                activeNow: uniqueActive,
                today: uniqueToday,
                thisWeek: uniqueWeek,
                loading: false,
            });
        } catch (error) {
            console.error('Error fetching visitor stats:', error);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    return (
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-2 border">
            {/* Active Now */}
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">{stats.loading ? '...' : stats.activeNow}</span>
                <span className="text-xs text-muted-foreground">nu</span>
            </div>

            <div className="w-px h-4 bg-border" />

            {/* Today */}
            <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm font-medium">{stats.loading ? '...' : stats.today}</span>
                <span className="text-xs text-muted-foreground">i dag</span>
            </div>

            <div className="w-px h-4 bg-border" />

            {/* This Week */}
            <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm font-medium">{stats.loading ? '...' : stats.thisWeek}</span>
                <span className="text-xs text-muted-foreground">uge</span>
            </div>
        </div>
    );
}
