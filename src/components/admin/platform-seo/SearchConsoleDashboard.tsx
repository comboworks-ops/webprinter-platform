/**
 * Search Console Dashboard Component
 * 
 * Displays Search Console metrics and data visualization.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Search,
    Loader2,
    TrendingUp,
    MousePointer,
    Eye,
    BarChart3,
    ExternalLink,
    Unlink,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Info
} from 'lucide-react';
import {
    useSearchConsoleStatus,
    useSearchConsoleAuthUrl,
    useSearchConsoleDisconnect,
    useSearchConsoleSites,
    useSearchConsoleMetrics,
    useSearchConsoleSiteOverview,
} from '@/lib/platform-seo/search-console-hooks';
import { FieldTooltip } from './FieldTooltip';

const FOCUS_SITES = [
    'https://www.webprinter.dk/',
    'https://www.salgsmapper.dk/',
    'https://www.onlinetryksager.dk/',
];

function formatSiteLabel(siteUrl: string): string {
    if (siteUrl.startsWith('sc-domain:')) return siteUrl.replace('sc-domain:', '');
    try {
        return new URL(siteUrl).hostname.replace(/^www\./, '');
    } catch {
        return siteUrl;
    }
}

function safePathFromUrl(value: string): string {
    try {
        const url = new URL(value);
        return url.pathname || '/';
    } catch {
        return value;
    }
}

export function SearchConsoleDashboard() {
    const { data: status, isLoading: statusLoading } = useSearchConsoleStatus();
    const { data: sites } = useSearchConsoleSites();
    const getAuthUrl = useSearchConsoleAuthUrl();
    const disconnect = useSearchConsoleDisconnect();

    const [selectedSite, setSelectedSite] = useState<string>('https://www.webprinter.dk/');
    const [rangeDays, setRangeDays] = useState(28);
    const verifiedSites = useMemo(() => sites?.siteEntry || [], [sites?.siteEntry]);
    const focusSiteUrls = useMemo(() => {
        const verifiedUrls = verifiedSites.map((site) => site.siteUrl);
        const preferred = FOCUS_SITES.filter((siteUrl) => verifiedUrls.includes(siteUrl));
        return preferred.length > 0 ? preferred : verifiedUrls.slice(0, 6);
    }, [verifiedSites]);
    const {
        data: metrics,
        isLoading: metricsLoading,
        error: metricsError,
        refetch: refetchMetrics,
        isFetching: metricsFetching,
    } = useSearchConsoleMetrics(selectedSite, rangeDays);
    const { data: siteOverview, isLoading: overviewLoading } = useSearchConsoleSiteOverview(focusSiteUrls, rangeDays);

    useEffect(() => {
        if (!verifiedSites.length) return;
        if (verifiedSites.some((site) => site.siteUrl === selectedSite)) return;

        const preferredSite = FOCUS_SITES.find((siteUrl) => verifiedSites.some((site) => site.siteUrl === siteUrl));
        setSelectedSite(preferredSite || verifiedSites[0].siteUrl);
    }, [selectedSite, verifiedSites]);

    const handleConnect = async () => {
        try {
            const { authUrl } = await getAuthUrl.mutateAsync();
            window.location.href = authUrl;
        } catch (error) {
            console.error('Failed to get auth URL:', error);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Er du sikker på, at du vil afbryde forbindelsen til Google Search Console?')) return;
        await disconnect.mutateAsync();
    };

    if (statusLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Not connected state
    if (!status?.connected) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Google Search Console
                    </CardTitle>
                    <CardDescription>
                        Forbind til Google Search Console for at se synlighed, klik og søgeord for dine domæner.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 p-6 bg-muted/50 rounded-lg">
                        <Search className="h-12 w-12 text-blue-500" />
                        <div className="flex-1">
                            <h4 className="font-medium mb-1">Forbind din Search Console konto</h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                Klik på knappen nedenfor for at godkende adgang til Google Search Console.
                                Du vil blive omdirigeret til Google for at logge ind.
                            </p>
                            <Button onClick={handleConnect} disabled={getAuthUrl.isPending}>
                                {getAuthUrl.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="mr-2 h-4 w-4" />
                                )}
                                Forbind til Search Console
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-amber-800">
                            <p className="font-medium">Før du forbinder:</p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>Sørg for, at webprinter.dk, salgsmapper.dk og onlinetryksager.dk er verificeret i Search Console</li>
                                <li>Du skal logge ind med den Google-konto, der ejer Search Console</li>
                                <li>Vi anmoder kun om læseadgang - vi ændrer ikke noget</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Connected state
    return (
        <div className="space-y-6">
            {/* Connection Status */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <CardTitle className="text-lg">Forbundet til Search Console</CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}>
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="28">28 dage</SelectItem>
                                    <SelectItem value="90">90 dage</SelectItem>
                                </SelectContent>
                            </Select>
                            {verifiedSites.length > 0 && (
                                <Select value={selectedSite} onValueChange={setSelectedSite}>
                                    <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Vælg site" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {verifiedSites.map((site) => (
                                            <SelectItem key={site.siteUrl} value={site.siteUrl}>
                                                {formatSiteLabel(site.siteUrl)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button variant="outline" size="sm" onClick={() => refetchMetrics()} disabled={metricsFetching}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${metricsFetching ? 'animate-spin' : ''}`} />
                                Opdater
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDisconnect}>
                                <Unlink className="mr-2 h-4 w-4" />
                                Afbryd
                            </Button>
                        </div>
                    </div>
                    <CardDescription>
                        Search Console viser Google-søgeklik og visninger. Det er ikke alle besøgende fra alle kanaler.
                        Forbundet: {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString('da-DK') : 'Ukendt'}
                    </CardDescription>
                </CardHeader>
            </Card>

            {verifiedSites.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Domæneoverblik
                            <FieldTooltip content="Hurtigt overblik over de verificerede Search Console-sites. Klik på et domæne for at se søgeord og sider nedenfor." />
                        </CardTitle>
                        <CardDescription>
                            Google-søgetrafik for de seneste {rangeDays} dage.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {overviewLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : siteOverview && siteOverview.length > 0 ? (
                            <div className="grid gap-3 md:grid-cols-3">
                                {siteOverview.map((site) => {
                                    const selected = site.siteUrl === selectedSite;
                                    return (
                                        <button
                                            key={site.siteUrl}
                                            type="button"
                                            onClick={() => setSelectedSite(site.siteUrl)}
                                            className={`rounded-md border p-4 text-left transition-colors hover:bg-muted/60 ${selected ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-medium">{formatSiteLabel(site.siteUrl)}</div>
                                                {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <div className="text-muted-foreground">Google klik</div>
                                                    <div className="text-xl font-semibold">{site.clicks.toLocaleString('da-DK')}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Visninger</div>
                                                    <div className="text-xl font-semibold">{site.impressions.toLocaleString('da-DK')}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">CTR</div>
                                                    <div className="font-medium">{(site.ctr * 100).toFixed(1)}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Position</div>
                                                    <div className="font-medium">{site.position ? site.position.toFixed(1) : '-'}</div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                                Der er ingen Search Console-data endnu for de valgte domæner. Det kan tage nogle dage efter verificering.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {metricsLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : metricsError ? (
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-red-800">
                            <AlertCircle className="h-5 w-5" />
                            <span>Fejl ved hentning af data: {(metricsError as Error).message}</span>
                        </div>
                    </CardContent>
                </Card>
            ) : metrics ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            Google klik
                                            <FieldTooltip content="Antal gange nogen klikkede på dit organiske søgeresultat i Google. Dette er ikke det samme som alle besøgende på websitet." />
                                        </p>
                                        <p className="text-2xl font-bold">{metrics.totalClicks.toLocaleString('da-DK')}</p>
                                    </div>
                                    <MousePointer className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            Visninger
                                            <FieldTooltip content="Antal gange dit site blev vist i søgeresultater (også selvom ingen klikkede)." />
                                        </p>
                                        <p className="text-2xl font-bold">{metrics.totalImpressions.toLocaleString('da-DK')}</p>
                                    </div>
                                    <Eye className="h-8 w-8 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            CTR
                                            <FieldTooltip content="Click-Through Rate: Procentdel af visninger der resulterede i klik. Høj CTR = folk finder din titel/beskrivelse attraktiv." />
                                        </p>
                                        <p className="text-2xl font-bold">{(metrics.averageCtr * 100).toFixed(1)}%</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            Position
                                            <FieldTooltip content="Din gennemsnitlige placering i Google. Position 1 = øverst. Position 10 = bund af side 1." />
                                        </p>
                                        <p className="text-2xl font-bold">{metrics.averagePosition.toFixed(1)}</p>
                                    </div>
                                    <BarChart3 className="h-8 w-8 text-orange-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Queries */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Top søgeord
                                <FieldTooltip content="De ord og sætninger folk søger på, når dit site vises i Google. Brug disse til at optimere dit indhold!" />
                            </CardTitle>
                            <CardDescription>
                                Hvilke søgninger giver synlighed og klik til {formatSiteLabel(selectedSite)}?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Søgeord</TableHead>
                                        <TableHead className="text-right">Klik</TableHead>
                                        <TableHead className="text-right">Visninger</TableHead>
                                        <TableHead className="text-right">CTR</TableHead>
                                        <TableHead className="text-right">Position</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.topQueries.length > 0 ? metrics.topQueries.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{row.keys[0]}</TableCell>
                                            <TableCell className="text-right">{row.clicks}</TableCell>
                                            <TableCell className="text-right">{row.impressions}</TableCell>
                                            <TableCell className="text-right">{(row.ctr * 100).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right">{row.position.toFixed(1)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                                                Ingen søgeordsdata i perioden.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Top Pages */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Top sider
                                <FieldTooltip content="Hvilke af dine sider får mest trafik fra Google-søgning." />
                            </CardTitle>
                            <CardDescription>
                                Dine bedst performende sider i søgeresultater.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Side</TableHead>
                                        <TableHead className="text-right">Klik</TableHead>
                                        <TableHead className="text-right">Visninger</TableHead>
                                        <TableHead className="text-right">CTR</TableHead>
                                        <TableHead className="text-right">Position</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.topPages.length > 0 ? metrics.topPages.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium max-w-[300px] truncate">
                                                <a
                                                    href={row.keys[0]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 hover:underline"
                                                >
                                                    {safePathFromUrl(row.keys[0])}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </TableCell>
                                            <TableCell className="text-right">{row.clicks}</TableCell>
                                            <TableCell className="text-right">{row.impressions}</TableCell>
                                            <TableCell className="text-right">{(row.ctr * 100).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right">{row.position.toFixed(1)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                                                Ingen sidedata i perioden.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}

export default SearchConsoleDashboard;
